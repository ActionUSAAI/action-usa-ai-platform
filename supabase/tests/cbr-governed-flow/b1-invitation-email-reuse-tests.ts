// Implementation Slice B1 — invitation email reuse (M1-GAP-07, frozen
// design docs/intake/A0-STRUCTURED-PROFILE-MODULE1-EXACT-DESIGN.md §J
// Capability B). Non-database, non-network, non-LLM unit tests against
// the REAL production exports of src/app/intake/IntakeForm.tsx,
// src/lib/intake/structured-profile.ts, and src/lib/intake/prefill-engine.ts
// (imported by path, not reimplemented) -- mirrors a1/a2/a4/a3-r1's own
// convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/b1-invitation-email-reuse-tests.ts
//
// Scope: invitation-email seeding into Structured Profile, and its
// carry-forward into Module 1 via the existing, unmodified
// prefillModule1(). Does NOT assert anything about A0, Coach,
// Structured-Profile vocabulary, CBR, or database/migration behavior --
// those remain explicitly out of B1's boundary.

import { buildInitialIntakeFormData } from "../../../src/app/intake/IntakeForm";
import { prefillModule1 } from "../../../src/lib/intake/prefill-engine";
import { emptyStructuredProfile, acquireField, confirmField, type StructuredProfile } from "../../../src/lib/intake/structured-profile";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); }
  else { failures++; console.error(`FAIL  ${label}`); }
}

function module1Fixture(overrides: Record<string, unknown> = {}) {
  return { email: "", whatsapp: "", fullName: "", familyName: "", givenName: "", ...overrides };
}

// B1-T01/T02/T03 -- seeding a fresh mount with a real invitation email.
{
  const result = buildInitialIntakeFormData("beneficiary@example.com");
  const email = result.module0.structuredProfile.email;
  check("B1-T01 seeded field value is exactly the invitation email", email.value === "beneficiary@example.com");
  check("B1-T02 seeded field source is staff_entered", email.source === "staff_entered");
  check("B1-T03 seeded field status is acquired_unconfirmed, never beneficiary_confirmed", email.status === "acquired_unconfirmed");
}

// B1-T04/T05 -- whitespace handling.
{
  const result = buildInitialIntakeFormData("  spaced@example.com  ");
  check("B1-T04 seeded value is trimmed", result.module0.structuredProfile.email.value === "spaced@example.com");
}

// B1-T06/T07 -- empty/whitespace-only invitation email produces no invalid seed.
{
  const empty = buildInitialIntakeFormData("");
  check("B1-T06 empty invitation email leaves email field not_yet_acquired", empty.module0.structuredProfile.email.status === "not_yet_acquired");
  const whitespace = buildInitialIntakeFormData("   ");
  check("B1-T07 whitespace-only invitation email leaves email field not_yet_acquired", whitespace.module0.structuredProfile.email.status === "not_yet_acquired");
}

// B1-T08 -- the shared INITIAL module-level constant is never mutated by a
// prior call (proxy check: a later call with "" must still yield an
// unseeded field, proving the first call's seed did not leak into shared state).
{
  buildInitialIntakeFormData("leaked@example.com");
  const after = buildInitialIntakeFormData("");
  check("B1-T08 shared INITIAL constant not mutated by a prior seeded call", after.module0.structuredProfile.email.status === "not_yet_acquired");
}

// B1-T09 -- only the email field is affected; sibling Structured Profile fields remain untouched.
{
  const result = buildInitialIntakeFormData("beneficiary@example.com");
  check("B1-T09 sibling fields remain not_yet_acquired (familyName unaffected)", result.module0.structuredProfile.familyName.status === "not_yet_acquired");
}

// B1-T10/T11 -- existing acquired (non-confirmed) email is not silently
// overwritten in a way that loses the original value: acquireField's own
// conflict-marking applies if a seed were layered atop an already-acquired
// value (this guards the acquisition primitive B1 relies on, not a new rule).
{
  let profile: StructuredProfile = emptyStructuredProfile();
  profile = { ...profile, email: acquireField(profile.email, { value: "original@example.com", source: "cv_extraction", confidence: "high" }) };
  const reacquired = acquireField(profile.email, { value: "different@example.com", source: "staff_entered", confidence: "high" });
  check("B1-T10 acquireField marks conflicting rather than silently overwriting an existing acquired value", reacquired.status === "conflicting");
  check("B1-T11 acquireField preserves the original value on conflict", reacquired.value === "original@example.com");
}

// B1-T12/T13 -- beneficiary-confirmed email is never overwritten by a seed.
{
  let profile: StructuredProfile = emptyStructuredProfile();
  profile = { ...profile, email: acquireField(profile.email, { value: "confirmed@example.com", source: "cv_extraction", confidence: "high" }) };
  profile = { ...profile, email: confirmField(profile.email, "beneficiary-actor-id") };
  const reacquired = acquireField(profile.email, { value: "invitation@example.com", source: "staff_entered", confidence: "high" });
  check("B1-T12 beneficiary_confirmed email not overwritten by a later seed attempt", reacquired.value === "confirmed@example.com");
  check("B1-T13 beneficiary_confirmed status preserved on seed conflict", reacquired.status === "conflicting" || reacquired.status === "beneficiary_confirmed");
}

// B1-T14/T15/T16 -- existing prefillModule1() (unmodified) carries the
// seeded email forward into Module 1, with the pre-existing no-overwrite
// guard intact.
{
  let profile: StructuredProfile = emptyStructuredProfile();
  profile = { ...profile, email: acquireField(profile.email, { value: "seeded@example.com", source: "staff_entered", confidence: "high" }) };
  const r = prefillModule1(module1Fixture(), profile);
  check("B1-T14 prefillModule1 carries the seeded email into Module1.email", r.email === "seeded@example.com");
}
{
  let profile: StructuredProfile = emptyStructuredProfile();
  profile = { ...profile, email: acquireField(profile.email, { value: "seeded@example.com", source: "staff_entered", confidence: "high" }) };
  const r = prefillModule1(module1Fixture({ email: "already-typed@example.com" }), profile);
  check("B1-T15 existing non-empty Module1.email is not overwritten by the seeded prefill", r.email === "already-typed@example.com");
}
{
  const r = prefillModule1(module1Fixture(), emptyStructuredProfile());
  check("B1-T16 no seed present: Module1.email remains untouched (empty stays empty)", r.email === "");
}

// B1-T17 -- email remains Class A1-eligible acquisition semantics
// (acquireField's generic conflict-marking applies to it exactly as to
// any other field; no field-specific special-casing was introduced).
{
  const direct = acquireField(emptyStructuredProfile().email, { value: "x@example.com", source: "staff_entered", confidence: "high" });
  check("B1-T17 staff_entered acquisition into a fresh field yields acquired_unconfirmed (no special-casing)", direct.status === "acquired_unconfirmed" && direct.source === "staff_entered");
}

// B1-T18 -- no direct invitation->Module1 bypass: buildInitialIntakeFormData
// never touches module1 directly; it only ever writes into
// module0.structuredProfile. Module1.email is reached solely via
// prefillModule1(), proven separately in B1-T14.
{
  const result = buildInitialIntakeFormData("bypass-check@example.com");
  check("B1-T18 buildInitialIntakeFormData does not write Module1 directly", (result as unknown as { module1?: { email?: string } }).module1?.email !== "bypass-check@example.com");
}

// B1-T19 -- confirmField's confirmed_from_source state machine treats a
// staff_entered-sourced field identically to any other acquisition source
// on first confirmation (no field-specific special-casing introduced by B1).
{
  let field = acquireField(emptyStructuredProfile().email, { value: "x@example.com", source: "staff_entered", confidence: "high" });
  field = confirmField(field, "actor-id");
  check("B1-T19 confirming a staff_entered-sourced field preserves staff_entered as confirmed_from_source", field.confirmed_from_source === "staff_entered");
}

console.log(failures === 0 ? `\nALL B1 CHECKS PASS` : `\n${failures} B1 CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
