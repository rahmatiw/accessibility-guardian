import fs from "fs";

/**
 * Cross-page waivers, distinct from the per-page baseline. Needed because some accepted,
 * won't-fix issues come from a shared widget/library/theme that appears on many pages —
 * the certified audit reviewed and dropped them per-page (each page tab independently),
 * so a page the audit never happened to sample the same widget on has no matching
 * baseline record, and the live scan correctly (but unhelpfully) reports it as "new"
 * every time that widget shows up somewhere new. Verified 2026-08-12: cross-checked every
 * live "new" finding against its own page's baseline and found zero page+criteria
 * mismatches — the per-page matching itself was never buggy, the issue is these
 * cross-cutting cases were never going to be caught by page-scoped matching in the
 * first place.
 *
 * Deliberately narrow, structural matchers (real DOM/color characteristics), not text
 * keyword matching — axe's own live output is generic rule text (e.g. "Ensure the
 * contrast between foreground and background colors meets..."), not the certified
 * audit's manually-written descriptions ("Insufficient color contrast ratio for 'Low' in
 * Scheme Riskometer") — there is no live signal to keyword-match against.
 */
export interface WaiverMatch {
  ruleId?: string;
  criteriaCode?: string;
  elementHtmlContainsAny?: string[];
  /** True if the failing element's own tag is an SVG primitive (svg/path/rect/circle/text/etc.) —
   *  the signal used for chart/graphic elements (e.g. recharts-rendered Scheme Riskometer, tooltips). */
  elementIsSvgRelated?: boolean;
  /** Exact [foreground, background] hex pairs (lowercase), parsed from axe's own failureSummary text —
   *  only an exact previously-reviewed pair matches; a different pair on the same rule still
   *  surfaces as "new", which is the safe default for anything not already explicitly reviewed. */
  colorPairs?: [string, string][];
}

export interface WaiverRule {
  id: string;
  reason: string;
  match: WaiverMatch;
}

export interface WaiverableViolation {
  ruleId: string | null;
  criteriaCode: string | null;
  elementHtml: string | null;
  description: string;
}

const SVG_TAG_RE = /^<(svg|path|rect|circle|ellipse|text|polygon|polyline|line|g)\b/i;
const COLOR_PAIR_RE = /foreground color: (#[0-9a-fA-F]{3,8}), background color: (#[0-9a-fA-F]{3,8})/;

export function loadWaivers(waiversPath: string | undefined): WaiverRule[] {
  if (!waiversPath || !fs.existsSync(waiversPath)) return [];
  return JSON.parse(fs.readFileSync(waiversPath, "utf8"));
}

function extractColorPair(description: string): [string, string] | null {
  const m = COLOR_PAIR_RE.exec(description);
  if (!m) return null;
  return [m[1].toLowerCase(), m[2].toLowerCase()];
}

export function matchGlobalWaiver(violation: WaiverableViolation, rules: WaiverRule[]): WaiverRule | null {
  for (const rule of rules) {
    const m = rule.match;

    if (m.ruleId && violation.ruleId !== m.ruleId) continue;
    if (m.criteriaCode && violation.criteriaCode !== m.criteriaCode) continue;

    if (m.elementHtmlContainsAny) {
      const html = (violation.elementHtml ?? "").toLowerCase();
      if (!m.elementHtmlContainsAny.some((s) => html.includes(s.toLowerCase()))) continue;
    }

    if (m.elementIsSvgRelated) {
      if (!violation.elementHtml || !SVG_TAG_RE.test(violation.elementHtml.trim())) continue;
    }

    if (m.colorPairs) {
      const pair = extractColorPair(violation.description);
      if (!pair) continue;
      const isKnownPair = m.colorPairs.some(
        ([fg, bg]) => fg.toLowerCase() === pair[0] && bg.toLowerCase() === pair[1]
      );
      if (!isKnownPair) continue;
    }

    return rule;
  }
  return null;
}
