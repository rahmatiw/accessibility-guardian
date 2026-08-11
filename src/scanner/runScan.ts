import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { GuardianConfig } from "../config/types";
import { PageScanResult, ScanRunResult } from "./types";
import { login } from "./login";
import { axeResultsToViolations } from "./axeToViolations";
import { gotoAndSettle } from "./navigate";
import { resolveClientSession } from "./clientImpersonation";
import { getComponentNameForSelector, locateComponentSource, ComponentSourceLocation } from "./componentSource";

export async function runScan(config: GuardianConfig): Promise<ScanRunResult> {
  const startedAt = new Date().toISOString();
  const routes = await config.routeDiscovery.discoverRoutes(config);

  const browser = await chromium.launch();
  const pages: PageScanResult[] = [];
  // One source-tree walk per unique component name for the whole run, not per violation.
  const sourceLocationCache = new Map<string, ComponentSourceLocation | null>();

  try {
    const context = await browser.newContext({ baseURL: config.baseURL });
    const loginPage = await context.newPage();

    await login(loginPage, config.baseURL, config.auth, config.reportDir);
    const authenticatedPage = await resolveClientSession(loginPage, context, config.auth);

    // CRITICAL: this app keeps real session identity (uid/user/levelNo) in
    // sessionStorage, not just cookies — confirmed 2026-08-05 by inspecting it
    // directly. sessionStorage is strictly per-tab in every browser; Playwright's
    // context.newPage() opens an unrelated top-level browsing context with no
    // "opener", so it does NOT inherit it the way a real window.open()-created tab
    // would (which is exactly why the client-impersonation popup itself worked, but
    // every subsequent fresh page in the scan loop silently lost auth and bounced to
    // login — verified: 47 of 48 non-excluded routes were actually re-scanning the
    // login page under the wrong slug). Captured once here and re-injected into every
    // route's page below via addInitScript, which runs before the page's own scripts.
    // Wrapped in a catch: with auth.strategy "none" there's no real navigation yet
    // (page is still about:blank), where reading sessionStorage throws a SecurityError.
    const authenticatedSessionStorage = await authenticatedPage
      .evaluate(() => Object.entries(window.sessionStorage))
      .catch(() => [] as [string, string][]);

    const excludedBySlug = new Map((config.excludedRoutes ?? []).map((r) => [r.slug, r.reason]));

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const pageUrl = new URL(route.path, config.baseURL).toString();

      const excludedReason = excludedBySlug.get(route.slug);
      if (excludedReason) {
        console.log(`[${i + 1}/${routes.length}] Skipping ${route.slug}: ${excludedReason}`);
        pages.push({
          pageSlug: route.slug,
          pageUrl,
          violations: [],
          scannedAt: new Date().toISOString(),
          excludedReason,
        });
        continue;
      }

      console.log(`[${i + 1}/${routes.length}] Scanning ${route.slug} (${pageUrl})`);

      // A fresh page per route, not the shared login/impersonation page: verified
      // 2026-08-05 that reusing one page across all 56 routes means a single
      // mid-navigation failure (e.g. axe's evaluate racing an SPA redirect, as
      // happened on a real /app/#/kycOnBoarding/... route) leaves that page's
      // navigation state corrupted, cascading into every subsequent route reporting
      // itself "interrupted by" the *previous* iteration's target.
      const routePage = await context.newPage();
      // Re-inject the real session's sessionStorage before any page script runs —
      // see the comment above authenticatedSessionStorage for why this is necessary.
      await routePage.addInitScript((entries) => {
        for (const [key, value] of entries) {
          window.sessionStorage.setItem(key, value);
        }
      }, authenticatedSessionStorage);
      try {
        await gotoAndSettle(routePage, pageUrl);

        // Safety net, not a one-time fix: even with the sessionStorage re-injection
        // above, a real run against spvithlani.investwellfront.com (2026-08-05)
        // showed a page can *still* silently bounce back to the login screen —
        // intermittently, not tied to any single root cause we could pin down (this
        // is a shared, persistent test environment, not an isolated per-run one; see
        // accessibility.config.js). Without this check, axe would happily scan the
        // login page and the result would be silently misreported under the wrong
        // page slug, exactly as happened before the sessionStorage fix. Better to
        // fail loudly and specifically than risk that ever again.
        if (config.auth.strategy === "credentials" && config.auth.usernameSelector) {
          const bounced = await routePage
            .locator(config.auth.usernameSelector as string)
            .first()
            .isVisible()
            .catch(() => false);
          if (bounced) {
            throw new Error(
              `Bounced back to the login page instead of loading ${pageUrl} — session was lost mid-scan ` +
                "(known to happen intermittently against this shared environment). Findings from this " +
                "page would otherwise be misattributed to it; skipping instead."
            );
          }
        }

        const axeResults = await new AxeBuilder({ page: routePage }).analyze();
        const violations = axeResultsToViolations(axeResults);

        if (config.sourceDir) {
          for (const violation of violations) {
            const componentName = await getComponentNameForSelector(routePage, violation.selector).catch(
              () => null
            );
            violation.componentName = componentName;
            if (!componentName) continue;

            if (!sourceLocationCache.has(componentName)) {
              sourceLocationCache.set(componentName, locateComponentSource(componentName, config.sourceDir));
            }
            const location = sourceLocationCache.get(componentName);
            if (location) {
              violation.sourceFile = location.file;
              violation.sourceLine = location.line;
              violation.sourceAmbiguous = location.ambiguous;
            }
          }
        }

        pages.push({
          pageSlug: route.slug,
          pageUrl,
          violations,
          scannedAt: new Date().toISOString(),
        });
      } catch (err) {
        // One flaky page (a mid-scan SPA redirect, a slow third-party widget, etc.)
        // shouldn't cost the other 55 pages' worth of results — record and move on.
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  -> FAILED to scan ${route.slug}: ${message}`);
        pages.push({
          pageSlug: route.slug,
          pageUrl,
          violations: [],
          scannedAt: new Date().toISOString(),
          scanError: message,
        });
      } finally {
        await routePage.close().catch(() => {});
      }
    }
  } finally {
    await browser.close();
  }

  return {
    app: config.app,
    environment: config.environment,
    startedAt,
    finishedAt: new Date().toISOString(),
    pages,
  };
}
