// Implementation PI-D0B — Enrichment Review + IntakeForm Runtime
// Acceptance. Non-database, non-network, non-LLM tests against the REAL
// production exports of src/app/intake/IntakeForm.tsx (imported by path
// where the export is a plain, non-JSX function; proven by source-text
// inspection where it is not -- mirrors pi-b2a/pi-b2b/pi-c3's own
// established convention for this file) and structural proofs against
// src/app/intake/professional-candidate-review.tsx (mirrors pi-c2's own
// established convention for that file).
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-d0b-enrichment-review-intakeform-runtime-tests.ts

import { readFileSync } from "fs";
import {
  parseDraftEnvelope,
  isContextAuthorizedTarget,
  deriveGeneralEligiblePool,
} from "../../../src/app/intake/IntakeForm";
import {
  emptyProfessionalIntelligenceCandidates,
  type ProfessionalIntelligenceCandidates,
  type EmploymentCandidate,
  type CandidateProvenance,
} from "../../../src/lib/intake/professional-intelligence";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const INTAKEFORM_FILE = "../../../src/app/intake/IntakeForm.tsx";
const REVIEW_FILE = "../../../src/app/intake/professional-candidate-review.tsx";
const src = readFileSync(require.resolve(INTAKEFORM_FILE), "utf8");
const reviewSrc = readFileSync(require.resolve(REVIEW_FILE), "utf8");
const code = src.replace(/^\s*\/\/.*$/gm, "");

const prov = (source: "cv_extraction" | "coach_discovery" = "cv_extraction"): CandidateProvenance =>
  ({ source, rawText: "x", confidence: "high" });

function emp(id: string, overrides: Partial<EmploymentCandidate> = {}): EmploymentCandidate {
  return {
    id, domain: "employment", status: "proposed", provenance: [prov()],
    company: "Expedia", title: "Software Engineer", startDate: "2022-01", endDate: "2024-01",
    mainFunctions: "", importantProjects: "", mainAchievements: "",
    ...overrides,
  };
}

function candidatesWith(employment: EmploymentCandidate[]): ProfessionalIntelligenceCandidates {
  return { ...emptyProfessionalIntelligenceCandidates(), employment };
}

// ════════════════════════════════════════════════════════════════════════════
// §36 — DraftEnvelope / hydration tests
// ════════════════════════════════════════════════════════════════════════════
{
  // T01 reconciled (PI-D1D-R1): ActiveProfessionalContext (D0B) is
  // superseded by QuestionProfessionalContext (D1D) -- the permanent
  // invariant this test protects (no context-of-any-kind lives in the
  // persisted envelope) now also covers rotation/bounded-snapshot state.
  check("T01 DraftEnvelope type does NOT include any question-context/rotation/alias sibling (ActiveProfessionalContext, then QuestionProfessionalContext, now both superseded)",
    !/export type DraftEnvelope = \{[^}]*(ActiveProfessionalContext|QuestionProfessionalContext|RotationPointer|BoundedProfessionalSnapshot)[^}]*\};/.test(src));
  check("T02 DraftEnvelope includes optional professionalIntelligenceEnrichments sibling",
    /export type DraftEnvelope = \{[\s\S]*?professionalIntelligenceEnrichments\?: ProfessionalIntelligenceEnrichments;[\s\S]*?\};/.test(src));

  // Old draft without enrichment sibling (pre-PI-D0B envelope shape)
  const oldEnvelope = JSON.stringify({ data: { module1: { fullName: "Z" } }, step: 2, savedAt: "x" });
  const oldResult = parseDraftEnvelope(oldEnvelope, 14);
  check("T03 old draft without enrichment sibling hydrates safely (empty enrichment overlay)",
    oldResult.professionalIntelligenceEnrichments.employment.length === 0);
  check("T04 old draft's candidate overlay hydration unchanged (still empty, not broken by the new field)",
    oldResult.professionalIntelligenceCandidates.employment.length === 0);
  check("T05 old draft's IntakeFormData path still hydrates correctly", (oldResult.saved as { module1?: { fullName?: string } }).module1?.fullName === "Z");

  // Valid enrichment sibling
  const validEnvelope = JSON.stringify({
    data: {}, step: 0, savedAt: "x",
    professionalIntelligenceEnrichments: { employment: [{ id: "e1", target: { domain: "employment", candidateId: "c1" }, status: "proposed", provenance: [], patch: {} }] },
  });
  const validResult = parseDraftEnvelope(validEnvelope, 14);
  check("T06 valid enrichment sibling hydrates", validResult.professionalIntelligenceEnrichments.employment.length === 1);

  // Malformed enrichment sibling
  const malformedEnvelope = JSON.stringify({ data: { module1: { fullName: "OK" } }, step: 0, savedAt: "x", professionalIntelligenceEnrichments: "not-an-object" });
  const malformedResult = parseDraftEnvelope(malformedEnvelope, 14);
  check("T07 malformed enrichment sibling resets only the enrichment overlay (to empty)", malformedResult.professionalIntelligenceEnrichments.employment.length === 0);
  check("T08 malformed enrichment sibling does not affect IntakeFormData hydration", (malformedResult.saved as { module1?: { fullName?: string } }).module1?.fullName === "OK");

  check("T09 save() envelope construction includes professionalIntelligenceEnrichments: professionalIntelligenceEnrichmentsRef.current",
    /professionalIntelligenceEnrichments: professionalIntelligenceEnrichmentsRef\.current,/.test(src));

  const submitBody = src.match(/async function submit\(\)[\s\S]*?\n  \}/)?.[0] ?? "";
  check("T10 final submission (submit()) still has zero reference to professionalIntelligenceEnrichments", !!submitBody && !submitBody.includes("professionalIntelligenceEnrichments"));
  // T11 reconciled: activeProfessionalContext (D0B) -> questionContext/
  // rotationNextCandidateIdRef/boundedSnapshotRef (D1D) -- same permanent
  // invariant (no transient professional-context runtime of any kind
  // ever reaches final submission), updated vocabulary.
  check("T11 final submission still has zero reference to questionContext/rotationNextCandidateIdRef/boundedSnapshotRef",
    !!submitBody && !submitBody.includes("questionContext") && !submitBody.includes("rotationNextCandidateIdRef") && !submitBody.includes("boundedSnapshotRef"));
  check("T12 final submission still has zero reference to professionalIntelligenceCandidates (re-proof)", !!submitBody && !submitBody.includes("professionalIntelligenceCandidates"));
}

// ════════════════════════════════════════════════════════════════════════════
// §42 reconciled (PI-D1D-R1): isContextAuthorizedTarget (pin validity) vs.
// deriveGeneralEligiblePool/isCandidateEligibleForEnrichmentAnchor (general
// rotation-pool eligibility) are two DELIBERATELY DIFFERENT, separately
// governed predicates after D1D -- never conflated. Pin validity requires
// ONLY exact candidateId match + status==="proposed" (PI-D1-R3 §16: no
// cv_extraction requirement, because a safely-bound Coach-discovered
// Candidate must remain pinnable). General-pool eligibility reuses the
// byte-unchanged PI-D0A helper, which DOES still require cv_extraction
// provenance -- that stricter boundary is explicitly re-proven below,
// never broadened.
// ════════════════════════════════════════════════════════════════════════════
{
  const cvOnly = emp("c1", { provenance: [prov("cv_extraction")] });
  const cvAndCoach = emp("c2", { provenance: [prov("cv_extraction"), prov("coach_discovery")] });
  const coachOnly = emp("c3", { provenance: [prov("coach_discovery")] });
  const rejected = emp("c4", { provenance: [prov("cv_extraction")], status: "rejected" });
  const accepted = emp("c5", { provenance: [prov("cv_extraction")], status: "accepted_in_module" });

  // Pin validity (isContextAuthorizedTarget) -- status + exact id ONLY.
  check("T13 context-authorized pin valid: CV-only proposed Employment", isContextAuthorizedTarget(cvOnly, "c1") === true);
  check("T14 context-authorized pin valid: CV+Coach proposed Employment", isContextAuthorizedTarget(cvAndCoach, "c2") === true);
  check("T15 context-authorized pin ALSO valid for Coach-ONLY proposed Employment (PI-D1-R3 correction -- no cv_extraction requirement for a safely-bound pin; this is the one genuine architectural change D1D makes to this file's pre-existing boundary)",
    isContextAuthorizedTarget(coachOnly, "c3") === true);
  check("T16 context-authorized pin invalid: rejected candidate", isContextAuthorizedTarget(rejected, "c4") === false);
  check("T17 context-authorized pin invalid: accepted_in_module candidate", isContextAuthorizedTarget(accepted, "c5") === false);
  check("T18 context-authorized pin invalid: mismatched candidateId", isContextAuthorizedTarget(cvOnly, "nope") === false);
  check("T20b context-authorized pin invalid: candidate undefined (target no longer resolves)", isContextAuthorizedTarget(undefined, "c1") === false);

  // General rotation-pool eligibility -- STRICTER, unchanged D0A boundary.
  const pool = deriveGeneralEligiblePool(candidatesWith([cvOnly, cvAndCoach, coachOnly, rejected, accepted]));
  check("T19 general pool includes CV-only AND CV+Coach proposed Employment", pool.some(c => c.id === "c1") && pool.some(c => c.id === "c2"));
  check("T21 general pool still EXCLUDES Coach-only Employment (unchanged D0A boundary, never broadened by D1D)", !pool.some(c => c.id === "c3"));
  check("T22 general pool excludes rejected", !pool.some(c => c.id === "c4"));
  check("T23 general pool excludes accepted_in_module", !pool.some(c => c.id === "c5"));
}

// ════════════════════════════════════════════════════════════════════════════
// §42 reconciled (PI-D1D-R1): QuestionProfessionalContext ownership/
// orchestration. D1D removed the manual-selection handlers
// (handleSetActiveProfessionalContext/handleClearActiveProfessionalContext)
// entirely -- the Owner's R2/R3 clarification supersedes beneficiary/
// manual/global context selection outright, so there is no successor
// handler to test directly; the permanent invariant those two handlers
// protected ("exactly one context authoritative at a time, correctly
// established/cleared") is now proven against the actual sole
// authority: onCoachTurnCheckpoint (establishes, via
// resolveNextQuestionContext) and the base Accept/Reject handlers
// (clear, to the canonical {mode:"none"} representation).
// ════════════════════════════════════════════════════════════════════════════
{
  check("T24 QuestionProfessionalContext state/ref declared in IntakeForm (ownership)",
    /const \[questionContext, setQuestionContext\] = useState<QuestionProfessionalContext>\(\{ mode: "none" \}\);/.test(src));
  check("T25 only one context exists at a time (state type is QuestionProfessionalContext, a discriminated union value, never an array)",
    /useState<QuestionProfessionalContext>/.test(src) && !/QuestionProfessionalContext\[\]/.test(src));
  // T26 reconciled: the manual-set handler is gone by design (Owner's
  // R2/R3 clarification) -- the sole production path that establishes a
  // NEW questionContext is onCoachTurnCheckpoint, via
  // resolveNextQuestionContext (replacing resolveActiveProfessionalContext).
  const checkpointBody = src.slice(src.indexOf("const onCoachTurnCheckpoint = useCallback"), src.indexOf("const handleProfessionalCandidatesExtracted = useCallback"));
  check("T26 onCoachTurnCheckpoint establishes the next context via resolveNextQuestionContext (sole production authority, no manual-set handler exists anymore)",
    /const nextQuestionContext = resolveNextQuestionContext\(/.test(checkpointBody));
  // T27 reconciled: the manual-clear handler is gone by design -- {mode:
  // "none"} (never a bare null) is now the canonical cleared
  // representation, explicit at every clearing call site.
  check("T27 {mode:\"none\"} is the canonical cleared representation (no bare null anywhere in the context type)",
    !/QuestionProfessionalContext[\s\S]{0,300}null/.test(src.slice(src.indexOf("export type QuestionProfessionalContext"), src.indexOf("export type QuestionProfessionalContext") + 400)));

  const acceptBody = src.slice(src.indexOf("const handleAcceptCandidate"), src.indexOf("const handleRejectCandidate"));
  const rejectBody = src.slice(src.indexOf("const handleRejectCandidate ="), src.indexOf("// ── Init session ID"));
  check("T28 base Accept clears matching question context (checks questionContextRef.current.candidateId === candidateId, mode known_employment)",
    /questionContextRef\.current\.mode === "known_employment" && questionContextRef\.current\.candidateId === candidateId\s*\?\s*\{ mode: "none" \}/.test(acceptBody));
  check("T29 base Reject clears matching question context (same pattern)",
    /questionContextRef\.current\.mode === "known_employment" && questionContextRef\.current\.candidateId === candidateId\s*\?\s*\{ mode: "none" \}/.test(rejectBody));
  check("T30 CV re-extraction clears question context when target no longer resolves to a context-authorized candidate",
    /if \(!isContextAuthorizedTarget\(candidate, current\.candidateId\)\) \{\s*questionContextRef\.current = \{ mode: "none" \};\s*setQuestionContext\(\{ mode: "none" \}\);/.test(code));
  check("T31 no semantic/fuzzy re-anchor anywhere (no company/title-based context lookup)",
    !/questionContext[\s\S]{0,200}\.company ===|questionContext[\s\S]{0,200}\.title ===/.test(src));

  check("T32 question context is never written into save()'s envelope (not part of DraftEnvelope construction)",
    !/const envelope: DraftEnvelope = \{[^}]*questionContext[^}]*\};/.test(src));
  check("T33 the questionContext ref/state is never sent to any fetch/API call in this file (candidateId reaches the wire ONLY via the already-authorized D1B professionalContext field, never the raw ref/state itself)",
    !/fetch\([^)]*questionContextRef/.test(src) && !/fetch\([^)]*\bquestionContext\b/.test(src));

  const enrichAcceptBody = src.slice(src.indexOf("const handleAcceptEnrichment"), src.indexOf("const handleRejectEnrichment"));
  const enrichRejectBody = src.slice(src.indexOf("const handleRejectEnrichment"), src.indexOf("const handleAcceptCandidate"));
  check("T34 enrichment Accept does not touch question context at all (orthogonal, unchanged D0B/D-PI-D-R1 behavior)", !enrichAcceptBody.includes("questionContext") && !enrichAcceptBody.includes("QuestionContext"));
  check("T35 enrichment Reject does not touch question context at all", !enrichRejectBody.includes("questionContext") && !enrichRejectBody.includes("QuestionContext"));
}

// ════════════════════════════════════════════════════════════════════════════
// §37/§38/§17 — enrichment Accept/Reject handler structural proofs
// ════════════════════════════════════════════════════════════════════════════
{
  const acceptBody = src.slice(src.indexOf("const handleAcceptEnrichment"), src.indexOf("const handleRejectEnrichment"));
  check("T36 missing enrichment -> no-op (if (!enrichment) return;)", /if \(!enrichment\) return;/.test(acceptBody));
  check("T37 non-proposed enrichment -> no-op (covers already-accepted and already-rejected)", /if \(enrichment\.status !== "proposed"\) return;/.test(acceptBody));
  check("T38 wrong-domain target -> no-op", /if \(enrichment\.target\.domain !== "employment"\) return;/.test(acceptBody));
  // T39/T41 updated for E2 (PI Employment Enrichment Post-Base-Acceptance
  // Materialization): the target-candidate-missing check and the
  // pre-base eligibility check are no longer one combined expression --
  // E2's shared top-level flow (gate §7) separates "candidate exists" from
  // "candidate is eligible for THIS path", since eligibility now differs
  // by targetCandidate.status (Path A vs Path B). The blank-patch check is
  // now the E1 shared helper (hasNonBlankEmploymentEnrichmentPatch),
  // consumed once before the path split rather than an inline duplicate
  // expression -- this is the authorized "helper extraction" exception to
  // "do not change existing Path A tests" (E2 gate §8).
  check("T39 missing target candidate -> no-op (now a standalone check, independent of eligibility)",
    /if \(!targetCandidate\) return;/.test(acceptBody));
  check("T40 ineligible target (covers Coach-only/rejected) -> no-op via isCandidateEligibleForEnrichmentAnchor reuse, now scoped inside the Path A branch", acceptBody.includes("isCandidateEligibleForEnrichmentAnchor(targetCandidate)"));
  check("T41 blank-patch validation now delegates to the E1 shared pure helper (hasNonBlankEmploymentEnrichmentPatch), checked once before the Path A/B split",
    /if \(!hasNonBlankEmploymentEnrichmentPatch\(enrichment\.patch\)\) return;/.test(acceptBody));
  check("T41b no independently-maintained inline duplicate of the blank-patch expression remains in the handler", !acceptBody.includes("hasNonblankField"));
  check("T42 valid proposed enrichment -> status becomes \"accepted\" via position-preserving .map()",
    /employment: enrichments\.employment\.map\(e => \(e\.id === enrichmentId \? \{ \.\.\.e, status: "accepted" \} : e\)\)/.test(acceptBody));

  // T43/T44 reconciled for E2: the ORIGINAL protective claim ("enrichment
  // Accept never touches module data / calls save() with no explicit
  // argument") is now true of PATH A specifically, not the handler as a
  // whole -- Path B is a new, separately authorized branch that
  // intentionally patches module7.employment and calls save(nextData).
  // Re-scoped to the Path A branch body only so the original guarantee
  // for the EXISTING, frozen pre-base path is still exactly re-proven.
  const pathABody = acceptBody.slice(acceptBody.indexOf('if (targetCandidate.status === "proposed")'), acceptBody.indexOf('if (targetCandidate.status === "accepted_in_module")'));
  const pathACode = pathABody.replace(/^\s*\/\/.*$/gm, "");
  check("T43 Path A never references module data (no nextData/dataRef.current mutation) -- re-scoped, original guarantee preserved for the unchanged pre-base path",
    !pathACode.includes("nextData") && !pathACode.includes("dataRef.current"));
  check("T44 Path A calls save() exactly once, with no explicit data argument (module data unchanged) -- re-scoped, original guarantee preserved",
    (pathACode.match(/\bsave\(\)/g) ?? []).length === 1 && !pathACode.includes("save(nextData)"));
  check("T45 Path A ref assigned before save (ref-then-save ordering, unchanged)",
    acceptBody.indexOf("professionalIntelligenceEnrichmentsRef.current = nextEnrichments;") < acceptBody.indexOf("save()"));
  check("T46 no acceptedAt anywhere in the enrichment Accept handler", !acceptBody.includes("acceptedAt"));

  const rejectBody = src.slice(src.indexOf("const handleRejectEnrichment"), src.indexOf("const handleAcceptCandidate"));
  check("T47 missing enrichment -> no-op (Reject)", /if \(!enrichment\) return;/.test(rejectBody));
  check("T48 non-proposed enrichment -> no-op (Reject)", /if \(enrichment\.status !== "proposed"\) return;/.test(rejectBody));
  check("T49 valid proposed enrichment -> status becomes \"rejected\" via position-preserving .map()",
    /employment: enrichments\.employment\.map\(e => \(e\.id === enrichmentId \? \{ \.\.\.e, status: "rejected" \} : e\)\)/.test(rejectBody));
  check("T50 enrichment Reject calls save() exactly once with no explicit data argument", (rejectBody.replace(/^\s*\/\/.*$/gm, "").match(/\bsave\(\)/g) ?? []).length === 1);
}

// ════════════════════════════════════════════════════════════════════════════
// E2 — POST-BASE HANDLER BRANCH (PI Employment Enrichment Post-Base-
// Acceptance Materialization, Exact Design R1). handleAcceptEnrichment is
// a useCallback closure, not independently importable/invokable without
// mounting the full component (same constraint pi-d0b's own pre-existing
// T36-T50 already accepted) -- so, mirroring that exact precedent, Path B
// behavior is proven structurally against the handler's own exact source
// text, not via runtime invocation. The pure helpers Path B composes
// (isCandidateEligibleForPostAcceptanceEnrichmentTarget,
// hasNonBlankEmploymentEnrichmentPatch, appendPreserveExisting) are
// already independently, exhaustively unit-tested elsewhere (E1's
// pi-d0a/pi-c1 suites) -- these tests prove Path B WIRES them correctly,
// in the correct order, behind the correct fail-closed guards; they do
// not re-prove the helpers' own input/output behavior.
// ════════════════════════════════════════════════════════════════════════════
{
  const acceptBody = src.slice(src.indexOf("const handleAcceptEnrichment"), src.indexOf("const handleRejectEnrichment"));
  const pathBBody = acceptBody.slice(
    acceptBody.indexOf('if (targetCandidate.status === "accepted_in_module")'),
    acceptBody.lastIndexOf("return;")
  );
  const pathBCode = pathBBody.replace(/^\s*\/\/.*$/gm, "");

  // E2-T02 — Path A existing predicate preserved: accepted_in_module
  // candidates must never enter Path A's branch.
  check("E2-T02 Path A branch is gated on status === \"proposed\" only (accepted_in_module can never enter it)",
    /if \(targetCandidate\.status === "proposed"\) \{/.test(acceptBody));

  // E2-T07/post-base eligibility -- CV_EXTRACTION boundary preserved,
  // Coach-only-discovered candidates excluded even if accepted_in_module.
  check("E2-T07 Path B requires isCandidateEligibleForPostAcceptanceEnrichmentTarget (Coach-only-discovered accepted candidates fail closed; cv_extraction boundary reused, not broadened)",
    pathBBody.includes("isCandidateEligibleForPostAcceptanceEnrichmentTarget(targetCandidate)"));

  // E2-T04/E2-T05/E2-T06 — exact row resolution: identity-only match,
  // zero-match and multi-match both fail closed, no fallback of any kind.
  check("E2-T04 exact identity resolution: entry.piOriginCandidateId === targetCandidate.id (no company/title/date/index/fuzzy/semantic/LLM match)",
    /currentEmployment\.filter\(entry => entry\.piOriginCandidateId === targetCandidate\.id\)/.test(pathBBody));
  check("E2-T05/E2-T06 zero-match and multi-match both fail closed (matches.length !== 1 return;), never \"pick first\"",
    /if \(matches\.length !== 1\) return;/.test(pathBBody));
  check("E2 no heuristic/fuzzy/semantic/positional fallback anywhere in Path B (no company/title/date/index comparison, no .find( used for row resolution)",
    !/matches\[0\]\.company|matches\[0\]\.title|entry\.company ===|entry\.title ===/.test(pathBBody) && !pathBBody.includes("currentEmployment.find("));

  // E2-T08 — blank patch fail closed. Proven once, before the Path A/B
  // split (T41 above) -- re-confirmed here that Path B's branch body
  // itself contains no second, independent nonblank check (single source
  // of truth, never duplicated/weakened per-path).
  check("E2-T08 blank-patch guard is shared (checked once before the split, re-used by both paths) -- no second/weaker inline check inside Path B",
    !pathBBody.includes("hasNonblankField") && !/\.some\(v => typeof v === "string"/.test(pathBBody));

  // E2-T10/E2-T11 — patch field boundary + appendPreserveExisting reuse.
  // Only the three narrative fields are ever touched; every other
  // EmploymentEntry field survives via the unconditional `...resolvedRow`
  // spread, so manual identity edits on the live row (E2-T09) are
  // preserved byte-for-byte by construction, not by a separate explicit
  // field-by-field copy this test would otherwise have to re-prove.
  check("E2-T10/E2-T11/E2-T09 patchedRow spreads the full resolved row first, then overwrites ONLY mainFunctions/importantProjects/mainAchievements via the frozen appendPreserveExisting helper (every other field, including any manual edit, survives unconditionally)",
    /const patchedRow = \{\s*\.\.\.resolvedRow,\s*mainFunctions: appendPreserveExisting\(resolvedRow\.mainFunctions, enrichment\.patch\.mainFunctions \?\? ""\),\s*importantProjects: appendPreserveExisting\(resolvedRow\.importantProjects, enrichment\.patch\.importantProjects \?\? ""\),\s*mainAchievements: appendPreserveExisting\(resolvedRow\.mainAchievements, enrichment\.patch\.mainAchievements \?\? ""\),\s*\};/.test(pathBBody));
  check("E2 patchedRow never reconstructed from the base candidate / composeEffectiveCandidate / candidateToEmploymentEntry (no fresh EmploymentEntry created)",
    !pathBBody.includes("composeEffectiveCandidate") && !pathBBody.includes("candidateToEmploymentEntry") && !pathBBody.includes("freshEntryId"));
  check("E2 identity fields (id, piOriginCandidateId, company, title, dates, etc.) never reassigned in patchedRow (no `id:`/`piOriginCandidateId:`/`company:`/`title:` key present in the patchedRow literal)",
    !/const patchedRow = \{[^}]*\b(id|piOriginCandidateId|company|title|startDate|endDate|isCurrent)\s*:/.test(pathBBody));

  // E2-T03/E2-T13/E2-T20 — no duplicate EmploymentEntry; same-length
  // replace-in-place via .map(), never .push/.concat/spread-append;
  // resolvedRow.id (not targetCandidate.id, not a UI-supplied id) targets
  // the already-authorized row.
  check("E2-T13/E2-T03 module7.employment is rebuilt via .map() only (same length before/after; no .push/.concat/array-spread-append anywhere in Path B)",
    /module7: \{ employment: currentEmployment\.map\(entry => \(entry\.id === resolvedRow\.id \? patchedRow : entry\)\) \}/.test(pathBBody) &&
    !pathBBody.includes(".push(") && !pathBBody.includes(".concat("));
  check("E2-T20 the row is targeted by its OWN resolved id (resolvedRow.id), never by targetCandidate.id and never by a UI-supplied id",
    pathBBody.includes("entry.id === resolvedRow.id") && !/currentEmployment\.map\(entry => \(entry\.id === targetCandidate\.id/.test(pathBBody));

  // E2-T19 — base candidate never mutated. Path B never assigns to
  // professionalIntelligenceCandidatesRef / setProfessionalIntelligenceCandidates
  // / targetCandidate's own fields anywhere.
  check("E2-T19 Path B never mutates the base candidate (no professionalIntelligenceCandidatesRef/setProfessionalIntelligenceCandidates assignment, no targetCandidate.<field> = write)",
    !pathBBody.includes("professionalIntelligenceCandidatesRef.current =") &&
    !pathBBody.includes("setProfessionalIntelligenceCandidates(") &&
    !/targetCandidate\.\w+\s*=(?!=)/.test(pathBBody));

  // E2-T01/E2-T12 — the clicked enrichment's own status transition
  // (proposed -> accepted) is the SAME shared nextEnrichments expression
  // used by Path A (T42 above, defined once before the split) -- Path B
  // never recomputes or duplicates it, so a normalized-duplicate
  // narrative (E2-T12, where appendPreserveExisting is a content no-op)
  // still reaches this same unconditional status transition: it is a
  // valid acceptance, never misclassified as a blank-patch failure
  // (blank-patch is checked against the PATCH, never against whether it
  // changes the row's rendered text).
  check("E2-T01/E2-T12 Path B reuses the single, already-defined nextEnrichments (no second/duplicate status-transition expression inside Path B)",
    !/employment: enrichments\.employment\.map\(e => \(e\.id === enrichmentId/.test(pathBBody));

  // E2-T15/E2-T16/E2-T17/§14 Application Checkpoint Consistency — the
  // defining E2 requirement: ref mutated before the single save(nextData)
  // call (so that one save() serializes BOTH the patched module7 data,
  // passed explicitly, AND the accepted enrichment state, read from the
  // just-mutated ref -- re-using save()'s own envelope construction,
  // already proven by T09 above to read
  // professionalIntelligenceEnrichments: professionalIntelligenceEnrichmentsRef.current).
  // setData/setProfessionalIntelligenceEnrichments are called ONLY inside
  // the persisted-success branch; the failure branch rolls the ref back
  // to its pre-attempt value and calls neither setter -- so a failed save
  // leaves rendered state (data/professionalIntelligenceEnrichments)
  // completely untouched and the enrichment remains "proposed".
  check("E2-T17 Path B calls save(nextData) exactly once, with the ref already mutated to nextEnrichments beforehand (one checkpoint serializes both halves)",
    (pathBBody.match(/\bsave\(nextData\)/g) ?? []).length === 1 &&
    pathBBody.indexOf("professionalIntelligenceEnrichmentsRef.current = nextEnrichments;") < pathBBody.indexOf("save(nextData)"));
  check("E2-T15 setData/setProfessionalIntelligenceEnrichments are called ONLY inside the `if (persisted)` success branch",
    /if \(persisted\) \{\s*justCheckpointedRef\.current = true;\s*setData\(nextData\);\s*setProfessionalIntelligenceEnrichments\(nextEnrichments\);\s*\}/.test(pathBBody));
  check("E2-T16 on failure (else branch) the ref is rolled back to its pre-attempt value and no setter is called outside the success branch",
    /\} else \{\s*professionalIntelligenceEnrichmentsRef\.current = enrichments;\s*\}/.test(pathBBody) &&
    (pathBBody.match(/setData\(nextData\)/g) ?? []).length === 1 &&
    (pathBBody.match(/setProfessionalIntelligenceEnrichments\(nextEnrichments\)/g) ?? []).length === 1);
  check("E2 PARTIAL_VISIBLE_SUCCESS_ALLOWED:NO -- no setData/setProfessionalIntelligenceEnrichments call exists outside the `if (persisted)` block anywhere in Path B",
    pathBBody.split("if (persisted) {")[0].indexOf("setData(") === -1 &&
    (pathBBody.split("if (persisted) {")[1] ?? "").split("} else {")[1]?.indexOf("setData(") !== 0);
  check("E2 no second save() call introduced anywhere in Path B (exactly one checkpoint, no retry/fallback save)",
    (pathBCode.match(/\bsave\(/g) ?? []).length === 1);
  check("E2 no ACID/transaction claim introduced in actual code (no 'transaction'/'rollback'/'commit' as a DB concept, no new persistence API) -- explanatory comments disclaiming DB-transaction atomicity are expected and excluded here",
    !/\btransaction\b|\.rollback\(|\bBEGIN\b|\bCOMMIT\b/i.test(pathBCode));

  // E2-T14 — sequential enrichments: Path B always re-reads
  // dataRef.current fresh on every invocation (never a stale/precomputed
  // snapshot carried across calls), so accepting enrichment A then B
  // later re-resolves the SAME row from CURRENT state each time --
  // appendPreserveExisting's own already-proven accumulation semantics
  // (pi-d0a E1-era tests) then govern the accumulated result
  // deterministically; no caching/memoization of resolvedRow across calls.
  check("E2-T14 Path B always reads dataRef.current fresh (never a module-level/outer-scope cached employment snapshot) -- sequential Accept calls each re-resolve from current state",
    pathBBody.includes("dataRef.current.module7.employment") && !acceptBody.includes("let cachedEmployment") && !acceptBody.includes("let resolvedRow;"));

  // E2 scope firewall -- no new EmploymentEntry fields, no new
  // post-materialization linkage field, no UI-facing changes in this
  // handler.
  check("E2 no new field introduced on EmploymentEntry by this handler (only the frozen E1 piOriginCandidateId is read, never written to a new name)",
    !pathBBody.includes("acceptedModuleEntryId") && !pathBBody.includes("moduleEntryId") && !pathBBody.includes(".linkedRowId"));
}

// ════════════════════════════════════════════════════════════════════════════
// §39 — base Employment Accept composition (structural + integration)
// ════════════════════════════════════════════════════════════════════════════
{
  const acceptBody = src.slice(src.indexOf("const handleAcceptCandidate"), src.indexOf("const handleRejectCandidate"));
  check("T51 Employment case composes the effective candidate via composeEffectiveCandidate(candidate, enrichments.employment)",
    /const effectiveCandidate = composeEffectiveCandidate\(candidate, enrichments\.employment\);/.test(acceptBody));
  check("T52 Employment case feeds the effective candidate into the EXISTING, unmodified candidateToEmploymentEntry",
    /const entry = candidateToEmploymentEntry\(effectiveCandidate\);/.test(acceptBody));
  check("T53 enrichments passed in their existing overlay order (no .sort(/.reverse( call on the array)", !/enrichments\.employment\.sort\(|enrichments\.employment\.reverse\(/.test(acceptBody));
  check("T54 related enrichment statuses remain unchanged after base Accept (no withCandidateStatus/.map applied to enrichments in this handler)",
    !acceptBody.includes("professionalIntelligenceEnrichmentsRef.current ="));
  check("T55 base candidate material fields never reassigned in the Employment case (candidateToEmploymentEntry receives the fresh effectiveCandidate, not `candidate`, and `candidate` itself is never spread-overwritten)",
    !/candidate\.mainFunctions\s*=|candidate\.importantProjects\s*=|candidate\.mainAchievements\s*=/.test(acceptBody));
}

// ════════════════════════════════════════════════════════════════════════════
// §40 — base Employment Reject cleanup (structural)
// ════════════════════════════════════════════════════════════════════════════
{
  const rejectBody = src.slice(src.indexOf("const handleRejectCandidate"), src.indexOf("// ── Init session ID"));
  check("T56 Employment Reject removes ALL exact-target enrichments regardless of their own status (filter by target.candidateId only, no status check)",
    /nextEnrichments = \{ employment: enrichments\.employment\.filter\(e => e\.target\.candidateId !== candidateId\) \};/.test(rejectBody));
  check("T57 non-Employment Reject cases leave nextEnrichments at its default (unchanged) value",
    (rejectBody.match(/nextEnrichments = /g) ?? []).length === 1);
  check("T58 Employment Reject performs no module mutation (no nextData anywhere in Reject)", !rejectBody.includes("nextData"));
}

// ════════════════════════════════════════════════════════════════════════════
// §41 — CV re-extraction protected-ids / orphan cleanup (structural)
// ════════════════════════════════════════════════════════════════════════════
{
  // End-anchor reconciled: handleSetActiveProfessionalContext no longer
  // exists (removed by D1D) -- handleProfessionalCandidatesExtracted is
  // now immediately followed by handleAcceptEnrichment.
  const body = src.slice(src.indexOf("const handleProfessionalCandidatesExtracted"), src.indexOf("const handleAcceptEnrichment"));
  check("T59 protected set derived ONLY from status === \"accepted\" employment enrichments (proposed/rejected excluded)",
    /\.filter\(e => e\.status === "accepted" && e\.target\.domain === "employment"\)/.test(body));
  check("T60 protected set passed as the third, optional argument to replaceCvExtractionCandidates (backwards-compatible extension)",
    /replaceCvExtractionCandidates\(professionalIntelligenceCandidatesRef\.current, incoming, protectedCandidateIds\)/.test(body));
  check("T61 orphan cleanup runs via removeOrphanedEnrichments against the NEXT candidate overlay (exact-id existence only)",
    /removeOrphanedEnrichments\(currentEnrichments, nextCandidates\)/.test(body));
  check("T62 no semantic/fuzzy matching anywhere in the CV re-extraction coordination (no company/title comparison)", !/\.company ===|\.title ===/.test(body));
  check("T63 no new save() call introduced by this handler (A0 callback persistence remains deferred to the normal checkpoint, unchanged PI-B2 behavior)",
    !body.replace(/^\s*\/\/.*$/gm, "").includes("save("));
}

// ════════════════════════════════════════════════════════════════════════════
// §43 — review surface structural proofs
// ════════════════════════════════════════════════════════════════════════════
{
  check("T64 discovery review sections remain present/unchanged (EmploymentCard/EducationCard/etc. still defined)",
    /function EmploymentCard/.test(reviewSrc) && /function EducationCard/.test(reviewSrc));
  check("T65 proposed enrichments are filtered to status === \"proposed\" only (mirrors discovery's own rule)",
    /enrichments\.employment\s*\.filter\(e => e\.status === "proposed"\)/.test(reviewSrc));
  check("T66 accepted/rejected enrichments are therefore never actionable (no separate accepted/rejected rendering branch exists)",
    !/e\.status === "accepted"[\s\S]{0,100}map|e\.status === "rejected"[\s\S]{0,100}map/.test(reviewSrc));
  check("T67 base company/title shown via EnrichmentCard's title/subtitle rows", /const title = baseCandidate\.company \|\| baseCandidate\.title/.test(reviewSrc));
  check("T68 beneficiary rawText shown via the enrichment's own provenance (not the candidate's)",
    /const rawText = enrichment\.provenance\[0\]\?\.rawText/.test(reviewSrc));
  check("T69 only populated patch fields are rendered (Row's own existing blank-value guard applies uniformly)",
    /<Row label="Funciones principales" value=\{enrichment\.patch\.mainFunctions \?\? ""\}\/>/.test(reviewSrc));
  check("T70 multi-field enrichment is one Accept/Reject unit (exactly two buttons per EnrichmentCard, no per-field action)",
    (reviewSrc.match(/aria-label="Aceptar información adicional de experiencia profesional"/g) ?? []).length === 1 &&
    (reviewSrc.match(/aria-label="Descartar información adicional de experiencia profesional"/g) ?? []).length === 1);
  check("T71 orphan enrichment (target candidate not found) never rendered as actionable (defensive filter drops it)",
    /\.filter\(\(x\): x is \{ enrichment: EmploymentEnrichment; base: EmploymentCandidate \} => x\.base !== undefined\)/.test(reviewSrc));
  check("T72 review component has no save/localStorage/module-mutation authority (re-proof after PI-D0B additions)",
    !reviewSrc.includes("localStorage") && !reviewSrc.includes("save(") && !/setData\(/.test(reviewSrc));
  check("T73 review component never imports adapters/IntakeForm (presentational-only re-proof)",
    !/professional-intelligence-adapters|from ["']\.\/IntakeForm["']/.test(reviewSrc));
}

// ════════════════════════════════════════════════════════════════════════════
// Firewalls / static scope proofs
// ════════════════════════════════════════════════════════════════════════════
{
  check("T74 no StructuredProfile mutation introduced by any PI-D0B code (enrichment/context handlers never reference structuredProfile)",
    !src.slice(src.indexOf("const handleAcceptEnrichment"), src.indexOf("// ── Init session ID")).includes("structuredProfile"));
  check("T75 no CBR reference anywhere in the file", !/\bCBR\b|\bcbr\b/.test(src));
  check("T76 no Evidence/Document creation in any new PI-D0B code (no items push, no Disposition, no tengo)",
    !src.slice(src.indexOf("const handleAcceptEnrichment"), src.indexOf("// ── Init session ID")).match(/\.push\(|Disposition|"tengo"/));
  check("T77 no Project/Compensation entity introduced", !/ProjectCandidate|ProjectEnrichment|CompensationCandidate|CompensationEnrichment/.test(src));
  check("T78 no post-acceptance enrichment implemented (no acceptedModuleEntryId/moduleEntryId linkage anywhere)", !/acceptedModuleEntryId|moduleEntryId/.test(src));
  check("T79 no correction/conflict model implemented (no 'conflict' handling added for candidates/enrichments)", !/candidate.*conflict|enrichment.*conflict/i.test(src));
}

console.log(failures === 0 ? "\nALL PI-D0B CHECKS PASS" : `\n${failures} PI-D0B CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
