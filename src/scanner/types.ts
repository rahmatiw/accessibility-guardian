/**
 * Shape a live scan (Playwright + axe-core, see src/commands/scan.ts) would produce for one page.
 * Not yet wired to a real scanner — see README "Status" section.
 */
export interface ScanViolation {
  criteriaCode: string | null; // WCAG success criterion, mapped from the underlying axe-core rule id
  ruleId: string; // raw axe-core rule id, e.g. "color-contrast"
  description: string;
  severity: "Critical" | "Major" | "Minor";
  selector: string; // CSS selector / component location of the failing element
  helpUrl?: string;
}

export interface PageScanResult {
  pageSlug: string;
  pageUrl: string;
  violations: ScanViolation[];
  scannedAt: string;
}

export interface ScanRunResult {
  app: string;
  environment: string;
  startedAt: string;
  finishedAt: string;
  pages: PageScanResult[];
}
