// Implementation E2-R2B — PI Employment Enrichment Post-Base-Acceptance
// Materialization, Checkpoint/Envelope/Persistence Seam. Executable,
// non-database, non-network, non-LLM unit tests against the REAL
// production exports of src/app/intake/IntakeForm.tsx (imported by path,
// plain non-JSX functions, mirroring pi-b2a/pi-b2b/pi-c3/pi-d0b/pi-d1d's
// own established convention for this file) and
// src/lib/intake/professional-intelligence.ts (R2A, unmodified).
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-e2-r2b-checkpoint-persistence-tests.ts
//
// Scope: R2B seams only (buildDraftEnvelope, DraftStorageWriter,
// persistDraftEnvelope, runPostBaseEmploymentEnrichmentCheckpoint). These
// are NOT the final R1-T01..R1-T10 ten-scenario runtime verification --
// that remains R2C, not implemented here.

import {
  buildDraftEnvelope,
  persistDraftEnvelope,
  runPostBaseEmploymentEnrichmentCheckpoint,
  buildInitialIntakeFormData,
  type DraftStorageWriter,
  type DraftEnvelope,
  type PostBaseEmploymentEnrichmentCheckpointDeps,
} from "../../../src/app/intake/IntakeForm";
import {
  type EmploymentCandidate,
  type EmploymentEnrichment,
  type ProfessionalIntelligenceEnrichments,
  type CandidateProvenance,
  emptyProfessionalIntelligenceCandidates,
} from "../../../src/lib/intake/professional-intelligence";
import type { EmploymentEntry } from "../../../src/app/intake/types";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const prov = (source: "cv_extraction" | "coach_discovery" = "cv_extraction"): CandidateProvenance =>
  ({ source, rawText: "x", confidence: "high" });

function candidate(id: string, overrides: Partial<EmploymentCandidate> = {}): EmploymentCandidate {
  return {
    id, domain: "employment", status: "accepted_in_module", provenance: [prov()],
    company: "Expedia", title: "Senior Engineer", startDate: "2019-01", endDate: "2021-06",
    mainFunctions: "Led backend team", importantProjects: "Payments rewrite", mainAchievements: "+20% uptime",
    ...overrides,
  };
}

function entry(id: string, piOriginCandidateId: string | undefined, overrides: Partial<EmploymentEntry> = {}): EmploymentEntry {
  return {
    id, piOriginCandidateId, company: "Expedia", country: "", city: "", title: "Senior Engineer",
    startDate: "2019-01", endDate: "2021-06", isCurrent: false, mainFunctions: "Led backend team",
    importantProjects: "Payments rewrite", mainAchievements: "+20% uptime", peopleSupervised: "0",
    managesBudget: null, budgetAmount: "", whyImportant: "", supervisorName: "", supervisorTitle: "",
    supervisorEmail: "", supervisorPhone: "", companyWebsite: "", internationalRecognition: "",
    ...overrides,
  };
}

function enrichment(id: string, candidateId: string, patch: EmploymentEnrichment["patch"] = {}): EmploymentEnrichment {
  return { id, target: { domain: "employment", candidateId }, status: "proposed", provenance: [prov()], patch };
}

function enrichmentsWith(employment: EmploymentEnrichment[]): ProfessionalIntelligenceEnrichments {
  return { employment };
}

// ════════════════════════════════════════════════════════════════════════════
// R2B-T01 — DRAFT ENVELOPE BUILDER
// ════════════════════════════════════════════════════════════════════════════
{
  const data = buildInitialIntakeFormData("test@example.com");
  const candidates = emptyProfessionalIntelligenceCandidates();
  const enrichments = enrichmentsWith([]);
  const fixedSavedAt = "2026-01-01T00:00:00.000Z";

  const envelope = buildDraftEnvelope(data, 3, candidates, enrichments, fixedSavedAt);

  check("T01 envelope.data is the exact input data", envelope.data === data);
  check("T01 envelope.step is the exact input step", envelope.step === 3);
  check("T01 envelope.savedAt is the exact deterministic input", envelope.savedAt === fixedSavedAt);
  check("T01 envelope.professionalIntelligenceCandidates is the exact input candidates", envelope.professionalIntelligenceCandidates === candidates);
  check("T01 envelope.professionalIntelligenceEnrichments is the exact input enrichments", envelope.professionalIntelligenceEnrichments === enrichments);
  check("T01 no extra top-level field", Object.keys(envelope).sort().join(",") === "data,professionalIntelligenceCandidates,professionalIntelligenceEnrichments,savedAt,step");

  const envelopeDefaultSavedAt = buildDraftEnvelope(data, 0, candidates, enrichments);
  check("T01b default savedAt is a fresh ISO timestamp string when omitted", typeof envelopeDefaultSavedAt.savedAt === "string" && !isNaN(Date.parse(envelopeDefaultSavedAt.savedAt)));
}

// ════════════════════════════════════════════════════════════════════════════
// R2B-T02 — PERSISTENCE SUCCESS
// ════════════════════════════════════════════════════════════════════════════
{
  const writes: { key: string; value: string }[] = [];
  const fakeStorage: DraftStorageWriter = { setItem(key, value) { writes.push({ key, value }); } };
  const data = buildInitialIntakeFormData("test@example.com");
  const envelope = buildDraftEnvelope(data, 1, emptyProfessionalIntelligenceCandidates(), enrichmentsWith([]), "2026-01-01T00:00:00.000Z");

  const result = persistDraftEnvelope(fakeStorage, "test-storage-key", envelope);

  check("T02 returns true", result === true);
  check("T02 exactly one setItem call", writes.length === 1);
  check("T02 exact key", writes[0]?.key === "test-storage-key");
  const parsed: DraftEnvelope = JSON.parse(writes[0]!.value);
  check("T02 written value parses as the exact envelope", JSON.stringify(parsed) === JSON.stringify(envelope));
}

// ════════════════════════════════════════════════════════════════════════════
// R2B-T03 — PERSISTENCE FAILURE
// ════════════════════════════════════════════════════════════════════════════
{
  let attempts = 0;
  const failingStorage: DraftStorageWriter = { setItem() { attempts++; throw new Error("synthetic persistence failure"); } };
  const data = buildInitialIntakeFormData("test@example.com");
  const envelope = buildDraftEnvelope(data, 0, emptyProfessionalIntelligenceCandidates(), enrichmentsWith([]), "2026-01-01T00:00:00.000Z");

  let thrown = false;
  let result: boolean | undefined;
  try {
    result = persistDraftEnvelope(failingStorage, "test-storage-key", envelope);
  } catch {
    thrown = true;
  }

  check("T03 real persistDraftEnvelope returns false", result === false);
  check("T03 exactly one write attempt", attempts === 1);
  check("T03 exception does not escape persistDraftEnvelope", thrown === false);
}

// ════════════════════════════════════════════════════════════════════════════
// R2B-T04 — CHECKPOINT SUCCESS
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c1");
  const row = entry("row1", "c1");
  const otherRow = entry("row2", "unrelated");
  const enr = enrichment("e1", "c1", { mainFunctions: "New responsibility" });
  const currentData = { ...buildInitialIntakeFormData("test@example.com"), module7: { employment: [row, otherRow] } };
  const currentEnrichments = enrichmentsWith([enr]);
  const enrichmentsRef = { current: currentEnrichments };

  let persistCalls = 0;
  const deps: PostBaseEmploymentEnrichmentCheckpointDeps = {
    currentData, currentEnrichments, enrichmentsRef,
    persist: () => { persistCalls++; return true; },
  };

  const outcome = runPostBaseEmploymentEnrichmentCheckpoint(cand, enr, deps);

  check("T04 outcome persisted", outcome.outcome === "persisted");
  check("T04 persist called exactly once", persistCalls === 1);
  if (outcome.outcome === "persisted") {
    const patchedRow = outcome.nextData.module7.employment.find(e => e.id === "row1");
    check("T04 nextData contains patched existing row", patchedRow !== undefined && patchedRow.mainFunctions.includes("New responsibility"));
    check("T04 row count unchanged", outcome.nextData.module7.employment.length === 2);
    check("T04 nextEnrichments target accepted", outcome.nextEnrichments.employment.find(e => e.id === "e1")!.status === "accepted");
  }
  check("T04 enrichmentsRef remains nextEnrichments after success", outcome.outcome === "persisted" && enrichmentsRef.current === outcome.nextEnrichments);
}

// ════════════════════════════════════════════════════════════════════════════
// R2B-T05 — CHECKPOINT FAILURE / REF ROLLBACK
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c2");
  const row = entry("row1", "c2");
  const enr = enrichment("e2", "c2", { mainFunctions: "New responsibility" });
  const currentData = { ...buildInitialIntakeFormData("test@example.com"), module7: { employment: [row] } };
  const currentEnrichments = enrichmentsWith([enr]);
  const enrichmentsRef = { current: currentEnrichments };

  const frozenData = JSON.stringify(currentData);
  const frozenEnrichments = JSON.stringify(currentEnrichments);

  let persistCalls = 0;
  const deps: PostBaseEmploymentEnrichmentCheckpointDeps = {
    currentData, currentEnrichments, enrichmentsRef,
    persist: () => { persistCalls++; return false; },
  };

  const outcome = runPostBaseEmploymentEnrichmentCheckpoint(cand, enr, deps);

  check("T05 outcome persistence_failed", outcome.outcome === "persistence_failed");
  check("T05 persist called exactly once", persistCalls === 1);
  check("T05 enrichmentsRef restored to exact prior currentEnrichments", enrichmentsRef.current === currentEnrichments);
  check("T05 original data input not mutated", JSON.stringify(currentData) === frozenData);
  check("T05 original enrichments input not mutated", JSON.stringify(currentEnrichments) === frozenEnrichments);
}

// ════════════════════════════════════════════════════════════════════════════
// R2B-T06 — FAIL-CLOSED DOES NOT PERSIST
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c3");
  const enr = enrichment("e3", "c3", { mainFunctions: "New responsibility" });
  const currentData = { ...buildInitialIntakeFormData("test@example.com"), module7: { employment: [] } }; // zero linked rows
  const currentEnrichments = enrichmentsWith([enr]);
  const enrichmentsRef = { current: currentEnrichments };

  let persistCalls = 0;
  const deps: PostBaseEmploymentEnrichmentCheckpointDeps = {
    currentData, currentEnrichments, enrichmentsRef,
    persist: () => { persistCalls++; return true; },
  };

  const outcome = runPostBaseEmploymentEnrichmentCheckpoint(cand, enr, deps);

  check("T06 outcome fail_closed", outcome.outcome === "fail_closed");
  check("T06 exact reason zero_linked_rows", outcome.outcome === "fail_closed" && outcome.reason === "zero_linked_rows");
  check("T06 persist call count === 0", persistCalls === 0);
  check("T06 enrichmentsRef unchanged", enrichmentsRef.current === currentEnrichments);
}

// ════════════════════════════════════════════════════════════════════════════
// R2B-T07 — SAME-CHECKPOINT COMPOSITION SMOKE TEST (encouraged, not R1-T08 closure)
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c4");
  const row = entry("row1", "c4");
  const enr = enrichment("e4", "c4", { mainFunctions: "New responsibility" });
  const currentData = { ...buildInitialIntakeFormData("test@example.com"), module7: { employment: [row] } };
  const currentEnrichments = enrichmentsWith([enr]);
  const enrichmentsRef = { current: currentEnrichments };

  const writes: { key: string; value: string }[] = [];
  const fakeStorage: DraftStorageWriter = { setItem(key, value) { writes.push({ key, value }); } };

  const persist = (nextData: typeof currentData): boolean => {
    const envelope = buildDraftEnvelope(nextData, 0, emptyProfessionalIntelligenceCandidates(), enrichmentsRef.current, "2026-01-01T00:00:00.000Z");
    return persistDraftEnvelope(fakeStorage, "test-storage-key", envelope);
  };

  const deps: PostBaseEmploymentEnrichmentCheckpointDeps = { currentData, currentEnrichments, enrichmentsRef, persist };
  const outcome = runPostBaseEmploymentEnrichmentCheckpoint(cand, enr, deps);

  check("T07 outcome persisted", outcome.outcome === "persisted");
  check("T07 exactly one storage write", writes.length === 1);
  const parsed = JSON.parse(writes[0]!.value) as DraftEnvelope;
  const patchedRow = parsed.data.module7.employment.find(e => e.id === "row1");
  check("T07 serialized checkpoint contains the patched module7 employment", patchedRow !== undefined && patchedRow.mainFunctions.includes("New responsibility"));
  check("T07 serialized checkpoint contains the target enrichment accepted", parsed.professionalIntelligenceEnrichments!.employment.find(e => e.id === "e4")!.status === "accepted");
}

console.log(failures === 0 ? "\nALL E2-R2B CHECKS PASS" : `\n${failures} E2-R2B CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
