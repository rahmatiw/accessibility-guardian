export type FindingStatus =
  | "pass"
  | "not_applicable"
  | "closed_verified"
  | "waived"
  | "open";

export interface BaselineFinding {
  srNo: string;
  criteriaCode: string | null;
  criteriaTitle: string;
  conformanceLevel: string | null;
  status: FindingStatus;
  severity?: string | null;
  errorDescription?: string | null;
  recommendation?: string | null;
  screenshot?: string | null;
  lastInvestwellComment?: string | null;
  lastSdsComment?: string | null;
}

export interface PageBaseline {
  pageName: string;
  pageUrl: string;
  sourceSheetTab: string;
  baselineGeneratedAt: string;
  baselineSource: string;
  counts: Record<FindingStatus, number>;
  findings: BaselineFinding[];
}

export interface BaselineIndexEntry {
  slug: string;
  pageName: string;
  pageUrl: string;
  file: string;
  sourceSheetTabs: string[];
  counts: Record<FindingStatus, number>;
}

export interface BaselineIndex {
  generatedAt: string;
  source: string;
  app: string;
  pageCount: number;
  sourceTabsProcessed?: number;
  totals: {
    pass: number;
    notApplicable: number;
    closedVerified: number;
    waived: number;
    open: number;
  };
  pages: BaselineIndexEntry[];
}
