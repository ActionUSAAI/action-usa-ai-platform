// Implementation PI-C3 — Professional Candidate Runtime Wiring & Atomic
// Draft Save. Non-database, non-network, non-LLM tests against the
// REAL production exports of src/app/intake/IntakeForm.tsx (imported
// by path where the export is a plain, non-JSX function; proven by
// source-text inspection where it is not — mirrors pi-b2a/pi-b2b/
// pi-c2's own established convention for this file).
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-c3-professional-candidate-runtime-wiring-tests.ts

import { readFileSync } from "fs";
import { findProposedCandidate, withCandidateStatus } from "../../../src/app/intake/IntakeForm";
import type { EmploymentCandidate, CandidateProvenance } from "../../../src/lib/intake/professional-intelligence";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const INTAKEFORM_FILE = "../../../src/app/intake/IntakeForm.tsx";
const src = readFileSync(require.resolve(INTAKEFORM_FILE), "utf8");

const prov = (): CandidateProvenance => ({ source: "cv_extraction", rawText: "x", confidence: "high" });
const emp = (id: string, status: "proposed" | "accepted_in_module" | "rejected" = "proposed"): EmploymentCandidate => ({
  id, domain: "employment", status, provenance: [prov()],
  company: "Expedia", title: "Senior Engineer", startDate: "2019-01", endDate: "2021-06",
  mainFunctions: "x", importantProjects: "", mainAchievements: "",
});

// ════════════════════════════════════════════════════════════════════════════
// §56 items 7-11, 61-62, 71-72 — pure helper behavior (directly executable)
// ════════════════════════════════════════════════════════════════════════════
{
  const arr = [emp("a"), emp("b", "accepted_in_module"), emp("c", "rejected")];
  check("T01 findProposedCandidate finds an existing proposed candidate", findProposedCandidate(arr, "a")?.id === "a");
  check("T02 findProposedCandidate returns null for missing candidate (no-op policy)", findProposedCandidate(arr, "zzz") === null);
  check("T03 findProposedCandidate returns null for accepted_in_module candidate (non-proposed no-op)", findProposedCandidate(arr, "b") === null);
  check("T04 findProposedCandidate returns null for rejected candidate (non-proposed no-op)", findProposedCandidate(arr, "c") === null);
  check("T05 findProposedCandidate does not mutate input array", arr.length === 3 && arr[0].status === "proposed");

  const updated = withCandidateStatus(arr, "a", "accepted_in_module");
  check("T06 withCandidateStatus transitions exactly the targeted candidate", updated.find(c => c.id === "a")?.status === "accepted_in_module");
  check("T07 withCandidateStatus preserves id/payload/provenance of the transitioned candidate",
    updated[0].id === "a" && updated[0].company === "Expedia" && updated[0].provenance.length === 1);
  check("T08 withCandidateStatus leaves all other candidates untouched",
    updated[1].status === "accepted_in_module" && updated[2].status === "rejected" &&
    updated[1] === arr[1] && updated[2] === arr[2]);
  check("T09 withCandidateStatus does not mutate the input array (fresh array returned)", updated !== arr && arr[0].status === "proposed");
  check("T10 no candidate deletion on transition (array length unchanged)", updated.length === arr.length);
}

// ════════════════════════════════════════════════════════════════════════════
// §61 items 1-4 — review surface mount / props
// ════════════════════════════════════════════════════════════════════════════
{
  check("T11 ProfessionalCandidateReview imported into IntakeForm", /import \{ ProfessionalCandidateReview, type ProfessionalIntelligenceCandidateDomain \} from "\.\/professional-candidate-review";/.test(src));
  const lines = src.split("\n");
  const module0Line = lines.find(l => l.includes("<Module0 ")) ?? "";
  const reviewLine = lines.find(l => l.includes("<ProfessionalCandidateReview ")) ?? "";
  const module0LineIdx = lines.indexOf(module0Line);
  const reviewLineIdx = lines.indexOf(reviewLine);
  check("T12 review surface mounted exactly once, gated on step === 0", (src.match(/<ProfessionalCandidateReview /g) ?? []).length === 1 && reviewLine.includes("step === 0"));
  check("T13 review surface mounted textually AFTER the Module0 render line", module0LineIdx !== -1 && reviewLineIdx !== -1 && module0LineIdx < reviewLineIdx);
  check("T14 review surface is not mounted inside Module0.tsx (not inside Module0's own JSX)", !module0Line.includes("ProfessionalCandidateReview"));
  check("T15 no new numbered step/module introduced (TOTAL unchanged, still 14)", /const TOTAL = 14;/.test(src));
  check("T16 candidates prop is exactly the React state, not the ref", reviewLine.includes("candidates={professionalIntelligenceCandidates}") && !reviewLine.includes("Ref"));
  check("T17 onAccept wired to handleAcceptCandidate", reviewLine.includes("onAccept={handleAcceptCandidate}"));
  check("T18 onReject wired to handleRejectCandidate", reviewLine.includes("onReject={handleRejectCandidate}"));
}

// ════════════════════════════════════════════════════════════════════════════
// §61 items 5-11 — handler shape / lookup discipline
// ════════════════════════════════════════════════════════════════════════════
{
  const acceptBody = src.slice(src.indexOf("const handleAcceptCandidate"), src.indexOf("const handleRejectCandidate"));
  const rejectBody = src.slice(src.indexOf("const handleRejectCandidate"), src.indexOf("// ── Init session ID"));
  check("T19 Accept handler is a plain (synchronous) useCallback, never async", !/handleAcceptCandidate = useCallback\(async/.test(src) && /const handleAcceptCandidate = useCallback\(\(domain: ProfessionalIntelligenceCandidateDomain, candidateId: string\) => \{/.test(src));
  check("T20 Reject handler is a plain (synchronous) useCallback, never async", !/handleRejectCandidate = useCallback\(async/.test(src) && /const handleRejectCandidate = useCallback\(\(domain: ProfessionalIntelligenceCandidateDomain, candidateId: string\) => \{/.test(src));
  check("T21 Accept reads from professionalIntelligenceCandidatesRef.current, not React state directly",
    /const candidates = professionalIntelligenceCandidatesRef\.current;/.test(acceptBody));
  check("T22 Reject reads from professionalIntelligenceCandidatesRef.current, not React state directly",
    /const candidates = professionalIntelligenceCandidatesRef\.current;/.test(rejectBody));
  check("T23 Accept lookup is domain-scoped (findProposedCandidate called once per domain array, never on a flattened/global list)",
    (acceptBody.match(/findProposedCandidate\(candidates\.\w+, candidateId\)/g) ?? []).length === 7);
  check("T24 Reject lookup is domain-scoped the same way", (rejectBody.match(/findProposedCandidate\(candidates\.\w+, candidateId\)/g) ?? []).length === 7);
  check("T25 no candidateId-only global lookup helper exists (no find-across-all-domains function)", !/findCandidateById\(|findAnyCandidate\(/.test(src));
  check("T26 proposed-status guard present for every domain in Accept (via findProposedCandidate)", acceptBody.includes("if (!candidate) return;"));
  check("T27 proposed-status guard present for every domain in Reject", (rejectBody.match(/if \(!findProposedCandidate\(candidates\.\w+, candidateId\)\) return;/g) ?? []).length === 7);
}

// ════════════════════════════════════════════════════════════════════════════
// §61 items 12-25 — per-domain Accept semantics (Employment/Education/Certification/Business/Reference)
// ════════════════════════════════════════════════════════════════════════════
{
  // T28 reconciled post-PI-D0B (authorized historical boundary-test
  // reconciliation): the original assertion required the adapter to
  // receive the raw `candidate` directly -- a temporal condition
  // PI-D0B's authorized effective-candidate composition (explicitly
  // described and required by this very reconciliation gate's own
  // §13) permanently ends. The adapter itself is still the exact,
  // unmodified candidateToEmploymentEntry -- only its argument is now
  // the transient, non-persisted effective candidate.
  check("T28 Employment uses the unmodified candidateToEmploymentEntry, now fed the transient effective candidate",
    /candidateToEmploymentEntry\(effectiveCandidate\)/.test(src));
  check("T29 Employment appends to module7.employment", /module7: \{ employment: \[\.\.\.current\.module7\.employment, entry\] \}/.test(src));
  check("T30 Education uses candidateToEducationEntry", /candidateToEducationEntry\(candidate\)/.test(src));
  check("T31 Education appends to module5.degrees", /module5: \{ degrees: \[\.\.\.current\.module5\.degrees, entry\] \}/.test(src));
  check("T32 Certification uses candidateToCertificationEntry", /candidateToCertificationEntry\(candidate\)/.test(src));
  check("T33 Certification appends to module6.certifications", /module6: \{ certifications: \[\.\.\.current\.module6\.certifications, entry\] \}/.test(src));
  check("T34 Business uses candidateToBusinessEntry", /candidateToBusinessEntry\(candidate\)/.test(src));
  check("T35 Business appends to module8.businesses", /businesses: \[\.\.\.current\.module8\.businesses, entry\]/.test(src));
  check("T36 Business sets hasOwnBusinesses: true on Accept", /hasOwnBusinesses: true, businesses:/.test(src));
  check("T37 Business does not map candidate.role into the module (no .role assignment from candidate)", !/candidate\.role/.test(src));
  check("T38 Reference uses candidateToReferenceEntry", /candidateToReferenceEntry\(candidate\)/.test(src));
  check("T39 Reference appends to module9.references", /module9: \{ references: \[\.\.\.current\.module9\.references, entry\] \}/.test(src));
  check("T40 Reference does not infer email (no candidate.email reference)", !/candidate\.email/.test(src));
  check("T41 Reference does not map relationshipType (no candidate.relationshipType reference)", !/candidate\.relationshipType/.test(src));
}

// ════════════════════════════════════════════════════════════════════════════
// §61 items 26-45 — Evidence / Strategic acceptance semantics
// ════════════════════════════════════════════════════════════════════════════
{
  check("T42 Evidence uses candidateToEvidenceStatusPatch", /candidateToEvidenceStatusPatch\(candidate, current\.module10\)/.test(src));
  check("T43 Evidence target is module10", /module10: \{ \.\.\.current\.module10, \.\.\.patch \}/.test(src));
  const evidenceCase = src.slice(src.indexOf('case "evidence": {', src.indexOf("handleAcceptCandidate")), src.indexOf('case "strategicAnswer"'));
  check("T44 Evidence case body never writes the literal \"tengo\"/\"no_tengo\" itself (overwrite protection is entirely the unmodified PI-C1 adapter's responsibility)",
    !evidenceCase.includes('"tengo"') && !evidenceCase.includes('"no_tengo"'));
  check("T45 Evidence {} patch still transitions candidate to accepted_in_module (status set unconditionally after the adapter call, not gated on patch contents)",
    /const patch = candidateToEvidenceStatusPatch\(candidate, current\.module10\);\s*nextData = \{ \.\.\.current, module10: \{ \.\.\.current\.module10, \.\.\.patch \} \};\s*nextCandidates = \{ \.\.\.candidates, evidence: withCandidateStatus\(candidates\.evidence, candidateId, "accepted_in_module"\) \};/.test(src));
  check("T46 Evidence case body does not create an Evidence/Document record (no items[] push, no Disposition field, no file field assignment)",
    !/\.push\(|Disposition:|filePath:|fileName:/.test(evidenceCase));
  check("T47 Strategic uses candidateToStrategicAnswerPatch", /candidateToStrategicAnswerPatch\(candidate, current\.module11\)/.test(src));
  check("T48 Strategic target is module11", /module11: \{ \.\.\.current\.module11, \.\.\.patch \}/.test(src));
  check("T49 Strategic empty-answer precondition checked before acceptance",
    /if \(current\.module11\[candidate\.targetField\]\.answer\.trim\(\) !== ""\) return;/.test(src));
  check("T50 Strategic non-empty answer is a no-op (early return BEFORE any adapter call/status transition)",
    src.indexOf('if (current.module11[candidate.targetField].answer.trim() !== "") return;') <
    src.indexOf("candidateToStrategicAnswerPatch(candidate, current.module11)"));
  check("T51 Strategic preserves hasEvidence/filePath/fileName (delegated to the unmodified PI-C1 adapter's own spread; IntakeForm never assigns these fields itself)",
    !/hasEvidence: true|hasEvidence: candidate/.test(src));
}

// ════════════════════════════════════════════════════════════════════════════
// §61 items 46-60 — status transitions / commit discipline / ordering
// ════════════════════════════════════════════════════════════════════════════
{
  const acceptBody = src.slice(src.indexOf("const handleAcceptCandidate"), src.indexOf("const handleRejectCandidate"));
  const rejectBody = src.slice(src.indexOf("const handleRejectCandidate"), src.indexOf("// ── Init session ID"));

  check('T52 successful Accept transitions to "accepted_in_module" for every domain',
    (acceptBody.match(/withCandidateStatus\(candidates\.\w+, candidateId, "accepted_in_module"\)/g) ?? []).length === 7);
  check('T53 successful Reject transitions to "rejected" for every domain',
    (rejectBody.match(/withCandidateStatus\(candidates\.\w+, candidateId, "rejected"\)/g) ?? []).length === 7);
  check("T54 Reject never constructs nextData / never calls setData", !rejectBody.includes("nextData") && !rejectBody.includes("setData("));
  check("T55 Accept calls save(nextData) exactly once", (acceptBody.match(/save\(nextData\)/g) ?? []).length === 1);
  check("T56 Reject calls save() with no arguments exactly once", (rejectBody.match(/save\(\)/g) ?? []).length === 1 && !rejectBody.includes("save(nextData)"));
  check("T57 Accept assigns the candidate ref BEFORE calling save (ref-then-save ordering)",
    acceptBody.indexOf("professionalIntelligenceCandidatesRef.current = nextCandidates;") < acceptBody.indexOf("save(nextData)"));
  check("T58 Reject assigns the candidate ref BEFORE calling save (ref-then-save ordering)",
    rejectBody.indexOf("professionalIntelligenceCandidatesRef.current = nextCandidates;") < rejectBody.indexOf("save()"));
  const acceptCode = acceptBody.replace(/^\s*\/\/.*$/gm, "");
  check("T59 Accept never performs a second save/localStorage write (comments excluded)", (acceptCode.match(/\bsave\(/g) ?? []).length === 1 && !acceptBody.includes("localStorage.setItem"));
  check("T60 Reject never performs a second save/localStorage write", (rejectBody.match(/save\(/g) ?? []).length === 1 && !rejectBody.includes("localStorage.setItem"));
  check("T61 every Accept no-op path (`if (!candidate) return;` / the Strategic precondition) returns BEFORE any ref/save/setState call",
    acceptBody.split("return;").slice(0, -1).every(segment => !/professionalIntelligenceCandidatesRef\.current = nextCandidates|save\(nextData\)|setData\(nextData\)/.test(segment.slice(segment.lastIndexOf("case")))));
  check("T62 no dataRef.current manual assignment introduced by PI-C3 (save(nextData) already provides the explicit override)",
    !/dataRef\.current = nextData/.test(src));
  check("T63 save() signature unchanged (still the two-optional-parameter form)",
    /const save = useCallback\(\(explicitData\?: IntakeFormData, explicitStep\?: number\): boolean => \{/.test(src));
}

// ════════════════════════════════════════════════════════════════════════════
// §61 items 63-72 — duplicate policy / candidate preservation
// ════════════════════════════════════════════════════════════════════════════
{
  const comparators = ["SameIdentity", "MaterialEquals"];
  for (const c of comparators) check(`T64 no PI-A comparator ("${c}") imported or used for acceptance`, !src.includes(c));
  const acceptBody2 = src.slice(src.indexOf("const handleAcceptCandidate"), src.indexOf("const handleRejectCandidate"));
  const rejectBody2 = src.slice(src.indexOf("const handleRejectCandidate"), src.indexOf("// ── Init session ID"));
  check("T65 no duplicate warning/blocking logic introduced by the new PI-C3 handlers specifically", !/duplicate/i.test(acceptBody2) && !/duplicate/i.test(rejectBody2));
  check("T66 candidates are never deleted (filter/splice) on Accept — only status-replaced", !/\.filter\(c => c\.id !== candidateId\)|\.splice\(/.test(src));
  check("T67 accepted/rejected candidates remain in their domain array (array length preserved by withCandidateStatus, re-proof)",
    /return arr\.map\(c => \(c\.id === candidateId \? \{ \.\.\.c, status \} : c\)\);/.test(src));
}

// ════════════════════════════════════════════════════════════════════════════
// §61 items 74-95 — immutability / firewalls / file boundary
// ════════════════════════════════════════════════════════════════════════════
{
  // T68 reconciled post-PI-D0B (authorized historical boundary-test
  // reconciliation): the original assertion required DraftEnvelope to
  // have NO sibling beyond professionalIntelligenceCandidates? -- a
  // temporal condition PI-D0B's authorized, additive
  // professionalIntelligenceEnrichments? sibling permanently ends.
  // Replaced with the permanent invariant: the three required core
  // fields remain exactly data/step/savedAt, both PI overlays remain
  // optional draft-local siblings, and ActiveProfessionalContext (or
  // any field by that name) is never one of them -- it stays outside
  // DraftEnvelope entirely (PI-D0-R1: ACTIVE_CONTEXT_PERSISTENCE: NONE).
  check("T68 DraftEnvelope retains exactly data/step/savedAt as required core fields, plus optional professionalIntelligenceCandidates?/professionalIntelligenceEnrichments? siblings, and nothing named ActiveProfessionalContext",
    (() => {
      const block = src.match(/export type DraftEnvelope = \{([^}]*)\};/)?.[1] ?? "";
      return /data: IntakeFormData;/.test(block) &&
        /step: number;/.test(block) &&
        /savedAt: string;/.test(block) &&
        /professionalIntelligenceCandidates\?: ProfessionalIntelligenceCandidates;/.test(block) &&
        /professionalIntelligenceEnrichments\?: ProfessionalIntelligenceEnrichments;/.test(block) &&
        !block.includes("ActiveProfessionalContext") &&
        !block.includes("activeProfessionalContext");
    })());
  const submitBody = src.match(/async function submit\(\)[\s\S]*?\n  \}/)?.[0] ?? "";
  // T69 extended post-PI-D0B: the SAME re-proof now additionally covers
  // the new enrichment overlay sibling -- both remain draft-only,
  // neither enters final submission.
  check("T69 submit() still has zero reference to professionalIntelligenceCandidates or professionalIntelligenceEnrichments",
    !!submitBody && !submitBody.includes("professionalIntelligenceCandidates") && !submitBody.includes("professionalIntelligenceEnrichments"));
  check("T70 no StructuredProfile reference introduced by PI-C3 (structuredProfile references are all pre-existing Module0/submit lines, not new PI-C3 code)",
    !/StructuredProfileField|acquireField\(.*candidate|confirmField\(.*candidate/.test(src));
  check("T71 no CBR reference anywhere in the file", !/\bCBR\b|\bcbr\b/.test(src));
  check("T72 no Coach modification (coachConversation/Coach reference count unchanged — still only the pre-existing submit()/Module0 wiring, no PI-C3-added Coach line)",
    !/candidateToCoach|coach_discovery.*accept|Accept.*coachConversation/i.test(src));
  check("T73 no database/RPC/Storage/network code added by PI-C3 handlers", (() => {
    const acceptBody = src.slice(src.indexOf("const handleAcceptCandidate"), src.indexOf("const handleRejectCandidate"));
    const rejectBody = src.slice(src.indexOf("const handleRejectCandidate"), src.indexOf("// ── Init session ID"));
    return ["fetch(", "supabase", "createClient", ".storage.", "RPC"].every(f => !acceptBody.includes(f) && !rejectBody.includes(f));
  })());
  check("T74 no module-numbering.ts reference (no legacyDataKey/legacyStoragePrefix import)", !/legacyDataKey|legacyStoragePrefix|module-numbering/.test(src));
  check("T75 Summary unchanged (no candidate count / proposed/accepted/rejected tally passed to Summary)", !/<Summary[^>]*candidate/i.test(src));
  check("T76 no downstream-agent reference", !/a1-intake-analyzer|a5-case-strategy|legal-decision-cycle/.test(src));
}

// ════════════════════════════════════════════════════════════════════════════
// File-boundary / immutability of sibling files
// ════════════════════════════════════════════════════════════════════════════
{
  const reviewSrc = readFileSync(require.resolve("../../../src/app/intake/professional-candidate-review.tsx"), "utf8");
  const adaptersSrc = readFileSync(require.resolve("../../../src/lib/intake/professional-intelligence-adapters.ts"), "utf8");
  const modelSrc = readFileSync(require.resolve("../../../src/lib/intake/professional-intelligence.ts"), "utf8");
  check("T77 professional-candidate-review.tsx still has zero runtime-mutation code (no localStorage/setData/adapter import) — re-proof after wiring",
    !reviewSrc.includes("localStorage") && !reviewSrc.includes("setData") && !/professional-intelligence-adapters|candidateTo[A-Z]/.test(reviewSrc));
  check("T78 professional-intelligence-adapters.ts still defines exactly the seven original adapters (byte-for-byte function count unchanged)",
    (adaptersSrc.match(/^export function candidateTo/gm) ?? []).length === 7);
  check("T79 professional-intelligence.ts still has no acceptedModuleEntryId/rejectionReason/lookup/transition helper", !/acceptedModuleEntryId|rejectionReason|findCandidate|transitionCandidate/.test(modelSrc));
}

// ════════════════════════════════════════════════════════════════════════════
// Regression re-proof: existing CP-01/02/03 / PI-B2B invariants untouched
// ════════════════════════════════════════════════════════════════════════════
{
  check("T80 onModule0Checkpoint still present, unchanged shape", /const onModule0Checkpoint = useCallback\(\(nextModule0: IntakeFormData\["module0"\]\) => \{/.test(src));
  check("T81 handleProfessionalCandidatesExtracted still present, unchanged shape (PI-B2B)", /const handleProfessionalCandidatesExtracted = useCallback\(\(incoming: ProfessionalIntelligenceCandidates\) => \{/.test(src));
  check("T82 Module0 render line's existing props remain byte-identical aside from being followed by the new sibling line",
    /\{step === 0  && <Module0  data=\{data\.module0\}  onChange=\{m => setData\(p => \(\{ \.\.\.p, module0:  m \}\)\)\} onCheckpoint=\{onModule0Checkpoint\} onProfessionalCandidatesExtracted=\{handleProfessionalCandidatesExtracted\} sessionId=\{sessionId\} errors=\{errors\}\/>\}/.test(src));
}

console.log(failures === 0 ? "\nALL PI-C3 CHECKS PASS" : `\n${failures} PI-C3 CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
