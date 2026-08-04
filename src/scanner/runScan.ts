import { GuardianConfig } from "../config/types";
import { ScanRunResult } from "./types";

/**
 * TODO (not yet implemented — this phase only proves the CLI/data shape, see README):
 *   1. Launch Playwright against config.baseURL / config.environment.
 *   2. Run config.auth's login flow.
 *   3. For each route from the configured route-discovery strategy, navigate and
 *      run axe-core (+ any Investwell custom rule checks).
 *   4. Map each axe-core rule id to a WCAG success criterion code (see criteriaCode
 *      on ScanViolation) so results line up with the baseline's criteriaCode field.
 *
 * Recommended deps when this is implemented (deliberately not yet installed):
 *   playwright, @axe-core/playwright
 */
export async function runScan(config: GuardianConfig): Promise<ScanRunResult> {
  const startedAt = new Date().toISOString();

  throw new Error(
    "runScan() is not yet implemented — this is a skeleton build. " +
      "See README.md for what's built vs. pending."
  );

  // Shape of what this will eventually return, left here so callers (src/commands/scan.ts)
  // can already be written against the real return type:
  // return { app: config.app, environment: config.environment, startedAt, finishedAt: new Date().toISOString(), pages: [] };
}
