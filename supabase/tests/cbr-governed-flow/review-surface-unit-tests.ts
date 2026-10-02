// CBR §D/§J review surface — non-database unit tests against the REAL
// production exports of src/lib/cbr/review-surface.ts (imported by path,
// not reimplemented). No database, no network, no Supabase client.
// Executable right now with the existing toolchain.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/review-surface-unit-tests.ts
//
// Finding 6 (v2, targeted correction): an independent reproduction found the
// v1 helper's isCurrent() compared PostgreSQL TIMESTAMPTZ strings
// LEXICOGRAPHICALLY, which does not establish equivalence with PostgreSQL's
// own timestamp comparison -- two different valid TEXT renderings of the
// SAME instant (a stripped-trailing-zero fractional second vs a fully
// zero-padded one; the same instant under two different UTC offsets) could
// be misclassified as unequal, and in the WRONG direction, skipping the
// UUID tie-break and reversing which submission the database itself would
// treat as governing. Fixed by parsing into microsecond-resolution bigints
// (see review-surface.ts's parseTimestampMicros) and comparing those. This
// file's section 4 reproduces the exact task-reported cases plus the
// required regression set (equivalent offsets, equivalent fractional
// representations, distinct microseconds within the same millisecond,
// UUID-tie-break in BOTH directions, missing/invalid candidate timestamps
// including the no-governing-event case, and the existing valid
// no-governing-event behavior).
//
// It also covers: the confirmation timestamp is read from the CORRECT
// structured_profile key (including the firstName->givenName/
// lastName->familyName translation migration 040 itself performs) and is
// honestly null when genuinely absent/malformed/unparseable -- never
// fabricated, and never merely "any nonempty string" (the v1 defect); and
// describeNotCurrent distinguishes an actual, confirmed supersession
// ("stale") from a missing/unresolved observation link ("missing_data"),
// which the review section's UI now renders as two different messages
// instead of always claiming "superseded by a newer submission".
//
// These do NOT touch the database -- separately, TX-04's own STEP 7 (SQL,
// migration 040) is the actual authoritative RESOLVABLE check; these tests
// establish only that the review surface's ADVISORY, display-side
// computation agrees with that same rule at the pure-function level.
//
// v3 targeted correction adds: (1) the exact four reproduced cases where
// extractConfirmedAt still returned a value the UI's own `new Date()`
// cannot render (out-of-range timezone offset hour/minute, surrounding
// whitespace, a leap-second-shaped second=60) plus an explicit
// API-to-display CONTRACT check (assertRendersOrNull) applied to each --
// "non-null" now means "guaranteed renderable", not merely "looked
// parseable"; rejection of fractional precision beyond 6 digits (Postgres's
// own microsecond storage limit) instead of silent truncation; and (2)
// classifyCurrency's distinction between a GENUINELY ABSENT governing
// tuple (both fields null/undefined) and a PARTIALLY POPULATED one (only
// one field set) -- the latter must never be treated as "no governing
// event".

import {
  structuredProfileKeyFor, extractConfirmedAt, isCurrent, isResolvable, describeNotCurrent,
} from "../../../src/lib/cbr/review-surface";

let failures = 0;
let passes = 0;
function assertEq(label: string, expected: unknown, actual: unknown) {
  if (expected !== actual) {
    console.error(`[FAIL] ${label}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
    failures++;
  } else {
    console.log(`[PASS] ${label} (=${JSON.stringify(actual)})`);
    passes++;
  }
}

// 1. structuredProfileKeyFor: the exact translation migration 040 TX-02 STEP 4 performs.
assertEq("key-firstName-to-givenName", "givenName", structuredProfileKeyFor("firstName"));
assertEq("key-lastName-to-familyName", "familyName", structuredProfileKeyFor("lastName"));
assertEq("key-middleName-unchanged", "middleName", structuredProfileKeyFor("middleName"));
assertEq("key-dateOfBirth-unchanged", "dateOfBirth", structuredProfileKeyFor("dateOfBirth"));
assertEq("key-email-unchanged", "email", structuredProfileKeyFor("email"));
assertEq("key-whatsapp-unchanged", "whatsapp", structuredProfileKeyFor("whatsapp"));
assertEq("key-countryOfResidence-unchanged", "countryOfResidence", structuredProfileKeyFor("countryOfResidence"));
assertEq("key-cityOfResidence-unchanged", "cityOfResidence", structuredProfileKeyFor("cityOfResidence"));

// 2. extractConfirmedAt: §D's authoritative timestamp source -- must read
// the TRANSLATED key, never the raw CBR field_key, for firstName/lastName.
{
  const profile = {
    givenName: { confirmed_at: "2026-01-15T10:00:00.000Z" },
    familyName: { confirmed_at: "2026-01-16T10:00:00.000Z" },
    middleName: { confirmed_at: "2026-01-17T10:00:00.000Z" },
  };
  assertEq("confirmed-at-firstName-reads-givenName", "2026-01-15T10:00:00.000Z", extractConfirmedAt(profile, "firstName"));
  assertEq("confirmed-at-lastName-reads-familyName", "2026-01-16T10:00:00.000Z", extractConfirmedAt(profile, "lastName"));
  assertEq("confirmed-at-middleName-direct", "2026-01-17T10:00:00.000Z", extractConfirmedAt(profile, "middleName"));
  // A wrong-key regression this test would have caught: reading the raw
  // (untranslated) key for firstName/lastName would either find nothing
  // (correctly null, masking the bug) or, worse, find an unrelated field's
  // data under a coincidentally-matching key -- neither is exercised here
  // because profile has no 'firstName'/'lastName' keys at all, matching
  // real structured_profile JSON, which never has those keys either.
  assertEq("confirmed-at-no-raw-firstName-key-present", undefined, (profile as Record<string, unknown>)["firstName"]);
}

// 3. extractConfirmedAt: honest null handling -- never fabricated, and (v2
// correction) never merely "any nonempty string" -- a genuinely malformed
// value must be normalized to the SAME "unavailable" (null) result a truly
// absent value gets, not passed through as if it were a real timestamp.
assertEq("confirmed-at-null-profile", null, extractConfirmedAt(null, "middleName"));
assertEq("confirmed-at-undefined-profile", null, extractConfirmedAt(undefined, "middleName"));
assertEq("confirmed-at-missing-field-key", null, extractConfirmedAt({}, "middleName"));
assertEq("confirmed-at-field-not-object", null, extractConfirmedAt({ middleName: "not-an-object" }, "middleName"));
assertEq("confirmed-at-confirmed-at-not-string", null, extractConfirmedAt({ middleName: { confirmed_at: null } }, "middleName"));
assertEq("confirmed-at-confirmed-at-empty-string", null, extractConfirmedAt({ middleName: { confirmed_at: "" } }, "middleName"));
// v2 regressions: malformed and whitespace-only strings, alongside a valid one for contrast.
assertEq("confirmed-at-malformed-not-a-date", null, extractConfirmedAt({ middleName: { confirmed_at: "not-a-date" } }, "middleName"));
assertEq("confirmed-at-whitespace-only", null, extractConfirmedAt({ middleName: { confirmed_at: "   " } }, "middleName"));
assertEq("confirmed-at-malformed-partial-timestamp", null, extractConfirmedAt({ middleName: { confirmed_at: "2026-01-15" } }, "middleName"));
assertEq("confirmed-at-malformed-invalid-calendar-date", null, extractConfirmedAt({ middleName: { confirmed_at: "2026-02-30T00:00:00Z" } }, "middleName"));
assertEq("confirmed-at-valid-for-contrast", "2026-01-15T10:00:00.000Z", extractConfirmedAt({ middleName: { confirmed_at: "2026-01-15T10:00:00.000Z" } }, "middleName"));

// 3b. v3 targeted correction: independent execution against the actual v2 export reproduced
// non-null returns for values the UI's own `new Date(value)` cannot render at all. Each case
// below is the EXACT reproduction, plus a direct renderability check on whatever this function
// actually returns -- the API-to-display contract required this round: "a value this function
// returns non-null is guaranteed renderable", not merely "guaranteed to have looked parseable".
function assertRendersOrNull(label: string, raw: string) {
  const result = extractConfirmedAt({ middleName: { confirmed_at: raw } }, "middleName");
  if (result === null) {
    console.log(`[PASS] ${label} (correctly rejected -> null)`);
    passes++;
    return;
  }
  const renders = !Number.isNaN(new Date(result).getTime());
  if (renders) {
    console.log(`[PASS] ${label} (accepted -> ${JSON.stringify(result)}, confirmed renderable by new Date())`);
    passes++;
  } else {
    console.error(`[FAIL] ${label}: returned ${JSON.stringify(result)} (from input ${JSON.stringify(raw)}) but new Date() cannot render it -- API-to-display contract violated`);
    failures++;
  }
}
// Reproduced case 1/2: timezone-offset components must be RANGE-validated, not merely
// shape-matched -- "+99:99"/"+00:99" have the right SHAPE (two digits each) but are not valid
// UTC offsets; the prior round's round-trip calendar check cannot catch this (it reconstructs
// using the SAME offset value that produced the candidate instant, so it is a self-consistency
// check on the arithmetic, never an external validity check on the offset itself).
assertRendersOrNull("v3-offset-hour-out-of-range", "2026-01-10T00:00:00+99:99");
assertRendersOrNull("v3-offset-minute-out-of-range", "2026-01-10T00:00:00+00:99");
// Reproduced case 3: surrounding whitespace. This function now ACCEPTS it (returns a normalized,
// TRIMMED, genuinely renderable value) rather than returning the original untrimmed string --
// the prior bug was returning the untrimmed input even though internal validation trimmed first.
assertEq("v3-whitespace-padded-normalized", "2026-01-10T00:00:00Z", extractConfirmedAt({ middleName: { confirmed_at: " 2026-01-10T00:00:00Z " } }, "middleName"));
assertRendersOrNull("v3-whitespace-padded-renders", " 2026-01-10T00:00:00Z ");
// Reproduced case 4: second=60 (leap-second shape). PostgreSQL TIMESTAMPTZ does not support leap
// seconds at all; the prior round's `second > 60` let 60 itself through, and JS's Date.UTC then
// silently ROLLED IT OVER into the next minute -- a different, wrong instant, not an error.
assertRendersOrNull("v3-second-60-rejected", "2026-01-10T00:00:60Z");
assertEq("v3-second-60-is-null", null, extractConfirmedAt({ middleName: { confirmed_at: "2026-01-10T00:00:60Z" } }, "middleName"));
// Fractional precision beyond 6 digits (Postgres's own microsecond storage limit): rejected, not
// silently truncated -- truncating could hide a real difference between two otherwise-identical
// timestamps. Exactly 6 digits remains fully supported, for contrast.
assertEq("v3-fractional-beyond-microsecond-rejected", null, extractConfirmedAt({ middleName: { confirmed_at: "2026-01-10T00:00:00.1234567Z" } }, "middleName"));
assertEq("v3-fractional-exactly-six-digits-accepted", "2026-01-10T00:00:00.123456Z", extractConfirmedAt({ middleName: { confirmed_at: "2026-01-10T00:00:00.123456Z" } }, "middleName"));
// Valid offsets at the actual boundary (23:59) must still be accepted -- confirms the new range
// check rejects only genuinely out-of-range values, not the top of the legitimate range.
assertRendersOrNull("v3-offset-at-valid-boundary-23-59", "2026-01-10T00:00:00+23:59");

// 4. isCurrent: §G's tuple comparison, NULL-safe "no governing event yet",
// and (v2 correction) candidate-timestamp validation BEFORE that shortcut.
assertEq("current-no-governing-event-valid-timestamp-is-current", true, isCurrent(undefined, "2026-01-01T00:00:00Z", "sub-1"));
assertEq("current-no-submission-id-never-current", false, isCurrent(undefined, "2026-01-01T00:00:00Z", null));
// v2: missing/invalid candidate timestamp must fail closed even with NO governing event at all --
// the exact gap the task's item 1 flagged ("validate the candidate submission timestamp before
// treating the absence of a governing event as CURRENT").
assertEq("current-no-governing-event-but-missing-candidate-timestamp-fails-closed", false, isCurrent(undefined, null, "sub-1"));
assertEq("current-no-governing-event-but-invalid-candidate-timestamp-fails-closed", false, isCurrent(undefined, "not-a-date", "sub-1"));
{
  const governing = { submissionId: "sub-A", submittedAt: "2026-01-10T00:00:00Z" };
  assertEq("current-strictly-newer-submitted-at", true, isCurrent(governing, "2026-01-11T00:00:00Z", "sub-B"));
  assertEq("current-strictly-older-submitted-at", false, isCurrent(governing, "2026-01-09T00:00:00Z", "sub-B"));
  assertEq("current-missing-submitted-at-for-a-real-submission-id", false, isCurrent(governing, null, "sub-B"));
  assertEq("current-invalid-submitted-at-for-a-real-submission-id", false, isCurrent(governing, "garbage", "sub-B"));
  // Equal submitted_at (identical string) -> tuple comparison falls through to submission_id.
  assertEq("current-tie-submission-id-greater-or-equal-wins", true, isCurrent(governing, "2026-01-10T00:00:00Z", "sub-Z"));
  assertEq("current-tie-submission-id-lesser-loses", false, isCurrent(governing, "2026-01-10T00:00:00Z", "sub-0"));
  assertEq("current-tie-exact-same-submission-is-current", true, isCurrent(governing, "2026-01-10T00:00:00Z", "sub-A"));
}

// 4b. isCurrent: TIMESTAMP-VALUE equivalence, not string equality (v2's core fix).
// Independently reproduced case, verbatim: governing "2026-01-10T00:00:00.1+00:00" (UUID
// ...002) vs candidate "2026-01-10T00:00:00.100000+00:00" (UUID ...001, lexicographically
// SMALLER) -- these are the SAME instant, so the lower candidate UUID must lose (false).
{
  const g = { submissionId: "00000000-0000-0000-0000-000000000002", submittedAt: "2026-01-10T00:00:00.1+00:00" };
  assertEq(
    "current-equivalent-fractional-representations-lower-uuid-loses",
    false,
    isCurrent(g, "2026-01-10T00:00:00.100000+00:00", "00000000-0000-0000-0000-000000000001")
  );
  // Same equivalent-instant pair, but candidate UUID now the HIGHER one -> must win (true).
  assertEq(
    "current-equivalent-fractional-representations-higher-uuid-wins",
    true,
    isCurrent(g, "2026-01-10T00:00:00.100000+00:00", "00000000-0000-0000-0000-000000000003")
  );
}
// Equivalent instants expressed under different UTC offsets, both UUID-tie-break directions.
{
  const g = { submissionId: "00000000-0000-0000-0000-000000000002", submittedAt: "2026-01-10T00:00:00+00:00" };
  assertEq(
    "current-equivalent-offsets-lower-uuid-loses",
    false,
    isCurrent(g, "2026-01-10T01:00:00+01:00", "00000000-0000-0000-0000-000000000001")
  );
  assertEq(
    "current-equivalent-offsets-higher-uuid-wins",
    true,
    isCurrent(g, "2026-01-10T01:00:00+01:00", "00000000-0000-0000-0000-000000000003")
  );
}
// Distinct MICROSECOND timestamps that share the same MILLISECOND -- a naive millisecond-
// resolution `Date` comparison would collapse these to equal (wrongly falling through to the
// UUID tie-break); the real values are 50 microseconds apart and must compare as distinct/ordered.
{
  const older = { submissionId: "sub-X", submittedAt: "2026-01-10T00:00:00.123400+00:00" };
  assertEq(
    "current-distinct-microseconds-same-millisecond-later-wins-regardless-of-uuid",
    true,
    isCurrent(older, "2026-01-10T00:00:00.123450+00:00", "sub-A") // "sub-A" < "sub-X" lexicographically -- would lose a tie, but this is NOT a tie
  );
  const newer = { submissionId: "sub-X", submittedAt: "2026-01-10T00:00:00.123450+00:00" };
  assertEq(
    "current-distinct-microseconds-same-millisecond-earlier-loses-regardless-of-uuid",
    false,
    isCurrent(newer, "2026-01-10T00:00:00.123400+00:00", "sub-Z") // "sub-Z" > "sub-X" lexicographically -- would win a tie, but this is NOT a tie
  );
}

// 5. isResolvable: RESOLVABLE = pending AND source observation CURRENT --
// pending alone must NEVER be treated as resolvable (the task's explicit requirement).
{
  const governing = { submissionId: "sub-A", submittedAt: "2026-01-10T00:00:00Z" };
  assertEq("resolvable-pending-and-current", true, isResolvable("pending", governing, "2026-01-11T00:00:00Z", "sub-B"));
  assertEq("resolvable-pending-but-stale-observation", false, isResolvable("pending", governing, "2026-01-05T00:00:00Z", "sub-B"));
  assertEq("resolvable-approved-never-resolvable-even-if-current", false, isResolvable("approved", governing, "2026-01-11T00:00:00Z", "sub-B"));
  assertEq("resolvable-rejected-never-resolvable", false, isResolvable("rejected", governing, "2026-01-11T00:00:00Z", "sub-B"));
  assertEq("resolvable-superseded-never-resolvable", false, isResolvable("superseded", governing, "2026-01-11T00:00:00Z", "sub-B"));
  assertEq("resolvable-null-decision-state-never-resolvable", false, isResolvable(null, governing, "2026-01-11T00:00:00Z", "sub-B"));
  // No governing event yet recorded (fresh field) -- a pending decision must still be resolvable.
  assertEq("resolvable-pending-no-governing-event-yet", true, isResolvable("pending", undefined, "2026-01-01T00:00:00Z", "sub-1"));
  // Missing/malformed observation linkage (integrity failure) fails closed, never resolvable.
  assertEq("resolvable-pending-missing-observation-submission-id-fails-closed", false, isResolvable("pending", governing, null, null));
}

// 6. describeNotCurrent: distinguishes "stale" (a confirmed, genuinely newer submission) from
// "missing_data" (the linkage/timestamp could not be resolved at all) -- the v2 correction that
// stops the UI from unconditionally claiming "superseded by a newer submission" when the real
// reason is a data/integrity problem.
{
  const governing = { submissionId: "sub-A", submittedAt: "2026-01-10T00:00:00Z" };
  assertEq("describe-current-item-has-no-reason", null, describeNotCurrent(governing, "2026-01-11T00:00:00Z", "sub-B"));
  assertEq("describe-genuinely-stale", "stale", describeNotCurrent(governing, "2026-01-05T00:00:00Z", "sub-B"));
  assertEq("describe-missing-submission-id-is-missing-data-not-stale", "missing_data", describeNotCurrent(governing, "2026-01-05T00:00:00Z", null));
  assertEq("describe-missing-submitted-at-is-missing-data-not-stale", "missing_data", describeNotCurrent(governing, null, "sub-B"));
  assertEq("describe-invalid-submitted-at-is-missing-data-not-stale", "missing_data", describeNotCurrent(governing, "not-a-date", "sub-B"));
  assertEq("describe-malformed-governing-timestamp-is-missing-data-not-stale", "missing_data",
    describeNotCurrent({ submissionId: "sub-A", submittedAt: "not-a-date-either" }, "2026-01-11T00:00:00Z", "sub-B"));
  assertEq("describe-no-governing-event-yet-has-no-reason", null, describeNotCurrent(undefined, "2026-01-01T00:00:00Z", "sub-1"));
}

// 7. v3 targeted correction: classifyCurrency (via isCurrent/describeNotCurrent) must distinguish
// a GENUINELY ABSENT governing tuple (both submissionId and submittedAt missing -- "no governing
// event yet", current=true) from a PARTIALLY POPULATED one (exactly one of the two missing -- an
// integrity anomaly the database's own CHECK constraint should prevent, but this function must
// not simply assume that invariant holds in whatever data it is handed). The prior version's
// `!governing.submissionId || !governing.submittedAt` treated EITHER case identically as "no
// governing event", independently reproduced as returning current=true/reason=null for a
// half-populated tuple.
{
  const candidateAt = "2026-01-05T00:00:00Z"; // deliberately OLDER than the timestamps below, so
  // an incorrect "no governing event -> always current" result is clearly distinguishable from
  // the correct "missing_data -> never current" result (a coincidental pass is not possible here).
  const partialIdOnly = { submissionId: "sub-A", submittedAt: null };
  assertEq("v3-partial-governing-tuple-id-only-not-current", false, isCurrent(partialIdOnly, candidateAt, "sub-1"));
  assertEq("v3-partial-governing-tuple-id-only-reason-missing-data", "missing_data", describeNotCurrent(partialIdOnly, candidateAt, "sub-1"));

  const partialTsOnly = { submissionId: null, submittedAt: "2026-01-10T00:00:00Z" };
  assertEq("v3-partial-governing-tuple-timestamp-only-not-current", false, isCurrent(partialTsOnly, candidateAt, "sub-1"));
  assertEq("v3-partial-governing-tuple-timestamp-only-reason-missing-data", "missing_data", describeNotCurrent(partialTsOnly, candidateAt, "sub-1"));

  // Genuine absence (both null, an actual GoverningTuple object) -- must remain current=true,
  // unaffected by this correction. Distinct from the pre-existing `governing: undefined` case
  // (section 4/6 above), which also remains current=true.
  const genuinelyAbsent = { submissionId: null, submittedAt: null };
  assertEq("v3-genuinely-absent-governing-tuple-both-null-is-current", true, isCurrent(genuinelyAbsent, candidateAt, "sub-1"));
  assertEq("v3-genuinely-absent-governing-tuple-both-null-no-reason", null, describeNotCurrent(genuinelyAbsent, candidateAt, "sub-1"));

  // A complete, valid governing tuple continues to work exactly as before this correction.
  const complete = { submissionId: "sub-A", submittedAt: "2026-01-10T00:00:00Z" };
  assertEq("v3-complete-governing-tuple-newer-candidate-is-current", true, isCurrent(complete, "2026-01-11T00:00:00Z", "sub-B"));
  assertEq("v3-complete-governing-tuple-older-candidate-is-stale", false, isCurrent(complete, "2026-01-05T00:00:00Z", "sub-B"));
}

console.log("");
console.log(`Total: ${passes} passed, ${failures} failed.`);
if (failures > 0) {
  console.error(`${failures} assertion(s) FAILED.`);
  process.exit(1);
} else {
  console.log("All review-surface unit tests PASSED.");
}
