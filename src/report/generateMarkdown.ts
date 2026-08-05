import { ScanReport } from "./types";

export function generateMarkdown(report: ScanReport): string {
  const lines: string[] = [];
  lines.push(`# Accessibility Guardian Report — ${report.app} (${report.environment})`);
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Pages scanned: ${report.pagesScanned}`);
  lines.push("");

  if (report.failedPages.length > 0) {
    lines.push(
      `## ⚠ ${report.failedPages.length} page(s) could not be scanned (not "clean" — unknown; not diffed against baseline)`
    );
    lines.push("");
    lines.push("| Page | Error |");
    lines.push("|---|---|");
    for (const f of report.failedPages) {
      lines.push(`| ${f.pageSlug} | ${f.error} |`);
    }
    lines.push("");
  }

  lines.push("## Summary");
  lines.push("");
  lines.push("| Status | Count |");
  lines.push("|---|---|");
  for (const [status, count] of Object.entries(report.summary.byDiffStatus)) {
    lines.push(`| ${status} | ${count} |`);
  }
  lines.push("");

  const actionable = report.results.filter(
    (r) => r.diffStatus === "new" || r.diffStatus === "reopened" || r.diffStatus === "existing"
  );

  if (actionable.length === 0) {
    lines.push("No new, reopened, or existing open issues found.");
  } else {
    lines.push("## Open issues");
    lines.push("");
    lines.push("| Page | Criterion | Status | Severity | Description |");
    lines.push("|---|---|---|---|---|");
    for (const r of actionable) {
      lines.push(
        `| ${r.pageSlug} | ${r.criteriaCode ?? "—"} | ${r.diffStatus} | ${r.severity} | ${r.description} |`
      );
    }
  }

  return lines.join("\n");
}
