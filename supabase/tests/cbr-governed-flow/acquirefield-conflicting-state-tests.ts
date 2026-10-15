// acquireField CONFLICTING-State fix (Owner-approved Exact Design, Option
// A). Non-database, non-network, non-LLM unit tests against the REAL
// production exports of src/lib/intake/structured-profile.ts (imported by
// path, not reimplemented) -- mirrors a1/a2/b1's own convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/acquirefield-conflicting-state-tests.ts
//
// Scope: acquireField's conflicting-status guard only. Does NOT assert
// anything about Coach routes, A0 routes, CBR, UI, or database/migration
// behavior -- those remain explicitly out of this fix's boundary.

import { acquireField, confirmField, emptyField, type StructuredProfileField } from "../../../src/lib/intake/structured-profile";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); }
  else { failures++; console.error(`FAIL  ${label}`); }
}

// Test-only construction helper -- builds a field at a given status without
// reimplementing acquireField/confirmField's own transition logic.
function fieldAt(overrides: Partial<StructuredProfileField>): StructuredProfileField {
  return { ...emptyField(), ...overrides };
}

// ── T01 — first acquisition ─────────────────────────────────────────────
{
  const result = acquireField(emptyField(), { value: "A", source: "cv_extraction", confidence: "high" });
  check("T01 status becomes acquired_unconfirmed", result.status === "acquired_unconfirmed");
  check("T01 incoming value adopted", result.value === "A");
  check("T01 incoming source adopted", result.source === "cv_extraction");
  check("T01 incoming confidence adopted", result.confidence === "high");
}

// ── T02 — same-value unconfirmed reacquisition ──────────────────────────
{
  const current = fieldAt({ value: "A", source: "cv_extraction", confidence: "high", status: "acquired_unconfirmed" });
  const result = acquireField(current, { value: "A", source: "coach_discovery", confidence: "medium" });
  check("T02 status remains acquired_unconfirmed", result.status === "acquired_unconfirmed");
  check("T02 value remains semantically the same", result.value === "A");
}

// ── T03 — different-value unconfirmed acquisition → conflicting ────────
{
  const current = fieldAt({ value: "A", source: "cv_extraction", confidence: "high", status: "acquired_unconfirmed" });
  const result = acquireField(current, { value: "B", source: "coach_discovery", confidence: "high" });
  check("T03 status becomes conflicting", result.status === "conflicting");
  check("T03 retained value is A", result.value === "A");
  check("T03 retained source is current's (cv_extraction)", result.source === "cv_extraction");
  check("T03 retained confidence is current's (high)", result.confidence === "high");
}

// ── T04 — confirmed + same value → unchanged ────────────────────────────
{
  const current = fieldAt({ value: "A", source: "beneficiary_confirmed", confidence: "high", status: "beneficiary_confirmed", confirmed_by: "ben-1" });
  const result = acquireField(current, { value: "A", source: "cv_extraction", confidence: "low" });
  check("T04 status remains beneficiary_confirmed", result.status === "beneficiary_confirmed");
  check("T04 object identity preserved (return current)", result === current);
}

// ── T05 — confirmed + different value → conflicting, confirmed value retained ──
{
  const current = fieldAt({ value: "A", source: "beneficiary_confirmed", confidence: "high", status: "beneficiary_confirmed", confirmed_by: "ben-1", confirmed_at: "t1", confirmed_from_source: "cv_extraction" });
  const result = acquireField(current, { value: "B", source: "coach_discovery", confidence: "high" });
  check("T05 status becomes conflicting", result.status === "conflicting");
  check("T05 value A retained", result.value === "A");
  check("T05 confirmed provenance preserved (confirmed_by)", result.confirmed_by === "ben-1");
  check("T05 confirmed provenance preserved (confirmed_from_source)", result.confirmed_from_source === "cv_extraction");
}

// ── T06 — conflicting + retained value via ordinary acquisition ────────
{
  const current = fieldAt({ value: "A", source: "cv_extraction", confidence: "high", status: "conflicting", confirmed_by: null, confirmed_at: null, confirmed_from_source: null });
  const result = acquireField(current, { value: "A", source: "coach_discovery", confidence: "medium" });
  check("T06 status remains conflicting", result.status === "conflicting");
  check("T06 value unchanged", result.value === "A");
  check("T06 source unchanged", result.source === "cv_extraction");
  check("T06 confidence unchanged", result.confidence === "high");
  check("T06 confirmed_by unchanged", result.confirmed_by === null);
  check("T06 confirmed_at unchanged", result.confirmed_at === null);
  check("T06 confirmed_from_source unchanged", result.confirmed_from_source === null);
  check("T06 object identity preserved (return current)", result === current);
}

// ── T07 — conflicting + original competing value via ordinary acquisition ──
{
  const current = fieldAt({ value: "A", source: "cv_extraction", confidence: "high", status: "conflicting" });
  const result = acquireField(current, { value: "B", source: "coach_discovery", confidence: "high" });
  check("T07 status remains conflicting", result.status === "conflicting");
  check("T07 value remains A, never flips to the competing value B", result.value === "A");
  check("T07 source unchanged", result.source === "cv_extraction");
  check("T07 confidence unchanged", result.confidence === "high");
  check("T07 object identity preserved (return current)", result === current);
}

// ── T08 — conflicting + third value via ordinary acquisition (critical regression) ──
{
  const current = fieldAt({ value: "A", source: "cv_extraction", confidence: "high", status: "conflicting" });
  const result = acquireField(current, { value: "C", source: "coach_discovery", confidence: "high" });
  check("T08 status remains conflicting", result.status === "conflicting");
  check("T08 value remains A, never silently adopts the third value C", result.value === "A");
  check("T08 source unchanged", result.source === "cv_extraction");
  check("T08 confidence unchanged", result.confidence === "high");
  check("T08 object identity preserved (return current)", result === current);
}

// ── T09 — conflicting + explicit affirmation (confirmField, no correction) ──
{
  const current = fieldAt({ value: "A", source: "cv_extraction", confidence: "high", status: "conflicting" });
  const result = confirmField(current, "beneficiary-1");
  check("T09 status becomes beneficiary_confirmed", result.status === "beneficiary_confirmed");
  check("T09 retained value preserved", result.value === "A");
  check("T09 confirmed_by populated", result.confirmed_by === "beneficiary-1");
  check("T09 confirmed_from_source reflects the retained value's real source", result.confirmed_from_source === "cv_extraction");
}

// ── T10 — conflicting + explicit correction (confirmField, with correctedValue) ──
{
  const current = fieldAt({ value: "A", source: "cv_extraction", confidence: "high", status: "conflicting" });
  const result = confirmField(current, "beneficiary-1", "B");
  check("T10 status becomes beneficiary_confirmed", result.status === "beneficiary_confirmed");
  check("T10 value is the correction", result.value === "B");
  check("T10 confirmed_from_source is beneficiary_provided", result.confirmed_from_source === "beneficiary_provided");
}

// ── T11 — criterion narrative conflict: ordinary acquisition cannot resolve ──
{
  // Representative criterion-narrative field state (e.g. "awards") -- this
  // is a pure state-machine test; acquireField has no field-name awareness,
  // so any field key exercises the identical code path.
  const current = fieldAt({ value: "2024 Cloud Leadership Excellence Award", source: "cv_extraction", confidence: "high", status: "conflicting" });
  const result = acquireField(current, { value: "Some other award mention", source: "coach_discovery", confidence: "medium" });
  check("T11 criterion-narrative conflict is preserved", result.status === "conflicting");
  check("T11 retained value remains", result.value === "2024 Cloud Leadership Excellence Award");
  check("T11 ordinary acquisition cannot resolve a narrative conflict", result === current);
}

// ── T12 — criterion narrative manual resolution remains available ──────
{
  const current = fieldAt({ value: "2024 Cloud Leadership Excellence Award", source: "cv_extraction", confidence: "high", status: "conflicting" });
  const result = confirmField(current, "beneficiary-1");
  check("T12 criterion narrative resolves to beneficiary_confirmed via manual confirmation", result.status === "beneficiary_confirmed");
}

// ── T13 — Valentina email control: ordinary Coach cannot resolve ───────
{
  // Step 1: not_yet_acquired -> staff_entered acquisition
  const step1 = acquireField(emptyField(), { value: "valentina.rojas.auscis.test@gmail.com", source: "staff_entered", confidence: "high" });
  check("T13 step1 status is acquired_unconfirmed", step1.status === "acquired_unconfirmed");

  // Step 2: cv_extraction acquisition of a different value -> conflicting
  const step2 = acquireField(step1, { value: "eb3actionusa@gmail.com", source: "cv_extraction", confidence: "high" });
  check("T13 step2 status is conflicting", step2.status === "conflicting");
  check("T13 step2 retained value is the invitation email", step2.value === "valentina.rojas.auscis.test@gmail.com");

  // Step 3: ordinary coach_discovery acquisition of the SAME retained value -- must NOT resolve
  const step3 = acquireField(step2, { value: "valentina.rojas.auscis.test@gmail.com", source: "coach_discovery", confidence: "high" });
  check("T13 step3 STILL conflicting after this fix", step3.status === "conflicting");
  check("T13 step3 retained value remains the invitation email", step3.value === "valentina.rojas.auscis.test@gmail.com");
  check("T13 step3 retained source remains staff_entered (never silently resolved)", step3.source === "staff_entered");
}

// ── T14 — Valentina email control: explicit confirmation still resolves ──
{
  const step1 = acquireField(emptyField(), { value: "valentina.rojas.auscis.test@gmail.com", source: "staff_entered", confidence: "high" });
  const conflicted = acquireField(step1, { value: "eb3actionusa@gmail.com", source: "cv_extraction", confidence: "high" });
  const result = confirmField(conflicted, "beneficiary-1");
  check("T14 status becomes beneficiary_confirmed", result.status === "beneficiary_confirmed");
  check("T14 value is the retained invitation email", result.value === "valentina.rojas.auscis.test@gmail.com");
  check("T14 confirmed_from_source reflects the retained staff-entered source", result.confirmed_from_source === "staff_entered");
}

console.log(failures === 0 ? `\nALL ACQUIREFIELD-CONFLICTING-STATE CHECKS PASS` : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
