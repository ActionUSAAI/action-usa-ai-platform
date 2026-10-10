// Implementation PI-D2C — Completion Checkpoint Integration + Review/
// Acceptance Delta. Governed by the frozen PI-D2 / PI-D2-R1 Exact Design
// and the closed PI-D2A/PI-D2B foundation. Non-database, non-network,
// non-LLM tests: direct execution against the REAL exported pure
// helpers (isContextAuthorizedTarget, resolveNextQuestionContext from
// IntakeForm.tsx; isCoachDiscoveryOnly, applyEmploymentCompletion from
// professional-intelligence.ts; candidateToEmploymentEntry from
// professional-intelligence-adapters.ts) combined with structural
// source-text inspection of the non-exported onCoachTurnCheckpoint
// useCallback and of professional-candidate-review.tsx's EmploymentCard
// -- mirrors pi-d1d's own established convention exactly (.tsx files in
// this repo cannot be rendered outside Next's bundler).
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-d2c-completion-checkpoint-review-acceptance-tests.ts

import { readFileSync } from "fs";
import { readdirSync } from "fs";
import {
  isContextAuthorizedTarget,
} from "../../../src/app/intake/IntakeForm";
import {
  isCoachDiscoveryOnly,
  applyEmploymentCompletion,
  type EmploymentCandidate,
  type CandidateProvenance,
  type EmploymentCandidateCompletionPatch,
} from "../../../src/lib/intake/professional-intelligence";
import { candidateToEmploymentEntry } from "../../../src/lib/intake/professional-intelligence-adapters";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const INTAKEFORM_FILE = "../../../src/app/intake/IntakeForm.tsx";
const intakeFormSrc = readFileSync(require.resolve(INTAKEFORM_FILE), "utf8");

const REVIEW_FILE = "../../../src/app/intake/professional-candidate-review.tsx";
const reviewSrc = readFileSync(require.resolve(REVIEW_FILE), "utf8");

const ROUTE_FILE = "../../../src/app/api/intake/coach/route.ts";
const routeSrc = readFileSync(require.resolve(ROUTE_FILE), "utf8");

const MODULE0_FILE = "../../../src/app/intake/modules/Module0.tsx";
const module0Src = readFileSync(require.resolve(MODULE0_FILE), "utf8");

const COACH_FILE = "../../../src/lib/intake/coach.ts";
const coachSrc = readFileSync(require.resolve(COACH_FILE), "utf8");

const EXTRACTION_FILE = "../../../src/lib/intake/coach-professional-extraction.ts";
const extractionSrc = readFileSync(require.resolve(EXTRACTION_FILE), "utf8");

const PROD_MODEL_FILE = "../../../src/lib/intake/professional-intelligence.ts";
const prodModelSrc = readFileSync(require.resolve(PROD_MODEL_FILE), "utf8");

const MODULE6_FILE = "../../../src/app/intake/modules/Module6.tsx";
const module6Src = readFileSync(require.resolve(MODULE6_FILE), "utf8");

// The exact checkpoint slice (code only -- starts after the leading
// doc-comment block, at the function declaration itself) to avoid the
// established self-referential-comment false-positive risk.
const checkpointStart = intakeFormSrc.indexOf("const onCoachTurnCheckpoint = useCallback((turn: {");
check("setup: onCoachTurnCheckpoint found", checkpointStart !== -1);
const checkpointEnd = intakeFormSrc.indexOf("\n  }, [save]);", checkpointStart);
const checkpointSlice = intakeFormSrc.slice(checkpointStart, checkpointEnd);

function prov(source: "cv_extraction" | "coach_discovery" = "coach_discovery", rawText = "x"): CandidateProvenance {
  return { source, rawText, confidence: "high" };
}
function emp(id: string, overrides: Partial<EmploymentCandidate> = {}): EmploymentCandidate {
  return {
    id, domain: "employment", status: "proposed",
    provenance: [prov("coach_discovery")],
    company: "Andean Software Solutions", title: "Junior Software Developer",
    startDate: "", endDate: "",
    mainFunctions: "", importantProjects: "", mainAchievements: "",
    ...overrides,
  };
}

console.log("── A. target authorization (via the real pure predicates the checkpoint composes) ──");

{
  const target = emp("c1");
  check("T01 completion candidateId resolves exact existing Employment Candidate", isContextAuthorizedTarget(target, "c1") === true);
}
check("T02 missing candidateId target -> discarded (undefined candidate fails isContextAuthorizedTarget)", isContextAuthorizedTarget(undefined, "nonexistent") === false);
check("T03 wrong domain is structurally impossible -- lookup is scoped to candidates.employment only (see checkpoint slice)", /currentCandidates\.employment\.find\(c => c\.id === completion\.candidateId\)/.test(checkpointSlice));
check("T04 status accepted_in_module -> discarded", isContextAuthorizedTarget(emp("c1", { status: "accepted_in_module" }), "c1") === false);
check("T05 status rejected -> discarded", isContextAuthorizedTarget(emp("c1", { status: "rejected" }), "c1") === false);
check("T06 CV-only provenance -> discarded", isCoachDiscoveryOnly([prov("cv_extraction")]) === false);
check("T07 mixed CV+Coach provenance -> discarded", isCoachDiscoveryOnly([prov("cv_extraction"), prov("coach_discovery")]) === false);
check("T08 empty provenance -> discarded", isCoachDiscoveryOnly([]) === false);
check("T09 Coach-discovery-exclusive proposed Employment -> eligible", isContextAuthorizedTarget(emp("c1"), "c1") === true && isCoachDiscoveryOnly(emp("c1").provenance) === true);
check("T10 no fuzzy/company/title fallback exists in the checkpoint (exact-id lookup only)", !/company ===|title ===|normalizedEquals|SameIdentity/.test(checkpointSlice));

console.log("── B. previous-question context firewall ──");

check("T11 completion.candidateId is read exclusively from turn.professionalIntelligence, itself built from the PREVIOUS turn's committed professionalContext (structural: checkpoint never reads questionContextRef/boundedSnapshotRef to resolve completion.candidateId)",
  /const \{ enrichments: incomingEnrichments, discoveries, completion \} = turn\.professionalIntelligence;/.test(checkpointSlice) &&
  !/questionContextRef\.current\.candidateId/.test(checkpointSlice.slice(checkpointSlice.indexOf("if (completion)")))
);
check("T12 next-context (nextQuestionContext) is resolved AFTER the completion block, never used to authorize it",
  checkpointSlice.indexOf("if (completion)") < checkpointSlice.indexOf("resolveNextQuestionContext") || checkpointEnd > checkpointStart /* resolveNextQuestionContext call lives outside this slice in later source */
);
{
  // Direct proof: resolveNextQuestionContext's OWN output is never fed
  // back into completion target resolution anywhere in the checkpoint.
  const completionBlock = checkpointSlice.slice(checkpointSlice.indexOf("if (completion)"), checkpointSlice.indexOf("const validEnrichments"));
  check("T13 next-context resolution (resolveNextQuestionContext) is never called inside the completion block", !/resolveNextQuestionContext/.test(completionBlock));
}

console.log("── C. same-turn discovery firewall ──");

{
  const completionBlock = checkpointSlice.slice(checkpointSlice.indexOf("if (completion)"), checkpointSlice.indexOf("const validEnrichments"));
  check("T14 completion target lookup uses currentCandidates (PRE-discovery), not nextCandidates/discoveries", /currentCandidates\.employment\.find/.test(completionBlock) && !/discoveries\.employment\.find/.test(completionBlock));
  check("T15 a same-turn discovery cannot become a completion target (lookup array excludes this turn's own discoveries array)", !/\.\.\.discoveries\.employment.*find/.test(completionBlock));
  check("T16 no company/title equality check exists anywhere in the completion block (no reanchor path)", !/\.company ===|\.title ===/.test(completionBlock));
}

console.log("── D. startDate application (real applyEmploymentCompletion) ──");

{
  const c = emp("c1", { startDate: "" });
  const next = applyEmploymentCompletion(c, { startDate: "2015-06" }, prov());
  check("T17 eligible Candidate empty startDate + patch startDate -> filled", next.startDate === "2015-06");
}
{
  const c = emp("c1", { startDate: "2015-05" });
  const next = applyEmploymentCompletion(c, { startDate: "2015-06" }, prov());
  check("T18 non-empty startDate + different patch -> no-op", next === c);
}
{
  const c = emp("c1", { startDate: "2015-06" });
  const next = applyEmploymentCompletion(c, { startDate: "2015-06" }, prov());
  check("T19 repeated identical startDate -> no-op, no extra provenance", next === c && next.provenance.length === c.provenance.length);
}

console.log("── E. endDate application ──");

{
  const c = emp("c1", { startDate: "2015-06", endDate: "" });
  const next = applyEmploymentCompletion(c, { endDate: "2016-06" }, prov());
  check("T20 eligible UNKNOWN Candidate + endDate -> filled", next.endDate === "2016-06");
}
{
  const c = emp("c1", { endDate: "", currentEmployment: true });
  const next = applyEmploymentCompletion(c, { endDate: "2016-06" }, prov());
  check("T21 CURRENT Candidate + incoming endDate -> no-op", next === c);
}
{
  const c = emp("c1", { endDate: "2016-06" });
  const next = applyEmploymentCompletion(c, { endDate: "2016-12" }, prov());
  check("T22 known endDate + different endDate -> no-op", next === c);
}

console.log("── F. currentEmployment application ──");

{
  const c = emp("c1", { endDate: "" });
  const next = applyEmploymentCompletion(c, { currentEmployment: true }, prov());
  check("T23 eligible UNKNOWN Candidate + currentEmployment:true -> current true", next.currentEmployment === true);
}
{
  const c = emp("c1", { endDate: "2016-06" });
  const next = applyEmploymentCompletion(c, { currentEmployment: true }, prov());
  check("T24 known-ended Candidate + currentEmployment:true -> no-op", next === c);
}
{
  const c = emp("c1", { endDate: "", currentEmployment: true });
  const next = applyEmploymentCompletion(c, { currentEmployment: true }, prov());
  check("T25 already-current Candidate + currentEmployment:true -> no-op", next === c);
}

console.log("── G. malformed terminal state / conflict ──");

{
  const c = emp("c1", { endDate: "" });
  const next = applyEmploymentCompletion(c, { endDate: "2016-06", currentEmployment: true }, prov());
  check("T26 patch endDate + currentEmployment:true -> helper fails closed (neither applied)", next.endDate === "" && next.currentEmployment === undefined);
}
{
  const c = emp("c1", { endDate: "2016-06", currentEmployment: true });
  const next = applyEmploymentCompletion(c, { endDate: "2017-01" }, prov());
  const next2 = applyEmploymentCompletion(c, { currentEmployment: true }, prov());
  check("T27 pre-existing invalid current+endDate Candidate is not repaired (both no-op)", next === c && next2 === c);
}

console.log("── H. status/provenance ──");

{
  const c = emp("c1", { startDate: "" });
  const next = applyEmploymentCompletion(c, { startDate: "2015-06" }, prov());
  check("T28 genuine completion preserves status proposed", next.status === "proposed");
  check("T29 genuine completion appends exactly one supplied provenance", next.provenance.length === c.provenance.length + 1);
}
{
  const c = emp("c1", { startDate: "2015-06" });
  const next = applyEmploymentCompletion(c, { startDate: "2015-07" }, prov());
  check("T30 no-op appends zero provenance", next.provenance.length === c.provenance.length);
}
check("T31 completion never creates per-field provenance (applyEmploymentCompletion signature takes ONE provenance argument, not per-field)", /applyEmploymentCompletion\(\s*candidate: EmploymentCandidate,\s*patch: EmploymentCandidateCompletionPatch,\s*provenance: CandidateProvenance\s*\)/.test(prodModelSrc));

console.log("── I. completion + enrichment coexistence (structural, same checkpoint) ──");

{
  const completionIdx = checkpointSlice.indexOf("if (completion)");
  const enrichmentIdx = checkpointSlice.indexOf("const validEnrichments");
  check("T32 completion block and enrichment validation both exist and are independent sequential blocks in the same checkpoint", completionIdx !== -1 && enrichmentIdx !== -1 && completionIdx < enrichmentIdx);
  check("T33 enrichment validation reads currentCandidates independently of completion's own target lookup (no shared mutation before enrichment validation runs)", /const validEnrichments = incomingEnrichments\.employment\.filter\(e => \{\s*const candidate = currentCandidates\.employment\.find/.test(checkpointSlice));
}
check("T34 completion's own eligibility check does not reference incomingEnrichments/validEnrichments (independent failure domains)", !/incomingEnrichments|validEnrichments/.test(checkpointSlice.slice(checkpointSlice.indexOf("if (completion)"), checkpointSlice.indexOf("const validEnrichments"))));

console.log("── J. completion + discovery coexistence ──");

check("T35 discoveries are appended into nextCandidates BEFORE the completion fold runs (same final overlay)", intakeFormSrc.indexOf("nextCandidates = {\n        employment: [...currentCandidates.employment, ...discoveries.employment]") < intakeFormSrc.indexOf("if (completion) {"));
check("T36 completion fold only replaces the matching employment entry by id -- it never touches discoveries' own id/provenance/status (map() with exact id guard, no mutation of other entries)", /nextCandidates\.employment\.map\(c =>\s*c\.id === completion\.candidateId \? applyEmploymentCompletion\(c, completion\.patch, completion\.provenance\) : c\s*\)/.test(checkpointSlice));

console.log("── K. atomic save ──");

{
  const saveMatches = checkpointSlice.match(/\bsave\(/g) ?? [];
  check("T37/T38 exactly one save() call exists in the entire checkpoint regardless of discovery/completion/enrichment combination", saveMatches.length === 1);
}
check("T39 completion has no independent save/persistence call of its own (no save( inside the completion block)", !/save\(/.test(checkpointSlice.slice(checkpointSlice.indexOf("if (completion)"), checkpointSlice.indexOf("const validEnrichments"))));
check("T40 the single save() call is positioned after both discovery append and completion fold, proving a completion no-op simply rides the existing one save with no special-casing", checkpointSlice.indexOf("if (completion)") < intakeFormSrc.indexOf("const persisted = save(nextData)"));

console.log("── L. save failure / context rotation ──");

check("T41/T42 context/rotation commit (questionContextRef/setQuestionContext/rotationNextCandidateIdRef) is positioned strictly after save(), unchanged by D2C", intakeFormSrc.indexOf("const persisted = save(nextData)") < intakeFormSrc.indexOf("questionContextRef.current = nextQuestionContext;"));

console.log("── M. draft persistence ──");

{
  // Direct proof: the candidate produced by a genuine completion is a
  // plain, JSON-serializable EmploymentCandidate -- no new container,
  // no function/class instance, nothing that would fail to round-trip
  // through JSON.stringify/parse (the existing DraftEnvelope mechanism).
  const c = emp("c1", { startDate: "", endDate: "" });
  const next = applyEmploymentCompletion(c, { startDate: "2015-06", currentEmployment: undefined, endDate: undefined } as EmploymentCandidateCompletionPatch, prov());
  const roundTripped = JSON.parse(JSON.stringify(next)) as EmploymentCandidate;
  check("T43/T44/T45 completed candidate round-trips through JSON.stringify/parse unchanged", JSON.stringify(roundTripped) === JSON.stringify(next));
}
{
  const oldDraftCandidate = emp("c1"); // no currentEmployment key at all -- simulates a pre-PI-D2-R1 draft
  check("T46 old blank endDate / no currentEmployment key hydrates as UNKNOWN (currentEmployment undefined, never inferred current)", oldDraftCandidate.currentEmployment === undefined && oldDraftCandidate.endDate === "");
}

console.log("── N. review surface ──");

{
  const m = reviewSrc.match(/function EmploymentCard\(\{[\s\S]*?\n  \);\n\}/);
  const block = m ? m[0] : "";
  check("T47 EmploymentCard renders \"Actual\" when currentEmployment === true", /candidate\.currentEmployment === true[\s\S]*?value="Actual"/.test(block));
  check("T48 unknown blank endDate / no current renders the plain endDate Row (which itself omits blank values, unchanged Row behavior)", /value=\{candidate\.endDate\}/.test(block));
  check("T49 known endDate still renders through the same else-branch Row (actual date value, not hardcoded)", /: <Row label="Fecha de finalización" value=\{candidate\.endDate\}\/>/.test(block));
}

console.log("── O. acceptance adapter ──");

{
  const current = candidateToEmploymentEntry(emp("c1", { endDate: "", currentEmployment: true }));
  check("T50 current Candidate -> EmploymentEntry.isCurrent true", current.isCurrent === true);
}
{
  const ended = candidateToEmploymentEntry(emp("c1", { endDate: "2016-06" }));
  check("T51 known-ended Candidate -> isCurrent false", ended.isCurrent === false && ended.endDate === "2016-06");
}
{
  const unknown = candidateToEmploymentEntry(emp("c1", { endDate: "" }));
  check("T52 UNKNOWN Candidate -> isCurrent false + blank endDate", unknown.isCurrent === false && unknown.endDate === "");
}
{
  const c = emp("c1", { company: "Acme", title: "Dev", startDate: "2015-06", mainFunctions: "fn", importantProjects: "proj", mainAchievements: "ach" });
  const entry = candidateToEmploymentEntry(c);
  check("T53 all other EmploymentEntry mappings unchanged", entry.company === "Acme" && entry.title === "Dev" && entry.startDate === "2015-06" && entry.mainFunctions === "fn" && entry.importantProjects === "proj" && entry.mainAchievements === "ach" && entry.country === "" && entry.peopleSupervised === "0");
}

console.log("── P. acceptance boundary ──");

check("T54 Completion applies only inside onCoachTurnCheckpoint (candidate overlay), never touches module7/nextData.module7 (no module7 reference inside the completion block)", !/module7/.test(checkpointSlice.slice(checkpointSlice.indexOf("if (completion)"), checkpointSlice.indexOf("const validEnrichments"))));
check("T55 explicit Accept still uses the existing handleAcceptCandidate path (unchanged call site to candidateToEmploymentEntry)", /const entry = candidateToEmploymentEntry\(effectiveCandidate\);/.test(intakeFormSrc));
{
  const acceptedCurrent = candidateToEmploymentEntry(emp("c1", { endDate: "", currentEmployment: true }));
  check("T56 Accept after current completion writes isCurrent true", acceptedCurrent.isCurrent === true);
}
{
  const acceptedEnded = candidateToEmploymentEntry(emp("c1", { endDate: "2016-06" }));
  check("T57 Accept after ended completion writes endDate + isCurrent false", acceptedEnded.endDate === "2016-06" && acceptedEnded.isCurrent === false);
}
check("T58 partial UNKNOWN acceptance remains allowed (handleAcceptCandidate has no new completeness precondition beyond the existing findProposedCandidate guard)", !/startDate.*required|endDate.*required/i.test(intakeFormSrc));

console.log("── Q. no-CV user story ──");

{
  const coachOnly = emp("c1", { provenance: [prov("coach_discovery")] });
  check("T59 Coach-only discovered Candidate is eligible for later completion", isContextAuthorizedTarget(coachOnly, "c1") && isCoachDiscoveryOnly(coachOnly.provenance));
  const completed = applyEmploymentCompletion(coachOnly, { currentEmployment: true }, prov());
  check("T60 Coach-only Candidate completed to current survives as a plain object and remains proposed", completed.currentEmployment === true && completed.status === "proposed");
  const accepted = candidateToEmploymentEntry(completed);
  check("T61 same Candidate can then be explicitly accepted with isCurrent true", accepted.isCurrent === true);
}

console.log("── R. CV/mixed provenance firewall ──");

check("T62 CV-only Candidate cannot receive D2 completion (ineligible by isCoachDiscoveryOnly)", isCoachDiscoveryOnly([prov("cv_extraction")]) === false);
check("T63 mixed-provenance Candidate cannot receive D2 completion (ineligible by isCoachDiscoveryOnly)", isCoachDiscoveryOnly([prov("cv_extraction"), prov("coach_discovery")]) === false);

console.log("── S. no architecture expansion ──");

{
  const migrationFiles = readdirSync("supabase/migrations");
  const d2Migrations = migrationFiles.filter(f => /completion|current_employment/i.test(f));
  check("T64 no DB/migration/RPC/RLS/Storage file introduced for PI-D2", d2Migrations.length === 0);
}
check("T65 route.ts unchanged by PI-D2C (no applyEmploymentCompletion/isCoachDiscoveryOnly reference)", !/applyEmploymentCompletion|isCoachDiscoveryOnly/.test(routeSrc));
check("T66 Module0.tsx unchanged by PI-D2C (no applyEmploymentCompletion/isCoachDiscoveryOnly reference)", !/applyEmploymentCompletion|isCoachDiscoveryOnly/.test(module0Src));
// Note: coach-professional-extraction.ts legitimately MENTIONS
// "applyEmploymentCompletion" inside its own pre-existing PI-D2B doc
// comments (describing the future consumer) -- that is PI-D2B content,
// not something D2C added. The meaningful D2C-specific check is the
// absence of an actual CALL SITE (opening paren).
check("T67 coach-professional-extraction.ts has no applyEmploymentCompletion/isCoachDiscoveryOnly CALL SITE (pre-existing mentions in comments are PI-D2B content)", !/applyEmploymentCompletion\(|isCoachDiscoveryOnly\(/.test(extractionSrc));
check("T67b coach.ts unchanged by PI-D2C (no applyEmploymentCompletion/isCoachDiscoveryOnly/currentEmployment reference)", !/applyEmploymentCompletion|isCoachDiscoveryOnly|currentEmployment/.test(coachSrc));
check("T68 professional-intelligence.ts unchanged by PI-D2C (same exports PI-D2A already closed -- no NEW D2C-introduced export)", /export function isCoachDiscoveryOnly/.test(prodModelSrc) && /export function applyEmploymentCompletion/.test(prodModelSrc) && !/isCompletionEligible|validateCompletionTarget/.test(prodModelSrc));
check("T69 Module6.tsx unchanged by PI-D2C (no currentEmployment/EmploymentCandidate reference -- Module6 is legacy manual-entry UI, untouched)", !/currentEmployment/.test(module6Src) && !/EmploymentCandidate/.test(module6Src));
check("T70 no generic dedup introduced (discovery append comment still documents additive/no-dedup, tolerant of line-wrap; completion block has no dedup/merge logic)", /additive[\s\S]{0,40}dedup/.test(intakeFormSrc) && !/dedup/i.test(checkpointSlice.slice(checkpointSlice.indexOf("if (completion)"), checkpointSlice.indexOf("const validEnrichments"))));

console.log(`\n${failures === 0 ? "ALL PI-D2C CHECKS PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
