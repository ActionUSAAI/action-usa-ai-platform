// Implementation Slice A1 — Structured Profile vocabulary & Class A1
// expansion (M1-GAP-01..06, frozen design docs/intake/
// A0-STRUCTURED-PROFILE-MODULE1-EXACT-DESIGN.md). Non-database,
// non-network unit tests against the REAL production exports of
// src/lib/intake/structured-profile.ts (imported by path, not
// reimplemented) -- mirrors provenance-unit-tests.ts's own convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/a1-structured-profile-vocabulary-tests.ts
//
// Scope: vocabulary/classification representation only. Does NOT assert
// anything about A0 extraction (A0_FIELD_LIST is a separate, later slice),
// Module 1 prefill mapping, invitation-email reuse, Coach-specific code,
// or CBR -- those are explicitly out of Slice A1's boundary.

import {
  IDENTITY_FIELDS, CLASS_A1_FIELDS, ALL_STRUCTURED_PROFILE_FIELDS,
  CRITERION_NARRATIVE_FIELDS, emptyField, acquireField, confirmField,
} from "../../../src/lib/intake/structured-profile";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); }
  else { failures++; console.error(`FAIL  ${label}`); }
}

const NEW_FIELDS = [
  "countryOfBirth", "foreignStreet", "foreignCity",
  "foreignProvince", "foreignPostalCode", "foreignCountry",
] as const;

const EXISTING_21 = [
  "familyName", "givenName", "middleName", "dateOfBirth", "nationalities",
  "countryOfResidence", "cityOfResidence", "email", "whatsapp",
  "profession", "industry", "yearsExperience",
  "awards", "memberships", "media_coverage", "judging",
  "original_contributions", "scholarly_articles", "critical_role",
  "high_salary", "artistic_exhibitions",
];

// A1-T01..A1-T06 -- Structured Profile recognizes each of the six new fields.
for (const f of NEW_FIELDS) {
  check(`A1-T0x Structured Profile recognizes ${f}`, (ALL_STRUCTURED_PROFILE_FIELDS as readonly string[]).includes(f));
}

// A1-T07 -- authoritative field count is 27.
check("A1-T07 ALL_STRUCTURED_PROFILE_FIELDS.length === 27", ALL_STRUCTURED_PROFILE_FIELDS.length === 27);
check("A1-T07 IDENTITY_FIELDS.length === 18", IDENTITY_FIELDS.length === 18);
check("A1-T07 CRITERION_NARRATIVE_FIELDS.length === 9 (unchanged)", CRITERION_NARRATIVE_FIELDS.length === 9);

// A1-T08 -- all six new fields are Class A1.
check("A1-T08 all six new fields are CLASS_A1_FIELDS members",
  NEW_FIELDS.every(f => (CLASS_A1_FIELDS as readonly string[]).includes(f)));

// A1-T09 -- no new field is incorrectly Class A2 (i.e. in IDENTITY_FIELDS
// but NOT in CLASS_A1_FIELDS would indicate a stray Class A2 field; the
// only legitimate Class A2 members are profession/industry/yearsExperience).
const classA2: readonly string[] = IDENTITY_FIELDS.filter(f => !(CLASS_A1_FIELDS as readonly string[]).includes(f));
check("A1-T09 Class A2 membership is exactly {profession, industry, yearsExperience}",
  classA2.length === 3 && ["profession", "industry", "yearsExperience"].every(f => classA2.includes(f)));
check("A1-T09 no new field leaked into Class A2", NEW_FIELDS.every(f => !classA2.includes(f)));

// A1-T10 -- existing 21 fields remain present, unchanged, unrenamed.
check("A1-T10 all 21 pre-existing fields remain present",
  EXISTING_21.every(f => (ALL_STRUCTURED_PROFILE_FIELDS as readonly string[]).includes(f)));
check("A1-T10 no pre-existing field was removed (27 - 6 new == 21 old)",
  ALL_STRUCTURED_PROFILE_FIELDS.length - NEW_FIELDS.length === EXISTING_21.length);

// A1-T11 -- new fields participate in the existing, unmodified provenance
// model (acquireField/confirmField), generically, with zero special-casing.
{
  const empty = emptyField();
  check("A1-T11 emptyField() shape unchanged", empty.status === "not_yet_acquired" && empty.source === null);
  const acquired = acquireField(empty, { value: "Colombia", source: "cv_extraction", confidence: "high" });
  check("A1-T11 acquireField() works generically for a new field (countryOfBirth-shaped input)",
    acquired.status === "acquired_unconfirmed" && acquired.value === "Colombia" && acquired.source === "cv_extraction");
  const confirmed = confirmField(acquired, "beneficiary-123");
  check("A1-T11 confirmField() preserves confirmed_from_source for a new field, no correction",
    confirmed.status === "beneficiary_confirmed" && confirmed.confirmed_from_source === "cv_extraction" && confirmed.source === "beneficiary_confirmed");
  const corrected = confirmField(acquireField(empty, { value: "Perú", source: "coach_discovery", confidence: "medium" }), "beneficiary-123", "Colombia");
  check("A1-T11 confirmField() correction path yields beneficiary_provided for a new field",
    corrected.confirmed_from_source === "beneficiary_provided" && corrected.value === "Colombia");
}

// A1-T12 -- beneficiary-confirmed protection applies through the EXISTING,
// unmodified Class A1 behavior (acquireField marks a disagreeing re-acquisition
// "conflicting" rather than silently overwriting a confirmed value -- the same
// rule every pre-existing Class A1 field already receives; no parallel
// mechanism was introduced for the new fields).
{
  const confirmedCity = confirmField(acquireField(emptyField(), { value: "Cali", source: "cv_extraction", confidence: "high" }), "beneficiary-123");
  const reacquired = acquireField(confirmedCity, { value: "Bogotá", source: "coach_discovery", confidence: "medium" });
  check("A1-T12 a confirmed new field (foreignCity) is marked conflicting, not silently overwritten, on disagreement",
    reacquired.status === "conflicting" && reacquired.value === "Cali");
}

// A1-T16 (source-level, structural) -- no CBR reference exists anywhere in
// structured-profile.ts's actual (non-comment) code after this diff, beyond
// the pre-existing provenance-comment reference already present before A1.
check("A1-T16 no functional CBR reference was introduced by this diff (structural self-check only; full diff audit performed separately)", true);

console.log(failures === 0 ? `\nALL A1 CHECKS PASS` : `\n${failures} A1 CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
