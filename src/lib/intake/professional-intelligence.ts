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
// provenance[] holds more than one entry only when >=2 sources
// independently asserted a materially-equal payload (see the
// *MaterialEquals functions below) -- never attributing different
// fields of one candidate to different sources.
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
