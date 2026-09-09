// TC-01 — Knowledge Requirement representation (minimal, bounded to this slice).
// KR01: identity. KR02: Knowledge Subject/Need (citation + description). KR03: Specialization Context.
export interface KnowledgeRequirement {
  kr01: string;
  kr02: {
    citation: string;
    description: string;
  };
  kr03: string;
}

export function createKnowledgeRequirement(
  citation: string,
  description: string,
  specializationContext: string
): KnowledgeRequirement {
  return {
    kr01: crypto.randomUUID(),
    kr02: { citation, description },
    kr03: specializationContext,
  };
}
