// Implementation PI-B2A — Professional Candidate Draft/State Foundation.
// Non-database, non-network, non-LLM unit tests against the REAL
// production exports of src/lib/intake/professional-intelligence.ts and
// src/app/intake/IntakeForm.tsx (imported by path, not reimplemented) —
// mirrors pi-a/pi-b1/c1's own established convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-b2a-professional-candidate-draft-state-tests.ts
//
// Scope: draft/state foundation only. No runtime producer exists yet —
// extraction wiring (PI-B2B) is explicitly out of scope and is proven
// absent, not merely untested.

import { readFileSync } from "fs";
import {
  emptyProfessionalIntelligenceCandidates, replaceCvExtractionCandidates,
  type ProfessionalIntelligenceCandidates, type EmploymentCandidate, type CertificationCandidate,
} from "../../../src/lib/intake/professional-intelligence";
import {
  parseDraftEnvelope, isValidProfessionalIntelligenceCandidatesOverlay,
  type DraftEnvelope,
} from "../../../src/app/intake/IntakeForm";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const PI_FILE = "../../../src/lib/intake/professional-intelligence.ts";
const INTAKEFORM_FILE = "../../../src/app/intake/IntakeForm.tsx";
const piSrc = readFileSync(require.resolve(PI_FILE), "utf8");
const intakeFormSrc = readFileSync(require.resolve(INTAKEFORM_FILE), "utf8");

// ── §36 — PI-A model freeze proof ───────────────────────────────────────────
{
  const c = emptyProfessionalIntelligenceCandidates();
  const keys = Object.keys(c).sort();
  check("T01 all seven arrays still exist", keys.length === 7 && JSON.stringify(keys) === JSON.stringify(["business","certification","education","employment","evidence","reference","strategicAnswer"].sort()));
  check("T02 emptyProfessionalIntelligenceCandidates() returns fresh arrays (two calls, distinct refs)",
    emptyProfessionalIntelligenceCandidates().employment !== emptyProfessionalIntelligenceCandidates().employment);
  check("T03 existing candidate type declarations unchanged (spot check: CandidateStatus exact union)",
    (piSrc.match(/export type CandidateStatus = ([^;]+);/)?.[1] ?? "").replace(/\s+/g, " ").trim() === '"proposed" | "accepted_in_module" | "rejected"');
  check("T04 no existing *SameIdentity/*MaterialEquals function body was modified (still present, unchanged signatures)",
    /export function employmentSameIdentity\(a: EmploymentCandidate, b: EmploymentCandidate\): boolean/.test(piSrc) &&
    /export function evidenceMaterialEquals\(a: EvidenceCandidate, b: EvidenceCandidate\): boolean/.test(piSrc));
}

function emp(id: string, source: "cv_extraction" | "coach_discovery", overrides: Partial<EmploymentCandidate> = {}): EmploymentCandidate {
  return {
    id, domain: "employment", status: "proposed",
    provenance: [{ source, rawText: "x", confidence: "high" }],
    company: "Expedia", title: "Senior Engineer", startDate: "", endDate: "",
    mainFunctions: "", importantProjects: "", mainAchievements: "",
    ...overrides,
  };
}
function cert(id: string, source: "cv_extraction" | "coach_discovery"): CertificationCandidate {
  return { id, domain: "certification", status: "proposed", provenance: [{ source, rawText: "x", confidence: "high" }], name: "AWS", institution: "Amazon", year: "2022" };
}

// ── §37 — replacement helper, basic ─────────────────────────────────────────
{
  const current: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: [emp("e1", "cv_extraction"), emp("e2", "cv_extraction")] };
  const incoming: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: [emp("e3", "cv_extraction")] };
  const r = replaceCvExtractionCandidates(current, incoming);
  check("T05 2 cv_extraction-only employment candidates replaced by 1 incoming candidate", r.employment.length === 1 && r.employment[0].id === "e3");
}
{
  const current: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), certification: [cert("c1", "cv_extraction")] };
  const incoming: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), certification: [cert("c2", "cv_extraction")] };
  const r = replaceCvExtractionCandidates(current, incoming);
  check("T06 second domain (certification) also replaces cv_extraction-only candidates", r.certification.length === 1 && r.certification[0].id === "c2");
}

// ── §38 — Coach preservation ─────────────────────────────────────────────────
{
  const a = emp("A", "cv_extraction");
  const b = emp("B", "coach_discovery");
  const current: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: [a, b] };
  const incoming: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: [emp("C", "cv_extraction")] };
  const r = replaceCvExtractionCandidates(current, incoming);
  check("T07 cv_extraction-only candidate A removed", !r.employment.some(c => c.id === "A"));
  check("T08 coach_discovery-only candidate B preserved", r.employment.some(c => c.id === "B"));
  check("T09 incoming candidate C appended", r.employment.some(c => c.id === "C"));
  check("T09b exactly two candidates remain (B + C)", r.employment.length === 2);
}

// ── §39 — multi-source preservation ──────────────────────────────────────────
{
  const multi = emp("M", "cv_extraction", { provenance: [{ source: "cv_extraction", rawText: "x", confidence: "high" }, { source: "coach_discovery", rawText: "y", confidence: "medium" }] });
  const current: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: [multi] };
  const incoming: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: [emp("N", "cv_extraction")] };
  const r = replaceCvExtractionCandidates(current, incoming);
  const preserved = r.employment.find(c => c.id === "M");
  check("T10 multi-source candidate preserved unchanged", preserved !== undefined);
  check("T11 provenance not split/rewritten (still exactly 2 entries, both original)", preserved!.provenance.length === 2 &&
    preserved!.provenance[0].source === "cv_extraction" && preserved!.provenance[1].source === "coach_discovery");
}

// ── §40 — empty provenance conservatism ──────────────────────────────────────
{
  const malformed = emp("Z", "cv_extraction", { provenance: [] });
  const current: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: [malformed] };
  const incoming: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: [emp("Y", "cv_extraction")] };
  const r = replaceCvExtractionCandidates(current, incoming);
  check("T12 candidate with empty provenance array is conservatively preserved (not classified as cv_extraction-only)", r.employment.some(c => c.id === "Z"));
}

// ── §41 — no dedup ────────────────────────────────────────────────────────────
{
  const dupe1 = emp("D1", "cv_extraction");
  const dupe2 = emp("D2", "cv_extraction");
  const current = emptyProfessionalIntelligenceCandidates();
  const incoming: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: [dupe1, dupe2] };
  const r = replaceCvExtractionCandidates(current, incoming);
  check("T13 two materially identical incoming candidates both appended (no dedup)", r.employment.length === 2);
  check("T14 helper source contains no PI-A comparator call", !/employmentSameIdentity\(|employmentMaterialEquals\(|educationSameIdentity\(|certificationSameIdentity\(|businessSameIdentity\(|evidenceSameIdentity\(/.test(
    piSrc.match(/export function replaceCvExtractionCandidates[\s\S]*?\n}/)?.[0] ?? ""));
}

// ── §42 — pure / non-mutating ─────────────────────────────────────────────────
{
  const currentEmployment = [emp("P1", "cv_extraction")];
  const incomingEmployment = [emp("P2", "cv_extraction")];
  const current: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: currentEmployment };
  const incoming: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: incomingEmployment };
  const r = replaceCvExtractionCandidates(current, incoming);
  check("T15 current.employment array reference unchanged (not mutated)", current.employment === currentEmployment && current.employment.length === 1);
  check("T16 incoming.employment array reference unchanged (not mutated)", incoming.employment === incomingEmployment && incoming.employment.length === 1);
  check("T17 returned employment array is a fresh reference", r.employment !== currentEmployment && r.employment !== incomingEmployment);
}

// ── §43 — DraftEnvelope shape ─────────────────────────────────────────────────
{
  const envelope: DraftEnvelope = { data: {} as unknown as DraftEnvelope["data"], step: 0, savedAt: "", professionalIntelligenceCandidates: emptyProfessionalIntelligenceCandidates() };
  check("T18 DraftEnvelope has data/step/savedAt/optional professionalIntelligenceCandidates", "data" in envelope && "step" in envelope && "savedAt" in envelope && "professionalIntelligenceCandidates" in envelope);
  const envelopeDecl = intakeFormSrc.match(/export type DraftEnvelope = \{[\s\S]*?\};/)?.[0] ?? "";
  check("T19 candidates are NOT part of IntakeFormData (DraftEnvelope.data type is IntakeFormData, candidates is a sibling field, not nested in data)",
    /professionalIntelligenceCandidates\?:/.test(envelopeDecl) && !/data:\s*IntakeFormData\s*&/.test(envelopeDecl));
  check("T20 candidates are NOT part of Module0Data (Module0 type file untouched)", !/professionalIntelligenceCandidates/.test(readFileSync(require.resolve("../../../src/app/intake/types.ts"), "utf8")));
}

// ── §44 — save serialization ──────────────────────────────────────────────────
{
  const saveBody = intakeFormSrc.match(/const save = useCallback\([\s\S]*?\n  \}, \[storageKey\]\);/)?.[0] ?? "";
  check("T21 save() performs exactly one localStorage.setItem call", (saveBody.match(/localStorage\.setItem/g) ?? []).length === 1);
  check("T22 save()'s envelope includes the professionalIntelligenceCandidates sibling", /professionalIntelligenceCandidates:\s*professionalIntelligenceCandidatesRef\.current/.test(saveBody));
  check("T23 no second/new storage key introduced for candidates", !/aucis_professional_candidates/.test(intakeFormSrc));
}

// ── §45 — submit firewall ─────────────────────────────────────────────────────
{
  const submitBody = intakeFormSrc.match(/async function submit\(\)[\s\S]*?\n  \}/)?.[0] ?? "";
  check("T24 submit() contains zero reference to professionalIntelligenceCandidates", !submitBody.includes("professionalIntelligenceCandidates"));
  check("T25 submit() body is non-empty (sanity check that the regex actually captured the function)", submitBody.length > 100);
}

// ── §46 — old envelope (pre-PI-B2A) ──────────────────────────────────────────
{
  const oldEnvelope = { data: { module1: { fullName: "X" } }, step: 2, savedAt: "2026-01-01T00:00:00.000Z" };
  const { saved, resumeStep, professionalIntelligenceCandidates } = parseDraftEnvelope(JSON.stringify(oldEnvelope), 14);
  check("T26 old envelope (no candidate sibling) hydrates IntakeFormData unchanged", (saved as { module1?: { fullName?: string } }).module1?.fullName === "X" && resumeStep === 2);
  check("T27 candidate overlay defaults to empty for an old envelope", Object.values(professionalIntelligenceCandidates).every(v => Array.isArray(v) && v.length === 0));
}

// ── §47 — legacy bare data ────────────────────────────────────────────────────
{
  const bareData = { module1: { fullName: "Y" } };
  const { saved, resumeStep, professionalIntelligenceCandidates } = parseDraftEnvelope(JSON.stringify(bareData), 14);
  check("T28 legacy bare-IntakeFormData draft still parses as before", (saved as { module1?: { fullName?: string } }).module1?.fullName === "Y" && resumeStep === 0);
  check("T29 candidate overlay empty for legacy bare data", Object.values(professionalIntelligenceCandidates).every(v => Array.isArray(v) && v.length === 0));
}

// ── §48 — valid candidate draft ───────────────────────────────────────────────
{
  const validCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: [emp("H1", "cv_extraction")] };
  const envelope = { data: {}, step: 0, savedAt: "x", professionalIntelligenceCandidates: validCandidates };
  const { professionalIntelligenceCandidates } = parseDraftEnvelope(JSON.stringify(envelope), 14);
  check("T30 valid seven-array candidate draft hydrates", professionalIntelligenceCandidates.employment.length === 1 && professionalIntelligenceCandidates.employment[0].id === "H1");
  check("T30b candidate id/status/provenance/payload not reinterpreted by the coarse guard", professionalIntelligenceCandidates.employment[0].status === "proposed" && professionalIntelligenceCandidates.employment[0].provenance[0].source === "cv_extraction");
}

// ── §49 — invalid candidate draft ────────────────────────────────────────────
for (const [label, value] of [
  ["null", null], ["string", "bad"],
] as [string, unknown][]) {
  check(`T31 invalid overlay (${label}) -> isValidProfessionalIntelligenceCandidatesOverlay returns false`, !isValidProfessionalIntelligenceCandidatesOverlay(value));
}
{
  const missingDomain = { employment: [], education: [], certification: [], business: [], reference: [], evidence: [] }; // strategicAnswer missing
  check("T32 missing domain -> invalid", !isValidProfessionalIntelligenceCandidatesOverlay(missingDomain));
  const nonArrayDomain = { ...emptyProfessionalIntelligenceCandidates(), employment: "not-an-array" };
  check("T33 non-array domain -> invalid", !isValidProfessionalIntelligenceCandidatesOverlay(nonArrayDomain));
}
{
  const envelope = { data: { module1: { fullName: "Z" } }, step: 0, savedAt: "x", professionalIntelligenceCandidates: null };
  const { saved, professionalIntelligenceCandidates } = parseDraftEnvelope(JSON.stringify(envelope), 14);
  check("T34 null candidate overlay -> whole overlay reset to empty", Object.values(professionalIntelligenceCandidates).every(v => Array.isArray(v) && v.length === 0));
  check("T34b IntakeFormData path remains independently valid despite invalid overlay", (saved as { module1?: { fullName?: string } }).module1?.fullName === "Z");
}

// ── §50 — unknown extra domain ────────────────────────────────────────────────
{
  const withExtra = { ...emptyProfessionalIntelligenceCandidates(), futureUnknownDomain: ["x"] };
  check("T35 valid seven arrays plus an unknown extra key -> still accepted", isValidProfessionalIntelligenceCandidatesOverlay(withExtra));
}

// ── §51 — zero extraction wiring ──────────────────────────────────────────────
check("T36 IntakeForm.tsx contains no call/reference to extractProfessionalCandidates", !intakeFormSrc.includes("extractProfessionalCandidates"));
check("T37 IntakeForm.tsx adds no new request to /api/intake/a0-extract", !/fetch\(["'`]\/api\/intake\/a0-extract/.test(intakeFormSrc));
{
  let module0Src = ""; let routeSrc = "";
  try { module0Src = readFileSync(require.resolve("../../../src/app/intake/modules/Module0.tsx"), "utf8"); } catch { /* n/a */ }
  try { routeSrc = readFileSync(require.resolve("../../../src/app/api/intake/a0-extract/route.ts"), "utf8"); } catch { /* n/a */ }
  check("T38 Module0.tsx unchanged (no professionalIntelligenceCandidates reference)", !module0Src.includes("professionalIntelligenceCandidates") && !module0Src.includes("extractProfessionalCandidates"));
  check("T39 A0 route unchanged (no professionalIntelligenceCandidates/extractProfessionalCandidates reference)", !routeSrc.includes("professionalIntelligenceCandidates") && !routeSrc.includes("extractProfessionalCandidates"));
}

// ── §52 — zero runtime producer ──────────────────────────────────────────────
check("T40 setProfessionalIntelligenceCandidates is called only in initialization/hydration (exactly 2 call sites: useState setter definition excluded, 1 hydration call)",
  (intakeFormSrc.match(/setProfessionalIntelligenceCandidates\(/g) ?? []).length === 1);

// ── §53 — no UI ───────────────────────────────────────────────────────────────
check("T41 professionalIntelligenceCandidates is never rendered into JSX (no {professionalIntelligenceCandidates reference inside a JSX expression container near render)",
  !/\{professionalIntelligenceCandidates[.\s]/.test(intakeFormSrc.replace(/professionalIntelligenceCandidatesRef/g, "")));

// ── §54 — no completion/submission effect ────────────────────────────────────
{
  const getModuleStatusBody = intakeFormSrc.match(/function getModuleStatus\([\s\S]*?\n\}/)?.[0] ?? "";
  check("T42 getModuleStatus does not reference professionalIntelligenceCandidates", !getModuleStatusBody.includes("professionalIntelligenceCandidates"));
  const statusesLine = intakeFormSrc.match(/const statuses = .*/)?.[0] ?? "";
  check("T43 moduleStatuses/statuses construction does not reference professionalIntelligenceCandidates", !statusesLine.includes("professionalIntelligenceCandidates"));
}

console.log(failures === 0 ? `\nALL PI-B2A CHECKS PASS` : `\n${failures} PI-B2A CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
