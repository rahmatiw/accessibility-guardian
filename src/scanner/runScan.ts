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
    // Establishes the authenticated session in the context's cookies (via a broker->
    // client handoff, if configured) — the returned page itself isn't reused; every
    // route below gets its own fresh page, per the fix above.
    await resolveClientSession(loginPage, context, config.auth);

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
      // itself "interrupted by" the *previous* iteration's target. Session auth is
      // stored in the context's cookies, not the page, so a new page here is still
      // fully authenticated.
      const routePage = await context.newPage();
      try {
        await gotoAndSettle(routePage, pageUrl);
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
