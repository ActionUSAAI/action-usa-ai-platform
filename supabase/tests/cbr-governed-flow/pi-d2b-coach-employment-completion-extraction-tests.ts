// Implementation PI-D2B — Coach Employment Completion Extraction
// Contract. Governed by the frozen PI-D2 / PI-D2-R1 Exact Design and the
// closed PI-D2A model foundation. Non-database, non-network, non-LLM
// unit tests against the REAL production exports of
// src/lib/intake/coach-professional-extraction.ts (imported by path,
// not reimplemented) -- mirrors pi-d1a's own established convention.
// Only the pure parser/materializer is exercised; no network call is
// made (parseCoachProfessionalExtractionResponse is called directly
// with a canned raw JSON string).
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-d2b-coach-employment-completion-extraction-tests.ts
//
// Scope: the extraction CONTRACT only. PI-D2B produces an unconsumed
// `completion` result -- no Candidate mutation, no IntakeForm/route/
// Module0 wiring, no review surface, no acceptance adapter change.
// None of that exists yet, by design (PI-D2C's authority).

import { readFileSync } from "fs";
import {
  type CoachProfessionalExtractionInput,
  parseCoachProfessionalExtractionResponse,
} from "../../../src/lib/intake/coach-professional-extraction";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const EXTRACTION_FILE = "../../../src/lib/intake/coach-professional-extraction.ts";
const extractionSrc = readFileSync(require.resolve(EXTRACTION_FILE), "utf8");

const PROD_FILE = "../../../src/lib/intake/professional-intelligence.ts";
const prodSrc = readFileSync(require.resolve(PROD_FILE), "utf8");

const ROUTE_FILE = "../../../src/app/api/intake/coach/route.ts";
const routeSrc = readFileSync(require.resolve(ROUTE_FILE), "utf8");

const MODULE0_FILE = "../../../src/app/intake/modules/Module0.tsx";
const module0Src = readFileSync(require.resolve(MODULE0_FILE), "utf8");

const INTAKEFORM_FILE = "../../../src/app/intake/IntakeForm.tsx";
const intakeFormSrc = readFileSync(require.resolve(INTAKEFORM_FILE), "utf8");

const REVIEW_FILE = "../../../src/app/intake/professional-candidate-review.tsx";
const reviewSrc = readFileSync(require.resolve(REVIEW_FILE), "utf8");

const ADAPTERS_FILE = "../../../src/lib/intake/professional-intelligence-adapters.ts";
const adaptersSrc = readFileSync(require.resolve(ADAPTERS_FILE), "utf8");

function ctx(candidateId: string, startDate = "", endDate = ""): CoachProfessionalExtractionInput["activeContext"] {
  return { domain: "employment", candidateId, identity: { company: "Andean Software Solutions", title: "Junior Software Developer", startDate, endDate } };
}
function input(currentMessage: string, activeContext?: CoachProfessionalExtractionInput["activeContext"]): CoachProfessionalExtractionInput {
  return { currentMessage, ...(activeContext ? { activeContext } : {}) };
}
function rawJson(body: Record<string, unknown>): string {
  return JSON.stringify(body);
}

console.log("── A. Raw contract / authority ──");

{
  const m = extractionSrc.match(/interface RawEmploymentCompletion \{[\s\S]*?\n\}/);
  const block = m ? m[0] : "";
  check("T01a RawEmploymentCompletion block found", block.length > 0);
  check("T01b declares startDate", /startDate\?:\s*string/.test(block));
  check("T01c declares endDate", /endDate\?:\s*string/.test(block));
  check("T01d declares currentEmployment", /currentEmployment\?:\s*true/.test(block));
  check("T01e declares confidence", /confidence\?:\s*string/.test(block));
  check("T02 no candidateId field", !/candidateId/.test(block));
  check("T03a no status field", !/\bstatus\b/.test(block));
  check("T03b no source field", !/\bsource\b/.test(block));
  check("T03c no provenance field", !/\bprovenance\b/.test(block));
  check("T03d no domain field", !/\bdomain\b/.test(block));
  check("T04a no company field", !/\bcompany\b/.test(block));
  check("T04b no title field", !/\btitle\b/.test(block));
  check("T05a no mainFunctions field", !/mainFunctions/.test(block));
  check("T05b no importantProjects field", !/importantProjects/.test(block));
  check("T05c no mainAchievements field", !/mainAchievements/.test(block));
  check("T06 currentEmployment is true-only, not boolean", !/currentEmployment\??:\s*boolean/.test(block));
}

console.log("── B. Result contract ──");

{
  const m = extractionSrc.match(/export interface ProfessionalIntelligenceCoachResult \{[\s\S]*?\n\}/);
  const block = m ? m[0] : "";
  check("T07 ProfessionalIntelligenceCoachResult declares optional singular completion", /completion\?:\s*EmploymentCandidateCompletionResult;/.test(block));
  check("T09a completion is not an array (result type)", !/completion\?:\s*EmploymentCandidateCompletionResult\[\]/.test(block));
}
{
  const m = extractionSrc.match(/export interface EmploymentCandidateCompletionResult \{[\s\S]*?\n\}/);
  const block = m ? m[0] : "";
  check("T08a result declares candidateId", /candidateId:\s*string;/.test(block));
  check("T08b result declares patch", /patch:\s*EmploymentCandidateCompletionPatch;/.test(block));
  check("T08c result declares provenance", /provenance:\s*CandidateProvenance;/.test(block));
  check("T09b provenance is singular, not an array", !/provenance:\s*CandidateProvenance\[\]/.test(block));
}

console.log("── C. Active context ──");

{
  // T10 — no activeContext + raw completion -> no materialized completion.
  const raw = rawJson({ completion: { startDate: "2015-06" } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("empecé en junio de 2015"));
  check("T10 no activeContext -> completion discarded (fail closed)", result.completion === undefined);
}
{
  // T11 — activeContext candidateId X -> materialized completion candidateId X.
  const raw = rawJson({ completion: { startDate: "2015-06" } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("empecé en junio de 2015", ctx("candidate-X")));
  check("T11 materialized completion carries the activeContext candidateId", result.completion?.candidateId === "candidate-X");
}
{
  // T12 — model/raw output cannot override candidateId, even if injected.
  const raw = rawJson({ completion: { startDate: "2015-06", candidateId: "candidate-INJECTED" } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("empecé en junio de 2015", ctx("candidate-X")));
  check("T12 injected raw candidateId is ignored; application candidateId wins", result.completion?.candidateId === "candidate-X");
}

console.log("── D. startDate ──");

{
  // T13 — empty context startDate + valid raw startDate -> patch.startDate.
  const raw = rawJson({ completion: { startDate: "2015-06" } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "", "")));
  check("T13 empty context startDate + valid raw -> materialized", result.completion?.patch.startDate === "2015-06");
}
{
  // T14 — non-empty context startDate + different raw startDate -> omitted.
  const raw = rawJson({ completion: { startDate: "2015-07" } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "2015-06", "")));
  check("T14 non-empty context startDate -> raw startDate omitted", result.completion === undefined);
}
{
  // T15 — blank raw startDate -> omitted.
  const raw = rawJson({ completion: { startDate: "" } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "", "")));
  check("T15 blank raw startDate -> omitted", result.completion === undefined);
}

console.log("── E. endDate ──");

{
  // T16 — empty context endDate + valid raw endDate -> patch.endDate.
  const raw = rawJson({ completion: { endDate: "2016-06" } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "2015-06", "")));
  check("T16 empty context endDate + valid raw -> materialized", result.completion?.patch.endDate === "2016-06");
}
{
  // T17 — non-empty context endDate + different raw endDate -> omitted.
  const raw = rawJson({ completion: { endDate: "2016-12" } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "2015-06", "2016-06")));
  check("T17 non-empty context endDate -> raw endDate omitted", result.completion === undefined);
}
{
  // T18 — blank raw endDate -> omitted.
  const raw = rawJson({ completion: { endDate: "" } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "2015-06", "")));
  check("T18 blank raw endDate -> omitted", result.completion === undefined);
}

console.log("── F. current employment ──");

{
  // T19 — explicit raw currentEmployment:true on eligible (unknown) context -> materialized.
  const raw = rawJson({ completion: { currentEmployment: true } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("todavía trabajo ahí", ctx("c1", "2015-06", "")));
  check("T19 eligible context + currentEmployment:true -> materialized", result.completion?.patch.currentEmployment === true);
}
{
  // T20 — raw currentEmployment:false cannot materialize.
  const raw = rawJson({ completion: { currentEmployment: false } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "2015-06", "")));
  check("T20 raw currentEmployment:false cannot materialize", result.completion === undefined);
}
{
  // T21 — known non-empty context endDate + raw currentEmployment:true -> omitted.
  const raw = rawJson({ completion: { currentEmployment: true } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "2015-06", "2016-06")));
  check("T21 known endDate -> currentEmployment completion omitted", result.completion === undefined);
}
{
  // T22 — blank endDate alone with no explicit currentEmployment must not produce currentEmployment:true.
  const raw = rawJson({ completion: {} });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "2015-06", "")));
  check("T22 blank endDate alone -> no currentEmployment fabricated", result.completion === undefined);
}

console.log("── G. terminal contradiction ──");

{
  // T23 — raw nonblank endDate + currentEmployment:true -> neither terminal field materialized.
  const raw = rawJson({ completion: { endDate: "2016-06", currentEmployment: true } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "2015-06", "")));
  check("T23 same-raw contradiction -> result.completion absent (no other field)", result.completion === undefined);
}
{
  // T24 — same contradiction + valid missing startDate -> only startDate materialized.
  const raw = rawJson({ completion: { startDate: "2015-06", endDate: "2016-06", currentEmployment: true } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "", "")));
  check("T24a startDate materialized despite contradiction", result.completion?.patch.startDate === "2015-06");
  check("T24b endDate NOT materialized", result.completion?.patch.endDate === undefined);
  check("T24c currentEmployment NOT materialized", result.completion?.patch.currentEmployment === undefined);
}
{
  // T25 — terminal contradiction with no independent field -> result.completion absent entirely.
  const raw = rawJson({ completion: { endDate: "2016-06", currentEmployment: true } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "2015-06", "")));
  check("T25 terminal contradiction, no independent field -> completion absent", result.completion === undefined);
}

console.log("── H. empty result ──");

{
  // T26 — completion object containing only blank/invalid values -> result.completion absent.
  const raw = rawJson({ completion: { startDate: "", endDate: "", currentEmployment: false } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "", "")));
  check("T26 all-blank/invalid completion -> absent", result.completion === undefined);
}
{
  // T27 — completion:null -> result.completion absent.
  const raw = rawJson({ completion: null });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "", "")));
  check("T27 completion:null -> absent", result.completion === undefined);
}
{
  // T28 — completion omitted entirely -> result.completion absent.
  const raw = rawJson({});
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "", "")));
  check("T28 completion omitted -> absent", result.completion === undefined);
}

console.log("── I. provenance ──");

{
  // T29 — non-empty completion result source assigned "coach_discovery".
  const raw = rawJson({ completion: { startDate: "2015-06" } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("empecé en junio de 2015", ctx("c1", "", "")));
  check("T29 provenance.source === coach_discovery", result.completion?.provenance.source === "coach_discovery");
}
{
  // T30 — rawText exactly currentMessage.
  const raw = rawJson({ completion: { startDate: "2015-06" } });
  const msg = "empecé en junio de 2015, exactamente";
  const result = parseCoachProfessionalExtractionResponse(raw, input(msg, ctx("c1", "", "")));
  check("T30 provenance.rawText === exact currentMessage", result.completion?.provenance.rawText === msg);
}
{
  // T31 — confidence passes through existing validateConfidence semantics.
  const raw = rawJson({ completion: { startDate: "2015-06", confidence: "medium" } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "", "")));
  check("T31 valid confidence passes through", result.completion?.provenance.confidence === "medium");
}
{
  // T32 — invalid/missing confidence uses exact existing fallback behavior (defaults to "low").
  const rawMissing = rawJson({ completion: { startDate: "2015-06" } });
  const resultMissing = parseCoachProfessionalExtractionResponse(rawMissing, input("msg", ctx("c1", "", "")));
  const rawInvalid = rawJson({ completion: { startDate: "2015-06", confidence: "nonsense" } });
  const resultInvalid = parseCoachProfessionalExtractionResponse(rawInvalid, input("msg", ctx("c1", "", "")));
  check("T32a missing confidence falls back to low", resultMissing.completion?.provenance.confidence === "low");
  check("T32b invalid confidence falls back to low", resultInvalid.completion?.provenance.confidence === "low");
}

console.log("── J. separation from enrichment ──");

{
  // T33 — completion + enrichment may coexist as separate result fields.
  const raw = rawJson({
    completion: { startDate: "2015-06" },
    enrichment: { patch: { mainFunctions: "backend development" }, confidence: "high" },
  });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "", "")));
  check("T33a completion present", result.completion?.patch.startDate === "2015-06");
  check("T33b enrichment present independently", result.enrichments.employment.length === 1 && result.enrichments.employment[0].patch.mainFunctions === "backend development");
}
{
  // T34 — completion does not alter enrichment patch field set.
  const m = extractionSrc.match(/interface RawEnrichmentPatch \{[\s\S]*?\n\}/);
  const block = m ? m[0] : "";
  check("T34 RawEnrichmentPatch unchanged (3 narrative fields only)", /mainFunctions/.test(block) && /importantProjects/.test(block) && /mainAchievements/.test(block) && !/startDate/.test(block) && !/currentEmployment/.test(block));
}
{
  // T35 — enrichment cannot carry startDate/endDate/currentEmployment
  // (EmploymentEnrichmentPatch, imported from professional-intelligence.ts, unchanged).
  const m = prodSrc.match(/export interface EmploymentEnrichmentPatch \{[\s\S]*?\n\}/);
  const block = m ? m[0] : "";
  check("T35 EmploymentEnrichmentPatch has no startDate/endDate/currentEmployment", !/startDate/.test(block) && !/endDate/.test(block) && !/currentEmployment/.test(block));
}

console.log("── K. discovery separation ──");

{
  // T36 — completion does not create an Employment discovery.
  const raw = rawJson({ completion: { startDate: "2015-06" } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "", "")));
  check("T36 completion creates zero discoveries", result.discoveries.employment.length === 0);
}
{
  // T37 — Employment discovery still requires company + title (regression, unchanged source rule).
  const raw = rawJson({ discoveries: { employment: [{ company: "", title: "Engineer", startDate: "2015-06" }] } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg"));
  check("T37 discovery missing company is dropped", result.discoveries.employment.length === 0);
}
{
  // T38 — completion target never comes from discovery company/title
  // (completion only ever reads input.activeContext.candidateId; a
  // same-turn discovery is structurally invisible to the completion block).
  const raw = rawJson({
    completion: { startDate: "2015-06" },
    discoveries: { employment: [{ company: "Other Co", title: "Other Title" }] },
  });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("pinned-candidate", "", "")));
  check("T38 completion candidateId remains the pinned context, unaffected by a same-turn discovery", result.completion?.candidateId === "pinned-candidate");
}

console.log("── L. bounded input / no authority leak ──");

{
  // T39 — candidateId is legitimate APPLICATION bookkeeping on
  // CoachProfessionalExtractionInput.activeContext (so the materializer
  // can assign target authority), but it must never be interpolated
  // into model-visible prompt TEXT. buildActiveContextBlock, the sole
  // function that renders the active-context prompt text, takes only
  // `identity` (company/title/startDate/endDate) -- never candidateId
  // -- so candidateId is structurally unreachable from prompt text.
  const sig = extractionSrc.match(/function buildActiveContextBlock\([^)]*\)/)?.[0] ?? "";
  check("T39 buildActiveContextBlock's only parameter is identity (candidateId never passed to prompt text)", /^function buildActiveContextBlock\(identity: CoachProfessionalExtractionIdentity\)$/.test(sig));
}
{
  const m = extractionSrc.match(/export interface CoachProfessionalExtractionIdentity \{[\s\S]*?\n\}/);
  const block = m ? m[0] : "";
  check("T40 CoachProfessionalExtractionIdentity has no status/source/provenance", !/\bstatus\b/.test(block) && !/\bsource\b/.test(block) && !/\bprovenance\b/.test(block));
}
{
  const m = extractionSrc.match(/export interface CoachProfessionalExtractionInput \{[\s\S]*?\n\}/);
  const block = m ? m[0] : "";
  check("T41 extraction input has exactly currentMessage + activeContext, no candidate overlay field", /currentMessage: string;/.test(block) && /activeContext\?:/.test(block) && !/overlay/i.test(block) && !/candidates:/.test(block));
}
{
  const m = extractionSrc.match(/export interface CoachProfessionalExtractionInput \{[\s\S]*?\n\}/);
  const block = m ? m[0] : "";
  check("T42 extraction input has no conversation history field", !/history/i.test(block));
}

console.log("── M. date semantics ──");

{
  // T43 — month+year follows existing YYYY-MM rule (parser passes through
  // exactly what was supplied -- precision discipline is a prompt-level
  // instruction verified structurally below).
  const raw = rawJson({ completion: { startDate: "2015-06" } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("empecé en junio de 2015", ctx("c1", "", "")));
  check("T43 month+year passes through as YYYY-MM", result.completion?.patch.startDate === "2015-06");
}
{
  // T44 — year-only remains YYYY.
  const raw = rawJson({ completion: { startDate: "2015" } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("empecé en 2015", ctx("c1", "", "")));
  check("T44 year-only passes through unmodified", result.completion?.patch.startDate === "2015");
}
{
  // T45 — no fabricated day precision: parser never appends/derives a day;
  // structural check that the prompt instructs against inventing a month.
  check("T45 prompt instructs never to invent month/day precision", /nunca inventes un mes/i.test(extractionSrc));
}
{
  // T46 — explicit current/present maps only to currentEmployment:true (never a raw endDate signal).
  const raw = rawJson({ completion: { currentEmployment: true } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("actualmente trabajo ahí", ctx("c1", "2015-06", "")));
  check("T46 current/present maps only to currentEmployment:true, endDate stays absent from patch", result.completion?.patch.currentEmployment === true && result.completion?.patch.endDate === undefined);
}
{
  // T47 — malformed/ambiguous date does not produce a safe completion field
  // (model instructed to omit; parser's nonBlank-based gate also drops
  // whitespace-only/blank attempts).
  const raw = rawJson({ completion: { startDate: "   " } });
  const result = parseCoachProfessionalExtractionResponse(raw, input("msg", ctx("c1", "", "")));
  check("T47 whitespace-only date is treated as blank -> no completion", result.completion === undefined);
}

console.log("── N. route/module forwarding (zero D2B change) ──");

check("T48 route.ts still forwards the full professional result object opaquely", /professionalIntelligence:\s*professionalResult\.value/.test(routeSrc));
check("T49 Module0.tsx still forwards professionalIntelligence opaquely into the checkpoint", /professionalIntelligence:\s*json\.professionalIntelligence/.test(module0Src));
// Note: the bare word "completion" is not a safe substring to search for
// -- route.ts has none, but Module0.tsx has a pre-existing, unrelated
// comment mentioning "A0 completion" (the A0 extraction process
// finishing, nothing to do with PI-D2B Employment completion). Scoped to
// the actual PI-D2B vocabulary instead.
check("T50a route.ts contains no PI-D2B-specific plumbing (no EmploymentCandidateCompletion reference)", !/EmploymentCandidateCompletion|employmentCompletion/.test(routeSrc));
check("T50b Module0.tsx contains no PI-D2B-specific plumbing (no EmploymentCandidateCompletion reference, no '.completion' property access)", !/EmploymentCandidateCompletion|employmentCompletion/.test(module0Src) && !/\.completion\b/.test(module0Src));

console.log("── O. no consumer ──");

check("T51 applyEmploymentCompletion has zero production call sites outside professional-intelligence.ts", !/applyEmploymentCompletion\(/.test(intakeFormSrc) && !/applyEmploymentCompletion\(/.test(routeSrc) && !/applyEmploymentCompletion\(/.test(module0Src));
check("T52 IntakeForm.tsx contains no completion consumption (no '.completion' property access)", !/professionalIntelligence\.completion|turn\.completion|result\.completion/.test(intakeFormSrc));
check("T53 professional-candidate-review.tsx contains no PI-D2B change (no 'completion' reference)", !/completion/i.test(reviewSrc));
check("T54 professional-intelligence-adapters.ts contains no PI-D2B change (no 'completion'/'currentEmployment' reference)", !/completion/i.test(adaptersSrc) && !/currentEmployment/.test(adaptersSrc));

console.log(`\n${failures === 0 ? "ALL PI-D2B CHECKS PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
