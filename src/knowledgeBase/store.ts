import { FixPattern } from "./types";

/**
 * TODO: not yet implemented. Open question (doc §12.8): does this knowledge base
 * live per-repo or shared across all 4 frontends? Sharing means a fix pattern learned
 * in frontend-client could improve suggestions once investwellFront is onboarded —
 * left undecided, so this stub takes no storage-location opinion yet.
 */
export function loadKnowledgeBase(_kbPath: string): FixPattern[] {
  return [];
}

export function recordFixPattern(_kbPath: string, _pattern: FixPattern): void {
  throw new Error("recordFixPattern() is not yet implemented — see src/knowledgeBase/store.ts");
}
