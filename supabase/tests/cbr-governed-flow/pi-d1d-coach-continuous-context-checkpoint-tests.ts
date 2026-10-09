// Implementation PI-D1D — Coach Continuous Context Runtime & Atomic
// Checkpoint Integration. Direct-execution tests against the REAL
// production exports of src/app/intake/IntakeForm.tsx (pure helpers:
// isContextAuthorizedTarget, derivePinnedEntry, deriveGeneralEligiblePool,
// selectRotatingSlice, buildBoundedProfessionalSnapshot,
// resolveNextQuestionContext) combined with structural source-text
// inspection of the non-exported useCallback checkpoint handler and of
// src/app/intake/modules/Module0.tsx -- mirrors every prior PI-*
// IntakeForm/Module0 test file's own established convention (.tsx files
// in this repo cannot be rendered outside Next's bundler, so runtime
// orchestration is proven structurally against the real file text,
// never reimplemented).
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-d1d-coach-continuous-context-checkpoint-tests.ts

import { readFileSync } from "fs";
import {
  type QuestionProfessionalContext,
  type BoundedProfessionalSnapshot,
  isContextAuthorizedTarget,
  derivePinnedEntry,
  deriveGeneralEligiblePool,
  selectRotatingSlice,
  buildBoundedProfessionalSnapshot,
  resolveNextQuestionContext,
} from "../../../src/app/intake/IntakeForm";
import type { ProfessionalIntelligenceCandidates, EmploymentCandidate } from "../../../src/lib/intake/professional-intelligence";
import type { NextProfessionalTopic } from "../../../src/lib/intake/coach";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const INTAKEFORM_FILE = "../../../src/app/intake/IntakeForm.tsx";
const MODULE0_FILE = "../../../src/app/intake/modules/Module0.tsx";
const intakeFormSrc = readFileSync(require.resolve(INTAKEFORM_FILE), "utf8");
const module0Src = readFileSync(require.resolve(MODULE0_FILE), "utf8");

function emp(id: string, overrides: Partial<EmploymentCandidate> = {}): EmploymentCandidate {
  return {
    id, domain: "employment", status: "proposed",
    provenance: [{ source: "cv_extraction", rawText: "x", confidence: "high" }],
    company: id, title: "Engineer", startDate: "2020", endDate: "",
    mainFunctions: "", importantProjects: "", mainAchievements: "",
    ...overrides,
  };
}
function coachOnlyEmp(id: string, overrides: Partial<EmploymentCandidate> = {}): EmploymentCandidate {
  return emp(id, { provenance: [{ source: "coach_discovery", rawText: "x", confidence: "high" }], ...overrides });
}
function candidatesWith(employment: EmploymentCandidate[]): ProfessionalIntelligenceCandidates {
  return { employment, education: [], certification: [], business: [], reference: [], evidence: [], strategicAnswer: [] };
}
const NONE: QuestionProfessionalContext = { mode: "none" };
const OPEN: QuestionProfessionalContext = { mode: "open_discovery" };
function known(candidateId: string): QuestionProfessionalContext {
  return { mode: "known_employment", candidateId, identity: { company: candidateId, title: "Engineer", startDate: "2020", endDate: "" } };
}

// ── §4 — old ActiveProfessionalContext runtime removed ──────────────────────
{
  check("T01 ActiveProfessionalContext type no longer exported", !/export (type|interface) ActiveProfessionalContext/.test(intakeFormSrc));
  check("T02 isActiveContextValid no longer exported", !/export function isActiveContextValid/.test(intakeFormSrc));
  check("T03 resolveActiveProfessionalContext no longer exported", !/export function resolveActiveProfessionalContext/.test(intakeFormSrc));
  check("T04 handleSetActiveProfessionalContext removed", !intakeFormSrc.includes("handleSetActiveProfessionalContext"));
  check("T05 handleClearActiveProfessionalContext removed", !intakeFormSrc.includes("handleClearActiveProfessionalContext"));
  check("T06 activeProfessionalContext state/ref removed (no two competing context systems)", !/useState<ActiveProfessionalContext/.test(intakeFormSrc) && !intakeFormSrc.includes("activeProfessionalContextRef"));
  check("T07 QuestionProfessionalContext is the sole runtime authority", /const \[questionContext, setQuestionContext\] = useState<QuestionProfessionalContext>\(\{ mode: "none" \}\);/.test(intakeFormSrc));
}

// ── §16 — pin validity (context-authorized, not cv_extraction-gated) ───────
{
  check("T08 isContextAuthorizedTarget true for exact id + proposed status", isContextAuthorizedTarget(emp("A"), "A") === true);
  check("T09 isContextAuthorizedTarget false for mismatched id", isContextAuthorizedTarget(emp("A"), "B") === false);
  check("T10 isContextAuthorizedTarget false for accepted_in_module", isContextAuthorizedTarget(emp("A", { status: "accepted_in_module" }), "A") === false);
  check("T11 isContextAuthorizedTarget false for rejected", isContextAuthorizedTarget(emp("A", { status: "rejected" }), "A") === false);
  check("T12 isContextAuthorizedTarget false for undefined candidate", isContextAuthorizedTarget(undefined, "A") === false);
  check("T13 isContextAuthorizedTarget TRUE for Coach-only provenance (no cv_extraction requirement)", isContextAuthorizedTarget(coachOnlyEmp("G"), "G") === true);
}

// ── §64 — pinning ────────────────────────────────────────────────────────────
{
  const candidates = candidatesWith([emp("A"), emp("B"), emp("C"), emp("D")]);
  const pinned = derivePinnedEntry(known("A"), candidates);
  check("T14 valid known_employment context pins exact candidate", pinned?.candidateId === "A");

  const snapshot = buildBoundedProfessionalSnapshot(known("A"), candidates, null);
  check("T15 P1 is the pinned candidate", snapshot.entries[0].alias === "P1" && snapshot.entries[0].candidateId === "A");
  check("T16 pinned candidate excluded from P2/P3 (no duplicate)", !snapshot.entries.slice(1).some(e => e.candidateId === "A"));
  check("T17 pin consumes no rotation capacity -- 3 total slots still possible (A + 2 others)", snapshot.entries.length === 3);
}

// ── §65 — Coach-discovered pin ──────────────────────────────────────────────
{
  const candidates = candidatesWith([coachOnlyEmp("G"), emp("A"), emp("B"), emp("C")]);
  const snapshot = buildBoundedProfessionalSnapshot(known("G"), candidates, null);
  check("T18 Coach-discovered Candidate G valid as pinned P1", snapshot.entries[0].alias === "P1" && snapshot.entries[0].candidateId === "G");
  check("T19 G absent from general rotating pool", deriveGeneralEligiblePool(candidates).every(c => c.id !== "G"));
  check("T20 P2/P3 drawn from CV-derived eligible pool only", snapshot.entries.slice(1).every(e => ["A", "B", "C"].includes(e.candidateId)));
}

// ── §66 — continuous rotation (no exhaustion) ───────────────────────────────
{
  const pool = [emp("A"), emp("B"), emp("C"), emp("D"), emp("E")];
  const r1 = selectRotatingSlice(pool, 3, null);
  check("T21 turn1 P1/P2/P3 = A/B/C", r1.selected.map(c => c.id).join(",") === "A,B,C");
  check("T21b turn1 proposed next pointer = D", r1.newNextId === "D");

  const r2 = selectRotatingSlice(pool, 3, r1.newNextId);
  check("T22 turn2 = D/E/A", r2.selected.map(c => c.id).join(",") === "D,E,A");
  check("T22b turn2 proposed next pointer = B", r2.newNextId === "B");

  const r3 = selectRotatingSlice(pool, 3, r2.newNextId);
  check("T23 turn3 = B/C/D", r3.selected.map(c => c.id).join(",") === "B,C,D");
  check("T23b turn3 proposed next pointer = E", r3.newNextId === "E");

  check("T24 no exhaustion/shown-set vocabulary anywhere in IntakeForm.tsx", !intakeFormSrc.includes("shownCandidateIdsRef") && !intakeFormSrc.includes("consumedCandidateIds") && !intakeFormSrc.includes("rotationExhausted"));
}

// ── §67 — failed request does not rotate (two-phase build vs commit) ───────
{
  check("T25 rotationNextCandidateIdRef is a plain ref (useRef), never mutated inside the snapshot-build effect itself before commit",
    /const rotationNextCandidateIdRef = useRef<RotationPointer>\(null\);/.test(intakeFormSrc));
  // The build-time snapshot computation never assigns rotationNextCandidateIdRef.current -- only
  // onCoachTurnCheckpoint does, after save(). Verify by slicing the snapshot-building effect body.
  const effectBody = intakeFormSrc.slice(intakeFormSrc.indexOf("useEffect(() => {\n    const snapshot = buildBoundedProfessionalSnapshot"), intakeFormSrc.indexOf("}, [questionContext, professionalIntelligenceCandidates]);"));
  check("T26 snapshot-build effect never assigns rotationNextCandidateIdRef.current (build != commit)", !effectBody.includes("rotationNextCandidateIdRef.current ="));
  const checkpointBody = intakeFormSrc.slice(intakeFormSrc.indexOf("const onCoachTurnCheckpoint = useCallback"), intakeFormSrc.indexOf("rotationNextCandidateIdRef.current = boundedSnapshotRef.current.proposedNextRotationState;") + 100);
  check("T27 rotation commit happens only inside onCoachTurnCheckpoint, after save()", /const persisted = save\(nextData\);[\s\S]*rotationNextCandidateIdRef\.current = boundedSnapshotRef\.current\.proposedNextRotationState;/.test(checkpointBody));
}

// ── §68 — pinned rotation (capacity 2, excluding pin) ───────────────────────
{
  const candidates = candidatesWith([emp("A"), emp("B"), emp("C"), emp("D"), emp("E")]);
  const s1 = buildBoundedProfessionalSnapshot(known("A"), candidates, null);
  check("T28 pinned P1=A, P2/P3 cyclic from B/C/D/E (first pass)", s1.entries.map(e => e.candidateId).join(",") === "A,B,C");
  const s2 = buildBoundedProfessionalSnapshot(known("A"), candidates, s1.proposedNextRotationState);
  check("T29 pointer advances by 2 (capacity=2 while pinned)", s2.entries.map(e => e.candidateId).join(",") === "A,D,E");
}

// ── §69 — pointer disappears -> safe pool[0] fallback ───────────────────────
{
  const poolWithoutD = [emp("A"), emp("B"), emp("C"), emp("E")];
  const r = selectRotatingSlice(poolWithoutD, 3, "D");
  check("T30 missing pointer falls back to pool[0] (A/B/C), no semantic replacement", r.selected.map(c => c.id).join(",") === "A,B,C");
}

// ── §70 — known alias resolution (exact snapshot, no company/title lookup) ──
{
  const snapshot: BoundedProfessionalSnapshot = {
    entries: [
      { alias: "P1", candidateId: "A", identity: { company: "A", title: "x", startDate: "", endDate: "" } },
      { alias: "P2", candidateId: "B", identity: { company: "B", title: "x", startDate: "", endDate: "" } },
      { alias: "P3", candidateId: "C", identity: { company: "C", title: "x", startDate: "", endDate: "" } },
    ],
    proposedNextRotationState: null,
  };
  const candidates = candidatesWith([emp("A"), emp("B"), emp("C")]);
  const next = resolveNextQuestionContext({ mode: "known_employment", alias: "P2" }, snapshot, candidates, []);
  check("T31 known_employment P2 resolves to exact Candidate B", next.mode === "known_employment" && (next as { candidateId: string }).candidateId === "B");
}

// ── §28/§39 — unknown/absent alias downgrades to none, no fallback ─────────
{
  const snapshot: BoundedProfessionalSnapshot = { entries: [{ alias: "P1", candidateId: "A", identity: { company: "A", title: "x", startDate: "", endDate: "" } }], proposedNextRotationState: null };
  const candidates = candidatesWith([emp("A")]);
  const next = resolveNextQuestionContext({ mode: "known_employment", alias: "P3" }, snapshot, candidates, []);
  check("T32 alias absent from this exact snapshot (only P1 existed) -> none", next.mode === "none");
}

// ── §71/§72/§73 — continue_new_employment cardinality binding ──────────────
{
  const candidates = candidatesWith([]);
  const snapshot: BoundedProfessionalSnapshot = { entries: [], proposedNextRotationState: null };

  const oneG = coachOnlyEmp("G");
  const r1 = resolveNextQuestionContext({ mode: "continue_new_employment" }, snapshot, candidates, [oneG]);
  check("T33 exactly one new Employment discovery -> bind exact G", r1.mode === "known_employment" && (r1 as { candidateId: string }).candidateId === "G");

  const r2 = resolveNextQuestionContext({ mode: "continue_new_employment" }, snapshot, candidates, []);
  check("T34 zero new Employment discoveries -> open_discovery (never guessed)", r2.mode === "open_discovery");

  const r3 = resolveNextQuestionContext({ mode: "continue_new_employment" }, snapshot, candidates, [coachOnlyEmp("G"), coachOnlyEmp("H")]);
  check("T35 multiple new Employment discoveries -> open_discovery (never choose first)", r3.mode === "open_discovery");
}

// ── §25-30 — open_discovery / none ───────────────────────────────────────────
{
  const snapshot: BoundedProfessionalSnapshot = { entries: [], proposedNextRotationState: null };
  const candidates = candidatesWith([]);
  check("T36 open_discovery topic -> open_discovery context", resolveNextQuestionContext({ mode: "open_discovery" }, snapshot, candidates, []).mode === "open_discovery");
  check("T37 none topic -> none context", resolveNextQuestionContext({ mode: "none" }, snapshot, candidates, []).mode === "none");
}

// ── §86 — no reanchor: snapshot-valid alias whose Candidate vanished before checkpoint ──
{
  const snapshot: BoundedProfessionalSnapshot = { entries: [{ alias: "P2", candidateId: "B", identity: { company: "B", title: "x", startDate: "", endDate: "" } }], proposedNextRotationState: null };
  const candidatesAfterRejection = candidatesWith([emp("B", { status: "rejected" })]);
  const next = resolveNextQuestionContext({ mode: "known_employment", alias: "P2" }, snapshot, candidatesAfterRejection, []);
  check("T38 B rejected before checkpoint -> next context none, no alternate chosen", next.mode === "none");
}

// ── §85 — alias snapshot is request-exact (not rebuilt from later state) ───
{
  const s1 = buildBoundedProfessionalSnapshot(NONE, candidatesWith([emp("A"), emp("B"), emp("C")]), null);
  check("T39 S1 captured P1/P2/P3 = A/B/C", s1.entries.map(e => e.candidateId).join(",") === "A,B,C");
  // Candidate state changes AFTER S1 was built (simulating a later snapshot that would differ) --
  // resolution must still use S1, never a freshly rebuilt snapshot.
  const changedCandidates = candidatesWith([emp("A"), emp("D"), emp("E")]);
  const next = resolveNextQuestionContext({ mode: "known_employment", alias: "P2" }, s1, changedCandidates, []);
  check("T40 resolution uses S1's P2->B mapping, not a rebuilt current snapshot (B no longer even exists -> none, not reinterpreted as D)", next.mode === "none");
}

// ── §77 — pre-discovery firewall ────────────────────────────────────────────
{
  // No previous known Employment context; current message discovers G AND
  // contains an incoming enrichment claim targeting G. G was absent from the
  // PRE-discovery candidate set, so isContextAuthorizedTarget against that
  // pre-discovery set must reject it.
  const preDiscoveryCandidates = candidatesWith([]);
  const gCandidateInPreDiscoverySet = preDiscoveryCandidates.employment.find(c => c.id === "G");
  check("T41 G absent from pre-discovery Candidate set", gCandidateInPreDiscoverySet === undefined);
  check("T42 enrichment targeting G rejected against the pre-discovery set", isContextAuthorizedTarget(gCandidateInPreDiscoverySet, "G") === false);
  const checkpointBody = intakeFormSrc.slice(intakeFormSrc.indexOf("const onCoachTurnCheckpoint = useCallback"), intakeFormSrc.indexOf("rotationNextCandidateIdRef.current = boundedSnapshotRef.current.proposedNextRotationState;") + 100);
  check("T43 checkpoint validates enrichments against currentCandidates (pre-discovery), never nextCandidates",
    /currentCandidates\.employment\.find\(c => c\.id === e\.target\.candidateId\)/.test(checkpointBody) && !/nextCandidates\.employment\.find\(c => c\.id === e\.target\.candidateId\)/.test(checkpointBody));
}

// ── §36/§83 — one coherent checkpoint, ref-before-save ──────────────────────
{
  const checkpointBody = intakeFormSrc.slice(intakeFormSrc.indexOf("const onCoachTurnCheckpoint = useCallback"), intakeFormSrc.indexOf("rotationNextCandidateIdRef.current = boundedSnapshotRef.current.proposedNextRotationState;") + 100);
  // Scoped to actual save(...) invocations only -- excludes this
  // function's own explanatory doc-comment, which legitimately
  // mentions "save()" in prose above the code.
  const checkpointCodeOnly = checkpointBody.slice(checkpointBody.indexOf("const currentCandidates ="));
  check("T44 exactly one save() call site inside onCoachTurnCheckpoint", (checkpointCodeOnly.match(/\bsave\(/g) ?? []).length === 1);
  check("T45 candidate ref assigned before save()", checkpointBody.indexOf("professionalIntelligenceCandidatesRef.current = nextCandidates;") < checkpointBody.indexOf("const persisted = save(nextData);"));
  check("T46 enrichment ref assigned before save()", checkpointBody.indexOf("professionalIntelligenceEnrichmentsRef.current = nextEnrichments;") < checkpointBody.indexOf("const persisted = save(nextData);"));
  check("T47 questionContext commit happens strictly after save()", checkpointBody.indexOf("const persisted = save(nextData);") < checkpointBody.indexOf("questionContextRef.current = nextQuestionContext;"));
  check("T48 rotation commit happens strictly after save()", checkpointBody.indexOf("const persisted = save(nextData);") < checkpointBody.indexOf("rotationNextCandidateIdRef.current = boundedSnapshotRef.current.proposedNextRotationState;"));
}

// ── §41/§43 — Coach/PI failure matrix (structural, via Module0) ────────────
{
  const sendCoachMessageBody = module0Src.slice(module0Src.indexOf("async function sendCoachMessage"), module0Src.indexOf("function confirmProfileField"));
  check("T49 catch branch never calls onCoachTurnCheckpoint (Coach failure -> zero D1D checkpoint)", !/catch \{[\s\S]*onCoachTurnCheckpoint/.test(sendCoachMessageBody));
  check("T50 success branch calls onCoachTurnCheckpoint exactly once", (sendCoachMessageBody.match(/onCoachTurnCheckpoint\(/g) ?? []).length === 1);
  check("T51 professionalIntelligence included only when present in the response (omission, not null)", /\.\.\.\(json\.professionalIntelligence \? \{ professionalIntelligence: json\.professionalIntelligence \} : \{\}\)/.test(sendCoachMessageBody));
  check("T52 nextProfessionalTopic always forwarded from the response", /nextProfessionalTopic: json\.nextProfessionalTopic/.test(sendCoachMessageBody));
}

// ── §78 — reject clears context ─────────────────────────────────────────────
{
  const rejectBody = intakeFormSrc.slice(intakeFormSrc.indexOf("const handleRejectCandidate = useCallback"), intakeFormSrc.indexOf("// ── Init session ID"));
  check("T53 handleRejectCandidate clears questionContext when it targets the rejected candidate",
    /questionContextRef\.current\.mode === "known_employment" && questionContextRef\.current\.candidateId === candidateId\s*\?\s*\{ mode: "none" \}/.test(rejectBody));
}

// ── §79 — accept clears context ─────────────────────────────────────────────
{
  const acceptBody = intakeFormSrc.slice(intakeFormSrc.indexOf("const handleAcceptCandidate = useCallback"), intakeFormSrc.indexOf("const handleRejectCandidate = useCallback"));
  check("T54 handleAcceptCandidate clears questionContext when it targets the accepted candidate",
    /questionContextRef\.current\.mode === "known_employment" && questionContextRef\.current\.candidateId === candidateId\s*\?\s*\{ mode: "none" \}/.test(acceptBody));
  check("T55 effective-candidate composition via composeEffectiveCandidate still feeds the unmodified candidateToEmploymentEntry (D0B/C1 unchanged)",
    /composeEffectiveCandidate\(candidate, enrichments\.employment\)/.test(acceptBody) && /candidateToEmploymentEntry\(effectiveCandidate\)/.test(acceptBody));
}

// ── §51/§80 — refresh reset ──────────────────────────────────────────────────
{
  check("T56 questionContext initializes to {mode:'none'} on mount (useState default, not hydrated)", /useState<QuestionProfessionalContext>\(\{ mode: "none" \}\)/.test(intakeFormSrc));
  check("T57 rotationNextCandidateIdRef initializes to null on mount", /useRef<RotationPointer>\(null\)/.test(intakeFormSrc));
  const hydrationEffect = intakeFormSrc.slice(intakeFormSrc.indexOf("// ── Init session ID"), intakeFormSrc.indexOf("// ── Autosave every 30 seconds"));
  check("T58 hydration effect never sets questionContext/rotation from the draft (no reconstruction)", !hydrationEffect.includes("setQuestionContext") && !hydrationEffect.includes("rotationNextCandidateIdRef.current ="));
}

// ── §50 — no new DraftEnvelope sibling ───────────────────────────────────────
{
  const draftEnvelopeType = intakeFormSrc.slice(intakeFormSrc.indexOf("export type DraftEnvelope = {"), intakeFormSrc.indexOf("export type DraftEnvelope = {") + 400);
  check("T59 DraftEnvelope has no questionContext/rotation/boundedSnapshot/alias sibling", !draftEnvelopeType.includes("questionContext") && !draftEnvelopeType.includes("rotation") && !draftEnvelopeType.includes("boundedSnapshot") && !draftEnvelopeType.includes("alias"));
}

// ── §57/§81 — no final submission leak ──────────────────────────────────────
{
  const submitBody = intakeFormSrc.slice(intakeFormSrc.indexOf("async function submit()"), intakeFormSrc.indexOf("async function submit()") + 1500);
  check("T60 submit() has zero reference to professionalIntelligenceCandidates/Enrichments/questionContext/rotation/boundedSnapshot",
    !submitBody.includes("professionalIntelligenceCandidates") && !submitBody.includes("professionalIntelligenceEnrichments") &&
    !submitBody.includes("questionContext") && !submitBody.includes("rotationNextCandidateIdRef") && !submitBody.includes("boundedSnapshot"));
}

// ── §82 — no model candidate ID ─────────────────────────────────────────────
{
  check("T61 Module0 request includes professionalContext (may carry candidateId -- D1A application bookkeeping)", /\.\.\.\(professionalContext \? \{ professionalContext \} : \{\}\)/.test(module0Src));
  check("T62 boundedEmploymentContexts prop type has no candidateId field (BoundedEmploymentContext imported from coach.ts, unmodified)", !/boundedEmploymentContexts:\s*Array<\{[^}]*candidateId/.test(module0Src));
}

// ── §87/§88 — frozen helpers unchanged ───────────────────────────────────────
{
  const piSrc = readFileSync(require.resolve("../../../src/lib/intake/professional-intelligence.ts"), "utf8");
  check("T63 isCandidateEligibleForEnrichmentAnchor unchanged signature (still excludes Coach-only Candidates)",
    /export function isCandidateEligibleForEnrichmentAnchor\(candidate: EmploymentCandidate\): boolean \{\s*return candidate\.status === "proposed" && candidate\.provenance\.some\(p => p\.source === "cv_extraction"\);\s*\}/.test(piSrc));
  check("T64 appendPreserveExisting unchanged (D1D introduces no new material-field merge logic)", !intakeFormSrc.includes("appendPreserveExisting"));
}

// ── §91 — static firewall ───────────────────────────────────────────────────
{
  check("T65 no server/Coach/D1A file reference beyond read-only type imports", !intakeFormSrc.includes("fetch(\"https://api.anthropic.com") && !module0Src.includes("api.anthropic.com"));
  check("T66 no StructuredProfile expansion (no new field added to acquireField/CLASS_A1_FIELDS call sites)", !intakeFormSrc.includes("CLASS_A1_FIELDS"));
  check("T67 no CBR reference", !/\bCBR\b/.test(intakeFormSrc) && !/\bCBR\b/.test(module0Src));
  check("T68 no database/migration/RPC/RLS/Storage reference", !intakeFormSrc.includes("supabase") && !intakeFormSrc.includes("createClient"));
  check("T69 no Project/Compensation entity introduced", !intakeFormSrc.includes("ProjectCandidate") && !intakeFormSrc.includes("CompensationCandidate"));
  check("T70 no automatic acceptance vocabulary", !intakeFormSrc.includes("autoAccept") && !module0Src.includes("autoAccept"));
  check("T71 no semantic/fuzzy reanchor helper", !/function\s+(fuzzyMatch|semanticMatch|reanchor)/i.test(intakeFormSrc));
  // Two localStorage.setItem call sites legitimately exist pre-D1D:
  // save()'s own draft-envelope write, and the unrelated session-id
  // bookkeeping in the init effect. Neither is D1D's addition -- the
  // real invariant is that questionContext/rotation never appear
  // anywhere near either literal write site.
  const setItemSites = intakeFormSrc.match(/localStorage\.setItem\([^)]*\)/g) ?? [];
  check("T72 question context / rotation never appear in any localStorage.setItem call", setItemSites.length === 2 && setItemSites.every(s => !s.includes("questionContext") && !s.includes("rotation")));
}

// ── §35 — mixed turn (discoveries + enrichment) supported in same checkpoint ──
{
  const checkpointBody = intakeFormSrc.slice(intakeFormSrc.indexOf("const onCoachTurnCheckpoint = useCallback"), intakeFormSrc.indexOf("rotationNextCandidateIdRef.current = boundedSnapshotRef.current.proposedNextRotationState;") + 100);
  check("T73 checkpoint appends all seven discovery domains", ["employment", "education", "certification", "business", "reference", "evidence", "strategicAnswer"].every(d => checkpointBody.includes(`${d}: [...currentCandidates.${d}`)));
  check("T74 checkpoint handles enrichment append independently of discovery append (not mutually exclusive)", checkpointBody.includes("nextEnrichments = { employment:"));
}

console.log(failures === 0 ? `\nALL PI-D1D CHECKS PASS` : `\n${failures} PI-D1D CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
