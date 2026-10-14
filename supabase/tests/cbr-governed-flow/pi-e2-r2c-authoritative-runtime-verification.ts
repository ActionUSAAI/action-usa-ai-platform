// Implementation E2-R2C — PI Employment Enrichment Post-Base-Acceptance
// Materialization, Authoritative Ten-Scenario Runtime Verification.
// Executable, non-database, non-network, non-LLM runtime verification
// against the REAL production exports of src/app/intake/IntakeForm.tsx
// (buildDraftEnvelope, persistDraftEnvelope, runPostBaseEmploymentEnrichmentCheckpoint)
// and src/lib/intake/professional-intelligence.ts (buildPostBaseEmploymentEnrichmentTransition,
// R2A, unmodified, imported by path -- never reimplemented).
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-e2-r2c-authoritative-runtime-verification.ts
//
// This closes CR-E2-01's remaining runtime-evidence gap: every scenario
// below executes the REAL chain (R2A transition -> R2B Layer 2 ->
// buildDraftEnvelope -> persistDraftEnvelope -> synthetic
// DraftStorageWriter boundary). Only the final browser localStorage
// object and React refs/setters are substituted with plain synthetic
// equivalents; no production algorithm is duplicated anywhere in this
// file. Synthetic fixtures only -- no Daniel Mendoza / Northstar /
// Meridian / Pacifica / Andean / BlueRiver / live case data.

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

let scenarioCount = 0;
let assertionCount = 0;
let failures = 0;
function check(label: string, cond: boolean) {
  assertionCount++;
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}
function scenario(name: string, fn: () => void) {
  scenarioCount++;
  console.log(`\n── ${name} ──`);
  fn();
}

// ── Deterministic synthetic fixtures (no random UUID, no uncontrolled Date) ──
const prov = (source: "cv_extraction" | "coach_discovery" = "cv_extraction"): CandidateProvenance =>
  ({ source, rawText: "r2c-raw-text", confidence: "high" });

function candidate(id: string, overrides: Partial<EmploymentCandidate> = {}): EmploymentCandidate {
  return {
    id, domain: "employment", status: "accepted_in_module", provenance: [prov()],
    company: "R2C Test Co", title: "Senior Engineer", startDate: "2019-01", endDate: "2021-06",
    mainFunctions: "Led backend team", importantProjects: "Payments rewrite", mainAchievements: "+20% uptime",
    ...overrides,
  };
}

function entry(id: string, piOriginCandidateId: string | undefined, overrides: Partial<EmploymentEntry> = {}): EmploymentEntry {
  return {
    id, piOriginCandidateId, company: "R2C Test Co", country: "Colombia", city: "Bogota", title: "Senior Engineer",
    startDate: "2019-01", endDate: "2021-06", isCurrent: false, mainFunctions: "Led backend team",
    importantProjects: "Payments rewrite", mainAchievements: "+20% uptime", peopleSupervised: "5",
    managesBudget: true, budgetAmount: "100000", whyImportant: "Critical system", supervisorName: "R2C Supervisor",
    supervisorTitle: "VP", supervisorEmail: "supervisor@r2c.test", supervisorPhone: "555-0100",
    companyWebsite: "https://r2c.test", internationalRecognition: "",
    ...overrides,
  };
}

function enrichment(id: string, candidateId: string, patch: EmploymentEnrichment["patch"] = {}): EmploymentEnrichment {
  return { id, target: { domain: "employment", candidateId }, status: "proposed", provenance: [prov()], patch };
}

function enrichmentsWith(employment: EmploymentEnrichment[]): ProfessionalIntelligenceEnrichments {
  return { employment };
}

// ── Authoritative persistence harness ───────────────────────────────────────
function makeWriter(): DraftStorageWriter & { writes: { key: string; value: string }[] } {
  return { writes: [], setItem(key, value) { this.writes.push({ key, value }); } };
}
function makeFailingWriter(): DraftStorageWriter & { attempts: number } {
  return { attempts: 0, setItem() { this.attempts++; throw new Error("r2c-synthetic-persistence-failure"); } };
}

// Each scenario below builds its own `persist` callback inline, so the
// REAL buildDraftEnvelope + REAL persistDraftEnvelope call chain and the
// exact enrichmentsRef read timing are visible at each call site rather
// than hidden behind a shared wrapper.

// ════════════════════════════════════════════════════════════════════════════
// R2C-T01 — HAPPY PATH
// ════════════════════════════════════════════════════════════════════════════
scenario("R2C-T01 — happy path", () => {
  const cand = candidate("r2c-candidate-001");
  const linkedRow = entry("r2c-employment-001", "r2c-candidate-001");
  const unrelatedRow = entry("r2c-employment-unrelated", "some-other-candidate", { company: "Unrelated Co" });
  const enr = enrichment("r2c-enrichment-a", "r2c-candidate-001", { mainFunctions: "Added platform migration leadership" });
  const currentData = { ...buildInitialIntakeFormData("r2c-t01@example.com"), module7: { employment: [linkedRow, unrelatedRow] } };
  const currentEnrichments = enrichmentsWith([enr]);
  const enrichmentsRef = { current: currentEnrichments };
  const writer = makeWriter();

  const frozenCandidate = JSON.stringify(cand);
  const frozenCurrentData = JSON.stringify(currentData);
  const frozenCurrentEnrichments = JSON.stringify(currentEnrichments);

  let persistCalls = 0;
  const deps: PostBaseEmploymentEnrichmentCheckpointDeps = {
    currentData, currentEnrichments, enrichmentsRef,
    persist: (nextData) => {
      persistCalls++;
      const envelope = buildDraftEnvelope(nextData, 0, emptyProfessionalIntelligenceCandidates(), enrichmentsRef.current, "2026-01-01T00:00:00.000Z");
      return persistDraftEnvelope(writer, "r2c-t01-storage-key", envelope);
    },
  };

  const outcome = runPostBaseEmploymentEnrichmentCheckpoint(cand, enr, deps);

  check("1. outcome === persisted", outcome.outcome === "persisted");
  check("2. exactly one storage write occurred", writer.writes.length === 1);
  check("3. exact storage key is the deterministic expected key", writer.writes[0]?.key === "r2c-t01-storage-key");
  let parsed: DraftEnvelope | undefined;
  check("4. serialized JSON parses successfully", (() => { try { parsed = JSON.parse(writer.writes[0]!.value); return true; } catch { return false; } })());
  check("5. serialized module7.employment length equals original length", parsed?.data.module7.employment.length === 2);
  const parsedLinked = parsed?.data.module7.employment.find(e => e.id === "r2c-employment-001");
  check("6. same EmploymentEntry.id exists", parsedLinked !== undefined);
  check("7. same piOriginCandidateId exists", parsedLinked?.piOriginCandidateId === "r2c-candidate-001");
  check("8. allowed narrative patch is present", !!parsedLinked?.mainFunctions.includes("Added platform migration leadership"));
  const parsedUnrelated = parsed?.data.module7.employment.find(e => e.id === "r2c-employment-unrelated");
  check("9. unrelated row fields are preserved", JSON.stringify(parsedUnrelated) === JSON.stringify(unrelatedRow));
  const parsedEnrichment = parsed?.professionalIntelligenceEnrichments?.employment.find(e => e.id === "r2c-enrichment-a");
  check("10. serialized target enrichment status === accepted", parsedEnrichment?.status === "accepted");
  check("11. candidate state remains unchanged", JSON.stringify(cand) === frozenCandidate);
  check("12. original input objects remain unmutated (currentData)", JSON.stringify(currentData) === frozenCurrentData);
  check("12b. original input objects remain unmutated (currentEnrichments)", JSON.stringify(currentEnrichments) === frozenCurrentEnrichments);
  check("persist callback invoked exactly once", persistCalls === 1);
});

// ════════════════════════════════════════════════════════════════════════════
// R2C-T02 — ZERO LINK
// ════════════════════════════════════════════════════════════════════════════
scenario("R2C-T02 — zero linked rows", () => {
  const cand = candidate("r2c-candidate-002");
  const unrelatedRow = entry("r2c-employment-002-unrelated", "someone-else");
  const enr = enrichment("r2c-enrichment-002", "r2c-candidate-002", { mainFunctions: "New responsibility" });
  const currentData = { ...buildInitialIntakeFormData("r2c-t02@example.com"), module7: { employment: [unrelatedRow] } };
  const currentEnrichments = enrichmentsWith([enr]);
  const enrichmentsRef = { current: currentEnrichments };
  const writer = makeWriter();
  const frozenCurrentData = JSON.stringify(currentData);
  const frozenCurrentEnrichments = JSON.stringify(currentEnrichments);

  let persistCalls = 0;
  const deps: PostBaseEmploymentEnrichmentCheckpointDeps = {
    currentData, currentEnrichments, enrichmentsRef,
    persist: (nextData) => { persistCalls++; return persistDraftEnvelope(writer, "r2c-t02-storage-key", buildDraftEnvelope(nextData, 0, emptyProfessionalIntelligenceCandidates(), enrichmentsRef.current)); },
  };

  const outcome = runPostBaseEmploymentEnrichmentCheckpoint(cand, enr, deps);

  check("outcome === fail_closed", outcome.outcome === "fail_closed");
  check("reason === zero_linked_rows", outcome.outcome === "fail_closed" && outcome.reason === "zero_linked_rows");
  check("persist call count === 0", persistCalls === 0);
  check("storage write count === 0", writer.writes.length === 0);
  check("enrichmentsRef unchanged", enrichmentsRef.current === currentEnrichments);
  check("input state unchanged (currentData)", JSON.stringify(currentData) === frozenCurrentData);
  check("input state unchanged (currentEnrichments)", JSON.stringify(currentEnrichments) === frozenCurrentEnrichments);
});

// ════════════════════════════════════════════════════════════════════════════
// R2C-T03 — MULTIPLE LINKS
// ════════════════════════════════════════════════════════════════════════════
scenario("R2C-T03 — multiple linked rows", () => {
  const cand = candidate("r2c-candidate-003");
  const rowA = entry("r2c-employment-003-a", "r2c-candidate-003");
  const rowB = entry("r2c-employment-003-b", "r2c-candidate-003");
  const enr = enrichment("r2c-enrichment-003", "r2c-candidate-003", { mainFunctions: "New responsibility" });
  const currentData = { ...buildInitialIntakeFormData("r2c-t03@example.com"), module7: { employment: [rowA, rowB] } };
  const currentEnrichments = enrichmentsWith([enr]);
  const enrichmentsRef = { current: currentEnrichments };
  const writer = makeWriter();
  const frozenCurrentData = JSON.stringify(currentData);

  let persistCalls = 0;
  const deps: PostBaseEmploymentEnrichmentCheckpointDeps = {
    currentData, currentEnrichments, enrichmentsRef,
    persist: (nextData) => { persistCalls++; return persistDraftEnvelope(writer, "r2c-t03-storage-key", buildDraftEnvelope(nextData, 0, emptyProfessionalIntelligenceCandidates(), enrichmentsRef.current)); },
  };

  const outcome = runPostBaseEmploymentEnrichmentCheckpoint(cand, enr, deps);

  check("outcome === fail_closed", outcome.outcome === "fail_closed");
  check("reason === multiple_linked_rows", outcome.outcome === "fail_closed" && outcome.reason === "multiple_linked_rows");
  check("persist call count === 0", persistCalls === 0);
  check("storage write count === 0", writer.writes.length === 0);
  check("no row selected (input data unmutated)", JSON.stringify(currentData) === frozenCurrentData);
  check("enrichmentsRef unchanged", enrichmentsRef.current === currentEnrichments);
});

// ════════════════════════════════════════════════════════════════════════════
// R2C-T04 — BLANK PATCH
// ════════════════════════════════════════════════════════════════════════════
scenario("R2C-T04 — blank patch", () => {
  const cand = candidate("r2c-candidate-004");
  const row = entry("r2c-employment-004", "r2c-candidate-004");
  const enr = enrichment("r2c-enrichment-004", "r2c-candidate-004", { mainFunctions: "   ", importantProjects: "", mainAchievements: "\n" });
  const currentData = { ...buildInitialIntakeFormData("r2c-t04@example.com"), module7: { employment: [row] } };
  const currentEnrichments = enrichmentsWith([enr]);
  const enrichmentsRef = { current: currentEnrichments };
  const writer = makeWriter();
  const frozenRow = JSON.stringify(row);

  let persistCalls = 0;
  const deps: PostBaseEmploymentEnrichmentCheckpointDeps = {
    currentData, currentEnrichments, enrichmentsRef,
    persist: (nextData) => { persistCalls++; return persistDraftEnvelope(writer, "r2c-t04-storage-key", buildDraftEnvelope(nextData, 0, emptyProfessionalIntelligenceCandidates(), enrichmentsRef.current)); },
  };

  const outcome = runPostBaseEmploymentEnrichmentCheckpoint(cand, enr, deps);

  check("outcome === fail_closed", outcome.outcome === "fail_closed");
  check("reason === blank_patch", outcome.outcome === "fail_closed" && outcome.reason === "blank_patch");
  check("persist call count === 0", persistCalls === 0);
  check("storage write count === 0", writer.writes.length === 0);
  check("enrichment remains proposed", enrichmentsRef.current.employment.find(e => e.id === "r2c-enrichment-004")!.status === "proposed");
  check("row unchanged", JSON.stringify(currentData.module7.employment[0]) === frozenRow);
});

// ════════════════════════════════════════════════════════════════════════════
// R2C-T05 — COACH-ONLY CANDIDATE
// ════════════════════════════════════════════════════════════════════════════
scenario("R2C-T05 — Coach-only candidate (post-base eligibility boundary)", () => {
  const cand = candidate("r2c-candidate-005", { provenance: [prov("coach_discovery")] }); // status stays accepted_in_module, untouched
  const row = entry("r2c-employment-005", "r2c-candidate-005");
  const enr = enrichment("r2c-enrichment-005", "r2c-candidate-005", { mainFunctions: "New responsibility" });
  const currentData = { ...buildInitialIntakeFormData("r2c-t05@example.com"), module7: { employment: [row] } };
  const currentEnrichments = enrichmentsWith([enr]);
  const enrichmentsRef = { current: currentEnrichments };
  const writer = makeWriter();
  const frozenRow = JSON.stringify(row);
  const frozenEnrichment = JSON.stringify(enr);

  let persistCalls = 0;
  const deps: PostBaseEmploymentEnrichmentCheckpointDeps = {
    currentData, currentEnrichments, enrichmentsRef,
    persist: (nextData) => { persistCalls++; return persistDraftEnvelope(writer, "r2c-t05-storage-key", buildDraftEnvelope(nextData, 0, emptyProfessionalIntelligenceCandidates(), enrichmentsRef.current)); },
  };

  const outcome = runPostBaseEmploymentEnrichmentCheckpoint(cand, enr, deps);

  check("outcome === fail_closed", outcome.outcome === "fail_closed");
  check("reason === not_eligible", outcome.outcome === "fail_closed" && outcome.reason === "not_eligible");
  check("persist call count === 0", persistCalls === 0);
  check("storage write count === 0", writer.writes.length === 0);
  check("row unchanged", JSON.stringify(currentData.module7.employment[0]) === frozenRow);
  check("enrichment unchanged", JSON.stringify(enr) === frozenEnrichment);
});

// ════════════════════════════════════════════════════════════════════════════
// R2C-T06 — AUTHORITATIVE PERSISTENCE SUCCESS
// ════════════════════════════════════════════════════════════════════════════
scenario("R2C-T06 — authoritative persistence success", () => {
  const cand = candidate("r2c-candidate-006");
  const row = entry("r2c-employment-006", "r2c-candidate-006");
  const enr = enrichment("r2c-enrichment-006", "r2c-candidate-006", { mainFunctions: "New responsibility" });
  const currentData = { ...buildInitialIntakeFormData("r2c-t06@example.com"), module7: { employment: [row] } };
  const currentEnrichments = enrichmentsWith([enr]);
  const enrichmentsRef = { current: currentEnrichments };
  const writer = makeWriter();
  const deterministicCandidates = emptyProfessionalIntelligenceCandidates();
  const DETERMINISTIC_STEP = 7;
  const DETERMINISTIC_SAVED_AT = "2026-03-15T12:00:00.000Z";

  let persistCalls = 0;
  const deps: PostBaseEmploymentEnrichmentCheckpointDeps = {
    currentData, currentEnrichments, enrichmentsRef,
    persist: (nextData) => {
      persistCalls++;
      const envelope = buildDraftEnvelope(nextData, DETERMINISTIC_STEP, deterministicCandidates, enrichmentsRef.current, DETERMINISTIC_SAVED_AT);
      return persistDraftEnvelope(writer, "r2c-t06-storage-key", envelope);
    },
  };

  const outcome = runPostBaseEmploymentEnrichmentCheckpoint(cand, enr, deps);

  check("Layer 2 outcome persisted", outcome.outcome === "persisted");
  check("persist callback count === 1", persistCalls === 1);
  check("writer.setItem count === 1", writer.writes.length === 1);
  check("no second write", writer.writes.length === 1);
  const parsed: DraftEnvelope = JSON.parse(writer.writes[0]!.value);
  check("exact deterministic step", parsed.step === DETERMINISTIC_STEP);
  check("exact deterministic savedAt", parsed.savedAt === DETERMINISTIC_SAVED_AT);
  check("expected candidates sibling", JSON.stringify(parsed.professionalIntelligenceCandidates) === JSON.stringify(deterministicCandidates));
  check("expected enrichments sibling", parsed.professionalIntelligenceEnrichments?.employment.find(e => e.id === "r2c-enrichment-006")?.status === "accepted");
  check("expected patched module7 data", !!parsed.data.module7.employment.find(e => e.id === "r2c-employment-006")?.mainFunctions.includes("New responsibility"));
});

// ════════════════════════════════════════════════════════════════════════════
// R2C-T07 — AUTHORITATIVE PERSISTENCE FAILURE
// ════════════════════════════════════════════════════════════════════════════
scenario("R2C-T07 — authoritative persistence failure / ref rollback", () => {
  const cand = candidate("r2c-candidate-007");
  const row = entry("r2c-employment-007", "r2c-candidate-007");
  const enr = enrichment("r2c-enrichment-007", "r2c-candidate-007", { mainFunctions: "New responsibility" });
  const currentData = { ...buildInitialIntakeFormData("r2c-t07@example.com"), module7: { employment: [row] } };
  const currentEnrichments = enrichmentsWith([enr]);
  const enrichmentsRef = { current: currentEnrichments };
  const failingWriter = makeFailingWriter();
  const frozenCurrentData = JSON.stringify(currentData);
  const frozenCurrentEnrichments = JSON.stringify(currentEnrichments);

  let thrownOutOfTest = false;
  let outcome: ReturnType<typeof runPostBaseEmploymentEnrichmentCheckpoint> | undefined;
  try {
    const deps: PostBaseEmploymentEnrichmentCheckpointDeps = {
      currentData, currentEnrichments, enrichmentsRef,
      persist: (nextData) => {
        // REAL buildDraftEnvelope + REAL persistDraftEnvelope -- never
        // `() => false`. persistDraftEnvelope's own try/catch converts
        // the failingWriter's thrown exception into `false`.
        const envelope = buildDraftEnvelope(nextData, 0, emptyProfessionalIntelligenceCandidates(), enrichmentsRef.current);
        return persistDraftEnvelope(failingWriter, "r2c-t07-storage-key", envelope);
      },
    };
    outcome = runPostBaseEmploymentEnrichmentCheckpoint(cand, enr, deps);
  } catch {
    thrownOutOfTest = true;
  }

  check("1. writer setItem attempted exactly once", failingWriter.attempts === 1);
  check("2/3. persistDraftEnvelope catches the exception, Layer 2 receives false (no exception escaped)", thrownOutOfTest === false);
  check("4. outcome === persistence_failed", outcome?.outcome === "persistence_failed");
  check("5. enrichmentsRef restored to the exact pre-attempt currentEnrichments object", enrichmentsRef.current === currentEnrichments);
  check("6. target enrichment remains proposed in restored ref", enrichmentsRef.current.employment.find(e => e.id === "r2c-enrichment-007")!.status === "proposed");
  check("7. original IntakeFormData remains unchanged", JSON.stringify(currentData) === frozenCurrentData);
  check("8. original enrichment overlay remains unchanged", JSON.stringify(currentEnrichments) === frozenCurrentEnrichments);
  check("9. no success state is returned", outcome?.outcome !== "persisted");
  check("10. exception does not escape the test", thrownOutOfTest === false);
});

// ════════════════════════════════════════════════════════════════════════════
// R2C-T08 — SAME SERIALIZED CHECKPOINT
// ════════════════════════════════════════════════════════════════════════════
scenario("R2C-T08 — same serialized checkpoint contains both halves", () => {
  const cand = candidate("r2c-candidate-008");
  const row = entry("r2c-employment-008", "r2c-candidate-008");
  const enr = enrichment("r2c-enrichment-008", "r2c-candidate-008", { mainFunctions: "New responsibility" });
  const currentData = { ...buildInitialIntakeFormData("r2c-t08@example.com"), module7: { employment: [row] } };
  const currentEnrichments = enrichmentsWith([enr]);
  const enrichmentsRef = { current: currentEnrichments };
  const writer = makeWriter();

  const deps: PostBaseEmploymentEnrichmentCheckpointDeps = {
    currentData, currentEnrichments, enrichmentsRef,
    persist: (nextData) => {
      const envelope = buildDraftEnvelope(nextData, 0, emptyProfessionalIntelligenceCandidates(), enrichmentsRef.current, "2026-01-01T00:00:00.000Z");
      return persistDraftEnvelope(writer, "r2c-t08-storage-key", envelope);
    },
  };

  const outcome = runPostBaseEmploymentEnrichmentCheckpoint(cand, enr, deps);

  check("outcome persisted", outcome.outcome === "persisted");
  check("1. exactly ONE writer.setItem occurred", writer.writes.length === 1);
  const parsed: DraftEnvelope = JSON.parse(writer.writes[0]!.value);
  check("2. parse THAT ONE exact captured string succeeded", parsed !== undefined);
  const patchedRow = parsed.data.module7.employment.find(e => e.id === "r2c-employment-008");
  check("3A. module7.employment contains the patched existing row (within the SAME parsed object)", !!patchedRow?.mainFunctions.includes("New responsibility"));
  const acceptedEnrichment = parsed.professionalIntelligenceEnrichments?.employment.find(e => e.id === "r2c-enrichment-008");
  check("3B. professionalIntelligenceEnrichments contains the exact target enrichment accepted (within the SAME parsed object)", acceptedEnrichment?.status === "accepted");
  check("4. no second serialized value was used (single writer.writes entry re-used for both halves)", writer.writes.length === 1);
  check("5. employment row id preserved", patchedRow?.id === "r2c-employment-008");
  check("6. piOriginCandidateId preserved", patchedRow?.piOriginCandidateId === "r2c-candidate-008");
  check("7. candidate overlay sibling remains present and unchanged", JSON.stringify(parsed.professionalIntelligenceCandidates) === JSON.stringify(emptyProfessionalIntelligenceCandidates()));
});

// ════════════════════════════════════════════════════════════════════════════
// R2C-T09 — NORMALIZED DUPLICATE
// ════════════════════════════════════════════════════════════════════════════
scenario("R2C-T09 — normalized duplicate narrative", () => {
  const cand = candidate("r2c-candidate-009");
  const row = entry("r2c-employment-009", "r2c-candidate-009", { mainFunctions: "Led the payments migration" });
  // Normalized-duplicate per the REAL appendPreserveExisting semantics
  // (trim+lowercase+collapse-whitespace equal, different casing/spacing).
  const enr = enrichment("r2c-enrichment-009", "r2c-candidate-009", { mainFunctions: "  led   the payments migration  " });
  const currentData = { ...buildInitialIntakeFormData("r2c-t09@example.com"), module7: { employment: [row] } };
  const currentEnrichments = enrichmentsWith([enr]);
  const enrichmentsRef = { current: currentEnrichments };
  const writer = makeWriter();

  const deps: PostBaseEmploymentEnrichmentCheckpointDeps = {
    currentData, currentEnrichments, enrichmentsRef,
    persist: (nextData) => persistDraftEnvelope(writer, "r2c-t09-storage-key", buildDraftEnvelope(nextData, 0, emptyProfessionalIntelligenceCandidates(), enrichmentsRef.current, "2026-01-01T00:00:00.000Z")),
  };

  const outcome = runPostBaseEmploymentEnrichmentCheckpoint(cand, enr, deps);

  check("outcome persisted (not fail_closed)", outcome.outcome === "persisted");
  check("exactly one write", writer.writes.length === 1);
  const parsed: DraftEnvelope = JSON.parse(writer.writes[0]!.value);
  const parsedRow = parsed.data.module7.employment.find(e => e.id === "r2c-employment-009");
  check("rendered narrative remains unchanged (appendPreserveExisting's own normalized-duplicate no-op)", parsedRow?.mainFunctions === "Led the payments migration");
  check("row count unchanged", parsed.data.module7.employment.length === 1);
  check("row id unchanged", parsedRow?.id === "r2c-employment-009");
  const parsedEnrichment = parsed.professionalIntelligenceEnrichments?.employment.find(e => e.id === "r2c-enrichment-009");
  check("target enrichment becomes accepted", parsedEnrichment?.status === "accepted");
  check("serialized checkpoint contains accepted enrichment despite narrative no-op", parsedEnrichment?.status === "accepted");
});

// ════════════════════════════════════════════════════════════════════════════
// R2C-T10 — SEQUENTIAL ENRICHMENTS A → B
// ════════════════════════════════════════════════════════════════════════════
scenario("R2C-T10 — sequential enrichments A then B (second call consumes first's committed result)", () => {
  const cand = candidate("r2c-candidate-010");
  const row = entry("r2c-employment-010", "r2c-candidate-010", { mainFunctions: "Baseline responsibility" });
  const enrichmentA = enrichment("r2c-enrichment-a", "r2c-candidate-010", { mainFunctions: "Narrative A" });
  const enrichmentB = enrichment("r2c-enrichment-b", "r2c-candidate-010", { mainFunctions: "Narrative B" });
  const writer = makeWriter();

  // ── First execution: A ──
  const dataForA = { ...buildInitialIntakeFormData("r2c-t10@example.com"), module7: { employment: [row] } };
  const enrichmentsForA = enrichmentsWith([enrichmentA, enrichmentB]);
  const enrichmentsRef = { current: enrichmentsForA };

  const depsA: PostBaseEmploymentEnrichmentCheckpointDeps = {
    currentData: dataForA, currentEnrichments: enrichmentsForA, enrichmentsRef,
    persist: (nextData) => persistDraftEnvelope(writer, "r2c-t10-storage-key", buildDraftEnvelope(nextData, 0, emptyProfessionalIntelligenceCandidates(), enrichmentsRef.current, "2026-01-01T00:00:00.000Z")),
  };
  const outcomeA = runPostBaseEmploymentEnrichmentCheckpoint(cand, enrichmentA, depsA);

  check("A persisted", outcomeA.outcome === "persisted");
  check("A accepted", outcomeA.outcome === "persisted" && outcomeA.nextEnrichments.employment.find(e => e.id === "r2c-enrichment-a")!.status === "accepted");
  check("serialized A checkpoint contains A's narrative", writer.writes.length === 1 && writer.writes[0]!.value.includes("Narrative A"));

  if (outcomeA.outcome !== "persisted") { throw new Error("R2C-T10 cannot proceed: A did not persist"); }

  // ── Second execution: B, using A's ACTUAL committed result as input ──
  // (never resetting to pre-A state, never manually reconstructing A's changes)
  const dataForB = outcomeA.nextData;
  const enrichmentsForB = outcomeA.nextEnrichments;
  // enrichmentsRef.current is already outcomeA.nextEnrichments (Layer 2's own
  // real success behavior leaves it there) -- re-affirm rather than reset,
  // matching exactly what production leaves behind after a successful A.
  check("enrichmentsRef already holds A's committed result before B runs", enrichmentsRef.current === outcomeA.nextEnrichments);

  const depsB: PostBaseEmploymentEnrichmentCheckpointDeps = {
    currentData: dataForB, currentEnrichments: enrichmentsForB, enrichmentsRef,
    persist: (nextData) => persistDraftEnvelope(writer, "r2c-t10-storage-key", buildDraftEnvelope(nextData, 0, emptyProfessionalIntelligenceCandidates(), enrichmentsRef.current, "2026-01-01T00:00:01.000Z")),
  };
  const outcomeB = runPostBaseEmploymentEnrichmentCheckpoint(cand, enrichmentB, depsB);

  check("1. B outcome persisted", outcomeB.outcome === "persisted");
  check("2. second execution performs exactly one additional write", writer.writes.length === 2);
  if (outcomeB.outcome === "persisted") {
    const finalRow = outcomeB.nextData.module7.employment.find(e => e.id === "r2c-employment-010");
    check("3. same EmploymentEntry.id remains", finalRow?.id === "r2c-employment-010");
    check("4. same piOriginCandidateId remains", finalRow?.piOriginCandidateId === "r2c-candidate-010");
    check("5. A narrative remains present", !!finalRow?.mainFunctions.includes("Narrative A"));
    check("6. B narrative is added according to appendPreserveExisting", !!finalRow?.mainFunctions.includes("Narrative B") && finalRow!.mainFunctions === "Baseline responsibility\n\nNarrative A\n\nNarrative B");
    check("7. A enrichment remains accepted", outcomeB.nextEnrichments.employment.find(e => e.id === "r2c-enrichment-a")!.status === "accepted");
    check("8. B enrichment becomes accepted", outcomeB.nextEnrichments.employment.find(e => e.id === "r2c-enrichment-b")!.status === "accepted");
    check("10. no duplicate EmploymentEntry was appended", outcomeB.nextData.module7.employment.length === 1);
  }
  const secondParsed: DraftEnvelope = JSON.parse(writer.writes[1]!.value);
  const secondParsedRow = secondParsed.data.module7.employment.find(e => e.id === "r2c-employment-010");
  check("9. second serialized DraftEnvelope contains BOTH accumulated narrative state and both accepted enrichment statuses",
    !!secondParsedRow?.mainFunctions.includes("Narrative A") && !!secondParsedRow?.mainFunctions.includes("Narrative B") &&
    secondParsed.professionalIntelligenceEnrichments?.employment.find(e => e.id === "r2c-enrichment-a")?.status === "accepted" &&
    secondParsed.professionalIntelligenceEnrichments?.employment.find(e => e.id === "r2c-enrichment-b")?.status === "accepted");
});

console.log(`\nScenarios executed: ${scenarioCount}`);
console.log(`Assertions executed: ${assertionCount}`);
console.log(`Failures: ${failures}`);
console.log(failures === 0 ? "\nALL E2-R2C RUNTIME SCENARIOS PASS" : `\n${failures} E2-R2C ASSERTION(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
