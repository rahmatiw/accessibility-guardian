import { chromium, BrowserContext } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { GuardianConfig } from "../config/types";
import { PageScanResult, ScanRunResult } from "./types";
import { login } from "./login";
import { axeResultsToViolations } from "./axeToViolations";
import { gotoAndSettle } from "./navigate";
import { resolveClientSession } from "./clientImpersonation";
import { getComponentNameForSelector, locateComponentSource, ComponentSourceLocation } from "./componentSource";

type SessionStorageEntries = [string, string][];

/**
 * Full login + (if configured) broker->client handoff, returning the resulting
 * sessionStorage snapshot to re-inject into every route's fresh page. Pulled out so it
 * can be called again mid-run to recover from session loss, not just once at the start.
 */
async function establishSession(context: BrowserContext, config: GuardianConfig): Promise<SessionStorageEntries> {
  const loginPage = await context.newPage();
  await login(loginPage, config.baseURL, config.auth, config.reportDir);
  const authenticatedPage = await resolveClientSession(loginPage, context, config.auth);

  // CRITICAL: this app keeps real session identity (uid/user/levelNo) in
  // sessionStorage, not just cookies — confirmed 2026-08-05 by inspecting it directly.
  // sessionStorage is strictly per-tab in every browser; Playwright's context.newPage()
  // opens an unrelated top-level browsing context with no "opener", so it does NOT
  // inherit it the way a real window.open()-created tab would. Captured here and
  // re-injected into every route's page via addInitScript, which runs before the
  // page's own scripts. Wrapped in a catch: with auth.strategy "none" there's no real
  // navigation yet (page is still about:blank), where reading sessionStorage throws.
  return authenticatedPage
    .evaluate(() => Object.entries(window.sessionStorage))
    .catch(() => [] as SessionStorageEntries);
}

async function isBouncedToLogin(page: import("playwright").Page, config: GuardianConfig): Promise<boolean> {
  if (config.auth.strategy !== "credentials" || !config.auth.usernameSelector) return false;
  return page
    .locator(config.auth.usernameSelector as string)
    .first()
    .isVisible()
    .catch(() => false);
}

export async function runScan(config: GuardianConfig): Promise<ScanRunResult> {
  const startedAt = new Date().toISOString();
  const routes = await config.routeDiscovery.discoverRoutes(config);

  const browser = await chromium.launch();
  const pages: PageScanResult[] = [];
  // One source-tree walk per unique component name for the whole run, not per violation.
  const sourceLocationCache = new Map<string, ComponentSourceLocation | null>();

  try {
    const context = await browser.newContext({ baseURL: config.baseURL });
    let sessionStorageEntries = await establishSession(context, config);

    const excludedBySlug = new Map((config.excludedRoutes ?? []).map((r) => [r.slug, r.reason]));

    // Bounded, not unlimited: if the environment is genuinely down (e.g. a 502/
    // maintenance-page outage, seen for real 2026-08-12) rather than one flaky session,
    // re-logging in on every subsequent bounce would just hammer a dead backend for the
    // rest of the run. After this many recovery attempts, stop trying to re-auth and
    // just record remaining bounces as failures — a real outage needs a human to notice
    // and retry later, not an automated retry loop that can't tell the difference.
    const MAX_RELOGIN_ATTEMPTS = 3;
    let reLoginAttempts = 0;
    let reLoginExhausted = false;

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

      let succeeded = false;
      let lastErrorMessage = "";

      // Up to 2 attempts: the first with whatever session we currently have (a single
      // bounce can be a one-off blip); if that bounces too, re-authenticate once and
      // retry — this is what actually fixes the "session died on page 2, then every
      // single one of the remaining 50+ pages fails identically" pattern seen for real
      // 2026-08-12, instead of just recording 50 failures and moving on.
      for (let attempt = 0; attempt < 2 && !succeeded; attempt++) {
        // A fresh page per route/attempt, not a shared page: verified 2026-08-05 that
        // reusing one page across routes means a single mid-navigation failure leaves
        // that page's navigation state corrupted, cascading into every subsequent route.
        const routePage = await context.newPage();
        await routePage.addInitScript((entries) => {
          for (const [key, value] of entries) {
            window.sessionStorage.setItem(key, value);
          }
        }, sessionStorageEntries);

        try {
          await gotoAndSettle(routePage, pageUrl);

          if (await isBouncedToLogin(routePage, config)) {
            throw new Error(
              `Bounced back to the login page instead of loading ${pageUrl} — session was lost mid-scan.`
            );
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
          succeeded = true;
        } catch (err) {
          lastErrorMessage = err instanceof Error ? err.message : String(err);
          const isBounce = lastErrorMessage.includes("Bounced back to the login page");

          if (isBounce && attempt === 0 && !reLoginExhausted) {
            if (reLoginAttempts >= MAX_RELOGIN_ATTEMPTS) {
              reLoginExhausted = true;
              console.error(
                `  -> Session lost and already re-authenticated ${MAX_RELOGIN_ATTEMPTS} times this run — ` +
                  "not trying again (likely a real outage, not a one-off session drop). Remaining bounced " +
                  "pages will be recorded as failed without further recovery attempts."
              );
            } else {
              reLoginAttempts++;
              console.log(`  -> Session lost, re-authenticating (attempt ${reLoginAttempts}/${MAX_RELOGIN_ATTEMPTS})...`);
              try {
                sessionStorageEntries = await establishSession(context, config);
                console.log(`  -> Re-authenticated, retrying ${route.slug}...`);
              } catch (reLoginErr) {
                lastErrorMessage =
                  `Session lost, and re-authentication itself failed: ` +
                  (reLoginErr instanceof Error ? reLoginErr.message : String(reLoginErr));
                reLoginExhausted = true;
              }
            }
          }
        } finally {
          await routePage.close().catch(() => {});
        }
      }

      if (!succeeded) {
        console.error(`  -> FAILED to scan ${route.slug}: ${lastErrorMessage}`);
        pages.push({
          pageSlug: route.slug,
          pageUrl,
          violations: [],
          scannedAt: new Date().toISOString(),
          scanError: lastErrorMessage,
        });
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
