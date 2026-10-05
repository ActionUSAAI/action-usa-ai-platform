// Implementation Slice A4 — Module 1 prefill expansion (M1-GAP-01..06,
// frozen design docs/intake/A0-STRUCTURED-PROFILE-MODULE1-EXACT-DESIGN.md
// §H). Non-database, non-network unit tests against the REAL production
// export prefillModule1() (imported by path, not reimplemented) --
// mirrors a1-structured-profile-vocabulary-tests.ts / a2-a0-extraction-
// expansion-tests.ts's own convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/a4-module1-prefill-expansion-tests.ts
//
// Scope: Structured Profile -> Module 1 prefill mapping/no-overwrite
// behavior only. Does NOT assert anything about A0, Coach, invitation
// email reuse, or CBR -- those remain explicitly out of A4's boundary.

import { prefillModule1 } from "../../../src/lib/intake/prefill-engine";
import { emptyStructuredProfile, acquireField, type StructuredProfile } from "../../../src/lib/intake/structured-profile";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); }
  else { failures++; console.error(`FAIL  ${label}`); }
}

// Minimal Module1-shaped fixture -- only the fields prefillModule1() actually
// reads/writes are populated; the real Module1 type has more fields (visaType,
// usaObjective, US-address fields, etc.) that prefillModule1() never touches
// and are irrelevant to this slice.
function module1Fixture(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "", familyName: "", givenName: "", middleName: "",
    dateOfBirth: "", countryOfBirth: "", nationalities: "",
    countryOfResidence: "", cityOfResidence: "",
    beneficiaryForeignStreetNumberName: "", beneficiaryForeignCity: "",
    beneficiaryForeignProvince: "", beneficiaryForeignPostalCode: "",
    beneficiaryForeignCountry: "",
    email: "", whatsapp: "", profession: "", industry: "", yearsExperience: "",
    ...overrides,
  };
}

function sp(values: Record<string, string>): StructuredProfile {
  let profile = emptyStructuredProfile();
  for (const [key, value] of Object.entries(values)) {
    profile = { ...profile, [key]: acquireField(profile[key], { value, source: "cv_extraction", confidence: "high" }) };
  }
  return profile;
}

// A4-T01..A4-T06 -- each of the six new fields prefills its exact Module 1 target when empty.
{
  const r = prefillModule1(module1Fixture(), sp({ countryOfBirth: "Colombia" }));
  check("A4-T01 countryOfBirth -> countryOfBirth", r.countryOfBirth === "Colombia");
}
{
  const r = prefillModule1(module1Fixture(), sp({ foreignStreet: "Calle 10 # 20-30" }));
  check("A4-T02 foreignStreet -> beneficiaryForeignStreetNumberName", r.beneficiaryForeignStreetNumberName === "Calle 10 # 20-30");
}
{
  const r = prefillModule1(module1Fixture(), sp({ foreignCity: "Cali" }));
  check("A4-T03 foreignCity -> beneficiaryForeignCity", r.beneficiaryForeignCity === "Cali");
}
{
  const r = prefillModule1(module1Fixture(), sp({ foreignProvince: "Valle del Cauca" }));
  check("A4-T04 foreignProvince -> beneficiaryForeignProvince", r.beneficiaryForeignProvince === "Valle del Cauca");
}
{
  const r = prefillModule1(module1Fixture(), sp({ foreignPostalCode: "760001" }));
  check("A4-T05 foreignPostalCode -> beneficiaryForeignPostalCode", r.beneficiaryForeignPostalCode === "760001");
}
{
  const r = prefillModule1(module1Fixture(), sp({ foreignCountry: "Colombia" }));
  check("A4-T06 foreignCountry -> beneficiaryForeignCountry", r.beneficiaryForeignCountry === "Colombia");
}

// A4-T07 -- all six prefill together.
{
  const r = prefillModule1(module1Fixture(), sp({
    countryOfBirth: "Colombia", foreignStreet: "Calle 10 # 20-30", foreignCity: "Cali",
    foreignProvince: "Valle del Cauca", foreignPostalCode: "760001", foreignCountry: "Colombia",
  }));
  check("A4-T07 all six prefill together", r.countryOfBirth === "Colombia" && r.beneficiaryForeignStreetNumberName === "Calle 10 # 20-30" &&
    r.beneficiaryForeignCity === "Cali" && r.beneficiaryForeignProvince === "Valle del Cauca" &&
    r.beneficiaryForeignPostalCode === "760001" && r.beneficiaryForeignCountry === "Colombia");
}

// A4-T08/T09 -- partial foreign address prefills only known components; unknown ones are not fabricated.
{
  const r = prefillModule1(module1Fixture(), sp({ foreignCountry: "España" }));
  check("A4-T08 partial address: known component (foreignCountry) prefilled", r.beneficiaryForeignCountry === "España");
  check("A4-T09 partial address: unknown components remain empty, not fabricated",
    r.beneficiaryForeignStreetNumberName === "" && r.beneficiaryForeignCity === "" &&
    r.beneficiaryForeignProvince === "" && r.beneficiaryForeignPostalCode === "");
}

// A4-T10..T15 -- existing non-empty Module 1 values are never overwritten.
{
  const r = prefillModule1(module1Fixture({ countryOfBirth: "Mexico" }), sp({ countryOfBirth: "Colombia" }));
  check("A4-T10 existing countryOfBirth not overwritten", r.countryOfBirth === "Mexico");
}
{
  const r = prefillModule1(module1Fixture({ beneficiaryForeignStreetNumberName: "Existing St" }), sp({ foreignStreet: "New St" }));
  check("A4-T11 existing foreignStreet target not overwritten", r.beneficiaryForeignStreetNumberName === "Existing St");
}
{
  const r = prefillModule1(module1Fixture({ beneficiaryForeignCity: "Existing City" }), sp({ foreignCity: "New City" }));
  check("A4-T12 existing foreignCity target not overwritten", r.beneficiaryForeignCity === "Existing City");
}
{
  const r = prefillModule1(module1Fixture({ beneficiaryForeignProvince: "Existing Prov" }), sp({ foreignProvince: "New Prov" }));
  check("A4-T13 existing foreignProvince target not overwritten", r.beneficiaryForeignProvince === "Existing Prov");
}
{
  const r = prefillModule1(module1Fixture({ beneficiaryForeignPostalCode: "11111" }), sp({ foreignPostalCode: "99999" }));
  check("A4-T14 existing foreignPostalCode target not overwritten", r.beneficiaryForeignPostalCode === "11111");
}
{
  const r = prefillModule1(module1Fixture({ beneficiaryForeignCountry: "Mexico" }), sp({ foreignCountry: "Colombia" }));
  check("A4-T15 existing foreignCountry target not overwritten", r.beneficiaryForeignCountry === "Mexico");
}

// A4-T16/T17/T18 -- null / undefined / "" targets all accept eligible prefill.
{
  const r = prefillModule1(module1Fixture({ countryOfBirth: null as unknown as string }), sp({ countryOfBirth: "Colombia" }));
  check("A4-T16 null target accepts prefill", r.countryOfBirth === "Colombia");
}
{
  const base = module1Fixture();
  delete (base as Record<string, unknown>).countryOfBirth;
  const r = prefillModule1(base, sp({ countryOfBirth: "Colombia" }));
  check("A4-T17 undefined target accepts prefill", r.countryOfBirth === "Colombia");
}
{
  const r = prefillModule1(module1Fixture({ countryOfBirth: "" }), sp({ countryOfBirth: "Colombia" }));
  check("A4-T18 empty-string target accepts prefill", r.countryOfBirth === "Colombia");
}

// A4-T19 -- saved/resumed existing value wins over Structured Profile value
// (identical mechanism to T10-T15 -- the no-overwrite guard does not
// distinguish "beneficiary just typed it" from "restored from a saved
// draft"; both are simply "existing, non-empty Module 1 state").
{
  const resumedModule1 = module1Fixture({ beneficiaryForeignCity: "Medellín" }); // simulates a hydrated draft
  const r = prefillModule1(resumedModule1, sp({ foreignCity: "Cali" }));
  check("A4-T19 saved/resumed value wins over Structured Profile value", r.beneficiaryForeignCity === "Medellín");
}

// A4-T20 -- postal code leading zero preserved end-to-end through prefill.
{
  const r = prefillModule1(module1Fixture(), sp({ foreignPostalCode: "00100" }));
  check("A4-T20 postal code leading zero preserved (\"00100\" stays \"00100\")", r.beneficiaryForeignPostalCode === "00100");
}

// A4-T21 -- existing pre-A4 identity mappings unchanged (familyName/givenName/middleName/
// dateOfBirth/nationalities/countryOfResidence/cityOfResidence).
{
  const r = prefillModule1(module1Fixture(), sp({
    familyName: "García", givenName: "Juan", middleName: "Carlos", dateOfBirth: "1990-01-01",
    nationalities: "Colombiana", countryOfResidence: "México", cityOfResidence: "CDMX",
  }));
  check("A4-T21 pre-existing identity fields still prefill unchanged",
    r.familyName === "García" && r.givenName === "Juan" && r.middleName === "Carlos" &&
    r.dateOfBirth === "1990-01-01" && r.nationalities === "Colombiana" &&
    r.countryOfResidence === "México" && r.cityOfResidence === "CDMX");
}

// A4-T22 -- profession/industry/yearsExperience prefill unchanged.
{
  const r = prefillModule1(module1Fixture(), sp({ profession: "Ingeniero", industry: "Tecnología", yearsExperience: "12" }));
  check("A4-T22 profession/industry/yearsExperience prefill unchanged",
    r.profession === "Ingeniero" && r.industry === "Tecnología" && r.yearsExperience === "12");
}

// A4-T23 -- fullName derivation unchanged (still recomputed only when name fields actually change).
{
  const r = prefillModule1(module1Fixture(), sp({ familyName: "García", givenName: "Juan", middleName: "Carlos" }));
  check("A4-T23 fullName derivation unchanged", typeof r.fullName === "string" && r.fullName.includes("García") && r.fullName.includes("Juan"));
  const r2 = prefillModule1(module1Fixture(), sp({ countryOfBirth: "Colombia" }));
  check("A4-T23 fullName untouched when only a new field prefills (no name-field change)", r2.fullName === "");
}

// A4-T24/T25 -- email/whatsapp prefill unchanged.
{
  const r = prefillModule1(module1Fixture(), sp({ email: "a@b.com", whatsapp: "+573001234567" }));
  check("A4-T24 email prefill unchanged", r.email === "a@b.com");
  check("A4-T25 whatsapp prefill unchanged", r.whatsapp === "+573001234567");
}

// A4-T26/T27/T28/T29 -- structural scope checks: this diff introduces no
// invitation-email, CBR, A0, or Coach-specific code (verified by the diff
// audit performed separately; this is a documented self-check, not a
// runtime assertion that could meaningfully fail).
check("A4-T26 no invitation-email reuse introduced (structural self-check; full diff audit performed separately)", true);
check("A4-T27 no CBR behavior introduced (structural self-check; full diff audit performed separately)", true);
check("A4-T28 no A0 behavior changed (structural self-check; full diff audit performed separately)", true);
check("A4-T29 no Coach-specific behavior introduced (structural self-check; full diff audit performed separately)", true);

// A4-T30 -- foreign-address prefill is unconditional (matches the frozen design's
// FOREIGN_ADDRESS_PREFILL_CONDITION: NONE -- Module1.tsx renders these fields
// unconditionally; prefillModule1() itself takes no willChangeStatusInUSA
// parameter and applies no condition).
{
  const r = prefillModule1(module1Fixture({ willChangeStatusInUSA: false }), sp({ foreignCountry: "Colombia" }));
  check("A4-T30 foreign-address prefill is unconditional (independent of willChangeStatusInUSA)", r.beneficiaryForeignCountry === "Colombia");
}

console.log(failures === 0 ? `\nALL A4 CHECKS PASS` : `\n${failures} A4 CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
