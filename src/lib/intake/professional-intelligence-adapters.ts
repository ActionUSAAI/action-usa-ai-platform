// AUSCIS Post-Module1 Professional Intelligence — Candidate Acceptance
// Adapters (PI-C1). Pure, deterministic (except fresh-entry ID
// generation), side-effect-free translation from a proposed
// ProfessionalIntelligenceCandidate into the exact existing target
// module entry/patch shape (CLOSED PI-C Exact Design).
//
// There is NO acceptance runtime here -- the candidate's own lifecycle
// field is never inspected or assigned, no React/browser-storage/
// network/governed-knowledge/Evidence persistence is touched, and no
// target module component is modified. Target shapes are imported
// verbatim from the existing, unmodified src/app/intake/types.ts --
// this file defines no new canonical domain model and no parallel type
// system.
//
// Candidate.id and the target module entry's own id are different
// conceptual identities (PI-C Exact Design §AC) -- every array-entry
// adapter below generates a fresh id with the exact same expression
// every target module's own emptyX() constructor already uses
// (Math.random().toString(36).slice(2, 9)); candidate.id is never
// reused.
//
// Business.role and Reference.relationshipType are free text on the
// candidate but closed enums on the target -- no semantic/fuzzy
// classification is authorized (Owner decision:
// BUSINESS_ROLE_AUTO_MAPPING/REFERENCE_RELATIONSHIP_AUTO_MAPPING = NO).
// Both adapters below leave the target enum field "" and copy nothing
// into it; the candidate's own role/relationshipType value is left
// untouched on the candidate itself for a future PI-C2 read-only hint.
//
// Evidence acceptance ceiling (PI-C Exact Design §K, frozen): the
// maximum permitted mutation is a single status field "" -> "tal_vez",
// and only when that field is currently "" -- an existing beneficiary
// decision ("tengo"/"no_tengo"/"tal_vez") is never overwritten. No
// items[] entry, no disposition, no file, no criticalRole object, no
// "tengo" is ever produced here.

import type {
  EmploymentCandidate, EducationCandidate, CertificationCandidate,
  BusinessCandidate, ReferenceCandidate, EvidenceCandidate, StrategicAnswerCandidate,
} from "./professional-intelligence";
import type {
  EmploymentEntry, DegreeEntry, CertEntry, BusinessEntry, ReferenceEntry,
  Module9, Module10, EvidenceStatus,
} from "@/app/intake/types";

function freshEntryId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ── Employment (candidate -> canonical Module6 / legacy module7.employment[]) ───
// PI-D2-R1: isCurrent maps candidate.currentEmployment === true verbatim --
// the one durable fact PI-D2 completion can establish that Module6's own
// isCurrent checkbox already models. A candidate with no explicit
// current-employment confirmation (UNKNOWN, including a plain incomplete
// candidate that was never completed at all) maps to isCurrent: false --
// not a new semantic claim, but the exact same conservative value
// Module6 itself already produces for a freshly-added, not-yet-filled-in
// row (Module6.tsx's own emptyEmployment() literal). This is the frozen,
// bounded UNKNOWN-at-Accept information-loss point (PI-D2-R1 §O) --
// EmploymentEntry has no tri-state equivalent, and none is introduced here.
export function candidateToEmploymentEntry(candidate: EmploymentCandidate): EmploymentEntry {
  return {
    id: freshEntryId(),
    company: candidate.company,
    country: "",
    city: "",
    title: candidate.title,
    startDate: candidate.startDate,
    endDate: candidate.endDate,
    isCurrent: candidate.currentEmployment === true,
    mainFunctions: candidate.mainFunctions,
    importantProjects: candidate.importantProjects,
    mainAchievements: candidate.mainAchievements,
    peopleSupervised: "0",
    managesBudget: null,
    budgetAmount: "",
    whyImportant: "",
    supervisorName: "",
    supervisorTitle: "",
    supervisorEmail: "",
    supervisorPhone: "",
    companyWebsite: "",
    internationalRecognition: "",
  };
}

// ── Education (candidate -> canonical Module4 / legacy module5.degrees[]) ──────
export function candidateToEducationEntry(candidate: EducationCandidate): DegreeEntry {
  return {
    id: freshEntryId(),
    institution: candidate.institution,
    country: "",
    degreeType: "",
    degreeName: candidate.degreeName,
    startYear: "",
    graduationYear: candidate.graduationYear,
    hasDiploma: "",
    filePath: "",
    fileName: "",
  };
}

// ── Certification (candidate -> canonical Module5 / legacy module6.certifications[]) ──
export function candidateToCertificationEntry(candidate: CertificationCandidate): CertEntry {
  return {
    id: freshEntryId(),
    name: candidate.name,
    institution: candidate.institution,
    country: "",
    year: candidate.year,
    isActive: "",
    hasCertificate: null,
    filePath: "",
    fileName: "",
  };
}

// ── Business (candidate -> canonical Module7 / legacy module8.businesses[]) ─────
// candidate.role is NEVER copied into the target's closed role enum
// (""|fundador|cofundador|ceo|cto|otro) -- no semantic classification
// is authorized. module8.hasOwnBusinesses is domain-specific module
// STATE, not part of this entry adapter's output -- a future
// acceptance handler (PI-C3) owns setting it, not PI-C1.
export function candidateToBusinessEntry(candidate: BusinessCandidate): BusinessEntry {
  return {
    id: freshEntryId(),
    name: candidate.name,
    country: "",
    foundedYear: candidate.foundedYear,
    industry: "",
    role: "",
    isActive: null,
    employeeCount: "",
    description: "",
    website: "",
  };
}

// ── Reference (candidate -> canonical Module8 / legacy module9.references[]) ────
// candidate.relationshipType is NEVER copied into the target's closed
// relationshipType enum -- no semantic classification is authorized.
export function candidateToReferenceEntry(candidate: ReferenceCandidate): ReferenceEntry {
  return {
    id: freshEntryId(),
    name: candidate.name,
    currentTitle: "",
    company: "",
    country: "",
    email: "",
    phone: "",
    relationshipType: "",
    relationshipDuration: "",
    signerCredentials: "",
    specificAchievements: candidate.specificAchievements,
    targetCriterionKey: "",
  };
}

// ── Evidence (candidate + current Module9 -> bounded status patch) ─────────────
// Explicit, non-arithmetic category -> status-field map (mirrors
// module-numbering.ts's own anti-derivation discipline).
const EVIDENCE_CATEGORY_STATUS_FIELD = {
  awards: "awardsStatus",
  memberships: "membershipsStatus",
  media: "mediaStatus",
  judging: "judgingStatus",
  criticalRole: "criticalRoleStatus",
  artisticExhibitions: "artisticExhibitionsStatus",
} as const satisfies Record<EvidenceCandidate["category"], keyof Module9>;

export function candidateToEvidenceStatusPatch(
  candidate: EvidenceCandidate,
  current: Module9
): Partial<Module9> {
  const field = EVIDENCE_CATEGORY_STATUS_FIELD[candidate.category];
  const currentValue = current[field] as EvidenceStatus;
  if (currentValue !== "") {
    // An existing beneficiary decision (tengo/no_tengo/tal_vez) is
    // never overwritten -- no-op, not a weaker/partial patch.
    return {};
  }
  return { [field]: "tal_vez" } as Partial<Module9>;
}

// ── Strategic Answer (candidate + current Module10 -> bounded answer patch) ────
// Only `answer` is ever patched; hasEvidence/filePath/fileName are
// preserved exactly from the current target object -- acceptance never
// implies evidence possession.
export function candidateToStrategicAnswerPatch(
  candidate: StrategicAnswerCandidate,
  current: Module10
): Partial<Module10> {
  const field = candidate.targetField;
  return {
    [field]: { ...current[field], answer: candidate.answer },
  } as Partial<Module10>;
}
