// Implementation Slice A2 — A0 extraction expansion (M1-GAP-01..06,
// frozen design docs/intake/A0-STRUCTURED-PROFILE-MODULE1-EXACT-DESIGN.md
// §F). Non-database, non-network unit tests against the REAL production
// exports of src/lib/intake/a0-extract.ts and src/lib/intake/
// structured-profile.ts (imported by path, not reimplemented) -- mirrors
// provenance-unit-tests.ts / a1-structured-profile-vocabulary-tests.ts's
// own convention. The one live network dependency inside extractCvFields()
// (the Claude API fetch call) is replaced with a canned, deterministic
// global.fetch stub for the duration of this file only -- the REAL
// parser/whitelist code in extractCvFields() still runs unmodified; only
// the network boundary is stubbed, exactly as the repo's own test
// architecture permits for deterministic proof of parser correctness.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/a2-a0-extraction-expansion-tests.ts
//
// Scope: A0 extraction/parser/whitelist/acquisition-path behavior only.
// Does NOT assert anything about Module 1 prefill (Slice A4), invitation
// email reuse (B1), Coach, or CBR -- those remain explicitly out of A2's
// boundary.

import { A0_FIELD_LIST, extractCvFields } from "../../../src/lib/intake/a0-extract";
import { acquireField, emptyField, confirmField } from "../../../src/lib/intake/structured-profile";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); }
  else { failures++; console.error(`FAIL  ${label}`); }
}

const NEW_FIELDS = [
  "countryOfBirth", "foreignStreet", "foreignCity",
  "foreignProvince", "foreignPostalCode", "foreignCountry",
] as const;

// A2-T01..A2-T06 -- A0_FIELD_LIST accepts each of the six new fields.
for (const f of NEW_FIELDS) {
  check(`A2-T0x A0_FIELD_LIST accepts ${f}`, (A0_FIELD_LIST as readonly string[]).includes(f));
}
check("A2 no seventh field was added (A0_FIELD_LIST.length === 27)", A0_FIELD_LIST.length === 27);

// ── Canned fetch stub: replaces only the network boundary. extractCvFields()'s
// own parser/whitelist/trim/confidence logic runs for real against this fixed response. ──
type FetchArgs = Parameters<typeof fetch>;
function stubFetch(responseFieldsJson: string) {
  (globalThis as unknown as { fetch: (...a: FetchArgs) => Promise<Response> }).fetch =
    async () => new Response(JSON.stringify({ content: [{ text: responseFieldsJson }] }), { status: 200 });
}
const realFetch = globalThis.fetch;

async function run() {
  // A2-T07 -- a source-supported countryOfBirth reaches the real parser/acquisition output.
  stubFetch(JSON.stringify({ fields: { countryOfBirth: { value: "Colombia", confidence: "high" } } }));
  const r1 = await extractCvFields("ZmFrZQ==", "application/pdf", "fake-key");
  check("A2-T07 countryOfBirth extracted when source-supported", r1.countryOfBirth?.value === "Colombia" && r1.countryOfBirth?.confidence === "high");

  // A2-T08 -- a complete, source-supported foreign address reaches the real parser output.
  stubFetch(JSON.stringify({ fields: {
    foreignStreet: { value: "Calle 10 # 20-30", confidence: "high" },
    foreignCity: { value: "Cali", confidence: "high" },
    foreignProvince: { value: "Valle del Cauca", confidence: "medium" },
    foreignPostalCode: { value: "760001", confidence: "high" },
    foreignCountry: { value: "Colombia", confidence: "high" },
  } }));
  const r2 = await extractCvFields("ZmFrZQ==", "application/pdf", "fake-key");
  check("A2-T08 complete foreign address extracted when source-supported",
    r2.foreignStreet?.value === "Calle 10 # 20-30" && r2.foreignCity?.value === "Cali" &&
    r2.foreignProvince?.value === "Valle del Cauca" && r2.foreignPostalCode?.value === "760001" &&
    r2.foreignCountry?.value === "Colombia");

  // A2-T09 -- a partial foreign address (only foreignCountry stated) is accepted without
  // the parser inventing the missing components.
  stubFetch(JSON.stringify({ fields: { foreignCountry: { value: "España", confidence: "high" } } }));
  const r3 = await extractCvFields("ZmFrZQ==", "application/pdf", "fake-key");
  check("A2-T09 partial foreign address: foreignCountry present", r3.foreignCountry?.value === "España");
  check("A2-T09 partial foreign address: no invented foreignStreet/City/Province/PostalCode",
    r3.foreignStreet === undefined && r3.foreignCity === undefined &&
    r3.foreignProvince === undefined && r3.foreignPostalCode === undefined);

  // A2-T10 -- missing countryOfBirth remains missing (model omits it; parser does not synthesize it).
  stubFetch(JSON.stringify({ fields: { familyName: { value: "Pérez", confidence: "high" } } }));
  const r4 = await extractCvFields("ZmFrZQ==", "application/pdf", "fake-key");
  check("A2-T10 missing countryOfBirth remains absent", r4.countryOfBirth === undefined);

  // A2-T11 -- missing foreign-address components remain missing under the same rule.
  check("A2-T11 missing foreign-address fields remain absent",
    r4.foreignStreet === undefined && r4.foreignCity === undefined && r4.foreignProvince === undefined &&
    r4.foreignPostalCode === undefined && r4.foreignCountry === undefined);

  // A2-T12/T13/T14 -- the parser performs no cross-field inference: supplying only
  // nationalities/countryOfResidence/cityOfResidence never causes countryOfBirth/
  // foreignCountry/foreignCity to appear in the output (there is no derivation logic
  // in extractCvFields() at all -- it is a pure whitelist-filter pass-through).
  stubFetch(JSON.stringify({ fields: {
    nationalities: { value: "Colombiana", confidence: "high" },
    countryOfResidence: { value: "México", confidence: "high" },
    cityOfResidence: { value: "Ciudad de México", confidence: "high" },
  } }));
  const r5 = await extractCvFields("ZmFrZQ==", "application/pdf", "fake-key");
  check("A2-T12 nationality does not auto-create countryOfBirth", r5.countryOfBirth === undefined);
  check("A2-T13 countryOfResidence does not auto-create foreignCountry", r5.foreignCountry === undefined);
  check("A2-T14 cityOfResidence does not auto-create foreignCity", r5.foreignCity === undefined);

  // A2-T15 -- foreignPostalCode preserves leading zeroes (string throughout, never coerced).
  stubFetch(JSON.stringify({ fields: { foreignPostalCode: { value: "08001", confidence: "high" } } }));
  const r6 = await extractCvFields("ZmFrZQ==", "application/pdf", "fake-key");
  check("A2-T15 foreignPostalCode leading zero preserved", r6.foreignPostalCode?.value === "08001");

  // A2-T16 -- unknown model-returned field names remain rejected by the existing whitelist.
  stubFetch(JSON.stringify({ fields: {
    countryOfBirth: { value: "Perú", confidence: "high" },
    beneficiaryForeignStreetNumberName: { value: "should be rejected", confidence: "high" },
    totallyUnknownKey: { value: "should be rejected", confidence: "high" },
  } }));
  const r7 = await extractCvFields("ZmFrZQ==", "application/pdf", "fake-key");
  check("A2-T16 recognized new key accepted", r7.countryOfBirth?.value === "Perú");
  check("A2-T16 Module1-shaped key name rejected (not an acquisition-layer key)", (r7 as Record<string, unknown>).beneficiaryForeignStreetNumberName === undefined);
  check("A2-T16 unknown key rejected", (r7 as Record<string, unknown>).totallyUnknownKey === undefined);

  // A2-T19 -- existing pre-A2 A0 fields continue to parse/acquire correctly (no regression).
  stubFetch(JSON.stringify({ fields: {
    familyName: { value: "García", confidence: "high" },
    email: { value: "a@b.com", confidence: "medium" },
    awards: { value: "Premio nacional de ingeniería 2019.", confidence: "low" },
  } }));
  const r8 = await extractCvFields("ZmFrZQ==", "application/pdf", "fake-key");
  check("A2-T19 pre-existing identity field (familyName) still extracted", r8.familyName?.value === "García");
  check("A2-T19 pre-existing contact field (email) still extracted", r8.email?.value === "a@b.com" && r8.email?.confidence === "medium");
  check("A2-T19 pre-existing narrative field (awards) still extracted", r8.awards?.value === "Premio nacional de ingeniería 2019.");

  globalThis.fetch = realFetch;

  // A2-T17 -- the six new fields flow through the EXISTING A0 acquisition path
  // (acquireField, source: "cv_extraction") exactly like every other A0 field --
  // mirrors Module0.tsx's runA0() call shape exactly (no new helper introduced).
  {
    const acquired = acquireField(emptyField(), { value: "Colombia", source: "cv_extraction", confidence: "high" });
    check("A2-T17 new field (countryOfBirth) uses existing acquireField/cv_extraction path",
      acquired.status === "acquired_unconfirmed" && acquired.source === "cv_extraction" && acquired.value === "Colombia");
  }

  // A2-T18 -- Class A1 confirmed-field protection remains effective through the SAME
  // generic acquireField() "conflicting" branch every other Class A1 field already
  // relies on (A0 itself holds no Class-A1-specific logic -- confirmed by source
  // inspection: a0-extract.ts imports neither CLASS_A1_FIELDS nor any freeze helper).
  {
    const confirmed = confirmField(acquireField(emptyField(), { value: "España", source: "cv_extraction", confidence: "high" }), "beneficiary-123");
    const reacquiredByA0 = acquireField(confirmed, { value: "Francia", source: "cv_extraction", confidence: "medium" });
    check("A2-T18 a confirmed new field is marked conflicting on A0 re-acquisition, not silently overwritten",
      reacquiredByA0.status === "conflicting" && reacquiredByA0.value === "España");
  }

  console.log(failures === 0 ? `\nALL A2 CHECKS PASS` : `\n${failures} A2 CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

run();
