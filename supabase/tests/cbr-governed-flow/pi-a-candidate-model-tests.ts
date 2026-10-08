// Implementation PI-A — Post-Module1 Professional Intelligence,
// Candidate Model Foundation. Non-database, non-network, non-LLM unit
// tests against the REAL production export
// src/lib/intake/professional-intelligence.ts (imported by path, not
// reimplemented) — mirrors c1/a1/a2/a4/b1's own established convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-a-candidate-model-tests.ts
//
// Scope: the candidate model/comparator foundation only. Zero
// IntakeFormData/Module0/StructuredProfile/DraftEnvelope coupling is
// proven structurally (§W). No lifecycle mutation, no A0/Coach wiring,
// no runtime consumption — none of that exists yet, by design.

import { readFileSync } from "fs";
import {
  emptyProfessionalIntelligenceCandidates,
  type CandidateProvenance,
  type EmploymentCandidate,
  type EducationCandidate,
  type CertificationCandidate,
  type BusinessCandidate,
  type ReferenceCandidate,
  type EvidenceCandidate,
  type StrategicAnswerCandidate,
  employmentSameIdentity, employmentMaterialEquals,
  educationSameIdentity, educationMaterialEquals,
  certificationSameIdentity, certificationMaterialEquals,
  businessSameIdentity, businessMaterialEquals,
  referenceSameIdentity, referenceMaterialEquals,
  evidenceSameIdentity, evidenceMaterialEquals,
  strategicAnswerSameIdentity, strategicAnswerMaterialEquals,
} from "../../../src/lib/intake/professional-intelligence";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const PROD_FILE = "../../../src/lib/intake/professional-intelligence.ts";

// ── Core model ───────────────────────────────────────────────────────────────
{
  const c = emptyProfessionalIntelligenceCandidates();
  const keys = Object.keys(c).sort();
  check("T01 emptyProfessionalIntelligenceCandidates() has exactly seven keys",
    keys.length === 7 && JSON.stringify(keys) === JSON.stringify(["business","certification","education","employment","evidence","reference","strategicAnswer"].sort()));
  check("T02 all seven values are arrays", Object.values(c).every(v => Array.isArray(v)));
  check("T03 all seven arrays are empty", Object.values(c).every(v => (v as unknown[]).length === 0));
}
{
  const c1 = emptyProfessionalIntelligenceCandidates();
  const c2 = emptyProfessionalIntelligenceCandidates();
  check("T04 two constructor calls return distinct root objects", c1 !== c2);
  check("T05 corresponding arrays from two calls are distinct references",
    c1.employment !== c2.employment && c1.education !== c2.education && c1.certification !== c2.certification &&
    c1.business !== c2.business && c1.reference !== c2.reference && c1.evidence !== c2.evidence &&
    c1.strategicAnswer !== c2.strategicAnswer);
}
{
  const p1: CandidateProvenance = { source: "cv_extraction", rawText: "Senior Engineer at Expedia", confidence: "high" };
  const p2: CandidateProvenance = { source: "coach_discovery", rawText: "I worked as Senior Engineer at Expedia", confidence: "medium" };
  check("T06 CandidateProvenance supports cv_extraction and coach_discovery", p1.source === "cv_extraction" && p2.source === "coach_discovery");
  const provenance: CandidateProvenance[] = [p1, p2];
  check("T07 candidate provenance can contain two entries simultaneously", provenance.length === 2);
}
{
  const src = readFileSync(require.resolve(PROD_FILE), "utf8");
  const statusDecl = src.match(/export type CandidateStatus = ([^;]+);/)?.[1] ?? "";
  check("T08 CandidateStatus is exactly \"proposed\" | \"accepted_in_module\" | \"rejected\"",
    statusDecl.replace(/\s+/g, " ").trim() === '"proposed" | "accepted_in_module" | "rejected"');
  check("T09 CandidateStatus excludes reviewed/conflict/superseded",
    !statusDecl.includes("reviewed") && !statusDecl.includes("conflict") && !statusDecl.includes("superseded"));
}

// ── Normalization (via public comparator functions) ─────────────────────────
{
  const base: Omit<EmploymentCandidate, "mainFunctions" | "importantProjects" | "mainAchievements"> = {
    id: "e1", domain: "employment", status: "proposed",
    provenance: [{ source: "cv_extraction", rawText: "x", confidence: "high" }],
    company: "  Expedia  ", title: "Senior   Engineer", startDate: "2022-01", endDate: "2023-01",
  };
  const a: EmploymentCandidate = { ...base, mainFunctions: "Led backend team", importantProjects: "", mainAchievements: "" };
  const b: EmploymentCandidate = { ...base, company: "expedia", title: "senior engineer", startDate: "2022-01", endDate: "2023-01",
    mainFunctions: "led backend team", importantProjects: "", mainAchievements: "" };
  check("T10 leading/trailing whitespace ignored + case ignored + repeated internal whitespace ignored", employmentSameIdentity(a, b) && employmentMaterialEquals(a, b));

  const c: EmploymentCandidate = { ...base, company: "Expedia, Inc.", mainFunctions: "", importantProjects: "", mainAchievements: "" };
  check("T11 punctuation NOT ignored (Expedia vs Expedia, Inc. differ)", !employmentSameIdentity({ ...a, mainFunctions: "", importantProjects: "", mainAchievements: "" }, c));

  const d: EmploymentCandidate = { ...base, company: "Expédia", mainFunctions: "", importantProjects: "", mainAchievements: "" };
  check("T12 accents NOT removed (Expedia vs Expédia differ)", !employmentSameIdentity({ ...a, mainFunctions: "", importantProjects: "", mainAchievements: "" }, d));

  check("T13 materially different strings remain different", !employmentMaterialEquals(a, { ...b, mainFunctions: "Completely different duties" }));
}

// ── Employment (date-overlap established: HTML <input type="month"> "YYYY-MM") ──
function emp(overrides: Partial<EmploymentCandidate> = {}): EmploymentCandidate {
  return {
    id: "e", domain: "employment", status: "proposed",
    provenance: [{ source: "cv_extraction", rawText: "x", confidence: "high" }],
    company: "Expedia", title: "Senior Engineer", startDate: "2022-01", endDate: "2023-01",
    mainFunctions: "", importantProjects: "", mainAchievements: "",
    ...overrides,
  };
}
check("T14 same company/title + overlapping dates = same identity",
  employmentSameIdentity(emp(), emp({ startDate: "2022-06", endDate: "2023-06" })));
check("T15 same company/title + non-overlapping dates = different identity",
  !employmentSameIdentity(emp({ startDate: "2020-01", endDate: "2020-12" }), emp({ startDate: "2022-01", endDate: "2023-01" })));
check("T16 different company = different identity", !employmentSameIdentity(emp(), emp({ company: "Amazon" })));
check("T17 different title = different identity", !employmentSameIdentity(emp(), emp({ title: "Staff Engineer" })));
check("T18 same identity + identical material payload = material equals true",
  employmentMaterialEquals(emp({ mainFunctions: "a", importantProjects: "b", mainAchievements: "c" }), emp({ mainFunctions: "a", importantProjects: "b", mainAchievements: "c" })));
check("T19 same identity + complementary payload (one blank, one filled) = false",
  !employmentMaterialEquals(emp({ mainFunctions: "" }), emp({ mainFunctions: "Led a team of 8" })));
check("T20 same identity + conflicting material payload = false",
  !employmentMaterialEquals(emp({ mainFunctions: "Led backend" }), emp({ mainFunctions: "Led frontend" })));
check("T21 blank endDate (e.g. still-employed statement with no isCurrent field in the model) -> not same identity (conservative, never silently assumed open-ended)",
  !employmentSameIdentity(emp({ endDate: "" }), emp({ startDate: "2024-01", endDate: "2024-06" })));
check("T22 blank/unparseable startDate -> not same identity (conservative)", !employmentSameIdentity(emp({ startDate: "" }), emp()));

// ── Education ────────────────────────────────────────────────────────────────
function edu(overrides: Partial<EducationCandidate> = {}): EducationCandidate {
  return { id: "d", domain: "education", status: "proposed", provenance: [{ source: "cv_extraction", rawText: "x", confidence: "high" }],
    institution: "Universidad de los Andes", degreeName: "Ingeniería de Sistemas", graduationYear: "2015", ...overrides };
}
check("T23 same normalized institution+degreeName = same identity", educationSameIdentity(edu(), edu({ institution: "  universidad de los andes  " })));
check("T24 different institution = different identity", !educationSameIdentity(edu(), edu({ institution: "MIT" })));
check("T25 different degreeName = different identity", !educationSameIdentity(edu(), edu({ degreeName: "Medicina" })));
check("T26 same identity + same graduationYear = materially equal", educationMaterialEquals(edu(), edu()));
check("T27 same identity + different graduationYear = not materially equal", !educationMaterialEquals(edu(), edu({ graduationYear: "2016" })));

// ── Certification ────────────────────────────────────────────────────────────
function cert(overrides: Partial<CertificationCandidate> = {}): CertificationCandidate {
  return { id: "c", domain: "certification", status: "proposed", provenance: [{ source: "cv_extraction", rawText: "x", confidence: "high" }],
    name: "AWS Solutions Architect", institution: "Amazon", year: "2022", ...overrides };
}
check("T28 identity = name+institution", certificationSameIdentity(cert(), cert({ name: "  aws solutions architect  " })) && !certificationSameIdentity(cert(), cert({ institution: "Google" })));
check("T29 material equality adds year (with whitespace/case normalization)", certificationMaterialEquals(cert(), cert({ year: " 2022 " })) && !certificationMaterialEquals(cert(), cert({ year: "2023" })));

// ── Business ─────────────────────────────────────────────────────────────────
function biz(overrides: Partial<BusinessCandidate> = {}): BusinessCandidate {
  return { id: "b", domain: "business", status: "proposed", provenance: [{ source: "cv_extraction", rawText: "x", confidence: "high" }],
    name: "Acme LLC", role: "Founder", foundedYear: "2019", ...overrides };
}
check("T30 identity = name+foundedYear", businessSameIdentity(biz(), biz({ name: " acme llc " })) && !businessSameIdentity(biz(), biz({ foundedYear: "2020" })));
check("T31 material equality adds role", businessMaterialEquals(biz(), biz()) && !businessMaterialEquals(biz(), biz({ role: "CEO" })));

// ── Reference ────────────────────────────────────────────────────────────────
function ref(overrides: Partial<ReferenceCandidate> = {}): ReferenceCandidate {
  return { id: "r", domain: "reference", status: "proposed", provenance: [{ source: "coach_discovery", rawText: "x", confidence: "medium" }],
    name: "Jane Doe", relationshipType: "supervisor", specificAchievements: "Can confirm leadership on the migration project", ...overrides };
}
check("T32 identity = name+relationshipType", referenceSameIdentity(ref(), ref({ name: " jane doe " })) && !referenceSameIdentity(ref(), ref({ relationshipType: "colleague" })));
check("T33 material equality adds specificAchievements", referenceMaterialEquals(ref(), ref()) && !referenceMaterialEquals(ref(), ref({ specificAchievements: "Different claim" })));
check("T34 organization is not required by the candidate model (not a field on ReferenceCandidate)",
  !("organization" in ref()));

// ── Evidence ─────────────────────────────────────────────────────────────────
function ev(overrides: Partial<EvidenceCandidate> = {}): EvidenceCandidate {
  return { id: "v", domain: "evidence", status: "proposed", provenance: [{ source: "coach_discovery", rawText: "x", confidence: "low" }],
    category: "awards", ...overrides };
}
check("T35 same category = same identity + materially equal", evidenceSameIdentity(ev(), ev()) && evidenceMaterialEquals(ev(), ev()));
check("T36 different category = different identity", !evidenceSameIdentity(ev(), ev({ category: "judging" })));

// ── Strategic Answer ─────────────────────────────────────────────────────────
function strat(overrides: Partial<StrategicAnswerCandidate> = {}): StrategicAnswerCandidate {
  return { id: "s", domain: "strategicAnswer", status: "proposed", provenance: [{ source: "coach_discovery", rawText: "x", confidence: "medium" }],
    targetField: "ledImpactProjects", answer: "Led a platform migration affecting 2M monthly transactions", ...overrides };
}
check("T37 same targetField = same identity", strategicAnswerSameIdentity(strat(), strat({ answer: "different wording" })));
check("T38 same targetField + same normalized answer = materially equal", strategicAnswerMaterialEquals(strat(), strat()));
check("T39 same targetField + different answer = same identity but material equality false",
  strategicAnswerSameIdentity(strat(), strat({ answer: "totally different claim" })) && !strategicAnswerMaterialEquals(strat(), strat({ answer: "totally different claim" })));

// ── Structural decoupling (import-based, not prose-grep) ────────────────────
{
  const src = readFileSync(require.resolve(PROD_FILE), "utf8");
  const importLines = src.split("\n").filter(l => /^\s*import\b/.test(l));
  const forbidden = ["IntakeFormData", "Module0", "StructuredProfile", "DraftEnvelope", "IntakeForm.tsx", "module-numbering", "cbr", "supabase", "@/app/api", "agents"];
  const violation = importLines.find(l => forbidden.some(f => l.toLowerCase().includes(f.toLowerCase())));
  check("T40 professional-intelligence.ts imports nothing from IntakeFormData/Module0/StructuredProfile/DraftEnvelope/IntakeForm.tsx/module-numbering/CBR/Supabase/API routes/agents", importLines.length === 0 && violation === undefined);
}

// ── Project/Contribution/Compensation/JudgeEvaluator/generalized-Fact prohibition ──
{
  const src = readFileSync(require.resolve(PROD_FILE), "utf8");
  const forbiddenExports = ["ProjectCandidate", "ContributionCandidate", "CompensationCandidate", "JudgeEvaluatorCandidate", "FactCandidate"];
  check("T41 no ProjectCandidate/ContributionCandidate/CompensationCandidate/JudgeEvaluatorCandidate/FactCandidate exported",
    forbiddenExports.every(name => !src.includes(name)));
}

console.log(failures === 0 ? `\nALL PI-A CHECKS PASS` : `\n${failures} PI-A CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
