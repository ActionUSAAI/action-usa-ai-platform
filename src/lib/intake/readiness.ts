// AUSCIS Intake Intelligence Layer -- Automated Readiness domain logic
// (CR-CPS-37/38, design §5.8 reconciled). Framework-agnostic, pure
// function -- no Supabase dependency. Consumed identically by the
// automatic post-submission trigger (src/app/api/intake/route.ts) and
// the staff exception-resolution recheck
// (src/app/api/intake-intelligence/complete/route.ts), per CR-CPS-38's
// "both automatic submission and staff exception re-check must consume
// the SAME domain function" requirement.
//
// Determines ONLY Stage 1 informational readiness for A1 handoff.
// Never: visa/criterion eligibility, case strength, legal sufficiency,
// petition approval likelihood, USCIS adjudication, Evidence
// Verification (RDC-08/09/10). CV presence/absence is never evaluated
// here (RDC-06) -- confirmed by construction: no field below reads
// cvFilePath or any A0-source-specific value.

export type ReadinessReason =
  | "missing_identity_information"
  | "coach_not_completed"
  | "unresolved_structured_profile_conflict";

export type ReadinessResult =
  | { status: "READY" }
  | { status: "NEEDS_ATTENTION"; reasons: ReadinessReason[] };

const REQUIRED_IDENTITY_FIELDS = ["fullName", "email", "whatsapp", "profession"] as const;

export function evaluateReadiness(
  module1: Record<string, string | undefined | null>,
  coachConversation: unknown[],
  structuredProfile: Record<string, { status?: string }>
): ReadinessResult {
  const reasons: ReadinessReason[] = [];

  // RDC-01: required beneficiary identity / baseline information exists.
  const missingIdentity = REQUIRED_IDENTITY_FIELDS.some(f => !module1[f] || !String(module1[f]).trim());
  if (missingIdentity) reasons.push("missing_identity_information");

  // RDC-02: mandatory Coach participation occurred.
  if (coachConversation.length === 0) reasons.push("coach_not_completed");

  // RDC-04: no unresolved Structured Profile conflict blocks progression.
  const hasConflict = Object.values(structuredProfile).some(f => f.status === "conflicting");
  if (hasConflict) reasons.push("unresolved_structured_profile_conflict");

  if (reasons.length > 0) return { status: "NEEDS_ATTENTION", reasons };
  return { status: "READY" };
}
