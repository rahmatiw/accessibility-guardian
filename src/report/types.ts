import { DiffResult } from "../baseline/diffEngine";

export interface FailedPage {
  pageSlug: string;
  error: string;
}

export interface ExcludedPage {
  pageSlug: string;
  reason: string;
}

export interface ScanReport {
  app: string;
  environment: string;
  generatedAt: string;
  pagesScanned: number;
  failedPages: FailedPage[];
  excludedPages: ExcludedPage[];
  summary: {
    byDiffStatus: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  results: DiffResult[];
}

export function buildReport(
  app: string,
  environment: string,
  allDiffs: DiffResult[],
  pagesScanned: number,
  failedPages: FailedPage[] = [],
  excludedPages: ExcludedPage[] = []
): ScanReport {
  const byDiffStatus: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  for (const d of allDiffs) {
    byDiffStatus[d.diffStatus] = (byDiffStatus[d.diffStatus] ?? 0) + 1;
    if (d.severity) bySeverity[d.severity] = (bySeverity[d.severity] ?? 0) + 1;
  }

  return {
    app,
    environment,
    generatedAt: new Date().toISOString(),
    pagesScanned,
    failedPages,
    excludedPages,
    summary: { byDiffStatus, bySeverity },
    results: allDiffs,
  };
}
