import { PageScanResult } from "../scanner/types";
import { LoadedBaseline } from "./loadBaseline";
import { FindingStatus } from "./types";

export type DiffStatus = "new" | "existing" | "fixed" | "reopened" | "waived";

export interface DiffResult {
  pageSlug: string;
  pageUrl: string;
  criteriaCode: string | null;
  ruleId: string | null;
  description: string;
  severity: string;
  diffStatus: DiffStatus;
  selector: string | null;
  helpUrl: string | null;
  componentName?: string | null;
  sourceFile?: string | null;
  sourceLine?: number | null;
  sourceAmbiguous?: boolean;
}

/**
 * Compares one page's live scan violations against its baseline record and classifies
 * each into New / Existing / Fixed / Reopened / Waived (doc §5 step 7, §6).
 *
 * TODO: matching a live axe-core violation to a specific baseline finding row is a
 * fuzzy-matching problem (same criteriaCode can appear multiple times per page for
 * different elements — see e.g. accessibility/baseline/pages/loan-against-mf.json,
 * which has seven separate 4.1.2 findings). This stub only does the page+criteria-level
 * grouping; element-level matching (via `selector`) is unimplemented.
 */
export function diffPage(scan: PageScanResult, baseline: LoadedBaseline): DiffResult[] {
  if (scan.scanError || scan.excludedReason) {
    // An empty violations list here means "we don't know" (failed) or "deliberately
    // not checked" (excluded) — either way, not "all clear". Diffing it would wrongly
    // report every previously-open finding on this page as "fixed".
    return [];
  }

  const pageBaseline = baseline.pages.get(scan.pageSlug);
  if (!pageBaseline) {
    // A page with no baseline entry at all is out of scope for this diff — it's a
    // newly-added page/route, which per §8 must go through the explicit
    // `accessibility-guardian baseline` command before it's tracked, not get
    // silently absorbed here.
    return [];
  }

  const baselineByCriteria = new Map<string, FindingStatus>();
  for (const finding of pageBaseline.findings) {
    if (finding.criteriaCode) {
      baselineByCriteria.set(finding.criteriaCode, finding.status);
    }
  }

  const results: DiffResult[] = [];
  const criteriaSeenInScan = new Set<string>();

  for (const violation of scan.violations) {
    const code = violation.criteriaCode;
    if (code) criteriaSeenInScan.add(code);

    const baselineStatus = code ? baselineByCriteria.get(code) : undefined;

    let diffStatus: DiffStatus;
    if (baselineStatus === "waived") {
      diffStatus = "waived";
    } else if (baselineStatus === "open") {
      diffStatus = "existing";
    } else if (baselineStatus === "closed_verified") {
      diffStatus = "reopened";
    } else {
      // pass, not_applicable, or no baseline record for this criterion on this page
      diffStatus = "new";
    }

    results.push({
      pageSlug: scan.pageSlug,
      pageUrl: scan.pageUrl,
      criteriaCode: code,
      ruleId: violation.ruleId,
      description: violation.description,
      severity: violation.severity,
      diffStatus,
      selector: violation.selector,
      helpUrl: violation.helpUrl ?? null,
      componentName: violation.componentName,
      sourceFile: violation.sourceFile,
      sourceLine: violation.sourceLine,
      sourceAmbiguous: violation.sourceAmbiguous,
    });
  }

  // Baseline "open" criteria that did NOT show up in this scan's violations = fixed.
  for (const [code, status] of baselineByCriteria.entries()) {
    if (status === "open" && !criteriaSeenInScan.has(code)) {
      results.push({
        pageSlug: scan.pageSlug,
        pageUrl: scan.pageUrl,
        criteriaCode: code,
        ruleId: null,
        description: "(no longer reproduces)",
        severity: "",
        diffStatus: "fixed",
        selector: null,
        helpUrl: null,
      });
    }
  }

  return results;
}
