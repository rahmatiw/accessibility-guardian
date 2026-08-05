import { ScanReport } from "./types";

export function generateMarkdown(report: ScanReport): string {
  const lines: string[] = [];
  lines.push(`# Accessibility Guardian Report — ${report.app} (${report.environment})`);
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Pages scanned: ${report.pagesScanned}`);
  lines.push("");

  if (report.excludedPages.length > 0) {
    lines.push(
      `## ⊘ ${report.excludedPages.length} page(s) deliberately excluded (known limitation, not a failure — not diffed against baseline)`
    );
    lines.push("");
    lines.push("| Page | Reason |");
    lines.push("|---|---|");
    for (const e of report.excludedPages) {
      lines.push(`| ${e.pageSlug} | ${e.reason} |`);
    }
    lines.push("");
  }

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
    lines.push("| Page | Criterion | Status | Severity | Component (file:line) | Description |");
    lines.push("|---|---|---|---|---|---|");
    for (const r of actionable) {
      let component = r.componentName ?? "—";
      if (r.sourceFile) {
        component += ` (${r.sourceFile}:${r.sourceLine}${r.sourceAmbiguous ? ", ambiguous — multiple matches" : ""})`;
      }
      lines.push(
        `| ${r.pageSlug} | ${r.criteriaCode ?? "—"} | ${r.diffStatus} | ${r.severity} | ${component} | ${r.description} |`
      );
    }
  }

  return lines.join("\n");
}
