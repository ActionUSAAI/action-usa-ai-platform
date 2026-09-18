// AUSCIS Intake Intelligence Layer -- Automated Readiness domain logic
// (CR-CPS-37/38, design §5.8 reconciled; corrected under CR-CPS-40
// D-2/D-3). Framework-agnostic, pure function -- no Supabase
// dependency. Consumed identically by the automatic post-submission
// trigger (src/app/api/intake/route.ts) and the staff exception-
// resolution recheck (src/app/api/intake-intelligence/complete/
// route.ts).
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
  | "unresolved_structured_profile_conflict"
  | "unconfirmed_acquired_information";

export type ReadinessResult =
  | { status: "READY" }
  | { status: "NEEDS_ATTENTION"; reasons: ReadinessReason[] };

// CR-CPS-40 D-2: the client UI's mandatory Coach gate (Module0's
// "He terminado de conversar con el Coach" acknowledgment) was
// previously never transmitted or checked server-side -- the server
// accepted any single persisted turn as "Coach completed," a
// materially weaker bar than what the client actually requires. This
// is NOT a redesign of Coach completion semantics (that remains
// deliberately deferred, per the Final Exact Design's own "Coach
// question-generation mechanism...deferred to Implementation"): it is
// parity enforcement -- the server now requires the exact same
// acknowledgment signal the client UI already requires, transmitted
// alongside (not instead of) the persisted transcript, so neither a
// fabricated acknowledgment without real participation, nor real
// participation without acknowledgment, alone suffices.
export interface CoachConversationPayload {
  turns: unknown[];
  acknowledged: boolean;
}

function isCoachConversationPayload(v: unknown): v is CoachConversationPayload {
  return typeof v === "object" && v !== null && Array.isArray((v as CoachConversationPayload).turns);
}

const REQUIRED_IDENTITY_FIELDS = ["fullName", "email", "whatsapp", "profession"] as const;

export function evaluateReadiness(
  module1: Record<string, string | undefined | null>,
  coachConversation: CoachConversationPayload | unknown[],
  structuredProfile: Record<string, { status?: string }>
): ReadinessResult {
  const reasons: ReadinessReason[] = [];

  // RDC-01: required beneficiary identity / baseline information exists.
  const missingIdentity = REQUIRED_IDENTITY_FIELDS.some(f => !module1[f] || !String(module1[f]).trim());
  if (missingIdentity) reasons.push("missing_identity_information");

  // RDC-02: mandatory Coach participation occurred AND was acknowledged
  // by the beneficiary -- same gate the client UI already enforces,
  // now also enforced server-side (CR-CPS-40 D-2).
  const turns = Array.isArray(coachConversation) ? coachConversation : coachConversation.turns;
  const acknowledged = isCoachConversationPayload(coachConversation) ? coachConversation.acknowledged : false;
  if (turns.length === 0 || !acknowledged) reasons.push("coach_not_completed");

  // RDC-04: no unresolved Structured Profile conflict blocks progression.
  const hasConflict = Object.values(structuredProfile).some(f => f.status === "conflicting");
  if (hasConflict) reasons.push("unresolved_structured_profile_conflict");

  // CR-CPS-40 D-3: acquired information the beneficiary never reviewed
  // must not coexist with READY (Final Exact Design §5.8: "beneficiary
  // confirmation obtained" is an Intake Complete prerequisite). This
  // does NOT require every field to be populated -- `not_yet_acquired`
  // fields are never flagged, only fields that WERE acquired but never
  // progressed past `acquired_unconfirmed`.
  const hasUnconfirmedAcquisition = Object.values(structuredProfile).some(f => f.status === "acquired_unconfirmed");
  if (hasUnconfirmedAcquisition) reasons.push("unconfirmed_acquired_information");

  if (reasons.length > 0) return { status: "NEEDS_ATTENTION", reasons };
  return { status: "READY" };
}
