import { KnowledgeRequirement } from "./knowledge-requirement";

// Minimal precheck exercised by this slice, not the canonical TC-04/AKAE
// Entry Determination capability. It only verifies structural completeness
// of the KnowledgeRequirement; no architectural source has established this
// as sufficient for the full Entry Determination capability.
export interface EntryDeterminationResult {
  entryConditionsSatisfied: boolean;
  reason: string;
}

export function determineEntry(kr: KnowledgeRequirement): EntryDeterminationResult {
  if (!kr.kr01) return { entryConditionsSatisfied: false, reason: "Missing KR01 (identity)." };
  if (!kr.kr02?.citation) return { entryConditionsSatisfied: false, reason: "Missing KR02 citation." };
  if (!kr.kr02?.description) return { entryConditionsSatisfied: false, reason: "Missing KR02 description." };
  if (!kr.kr03) return { entryConditionsSatisfied: false, reason: "Missing KR03 (specialization context)." };
  return { entryConditionsSatisfied: true, reason: "KR01, KR02 and KR03 are all present." };
}
