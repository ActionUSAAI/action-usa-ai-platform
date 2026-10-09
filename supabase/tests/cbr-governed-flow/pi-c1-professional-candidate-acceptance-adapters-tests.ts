// Implementation PI-C1 — Professional Candidate Acceptance Adapters.
// Non-database, non-network, non-LLM unit tests against the REAL
// production exports of src/lib/intake/professional-intelligence-adapters.ts
// (imported by path, not reimplemented) — mirrors pi-a/pi-b1/pi-b2a/
// pi-b2b's own established convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-c1-professional-candidate-acceptance-adapters-tests.ts
//
// Scope: the pure candidate -> target-module-shape adapter layer only.
// There is NO acceptance runtime yet — candidate.status is never read
// or written anywhere in this file's production target, and that is
// itself proven structurally below (§Q), not merely left untested.

import { readFileSync } from "fs";
import {
  candidateToEmploymentEntry,
  candidateToEducationEntry,
  candidateToCertificationEntry,
  candidateToBusinessEntry,
  candidateToReferenceEntry,
  candidateToEvidenceStatusPatch,
  candidateToStrategicAnswerPatch,
} from "../../../src/lib/intake/professional-intelligence-adapters";
import type {
  EmploymentCandidate, EducationCandidate, CertificationCandidate,
  BusinessCandidate, ReferenceCandidate, EvidenceCandidate, StrategicAnswerCandidate,
  CandidateProvenance, EvidenceCandidateCategory,
} from "../../../src/lib/intake/professional-intelligence";
import type { Module9, Module10, EvidenceStatus } from "../../../src/app/intake/types";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const ADAPTERS_FILE = "../../../src/lib/intake/professional-intelligence-adapters.ts";
const adaptersSrc = readFileSync(require.resolve(ADAPTERS_FILE), "utf8");

const prov = (overrides: Partial<CandidateProvenance> = {}): CandidateProvenance =>
  ({ source: "cv_extraction", rawText: "x", confidence: "high", ...overrides });

function emptyModule9(): Module9 {
  return {
    awardsStatus: "", awards: [], awardsDisposition: "",
    membershipsStatus: "", memberships: [], membershipsDisposition: "",
    mediaStatus: "", media: [], mediaDisposition: "",
    articlesStatus: "", articles: [], articlesDisposition: "",
    booksStatus: "", books: [], booksDisposition: "",
    conferencesStatus: "", conferences: [], conferencesDisposition: "",
    judgingStatus: "", judging: [], judgingDisposition: "",
    patentsStatus: "", patents: [], patentsDisposition: "",
    incomeEvidence: {
      hasTaxReturns: null, taxFilePath: "", taxFileName: "",
      hasCertifications: null, certFilePath: "", certFileName: "",
      hasContracts: null, contractFilePath: "", contractFileName: "",
    },
    hasWebsite: null, websiteUrl: "", websiteTopicIdea: "",
    artisticExhibitionsStatus: "", artisticExhibitions: [], artisticExhibitionsDisposition: "",
    performingArtsSuccessStatus: "", performingArtsSuccess: [], performingArtsSuccessDisposition: "",
    leadStarringRoleStatus: "", leadStarringRole: [], leadStarringRoleDisposition: "",
    criticalReviewsStatus: "", criticalReviews: [], criticalReviewsDisposition: "",
    criticalRoleOrgStatus: "", criticalRoleOrg: [], criticalRoleOrgDisposition: "",
    commercialSuccessStatus: "", commercialSuccess: [], commercialSuccessDisposition: "",
    significantRecognitionStatus: "", significantRecognition: [], significantRecognitionDisposition: "",
    criticalRoleStatus: "",
  };
}

function emptyModule10(): Module10 {
  const a = () => ({ answer: "", hasEvidence: null, filePath: "", fileName: "" });
  return {
    createdMethod: a(), ledImpactProjects: a(), solvedComplexProblems: a(),
    trainedProfessionals: a(), consultedForExpertise: a(), evaluatedOthers: a(),
    workedForRecognized: a(), aboveAverageIncome: a(),
    willingToConfirm: a(), additionalInfo: a(),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// §29 — EMPLOYMENT
// ════════════════════════════════════════════════════════════════════════════
{
  const candidate: EmploymentCandidate = {
    id: "cand-emp-1", domain: "employment", status: "proposed", provenance: [prov()],
    company: "Expedia", title: "Senior Engineer", startDate: "2019-01", endDate: "2021-06",
    mainFunctions: "Led backend team", importantProjects: "Payments rewrite", mainAchievements: "+20% uptime",
  };
  const frozen = JSON.stringify(candidate);
  const entry = candidateToEmploymentEntry(candidate);

  check("T01 company copied exactly", entry.company === "Expedia");
  check("T02 title copied exactly", entry.title === "Senior Engineer");
  check("T03 startDate copied exactly", entry.startDate === "2019-01");
  check("T04 endDate copied exactly", entry.endDate === "2021-06");
  check("T05 mainFunctions copied exactly", entry.mainFunctions === "Led backend team");
  check("T06 importantProjects copied exactly", entry.importantProjects === "Payments rewrite");
  check("T07 mainAchievements copied exactly", entry.mainAchievements === "+20% uptime");
  check("T08 target-only defaults exact",
    entry.country === "" && entry.city === "" && entry.isCurrent === false &&
    entry.peopleSupervised === "0" && entry.managesBudget === null && entry.budgetAmount === "" &&
    entry.whyImportant === "" && entry.supervisorName === "" && entry.supervisorTitle === "" &&
    entry.supervisorEmail === "" && entry.supervisorPhone === "" && entry.companyWebsite === "" &&
    entry.internationalRecognition === "");
  check("T09 fresh entry id is a 7-char string", typeof entry.id === "string" && entry.id.length === 7);
  check("T10 candidate id not reused for module entry", entry.id !== candidate.id);
  check("T11 input candidate not mutated", JSON.stringify(candidate) === frozen);
  check("T12 no provenance/status copied into module entry",
    !("provenance" in entry) && !("status" in entry) && !("domain" in entry));

  // Partial/blank candidate — adapter must not reject
  const blank: EmploymentCandidate = {
    id: "cand-emp-2", domain: "employment", status: "proposed", provenance: [prov()],
    company: "", title: "", startDate: "", endDate: "", mainFunctions: "", importantProjects: "", mainAchievements: "",
  };
  const blankEntry = candidateToEmploymentEntry(blank);
  check("T13 fully blank candidate still translates (no rejection, producer-independent)",
    blankEntry.company === "" && blankEntry.title === "" && typeof blankEntry.id === "string");
  check("T14 two calls on different candidates produce distinct fresh ids", entry.id !== blankEntry.id);
}

// ════════════════════════════════════════════════════════════════════════════
// §30 — EDUCATION
// ════════════════════════════════════════════════════════════════════════════
{
  const candidate: EducationCandidate = {
    id: "cand-edu-1", domain: "education", status: "proposed", provenance: [prov()],
    institution: "Universidad de los Andes", degreeName: "Ingeniería de Sistemas", graduationYear: "2015",
  };
  const frozen = JSON.stringify(candidate);
  const entry = candidateToEducationEntry(candidate);

  check("T15 institution copied", entry.institution === "Universidad de los Andes");
  check("T16 degreeName copied", entry.degreeName === "Ingeniería de Sistemas");
  check("T17 graduationYear copied", entry.graduationYear === "2015");
  check("T18 native defaults exact",
    entry.country === "" && entry.degreeType === "" && entry.startYear === "" &&
    entry.hasDiploma === "" && entry.filePath === "" && entry.fileName === "");
  check("T19 fresh id, 7 chars", typeof entry.id === "string" && entry.id.length === 7);
  check("T20 no inferred degreeType/country (both blank, never guessed)", entry.degreeType === "" && entry.country === "");
  check("T21 no diploma/evidence claim", entry.hasDiploma === "" && entry.filePath === "" && entry.fileName === "");
  check("T22 input candidate unchanged", JSON.stringify(candidate) === frozen);
}

// ════════════════════════════════════════════════════════════════════════════
// §31 — CERTIFICATION
// ════════════════════════════════════════════════════════════════════════════
{
  const candidate: CertificationCandidate = {
    id: "cand-cert-1", domain: "certification", status: "proposed", provenance: [prov()],
    name: "AWS Solutions Architect", institution: "Amazon", year: "2022",
  };
  const frozen = JSON.stringify(candidate);
  const entry = candidateToCertificationEntry(candidate);

  check("T23 name/institution/year copied", entry.name === "AWS Solutions Architect" && entry.institution === "Amazon" && entry.year === "2022");
  check("T24 native defaults exact", entry.country === "" && entry.isActive === "" && entry.filePath === "" && entry.fileName === "");
  check("T25 fresh id, 7 chars", typeof entry.id === "string" && entry.id.length === 7);
  check("T26 hasCertificate remains null", entry.hasCertificate === null);
  check("T27 no file path/name created", entry.filePath === "" && entry.fileName === "");
  check("T28 no active-status inference", entry.isActive === "");
  check("T29 input unchanged", JSON.stringify(candidate) === frozen);
}

// ════════════════════════════════════════════════════════════════════════════
// §32 — BUSINESS (dangerous free-text role)
// ════════════════════════════════════════════════════════════════════════════
{
  const candidate: BusinessCandidate = {
    id: "cand-biz-1", domain: "business", status: "proposed", provenance: [prov()],
    name: "Mi Empresa SAS", role: "Owner", foundedYear: "2018",
  };
  const frozen = JSON.stringify(candidate);
  const entry = candidateToBusinessEntry(candidate);

  check("T30 candidate.role remains unchanged after adapter call", candidate.role === "Owner" && JSON.stringify(candidate) === frozen);
  check("T31 output.role is exactly empty string (no semantic enum conversion)", entry.role === "");
  check("T32 name/foundedYear copied", entry.name === "Mi Empresa SAS" && entry.foundedYear === "2018");
  check("T33 fresh id, 7 chars", typeof entry.id === "string" && entry.id.length === 7);
  check("T34 hasOwnBusinesses is NOT part of adapter output", !("hasOwnBusinesses" in entry));
  check("T35 input unchanged", JSON.stringify(candidate) === frozen);

  const candidate2: BusinessCandidate = { ...candidate, id: "cand-biz-2", role: "Partner" };
  const entry2 = candidateToBusinessEntry(candidate2);
  check("T36 second dangerous role (\"Partner\") also never mapped", entry2.role === "");
}

// ════════════════════════════════════════════════════════════════════════════
// §33 — REFERENCE (dangerous free-text relationshipType)
// ════════════════════════════════════════════════════════════════════════════
{
  const candidate: ReferenceCandidate = {
    id: "cand-ref-1", domain: "reference", status: "proposed", provenance: [prov()],
    name: "Dr. Robert Chen", relationshipType: "Former technical manager", specificAchievements: "Confirmed the platform migration",
  };
  const frozen = JSON.stringify(candidate);
  const entry = candidateToReferenceEntry(candidate);

  check("T37 candidate.relationshipType unchanged", candidate.relationshipType === "Former technical manager");
  check("T38 output.relationshipType is exactly empty string (no inferred enum)", entry.relationshipType === "");
  check("T39 name/specificAchievements copied", entry.name === "Dr. Robert Chen" && entry.specificAchievements === "Confirmed the platform migration");
  check("T40 email remains empty string", entry.email === "");
  check("T41 fresh id, 7 chars", typeof entry.id === "string" && entry.id.length === 7);
  check("T42 input unchanged", JSON.stringify(candidate) === frozen);
}

// ════════════════════════════════════════════════════════════════════════════
// §34 — EVIDENCE — hard firewall
// ════════════════════════════════════════════════════════════════════════════
{
  const CATEGORY_FIELD: Record<EvidenceCandidateCategory, keyof Module9> = {
    awards: "awardsStatus",
    memberships: "membershipsStatus",
    media: "mediaStatus",
    judging: "judgingStatus",
    criticalRole: "criticalRoleStatus",
    artisticExhibitions: "artisticExhibitionsStatus",
  };

  for (const category of Object.keys(CATEGORY_FIELD) as EvidenceCandidateCategory[]) {
    const field = CATEGORY_FIELD[category];
    const candidate: EvidenceCandidate = {
      id: `cand-ev-${category}`, domain: "evidence", status: "proposed", provenance: [prov()], category,
    };

    const blank = emptyModule9();
    const frozenBlank = JSON.stringify(blank);
    const patch = candidateToEvidenceStatusPatch(candidate, blank);
    check(`T43 [${category}] "" -> patch sets exactly {${field}: "tal_vez"}`,
      Object.keys(patch).length === 1 && (patch as Record<string, unknown>)[field] === "tal_vez");
    check(`T44 [${category}] current evidence state not mutated`, JSON.stringify(blank) === frozenBlank);

    for (const already of ["tengo", "no_tengo", "tal_vez"] as EvidenceStatus[]) {
      const decided = { ...emptyModule9(), [field]: already } as Module9;
      const frozenDecided = JSON.stringify(decided);
      const noopPatch = candidateToEvidenceStatusPatch(candidate, decided);
      check(`T45 [${category}] current "${already}" -> {} no-op (never overwrites existing decision)`,
        Object.keys(noopPatch).length === 0);
      check(`T46 [${category}] current "${already}" state not mutated`, JSON.stringify(decided) === frozenDecided);
    }
  }

  // Structural firewall on the actionable patch itself
  const sample: EvidenceCandidate = { id: "cand-ev-x", domain: "evidence", status: "proposed", provenance: [prov()], category: "awards" };
  const patch = candidateToEvidenceStatusPatch(sample, emptyModule9());
  check("T47 patch has no items array key", !("awards" in patch));
  check("T48 patch has no disposition key", !("awardsDisposition" in patch));
  check("T49 patch has no filePath/fileName key", !("filePath" in patch) && !("fileName" in patch));
  check("T50 patch has no criticalRole object key", !("criticalRole" in patch));
  check("T51 patch value is never \"tengo\"", Object.values(patch).every(v => v !== "tengo"));
}

// ════════════════════════════════════════════════════════════════════════════
// §35 — STRATEGIC ANSWER
// ════════════════════════════════════════════════════════════════════════════
{
  const current = emptyModule10();
  current.willingToConfirm = { answer: "old answer", hasEvidence: true, filePath: "p/f.pdf", fileName: "f.pdf" };
  const frozenCurrent = JSON.stringify(current);

  const candidate: StrategicAnswerCandidate = {
    id: "cand-sa-1", domain: "strategicAnswer", status: "proposed", provenance: [prov()],
    targetField: "willingToConfirm", answer: "Yes, three former colleagues confirmed in writing.",
  };
  const frozenCandidate = JSON.stringify(candidate);
  const patch = candidateToStrategicAnswerPatch(candidate, current);

  check("T52 only targetField key present in patch", Object.keys(patch).length === 1 && "willingToConfirm" in patch);
  check("T53 answer becomes candidate.answer", patch.willingToConfirm?.answer === "Yes, three former colleagues confirmed in writing.");
  check("T54 existing hasEvidence preserved exactly (never forced to true)", patch.willingToConfirm?.hasEvidence === true);
  check("T55 existing filePath preserved exactly", patch.willingToConfirm?.filePath === "p/f.pdf");
  check("T56 existing fileName preserved exactly", patch.willingToConfirm?.fileName === "f.pdf");
  check("T57 current input not mutated", JSON.stringify(current) === frozenCurrent);
  check("T58 candidate input not mutated", JSON.stringify(candidate) === frozenCandidate);

  // additionalInfo — minimum second target field required by the gate
  const candidate2: StrategicAnswerCandidate = {
    id: "cand-sa-2", domain: "strategicAnswer", status: "proposed", provenance: [prov()],
    targetField: "additionalInfo", answer: "Relevant context not asked elsewhere.",
  };
  const patch2 = candidateToStrategicAnswerPatch(candidate2, emptyModule10());
  check("T59 additionalInfo patched, no other key present", Object.keys(patch2).length === 1 && "additionalInfo" in patch2);
  check("T60 additionalInfo answer set, hasEvidence/filePath/fileName preserved from current (null/empty)",
    patch2.additionalInfo?.answer === "Relevant context not asked elsewhere." &&
    patch2.additionalInfo?.hasEvidence === null && patch2.additionalInfo?.filePath === "" && patch2.additionalInfo?.fileName === "");
  check("T61 no evidence claim introduced for additionalInfo", patch2.additionalInfo?.hasEvidence !== true);
}

// ════════════════════════════════════════════════════════════════════════════
// §36 — STRUCTURAL FIREWALL TESTS
// ════════════════════════════════════════════════════════════════════════════
{
  const forbiddenLiterals = [
    "fetch(", "localStorage", "supabase", "createClient", "StructuredProfile",
    "acquireField", "confirmField", "acceptedModuleEntryId", "setData",
    "setProfessionalIntelligenceCandidates", "getModuleStatus",
  ];
  for (const lit of forbiddenLiterals) {
    check(`T62 adapter source contains no "${lit}"`, !adaptersSrc.includes(lit));
  }
  check("T63 no import from React", !/from\s+["']react["']/.test(adaptersSrc));
  check("T64 no import from IntakeForm.tsx", !adaptersSrc.includes("IntakeForm"));
  check("T65 no import from Module0.tsx", !adaptersSrc.includes("Module0"));
  check("T66 no import from any API route path", !/from\s+["'].*\/api\//.test(adaptersSrc));
  check("T67 no CBR reference", !/\bCBR\b|\bcbr\b/.test(adaptersSrc));
  check("T68 EvidenceCandidate type name legitimately present (not falsely banned)", adaptersSrc.includes("EvidenceCandidate"));
  check("T69 no candidate.status read/write anywhere in source", !/candidate\.status/.test(adaptersSrc) && !/\.status\s*=/.test(adaptersSrc));
  check("T70 no markAccepted/markRejected/transitionCandidate helper defined", !/markAccepted|markRejected|transitionCandidate/.test(adaptersSrc));
}

console.log(failures === 0 ? "\nALL PI-C1 CHECKS PASS" : `\n${failures} PI-C1 CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
