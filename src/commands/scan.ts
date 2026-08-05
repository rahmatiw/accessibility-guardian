import fs from "fs";
import path from "path";
import { loadConfig } from "../config/loadConfig";
import { loadBaseline } from "../baseline/loadBaseline";
import { runScan } from "../scanner/runScan";
import { diffPage } from "../baseline/diffEngine";
import { buildReport } from "../report/types";
import { generateMarkdown } from "../report/generateMarkdown";
import { generateJson } from "../report/generateJson";

/**
 * Orchestrates the 9-step weekly scan (doc §5):
 *   1. load config, 3. load baseline, 4. discover routes, 5-6. scan (Playwright+axe-core),
 *   7. diff vs baseline, 8. write report, 9. exit with a severity summary.
 * Step 2 ("build/start the target application") is left to whatever runs this command —
 * out of scope for the CLI itself.
 */
export async function scanCommand(cwd: string = process.cwd()): Promise<number> {
  const config = loadConfig(cwd);

  const baseline = loadBaseline(config.baselineDir);
  const routes = await config.routeDiscovery.discoverRoutes(config);

  console.log(
    `Loaded baseline for ${config.app}: ${baseline.index.pageCount} pages, ` +
      `${routes.length} routes discovered via "${config.routeDiscovery.name}".`
  );

  const scanResult = await runScan(config);

  const allDiffs = scanResult.pages.flatMap((page) => diffPage(page, baseline));
  const failedPages = scanResult.pages
    .filter((page) => page.scanError)
    .map((page) => ({ pageSlug: page.pageSlug, error: page.scanError as string }));
  const report = buildReport(config.app, config.environment, allDiffs, scanResult.pages.length, failedPages);

  fs.mkdirSync(config.reportDir, { recursive: true });
  fs.writeFileSync(path.join(config.reportDir, "report.md"), generateMarkdown(report));
  fs.writeFileSync(path.join(config.reportDir, "report.json"), generateJson(report));

  const hasNewIssues = (report.summary.byDiffStatus["new"] ?? 0) > 0;
  const exitCode = hasNewIssues || failedPages.length > 0 ? 1 : 0;
  return exitCode;
}
