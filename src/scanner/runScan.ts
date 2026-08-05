import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { GuardianConfig } from "../config/types";
import { PageScanResult, ScanRunResult } from "./types";
import { login } from "./login";
import { axeResultsToViolations } from "./axeToViolations";
import { gotoAndSettle } from "./navigate";
import { resolveClientSession } from "./clientImpersonation";

export async function runScan(config: GuardianConfig): Promise<ScanRunResult> {
  const startedAt = new Date().toISOString();
  const routes = await config.routeDiscovery.discoverRoutes(config);

  const browser = await chromium.launch();
  const pages: PageScanResult[] = [];

  try {
    const context = await browser.newContext({ baseURL: config.baseURL });
    const loginPage = await context.newPage();

    await login(loginPage, config.baseURL, config.auth, config.reportDir);
    const page = await resolveClientSession(loginPage, context, config.auth);

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const pageUrl = new URL(route.path, config.baseURL).toString();
      console.log(`[${i + 1}/${routes.length}] Scanning ${route.slug} (${pageUrl})`);

      try {
        await gotoAndSettle(page, pageUrl);
        const axeResults = await new AxeBuilder({ page }).analyze();
        const violations = axeResultsToViolations(axeResults);

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
