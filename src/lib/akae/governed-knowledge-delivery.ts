import { lookupGovernedKnowledge } from "./governed-knowledge-lookup";

// Minimal delivery/consumption boundary between AKAE's internal storage
// (governed-knowledge-lookup.ts, the LKA-* corpus) and a consumer such as
// AUSCIS/A1. A consumer only ever sees this shape — never the internal
// GovernedLookupResult's sourceFile path or raw verificationEvidence
// markdown. Bounded to this slice: not the full GKDU (GK-01..GK-04), and it
// introduces no status beyond what governed-knowledge-lookup.ts already
// established (no AUTHORITATIVE/FROZEN, no additional states).
export interface GovernedKnowledgeAnswer {
  citation: string;
  verified: boolean;
  text: string | null;
}

export function deliverGovernedKnowledge(citation: string): GovernedKnowledgeAnswer {
  const result = lookupGovernedKnowledge(citation);
  const verified = result.status === "FOUND_AND_VERIFIED";
  return {
    citation,
    verified,
    text: verified ? result.content : null,
  };
}
