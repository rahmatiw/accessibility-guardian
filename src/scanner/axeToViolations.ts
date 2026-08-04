import type { AxeResults, Result as AxeRuleResult } from "axe-core";
import { ScanViolation } from "./types";
import { criteriaFromTags } from "./wcagMapping";

/**
 * axe-core's 4-level `impact` doesn't map 1:1 onto the doc's 3-level Critical/Major/Minor
 * severity scale (matching the certified audit's own scale). "serious" and "moderate"
 * both collapse to "Major" — a defensible compression, not a precise equivalence.
 */
function impactToSeverity(impact: AxeRuleResult["impact"]): ScanViolation["severity"] {
  switch (impact) {
    case "critical":
      return "Critical";
    case "serious":
    case "moderate":
      return "Major";
    case "minor":
    default:
      return "Minor";
  }
}

/**
 * Converts axe-core's results for one page into ScanViolation[]. A single axe rule can
 * carry multiple WCAG tags (e.g. a rule flagged under both 1.4.3 and 1.4.11); this emits
 * one ScanViolation per matched criterion so diffing against the baseline — which is
 * one row per (page, criterion) — stays 1:1. Rules with no WCAG tag at all (axe
 * best-practice rules like "region" or "page-has-heading-one") still get reported, with
 * criteriaCode: null, since they have no baseline row to diff against.
 */
export function axeResultsToViolations(results: AxeResults): ScanViolation[] {
  const violations: ScanViolation[] = [];

  for (const rule of results.violations) {
    const criteriaCodes = criteriaFromTags(rule.tags);
    const severity = impactToSeverity(rule.impact);

    for (const node of rule.nodes) {
      const selector = node.target.join(" ");
      const description = node.failureSummary ?? rule.description;

      if (criteriaCodes.length === 0) {
        violations.push({
          criteriaCode: null,
          ruleId: rule.id,
          description,
          severity,
          selector,
          helpUrl: rule.helpUrl,
        });
      } else {
        for (const criteriaCode of criteriaCodes) {
          violations.push({
            criteriaCode,
            ruleId: rule.id,
            description,
            severity,
            selector,
            helpUrl: rule.helpUrl,
          });
        }
      }
    }
  }

  return violations;
}
