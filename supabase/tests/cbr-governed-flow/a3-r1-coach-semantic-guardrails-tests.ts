// Remediation A3-R1 — Coach Class A1 semantic guardrails (A3-GAP-06,
// A3-GAP-07; frozen design docs/intake/
// A0-STRUCTURED-PROFILE-MODULE1-EXACT-DESIGN.md). Non-database,
// non-network, non-LLM unit tests against the REAL production exports
// of src/lib/intake/coach.ts and src/lib/intake/structured-profile.ts
// (imported by path, not reimplemented) -- mirrors a1/a2/a4's own
// convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/a3-r1-coach-semantic-guardrails-tests.ts
//
// Deterministic claim proven here: THE SYSTEM PROMPT GIVEN TO COACH
// EXPLICITLY CONTAINS THE REQUIRED SEMANTIC RULES. This does NOT and
// cannot prove that a live LLM will always obey them -- no test in
// this file makes that claim.

import { buildSystemPrompt, parseCoachResponse } from "../../../src/lib/intake/coach";
import { A0_FIELD_LIST } from "../../../src/lib/intake/a0-extract";
import { CLASS_A1_FIELDS, acquireCoachFields, emptyStructuredProfile } from "../../../src/lib/intake/structured-profile";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

// buildSystemPrompt(undefined) === raw BASE_SYSTEM_PROMPT (describeProfileContext
// returns "" when profileContext is undefined) -- the real, exported mechanism,
// not a reimplementation.
const prompt = buildSystemPrompt(undefined);

// R1-T01/T02/T03/T04 -- countryOfBirth definition + explicit anti-inference rules.
check("R1-T01 prompt explicitly defines countryOfBirth as country of birth", /countryOfBirth es el país de NACIMIENTO/.test(prompt));
check("R1-T02 prompt prohibits deriving countryOfBirth from nationalities", /NUNCA lo infieras de nationalities/.test(prompt));
check("R1-T03 prompt prohibits deriving countryOfBirth from countryOfResidence", /NUNCA lo infieras de nationalities, countryOfResidence/.test(prompt));
check("R1-T04 prompt prohibits deriving countryOfBirth from cityOfResidence", /cityOfResidence, foreignCountry ni foreignCity/.test(prompt));

// R1-T05/T06/T07 -- residence vs foreign-address distinction.
check("R1-T05 prompt distinguishes current residence from foreign address", /conceptos distintos/.test(prompt) && /dónde vive actualmente/.test(prompt));
check("R1-T06 prompt prohibits automatic cityOfResidence -> foreignCity mapping", /NUNCA establece automáticamente foreignCity\/foreignCountry/.test(prompt));
check("R1-T07 prompt prohibits automatic countryOfResidence -> foreignCountry mapping", /NUNCA establece automáticamente foreignCity\/foreignCountry/.test(prompt));

// R1-T08/T09/T10 -- foreign-address component independence.
check("R1-T08 prompt establishes foreign-address components are independent", /independientes entre sí/.test(prompt));
check("R1-T09 prompt prohibits fabricating missing foreign-address components", /sin derivar ni fabricar un componente a partir de otro/.test(prompt));
check("R1-T10 prompt permits partial foreign-address acquisition (registra solo el\\/los componente\\(s\\))", /registra solo el\/los componente\(s\)/.test(prompt));

// R1-T11/T12 -- foreignPostalCode as text, leading zeros preserved.
check("R1-T11 prompt preserves foreignPostalCode as text", /foreignPostalCode es siempre texto exacto/.test(prompt));
check("R1-T12 prompt requires leading-zero preservation", /preservando cualquier cero inicial/.test(prompt));

// R1-T13 -- ambiguity -> clarify or leave unresolved, not infer.
check("R1-T13 prompt directs ambiguity toward clarification/unresolved state, not inference", /pregunta para aclarar o deja el campo sin resolver -- nunca completes la ambigüedad por inferencia/.test(prompt));

// R1-T14/T15 -- A0_FIELD_LIST interpolation and FACTS output contract unchanged.
check("R1-T14 A0_FIELD_LIST interpolation remains present in the prompt", A0_FIELD_LIST.every(f => prompt.includes(f)));
check("R1-T15 FACTS output contract unchanged", prompt.includes("---REPLY---") && prompt.includes("---FACTS---") && prompt.includes('{"fields":'));

// R1-T16 -- parseCoachResponse() field-legality mechanism unchanged (A0_FIELD_LIST whitelist).
{
  const { fields } = parseCoachResponse('---REPLY---\nok\n---FACTS---\n{"fields": {"countryOfBirth": {"value": "Colombia", "confidence": "high"}, "notAField": {"value": "x", "confidence": "high"}}}');
  check("R1-T16 parseCoachResponse whitelist unchanged (accepts countryOfBirth, rejects unknown key)",
    fields.countryOfBirth?.value === "Colombia" && (fields as Record<string, unknown>).notAField === undefined);
}

// R1-T17 -- acquireCoachFields() unchanged (Class A1 freeze still structural, independent acquisition still works).
{
  const after = acquireCoachFields(emptyStructuredProfile(), { foreignCountry: { value: "España", confidence: "high" } });
  check("R1-T17 acquireCoachFields() unchanged (independent acquisition still works)", after.foreignCountry.value === "España" && after.foreignStreet.status === "not_yet_acquired");
}

// R1-T18 -- CLASS_A1_FIELDS unchanged (still 9 members, six new fields still present).
const NEW_FIELDS = ["countryOfBirth", "foreignStreet", "foreignCity", "foreignProvince", "foreignPostalCode", "foreignCountry"] as const;
check("R1-T18 CLASS_A1_FIELDS unchanged (15 members: 9 original + 6 new)", CLASS_A1_FIELDS.length === 15);

// R1-T19/T20 -- all six remain legal Coach acquisition fields and remain Class A1.
check("R1-T19 all six remain legal Coach acquisition fields (A0_FIELD_LIST)", NEW_FIELDS.every(f => (A0_FIELD_LIST as readonly string[]).includes(f)));
check("R1-T20 all six remain Class A1", NEW_FIELDS.every(f => (CLASS_A1_FIELDS as readonly string[]).includes(f)));

// R1-T21 -- Class A2 remains exactly profession/industry/yearsExperience.
check("R1-T21 Class A2 unchanged (not part of CLASS_A1_FIELDS)", !["profession", "industry", "yearsExperience"].some(f => (CLASS_A1_FIELDS as readonly string[]).includes(f)));

console.log(failures === 0 ? `\nALL A3-R1 CHECKS PASS` : `\n${failures} A3-R1 CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
