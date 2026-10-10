// AUSCIS Post-Module1 Professional Intelligence — Candidate Model
// Foundation (PI-A). Bounded Candidate Overlay, Draft-Only,
// Module-Accepting architecture (Exact Architecture gate, PI-A
// Reconciliation gate).
//
// Pure, framework-agnostic, side-effect-free. No DB/Storage/UI/
// IntakeFormData/StructuredProfile/DraftEnvelope dependency -- this file
// has ZERO production consumers after PI-A by design (mirrors C1's own
// foundation-before-wiring precedent, src/app/intake/module-numbering.ts).
//
// Scope discipline: exactly seven bounded candidate domains. No
// Project/Contribution/Compensation/JudgeEvaluator entity, no
// generalized Fact abstraction -- all explicitly deferred/prohibited by
// the governing Exact Architecture and PI-A Reconciliation gates.

export type CandidateSource = "cv_extraction" | "coach_discovery";
export type CandidateConfidence = "high" | "medium" | "low";
export type CandidateStatus = "proposed" | "accepted_in_module" | "rejected";

// Per-candidate (never per-field) source attribution. A candidate's
// provenance[] holds more than one entry when EITHER (a) >=2 sources
// independently asserted a materially-equal payload (see the
// *MaterialEquals functions below), OR (b) >=2 acquisition turns from
// the SAME source incrementally supplied different, non-overlapping
// structural facts for the same candidate (PI-D2/PI-D2-R1 Employment
// structural completion -- see applyEmploymentCompletion below) --
// never attributing different fields of one candidate to different
// sources within a single entry.
export interface CandidateProvenance {
  source: CandidateSource;
  // rawText is the acquisition mechanism's OWN returned representation
  // for this payload -- it is NOT guaranteed to be a verbatim CV span or
  // a verbatim beneficiary utterance. Neither A0 nor Coach currently
  // expose exact source-span binding (reconciliation §V) -- this is
  // trusted at exactly the same level already extended to every
  // StructuredProfileField.value today, never higher.
  rawText: string;
  confidence: CandidateConfidence;
}

// Expected invariant (not enforced by a branded/non-empty-array type,
// per the governing instruction): provenance.length >= 1. The empty
// constructor (emptyProfessionalIntelligenceCandidates) never creates
// any candidate at all, so this invariant has nothing to violate at
// construction time -- callers that create real candidates are
// responsible for supplying at least one provenance entry.
interface CandidateBase {
  id: string;
  provenance: CandidateProvenance[];
  status: CandidateStatus;
}

export interface EmploymentCandidate extends CandidateBase {
  domain: "employment";
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  // PI-D2-R1: durable current-employment state. Absent means UNKNOWN
  // (end date not yet acquired) -- never inferred from a blank endDate
  // alone. true means the beneficiary explicitly confirmed ongoing
  // employment. No `false` variant exists: non-current is already
  // carried by a non-empty endDate elsewhere, and a bare false would
  // have no legitimate producer (see applyEmploymentCompletion below).
  currentEmployment?: true;
  mainFunctions: string;
  importantProjects: string;
  mainAchievements: string;
}

export interface EducationCandidate extends CandidateBase {
  domain: "education";
  institution: string;
  degreeName: string;
  graduationYear: string;
}

export interface CertificationCandidate extends CandidateBase {
  domain: "certification";
  name: string;
  institution: string;
  year: string;
}

export interface BusinessCandidate extends CandidateBase {
  domain: "business";
  name: string;
  role: string;
  foundedYear: string;
}

export interface ReferenceCandidate extends CandidateBase {
  domain: "reference";
  name: string;
  relationshipType: string;
  specificAchievements: string;
}

// Source-verified canonical Module9 (Existing Evidence) categories that
// currently have a StructuredProfile narrative counterpart (the only
// categories with any upstream acquisition vocabulary at all -- see the
// Post-Module1 Professional Intelligence Exact Architecture gate, §L/§Q).
// EvidenceCandidate NEVER means evidence exists or is possessed -- it is
// only a candidate indicating that a category may warrant beneficiary
// review inside Module9. No code in this file, nor any code authorized
// by PI-A, may set a category status to "tengo".
export type EvidenceCandidateCategory =
  | "awards" | "memberships" | "media" | "judging" | "criticalRole" | "artisticExhibitions";

export interface EvidenceCandidate extends CandidateBase {
  domain: "evidence";
  category: EvidenceCandidateCategory;
}

// Source-verified exact canonical Module10 (Strategic Information) field
// keys, re-read fresh from src/app/intake/types.ts's current Module10
// type for this implementation. Deliberately NOT imported from
// src/app/intake/types.ts -- this file must stay decoupled from
// IntakeFormData/module types (reconciliation §44).
export type StrategicAnswerTargetField =
  | "createdMethod"
  | "ledImpactProjects"
  | "solvedComplexProblems"
  | "trainedProfessionals"
  | "consultedForExpertise"
  | "evaluatedOthers"
  | "workedForRecognized"
  | "aboveAverageIncome"
  | "willingToConfirm"
  | "additionalInfo";

export interface StrategicAnswerCandidate extends CandidateBase {
  domain: "strategicAnswer";
  targetField: StrategicAnswerTargetField;
  // The proposed structured value itself. Provenance is source
  // attribution only (CandidateProvenance.rawText) -- the candidate's
  // own payload (what would actually be prefilled) must not be left
  // implicit inside provenance.
  answer: string;
}

export type ProfessionalIntelligenceCandidate =
  | EmploymentCandidate
  | EducationCandidate
  | CertificationCandidate
  | BusinessCandidate
  | ReferenceCandidate
  | EvidenceCandidate
  | StrategicAnswerCandidate;

export interface ProfessionalIntelligenceCandidates {
  employment: EmploymentCandidate[];
  education: EducationCandidate[];
  certification: CertificationCandidate[];
  business: BusinessCandidate[];
  reference: ReferenceCandidate[];
  evidence: EvidenceCandidate[];
  strategicAnswer: StrategicAnswerCandidate[];
}

// Fresh, independent empty arrays on every call -- two calls must never
// share any array reference (tested explicitly in pi-a-candidate-model-tests.ts).
export function emptyProfessionalIntelligenceCandidates(): ProfessionalIntelligenceCandidates {
  return {
    employment: [],
    education: [],
    certification: [],
    business: [],
    reference: [],
    evidence: [],
    strategicAnswer: [],
  };
}

// ── Comparison normalization — exact bounded scope ──────────────────────────
// Allowed: trim, lowercase, collapse internal whitespace. Nothing else
// (no punctuation stripping, no accent removal, no transliteration, no
// fuzzy/semantic/embedding/LLM matching -- reconciliation §20/§21).
// Exists only for deterministic comparison; never mutates the original
// candidate strings held by callers.
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizedEquals(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

// ── Employment: date-overlap support ─────────────────────────────────────────
// Source-established format (src/app/intake/modules/Module6.tsx:
// <TextInput type="month" .../> for both startDate and endDate): the
// HTML "month" input type constrains its value to exactly "YYYY-MM" or
// the empty string. This is the only date format PI-A relies on -- no
// parser is invented beyond what this exact, source-confirmed format
// requires.
const MONTH_FORMAT = /^\d{4}-\d{2}$/;

function parseMonth(value: string): number | null {
  if (!MONTH_FORMAT.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return year * 12 + month;
}

// Conservative by design: overlap is TRUE only when both ranges are
// fully determinable from startDate/endDate alone -- EmploymentCandidate
// has no isCurrent field (not part of the approved bounded payload; see
// EmploymentCandidate below). A blank/unparseable startDate OR endDate
// makes the range undeterminable -- such a candidate is treated as NOT
// overlapping (never silently assumed to match), consistent with this
// engagement's existing "never silently merge on uncertain grounds"
// discipline. An "I am still employed there" statement therefore yields
// a candidate with an unparseable endDate, which correctly never
// auto-merges with anything -- it simply remains its own candidate for
// beneficiary review.
function monthRange(startDate: string, endDate: string): [number, number] | null {
  const start = parseMonth(startDate);
  const end = parseMonth(endDate);
  if (start === null || end === null) return null;
  return [start, end];
}

function rangesOverlap(a: [number, number], b: [number, number]): boolean {
  const [s1, e1] = a;
  const [s2, e2] = b;
  return s1 <= e2 && s2 <= e1;
}

// ── Employment ───────────────────────────────────────────────────────────────
export function employmentSameIdentity(a: EmploymentCandidate, b: EmploymentCandidate): boolean {
  if (!normalizedEquals(a.company, b.company)) return false;
  if (!normalizedEquals(a.title, b.title)) return false;
  const rangeA = monthRange(a.startDate, a.endDate);
  const rangeB = monthRange(b.startDate, b.endDate);
  if (rangeA === null || rangeB === null) return false;
  return rangesOverlap(rangeA, rangeB);
}

export function employmentMaterialEquals(a: EmploymentCandidate, b: EmploymentCandidate): boolean {
  if (!employmentSameIdentity(a, b)) return false;
  return (
    normalizedEquals(a.mainFunctions, b.mainFunctions) &&
    normalizedEquals(a.importantProjects, b.importantProjects) &&
    normalizedEquals(a.mainAchievements, b.mainAchievements)
  );
}

// ── Education ────────────────────────────────────────────────────────────────
export function educationSameIdentity(a: EducationCandidate, b: EducationCandidate): boolean {
  return normalizedEquals(a.institution, b.institution) && normalizedEquals(a.degreeName, b.degreeName);
}

export function educationMaterialEquals(a: EducationCandidate, b: EducationCandidate): boolean {
  if (!educationSameIdentity(a, b)) return false;
  return normalizedEquals(a.graduationYear, b.graduationYear);
}

// ── Certification ────────────────────────────────────────────────────────────
export function certificationSameIdentity(a: CertificationCandidate, b: CertificationCandidate): boolean {
  return normalizedEquals(a.name, b.name) && normalizedEquals(a.institution, b.institution);
}

export function certificationMaterialEquals(a: CertificationCandidate, b: CertificationCandidate): boolean {
  if (!certificationSameIdentity(a, b)) return false;
  return normalizedEquals(a.year, b.year);
}

// ── Business ─────────────────────────────────────────────────────────────────
export function businessSameIdentity(a: BusinessCandidate, b: BusinessCandidate): boolean {
  return normalizedEquals(a.name, b.name) && normalizedEquals(a.foundedYear, b.foundedYear);
}

export function businessMaterialEquals(a: BusinessCandidate, b: BusinessCandidate): boolean {
  if (!businessSameIdentity(a, b)) return false;
  return normalizedEquals(a.role, b.role);
}

// ── Reference ────────────────────────────────────────────────────────────────
export function referenceSameIdentity(a: ReferenceCandidate, b: ReferenceCandidate): boolean {
  return normalizedEquals(a.name, b.name) && normalizedEquals(a.relationshipType, b.relationshipType);
}

export function referenceMaterialEquals(a: ReferenceCandidate, b: ReferenceCandidate): boolean {
  if (!referenceSameIdentity(a, b)) return false;
  return normalizedEquals(a.specificAchievements, b.specificAchievements);
}

// ── Evidence ─────────────────────────────────────────────────────────────────
// category is the entire payload -- same category means same identity
// AND materially equal, by construction. This never implies evidence is
// possessed.
export function evidenceSameIdentity(a: EvidenceCandidate, b: EvidenceCandidate): boolean {
  return a.category === b.category;
}

export function evidenceMaterialEquals(a: EvidenceCandidate, b: EvidenceCandidate): boolean {
  return evidenceSameIdentity(a, b);
}

// ── Strategic Answer ─────────────────────────────────────────────────────────
export function strategicAnswerSameIdentity(a: StrategicAnswerCandidate, b: StrategicAnswerCandidate): boolean {
  return a.targetField === b.targetField;
}

export function strategicAnswerMaterialEquals(a: StrategicAnswerCandidate, b: StrategicAnswerCandidate): boolean {
  if (!strategicAnswerSameIdentity(a, b)) return false;
  return normalizedEquals(a.answer, b.answer);
}

// ── Source-scoped replacement (PI-B2A) ───────────────────────────────────────
// Added for the future A0-professional-extraction runtime wiring (PI-B2B,
// not yet implemented). Pure, non-mutating. Performs source-scoped
// REPLACEMENT only -- never deduplication, same-identity comparison,
// material-equality comparison, candidate merge, provenance merge,
// conflict resolution, supersession, acceptance, or rejection. None of
// the *SameIdentity/*MaterialEquals comparators above are consulted here.
//
// A candidate is considered exclusively cv_extraction-sourced, and is
// therefore replaced, only when its provenance array is non-empty AND
// every entry's source is "cv_extraction". A candidate with zero
// provenance entries, or with at least one non-cv_extraction entry
// (including a future multi-source candidate carrying both
// cv_extraction and coach_discovery provenance), is preserved
// unchanged -- never split, never rewritten. This conservative default
// deliberately leaves the future multi-source-candidate replacement
// question open rather than resolving it here (see the PI-B2 Exact
// Design's own flagged ambiguity).
function isCvExtractionOnly(provenance: readonly CandidateProvenance[]): boolean {
  return provenance.length > 0 && provenance.every(p => p.source === "cv_extraction");
}

// protectedIds (PI-D0A): optional, additive. A CV-only candidate whose id
// is in this set survives replacement even though it would otherwise
// qualify for removal -- added so a future caller (PI-D0B) can protect a
// candidate that already carries a beneficiary-accepted enrichment from
// being silently discarded on CV re-extraction. Omitted/undefined (every
// existing call site) reduces this condition to exactly the original,
// unextended behavior -- `protectedIds?.has(c.id) ?? false` is always
// `false`, so the OR has no effect. This function has no awareness of
// EmploymentEnrichment or any enrichment concept -- it knows only ids.
function replaceDomain<T extends { id: string; provenance: CandidateProvenance[] }>(
  current: T[], incoming: T[], protectedIds?: ReadonlySet<string>
): T[] {
  return [
    ...current.filter(c => !isCvExtractionOnly(c.provenance) || (protectedIds?.has(c.id) ?? false)),
    ...incoming,
  ];
}

export function replaceCvExtractionCandidates(
  current: ProfessionalIntelligenceCandidates,
  incoming: ProfessionalIntelligenceCandidates,
  protectedCandidateIds?: ReadonlySet<string>
): ProfessionalIntelligenceCandidates {
  return {
    employment: replaceDomain(current.employment, incoming.employment, protectedCandidateIds),
    education: replaceDomain(current.education, incoming.education, protectedCandidateIds),
    certification: replaceDomain(current.certification, incoming.certification, protectedCandidateIds),
    business: replaceDomain(current.business, incoming.business, protectedCandidateIds),
    reference: replaceDomain(current.reference, incoming.reference, protectedCandidateIds),
    evidence: replaceDomain(current.evidence, incoming.evidence, protectedCandidateIds),
    strategicAnswer: replaceDomain(current.strategicAnswer, incoming.strategicAnswer, protectedCandidateIds),
  };
}

// ── Professional Enrichment Model (PI-D0, corrected by PI-D0-R1) ────────────
// Enrichment represents newly asserted material ABOUT an already-known
// Employment candidate -- never a duplicated full candidate, never a
// mutation of the original. A standalone model, deliberately NOT a member
// of ProfessionalIntelligenceCandidate/Candidates -- merging it there would
// force every existing exhaustive 7-domain switch (PI-C1 adapters, PI-C2
// review, PI-C3 handlers) to handle an 8th, structurally different,
// patch-shaped member, regressing those three closed slices. V1 is
// Employment-only (D-PI-D0-01, frozen): Education/Certification/Business
// each resolve to zero safely-enrichable fields once identity/correction-
// style fields are excluded (graduationYear/year are date-correction
// facts, not professional depth; Business.role is already frozen
// non-mappable from Coach); Reference/Evidence/StrategicAnswer have no A0
// base to enrich at all. Future domain expansion is deferred, not
// prohibited (D-PI-D0-01) -- nothing here forecloses it.
//
// NO timestamp fields (acceptedAt/createdAt/updatedAt) and NO linkage
// field back to any resulting module entry -- composition order is
// OVERLAY_ACQUISITION_ORDER (PI-D0-R1 correction):
// candidate Accept/Reject has never reordered an array anywhere in this
// codebase (see withCandidateStatus's own position-preserving .map()),
// and an enrichment's array position already IS a stable, deterministic
// fold order -- a timestamp field would duplicate that guarantee for no
// benefit while adding a new hydration-validity question.
export type EnrichmentStatus = "proposed" | "accepted" | "rejected";

// V1: Employment-only (frozen). Not generalized to other domains merely
// for typing convenience -- an impossible target must never type-check.
export interface EnrichmentTarget {
  domain: "employment";
  candidateId: string;
}

// Only the three narrative depth fields Coach's own prompt already
// probes (impacto/responsabilidad/complejidad) -- never identity fields
// (company/title/startDate/endDate). An enrichment proposal carries only
// what was newly asserted, never a restatement of context the
// beneficiary did not say that turn (frozen context/provenance firewall).
export interface EmploymentEnrichmentPatch {
  mainFunctions?: string;
  importantProjects?: string;
  mainAchievements?: string;
}

export interface EmploymentEnrichment {
  id: string;
  target: EnrichmentTarget;
  status: EnrichmentStatus;
  provenance: CandidateProvenance[];
  patch: EmploymentEnrichmentPatch;
}

// V1: a single-domain union of one -- kept as its own named export rather
// than a discriminated union of several, since adding Education/
// Certification/Business members today would be permanently dead code
// per the domain analysis above.
export type ProfessionalIntelligenceEnrichment = EmploymentEnrichment;

export interface ProfessionalIntelligenceEnrichments {
  employment: EmploymentEnrichment[];
}

export function emptyProfessionalIntelligenceEnrichments(): ProfessionalIntelligenceEnrichments {
  return { employment: [] };
}

// Eligibility (PI-D0-R1 correction): HAS_CV_EXTRACTION_PROVENANCE, not
// CV-EXCLUSIVE. provenance.some(...), never .every(...) -- a legitimate
// multi-source candidate (CV + Coach, materially-equal payload, per this
// file's own provenance[] documentation above) still has real documentary
// CV support and must remain a valid anchor. A Coach-only discovery
// candidate (zero cv_extraction entries) correctly fails this check,
// keeping NEW DISCOVERY candidates ineligible as V1 enrichment anchors
// (DISCOVERY_CANDIDATE_ENRICHMENT_V1: DEFERRED) without needing any
// separate "is this a discovery" flag -- provenance already decides it.
// A rejected or already-accepted_in_module candidate is excluded by the
// plain status check alone (REJECTED_A0_AS_ANCHOR: PROHIBITED).
export function isCandidateEligibleForEnrichmentAnchor(candidate: EmploymentCandidate): boolean {
  return candidate.status === "proposed" && candidate.provenance.some(p => p.source === "cv_extraction");
}

// APPEND_PRESERVE_EXISTING (frozen Owner decision D-PI-D-R1-01). Operates
// on raw text only -- normalizedEquals (trim+lowercase+collapse-
// whitespace) governs ONLY the exact-duplicate comparison, never the
// stored value itself, so the beneficiary's/Coach's original casing and
// wording is always preserved verbatim in what is actually saved.
// Exact-normalized-equality no-op is a mechanical idempotency guard
// within one field's own accumulated text -- it is not the frozen
// no-automatic-dedup policy, which governs whether separate overlay
// items may coexist, a different and unrelated concern.
export function appendPreserveExisting(existing: string, incoming: string): string {
  if (incoming.trim() === "") return existing.trim() === "" ? "" : existing;
  if (existing.trim() === "") return incoming;
  if (normalizedEquals(existing, incoming)) return existing;
  return `${existing}\n\n${incoming}`;
}

// Transient, pure composition -- never persisted, never itself a stored
// overlay object. Feeds the existing, unmodified candidateToEmploymentEntry
// adapter (professional-intelligence-adapters.ts) at base-candidate Accept
// time without requiring any adapter change. Never mutates `base` or any
// enrichment; defensively ignores enrichments targeting a different
// candidate/domain or not yet "accepted" rather than throwing. Folds in
// the input array's own existing order (OVERLAY_ACQUISITION_ORDER) --
// never sorts, never reads a timestamp.
export function composeEffectiveCandidate(
  base: EmploymentCandidate,
  enrichments: readonly EmploymentEnrichment[]
): EmploymentCandidate {
  let mainFunctions = base.mainFunctions;
  let importantProjects = base.importantProjects;
  let mainAchievements = base.mainAchievements;

  for (const enrichment of enrichments) {
    if (enrichment.status !== "accepted") continue;
    if (enrichment.target.domain !== "employment") continue;
    if (enrichment.target.candidateId !== base.id) continue;

    if (enrichment.patch.mainFunctions !== undefined) {
      mainFunctions = appendPreserveExisting(mainFunctions, enrichment.patch.mainFunctions);
    }
    if (enrichment.patch.importantProjects !== undefined) {
      importantProjects = appendPreserveExisting(importantProjects, enrichment.patch.importantProjects);
    }
    if (enrichment.patch.mainAchievements !== undefined) {
      mainAchievements = appendPreserveExisting(mainAchievements, enrichment.patch.mainAchievements);
    }
  }

  return { ...base, mainFunctions, importantProjects, mainAchievements };
}

// Answers only "does the exact target still exist?" -- existence, not
// eligibility (a rejected/accepted_in_module target still counts as
// existing here; that is a separate, already-handled concern elsewhere).
// Exact candidateId resolution only -- no company/title matching, no
// semantic/fuzzy re-anchoring. Never mutates either input.
export function removeOrphanedEnrichments(
  enrichments: ProfessionalIntelligenceEnrichments,
  candidates: ProfessionalIntelligenceCandidates
): ProfessionalIntelligenceEnrichments {
  const existingIds = new Set(candidates.employment.map(c => c.id));
  return {
    employment: enrichments.employment.filter(e => existingIds.has(e.target.candidateId)),
  };
}

// Coarse hydration guard, mirroring isValidProfessionalIntelligenceCandidatesOverlay's
// own established philosophy exactly: a non-null object with an
// `employment` array is acceptable for hydration; anything else resets
// the whole overlay to empty. Per-item content (id/status/target/patch/
// provenance) is deliberately not deep-validated, matching the existing
// candidate-overlay guard's own precedent.
export function isValidProfessionalIntelligenceEnrichmentsOverlay(value: unknown): value is ProfessionalIntelligenceEnrichments {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.employment);
}

// ── Professional Completion Model (PI-D2, corrected by PI-D2-R1) ───────────
// Structural completion represents a beneficiary-supplied fact that fills
// an originally-EMPTY structural field (startDate/endDate) or the durable
// current-employment state of an already-discovered, still-"proposed"
// EmploymentCandidate -- never a correction (nonempty -> different),
// never enrichment (narrative depth fields, see EmploymentEnrichmentPatch
// above), never acceptance (Module Data is never touched here).
// Completion and enrichment are deliberately separate types --
// company/title/mainFunctions/importantProjects/mainAchievements/
// candidateId/status/source/provenance/confidence are structurally
// absent from this patch; the application assigns every authority
// field, exactly mirroring EmploymentEnrichmentPatch's own precedent.
//
// PI-D2A boundary: this section has ZERO production consumers by design
// (mirrors PI-A's/PI-D0A's own foundation-before-wiring precedent) --
// target-eligibility revalidation (status==="proposed", pin binding) and
// Coach-facing wiring are PI-D2B/PI-D2C, not authorized here.
export interface EmploymentCandidateCompletionPatch {
  startDate?: string;
  endDate?: string;
  currentEmployment?: true;
}

// Eligibility (PI-D2-R1, frozen Owner decision: COACH_DISCOVERY_EXCLUSIVE).
// Deliberately the mirror-opposite TECHNIQUE of isCvExtractionOnly above,
// never its negation -- an empty provenance array is never eligible
// (Array.every's vacuous truth on [] is explicitly guarded against via
// the length check), matching this predicate's actual architectural
// meaning ("every entry IS coach_discovery"), not "no entry is
// something else". A mixed-provenance or CV-only candidate is excluded,
// same as a candidate with zero provenance entries.
export function isCoachDiscoveryOnly(provenance: readonly CandidateProvenance[]): boolean {
  return provenance.length > 0 && provenance.every(p => p.source === "coach_discovery");
}

// Pure, non-mutating application of one completion-turn's worth of
// structural facts onto an existing EmploymentCandidate. Trusts its
// caller already established target eligibility (isCoachDiscoveryOnly,
// status==="proposed", exact pin match) -- this helper performs no
// eligibility check of its own beyond the terminal-state invariant below.
//
// Terminal-state invariant (PI-D2-R1 §8.6, mandatory, enforced HERE, not
// merely by a future caller): the returned candidate can never hold both
// a non-empty endDate AND currentEmployment===true. endDate-completion
// and currentEmployment-completion are mutually exclusive within a
// single call -- each requires the OTHER terminal field to still be in
// its unknown state (candidate.endDate==="" / candidate.currentEmployment
// !== true) before either may apply. If a single patch proposes BOTH a
// non-blank endDate AND currentEmployment:true against an unknown
// candidate, that is a same-patch terminal-state contradiction: NEITHER
// terminal fact is applied (fail-closed, never an arbitrary preference
// for one over the other) -- startDate may still complete independently
// in the same call, since it is not part of this contradiction.
//
// An already-contradictory PRE-EXISTING candidate (currentEmployment===
// true AND endDate!=="" -- never produced by this helper, but not
// defended against by any other code either) is never repaired here: no
// correction architecture exists (PI-D2/PI-D2-R1, frozen DEFERRED).
// Terminal-state completion against such a candidate is always a no-op
// (both terminal proposal conditions require the OTHER field to still be
// unknown, which is already false for a contradictory candidate); an
// independent empty startDate may still safely fill.
//
// Idempotent by construction: if the resulting candidate would be
// field-for-field identical to the input, the ORIGINAL object reference
// is returned (no clone, no provenance append) -- never a new object
// carrying identical content. Exactly one provenance entry (the one
// supplied by the caller) is appended when, and only when, at least one
// field genuinely changed -- never one entry per field, never
// synthesized here (PI-D2-R1 §12/§16). Never mutates candidate/patch/
// provenance.
export function applyEmploymentCompletion(
  candidate: EmploymentCandidate,
  patch: EmploymentCandidateCompletionPatch,
  provenance: CandidateProvenance
): EmploymentCandidate {
  const startDateFillable = candidate.startDate === "" && !!patch.startDate;
  const nextStartDate = startDateFillable ? patch.startDate! : candidate.startDate;

  const endDateProposed = candidate.endDate === "" && candidate.currentEmployment !== true && !!patch.endDate;
  const currentEmploymentProposed =
    candidate.endDate === "" && candidate.currentEmployment !== true && patch.currentEmployment === true;
  const terminalContradiction = endDateProposed && currentEmploymentProposed;

  const nextEndDate = endDateProposed && !terminalContradiction ? patch.endDate! : candidate.endDate;
  const nextCurrentEmployment: true | undefined =
    currentEmploymentProposed && !terminalContradiction ? true : candidate.currentEmployment;

  const changed =
    nextStartDate !== candidate.startDate ||
    nextEndDate !== candidate.endDate ||
    nextCurrentEmployment !== candidate.currentEmployment;

  if (!changed) return candidate;

  return {
    ...candidate,
    startDate: nextStartDate,
    endDate: nextEndDate,
    ...(nextCurrentEmployment !== undefined ? { currentEmployment: nextCurrentEmployment } : {}),
    provenance: [...candidate.provenance, provenance],
  };
}
