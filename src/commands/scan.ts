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

  // This throws today — see src/scanner/runScan.ts. Left as a real call (not stubbed
  // out silently) so `accessibility-guardian scan` fails loudly and specifically
  // until the scanner is implemented, rather than reporting a false "all clear".
  const scanResult = await runScan(config);

  const allDiffs = scanResult.pages.flatMap((page) => diffPage(page, baseline));
  const report = buildReport(config.app, config.environment, allDiffs, scanResult.pages.length);

  fs.mkdirSync(config.reportDir, { recursive: true });
  fs.writeFileSync(path.join(config.reportDir, "report.md"), generateMarkdown(report));
  fs.writeFileSync(path.join(config.reportDir, "report.json"), generateJson(report));

  const exitCode = (report.summary.byDiffStatus["new"] ?? 0) > 0 ? 1 : 0;
  return exitCode;
}
