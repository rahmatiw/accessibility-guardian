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
// code -> human-readable title, same order/source as the certified audit's own list
// (Audit Summary tab) — lets reports say "1.4.1 Use of Color" instead of just "1.4.1".
const CRITERIA_TITLES: Record<string, string> = {
  "1.1.1": "Non-text Content",
  "1.2.1": "Pre-recorded Audio-only and Video-only",
  "1.2.2": "Captions (Pre-recorded)",
  "1.2.3": "Audio Description or Media Alternative (Pre-recorded)",
  "1.2.4": "Captions (Live)",
  "1.2.5": "Audio Description (Pre-recorded)",
  "1.3.1": "Info and Relationships",
  "1.3.2": "Meaningful Sequence",
  "1.3.3": "Sensory Characteristics",
  "1.3.4": "Orientation",
  "1.3.5": "Identify Input Purpose",
  "1.4.1": "Use of Color",
  "1.4.2": "Audio Control",
  "1.4.3": "Contrast (Minimum)",
  "1.4.4": "Resize Text",
  "1.4.5": "Images of Text",
  "1.4.10": "Reflow",
  "1.4.11": "Non-Text Contrast",
  "1.4.12": "Text Spacing",
  "1.4.13": "Content on Hover or Focus",
  "2.1.1": "Keyboard",
  "2.1.2": "No Keyboard Trap",
  "2.1.4": "Character Key Shortcuts",
  "2.2.1": "Timing Adjustable",
  "2.2.2": "Pause, Stop, Hide",
  "2.3.1": "Three Flashes or Below Threshold",
  "2.4.1": "Bypass Blocks",
  "2.4.2": "Page Titled",
  "2.4.3": "Focus Order",
  "2.4.4": "Link Purpose (In Context)",
  "2.4.5": "Multiple Ways",
  "2.4.6": "Headings and Labels",
  "2.4.7": "Focus Visible",
  "2.4.11": "Focus Not Obscured (Minimum)",
  "2.5.1": "Pointer Gestures",
  "2.5.2": "Pointer Cancellation",
  "2.5.3": "Label in Name",
  "2.5.4": "Motion Actuation",
  "2.5.7": "Dragging Movements",
  "2.5.8": "Target Size (Minimum)",
  "3.1.1": "Language of Page",
  "3.1.2": "Language of Parts",
  "3.2.1": "On Focus",
  "3.2.2": "On Input",
  "3.2.3": "Consistent Navigation",
  "3.2.4": "Consistent Identification",
  "3.2.6": "Consistent Help",
  "3.3.1": "Error Identification",
  "3.3.2": "Labels or Instructions",
  "3.3.3": "Error Suggestion",
  "3.3.4": "Error Prevention (Legal, Financial, Data)",
  "3.3.7": "Redundant Entry",
  "3.3.8": "Accessible Authentication (Minimum)",
  "4.1.2": "Name, Role, Value",
  "4.1.3": "Status Messages",
};

const KNOWN_SUCCESS_CRITERIA = Object.keys(CRITERIA_TITLES);

const TAG_TO_CRITERIA = new Map<string, string>(
  KNOWN_SUCCESS_CRITERIA.map((code) => [`wcag${code.replace(/\./g, "")}`, code])
);

export function tagToCriteria(tag: string): string | null {
  return TAG_TO_CRITERIA.get(tag) ?? null;
}

/** e.g. "1.4.1" -> "Use of Color". Falls back to the bare code if unknown. */
export function criteriaTitle(code: string): string {
  return CRITERIA_TITLES[code] ?? code;
}

/** Extracts every WCAG success-criterion code matched by an axe-core rule's tags. */
export function criteriaFromTags(tags: string[]): string[] {
  const codes = tags.map(tagToCriteria).filter((c): c is string => c !== null);
  return [...new Set(codes)];
}
