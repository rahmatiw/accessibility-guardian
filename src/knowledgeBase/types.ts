/**
 * A fix-pattern entry, captured whenever a finding transitions to Fixed (doc §8.2).
 * Purely additive — improves future suggestions, never changes what's enforced.
 */
export interface FixPattern {
  criteriaCode: string;
  patternKey: string; // e.g. "icon-only-button-missing-accessible-name"
  description: string;
  exampleFixDiff: string;
  learnedFrom: {
    app: string;
    pageSlug: string;
    fixedAt: string;
  };
}
