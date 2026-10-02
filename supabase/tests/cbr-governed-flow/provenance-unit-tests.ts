// CBR §D provenance — non-database unit tests against the REAL production
// exports of src/lib/intake/structured-profile.ts (imported by path, not
// reimplemented). No database, no network, no Supabase client. Executable
// right now with the existing toolchain.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/provenance-unit-tests.ts
//
// These tests establish that confirmField()/acquireField() PRODUCE the
// correct confirmed_from_source values and that this survives a realistic
// JSON.stringify/JSON.parse round trip (the same serialization path the
// real Intake submission body goes through before reaching the database).
// They do NOT touch the database — separately, the SQL suite's AC-24..30
// blocks establish that the DB layer correctly COPIES whatever key is
// present; that is a distinct claim from this file's claim that the
// TypeScript layer correctly PRODUCES the right key in the first place.

import {
  emptyField, acquireField, confirmField, type StructuredProfileField,
} from "../../../src/lib/intake/structured-profile";

let failures = 0;
function assertEq(label: string, expected: unknown, actual: unknown) {
  if (expected !== actual) {
    console.error(`[FAIL] ${label}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
    failures++;
  } else {
    console.log(`[PASS] ${label} (=${JSON.stringify(actual)})`);
  }
}
function assertField(label: string, field: StructuredProfileField, expected: Partial<StructuredProfileField>) {
  for (const k of Object.keys(expected) as (keyof StructuredProfileField)[]) {
    assertEq(`${label}.${String(k)}`, expected[k], field[k]);
  }
}

// 1. First confirmation without correction -> preserves the acquisition source.
{
  const acquired = acquireField(emptyField(), { value: "Colombia", source: "cv_extraction", confidence: "high" });
  const confirmed = confirmField(acquired, "beneficiary");
  assertField("first-confirm-no-correction", confirmed, {
    value: "Colombia", source: "beneficiary_confirmed", status: "beneficiary_confirmed", confirmed_from_source: "cv_extraction",
  });
}

// 2. First confirmation with a changed value -> "beneficiary_provided".
{
  const acquired = acquireField(emptyField(), { value: "Colombia", source: "cv_extraction", confidence: "high" });
  const confirmed = confirmField(acquired, "beneficiary", "Venezuela");
  assertField("first-confirm-with-correction", confirmed, {
    value: "Venezuela", confirmed_from_source: "beneficiary_provided",
  });
}

// 3. Unchanged reconfirmation -> preserves established provenance.
{
  const acquired = acquireField(emptyField(), { value: "Mexico", source: "coach_discovery", confidence: "medium" });
  const firstConfirm = confirmField(acquired, "beneficiary");
  assertEq("reconfirm-setup-provenance", "coach_discovery", firstConfirm.confirmed_from_source);
  const reconfirm = confirmField(firstConfirm, "beneficiary"); // no correctedValue
  assertField("unchanged-reconfirmation", reconfirm, {
    value: "Mexico", confirmed_from_source: "coach_discovery",
  });
}

// 4. Changed reconfirmation -> "beneficiary_provided".
{
  const acquired = acquireField(emptyField(), { value: "Mexico", source: "coach_discovery", confidence: "medium" });
  const firstConfirm = confirmField(acquired, "beneficiary");
  const changedReconfirm = confirmField(firstConfirm, "beneficiary", "Guatemala");
  assertField("changed-reconfirmation", changedReconfirm, {
    value: "Guatemala", confirmed_from_source: "beneficiary_provided",
  });
}

// 5. Direct beneficiary entry (never acquired) -> "beneficiary_provided".
{
  const direct = confirmField(emptyField(), "beneficiary", "+15551234567");
  assertField("direct-beneficiary-entry", direct, {
    value: "+15551234567", confirmed_from_source: "beneficiary_provided",
  });
}

// 6. A0-derived confirmation without correction -> preserves acquisition source (cv_extraction, A0's actual source).
{
  const acquired = acquireField(emptyField(), { value: "Ana Maria Lopez", source: "cv_extraction", confidence: "high" });
  const confirmed = confirmField(acquired, "beneficiary"); // no correctedValue
  assertField("a0-derived-no-correction", confirmed, {
    confirmed_from_source: "cv_extraction",
  });
}

// 7. Legacy confirmed fields lacking confirmed_from_source: simulates a record
// confirmed by an OLDER version of confirmField() that never set the field —
// i.e., a real StructuredProfileField object missing the key entirely (not
// merely null), which is exactly what JSON.parse of pre-existing historical
// data produces. Must remain unknown — never fabricated retroactively.
{
  const legacyConfirmed = {
    value: "Old Value", source: "beneficiary_confirmed", confidence: "high",
    status: "beneficiary_confirmed", confirmed_by: "beneficiary", confirmed_at: "2025-01-01T00:00:00.000Z",
    // confirmed_from_source deliberately absent (legacy shape)
  } as unknown as StructuredProfileField;
  assertEq("legacy-field-key-absent", undefined, legacyConfirmed.confirmed_from_source);

  // A reconfirmation of a legacy field (unchanged value): current.status is
  // already beneficiary_confirmed, so the "reconfirmation" branch runs and
  // preserves current.confirmed_from_source verbatim -- which is undefined
  // here, not fabricated as null or any acquisition source.
  const reconfirmLegacy = confirmField(legacyConfirmed, "beneficiary");
  assertEq("legacy-reconfirm-preserves-unknown", undefined, reconfirmLegacy.confirmed_from_source);
  console.log("[NOTE] 'undefined' (not null) is the correct runtime shape for a field whose JSON literally omits the key -- confirmField() must not, and does not, upgrade this to a fabricated value.");
}

// 8. JSON serialization/deserialization preserves confirmed_from_source
// exactly through the SAME round trip the real Intake submission body goes
// through (JSON.stringify on the client, JSON.parse via request.json() on
// the server, per src/app/api/intake/route.ts's `await request.json()`).
{
  const acquired = acquireField(emptyField(), { value: "Peru", source: "cv_extraction", confidence: "high" });
  const confirmed = confirmField(acquired, "beneficiary");
  const roundTripped = JSON.parse(JSON.stringify({ countryOfResidence: confirmed })) as { countryOfResidence: StructuredProfileField };
  assertField("json-round-trip", roundTripped.countryOfResidence, {
    value: "Peru", confirmed_from_source: "cv_extraction", status: "beneficiary_confirmed",
  });
}

// 9. Existing source/status/confirmation behavior is unchanged by the addition.
{
  const acquired = acquireField(emptyField(), { value: "X", source: "staff_entered", confidence: "low" });
  assertField("acquireField-unchanged-behavior", acquired, {
    status: "acquired_unconfirmed", source: "staff_entered", confirmed_by: null, confirmed_at: null,
  });
  const confirmed = confirmField(acquired, "actor-123", "Y");
  assertField("confirmField-source-still-overwritten", confirmed, {
    source: "beneficiary_confirmed", // unchanged existing behavior -- source is NOT confirmed_from_source
    confirmed_by: "actor-123",
  });
  if (confirmed.confirmed_at === null || typeof confirmed.confirmed_at !== "string") {
    console.error("[FAIL] confirmField-sets-confirmed_at: expected a non-null ISO string");
    failures++;
  } else {
    console.log("[PASS] confirmField-sets-confirmed_at");
  }
}

// 10. Conflicting-status field confirmed without correction: preserves the
// ORIGINAL acquisition source recorded before the conflict, not the second
// (conflicting) acquisition attempt's source, per acquireField()'s own
// existing (unchanged) behavior of preserving `current` on conflict.
{
  const acquired = acquireField(emptyField(), { value: "A", source: "cv_extraction", confidence: "high" });
  const conflicting = acquireField(acquired, { value: "B", source: "coach_discovery", confidence: "high" });
  assertEq("conflict-setup-status", "conflicting", conflicting.status);
  assertEq("conflict-setup-source-preserved", "cv_extraction", conflicting.source);
  const confirmedFromConflict = confirmField(conflicting, "beneficiary"); // beneficiary picks the existing value, no correction
  assertField("confirm-from-conflicting", confirmedFromConflict, {
    confirmed_from_source: "cv_extraction",
  });
}

// 11. IC Finding 3 — complete reconfirmation lifecycle regression:
// acquisition -> first confirmation -> new conflicting acquisition ->
// reconfirmation without correction recovers the ORIGINAL confirmed
// provenance (not the conflicting reacquisition's source).
{
  const acquired = acquireField(emptyField(), { value: "A", source: "cv_extraction", confidence: "high" });
  const firstConfirm = confirmField(acquired, "beneficiary");
  assertField("lifecycle-first-confirm", firstConfirm, { value: "A", confirmed_from_source: "cv_extraction", status: "beneficiary_confirmed" });

  const conflicting = acquireField(firstConfirm, { value: "B", source: "coach_discovery", confidence: "high" });
  assertField("lifecycle-conflicting", conflicting, { value: "A", status: "conflicting", confirmed_from_source: "cv_extraction" });
  console.log("[NOTE] field becomes conflicting; original confirmed provenance remains recoverable (value/confirmed_from_source untouched by the conflicting acquisition attempt).");

  const reconfirmed = confirmField(conflicting, "beneficiary"); // no correction supplied
  assertField("lifecycle-reconfirm-without-correction", reconfirmed, {
    value: "A", confirmed_from_source: "cv_extraction", status: "beneficiary_confirmed",
  });

  // reconfirmation WITH a changed value -> beneficiary_provided
  const reconfirmedChanged = confirmField(conflicting, "beneficiary", "C");
  assertField("lifecycle-reconfirm-with-changed-value", reconfirmedChanged, {
    value: "C", confirmed_from_source: "beneficiary_provided",
  });

  // direct beneficiary entry from the conflicting state's sibling scenario (fresh field, no
  // acquisition at all) -> beneficiary_provided, re-asserted here in the lifecycle context.
  const direct = confirmField(emptyField(), "beneficiary", "D");
  assertField("lifecycle-direct-entry", direct, { value: "D", confirmed_from_source: "beneficiary_provided" });
}

// 12. IC Targeted Correction 1 — legacy provenance survives CONFLICT then
// unchanged reconfirmation. Distinct from test #7 above: test #7
// reconfirms a field that is STILL status=beneficiary_confirmed (never
// left that status), which only ever exercises confirmField()'s FIRST
// branch (`current.status === "beneficiary_confirmed"`) and therefore
// never reaches the buggy fallback. This test drives the field through
// acquireField()'s conflict path first (status -> "conflicting", exactly
// as CBR §D's "unchanged reconfirmation preserves provenance" scenario
// requires), so confirmField() must take its OTHER branches -- which is
// where the defect actually lives.
{
  // 12a. confirmed_from_source ABSENT (real legacy JSON shape: the key is
  // literally missing, not merely null).
  const legacyAbsent = {
    value: "Alex", source: "beneficiary_confirmed", confidence: "high",
    status: "beneficiary_confirmed", confirmed_by: "beneficiary", confirmed_at: "2025-01-01T00:00:00.000Z",
    // confirmed_from_source deliberately absent
  } as unknown as StructuredProfileField;
  assertEq("legacy-absent-precondition", undefined, legacyAbsent.confirmed_from_source);

  const conflictedAbsent = acquireField(legacyAbsent, { value: "Other", source: "cv_extraction", confidence: "high" });
  assertEq("legacy-absent-conflict.value", "Alex", conflictedAbsent.value);
  assertEq("legacy-absent-conflict.status", "conflicting", conflictedAbsent.status);
  assertEq("legacy-absent-conflict.confirmed_from_source", undefined, conflictedAbsent.confirmed_from_source);

  const reconfirmedAbsent = confirmField(conflictedAbsent, "beneficiary"); // no correctedValue -> unchanged
  assertField("legacy-absent-unchanged-reconfirm", reconfirmedAbsent, {
    value: "Alex", status: "beneficiary_confirmed", confirmed_from_source: undefined,
  });

  // 12b. Same sequence, but with a GENUINE beneficiary correction -> must become "beneficiary_provided".
  const correctedFromAbsent = confirmField(conflictedAbsent, "beneficiary", "Corrected");
  assertField("legacy-absent-genuine-correction", correctedFromAbsent, {
    value: "Corrected", confirmed_from_source: "beneficiary_provided",
  });
}

{
  // 13. confirmed_from_source explicitly NULL (a different, also-legitimate
  // legacy/serialized shape) — must remain null, not undefined and not
  // fabricated, through the identical conflict + reconfirm sequence.
  const legacyNull: StructuredProfileField = {
    value: "Alex", source: "beneficiary_confirmed", confidence: "high",
    status: "beneficiary_confirmed", confirmed_by: "beneficiary", confirmed_at: "2025-01-01T00:00:00.000Z",
    confirmed_from_source: null,
  };
  const conflictedNull = acquireField(legacyNull, { value: "Other", source: "cv_extraction", confidence: "high" });
  assertEq("legacy-null-conflict.value", "Alex", conflictedNull.value);
  assertEq("legacy-null-conflict.status", "conflicting", conflictedNull.status);
  assertEq("legacy-null-conflict.confirmed_from_source", null, conflictedNull.confirmed_from_source);

  const reconfirmedNull = confirmField(conflictedNull, "beneficiary");
  assertField("legacy-null-unchanged-reconfirm", reconfirmedNull, {
    value: "Alex", status: "beneficiary_confirmed", confirmed_from_source: null,
  });

  const correctedFromNull = confirmField(conflictedNull, "beneficiary", "Corrected");
  assertField("legacy-null-genuine-correction", correctedFromNull, {
    value: "Corrected", confirmed_from_source: "beneficiary_provided",
  });
}

{
  // 14. Known provenance (cv_extraction and coach_discovery) through the
  // IDENTICAL conflict + unchanged-reconfirmation sequence, run
  // side-by-side with the legacy variants above so the same lifecycle is
  // proven to behave correctly for BOTH "known" and "unknown" starting
  // provenance in one self-contained group.
  const knownCv: StructuredProfileField = {
    value: "Alex", source: "beneficiary_confirmed", confidence: "high",
    status: "beneficiary_confirmed", confirmed_by: "beneficiary", confirmed_at: "2025-01-01T00:00:00.000Z",
    confirmed_from_source: "cv_extraction",
  };
  const conflictedCv = acquireField(knownCv, { value: "Other", source: "cv_extraction", confidence: "high" });
  assertEq("known-cv_extraction-conflict.confirmed_from_source", "cv_extraction", conflictedCv.confirmed_from_source);
  const reconfirmedCv = confirmField(conflictedCv, "beneficiary");
  assertField("known-cv_extraction-unchanged-reconfirm", reconfirmedCv, {
    value: "Alex", confirmed_from_source: "cv_extraction",
  });

  const knownCoach: StructuredProfileField = {
    value: "Alex", source: "beneficiary_confirmed", confidence: "high",
    status: "beneficiary_confirmed", confirmed_by: "beneficiary", confirmed_at: "2025-01-01T00:00:00.000Z",
    confirmed_from_source: "coach_discovery",
  };
  const conflictedCoach = acquireField(knownCoach, { value: "Other", source: "cv_extraction", confidence: "high" });
  assertEq("known-coach_discovery-conflict.confirmed_from_source", "coach_discovery", conflictedCoach.confirmed_from_source);
  const reconfirmedCoach = confirmField(conflictedCoach, "beneficiary");
  assertField("known-coach_discovery-unchanged-reconfirm", reconfirmedCoach, {
    value: "Alex", confirmed_from_source: "coach_discovery",
  });
}

{
  // 15. An explicitly supplied correctedValue EQUAL to the retained value
  // must count as unchanged (isCorrection must be false), not as a
  // correction -- for both a legacy-absent and a known-provenance field.
  const legacyAbsent = {
    value: "Alex", source: "beneficiary_confirmed", confidence: "high",
    status: "beneficiary_confirmed", confirmed_by: "beneficiary", confirmed_at: "2025-01-01T00:00:00.000Z",
  } as unknown as StructuredProfileField;
  const conflicted = acquireField(legacyAbsent, { value: "Other", source: "cv_extraction", confidence: "high" });
  const reconfirmedSameValue = confirmField(conflicted, "beneficiary", "Alex"); // explicit, but equal to retained value
  assertField("explicit-correctedValue-equal-to-retained-is-unchanged", reconfirmedSameValue, {
    value: "Alex", confirmed_from_source: undefined,
  });
}

{
  // 16. JSON round-trip: ABSENT stays absent, NULL stays null, KNOWN stays
  // unchanged -- through the same serialize/deserialize path real Intake
  // submissions go through (test #8 above only covers the KNOWN case).
  const legacyAbsent = {
    value: "Alex", source: "beneficiary_confirmed", confidence: "high",
    status: "beneficiary_confirmed", confirmed_by: "beneficiary", confirmed_at: "2025-01-01T00:00:00.000Z",
  } as unknown as StructuredProfileField;
  const roundTrippedAbsent = JSON.parse(JSON.stringify({ f: legacyAbsent })) as { f: StructuredProfileField };
  assertEq("json-round-trip-absent-stays-absent", undefined, roundTrippedAbsent.f.confirmed_from_source);

  const legacyNull: StructuredProfileField = {
    value: "Alex", source: "beneficiary_confirmed", confidence: "high",
    status: "beneficiary_confirmed", confirmed_by: "beneficiary", confirmed_at: "2025-01-01T00:00:00.000Z",
    confirmed_from_source: null,
  };
  const roundTrippedNull = JSON.parse(JSON.stringify({ f: legacyNull })) as { f: StructuredProfileField };
  assertEq("json-round-trip-null-stays-null", null, roundTrippedNull.f.confirmed_from_source);

  const known: StructuredProfileField = {
    value: "Alex", source: "beneficiary_confirmed", confidence: "high",
    status: "beneficiary_confirmed", confirmed_by: "beneficiary", confirmed_at: "2025-01-01T00:00:00.000Z",
    confirmed_from_source: "coach_discovery",
  };
  const roundTrippedKnown = JSON.parse(JSON.stringify({ f: known })) as { f: StructuredProfileField };
  assertEq("json-round-trip-known-stays-known", "coach_discovery", roundTrippedKnown.f.confirmed_from_source);
}

console.log("");
if (failures > 0) {
  console.error(`${failures} assertion(s) FAILED.`);
  process.exit(1);
} else {
  console.log("All provenance unit tests PASSED.");
}
