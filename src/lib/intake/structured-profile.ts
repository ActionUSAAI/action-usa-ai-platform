// AUSCIS Intake Intelligence Layer -- Structured Profile domain module
// (docs/AUSCIS_INTAKE_INTELLIGENCE_LAYER_FINAL_EXACT_DESIGN.md, CR-CPS-34
// SHA256 51928f1d53a6249a8a5117ac8d8b58dac037645314ee658ff83fbfc7d1eef981,
// design §5.4). Framework-agnostic, mirrors the separation already
// established by record-letter-delivery.ts / run-qa-engine.ts.
//
// Client-held draft state (same pattern as every other Intake module):
// this module contains pure functions only -- no DB access. Persistence
// happens once, atomically, at final /api/intake submission, identical
// to module1-15.

export type StructuredProfileStatus =
  | "not_yet_acquired"
  | "acquired_unconfirmed"
  | "beneficiary_confirmed"
  | "conflicting";

export type StructuredProfileSource =
  | "cv_extraction"
  | "coach_discovery"
  | "beneficiary_confirmed"
  | "staff_entered";

export interface StructuredProfileField {
  value: string | null;
  source: StructuredProfileSource | null;
  confidence: "high" | "medium" | "low" | null;
  status: StructuredProfileStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
}

export type StructuredProfile = Record<string, StructuredProfileField>;

// Identity fields map 1:1 into Module1 (design §5.5, source mapping table
// AUCIS_CV_COACH_INTEGRATION.md §3). Criterion fields are narrative
// buckets surfaced for human review -- NOT auto-written into Module10's
// structured per-criterion arrays (design §5.5's own "punto de partida
// conceptual" deferral: exact array-shape mapping is IMPLEMENTATION-
// DETERMINED, out of this MVP's safe scope; writing free text into a
// typed array field would fabricate malformed evidence entries, which
// the no-silent-overwrite / no-fabrication firewalls (design §5.5, §7)
// forbid).
export const IDENTITY_FIELDS = [
  "familyName", "givenName", "middleName", "dateOfBirth", "nationalities",
  "countryOfResidence", "cityOfResidence", "email", "whatsapp",
  "profession", "industry", "yearsExperience",
] as const;

export const CRITERION_NARRATIVE_FIELDS = [
  "awards", "memberships", "media_coverage", "judging",
  "original_contributions", "scholarly_articles", "critical_role",
  "high_salary", "artistic_exhibitions",
] as const;

export const ALL_STRUCTURED_PROFILE_FIELDS = [...IDENTITY_FIELDS, ...CRITERION_NARRATIVE_FIELDS];

// CR-CPS-57: Class A1 -- truly fixed identity/contact facts, structurally
// protected from automated Coach reacquisition/reopening once
// beneficiary_confirmed (both CV-present and CV-absent acquisition paths;
// see acquireCoachFields() below). Class A2 (profession/industry/
// yearsExperience) is deliberately excluded from this set -- those remain
// legitimate professional-enrichment targets, not frozen facts.
export const CLASS_A1_FIELDS = [
  "familyName", "givenName", "middleName", "dateOfBirth", "nationalities",
  "countryOfResidence", "cityOfResidence", "email", "whatsapp",
] as const;

export function emptyField(): StructuredProfileField {
  return { value: null, source: null, confidence: null, status: "not_yet_acquired", confirmed_by: null, confirmed_at: null };
}

export function emptyStructuredProfile(): StructuredProfile {
  const p: StructuredProfile = {};
  for (const k of ALL_STRUCTURED_PROFILE_FIELDS) p[k] = emptyField();
  return p;
}

// A0/Coach never write beneficiary_confirmed directly (design §5.3's
// firewall: "automatic extraction does not itself constitute ...
// confirmation"). New acquisitions land in acquired_unconfirmed unless
// a value already exists and disagrees, in which case the field is
// marked conflicting and both values are preserved rather than choosing
// one silently (design §7).
export function acquireField(
  current: StructuredProfileField,
  incoming: { value: string; source: StructuredProfileSource; confidence: "high" | "medium" | "low" }
): StructuredProfileField {
  if (current.status === "beneficiary_confirmed") {
    if (current.value === incoming.value) return current;
    return { ...current, status: "conflicting" };
  }
  if (current.status === "acquired_unconfirmed" && current.value && current.value !== incoming.value) {
    return { ...current, status: "conflicting" };
  }
  return {
    value: incoming.value,
    source: incoming.source,
    confidence: incoming.confidence,
    status: "acquired_unconfirmed",
    confirmed_by: null,
    confirmed_at: null,
  };
}

// Beneficiary review action (design §5.7): the only path to
// beneficiary_confirmed. correctedValue lets the beneficiary supplement
// or fix machine output in the same action as confirming it.
export function confirmField(
  current: StructuredProfileField,
  actorId: string,
  correctedValue?: string
): StructuredProfileField {
  return {
    value: correctedValue !== undefined ? correctedValue : current.value,
    source: "beneficiary_confirmed",
    confidence: current.confidence,
    status: "beneficiary_confirmed",
    confirmed_by: actorId,
    confirmed_at: new Date().toISOString(),
  };
}

export function isConflicting(profile: StructuredProfile): boolean {
  return Object.values(profile).some(f => f.status === "conflicting");
}

export function hasAnyAcquiredInformation(profile: StructuredProfile): boolean {
  return Object.values(profile).some(f => f.status !== "not_yet_acquired");
}

// CR-CPS-57 D-03 -- Coach-specific merge entry point. Applies acquireField()
// per field exactly as before, EXCEPT a beneficiary_confirmed Class A1 fact
// is left completely untouched: the incoming Coach-discovered value is
// discarded before acquireField() is ever called, regardless of whether it
// agrees, disagrees, or merely restates the confirmed value in different
// wording/language/formatting. No semantic comparison is performed --
// protection is unconditional and structural once confirmed, on both the
// CV-present and CV-absent acquisition paths. Class A2/Class B fields are
// unaffected and continue through the unmodified acquireField() path.
// A0/staff-entered acquisition is unaffected -- this firewall is
// Coach-specific by design (CR-CPS-57 targets Coach's automated
// reacquisition behavior only, not A0's one-time CV extraction).
export function acquireCoachFields(
  profile: StructuredProfile,
  incoming: Record<string, { value: string; confidence: "high" | "medium" | "low" }>
): StructuredProfile {
  let next = profile;
  for (const [key, f] of Object.entries(incoming)) {
    const existing = next[key] ?? emptyField();
    if ((CLASS_A1_FIELDS as readonly string[]).includes(key) && existing.status === "beneficiary_confirmed") continue;
    next = { ...next, [key]: acquireField(existing, { value: f.value, source: "coach_discovery", confidence: f.confidence }) };
  }
  return next;
}

// CR-CPS-57 §7 -- data-minimized Structured Profile context handed to
// Coach. Carries only `value`/`status` per already-acquired field (never
// `source`/`confidence`/`confirmed_by`/`confirmed_at`, never any field
// outside ALL_STRUCTURED_PROFILE_FIELDS, never Evidence/A1/A5/Blueprint
// data) -- the minimum needed for Coach to avoid redundant acquisition and
// prioritize criterion-relevant follow-up.
export function minimizedProfileContext(
  profile: StructuredProfile
): Record<string, { value: string | null; status: StructuredProfileStatus }> {
  const ctx: Record<string, { value: string | null; status: StructuredProfileStatus }> = {};
  for (const key of ALL_STRUCTURED_PROFILE_FIELDS) {
    const f = profile[key];
    if (!f || f.status === "not_yet_acquired") continue;
    ctx[key] = { value: f.value, status: f.status };
  }
  return ctx;
}
