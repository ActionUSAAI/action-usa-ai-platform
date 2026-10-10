// Implementation PI-D2A — Employment Candidate Completion Model + Pure
// Helpers. Governed by the frozen PI-D2 / PI-D2-R1 Exact Design.
// Non-database, non-network, non-LLM unit tests against the REAL
// production exports of src/lib/intake/professional-intelligence.ts
// (imported by path, not reimplemented) -- mirrors pi-a/pi-d0a's own
// established convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-d2a-employment-candidate-completion-model-tests.ts
//
// Scope: the completion model/pure-helper foundation only. No Coach
// extraction contract, no IntakeForm/Module0/route wiring, no review
// surface, no acceptance adapter change -- none of that exists yet, by
// design (PI-D2B/PI-D2C own that).

import { readFileSync } from "fs";
import {
  type EmploymentCandidate,
  type EmploymentCandidateCompletionPatch,
  type CandidateProvenance,
  type ProfessionalIntelligenceCandidates,
  emptyProfessionalIntelligenceCandidates,
  isCoachDiscoveryOnly,
  applyEmploymentCompletion,
  replaceCvExtractionCandidates,
  composeEffectiveCandidate,
} from "../../../src/lib/intake/professional-intelligence";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const PROD_FILE = "../../../src/lib/intake/professional-intelligence.ts";
const src = readFileSync(require.resolve(PROD_FILE), "utf8");

// ES5-target-safe field-name extraction (avoids spreading a RegExp
// iterator, which requires --downlevelIteration/ES2015+ target).
function fieldNames(block: string): string[] {
  const re = /^\s*(\w+)\??:/gm;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) { names.push(m[1]); }
  return names;
}

const prov = (source: "cv_extraction" | "coach_discovery" = "coach_discovery"): CandidateProvenance =>
  ({ source, rawText: "x", confidence: "high" });

function employment(overrides: Partial<EmploymentCandidate> = {}): EmploymentCandidate {
  return {
    id: "c1", domain: "employment", status: "proposed",
    provenance: [prov()],
    company: "Andean Software Solutions", title: "Junior Software Developer",
    startDate: "", endDate: "",
    mainFunctions: "", importantProjects: "", mainAchievements: "",
    ...overrides,
  };
}

console.log("── A. Representation ──");

{
  // T01 — EmploymentCandidate accepts currentEmployment:true.
  const c: EmploymentCandidate = employment({ currentEmployment: true });
  check("T01 EmploymentCandidate accepts currentEmployment:true", c.currentEmployment === true);
}
{
  // T02 — EmploymentCandidate without currentEmployment remains valid.
  const c: EmploymentCandidate = employment();
  check("T02 EmploymentCandidate without currentEmployment remains valid", c.currentEmployment === undefined);
}
{
  // T03 — no boolean false representation introduced by the type/source design.
  const m = src.match(/export interface EmploymentCandidate extends CandidateBase \{[\s\S]*?\n\}/);
  const block = m ? m[0] : "";
  check("T03a EmploymentCandidate block found", block.length > 0);
  check("T03b EmploymentCandidate declares currentEmployment?: true", /currentEmployment\?:\s*true;/.test(block));
  check("T03c EmploymentCandidate never declares currentEmployment as boolean", !/currentEmployment\??:\s*boolean/.test(block));
}

console.log("── B. Eligibility (isCoachDiscoveryOnly) ──");

check("T04 single coach_discovery entry -> eligible", isCoachDiscoveryOnly([prov("coach_discovery")]) === true);
check("T05 multiple coach_discovery entries -> eligible", isCoachDiscoveryOnly([prov("coach_discovery"), prov("coach_discovery")]) === true);
check("T06 cv_extraction only -> ineligible", isCoachDiscoveryOnly([prov("cv_extraction")]) === false);
check("T07 mixed cv_extraction + coach_discovery -> ineligible", isCoachDiscoveryOnly([prov("cv_extraction"), prov("coach_discovery")]) === false);
check("T08 empty provenance [] -> ineligible (not vacuously true)", isCoachDiscoveryOnly([]) === false);

console.log("── C. startDate completion ──");

{
  // T09 — empty startDate + valid patch -> filled.
  const c = employment({ startDate: "" });
  const next = applyEmploymentCompletion(c, { startDate: "2015-06" }, prov());
  check("T09 empty startDate + valid patch -> filled", next.startDate === "2015-06");
}
{
  // T10 — non-empty startDate + different patch -> unchanged.
  const c = employment({ startDate: "2015-05" });
  const next = applyEmploymentCompletion(c, { startDate: "2015-06" }, prov());
  check("T10 non-empty startDate + different patch -> unchanged", next.startDate === "2015-05");
  check("T10b non-empty startDate overwrite attempt is a full no-op -> same reference", next === c);
}
{
  // T11 — blank startDate patch -> unchanged.
  const c = employment({ startDate: "" });
  const next = applyEmploymentCompletion(c, { startDate: "" }, prov());
  check("T11 blank startDate patch -> unchanged", next.startDate === "" && next === c);
}

console.log("── D. endDate completion ──");

{
  // T12 — empty endDate + valid patch -> filled.
  const c = employment({ endDate: "" });
  const next = applyEmploymentCompletion(c, { endDate: "2016-06" }, prov());
  check("T12 empty endDate + valid patch -> filled", next.endDate === "2016-06");
}
{
  // T13 — non-empty endDate + different patch -> unchanged.
  const c = employment({ endDate: "2016-06" });
  const next = applyEmploymentCompletion(c, { endDate: "2016-12" }, prov());
  check("T13 non-empty endDate + different patch -> unchanged", next.endDate === "2016-06" && next === c);
}
{
  // T14 — currentEmployment:true + incoming endDate -> unchanged.
  const c = employment({ endDate: "", currentEmployment: true });
  const next = applyEmploymentCompletion(c, { endDate: "2016-06" }, prov());
  check("T14 currentEmployment:true + incoming endDate -> unchanged", next.endDate === "" && next === c);
}
{
  // T15 — blank endDate patch -> unchanged.
  const c = employment({ endDate: "" });
  const next = applyEmploymentCompletion(c, { endDate: "" }, prov());
  check("T15 blank endDate patch -> unchanged", next.endDate === "" && next === c);
}

console.log("── E. current employment completion ──");

{
  // T16 — unknown terminal state + currentEmployment:true -> currentEmployment true.
  const c = employment({ endDate: "" });
  const next = applyEmploymentCompletion(c, { currentEmployment: true }, prov());
  check("T16 unknown + currentEmployment:true -> currentEmployment true", next.currentEmployment === true && next.endDate === "");
}
{
  // T17 — known endDate + currentEmployment:true -> unchanged.
  const c = employment({ endDate: "2016-06" });
  const next = applyEmploymentCompletion(c, { currentEmployment: true }, prov());
  check("T17 known endDate + currentEmployment:true -> unchanged", next.currentEmployment === undefined && next === c);
}
{
  // T18 — already current + currentEmployment:true -> unchanged.
  const c = employment({ endDate: "", currentEmployment: true });
  const next = applyEmploymentCompletion(c, { currentEmployment: true }, prov());
  check("T18 already current + currentEmployment:true -> unchanged", next === c);
}

console.log("── F. terminal-state contradiction ──");

{
  // T19 — unknown candidate + patch containing BOTH nonblank endDate and currentEmployment:true -> neither applied.
  const c = employment({ endDate: "" });
  const next = applyEmploymentCompletion(c, { endDate: "2016-06", currentEmployment: true }, prov());
  check("T19 same-patch contradiction -> endDate NOT applied", next.endDate === "");
  check("T19b same-patch contradiction -> currentEmployment NOT applied", next.currentEmployment === undefined);
  check("T19c same-patch contradiction with no other change -> same reference", next === c);
}
{
  // T20 — same conflict + valid empty startDate completion -> startDate fills, terminal state remains unknown.
  const c = employment({ startDate: "", endDate: "" });
  const next = applyEmploymentCompletion(c, { startDate: "2015-06", endDate: "2016-06", currentEmployment: true }, prov());
  check("T20 startDate fills despite terminal contradiction", next.startDate === "2015-06");
  check("T20b terminal state remains unknown", next.endDate === "" && next.currentEmployment === undefined);
}
{
  // T21 — invalid pre-existing candidate (currentEmployment:true + nonempty endDate) + terminal-state patch -> no repair.
  const c = employment({ endDate: "2016-06", currentEmployment: true });
  const next = applyEmploymentCompletion(c, { endDate: "2017-01" }, prov());
  const next2 = applyEmploymentCompletion(c, { currentEmployment: true }, prov());
  check("T21a invalid pre-existing candidate: endDate completion is a no-op", next === c);
  check("T21b invalid pre-existing candidate: currentEmployment completion is a no-op", next2 === c);
}
{
  // T22 — same invalid pre-existing candidate + valid missing startDate -> startDate may fill; contradiction untouched.
  const c = employment({ startDate: "", endDate: "2016-06", currentEmployment: true });
  const next = applyEmploymentCompletion(c, { startDate: "2015-06" }, prov());
  check("T22a startDate fills despite pre-existing contradiction", next.startDate === "2015-06");
  check("T22b pre-existing contradiction left untouched (both fields preserved)", next.endDate === "2016-06" && next.currentEmployment === true);
}

console.log("── G. provenance ──");

{
  // T23 — one genuine field change -> exactly one provenance appended.
  const c = employment({ startDate: "" });
  const p = prov();
  const next = applyEmploymentCompletion(c, { startDate: "2015-06" }, p);
  check("T23 one genuine change -> provenance length +1", next.provenance.length === c.provenance.length + 1);
  check("T23b appended entry is exactly the supplied provenance object", next.provenance[next.provenance.length - 1] === p);
}
{
  // T24 — two genuine fields in same call -> exactly one provenance appended.
  const c = employment({ startDate: "", endDate: "" });
  const next = applyEmploymentCompletion(c, { startDate: "2015-06", endDate: "2016-06" }, prov());
  check("T24 two genuine field changes -> provenance length +1 (not +2)", next.provenance.length === c.provenance.length + 1);
}
{
  // T25 — no-op -> no provenance append.
  const c = employment({ startDate: "2015-06" });
  const next = applyEmploymentCompletion(c, { startDate: "2015-07" }, prov());
  check("T25 no-op -> provenance unchanged", next.provenance.length === c.provenance.length && next.provenance === c.provenance);
}
{
  // T26 — terminal conflict with no other change -> no provenance append.
  const c = employment({ endDate: "" });
  const next = applyEmploymentCompletion(c, { endDate: "2016-06", currentEmployment: true }, prov());
  check("T26 terminal conflict, no other change -> no provenance append", next.provenance.length === c.provenance.length && next === c);
}
{
  // T27 — terminal conflict + valid startDate change -> exactly one provenance appended.
  const c = employment({ startDate: "", endDate: "" });
  const next = applyEmploymentCompletion(c, { startDate: "2015-06", endDate: "2016-06", currentEmployment: true }, prov());
  check("T27 terminal conflict + valid startDate -> provenance length +1", next.provenance.length === c.provenance.length + 1);
}

console.log("── H. referential idempotency ──");

{
  // T28 — no-op returns exact same object reference.
  const c = employment({ startDate: "2015-06", endDate: "2016-06" });
  const next = applyEmploymentCompletion(c, { startDate: "2015-07", endDate: "2016-07" }, prov());
  check("T28 no-op returns exact same object reference", next === c);
}
{
  // T29 — genuine change returns new object reference.
  const c = employment({ startDate: "" });
  const next = applyEmploymentCompletion(c, { startDate: "2015-06" }, prov());
  check("T29 genuine change returns new object reference", next !== c);
}
{
  // T30 — input candidate object is not mutated.
  const c = employment({ startDate: "", endDate: "" });
  const snapshotStart = c.startDate, snapshotEnd = c.endDate, snapshotProvLen = c.provenance.length;
  applyEmploymentCompletion(c, { startDate: "2015-06", endDate: "2016-06" }, prov());
  check("T30 input candidate object is not mutated", c.startDate === snapshotStart && c.endDate === snapshotEnd && c.provenance.length === snapshotProvLen);
}
{
  // T31 — input patch object is not mutated.
  const c = employment({ startDate: "" });
  const patch: EmploymentCandidateCompletionPatch = { startDate: "2015-06" };
  const patchCopy = { ...patch };
  applyEmploymentCompletion(c, patch, prov());
  check("T31 input patch object is not mutated", JSON.stringify(patch) === JSON.stringify(patchCopy));
}
{
  // T32 — input provenance object is not mutated.
  const c = employment({ startDate: "" });
  const p = prov();
  const pCopy = { ...p };
  applyEmploymentCompletion(c, { startDate: "2015-06" }, p);
  check("T32 input provenance object is not mutated", JSON.stringify(p) === JSON.stringify(pCopy));
}

console.log("── I. Existing architecture regressions ──");

{
  // T33 — EmploymentEnrichmentPatch still contains ONLY the 3 narrative fields.
  const m = src.match(/export interface EmploymentEnrichmentPatch \{[\s\S]*?\n\}/);
  const block = m ? m[0] : "";
  const fields = fieldNames(block);
  check("T33 EmploymentEnrichmentPatch unchanged field set", JSON.stringify(fields.sort()) === JSON.stringify(["importantProjects", "mainAchievements", "mainFunctions"].sort()));
}
{
  // T34 — EmploymentCandidateCompletionPatch contains ONLY startDate/endDate/currentEmployment.
  const m = src.match(/export interface EmploymentCandidateCompletionPatch \{[\s\S]*?\n\}/);
  const block = m ? m[0] : "";
  const fields = fieldNames(block);
  check("T34 EmploymentCandidateCompletionPatch exact field set", JSON.stringify(fields.sort()) === JSON.stringify(["currentEmployment", "endDate", "startDate"].sort()));
}
{
  // T35 — company/title cannot be completion patch fields.
  const m = src.match(/export interface EmploymentCandidateCompletionPatch \{[\s\S]*?\n\}/);
  const block = m ? m[0] : "";
  check("T35 company is not a completion patch field", !/\bcompany\b/.test(block));
  check("T35b title is not a completion patch field", !/\btitle\b/.test(block));
}
{
  // T36 — narrative fields cannot be completion patch fields.
  const m = src.match(/export interface EmploymentCandidateCompletionPatch \{[\s\S]*?\n\}/);
  const block = m ? m[0] : "";
  check("T36 mainFunctions is not a completion patch field", !/mainFunctions/.test(block));
  check("T36b importantProjects is not a completion patch field", !/importantProjects/.test(block));
  check("T36c mainAchievements is not a completion patch field", !/mainAchievements/.test(block));
}
{
  // T37/T38 — isCvExtractionOnly / replaceCvExtractionCandidates behavior unchanged
  // (isCvExtractionOnly is unexported -- regression-tested via its sole
  // observable effect, the exported replaceCvExtractionCandidates).
  const empty = emptyProfessionalIntelligenceCandidates();
  const cvOnly = employment({ id: "cv1", provenance: [prov("cv_extraction")] });
  const coachOnly = employment({ id: "coach1", provenance: [prov("coach_discovery")] });
  const mixed = employment({ id: "mix1", provenance: [prov("cv_extraction"), prov("coach_discovery")] });
  const current: ProfessionalIntelligenceCandidates = { ...empty, employment: [cvOnly, coachOnly, mixed] };
  const incomingCv = employment({ id: "cv2", provenance: [prov("cv_extraction")] });
  const incoming: ProfessionalIntelligenceCandidates = { ...empty, employment: [incomingCv] };
  const result = replaceCvExtractionCandidates(current, incoming);
  const ids = result.employment.map(c => c.id);
  check("T37/T38 CV-only candidate replaced (removed)", !ids.includes("cv1"));
  check("T37/T38b coach-only candidate preserved", ids.includes("coach1"));
  check("T37/T38c mixed-provenance candidate preserved", ids.includes("mix1"));
  check("T37/T38d incoming CV candidate present", ids.includes("cv2"));
}
{
  // T39 — composeEffectiveCandidate behavior unchanged.
  const base = employment({ mainFunctions: "base functions" });
  const result = composeEffectiveCandidate(base, []);
  check("T39 composeEffectiveCandidate unchanged for empty enrichment list", result.mainFunctions === "base functions");
}
{
  // T40 — currentEmployment is NOT folded through EmploymentEnrichmentPatch;
  // composeEffectiveCandidate preserves it verbatim (it has no awareness
  // of the field at all -- EmploymentEnrichmentPatch structurally cannot
  // carry it, confirmed by T33/T36).
  const base = employment({ currentEmployment: true, endDate: "" });
  const result = composeEffectiveCandidate(base, []);
  check("T40 currentEmployment preserved verbatim through composeEffectiveCandidate", result.currentEmployment === true);
}

console.log(`\n${failures === 0 ? "ALL PI-D2A CHECKS PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
