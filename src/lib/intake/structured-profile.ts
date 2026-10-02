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

// confirmed_from_source (CBR Governed Confirmation & Promotion Flow §D):
// distinct from `source`, which confirmField() always overwrites to the
// literal "beneficiary_confirmed" and therefore cannot answer "where did
// this confirmed value originally come from". confirmed_from_source
// answers exactly that, set only by confirmField() (see its state-machine
// comment below); acquireField() never sets it (remains null until a real
// confirmation occurs). Records created before this field existed will
// simply lack the JSON key (deserializes as undefined at runtime, treated
// identically to null everywhere it is read) -- no historical backfill is
// performed or authorized.
export interface StructuredProfileField {
  value: string | null;
  source: StructuredProfileSource | null;
  confidence: "high" | "medium" | "low" | null;
  status: StructuredProfileStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
  confirmed_from_source: StructuredProfileSource | "beneficiary_provided" | null;
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
  return { value: null, source: null, confidence: null, status: "not_yet_acquired", confirmed_by: null, confirmed_at: null, confirmed_from_source: null };
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
    confirmed_from_source: null,
  };
}

// Beneficiary review action (design §5.7): the only path to
// beneficiary_confirmed. correctedValue lets the beneficiary supplement
// or fix machine output in the same action as confirming it.
//
// confirmed_from_source state machine (CBR §D, established across design
// review -- does not alter confirmation authority, `source`'s existing
// overwrite-to-"beneficiary_confirmed" behavior, or any other field):
//   - first confirmation, no correction: preserve current.source (the
//     original acquisition source -- cv_extraction/coach_discovery/
//     staff_entered), whatever it is.
//   - first confirmation, with a real correction (value actually changes):
//     "beneficiary_provided".
//   - reconfirmation (already beneficiary_confirmed), no new correction:
//     preserve current.confirmed_from_source unchanged.
//   - reconfirmation, with a real correction: "beneficiary_provided".
//   - direct beneficiary entry (current.source was never set -- nothing
//     was ever acquired for this field): "beneficiary_provided".
// "First confirmation" covers not_yet_acquired / acquired_unconfirmed /
// conflicting statuses alike -- current.source (or its absence) is what
// distinguishes A0/Coach/staff-derived from direct entry, not the status.
export function confirmField(
  current: StructuredProfileField,
  actorId: string,
  correctedValue?: string
): StructuredProfileField {
  const isCorrection = correctedValue !== undefined && correctedValue !== current.value;
  let confirmed_from_source: StructuredProfileField["confirmed_from_source"];
  if (current.status === "beneficiary_confirmed") {
    confirmed_from_source = isCorrection ? "beneficiary_provided" : current.confirmed_from_source;
  } else if (isCorrection) {
    confirmed_from_source = "beneficiary_provided";
  } else if (current.source === "beneficiary_confirmed") {
    // This field was confirmed before and has since been reacquired into a conflicting (or
    // otherwise non-beneficiary_confirmed) state -- current.source is now the STALE literal
    // "beneficiary_confirmed" left by that prior confirmation (the ONLY place that ever
    // writes this exact literal), not a real acquisition source, so it must not be used AS
    // the provenance value here. current.confirmed_from_source is what genuinely survived
    // that transition (acquireField() only ever changes `status` on a conflicting
    // reacquisition, spreading every other field, including this one, unchanged) and is used
    // VERBATIM below -- including when it is undefined/null, i.e. unknown legacy provenance
    // that predates this field's existence. It must never be substituted with the stale
    // "beneficiary_confirmed" marker itself (IC Targeted Correction 1: a previous version of
    // this branch tested `current.confirmed_from_source` truthiness instead of
    // `current.source === "beneficiary_confirmed"`, so an unknown/falsy legacy value fell
    // through to the `current.source` branch below and manufactured "beneficiary_confirmed"
    // as if it were real acquisition provenance -- found by an executed regression test).
    confirmed_from_source = current.confirmed_from_source;
  } else if (current.source) {
    // Genuine first confirmation of real acquired information: current.source here is a
    // REAL acquisition source (cv_extraction/coach_discovery/staff_entered), never the
    // "beneficiary_confirmed" marker (excluded by the branch above), so it is safe to
    // preserve as the acquisition provenance.
    confirmed_from_source = current.source;
  } else {
    confirmed_from_source = "beneficiary_provided";
  }
  return {
    value: correctedValue !== undefined ? correctedValue : current.value,
    source: "beneficiary_confirmed",
    confidence: current.confidence,
    status: "beneficiary_confirmed",
    confirmed_by: actorId,
    confirmed_at: new Date().toISOString(),
    confirmed_from_source,
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
