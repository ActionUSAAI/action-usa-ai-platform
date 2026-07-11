// Maps the relationshipType slugs persisted by Module9 intake
// (src/app/intake/modules/Module9.tsx) to English prose labels
// for use in A3-generated letters (which are drafted in English).
// Distinct from relLabel() in a1-intake-analyzer/route.ts, which
// maps the same slugs to Spanish UI labels for A1's internal
// prompt context and is not exported/reusable.

const RELATIONSHIP_LABELS_EN: Record<string, string> = {
  supervisor: "supervisor",
  colega: "colleague",
  cliente: "client",
  mentor: "mentor",
  colaborador: "collaborator",
  subordinado: "direct report",
  otro: "professional contact",
};

export function relationshipLabelEn(slug: string): string {
  return RELATIONSHIP_LABELS_EN[slug] ?? slug;
}
