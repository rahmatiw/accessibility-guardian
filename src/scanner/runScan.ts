import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { GuardianConfig } from "../config/types";
import { PageScanResult, ScanRunResult } from "./types";
import { login } from "./login";
import { axeResultsToViolations } from "./axeToViolations";

export async function runScan(config: GuardianConfig): Promise<ScanRunResult> {
  const startedAt = new Date().toISOString();
  const routes = await config.routeDiscovery.discoverRoutes(config);

  const browser = await chromium.launch();
  const pages: PageScanResult[] = [];

  try {
    const context = await browser.newContext({ baseURL: config.baseURL });
    const page = await context.newPage();

    await login(page, config.baseURL, config.auth);

    for (const route of routes) {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      const axeResults = await new AxeBuilder({ page }).analyze();
      const violations = axeResultsToViolations(axeResults);

      pages.push({
        pageSlug: route.slug,
        pageUrl: new URL(route.path, config.baseURL).toString(),
        violations,
        scannedAt: new Date().toISOString(),
      });
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
