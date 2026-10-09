// Implementation PI-B1 — A0 Professional Candidate Acquisition
// Foundation. Non-database, non-network, non-LLM unit tests against the
// REAL production export src/lib/intake/a0-extract.ts's new
// parseProfessionalCandidateResponse()/extractProfessionalCandidates()
// (imported by path, not reimplemented) — mirrors pi-a/c1/a1/a2/a4/b1's
// own established convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-b1-a0-professional-candidate-acquisition-tests.ts
//
// Scope: the new, fully independent professional-candidate acquisition
// call/parser only. No within-CV deduplication is tested (Owner-frozen
// PI-B1 scope reduction — every valid occurrence remains its own
// candidate). The existing 27-field extractCvFields() contract is
// proven byte-unchanged structurally, not merely by git diff.

import { readFileSync } from "fs";
import {
  A0_FIELD_LIST, type A0Confidence,
  extractCvFields, parseProfessionalCandidateResponse,
} from "../../../src/lib/intake/a0-extract";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const PROD_FILE = "../../../src/lib/intake/a0-extract.ts";
const src = readFileSync(require.resolve(PROD_FILE), "utf8");

// ── §39 — existing A0 contract protection ───────────────────────────────────
{
  const expected27 = [
    "familyName", "givenName", "middleName", "dateOfBirth", "nationalities",
    "countryOfResidence", "cityOfResidence", "email", "whatsapp",
    "profession", "industry", "yearsExperience",
    "countryOfBirth", "foreignStreet", "foreignCity", "foreignProvince",
    "foreignPostalCode", "foreignCountry",
    "awards", "memberships", "media_coverage", "judging",
    "original_contributions", "scholarly_articles", "critical_role",
    "high_salary", "artistic_exhibitions",
  ];
  check("T01 A0_FIELD_LIST still contains exactly 27 fields", A0_FIELD_LIST.length === 27);
  check("T02 all exact 27 field names remain present", expected27.every(f => (A0_FIELD_LIST as readonly string[]).includes(f)));
  check("T03 existing SYSTEM_PROMPT (27-field) still present and interpolated", /Eres A0, el motor extractor de CVs/.test(src) && A0_FIELD_LIST.every(f => src.includes(f)));
  check("T04 extractCvFields exists with the same 3-parameter public signature", typeof extractCvFields === "function" && extractCvFields.length === 3);
  check("T05 existing call still has max_tokens: 2048", /model:\s*"claude-sonnet-4-6",\s*\n\s*max_tokens:\s*2048/.test(src));
  check("T06 new professional call has max_tokens: 4096 (distinct from the existing 2048)", /max_tokens:\s*4096/.test(src));
}

// ── §56 — existing A0 isolation ─────────────────────────────────────────────
{
  const extractCvFieldsBody = src.match(/export async function extractCvFields[\s\S]*?\n\}/)?.[0] ?? "";
  const extractProfessionalBody = src.match(/export async function extractProfessionalCandidates[\s\S]*?\n\}/)?.[0] ?? "";
  check("T07 extractCvFields() does not call extractProfessionalCandidates()", !extractCvFieldsBody.includes("extractProfessionalCandidates"));
  check("T08 extractProfessionalCandidates() does not call extractCvFields()", !extractProfessionalBody.includes("extractCvFields("));
  check("T09 each has its own separate fetch() invocation", (extractCvFieldsBody.match(/fetch\(/g) ?? []).length === 1 && (extractProfessionalBody.match(/fetch\(/g) ?? []).length === 1);
  check("T10 each has its own system prompt constant", extractCvFieldsBody.includes("SYSTEM_PROMPT") && !extractCvFieldsBody.includes("PROFESSIONAL_CANDIDATE_SYSTEM_PROMPT") &&
    extractProfessionalBody.includes("PROFESSIONAL_CANDIDATE_SYSTEM_PROMPT") && !extractProfessionalBody.includes("system: SYSTEM_PROMPT"));
}

// ── §55 — no PI-A comparator consumption ────────────────────────────────────
{
  const forbiddenComparators = [
    "employmentSameIdentity", "employmentMaterialEquals", "educationSameIdentity", "educationMaterialEquals",
    "certificationSameIdentity", "certificationMaterialEquals", "businessSameIdentity", "businessMaterialEquals",
    "evidenceSameIdentity", "evidenceMaterialEquals",
  ];
  check("T11 a0-extract.ts imports/uses no PI-A comparator function", forbiddenComparators.every(name => !src.includes(name)));
  check("T12 a0-extract.ts defines no merge/dedup/reconcile function", !/function\s+(mergeCandidates|deduplicateCandidates|collapseCandidates|reconcileCandidates)/.test(src));
}

// ── §40 — empty result ──────────────────────────────────────────────────────
{
  const r1 = parseProfessionalCandidateResponse('{"candidates": {}}');
  check("T13 {candidates:{}} -> all seven arrays present and empty",
    Object.values(r1).every(v => Array.isArray(v) && v.length === 0) && Object.keys(r1).length === 7);
  const r2 = parseProfessionalCandidateResponse('{"candidates": {"employment":[],"education":[],"certification":[],"business":[],"evidence":[]}}');
  check("T14 explicit empty arrays -> same result", Object.values(r2).every(v => Array.isArray(v) && v.length === 0));
}

// ── §41 — employment ─────────────────────────────────────────────────────────
{
  const raw = JSON.stringify({ candidates: { employment: [
    { company: "Expedia", title: "Senior Engineer", startDate: "2022-01", endDate: "2023-01",
      mainFunctions: "Led backend team", importantProjects: "Migration", mainAchievements: "40% faster",
      confidence: "high", rawText: "Senior Engineer at Expedia, 2022-2023" },
  ] } });
  const r = parseProfessionalCandidateResponse(raw);
  check("T15 one valid employment candidate created", r.employment.length === 1);
  const c = r.employment[0];
  check("T16 application-created id present", typeof c.id === "string" && c.id.length > 0);
  check("T17 status forced to proposed", c.status === "proposed");
  check("T18 exactly one provenance entry", c.provenance.length === 1);
  check("T19 provenance source forced to cv_extraction", c.provenance[0].source === "cv_extraction");
  check("T20 payload copied explicitly", c.company === "Expedia" && c.title === "Senior Engineer" && c.mainAchievements === "40% faster");
}
{
  const raw = JSON.stringify({ candidates: { employment: [
    { company: "A", title: "X", startDate: "", endDate: "", mainFunctions: "", importantProjects: "", mainAchievements: "", confidence: "low", rawText: "worked at A" },
    { company: "B", title: "Y", startDate: "", endDate: "", mainFunctions: "", importantProjects: "", mainAchievements: "", confidence: "low", rawText: "worked at B" },
  ] } });
  check("T21 multiple employments remain multiple", parseProfessionalCandidateResponse(raw).employment.length === 2);
}
{
  const dupe = { company: "Expedia", title: "Senior Engineer", startDate: "2022-01", endDate: "2023-01",
    mainFunctions: "same", importantProjects: "", mainAchievements: "", confidence: "high", rawText: "same statement" };
  const raw = JSON.stringify({ candidates: { employment: [dupe, dupe] } });
  const r = parseProfessionalCandidateResponse(raw);
  check("T22 materially identical duplicate occurrences remain TWO candidates in PI-B1 (no dedup)", r.employment.length === 2);
  check("T22b each duplicate has its own distinct id", r.employment[0].id !== r.employment[1].id);
}
{
  const raw = JSON.stringify({ candidates: { employment: [{ company: "", title: "X", confidence: "high", rawText: "x" }] } });
  check("T23 blank company -> dropped", parseProfessionalCandidateResponse(raw).employment.length === 0);
}
{
  const raw = JSON.stringify({ candidates: { employment: [{ company: "A", title: "", confidence: "high", rawText: "x" }] } });
  check("T24 blank title -> dropped", parseProfessionalCandidateResponse(raw).employment.length === 0);
}
{
  const raw = JSON.stringify({ candidates: { employment: [{ company: "A", title: "B", startDate: "", endDate: "", confidence: "high", rawText: "x" }] } });
  check("T25 blank dates do not drop an otherwise valid employment candidate", parseProfessionalCandidateResponse(raw).employment.length === 1);
}

// ── §42 — date representation (preserved verbatim after trim/validation) ───
{
  const raw = JSON.stringify({ candidates: { employment: [
    { company: "A", title: "B", startDate: "2024-03", endDate: "", confidence: "high", rawText: "x" },
    { company: "A", title: "B", startDate: "2022", endDate: "", confidence: "high", rawText: "x" },
    { company: "A", title: "B", startDate: "2022-01", endDate: "", confidence: "high", rawText: "x" },
  ] } });
  const r = parseProfessionalCandidateResponse(raw);
  check("T26 month+year preserved as given (YYYY-MM)", r.employment[0].startDate === "2024-03");
  check("T27 year-only preserved literally, not expanded to YYYY-MM", r.employment[1].startDate === "2022");
  check("T28 Present/Current (blank endDate from model) preserved as empty string, never fabricated", r.employment[2].endDate === "");
  check("T29 no isCurrent field exists anywhere on the returned candidate", !("isCurrent" in r.employment[2]));
}

// ── §43 — education ──────────────────────────────────────────────────────────
{
  const raw = JSON.stringify({ candidates: { education: [
    { institution: "MIT", degreeName: "CS", graduationYear: "", confidence: "medium", rawText: "x" },
  ] } });
  const r = parseProfessionalCandidateResponse(raw);
  check("T30 valid institution+degreeName -> candidate", r.education.length === 1);
  check("T31 blank graduationYear still valid", r.education[0].graduationYear === "");
}
check("T32 blank institution -> dropped", parseProfessionalCandidateResponse(JSON.stringify({ candidates: { education: [{ institution: "", degreeName: "CS", confidence: "high", rawText: "x" }] } })).education.length === 0);
check("T33 blank degreeName -> dropped", parseProfessionalCandidateResponse(JSON.stringify({ candidates: { education: [{ institution: "MIT", degreeName: "", confidence: "high", rawText: "x" }] } })).education.length === 0);

// ── §44 — certification ──────────────────────────────────────────────────────
{
  const r = parseProfessionalCandidateResponse(JSON.stringify({ candidates: { certification: [
    { name: "AWS Solutions Architect", institution: "", year: "", confidence: "low", rawText: "x" },
  ] } }));
  check("T34 valid name -> candidate", r.certification.length === 1);
  check("T35 institution blank allowed", r.certification[0].institution === "");
  check("T36 year blank allowed", r.certification[0].year === "");
}
check("T37 blank name -> dropped", parseProfessionalCandidateResponse(JSON.stringify({ candidates: { certification: [{ name: "", confidence: "high", rawText: "x" }] } })).certification.length === 0);

// ── §45 — business (explicit ownership vocabulary only) ─────────────────────
{
  const founder = parseProfessionalCandidateResponse(JSON.stringify({ candidates: { business: [
    { name: "Acme LLC", role: "Founder", foundedYear: "2019", confidence: "high", rawText: "x" },
  ] } }));
  check("T38 explicit Founder role -> candidate", founder.business.length === 1);

  const founderCeo = parseProfessionalCandidateResponse(JSON.stringify({ candidates: { business: [
    { name: "Acme LLC", role: "Founder & CEO", confidence: "high", rawText: "x" },
  ] } }));
  check("T39 'Founder & CEO' (ownership concept + another title) -> candidate", founderCeo.business.length === 1);

  for (const role of ["Co-Founder", "Owner", "Partner", "Fundador", "Fundadora", "Cofundador", "Cofundadora", "Propietario", "Propietaria", "Socio", "Socia"]) {
    const r = parseProfessionalCandidateResponse(JSON.stringify({ candidates: { business: [{ name: "X", role, confidence: "high", rawText: "x" }] } }));
    check(`T40 explicit ownership word "${role}" -> candidate`, r.business.length === 1);
  }

  const ceoOnly = parseProfessionalCandidateResponse(JSON.stringify({ candidates: { business: [
    { name: "Acme LLC", role: "CEO", confidence: "high", rawText: "x" },
  ] } }));
  check("T41 ordinary 'CEO' without ownership signal -> must NOT become BusinessCandidate", ceoOnly.business.length === 0);

  for (const role of ["President", "Director", "Manager"]) {
    const r = parseProfessionalCandidateResponse(JSON.stringify({ candidates: { business: [{ name: "X", role, confidence: "high", rawText: "x" }] } }));
    check(`T42 ordinary role "${role}" alone -> must NOT become BusinessCandidate`, r.business.length === 0);
  }
}

// ── §46 — evidence ────────────────────────────────────────────────────────────
{
  for (const category of ["awards", "memberships", "media", "judging", "criticalRole", "artisticExhibitions"]) {
    const r = parseProfessionalCandidateResponse(JSON.stringify({ candidates: { evidence: [{ category, confidence: "medium", rawText: "x" }] } }));
    check(`T43 evidence category "${category}" -> candidate`, r.evidence.length === 1 && r.evidence[0].category === category);
  }
  const invalid = parseProfessionalCandidateResponse(JSON.stringify({ candidates: { evidence: [{ category: "patents", confidence: "high", rawText: "x" }] } }));
  check("T44 invalid evidence category -> dropped", invalid.evidence.length === 0);

  const possession = parseProfessionalCandidateResponse(JSON.stringify({ candidates: { evidence: [
    { category: "awards", status: "tengo", tengo: true, possession: "yes", document: "award.pdf", file: "x.pdf", confidence: "high", rawText: "x" },
  ] } }));
  check("T45 no returned EvidenceCandidate carries tengo/tal_vez/possession/document/file or equivalent metadata",
    possession.evidence.length === 1 &&
    !("tengo" in possession.evidence[0]) && !("status" in possession.evidence[0] ? (possession.evidence[0] as unknown as { status: string }).status === "tengo" : false) &&
    !("possession" in possession.evidence[0]) && !("document" in possession.evidence[0]) && !("file" in possession.evidence[0]));
}

// ── §47 — reference/strategic exclusion ──────────────────────────────────────
{
  const raw = JSON.stringify({ candidates: {
    reference: [{ name: "Jane Doe", relationshipType: "supervisor", confidence: "high", rawText: "x" }],
    strategicAnswer: [{ targetField: "ledImpactProjects", answer: "x", confidence: "high", rawText: "x" }],
  } });
  const r = parseProfessionalCandidateResponse(raw);
  check("T46 returned reference array remains [] even if the model emits a reference bucket", r.reference.length === 0);
  check("T47 returned strategicAnswer array remains [] even if the model emits a strategicAnswer bucket", r.strategicAnswer.length === 0);
}

// ── §48 — confidence ──────────────────────────────────────────────────────────
{
  for (const [input, expected] of [["high", "high"], ["medium", "medium"], ["low", "low"], ["invalid", "low"], [undefined, "low"]] as [unknown, A0Confidence][]) {
    const r = parseProfessionalCandidateResponse(JSON.stringify({ candidates: { employment: [{ company: "A", title: "B", confidence: input, rawText: "x" }] } }));
    check(`T48 confidence ${JSON.stringify(input)} -> "${expected}" (candidate not dropped)`, r.employment.length === 1 && r.employment[0].provenance[0].confidence === expected);
  }
}

// ── §49 — rawText ─────────────────────────────────────────────────────────────
check("T49 absent rawText -> candidate dropped", parseProfessionalCandidateResponse(JSON.stringify({ candidates: { employment: [{ company: "A", title: "B", confidence: "high" }] } })).employment.length === 0);
check("T50 non-string rawText -> candidate dropped", parseProfessionalCandidateResponse(JSON.stringify({ candidates: { employment: [{ company: "A", title: "B", confidence: "high", rawText: 123 }] } })).employment.length === 0);
check("T51 blank rawText (after trim) -> candidate dropped", parseProfessionalCandidateResponse(JSON.stringify({ candidates: { employment: [{ company: "A", title: "B", confidence: "high", rawText: "   " }] } })).employment.length === 0);

// ── §50 — untrusted metadata ──────────────────────────────────────────────────
{
  const raw = JSON.stringify({ candidates: { employment: [
    { company: "A", title: "B", confidence: "high", rawText: "x",
      id: "attacker-id", status: "accepted_in_module", source: "staff", provenance: [{ source: "staff", rawText: "fake", confidence: "high" }],
      caseId: "case-1", clientId: "client-1", module: "module7", tengo: true },
  ] } });
  const r = parseProfessionalCandidateResponse(raw);
  const c = r.employment[0];
  check("T52 none of the malicious/untrusted raw values survive", c.id !== "attacker-id" && c.status === "proposed" && c.provenance[0].source === "cv_extraction" &&
    !("caseId" in c) && !("clientId" in c) && !("module" in c) && !("tengo" in c));
}

// ── §51 — malformed candidate containment ────────────────────────────────────
{
  const raw = JSON.stringify({ candidates: { employment: [
    { company: "", title: "B", confidence: "high", rawText: "x" }, // malformed (blank company)
    { company: "Valid Co", title: "Valid Title", confidence: "high", rawText: "x" }, // valid
  ] } });
  const r = parseProfessionalCandidateResponse(raw);
  check("T53 malformed employment candidate dropped, valid sibling survives", r.employment.length === 1 && r.employment[0].company === "Valid Co");
}
{
  const raw = JSON.stringify({ candidates: {
    employment: "not-an-array",
    education: [{ institution: "MIT", degreeName: "CS", confidence: "high", rawText: "x" }],
  } });
  const r = parseProfessionalCandidateResponse(raw);
  check("T54 malformed domain bucket (not an array) -> that domain becomes []", r.employment.length === 0);
  check("T54b other valid domains survive alongside a malformed bucket", r.education.length === 1);
}

// ── §52 — top-level parser failure ────────────────────────────────────────────
check("T55 no JSON object -> throws", (() => { try { parseProfessionalCandidateResponse("no json here at all"); return false; } catch { return true; } })());
check("T56 malformed JSON -> throws", (() => { try { parseProfessionalCandidateResponse("{candidates: this is not valid json}"); return false; } catch { return true; } })());

// ── §53 — no dedup (explicit, second domain too) ─────────────────────────────
{
  const dupeCert = { name: "AWS Solutions Architect", institution: "Amazon", year: "2022", confidence: "high", rawText: "same" };
  const r = parseProfessionalCandidateResponse(JSON.stringify({ candidates: { certification: [dupeCert, dupeCert] } }));
  check("T57 materially identical certification duplicates remain two candidates (no dedup)", r.certification.length === 2);
  check("T57b each has a distinct application-created id and one provenance entry", r.certification[0].id !== r.certification[1].id && r.certification[0].provenance.length === 1 && r.certification[1].provenance.length === 1);
}

// ── §54 — zero runtime consumers ─────────────────────────────────────────────
{
  const consumers = ["Module0.tsx", "IntakeForm.tsx"].map(f => {
    try { return { f, content: readFileSync(require.resolve(`../../../src/app/intake/${f === "IntakeForm.tsx" ? f : "modules/" + f}`), "utf8") }; }
    catch { return { f, content: "" }; }
  });
  check("T58 extractProfessionalCandidates is not referenced by Module0.tsx or IntakeForm.tsx",
    consumers.every(c => !c.content.includes("extractProfessionalCandidates")));
  // T59 reconciled post-PI-B2B (authorized historical boundary-test
  // reconciliation gate): the original assertion proved the route had
  // not yet consumed this function -- a temporal condition PI-B2B's
  // authorized route wiring intentionally ended (route consumption is
  // now PI-B2B's own property to prove). Replaced with the permanent
  // PI-B1 foundation invariant: extractProfessionalCandidates remains
  // defined/exported here and its acquisition model remains
  // independent of extractCvFields (never calls it internally).
  let a0ExtractSrc = "";
  try { a0ExtractSrc = readFileSync(require.resolve("../../../src/lib/intake/a0-extract.ts"), "utf8"); } catch { /* n/a */ }
  check("T59 extractProfessionalCandidates remains defined/exported by a0-extract.ts, independent of extractCvFields (PI-B1 foundation invariant)",
    /export async function extractProfessionalCandidates\(/.test(a0ExtractSrc) &&
    /export async function extractCvFields\(/.test(a0ExtractSrc));
  const professionalFnBody = a0ExtractSrc.slice(
    a0ExtractSrc.indexOf("export async function extractProfessionalCandidates"),
    a0ExtractSrc.indexOf("\n}", a0ExtractSrc.indexOf("export async function extractProfessionalCandidates")) + 2
  );
  check("T59b extractProfessionalCandidates never calls extractCvFields internally (two fully independent LLM calls, not a composed pipeline)",
    professionalFnBody.length > 0 && !professionalFnBody.includes("extractCvFields"));
}

console.log(failures === 0 ? `\nALL PI-B1 CHECKS PASS` : `\n${failures} PI-B1 CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
