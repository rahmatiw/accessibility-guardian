/**
 * Maps axe-core's `wcagXXX` tags (digits from the SC number with dots removed, e.g.
 * "wcag143" for 1.4.3) back to dotted success-criterion codes.
 *
 * Built from the exact 55-criterion list used in frontend-client's certified audit
 * (accessibility/baseline/, sourced from the "Audit Summary" tab of the certified
 * sheet) rather than guessing axe-core's tag conventions independently — this
 * guarantees the codes a live scan produces line up with the codes already in the
 * baseline. Digit-only parsing would be ambiguous (e.g. "wcag1411" could misparse
 * as SC 1.4.1 followed by a stray "1"), so this is a table, not a regex.
 */
const KNOWN_SUCCESS_CRITERIA = [
  "1.1.1", "1.2.1", "1.2.2", "1.2.3", "1.2.4", "1.2.5",
  "1.3.1", "1.3.2", "1.3.3", "1.3.4", "1.3.5",
  "1.4.1", "1.4.2", "1.4.3", "1.4.4", "1.4.5", "1.4.10", "1.4.11", "1.4.12", "1.4.13",
  "2.1.1", "2.1.2", "2.1.4",
  "2.2.1", "2.2.2",
  "2.3.1",
  "2.4.1", "2.4.2", "2.4.3", "2.4.4", "2.4.5", "2.4.6", "2.4.7", "2.4.11",
  "2.5.1", "2.5.2", "2.5.3", "2.5.4", "2.5.7", "2.5.8",
  "3.1.1", "3.1.2",
  "3.2.1", "3.2.2", "3.2.3", "3.2.4", "3.2.6",
  "3.3.1", "3.3.2", "3.3.3", "3.3.4", "3.3.7", "3.3.8",
  "4.1.2", "4.1.3",
];

const TAG_TO_CRITERIA = new Map<string, string>(
  KNOWN_SUCCESS_CRITERIA.map((code) => [`wcag${code.replace(/\./g, "")}`, code])
);

export function tagToCriteria(tag: string): string | null {
  return TAG_TO_CRITERIA.get(tag) ?? null;
}

/** Extracts every WCAG success-criterion code matched by an axe-core rule's tags. */
export function criteriaFromTags(tags: string[]): string[] {
  const codes = tags.map(tagToCriteria).filter((c): c is string => c !== null);
  return [...new Set(codes)];
}
