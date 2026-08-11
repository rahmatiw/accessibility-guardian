import { DiffResult } from "../baseline/diffEngine";
import { criteriaTitle } from "../scanner/wcagMapping";
import { ScanReport } from "./types";

const STATUS_LABEL: Record<string, string> = {
  new: "🔴 NEW",
  reopened: "🟠 REOPENED",
  existing: "🟡 EXISTING",
  fixed: "🟢 FIXED",
  waived: "⚪ WAIVED (accepted, no action needed)",
};

/**
 * axe-core's own text looks like "Fix any of the following:\n  bullet one\n  bullet two"
 * — dumped raw into a Markdown table cell (the old format) that collapses newlines, it
 * reads as one unreadable run-on sentence. This turns it into a real bulleted list.
 */
function formatBullets(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length <= 1) return text.trim();

  const [first, ...rest] = lines;
  return [first, ...rest.map((l) => `  - ${l}`)].join("\n");
}

/**
 * Mirrors the certified audit sheet's own column split (per the user's reference
 * example): a short "Error Description" naming what's wrong and which element, plus a
 * separate "Recommendation for Fix" with the concrete technical fix — not one merged blob.
 */
function formatIssue(r: DiffResult): string {
  const label = STATUS_LABEL[r.diffStatus] ?? r.diffStatus;
  const criterionLine = r.criteriaCode
    ? `**${r.criteriaCode} ${criteriaTitle(r.criteriaCode)}**`
    : "**(no specific WCAG criterion — an axe best-practice check, outside the certified audit's original 55-criterion scope)**";

  const lines: string[] = [];
  lines.push(`#### ${label} — ${criterionLine} — ${r.severity || "n/a"}`);
  lines.push("");

  if (r.help) {
    lines.push(`**Error Description:** ${r.help}`);
    if (r.elementHtml) {
      lines.push("```html");
      lines.push(r.elementHtml);
      lines.push("```");
    }
    lines.push("");
  }

  lines.push(`**Recommendation for Fix:** ${formatBullets(r.description)}`);
  if (r.ruleId) {
    lines.push("");
    lines.push(`**Rule:** \`${r.ruleId}\`${r.helpUrl ? ` — [more info](${r.helpUrl})` : ""}`);
  }
  if (r.selector) {
    lines.push("");
    lines.push(`**Where to find it:** open the page above, then in browser DevTools search for this element:`);
    lines.push("```");
    lines.push(r.selector);
    lines.push("```");
  }
  if (r.componentName && r.sourceFile) {
    lines.push("");
    lines.push(
      `**Possible source (best-effort guess, verify before trusting):** ${r.componentName} in \`${r.sourceFile}${
        r.sourceLine ? `:${r.sourceLine}` : ""
      }\`${r.sourceAmbiguous ? " — multiple files matched this component name, could be wrong" : ""}`
    );
  }
  return lines.join("\n");
}

export function generateMarkdown(report: ScanReport): string {
  const lines: string[] = [];
  lines.push(`# Accessibility Guardian Report — ${report.app} (${report.environment})`);
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Pages scanned: ${report.pagesScanned}`);
  lines.push("");

  if (report.excludedPages.length > 0) {
    lines.push(
      `## ⊘ ${report.excludedPages.length} page(s) deliberately excluded (known limitation, not a failure — not checked this run)`
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
      `## ⚠ ${report.failedPages.length} page(s) could not be scanned (not "clean" — unknown; not checked this run)`
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
    lines.push(`| ${STATUS_LABEL[status] ?? status} | ${count} |`);
  }
  lines.push("");

  const actionable = report.results.filter(
    (r) => r.diffStatus === "new" || r.diffStatus === "reopened" || r.diffStatus === "existing"
  );

  if (actionable.length === 0) {
    lines.push("No new, reopened, or existing open issues found.");
    return lines.join("\n");
  }

  lines.push("## Issues by page");
  lines.push("");
  lines.push(
    "Each page below lists only what actually needs attention (new/reopened/existing) — " +
      "waived and fixed items are counted in the summary above but not repeated here."
  );
  lines.push("");

  const byPage = new Map<string, DiffResult[]>();
  for (const r of actionable) {
    if (!byPage.has(r.pageSlug)) byPage.set(r.pageSlug, []);
    byPage.get(r.pageSlug)!.push(r);
  }

  for (const [pageSlug, issues] of [...byPage.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`### ${pageSlug}`);
    lines.push("");
    lines.push(issues[0].pageUrl);
    lines.push("");
    for (const issue of issues) {
      lines.push(formatIssue(issue));
      lines.push("");
    }
  }

  return lines.join("\n");
}
