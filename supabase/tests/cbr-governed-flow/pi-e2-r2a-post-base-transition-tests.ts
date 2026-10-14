// Implementation E2-R2A — PI Employment Enrichment Post-Base-Acceptance
// Materialization, Authoritative Transition Seam (Layer 1). Executable,
// non-database, non-network, non-LLM unit tests against the REAL
// production export buildPostBaseEmploymentEnrichmentTransition in
// src/lib/intake/professional-intelligence.ts (imported by path, never
// reimplemented) — mirrors pi-a/pi-c1/pi-d0a's own established
// convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-e2-r2a-post-base-transition-tests.ts
//
// Scope: Layer 1 only. No checkpoint orchestrator, no DraftEnvelope
// builder, no persistence boundary, no save(), no handler wiring — those
// belong to E2-R2B, not implemented here.

import {
  type EmploymentCandidate,
  type EmploymentEnrichment,
  type ProfessionalIntelligenceEnrichments,
  type CandidateProvenance,
  buildPostBaseEmploymentEnrichmentTransition,
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
// R2A-T01 — HAPPY PATH
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c1");
  const row = entry("row1", "c1");
  const otherRow = entry("row2", "other-candidate");
  const enr = enrichment("e1", "c1", { mainFunctions: "Also led the platform migration" });
  const enrichmentsIn = enrichmentsWith([enr]);
  const employmentIn = [row, otherRow];

  const frozenCandidate = JSON.stringify(cand);
  const frozenEnrichment = JSON.stringify(enr);
  const frozenEmployment = JSON.stringify(employmentIn);
  const frozenEnrichments = JSON.stringify(enrichmentsIn);

  const result = buildPostBaseEmploymentEnrichmentTransition(cand, enr, employmentIn, enrichmentsIn);

  check("T01 ready_to_checkpoint", result.outcome === "ready_to_checkpoint");
  if (result.outcome === "ready_to_checkpoint") {
    check("T01 employment length unchanged", result.nextEmployment.length === employmentIn.length);
    check("T01 exact row id preserved", result.nextEmployment.find(e => e.id === "row1") !== undefined);
    check("T01 exact piOriginCandidateId preserved", result.nextEmployment.find(e => e.id === "row1")!.piOriginCandidateId === "c1");
    check("T01 intended narrative updated", result.nextEmployment.find(e => e.id === "row1")!.mainFunctions.includes("Also led the platform migration"));
    check("T01 enrichment becomes accepted", result.nextEnrichments.employment.find(e => e.id === "e1")!.status === "accepted");
  }
  check("T01 candidate input unchanged", JSON.stringify(cand) === frozenCandidate);
  check("T01 enrichment input unchanged", JSON.stringify(enr) === frozenEnrichment);
  check("T01 employment input array unchanged", JSON.stringify(employmentIn) === frozenEmployment);
  check("T01 enrichments input unchanged", JSON.stringify(enrichmentsIn) === frozenEnrichments);
}

// ════════════════════════════════════════════════════════════════════════════
// R2A-T02 — ZERO LINK
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c2");
  const enr = enrichment("e2", "c2", { mainFunctions: "New responsibility" });
  const employmentIn = [entry("row1", "unrelated-candidate")];
  const enrichmentsIn = enrichmentsWith([enr]);
  const frozenEmployment = JSON.stringify(employmentIn);
  const frozenEnrichments = JSON.stringify(enrichmentsIn);

  const result = buildPostBaseEmploymentEnrichmentTransition(cand, enr, employmentIn, enrichmentsIn);

  check("T02 fail_closed", result.outcome === "fail_closed");
  check("T02 reason zero_linked_rows", result.outcome === "fail_closed" && result.reason === "zero_linked_rows");
  check("T02 no employment input mutation", JSON.stringify(employmentIn) === frozenEmployment);
  check("T02 no enrichments input mutation", JSON.stringify(enrichmentsIn) === frozenEnrichments);
}

// ════════════════════════════════════════════════════════════════════════════
// R2A-T03 — MULTIPLE LINKS
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c3");
  const enr = enrichment("e3", "c3", { mainFunctions: "New responsibility" });
  const employmentIn = [entry("row1", "c3"), entry("row2", "c3")];
  const enrichmentsIn = enrichmentsWith([enr]);
  const frozenEmployment = JSON.stringify(employmentIn);

  const result = buildPostBaseEmploymentEnrichmentTransition(cand, enr, employmentIn, enrichmentsIn);

  check("T03 fail_closed", result.outcome === "fail_closed");
  check("T03 reason multiple_linked_rows", result.outcome === "fail_closed" && result.reason === "multiple_linked_rows");
  check("T03 no employment input mutation", JSON.stringify(employmentIn) === frozenEmployment);
}

// ════════════════════════════════════════════════════════════════════════════
// R2A-T04 — BLANK PATCH
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c4");
  const row = entry("row1", "c4");

  for (const patch of [{}, { mainFunctions: "", importantProjects: "", mainAchievements: "" }, { mainFunctions: "   ", importantProjects: "\n", mainAchievements: "\t" }]) {
    const enr = enrichment("e4", "c4", patch);
    const employmentIn = [row];
    const enrichmentsIn = enrichmentsWith([enr]);
    const frozenEmployment = JSON.stringify(employmentIn);

    const result = buildPostBaseEmploymentEnrichmentTransition(cand, enr, employmentIn, enrichmentsIn);
    check(`T04 fail_closed for patch ${JSON.stringify(patch)}`, result.outcome === "fail_closed");
    check(`T04 reason blank_patch for patch ${JSON.stringify(patch)}`, result.outcome === "fail_closed" && result.reason === "blank_patch");
    check(`T04 no employment input mutation for patch ${JSON.stringify(patch)}`, JSON.stringify(employmentIn) === frozenEmployment);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// R2A-T05 — INELIGIBLE COACH-DISCOVERY CANDIDATE
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c5", { provenance: [prov("coach_discovery")] });
  const row = entry("row1", "c5");
  const enr = enrichment("e5", "c5", { mainFunctions: "New responsibility" });
  const employmentIn = [row];
  const enrichmentsIn = enrichmentsWith([enr]);
  const frozenEmployment = JSON.stringify(employmentIn);

  const result = buildPostBaseEmploymentEnrichmentTransition(cand, enr, employmentIn, enrichmentsIn);

  check("T05 fail_closed", result.outcome === "fail_closed");
  check("T05 reason not_eligible", result.outcome === "fail_closed" && result.reason === "not_eligible");
  check("T05 no row resolution fallback (no mutation despite a real linked row existing)", JSON.stringify(employmentIn) === frozenEmployment);
}

// ════════════════════════════════════════════════════════════════════════════
// R2A-T06 — THREE-FIELD BOUNDARY
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c6");
  const row = entry("row1", "c6", {
    mainFunctions: "Existing functions", importantProjects: "Existing projects", mainAchievements: "Existing achievements",
    company: "Expedia", country: "Colombia", city: "Bogota", title: "Senior Engineer", startDate: "2019-01",
    endDate: "2021-06", isCurrent: false, peopleSupervised: "5", managesBudget: true, budgetAmount: "100000",
    whyImportant: "Critical system", supervisorName: "Jane Doe", supervisorTitle: "VP", supervisorEmail: "jane@x.com",
    supervisorPhone: "123", companyWebsite: "https://expedia.com", internationalRecognition: "Patent awarded",
  });
  const enr = enrichment("e6", "c6", { mainFunctions: "New functions", importantProjects: "New projects", mainAchievements: "New achievements" });
  const employmentIn = [row];
  const enrichmentsIn = enrichmentsWith([enr]);

  const result = buildPostBaseEmploymentEnrichmentTransition(cand, enr, employmentIn, enrichmentsIn);
  check("T06 ready_to_checkpoint", result.outcome === "ready_to_checkpoint");
  if (result.outcome === "ready_to_checkpoint") {
    const patched = result.nextEmployment.find(e => e.id === "row1")!;
    check("T06 mainFunctions changed to existing+new (appendPreserveExisting)", patched.mainFunctions === "Existing functions\n\nNew functions");
    check("T06 importantProjects changed to existing+new (appendPreserveExisting)", patched.importantProjects === "Existing projects\n\nNew projects");
    check("T06 mainAchievements changed to existing+new (appendPreserveExisting)", patched.mainAchievements === "Existing achievements\n\nNew achievements");
    const unchangedFieldsMatch = (Object.keys(row) as (keyof EmploymentEntry)[])
      .filter(key => key !== "mainFunctions" && key !== "importantProjects" && key !== "mainAchievements")
      .every(key => patched[key] === row[key]);
    check("T06 every other field deep-equal to original", unchangedFieldsMatch);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// R2A-T07 — UNRELATED ROW PRESERVATION
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c7");
  const linkedRow = entry("row1", "c7");
  const unrelatedRowA = entry("row0", "someone-else", { company: "Google" });
  const unrelatedRowB = entry("row2", undefined, { company: "Manual Entry Co" });
  const employmentIn = [unrelatedRowA, linkedRow, unrelatedRowB];
  const enr = enrichment("e7", "c7", { mainFunctions: "New responsibility" });
  const enrichmentsIn = enrichmentsWith([enr]);

  const result = buildPostBaseEmploymentEnrichmentTransition(cand, enr, employmentIn, enrichmentsIn);
  check("T07 ready_to_checkpoint", result.outcome === "ready_to_checkpoint");
  if (result.outcome === "ready_to_checkpoint") {
    check("T07 same length", result.nextEmployment.length === 3);
    check("T07 same order/position (unrelatedRowA first)", result.nextEmployment[0].id === "row0");
    check("T07 same order/position (linkedRow second)", result.nextEmployment[1].id === "row1");
    check("T07 same order/position (unrelatedRowB third)", result.nextEmployment[2].id === "row2");
    check("T07 unrelatedRowA deep-equal (untouched)", JSON.stringify(result.nextEmployment[0]) === JSON.stringify(unrelatedRowA));
    check("T07 unrelatedRowB deep-equal (untouched)", JSON.stringify(result.nextEmployment[2]) === JSON.stringify(unrelatedRowB));
    check("T07 no append (no row with a new id)", result.nextEmployment.every(e => ["row0", "row1", "row2"].includes(e.id)));
    check("T07 no delete", result.nextEmployment.length === employmentIn.length);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// R2A-T08 — ENRICHMENT ISOLATION
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c8");
  const row = entry("row1", "c8");
  const targetEnrichment = enrichment("e8-target", "c8", { mainFunctions: "New responsibility" });
  const otherEnrichment = enrichment("e8-other", "some-other-candidate", { mainFunctions: "Unrelated" });
  const employmentIn = [row];
  const enrichmentsIn = enrichmentsWith([otherEnrichment, targetEnrichment]);
  const frozenOther = JSON.stringify(otherEnrichment);

  const result = buildPostBaseEmploymentEnrichmentTransition(cand, targetEnrichment, employmentIn, enrichmentsIn);
  check("T08 ready_to_checkpoint", result.outcome === "ready_to_checkpoint");
  if (result.outcome === "ready_to_checkpoint") {
    check("T08 only target enrichment becomes accepted", result.nextEnrichments.employment.find(e => e.id === "e8-target")!.status === "accepted");
    const other = result.nextEnrichments.employment.find(e => e.id === "e8-other")!;
    check("T08 other enrichment deep-equal (unchanged)", JSON.stringify(other) === frozenOther);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// R2A-T09 — NORMALIZED DUPLICATE
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c9");
  const row = entry("row1", "c9", { mainFunctions: "Led the payments migration" });
  // Normalized-duplicate per appendPreserveExisting (trim+lowercase+collapse-whitespace equal, different casing/whitespace)
  const enr = enrichment("e9", "c9", { mainFunctions: "  led   the payments migration  " });
  const employmentIn = [row];
  const enrichmentsIn = enrichmentsWith([enr]);

  const result = buildPostBaseEmploymentEnrichmentTransition(cand, enr, employmentIn, enrichmentsIn);
  check("T09 ready_to_checkpoint (valid patch + exact target, not blank/dup-rejected)", result.outcome === "ready_to_checkpoint");
  if (result.outcome === "ready_to_checkpoint") {
    const patched = result.nextEmployment.find(e => e.id === "row1")!;
    check("T09 narrative remains unchanged (appendPreserveExisting's own normalized-duplicate no-op)", patched.mainFunctions === "Led the payments migration");
    check("T09 target enrichment becomes accepted despite unchanged narrative", result.nextEnrichments.employment.find(e => e.id === "e9")!.status === "accepted");
  }
}

// ════════════════════════════════════════════════════════════════════════════
// R2A-T10 — INPUT IMMUTABILITY (deep-clone based, successful invocation)
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c10");
  const row = entry("row1", "c10");
  const otherRow = entry("row2", "unrelated");
  const enr = enrichment("e10", "c10", { mainFunctions: "New responsibility", importantProjects: "New project", mainAchievements: "New achievement" });
  const employmentIn = [row, otherRow];
  const enrichmentsIn = enrichmentsWith([enr]);

  const candClone = JSON.parse(JSON.stringify(cand));
  const enrClone = JSON.parse(JSON.stringify(enr));
  const employmentClone = JSON.parse(JSON.stringify(employmentIn));
  const enrichmentsClone = JSON.parse(JSON.stringify(enrichmentsIn));

  const result = buildPostBaseEmploymentEnrichmentTransition(cand, enr, employmentIn, enrichmentsIn);

  check("T10 invocation succeeded (ready_to_checkpoint)", result.outcome === "ready_to_checkpoint");
  check("T10 original candidate unchanged", JSON.stringify(cand) === JSON.stringify(candClone));
  check("T10 original enrichment unchanged", JSON.stringify(enr) === JSON.stringify(enrClone));
  check("T10 original currentEmployment array unchanged", JSON.stringify(employmentIn) === JSON.stringify(employmentClone));
  check("T10 original currentEnrichments unchanged", JSON.stringify(enrichmentsIn) === JSON.stringify(enrichmentsClone));
  check("T10 result.nextEmployment is a different array reference than currentEmployment", result.outcome === "ready_to_checkpoint" && result.nextEmployment !== employmentIn);
  check("T10 result.nextEnrichments is a different object reference than currentEnrichments", result.outcome === "ready_to_checkpoint" && result.nextEnrichments !== enrichmentsIn);
}

console.log(failures === 0 ? "\nALL E2-R2A CHECKS PASS" : `\n${failures} E2-R2A CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
