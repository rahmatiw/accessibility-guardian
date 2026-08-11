/**
 * Shape a live scan (Playwright + axe-core, see src/commands/scan.ts) would produce for one page.
 * Not yet wired to a real scanner — see README "Status" section.
 */
export interface ScanViolation {
  criteriaCode: string | null; // WCAG success criterion, mapped from the underlying axe-core rule id
  ruleId: string; // raw axe-core rule id, e.g. "color-contrast"
  /** Short human summary of what's wrong, e.g. "Images must have alternative text" (axe rule.help). */
  help: string;
  /** The actual failing HTML snippet, e.g. `<img src="x.png">` — the closest thing to the certified
   *  audit sheet's "1. Books 2. Vacation..." concrete instance list, without a human manually naming each one. */
  elementHtml: string;
  /** Longer WCAG-oriented explanation + the specific failure checklist (axe rule.description + node.failureSummary). */
  description: string;
  severity: "Critical" | "Major" | "Minor";
  selector: string; // CSS selector / component location of the failing element
  helpUrl?: string;
  /** Nearest real React component name, from live fiber inspection — see componentSource.ts. */
  componentName?: string | null;
  /** File path (relative to config.sourceDir) + line where componentName is declared, if found via source grep. */
  sourceFile?: string | null;
  sourceLine?: number | null;
  /** True if more than one file matched componentName — sourceFile/sourceLine is a best guess, not certain. */
  sourceAmbiguous?: boolean;
}

export interface PageScanResult {
  pageSlug: string;
  pageUrl: string;
  violations: ScanViolation[];
  scannedAt: string;
  /** Set when this page couldn't be scanned (nav failure, axe crash, etc.) — violations will be empty, not "clean". */
  scanError?: string;
  /** Set when this page was deliberately skipped (config.excludedRoutes) rather than failing unexpectedly. */
  excludedReason?: string;
}

export interface ScanRunResult {
  app: string;
  environment: string;
  startedAt: string;
  finishedAt: string;
  pages: PageScanResult[];
}
