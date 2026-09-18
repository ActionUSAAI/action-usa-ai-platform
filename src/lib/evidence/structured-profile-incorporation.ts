import type { StructuredProfile, StructuredProfileField } from "@/lib/intake/structured-profile";
import { IDENTITY_FIELDS } from "@/lib/intake/structured-profile";

// Structured Profile -> Evidence Incorporation -- centralized eligibility /
// candidate-resolution module (CR-CPS-46..53, DDR-SEI-01/02/03). Pure,
// framework-agnostic, no DB client, no AI call, no Evidence verification --
// mirrors the separation already established by src/lib/intake/readiness.ts.
// Single source of truth reused by both the deterministic batch surface and
// the human-resolution candidate surface -- no divergent eligibility logic
// duplicated across routes/UI.

export type IncorporationPath = "deterministic" | "human_resolution";

export interface IncorporationCandidate {
  fieldKey: string;
  value: string;
  source: string;
  confidence: string | null;
  status: string;
  path: IncorporationPath;
}

const IDENTITY_FIELD_SET = new Set<string>(IDENTITY_FIELDS as readonly string[]);

function isIdentityField(fieldKey: string): boolean {
  return IDENTITY_FIELD_SET.has(fieldKey);
}

// DDR-SEI-01: not_yet_acquired/conflicting never eligible; acquired_unconfirmed
// eligible only for identity fields sourced cv_extraction; beneficiary_confirmed
// always eligible regardless of field type or source.
export function isEligible(field: StructuredProfileField, fieldKey: string): boolean {
  if (!field.value) return false;
  if (field.status === "not_yet_acquired" || field.status === "conflicting") return false;
  if (field.status === "beneficiary_confirmed") return true;
  if (field.status === "acquired_unconfirmed") {
    return isIdentityField(fieldKey) && field.source === "cv_extraction";
  }
  return false;
}

// DDR-SEI-02: identity fields -> deterministic path; criterion narrative
// fields -> always human resolution, regardless of source/confidence/status.
export function classifyPath(fieldKey: string): IncorporationPath {
  return isIdentityField(fieldKey) ? "deterministic" : "human_resolution";
}

export function resolveIncorporationCandidates(profile: StructuredProfile): IncorporationCandidate[] {
  const candidates: IncorporationCandidate[] = [];
  for (const [fieldKey, field] of Object.entries(profile)) {
    if (!isEligible(field, fieldKey)) continue;
    candidates.push({
      fieldKey,
      value: field.value as string,
      source: field.source ?? "",
      confidence: field.confidence,
      status: field.status,
      path: classifyPath(fieldKey),
    });
  }
  return candidates;
}

const FIELD_LABELS: Record<string, string> = {
  familyName: "Apellido", givenName: "Nombre", middleName: "Segundo nombre",
  dateOfBirth: "Fecha de nacimiento", nationalities: "Nacionalidad",
  countryOfResidence: "País de residencia", cityOfResidence: "Ciudad de residencia",
  email: "Correo electrónico", whatsapp: "WhatsApp", profession: "Profesión",
  industry: "Industria", yearsExperience: "Años de experiencia",
  awards: "Premios", memberships: "Membresías", media_coverage: "Cobertura mediática",
  judging: "Jurado/evaluación", original_contributions: "Contribuciones originales",
  scholarly_articles: "Artículos académicos", critical_role: "Rol crítico",
  high_salary: "Salario alto", artistic_exhibitions: "Exhibiciones artísticas",
};

// Deterministic-path fact text: label + value only, no transformation, no
// inference (design §10 -- one field's value is already one atomic fact).
export function buildDeterministicFact(fieldKey: string, value: string): string {
  const label = FIELD_LABELS[fieldKey] ?? fieldKey;
  return `${label}: ${value}`;
}
