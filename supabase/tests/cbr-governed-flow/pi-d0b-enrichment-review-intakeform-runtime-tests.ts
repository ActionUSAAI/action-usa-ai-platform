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
  const acceptCode = acceptBody.replace(/^\s*\/\/.*$/gm, "");
  check("T36 missing enrichment -> no-op (if (!enrichment) return;)", /if \(!enrichment\) return;/.test(acceptBody));
  check("T37 non-proposed enrichment -> no-op (covers already-accepted and already-rejected)", /if \(enrichment\.status !== "proposed"\) return;/.test(acceptBody));
  check("T38 wrong-domain target -> no-op", /if \(enrichment\.target\.domain !== "employment"\) return;/.test(acceptBody));
  check("T39 missing target candidate -> no-op", /if \(!targetCandidate \|\| !isCandidateEligibleForEnrichmentAnchor\(targetCandidate\)\) return;/.test(acceptBody));
  check("T40 ineligible target (covers Coach-only/rejected/accepted_in_module) -> no-op via isCandidateEligibleForEnrichmentAnchor reuse", acceptBody.includes("isCandidateEligibleForEnrichmentAnchor(targetCandidate)"));
  check("T41 blank-patch validation: at least one nonblank field required, trim()-based, no normalization",
    /const hasNonblankField = \[enrichment\.patch\.mainFunctions, enrichment\.patch\.importantProjects, enrichment\.patch\.mainAchievements\]\s*\.some\(v => typeof v === "string" && v\.trim\(\) !== ""\);\s*if \(!hasNonblankField\) return;/.test(acceptBody));
  check("T42 valid proposed enrichment -> status becomes \"accepted\" via position-preserving .map()",
    /employment: enrichments\.employment\.map\(e => \(e\.id === enrichmentId \? \{ \.\.\.e, status: "accepted" \} : e\)\)/.test(acceptBody));
  check("T43 enrichment Accept never references module data (no nextData/dataRef.current mutation)", !acceptCode.includes("nextData") && !acceptCode.includes("dataRef.current ="));
  check("T44 enrichment Accept calls save() exactly once, with no explicit data argument (module data unchanged)",
    (acceptCode.match(/\bsave\(\)/g) ?? []).length === 1 && !acceptCode.includes("save(nextData)"));
  check("T45 enrichment Accept ref assigned before save (ref-then-save ordering)",
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
