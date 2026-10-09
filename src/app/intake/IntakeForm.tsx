"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, CheckCircle, Save } from "lucide-react";

import type { IntakeForm as IntakeFormData, ModuleStatus } from "./types";
import { IntakeTokenProvider } from "./primitives";
import { emptyStructuredProfile, emptyField, acquireField } from "@/lib/intake/structured-profile";
import { prefillModule1 } from "@/lib/intake/prefill-engine";
import {
  type ProfessionalIntelligenceCandidates,
  emptyProfessionalIntelligenceCandidates,
  replaceCvExtractionCandidates,
  type CandidateStatus,
  type ProfessionalIntelligenceEnrichments,
  emptyProfessionalIntelligenceEnrichments,
  isValidProfessionalIntelligenceEnrichmentsOverlay,
  isCandidateEligibleForEnrichmentAnchor,
  composeEffectiveCandidate,
  removeOrphanedEnrichments,
  type EmploymentCandidate,
} from "@/lib/intake/professional-intelligence";
import type { BoundedEmploymentContext, NextProfessionalTopic } from "@/lib/intake/coach";
import type { ProfessionalIntelligenceCoachResult } from "@/lib/intake/coach-professional-extraction";
import {
  candidateToEmploymentEntry, candidateToEducationEntry, candidateToCertificationEntry,
  candidateToBusinessEntry, candidateToReferenceEntry, candidateToEvidenceStatusPatch,
  candidateToStrategicAnswerPatch,
} from "@/lib/intake/professional-intelligence-adapters";
import { ProfessionalCandidateReview, type ProfessionalIntelligenceCandidateDomain } from "./professional-candidate-review";
import { Module0 }  from "./modules/Module0";
import { Module1 }  from "./modules/Module1";
import { Module2 }  from "./modules/Module2";
import { Module3 }  from "./modules/Module3";
import { Module4 }  from "./modules/Module4";
import { Module5 }  from "./modules/Module5";
import { Module6 }  from "./modules/Module6";
import { Module7 }  from "./modules/Module7";
import { Module8 }  from "./modules/Module8";
import { Module9 }  from "./modules/Module9";
import { Module10 } from "./modules/Module10";
import { Module11 } from "./modules/Module11";
import { Module12 } from "./modules/Module12";
import { Module13 } from "./modules/Module13";
import { Summary }  from "./modules/Summary";

const TOTAL = 14;

// P7-R4 draft envelope (CR-CPS-60): `step` is navigation/resume
// metadata, never a beneficiary fact -- kept structurally outside
// IntakeFormData and never spread into the /api/intake submission
// payload. `savedAt` is informational only, not restored into React
// state during hydration.
//
// professionalIntelligenceCandidates (PI-B2A) is an additive, optional
// sibling -- NEVER part of IntakeFormData, NEVER part of Module0Data,
// and (like `step`/`savedAt`) never spread into the /api/intake
// submission payload (see submit() below -- it has no reference to
// this field at all). This is the exact PI-B2 Exact Design's frozen
// draft-ownership boundary.
// professionalIntelligenceEnrichments (PI-D0B) is an additive, optional
// sibling, mirroring professionalIntelligenceCandidates's own exact
// pattern -- draft-local, never part of IntakeFormData/Module0Data, never
// spread into the /api/intake submission payload. QuestionProfessionalContext
// (PI-D1D, superseding D0B's ActiveProfessionalContext) is deliberately NOT
// a DraftEnvelope field at all (frozen PI-D0-R1/R2/R3:
// QUESTION_CONTEXT_PERSISTED: NO) -- it is transient client runtime state
// only, never hydrated, never saved. The same holds for the rotation
// pointer and the bounded Coach-guidance snapshot -- neither is ever a
// DraftEnvelope field.
export type DraftEnvelope = {
  data: IntakeFormData;
  step: number;
  savedAt: string;
  professionalIntelligenceCandidates?: ProfessionalIntelligenceCandidates;
  professionalIntelligenceEnrichments?: ProfessionalIntelligenceEnrichments;
};

// PI-D1D — supersedes PI-D0B's ActiveProfessionalContext (manual/global
// beneficiary-selected target) with the PI-D1-R2/R3 Coach-led,
// turn-scoped, alias-based architecture: this context represents what
// the IMMEDIATELY PRECEDING Coach question was about, applicable to the
// beneficiary's CURRENT answer -- never the reverse (PI-D1-R2 off-by-one
// firewall). Deliberately NOT a candidate-model concept (professional-
// intelligence.ts has zero awareness of it). No alias field -- an alias
// is request-snapshot-local only and is resolved to a candidateId before
// this context is ever constructed (PI-D1-R2 §9/§23).
export type QuestionProfessionalContext =
  | {
      mode: "known_employment";
      candidateId: string;
      identity: { company: string; title: string; startDate: string; endDate: string };
    }
  | { mode: "open_discovery" }
  | { mode: "none" };

// PI-D1-R3-R1's selected rotation state shape -- the exact candidateId
// that should start the next rotating slice, or null. Identity-anchored
// (not a numeric index) specifically so a removal elsewhere in the pool
// never silently redirects the pointer to an unintended candidate
// (PI-D1-R3-R1 §13/§H).
export type RotationPointer = string | null;

// PI-D1D — application-only internal snapshot (never sent to any
// server/model as-is; only the alias+identity portion, stripped of
// candidateId, becomes the wire-visible boundedEmploymentContexts).
// `proposedNextRotationState` is computed at snapshot-BUILD time but
// must not become authoritative until a successful Coach checkpoint
// commits it (PI-D1-R3-R1 two-phase build/commit invariant).
export interface BoundedProfessionalSnapshotEntry {
  alias: "P1" | "P2" | "P3";
  candidateId: string;
  identity: { company: string; title: string; startDate: string; endDate: string };
}
export interface BoundedProfessionalSnapshot {
  entries: BoundedProfessionalSnapshotEntry[];
  proposedNextRotationState: RotationPointer;
}

// Exported pure helper -- the single, narrow revalidation predicate used
// both for pin-derivation and for enrichment-target/next-context
// revalidation (PI-D1-R3 §47/§S: one predicate, every call site, no
// duplicated business logic). Deliberately does NOT require
// cv_extraction provenance -- a safely-bound Coach-discovered Candidate
// is a valid context-authorized target even though it is NOT generally
// eligible for the rotating pool (isCandidateEligibleForEnrichmentAnchor,
// unchanged, stays the stricter general-pool gate). Authorization comes
// entirely from the caller already knowing this exact candidateId was
// legitimately established as context -- never from inspecting
// provenance here.
export function isContextAuthorizedTarget(
  candidate: EmploymentCandidate | undefined,
  candidateId: string
): boolean {
  return !!candidate && candidate.id === candidateId && candidate.status === "proposed";
}

// Exported pure helper -- derives the pinned P1 entry (if any) from the
// current question context, re-reading the live Candidate's own
// identity fields fresh rather than trusting a possibly-stale stored
// copy (identity fields are never mutated by enrichment, so this is
// always safe and strictly more current). Returns null whenever there
// is no known_employment context or its target is no longer a valid
// context-authorized Employment Candidate -- never a fuzzy/company-title
// fallback (PI-D1-R3 §16).
export function derivePinnedEntry(
  questionContext: QuestionProfessionalContext,
  candidates: ProfessionalIntelligenceCandidates
): { candidateId: string; identity: BoundedProfessionalSnapshotEntry["identity"] } | null {
  if (questionContext.mode !== "known_employment") return null;
  const candidate = candidates.employment.find(c => c.id === questionContext.candidateId);
  if (!candidate || !isContextAuthorizedTarget(candidate, questionContext.candidateId)) return null;
  return {
    candidateId: candidate.id,
    identity: { company: candidate.company, title: candidate.title, startDate: candidate.startDate, endDate: candidate.endDate },
  };
}

// Exported pure helper -- the general ROTATING pool. Reuses the
// byte-unchanged PI-D0A helper exactly (PI-D1-R3 §12/§49) -- a
// Coach-discovered Candidate with only coach_discovery provenance never
// enters this pool, bound/pinned or not.
export function deriveGeneralEligiblePool(candidates: ProfessionalIntelligenceCandidates): EmploymentCandidate[] {
  return candidates.employment.filter(isCandidateEligibleForEnrichmentAnchor);
}

// Exported pure helper -- PI-D1-R3-R1's selected candidateId-anchored
// cyclic pointer algorithm, verified against its own worked example
// during that design gate. `pool` must already be eligibility-filtered
// and pin-excluded by the caller. A pointer that no longer resolves in
// the current pool falls back to pool[0] (safety over perfect fairness,
// PI-D1-R3-R1 §15) -- never a semantic/company-title replacement search.
export function selectRotatingSlice(
  pool: readonly EmploymentCandidate[],
  capacity: number,
  pointer: RotationPointer
): { selected: EmploymentCandidate[]; newNextId: RotationPointer } {
  if (pool.length === 0) return { selected: [], newNextId: null };
  let start = 0;
  if (pointer !== null) {
    const idx = pool.findIndex(c => c.id === pointer);
    if (idx !== -1) start = idx;
  }
  const n = Math.min(capacity, pool.length);
  const selected = Array.from({ length: n }, (_, i) => pool[(start + i) % pool.length]);
  const newNextId = pool[(start + n) % pool.length].id;
  return { selected, newNextId };
}

// Exported pure helper -- composes pin + rotation into the exact bounded
// snapshot used both to build the next Coach request (alias+identity
// only, candidateId stripped before serialization -- see
// Module0's own wire-safe prop) and to resolve a returned alias back to
// an exact candidateId at checkpoint time (PI-D1-R2/R3 alias
// architecture). Pin consumes no rotation capacity (PI-D1-R3 §17) and is
// excluded from the rotating pool by exact id.
export function buildBoundedProfessionalSnapshot(
  questionContext: QuestionProfessionalContext,
  candidates: ProfessionalIntelligenceCandidates,
  rotationPointer: RotationPointer
): BoundedProfessionalSnapshot {
  const pinned = derivePinnedEntry(questionContext, candidates);
  const generalPool = deriveGeneralEligiblePool(candidates).filter(c => !pinned || c.id !== pinned.candidateId);
  const capacity = pinned ? 2 : 3;
  const { selected, newNextId } = selectRotatingSlice(generalPool, capacity, rotationPointer);

  const rotatingEntries = selected.map(c => ({
    candidateId: c.id,
    identity: { company: c.company, title: c.title, startDate: c.startDate, endDate: c.endDate },
  }));
  const slots = pinned ? [pinned, ...rotatingEntries] : rotatingEntries;

  const entries: BoundedProfessionalSnapshotEntry[] = slots.map((e, i) => ({
    alias: (`P${i + 1}` as "P1" | "P2" | "P3"),
    candidateId: e.candidateId,
    identity: e.identity,
  }));

  return { entries, proposedNextRotationState: newNextId };
}

// Exported pure helper -- resolves Coach's raw next-topic signal into
// the authoritative QuestionProfessionalContext for the NEXT beneficiary
// message, per PI-D1-R2 (alias/open_discovery/none) and PI-D1-R3
// (continue_new_employment same-turn single-discovery cardinality
// binding). `candidatesForValidation` must be the FINAL post-discovery-
// append candidate state for this turn -- known_employment additionally
// re-validates the resolved target is still a context-authorized
// Employment Candidate at THIS exact moment (PI-D1-R2 §86 no-reanchor:
// a snapshot-valid alias whose Candidate was rejected/removed before
// checkpoint still downgrades to none, never an alternate target).
export function resolveNextQuestionContext(
  rawTopic: NextProfessionalTopic,
  snapshot: BoundedProfessionalSnapshot,
  candidatesForValidation: ProfessionalIntelligenceCandidates,
  newEmploymentDiscoveries: readonly EmploymentCandidate[]
): QuestionProfessionalContext {
  if (rawTopic.mode === "known_employment") {
    const entry = snapshot.entries.find(e => e.alias === rawTopic.alias);
    if (!entry) return { mode: "none" };
    const candidate = candidatesForValidation.employment.find(c => c.id === entry.candidateId);
    if (!isContextAuthorizedTarget(candidate, entry.candidateId)) return { mode: "none" };
    return { mode: "known_employment", candidateId: entry.candidateId, identity: entry.identity };
  }
  if (rawTopic.mode === "continue_new_employment") {
    // PI-D1-R3 §26/§27: cardinality-safe, zero-agreement binding --
    // never guess, never choose first, never semantic/company-title match.
    if (newEmploymentDiscoveries.length === 1) {
      const c = newEmploymentDiscoveries[0];
      return {
        mode: "known_employment",
        candidateId: c.id,
        identity: { company: c.company, title: c.title, startDate: c.startDate, endDate: c.endDate },
      };
    }
    return { mode: "open_discovery" };
  }
  if (rawTopic.mode === "open_discovery") return { mode: "open_discovery" };
  return { mode: "none" };
}

// P7-R4 (CR-CPS-60) — pure, exported, framework-agnostic helpers. Used
// by IntakeForm itself (hydration effect, next()/back()) so tests can
// exercise the actual implementation, not a reimplementation of it.

// Validates a hydrated resume step: integer, within the executable
// 0..total range. Invalid/missing -> 0, matching today's unconditional
// default (no step was ever persisted before this correction).
export function validateResumeStep(rawStep: unknown, total: number): number {
  if (typeof rawStep === "number" && Number.isInteger(rawStep) && rawStep >= 0 && rawStep <= total) {
    return rawStep;
  }
  return 0;
}

// Coarse, bounded structural guard (PI-B2A) -- deliberately NOT a
// per-candidate/per-field validator (that duplicates PI-B1's own raw-
// LLM-response validator for a different input shape, which is already
// application-candidate-shaped, not raw-LLM-shaped). A value is
// acceptable for hydration only if it is a non-null object with all
// seven exact domain keys, each holding an array. Anything else
// (null, a string, a missing domain, a non-array domain) causes the
// WHOLE overlay to reset empty -- this can never affect IntakeFormData
// hydration, since it is read into a fully separate return value below.
// Malformed CONTENTS inside an otherwise-valid array (e.g. a candidate
// missing required fields) are explicitly NOT inspected here.
export function isValidProfessionalIntelligenceCandidatesOverlay(value: unknown): value is ProfessionalIntelligenceCandidates {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const domains = ["employment", "education", "certification", "business", "reference", "evidence", "strategicAnswer"] as const;
  return domains.every(d => Array.isArray(v[d]));
}

// PI-C3 — narrow, domain-agnostic candidate-array helpers (never moved
// into professional-intelligence.ts, which deliberately has zero
// production consumers by design). Used only by the Accept/Reject
// derivation/commit phases below. Pure; never mutate the input array.
//
// Derivation-phase lookup+guard (D-PI-C3-03): returns the candidate
// only when it exists AND is still "proposed" -- the single shared
// precondition for every domain's Accept/Reject. Returns null for a
// missing candidate or one already transitioned (e.g. a stale/repeated
// action), which callers treat as a silent no-op.
export function findProposedCandidate<T extends { id: string; status: CandidateStatus }>(
  arr: readonly T[], candidateId: string
): T | null {
  const found = arr.find(c => c.id === candidateId);
  return found && found.status === "proposed" ? found : null;
}

// Commit-phase array rebuild: replaces exactly one candidate's status,
// preserving its id/payload/provenance and every other candidate/
// domain array untouched. Only ever called after findProposedCandidate
// (and any domain-specific precondition) has already succeeded.
export function withCandidateStatus<T extends { id: string; status: CandidateStatus }>(
  arr: readonly T[], candidateId: string, status: CandidateStatus
): T[] {
  return arr.map(c => (c.id === candidateId ? { ...c, status } : c));
}

// Discriminates a P7-R4 envelope ({data, step, savedAt}) from a legacy
// bare IntakeFormData draft (any prior version of this code), and
// returns the module data to hydrate plus the validated resume step.
// Neither "data" nor "step" exists as a top-level IntakeFormData key,
// so there is no ambiguity between the two shapes.
//
// professionalIntelligenceCandidates (PI-B2A): always returns a fully
// valid, possibly-all-empty container -- never undefined, never a raw
// unvalidated value. A legacy bare-IntakeFormData draft (no envelope at
// all) and an old envelope predating this field both correctly resolve
// to an empty overlay via the exact same coarse guard.
export function parseDraftEnvelope(
  raw: string,
  total: number
): {
  saved: Partial<IntakeFormData>;
  resumeStep: number;
  professionalIntelligenceCandidates: ProfessionalIntelligenceCandidates;
  professionalIntelligenceEnrichments: ProfessionalIntelligenceEnrichments;
} {
  const parsed = JSON.parse(raw) as Partial<DraftEnvelope> & Partial<IntakeFormData>;
  const isEnvelope = typeof parsed === "object" && parsed !== null && "data" in parsed && "step" in parsed;
  if (isEnvelope) {
    const envelope = parsed as DraftEnvelope;
    const candidates = isValidProfessionalIntelligenceCandidatesOverlay(envelope.professionalIntelligenceCandidates)
      ? envelope.professionalIntelligenceCandidates
      : emptyProfessionalIntelligenceCandidates();
    // Malformed/absent enrichment sibling resets only the enrichment
    // overlay to empty -- never the candidate overlay, never the
    // IntakeFormData draft itself (mirrors the candidate guard's own
    // established isolation).
    const enrichments = isValidProfessionalIntelligenceEnrichmentsOverlay(envelope.professionalIntelligenceEnrichments)
      ? envelope.professionalIntelligenceEnrichments
      : emptyProfessionalIntelligenceEnrichments();
    return {
      saved: envelope.data ?? {},
      resumeStep: validateResumeStep(envelope.step, total),
      professionalIntelligenceCandidates: candidates,
      professionalIntelligenceEnrichments: enrichments,
    };
  }
  return {
    saved: parsed as Partial<IntakeFormData>,
    resumeStep: 0,
    professionalIntelligenceCandidates: emptyProfessionalIntelligenceCandidates(),
    professionalIntelligenceEnrichments: emptyProfessionalIntelligenceEnrichments(),
  };
}

// The exact destination-step arithmetic next()/back() apply, extracted
// so it is independently testable against the real branching logic
// (Module 10 -> 12 skip when Module 12 is not shown, clamped to the
// executable 0..total range) rather than a parallel reimplementation.
export function computeNextStep(step: number, show12: boolean, total: number): number {
  const raw = step === 10 && !show12 ? 12 : step + 1;
  return Math.min(raw, total);
}
export function computePrevStep(step: number, show12: boolean): number {
  const raw = step === 12 && !show12 ? 10 : step - 1;
  return Math.max(raw, 0);
}

const MODULE_TITLES = [
  { title: "Identidad del Aplicante",     subtitle: "Información básica para comenzar tu evaluación." },
  { title: "Documentos y Grupo Familiar", subtitle: "Documentos migratorios, estado civil e información de hijos." },
  { title: "Historial Migratorio",        subtitle: "Visitas, visas y antecedentes migratorios en USA." },
  { title: "Educación Formal",            subtitle: "Títulos universitarios y posgrados." },
  { title: "Cursos y Certificaciones",    subtitle: "Cursos, licencias y certificaciones profesionales." },
  { title: "Experiencia Profesional",     subtitle: "Tu historial laboral en detalle. Esta es la sección más importante." },
  { title: "Empresas Propias",            subtitle: "Emprendimientos o empresas que hayas fundado." },
  { title: "Referencias Profesionales",   subtitle: "Personas que pueden confirmar tu impacto." },
  { title: "Evidencia Existente",         subtitle: "Premios, publicaciones, medios y otros logros documentados." },
  { title: "Información Estratégica",     subtitle: "Preguntas abiertas para entender mejor tu trayectoria." },
  { title: "Servicios Estratégicos",           subtitle: "Opciones para fortalecer tu caso si hay áreas pendientes." },
  { title: "Información del Peticionario",      subtitle: "Datos de la empresa o persona que presenta la petición ante USCIS." },
  { title: "Opinión Consultiva y Acompañantes", subtitle: "Asociación profesional de referencia y personal de apoyo O-2 si aplica." },
  { title: "Resumen y Envío",                   subtitle: "Revisa tu progreso y envía tu información a ACTION USA." },
];

const genId = () => Math.random().toString(36).slice(2, 9);

const emptyDoc = () => ({
  has: null as boolean | null,
  notes: "",
  documentNumber: "",
  expiryDate: "",
  issuedDate: "",
  issuedCountry: "",
  issuedCity: "",
  visaSubtype: "",
  filePath: "",
  fileName: "",
});

const emptyAnswer = () => ({ answer: "", hasEvidence: null as boolean | null, filePath: "", fileName: "" });

const INITIAL: IntakeFormData = {
  module0: { cvFilePath: "", cvFileName: "", cvSource: "", coachAcknowledged: false, structuredProfile: emptyStructuredProfile(), coachConversation: [] },
  module1: {
    fullName:"", familyName:"", givenName:"", middleName:"", dateOfBirth:"", countryOfBirth:"", nationalities:"",
    countryOfResidence:"", cityOfResidence:"", email:"", whatsapp:"",
    profession:"", industry:"", yearsExperience:"", usaObjective:"", visaType:"",
    willChangeStatusInUSA:null,
    beneficiaryForeignStreetNumberName:"", beneficiaryForeignCity:"", beneficiaryForeignProvince:"",
    beneficiaryForeignPostalCode:"", beneficiaryForeignCountry:"",
    beneficiaryUSStreetNumberName:"", beneficiaryUSAptSteFlr:"", beneficiaryUSAptSteFlrNumber:"",
    beneficiaryUSCity:"", beneficiaryUSState:"", beneficiaryUSZipCode:"",
  },
  module2: {
    passport:emptyDoc(), usVisa:emptyDoc(), i94:emptyDoc(),
    isCurrentlyInUSA:null,
    i94EntryPassportNumber:"", i94EntryCountryOfIssuance:"", i94DateOfEntry:"",
    i94ClassOfAdmission:"", i94CurrentStatus:"",
    i797:emptyDoc(),
    ead:emptyDoc(), i20:emptyDoc(), ds2019:emptyDoc(),
    maritalStatus:"",
    spouse:{ name:"", nationality:"", countryOfResidence:"", profession:"" },
    spouseMarriageCert:emptyDoc(), spousePassport:emptyDoc(),
    spouseVisa:emptyDoc(), spouseI94:emptyDoc(),
    hasChildren:null, childrenDocs:[],
  },
  module4: {
    hasBeenInUSA:null, usaVisits:[],
    hasVisaRejection:null, visaRejections:[],
    hasDeportation:null, deportationDescription:"",
  },
  module5: {
    degrees:[{ id:genId(), institution:"", country:"", degreeType:"", degreeName:"", startYear:"", graduationYear:"", hasDiploma:"", filePath:"", fileName:"" }],
  },
  module6: { certifications:[] },
  module7: {
    employment:[{
      id:genId(), company:"", country:"", city:"", title:"",
      startDate:"", endDate:"", isCurrent:false,
      mainFunctions:"", importantProjects:"", mainAchievements:"",
      peopleSupervised:"0", managesBudget:null, budgetAmount:"",
      whyImportant:"", supervisorName:"", supervisorTitle:"",
      supervisorEmail:"", supervisorPhone:"", companyWebsite:"", internationalRecognition:"",
    }],
  },
  module8:  { hasOwnBusinesses:null, businesses:[] },
  module9:  { references:[{ id:genId(), name:"", currentTitle:"", company:"", country:"", email:"", phone:"", relationshipType:"", relationshipDuration:"", signerCredentials:"", specificAchievements:"", targetCriterionKey:"" }] },
  module10: {
    awardsStatus:"", awards:[], awardsDisposition:"",
    membershipsStatus:"", memberships:[], membershipsDisposition:"",
    mediaStatus:"", media:[], mediaDisposition:"",
    articlesStatus:"", articles:[], articlesDisposition:"",
    booksStatus:"", books:[], booksDisposition:"",
    conferencesStatus:"", conferences:[], conferencesDisposition:"",
    judgingStatus:"", judging:[], judgingDisposition:"",
    patentsStatus:"", patents:[], patentsDisposition:"",
    incomeEvidence:{
      hasTaxReturns:null, taxFilePath:"", taxFileName:"",
      hasCertifications:null, certFilePath:"", certFileName:"",
      hasContracts:null, contractFilePath:"", contractFileName:"",
    },
    hasWebsite:null, websiteUrl:"", websiteTopicIdea:"",
    artisticExhibitionsStatus: "", artisticExhibitions: [], artisticExhibitionsDisposition: "",
    performingArtsSuccessStatus: "", performingArtsSuccess: [], performingArtsSuccessDisposition: "",
    leadStarringRoleStatus: "", leadStarringRole: [], leadStarringRoleDisposition: "",
    criticalReviewsStatus: "", criticalReviews: [], criticalReviewsDisposition: "",
    criticalRoleOrgStatus: "", criticalRoleOrg: [], criticalRoleOrgDisposition: "",
    commercialSuccessStatus: "", commercialSuccess: [], commercialSuccessDisposition: "",
    significantRecognitionStatus: "", significantRecognition: [], significantRecognitionDisposition: "",
    criticalRoleStatus: "",
  },
  module11: {
    createdMethod:emptyAnswer(), ledImpactProjects:emptyAnswer(), solvedComplexProblems:emptyAnswer(),
    trainedProfessionals:emptyAnswer(), consultedForExpertise:emptyAnswer(), evaluatedOthers:emptyAnswer(),
    workedForRecognized:emptyAnswer(), aboveAverageIncome:emptyAnswer(),
    willingToConfirm:emptyAnswer(), additionalInfo:emptyAnswer(),
  },
  module12: { interest:"" },
  module14: {
    petitionerType: "",
    companyName: "", ein: "", stateOfIncorporation: "", companyDaytimePhone: "", companyMobilePhone: "", companyEmail: "",
    companyAddress: "", companyStreetNumberName: "", companyAptSteFlr: "", companyAptSteFlrNumber: "", companyCity: "", companyState: "", companyZipCode: "",
    representativeName: "", representativeFamilyName: "", representativeGivenName: "", representativeMiddleName: "", representativeTitle: "",
    companyArticlesPath: "", companyArticlesName: "", einDocPath: "", einDocName: "",
    petitionerFullName: "", petitionerFamilyName: "", petitionerGivenName: "", petitionerMiddleName: "", petitionerDateOfBirth: "", petitionerRelationship: "", petitionerSSN: "", petitionerITIN: "", petitionerDaytimePhone: "", petitionerMobilePhone: "", petitionerEmail: "",
    petitionerAddress: "", petitionerStreetNumberName: "", petitionerAptSteFlr: "", petitionerAptSteFlrNumber: "", petitionerCity: "", petitionerState: "", petitionerZipCode: "",
    petitionerIdPath: "", petitionerIdName: "", petitionerBirthCertPath: "", petitionerBirthCertName: "",
    agentName: "", agentEmployerName: "", agentAgreementType: "",
    businessNature: "", offeredPosition: "", basisForClassification: "", requestedAction: "", serviceStartDate: "", serviceEndDate: "",
    hasWrittenContract: null, contractPath: "", contractName: "", contractVerbalTerms: "",
    hasItinerary: null, itineraryItems: [],
    wantsPremiumProcessing: null, beneficiaryWorkState: "", filesI485Concurrent: null,
  },
  module15: {
    hasPeerGroup: "",
    peerGroupName: "", peerGroupStreetAddress: "", peerGroupCity: "", peerGroupState: "", peerGroupZipCode: "", peerGroupDateSent: "", peerGroupPhone: "",
    peerGroupLetterType: "", peerGroupLetterPath: "", peerGroupLetterName: "",
    alternativeContactName: "", alternativeContactOrg: "", alternativeContactRelation: "",
    noAssociationJustification: "", consultativeNotes: "",
    hasO2Companions: null, companions: [],
  },
};

function getModuleStatus(n: number, f: IntakeFormData): ModuleStatus {
  switch (n) {
    case 1: {
      const m = f.module1;
      const filled = [m.fullName, m.email, m.whatsapp, m.profession].filter(v => v.trim());
      if (filled.length === 4 && m.visaType) return "complete";
      if (filled.length > 0) return "partial";
      return "empty";
    }
    case 2: {
      const m = f.module2;
      const hasAnyDoc = [m.passport, m.usVisa, m.i94, m.i797, m.ead, m.i20, m.ds2019].some(d => d.has !== null);
      if (m.maritalStatus && m.hasChildren !== null && hasAnyDoc) return "complete";
      if (m.maritalStatus || m.hasChildren !== null || hasAnyDoc) return "partial";
      return "empty";
    }
    case 3: {
      const m = f.module4;
      const answered = [m.hasBeenInUSA, m.hasVisaRejection, m.hasDeportation].filter(v => v !== null);
      if (answered.length === 3) return "complete";
      if (answered.length > 0) return "partial";
      return "empty";
    }
    case 4: {
      const complete = f.module5.degrees.filter(d => d.institution && d.degreeName);
      if (complete.length > 0) return "complete";
      if (f.module5.degrees.some(d => d.institution || d.degreeName)) return "partial";
      return "empty";
    }
    case 5:
      return f.module6.certifications.length > 0 ? "partial" : "empty";
    case 6: {
      const good = f.module7.employment.filter(e => e.company && e.title && e.mainFunctions);
      if (good.length > 0) return "complete";
      if (f.module7.employment.some(e => e.company || e.title)) return "partial";
      return "empty";
    }
    case 7:
      if (f.module8.hasOwnBusinesses !== null) return f.module8.hasOwnBusinesses ? "partial" : "complete";
      return "empty";
    case 8: {
      const good = f.module9.references.filter(r => r.name && r.email);
      if (good.length >= 3) return "complete";
      if (good.length > 0) return "partial";
      return "empty";
    }
    case 9: {
      const filled = [
        f.module10.awardsStatus, f.module10.membershipsStatus, f.module10.mediaStatus,
        f.module10.articlesStatus, f.module10.booksStatus, f.module10.conferencesStatus,
        f.module10.judgingStatus, f.module10.patentsStatus,
      ].filter(s => s !== "");
      if (filled.length >= 5) return "complete";
      if (filled.length > 0) return "partial";
      return "empty";
    }
    case 10: {
      const answered = Object.values(f.module11).filter(v => (v as { answer: string }).answer.trim()).length;
      if (answered >= 7) return "complete";
      if (answered > 0) return "partial";
      return "empty";
    }
    case 11:
      return f.module12.interest ? "complete" : "empty";
    case 12: {
      const m = f.module14;
      if (m.petitionerType && m.offeredPosition && m.serviceStartDate) return "complete";
      if (m.petitionerType) return "partial";
      return "empty";
    }
    case 13: {
      if (f.module15.hasPeerGroup !== "") return "partial";
      return "empty";
    }
    default: return "empty";
  }
}

function shouldShowModule12(f: IntakeFormData): boolean {
  const score = [
    f.module10.awardsStatus, f.module10.membershipsStatus, f.module10.mediaStatus,
    f.module10.articlesStatus, f.module10.booksStatus, f.module10.conferencesStatus,
    f.module10.judgingStatus, f.module10.patentsStatus,
  ].filter(s => s === "tengo").length;
  return score < 3;
}

function SuccessScreen({ caseNumber, email }: { caseNumber: string; email: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-blue to-brand-blue-dark flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <Image src="/logo.png" alt="ACTION USA AI" width={200} height={60} className="mx-auto h-16 w-auto" priority/>
        </div>
        <div className="rounded-2xl bg-white shadow-2xl p-8 text-center space-y-5">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle size={48} className="text-green-600"/>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">¡Evaluación enviada!</h1>
            <p className="mt-2 text-gray-600">Tu información fue recibida y está siendo procesada.</p>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
            <p className="text-sm text-gray-500">Número de caso asignado</p>
            <p className="text-2xl font-bold text-brand-blue tracking-wider">{caseNumber}</p>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 text-left space-y-2">
            <p className="font-semibold">Próximos pasos:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Recibirás un email en <strong>{email}</strong> con el enlace para crear tu cuenta.</li>
              <li>Un especialista revisará tu evaluación en 1-3 días hábiles.</li>
              <li>Desde el portal podrás completar módulos pendientes y subir documentos.</li>
            </ul>
          </div>
          <p className="text-sm text-gray-500">
            ¿Preguntas?{" "}
            <a href="mailto:actionusaaillc@gmail.com" className="text-brand-blue hover:underline font-medium">
              actionusaaillc@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

interface IntakeFormProps {
  token: string;
  caseId: string;
  clientId: string;
  // B1 (M1-GAP-07, frozen design docs/intake/
  // A0-STRUCTURED-PROFILE-MODULE1-EXACT-DESIGN.md §J): the invitation's
  // already-known beneficiary email. Seeded into Structured Profile (never
  // assigned directly into Module 1) so the existing prefill path -- not a
  // new one -- carries it forward.
  invitationEmail: string;
}

// B1: builds the first-mount initial state, seeding Structured Profile's
// email field from the invitation when present -- without ever mutating
// the shared, module-level INITIAL constant (a fresh object is returned
// via spread). source="staff_entered" (an existing, previously-unused
// StructuredProfileSource member) -- never "beneficiary_confirmed": the
// invitation knowing the email is not the beneficiary confirming it.
// Used only as a useState lazy initializer (see call site) -- runs
// exactly once, on first mount, never on hydration/resume (hydration's
// own setData({...INITIAL, ...saved, ...}) always wins with the restored
// draft, per the existing P7-R4 resume path, untouched by this change).
export function buildInitialIntakeFormData(invitationEmail: string): IntakeFormData {
  const trimmed = invitationEmail.trim();
  if (!trimmed) return INITIAL;
  return {
    ...INITIAL,
    module0: {
      ...INITIAL.module0,
      structuredProfile: {
        ...INITIAL.module0.structuredProfile,
        email: acquireField(emptyField(), { value: trimmed, source: "staff_entered", confidence: "high" }),
      },
    },
  };
}

export function IntakeForm({ token, caseId, clientId, invitationEmail }: IntakeFormProps) {
  const storageKey    = `aucis_intake_draft_${token}`;
  const sessionIdKey  = `aucis_session_${token}`;

  const [step, setStep]               = useState(0);
  const [data, setData]               = useState<IntakeFormData>(() => buildInitialIntakeFormData(invitationEmail));
  // PI-B2A: independent of IntakeFormData/Module0Data by design (PI-B2
  // Exact Design's frozen draft-ownership boundary). No runtime producer
  // exists yet -- only initialization and draft hydration may populate
  // this state until a future, separately-authorized slice wires actual
  // A0 professional extraction.
  const [professionalIntelligenceCandidates, setProfessionalIntelligenceCandidates] =
    useState<ProfessionalIntelligenceCandidates>(() => emptyProfessionalIntelligenceCandidates());
  const [sessionId, setSessionId]     = useState("");
  const [loading, setLoading]         = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess]         = useState<{ caseNumber: string } | null>(null);
  const [savedAt, setSavedAt]         = useState<Date | null>(null);
  const [draftBanner, setDraftBanner] = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});

  // Latest Intake data available to the periodic saver without recreating
  // the timer on every keystroke (P7-R5).
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  // PI-B2A: mirrors dataRef's exact pattern so save() can serialize the
  // latest candidate snapshot without recreating its own stable
  // identity/interval. Set synchronously alongside the hydration
  // setProfessionalIntelligenceCandidates call too (not only via this
  // effect) so there is never a window where state holds hydrated
  // candidates but the ref still holds the pre-hydration empty value --
  // an immediate manual/checkpoint save between hydration and this
  // effect's next run could otherwise overwrite the just-hydrated
  // overlay with the stale ref value.
  const professionalIntelligenceCandidatesRef = useRef(professionalIntelligenceCandidates);
  useEffect(() => { professionalIntelligenceCandidatesRef.current = professionalIntelligenceCandidates; }, [professionalIntelligenceCandidates]);

  // PI-D0B: mirrors professionalIntelligenceCandidates's exact pattern.
  // Draft-only, separate overlay (never merged into the candidate
  // container) -- not part of IntakeFormData/Module0Data/StructuredProfile,
  // never in the final submission payload.
  const [professionalIntelligenceEnrichments, setProfessionalIntelligenceEnrichments] =
    useState<ProfessionalIntelligenceEnrichments>(() => emptyProfessionalIntelligenceEnrichments());
  const professionalIntelligenceEnrichmentsRef = useRef(professionalIntelligenceEnrichments);
  useEffect(() => { professionalIntelligenceEnrichmentsRef.current = professionalIntelligenceEnrichments; }, [professionalIntelligenceEnrichments]);

  // PI-D1D: IntakeForm is the sole, canonical owner (PI-D1-R2/R3) --
  // never persisted (no DraftEnvelope field, no localStorage, no final
  // submission, no server transport), never a Module0Data/
  // StructuredProfile concept. Mirrored by a ref for the same
  // stale-closure reason every other stable useCallback in this file
  // already reads a ref instead of the state variable directly.
  // Supersedes PI-D0B's ActiveProfessionalContext (manual/global
  // selection, never wired to any UI) outright -- no data migration was
  // ever needed since that state was always transient/never persisted.
  const [questionContext, setQuestionContext] = useState<QuestionProfessionalContext>({ mode: "none" });
  const questionContextRef = useRef(questionContext);
  useEffect(() => { questionContextRef.current = questionContext; }, [questionContext]);

  // PI-D1-R3-R1: candidateId-anchored cyclic rotation pointer. Plain ref
  // only (no paired useState) -- nothing ever renders from this value
  // directly; it is consumed solely by the snapshot-building effect
  // below, which already re-fires on every questionContext commit (the
  // same synchronous checkpoint that updates the pointer also always
  // calls setQuestionContext). Never persisted, never model-visible.
  const rotationNextCandidateIdRef = useRef<RotationPointer>(null);

  // PI-D1D: the exact bounded snapshot used for the IN-FLIGHT/most-recent
  // Coach request -- holds the full alias->candidateId->identity mapping
  // (application-only authority) that only IntakeForm ever sees. Built
  // fresh by the effect below whenever the inputs that determine it
  // change, and read again, unchanged, at checkpoint time to resolve a
  // returned alias -- never recomputed between send and checkpoint, so
  // alias resolution is always against the EXACT snapshot Coach was
  // shown (PI-D1-R2 §85 request-exact snapshot invariant).
  const boundedSnapshotRef = useRef<BoundedProfessionalSnapshot>({ entries: [], proposedNextRotationState: null });
  // Wire-safe mirror (candidateId stripped) handed to Module0 as a
  // plain prop -- Module0 never sees boundedSnapshotRef itself.
  const [boundedEmploymentContexts, setBoundedEmploymentContexts] = useState<BoundedEmploymentContext[]>([]);

  useEffect(() => {
    const snapshot = buildBoundedProfessionalSnapshot(
      questionContext,
      professionalIntelligenceCandidatesRef.current,
      rotationNextCandidateIdRef.current
    );
    boundedSnapshotRef.current = snapshot;
    setBoundedEmploymentContexts(snapshot.entries.map(e => ({ alias: e.alias, identity: e.identity })));
  }, [questionContext, professionalIntelligenceCandidates]);

  // Latest navigation position, mirroring dataRef so the stable-interval
  // autosave (and manual "Guardar borrador") can serialize the current
  // step without recreating the interval (P7-R4, CR-CPS-60).
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  // Marks the setData performed by draft hydration so the dirty-state
  // effect below does not treat "we just loaded the persisted draft" as
  // a new, unsaved edit (P7-R5).
  const justHydratedRef = useRef(false);

  // Marks a setData that is itself the direct, synchronous result of a
  // just-succeeded deterministic checkpoint (CP-01/02/03) so the
  // dirty-state effect below does not immediately re-invalidate the
  // savedAt that checkpoint just established (P7-R4, CR-CPS-60). Armed
  // ONLY by the onCheckpoint wiring below, only on a successful save();
  // never by save() itself, never unconditionally.
  const justCheckpointedRef = useRef(false);

  // Resume position read from a persisted draft envelope, held pending
  // until the beneficiary explicitly chooses Retomar (P7-R4, CR-CPS-60)
  // -- never applied to live navigation state before that choice.
  const [pendingResumeStep, setPendingResumeStep] = useState(0);

  // ── Canonical draft persistence (P7-R4/P7-R5) — the single function
  // that writes the localStorage draft envelope; used by the periodic
  // timer, the manual button, the Siguiente/Anterior position
  // checkpoints, and the CP-01/02/03 deterministic checkpoints alike.
  // Reads dataRef.current/stepRef.current rather than closing over
  // `data`/`step` directly so its identity stays stable across edits --
  // the interval built from it is created once, not recreated (and its
  // 30s countdown restarted) on every keystroke. Returns whether the
  // write succeeded so callers that need to know (the CP-01/02/03
  // checkpoint wiring) can react; callers that don't (autosave, manual
  // button, Siguiente/Anterior) may ignore the result.
  const save = useCallback((explicitData?: IntakeFormData, explicitStep?: number): boolean => {
    try {
      const envelope: DraftEnvelope = {
        data: explicitData ?? dataRef.current,
        step: explicitStep ?? stepRef.current,
        savedAt: new Date().toISOString(),
        professionalIntelligenceCandidates: professionalIntelligenceCandidatesRef.current,
        professionalIntelligenceEnrichments: professionalIntelligenceEnrichmentsRef.current,
      };
      localStorage.setItem(storageKey, JSON.stringify(envelope));
      setSavedAt(new Date());
      return true;
    } catch {
      return false;
    }
  }, [storageKey]);

  // ── CP-01/02/03 canonical checkpoint wiring (P7-R4, CR-CPS-60): Module0
  // computes its own next Module0Data slice exactly as it already does
  // for onChange (runA0()/confirmProfileField()/sendCoachMessage()'s
  // successful-turn branch), and this composes the full next
  // IntakeFormData from dataRef.current (never a possibly-stale `data`
  // closure) before checkpointing. onChange (here: setData) is always
  // called, whether persistence succeeded or failed -- a local storage
  // failure must never block the beneficiary's successful A0/Confirmar/
  // Coach result from reaching React state.
  const onModule0Checkpoint = useCallback((nextModule0: IntakeFormData["module0"]) => {
    const nextData: IntakeFormData = { ...dataRef.current, module0: nextModule0 };
    const persisted = save(nextData);
    if (persisted) { justCheckpointedRef.current = true; }
    setData(nextData);
  }, [save]);

  // PI-D1D — the frozen R1 unified Coach-turn checkpoint. Used ONLY by
  // Module0's sendCoachMessage success path (onModule0Checkpoint above
  // remains fully unchanged and still serves A0 completion/Confirmar).
  // Exact order (PI-D1-R2/R3, proven off-by-one-safe): (1) snapshot
  // current candidates/enrichments refs; (2) append this turn's
  // discoveries (all seven domains, additive, no dedup); (3) revalidate
  // incoming enrichment targets against the PRE-discovery candidate set
  // (PI-D1-R1 frozen invariant -- a Candidate discovered THIS message
  // can never simultaneously be this same message's own enrichment
  // target); (4) resolve the next question context from Coach's raw
  // topic signal, validated against THIS turn's own exact bounded
  // snapshot and the FINAL (post-discovery) candidate state; (5) assign
  // candidate/enrichment refs; (6) ONE save(); (7) mirror React state;
  // (8) only now, after the save, commit questionContext + rotation --
  // never before, so a failed/never-attempted checkpoint can never make
  // either authoritative (PI-D1-R3-R1 two-phase build/commit invariant).
  const onCoachTurnCheckpoint = useCallback((turn: {
    nextModule0: IntakeFormData["module0"];
    professionalIntelligence?: ProfessionalIntelligenceCoachResult;
    nextProfessionalTopic: NextProfessionalTopic;
  }) => {
    const currentCandidates = professionalIntelligenceCandidatesRef.current;
    const currentEnrichments = professionalIntelligenceEnrichmentsRef.current;
    let nextCandidates = currentCandidates;
    let nextEnrichments = currentEnrichments;
    let newEmploymentDiscoveries: EmploymentCandidate[] = [];

    if (turn.professionalIntelligence) {
      const { enrichments: incomingEnrichments, discoveries } = turn.professionalIntelligence;
      newEmploymentDiscoveries = discoveries.employment;

      nextCandidates = {
        employment: [...currentCandidates.employment, ...discoveries.employment],
        education: [...currentCandidates.education, ...discoveries.education],
        certification: [...currentCandidates.certification, ...discoveries.certification],
        business: [...currentCandidates.business, ...discoveries.business],
        reference: [...currentCandidates.reference, ...discoveries.reference],
        evidence: [...currentCandidates.evidence, ...discoveries.evidence],
        strategicAnswer: [...currentCandidates.strategicAnswer, ...discoveries.strategicAnswer],
      };

      const validEnrichments = incomingEnrichments.employment.filter(e => {
        const candidate = currentCandidates.employment.find(c => c.id === e.target.candidateId);
        return isContextAuthorizedTarget(candidate, e.target.candidateId);
      });
      nextEnrichments = { employment: [...currentEnrichments.employment, ...validEnrichments] };
    }

    const nextQuestionContext = resolveNextQuestionContext(
      turn.nextProfessionalTopic,
      boundedSnapshotRef.current,
      nextCandidates,
      newEmploymentDiscoveries
    );

    const nextData: IntakeFormData = { ...dataRef.current, module0: turn.nextModule0 };

    professionalIntelligenceCandidatesRef.current = nextCandidates;
    professionalIntelligenceEnrichmentsRef.current = nextEnrichments;

    const persisted = save(nextData);
    if (persisted) { justCheckpointedRef.current = true; }

    setData(nextData);
    setProfessionalIntelligenceCandidates(nextCandidates);
    setProfessionalIntelligenceEnrichments(nextEnrichments);

    // Commit question context + rotation ONLY after the save above --
    // never before (PI-D1-R3-R1 two-phase invariant).
    questionContextRef.current = nextQuestionContext;
    setQuestionContext(nextQuestionContext);
    rotationNextCandidateIdRef.current = boundedSnapshotRef.current.proposedNextRotationState;
  }, [save]);

  // PI-B2B: source-scoped replacement of cv_extraction-provenance
  // candidates with this run's results (replaceCvExtractionCandidates --
  // never dedup). Ref and state are updated synchronously, mirroring
  // dataRef's pattern; no save() call here -- persistence rides the
  // existing checkpoint/autosave/manual-save mechanisms.
  //
  // PI-D0B extension: a candidate carrying a beneficiary-accepted
  // enrichment is protected from this replacement (PI-D0-R1 §W) --
  // proposed/rejected enrichments never protect their target, only
  // "accepted" ones. Any enrichment orphaned by the resulting candidate
  // overlay (its target no longer resolves) is removed by exact
  // candidateId existence only -- no semantic/fuzzy re-anchor. If the
  // current Active Professional Context's target no longer resolves to
  // an eligible candidate in the next overlay, it is cleared in this
  // same synchronous operation -- no automatic replacement context is
  // ever selected. No new save() call is introduced here, matching this
  // handler's own existing, frozen deferred-persistence behavior.
  const handleProfessionalCandidatesExtracted = useCallback((incoming: ProfessionalIntelligenceCandidates) => {
    const currentEnrichments = professionalIntelligenceEnrichmentsRef.current;
    const protectedCandidateIds = new Set(
      currentEnrichments.employment
        .filter(e => e.status === "accepted" && e.target.domain === "employment")
        .map(e => e.target.candidateId)
    );
    const nextCandidates = replaceCvExtractionCandidates(professionalIntelligenceCandidatesRef.current, incoming, protectedCandidateIds);
    const nextEnrichments = removeOrphanedEnrichments(currentEnrichments, nextCandidates);

    professionalIntelligenceCandidatesRef.current = nextCandidates;
    professionalIntelligenceEnrichmentsRef.current = nextEnrichments;
    setProfessionalIntelligenceCandidates(nextCandidates);
    setProfessionalIntelligenceEnrichments(nextEnrichments);

    // PI-D1D: supersedes the old ActiveProfessionalContext cleanup with
    // the narrower R3 context-authorized check (status===proposed, exact
    // id match -- no cv_extraction requirement, since a safely-bound
    // Coach-discovered pin must survive this check too if it still
    // exists after replacement; it simply never could have been CV-only
    // to begin with, so replaceCvExtractionCandidates never touches it).
    const current = questionContextRef.current;
    if (current.mode === "known_employment") {
      const candidate = nextCandidates.employment.find(c => c.id === current.candidateId);
      if (!isContextAuthorizedTarget(candidate, current.candidateId)) {
        questionContextRef.current = { mode: "none" };
        setQuestionContext({ mode: "none" });
      }
    }
  }, []);

  // PI-D0B — explicit beneficiary enrichment Accept (D-PI-D-R1-01/
  // PI-D0/PI-D0-R1). Same derive-fully-before-commit discipline as
  // PI-C3's candidate handlers: every precondition is checked before
  // any ref/state/draft mutation; a failed precondition is a silent
  // no-op. Reads refs, never React state, for the same stale-closure
  // reason as every other stable handler here. Accepting an enrichment
  // never touches the base candidate, never touches module data, and
  // never changes Active Context by itself (D-PI-D-R1 preserved
  // unchanged -- enrichment Accept/Reject is orthogonal to base
  // candidate eligibility).
  const handleAcceptEnrichment = useCallback((enrichmentId: string) => {
    const enrichments = professionalIntelligenceEnrichmentsRef.current;
    const enrichment = enrichments.employment.find(e => e.id === enrichmentId);
    if (!enrichment) return;
    if (enrichment.status !== "proposed") return;
    if (enrichment.target.domain !== "employment") return;

    const targetCandidate = professionalIntelligenceCandidatesRef.current.employment.find(c => c.id === enrichment.target.candidateId);
    if (!targetCandidate || !isCandidateEligibleForEnrichmentAnchor(targetCandidate)) return;

    const hasNonblankField = [enrichment.patch.mainFunctions, enrichment.patch.importantProjects, enrichment.patch.mainAchievements]
      .some(v => typeof v === "string" && v.trim() !== "");
    if (!hasNonblankField) return;

    const nextEnrichments: ProfessionalIntelligenceEnrichments = {
      employment: enrichments.employment.map(e => (e.id === enrichmentId ? { ...e, status: "accepted" } : e)),
    };

    professionalIntelligenceEnrichmentsRef.current = nextEnrichments;
    const persisted = save();
    if (persisted) { justCheckpointedRef.current = true; }
    setProfessionalIntelligenceEnrichments(nextEnrichments);
  }, [save]);

  // PI-D0B — explicit beneficiary enrichment Reject. No target
  // revalidation required (rejection never touches the base candidate
  // or module data either way); same silent no-op discipline for a
  // missing/non-proposed enrichment.
  const handleRejectEnrichment = useCallback((enrichmentId: string) => {
    const enrichments = professionalIntelligenceEnrichmentsRef.current;
    const enrichment = enrichments.employment.find(e => e.id === enrichmentId);
    if (!enrichment) return;
    if (enrichment.status !== "proposed") return;

    const nextEnrichments: ProfessionalIntelligenceEnrichments = {
      employment: enrichments.employment.map(e => (e.id === enrichmentId ? { ...e, status: "rejected" } : e)),
    };

    professionalIntelligenceEnrichmentsRef.current = nextEnrichments;
    const persisted = save();
    if (persisted) { justCheckpointedRef.current = true; }
    setProfessionalIntelligenceEnrichments(nextEnrichments);
  }, [save]);

  // ── PI-C3 — explicit beneficiary Accept (D-PI-C3-01/02/03) ──────────────────
  // Candidate ≠ module data until this runs. Derivation (lookup,
  // proposed-status guard, domain precondition, adapter call,
  // nextData/nextCandidates) completes fully and synchronously before
  // any ref/state/draft mutation -- a guarded/failed derivation
  // performs zero mutation of any kind (D-PI-C3-03). Reads the
  // candidate ref, never the possibly-one-render-stale React state, so
  // a rapid repeated click (Accept->Accept, Accept->Reject,
  // Reject->Accept) always sees the just-committed status and becomes
  // a no-op on its second invocation. Always reuses the existing,
  // unmodified save(explicitData?) -- the candidate ref is assigned
  // synchronously first (save() has no candidate-override parameter),
  // then save(nextData) performs exactly one coherent draft write
  // containing both the new module data and the new candidate status.
  const handleAcceptCandidate = useCallback((domain: ProfessionalIntelligenceCandidateDomain, candidateId: string) => {
    const candidates = professionalIntelligenceCandidatesRef.current;
    const enrichments = professionalIntelligenceEnrichmentsRef.current;
    const current = dataRef.current;
    let nextData: IntakeFormData;
    let nextCandidates: ProfessionalIntelligenceCandidates;

    switch (domain) {
      case "employment": {
        const candidate = findProposedCandidate(candidates.employment, candidateId);
        if (!candidate) return;
        // PI-D0B: composeEffectiveCandidate already ignores proposed/
        // rejected/wrong-target enrichments on its own -- passing the
        // whole employment enrichment array (in its existing overlay
        // order) is simplest and correct; no pre-filtering needed.
        const effectiveCandidate = composeEffectiveCandidate(candidate, enrichments.employment);
        const entry = candidateToEmploymentEntry(effectiveCandidate);
        nextData = { ...current, module7: { employment: [...current.module7.employment, entry] } };
        nextCandidates = { ...candidates, employment: withCandidateStatus(candidates.employment, candidateId, "accepted_in_module") };
        break;
      }
      case "education": {
        const candidate = findProposedCandidate(candidates.education, candidateId);
        if (!candidate) return;
        const entry = candidateToEducationEntry(candidate);
        nextData = { ...current, module5: { degrees: [...current.module5.degrees, entry] } };
        nextCandidates = { ...candidates, education: withCandidateStatus(candidates.education, candidateId, "accepted_in_module") };
        break;
      }
      case "certification": {
        const candidate = findProposedCandidate(candidates.certification, candidateId);
        if (!candidate) return;
        const entry = candidateToCertificationEntry(candidate);
        nextData = { ...current, module6: { certifications: [...current.module6.certifications, entry] } };
        nextCandidates = { ...candidates, certification: withCandidateStatus(candidates.certification, candidateId, "accepted_in_module") };
        break;
      }
      case "business": {
        const candidate = findProposedCandidate(candidates.business, candidateId);
        if (!candidate) return;
        const entry = candidateToBusinessEntry(candidate);
        nextData = {
          ...current,
          module8: { ...current.module8, hasOwnBusinesses: true, businesses: [...current.module8.businesses, entry] },
        };
        nextCandidates = { ...candidates, business: withCandidateStatus(candidates.business, candidateId, "accepted_in_module") };
        break;
      }
      case "reference": {
        const candidate = findProposedCandidate(candidates.reference, candidateId);
        if (!candidate) return;
        const entry = candidateToReferenceEntry(candidate);
        nextData = { ...current, module9: { references: [...current.module9.references, entry] } };
        nextCandidates = { ...candidates, reference: withCandidateStatus(candidates.reference, candidateId, "accepted_in_module") };
        break;
      }
      case "evidence": {
        const candidate = findProposedCandidate(candidates.evidence, candidateId);
        if (!candidate) return;
        // D-PI-C3-01: a {} patch (target status already decided) still
        // resolves the beneficiary's explicit Accept -- the candidate
        // transitions even though no module value changes.
        const patch = candidateToEvidenceStatusPatch(candidate, current.module10);
        nextData = { ...current, module10: { ...current.module10, ...patch } };
        nextCandidates = { ...candidates, evidence: withCandidateStatus(candidates.evidence, candidateId, "accepted_in_module") };
        break;
      }
      case "strategicAnswer": {
        const candidate = findProposedCandidate(candidates.strategicAnswer, candidateId);
        if (!candidate) return;
        // D-PI-C3-02: only valid while the target answer is still
        // blank -- a non-empty existing beneficiary-authored answer is
        // a silent no-op (candidate remains proposed, zero mutation).
        if (current.module11[candidate.targetField].answer.trim() !== "") return;
        const patch = candidateToStrategicAnswerPatch(candidate, current.module11);
        nextData = { ...current, module11: { ...current.module11, ...patch } };
        nextCandidates = { ...candidates, strategicAnswer: withCandidateStatus(candidates.strategicAnswer, candidateId, "accepted_in_module") };
        break;
      }
    }

    // PI-D1D: base Accept is the authoritative transition point for
    // clearing a matching question context (PI-D1-R3 §47 — pin validity
    // requires status===proposed, which Accept's own "accepted_in_module"
    // transition always violates) -- IntakeForm already owns both, so
    // this happens synchronously in this same handler, not via a
    // separate effect.
    const nextQuestionContext: QuestionProfessionalContext =
      domain === "employment" && questionContextRef.current.mode === "known_employment" && questionContextRef.current.candidateId === candidateId
        ? { mode: "none" }
        : questionContextRef.current;

    professionalIntelligenceCandidatesRef.current = nextCandidates;
    questionContextRef.current = nextQuestionContext;
    const persisted = save(nextData);
    if (persisted) { justCheckpointedRef.current = true; }
    setData(nextData);
    setProfessionalIntelligenceCandidates(nextCandidates);
    setQuestionContext(nextQuestionContext);
  }, [save]);

  // ── PI-C3 — explicit beneficiary Reject (D-PI-C3-03) ────────────────────────
  // Module data is never touched. Same ref-based lookup/guard
  // discipline as Accept, so a repeated/stale action is a silent
  // no-op. save() is called with NO explicit data argument -- module
  // data is unchanged, so dataRef.current (save()'s own default) is
  // already correct; only the candidate ref needs a synchronous
  // pre-assignment, for the same reason explained above.
  const handleRejectCandidate = useCallback((domain: ProfessionalIntelligenceCandidateDomain, candidateId: string) => {
    const candidates = professionalIntelligenceCandidatesRef.current;
    const enrichments = professionalIntelligenceEnrichmentsRef.current;
    let nextCandidates: ProfessionalIntelligenceCandidates;
    let nextEnrichments: ProfessionalIntelligenceEnrichments = enrichments;

    switch (domain) {
      case "employment": {
        if (!findProposedCandidate(candidates.employment, candidateId)) return;
        nextCandidates = { ...candidates, employment: withCandidateStatus(candidates.employment, candidateId, "rejected") };
        // PI-D0B: a rejected A0 candidate must never remain a Coach
        // anchor (REJECTED_A0_AS_ANCHOR: PROHIBITED) -- every exact-
        // target enrichment (proposed, accepted, or already rejected)
        // is removed outright rather than silently reinterpreted as a
        // new discovery (no semantic transformation without an explicit
        // beneficiary action on that specific enrichment).
        nextEnrichments = { employment: enrichments.employment.filter(e => e.target.candidateId !== candidateId) };
        break;
      }
      case "education": {
        if (!findProposedCandidate(candidates.education, candidateId)) return;
        nextCandidates = { ...candidates, education: withCandidateStatus(candidates.education, candidateId, "rejected") };
        break;
      }
      case "certification": {
        if (!findProposedCandidate(candidates.certification, candidateId)) return;
        nextCandidates = { ...candidates, certification: withCandidateStatus(candidates.certification, candidateId, "rejected") };
        break;
      }
      case "business": {
        if (!findProposedCandidate(candidates.business, candidateId)) return;
        nextCandidates = { ...candidates, business: withCandidateStatus(candidates.business, candidateId, "rejected") };
        break;
      }
      case "reference": {
        if (!findProposedCandidate(candidates.reference, candidateId)) return;
        nextCandidates = { ...candidates, reference: withCandidateStatus(candidates.reference, candidateId, "rejected") };
        break;
      }
      case "evidence": {
        if (!findProposedCandidate(candidates.evidence, candidateId)) return;
        nextCandidates = { ...candidates, evidence: withCandidateStatus(candidates.evidence, candidateId, "rejected") };
        break;
      }
      case "strategicAnswer": {
        if (!findProposedCandidate(candidates.strategicAnswer, candidateId)) return;
        nextCandidates = { ...candidates, strategicAnswer: withCandidateStatus(candidates.strategicAnswer, candidateId, "rejected") };
        break;
      }
    }

    // PI-D1D: same authoritative-transition reasoning as base Accept --
    // base Reject clears a matching question context synchronously in
    // this same handler.
    const nextQuestionContext: QuestionProfessionalContext =
      domain === "employment" && questionContextRef.current.mode === "known_employment" && questionContextRef.current.candidateId === candidateId
        ? { mode: "none" }
        : questionContextRef.current;

    professionalIntelligenceCandidatesRef.current = nextCandidates;
    professionalIntelligenceEnrichmentsRef.current = nextEnrichments;
    questionContextRef.current = nextQuestionContext;
    const persisted = save();
    if (persisted) { justCheckpointedRef.current = true; }
    setProfessionalIntelligenceCandidates(nextCandidates);
    setProfessionalIntelligenceEnrichments(nextEnrichments);
    setQuestionContext(nextQuestionContext);
  }, [save]);

  // ── Init session ID and load draft ─────────────────────────────────────────
  useEffect(() => {
    try {
      let sid = localStorage.getItem(sessionIdKey);
      if (!sid) {
        sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        localStorage.setItem(sessionIdKey, sid);
      }
      setSessionId(sid);
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const {
          saved, resumeStep,
          professionalIntelligenceCandidates: hydratedCandidates,
          professionalIntelligenceEnrichments: hydratedEnrichments,
        } = parseDraftEnvelope(raw, TOTAL);
        justHydratedRef.current = true;
        // Set the refs synchronously, in the same tick as the state
        // updates below, so there is never a window where state holds
        // the hydrated overlay but the ref still holds the pre-hydration
        // empty value (see the refs' own comments above). Question
        // context and the rotation pointer are never hydrated -- both
        // start at their fresh defaults ({mode:"none"}/null) on every
        // load, by design (PI-D1-R2/R3-R1: transient, never persisted) --
        // a safe presentation-order reset, never a reconstruction
        // attempt from coachConversation history.
        professionalIntelligenceCandidatesRef.current = hydratedCandidates;
        professionalIntelligenceEnrichmentsRef.current = hydratedEnrichments;
        setProfessionalIntelligenceCandidates(hydratedCandidates);
        setProfessionalIntelligenceEnrichments(hydratedEnrichments);
        setData({
          ...INITIAL,
          ...saved,
          module2:  { ...INITIAL.module2, ...(saved.module2 ?? {}) },
          module4: {
            ...INITIAL.module4,
            ...(({ hasBeenInUSA, usaVisits, hasVisaRejection, visaRejections, hasDeportation, deportationDescription }) =>
              ({ hasBeenInUSA, usaVisits, hasVisaRejection, visaRejections, hasDeportation, deportationDescription })
            )(saved.module4 ?? INITIAL.module4),
          },
          module10: { ...INITIAL.module10, ...(saved.module10 ?? {}), incomeEvidence: { ...INITIAL.module10.incomeEvidence, ...(saved.module10?.incomeEvidence ?? {}) } },
          module14: { ...INITIAL.module14, ...(saved.module14 ?? {}) },
          module15: { ...INITIAL.module15, ...(saved.module15 ?? {}) },
        });
        // Validated resume position is held pending, not applied yet --
        // live `step` remains 0 until the beneficiary clicks Retomar.
        setPendingResumeStep(resumeStep);
        setDraftBanner(true);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Autosave every 30 seconds — stable interval, independent of how
  // often `data` changes (P7-R5: previously `save` closed over `data`
  // directly, so its useCallback identity -- and the interval built from
  // it -- was recreated on every edit, restarting the 30s countdown and
  // potentially deferring persistence indefinitely during continuous
  // active editing). ──────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => save(), 30_000);
    return () => clearInterval(id);
  }, [save]);

  // ── Saved indicator must be truthful (P7-R5): invalidate it as soon as
  // Intake data changes after the last successful save. The change
  // hydration itself performs is not a new, unsaved edit -- it IS what's
  // already persisted -- so it is excluded via justHydratedRef. A
  // successful CP-01/02/03 checkpoint's own setData is likewise excluded
  // via justCheckpointedRef (P7-R4, CR-CPS-60) -- it IS what was just
  // persisted, not a new unsaved edit either. ─────────────────────────
  useEffect(() => {
    if (justHydratedRef.current) { justHydratedRef.current = false; return; }
    if (justCheckpointedRef.current) { justCheckpointedRef.current = false; return; }
    setSavedAt(null);
  }, [data]);

  // Prefill Engine (design §5.5): runs whenever Structured Profile
  // changes, never overwrites a field the beneficiary/staff already
  // populated (enforced inside prefillModule1 itself).
  useEffect(() => {
    setData(p => ({ ...p, module1: prefillModule1(p.module1, p.module0.structuredProfile) }));
  }, [data.module0.structuredProfile]);

  const statuses = Array.from({ length: 13 }, (_, i) => getModuleStatus(i + 1, data));
  const show12   = shouldShowModule12(data);

  function validate(): boolean {
    if (step === 0) {
      // R-01 (CR-CPS-37/38): CV is an optional acquisition accelerator,
      // never a mandatory entry gate. Coach remains the only mandatory
      // Module0 requirement -- information completeness is enforced
      // downstream by Automated Readiness (src/lib/intake/readiness.ts),
      // never by requiring a CV to exist.
      const e: Record<string, string> = {};
      if (!data.module0.coachAcknowledged) e.coach = "Completa la conversación con el Coach antes de continuar.";
      setErrors(e);
      if (Object.keys(e).length > 0) { window.scrollTo({ top: 0, behavior: "smooth" }); return false; }
      return true;
    }
    if (step !== 1) return true;
    const e: Record<string, string> = {};
    const m = data.module1;
    if (!m.fullName.trim())   e.fullName   = "Requerido.";
    if (!m.email.trim())      e.email      = "Requerido.";
    else if (!/\S+@\S+\.\S+/.test(m.email)) e.email = "Email inválido.";
    if (!m.whatsapp.trim())   e.whatsapp   = "Requerido.";
    if (!m.profession.trim()) e.profession = "Requerido.";
    setErrors(e);
    if (Object.keys(e).length > 0) { window.scrollTo({ top: 0, behavior: "smooth" }); return false; }
    return true;
  }

  function next() {
    if (!validate()) return;
    // P7-R4/P7-R5: persist the state being navigated from, together with
    // the destination step, before advancing -- rather than leaving
    // either to wait for the next periodic tick. The same clamped
    // destination value is both persisted and rendered.
    const nextStep = computeNextStep(step, show12, TOTAL);
    save(undefined, nextStep);
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    // P7-R4: Anterior is an intentional navigation action too -- persist
    // the destination step here as well, so Retomar cannot resume at a
    // later step than the one the beneficiary deliberately stepped back
    // to. `data` is unchanged by Anterior, so this is a step-only
    // checkpoint (dataRef fallback).
    const prevStep = computePrevStep(step, show12);
    save(undefined, prevStep);
    setStep(prevStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    setLoading(true);
    setSubmitError(null);
    save();
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          moduleStatuses: statuses,
          // Invitation context — wired for future use in /api/intake
          invitationToken: token,
          invitationCaseId: caseId,
          invitationClientId: clientId,
          structuredProfile: data.module0.structuredProfile,
          // CR-CPS-40 D-2: `acknowledged` is the same signal the client
          // UI already requires (Module0's mandatory Coach gate) --
          // transmitted alongside the transcript, not in place of it,
          // so readiness can require both (see readiness.ts).
          coachConversation: { turns: data.module0.coachConversation, acknowledged: data.module0.coachAcknowledged },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al enviar");
      localStorage.removeItem(storageKey);
      setSuccess({ caseNumber: json.caseNumber });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error desconocido. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (success) return <SuccessScreen caseNumber={success.caseNumber} email={data.module1.email}/>;

  const meta     = step === 0
    ? { title: "Perfil Profesional (Coach + CV)", subtitle: "Sube tu CV/currículum y completa la conversación con el Coach para que podamos conocer tu trayectoria." }
    : MODULE_TITLES[step - 1];
  const progress = Math.round((step / TOTAL) * 100);

  return (
    <IntakeTokenProvider value={token}>
    <div className="min-h-screen bg-gradient-to-br from-brand-blue to-brand-blue-dark py-8 px-4">
      <div className="mx-auto max-w-3xl">

        {/* Logo */}
        <div className="mb-5 text-center">
          <Image src="/logo.png" alt="ACTION USA AI" width={200} height={60} className="mx-auto h-12 w-auto" priority/>
          <p className="mt-1.5 text-xs text-blue-200">AUCIS — ACTION USA Case Intelligence System</p>
        </div>

        {/* Draft resume banner */}
        {draftBanner && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm text-white backdrop-blur">
            <span>📋 Encontramos un borrador guardado.</span>
            <div className="flex gap-2">
              <button onClick={() => { setDraftBanner(false); setStep(pendingResumeStep); }}
                className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/30 transition-colors">
                Retomar
              </button>
              <button onClick={() => { setData(INITIAL); setDraftBanner(false); localStorage.removeItem(storageKey); }}
                className="rounded-lg bg-brand-red/80 px-3 py-1.5 text-xs font-medium hover:bg-brand-red transition-colors">
                Comenzar de nuevo
              </button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">

          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100">
            <div className="h-full bg-brand-red transition-all duration-500" style={{ width: `${progress}%` }}/>
          </div>

          {/* Header */}
          <div className="border-b border-gray-100 px-6 py-5 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-red">
                  Módulo {step} de {TOTAL}
                </span>
                <h2 className="mt-0.5 text-xl font-bold text-brand-blue">{meta.title}</h2>
                <p className="mt-1 text-sm text-gray-500">{meta.subtitle}</p>
              </div>
              <div className="mt-1 flex shrink-0 flex-wrap justify-end gap-1 max-w-[130px]">
                {Array.from({ length: TOTAL }, (_, i) => {
                  const s = i < 13 ? statuses[i] : null;
                  return (
                    <div key={i}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        i + 1 < step
                          ? s === "complete" ? "bg-green-500" : s === "partial" ? "bg-amber-400" : "bg-brand-red"
                          : i + 1 === step ? "bg-brand-blue" : "bg-gray-200"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Autosave indicator */}
          {savedAt && (
            <div className="flex items-center gap-1.5 bg-green-50 px-6 py-1.5 text-xs text-green-700">
              <Save size={11}/> Borrador guardado
            </div>
          )}

          {/* Module content */}
          <div className="px-6 py-6 sm:px-8">
            {step === 0  && <Module0  data={data.module0}  onChange={m => setData(p => ({ ...p, module0:  m }))} onCheckpoint={onModule0Checkpoint} onProfessionalCandidatesExtracted={handleProfessionalCandidatesExtracted} onCoachTurnCheckpoint={onCoachTurnCheckpoint} professionalContext={questionContext.mode === "known_employment" ? { domain: "employment", candidateId: questionContext.candidateId, identity: questionContext.identity } : undefined} boundedEmploymentContexts={boundedEmploymentContexts} sessionId={sessionId} errors={errors}/>}
            {step === 0  && <ProfessionalCandidateReview candidates={professionalIntelligenceCandidates} enrichments={professionalIntelligenceEnrichments} onAccept={handleAcceptCandidate} onReject={handleRejectCandidate} onAcceptEnrichment={handleAcceptEnrichment} onRejectEnrichment={handleRejectEnrichment}/>}
            {step === 1  && <Module1  data={data.module1}  onChange={m => setData(p => ({ ...p, module1:  m }))} errors={errors}/>}
            {step === 2  && <Module2  data={data.module2}  onChange={m => setData(p => ({ ...p, module2:  m }))} sessionId={sessionId}/>}
            {step === 3  && <Module3  data={data.module4}  onChange={m => setData(p => ({ ...p, module4:  m }))}/>}
            {step === 4  && <Module4  data={data.module5}  onChange={m => setData(p => ({ ...p, module5:  m }))} sessionId={sessionId}/>}
            {step === 5  && <Module5  data={data.module6}  onChange={m => setData(p => ({ ...p, module6:  m }))} sessionId={sessionId}/>}
            {step === 6  && <Module6  data={data.module7}  onChange={m => setData(p => ({ ...p, module7:  m }))}/>}
            {step === 7  && <Module7  data={data.module8}  onChange={m => setData(p => ({ ...p, module8:  m }))}/>}
            {step === 8  && <Module8  data={data.module9}  onChange={m => setData(p => ({ ...p, module9:  m }))} visaType={data.module1.visaType}/>}
            {step === 9  && <Module9  data={data.module10} onChange={m => setData(p => ({ ...p, module10: m }))} sessionId={sessionId}/>}
            {step === 10 && <Module10 data={data.module11} onChange={m => setData(p => ({ ...p, module11: m }))} sessionId={sessionId}/>}
            {step === 11 && <Module11 data={data.module12} onChange={m => setData(p => ({ ...p, module12: m }))}/>}
            {step === 12 && <Module12 data={data.module14} onChange={m => setData(p => ({ ...p, module14: m }))} sessionId={sessionId} visaType={data.module1.visaType}/>}
            {step === 13 && <Module13 data={data.module15} onChange={m => setData(p => ({ ...p, module15: m }))} sessionId={sessionId} profession={data.module1.profession} industry={data.module1.industry} visaType={data.module1.visaType}/>}
            {step === 14 && <Summary statuses={statuses} show12={show12} loading={loading} error={submitError} onSubmit={submit}/>}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-4 sm:px-8">
            <button type="button" onClick={back} disabled={step === 0}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 transition-colors">
              <ChevronLeft size={16}/> Anterior
            </button>

            <div className="hidden text-center sm:block">
              <p className="text-xs text-gray-400">{progress}% completado</p>
              <button type="button" onClick={() => save()}
                className="mt-0.5 flex items-center gap-1 text-xs text-gray-400 hover:text-brand-blue transition-colors">
                <Save size={11}/> Guardar borrador
              </button>
            </div>

            {step < TOTAL && (
              <button type="button" onClick={next}
                className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark transition-colors shadow-sm">
                Siguiente <ChevronRight size={16}/>
              </button>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-blue-300">
          Tu información es confidencial y está protegida por nuestras políticas de privacidad.
          Guardado automáticamente cada 30 segundos.
        </p>
      </div>
    </div>
    </IntakeTokenProvider>
  );
}
