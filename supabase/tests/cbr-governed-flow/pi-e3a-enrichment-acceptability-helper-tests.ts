// Implementation E3-A — Post-Base Employment Enrichment UI Eligibility
// Projection, Helper Implementation (approved E3 Exact Design). Executable,
// non-database, non-network, non-LLM unit tests against the REAL
// production export getEmploymentEnrichmentAcceptability in
// src/lib/intake/professional-intelligence.ts (imported by path, never
// reimplemented) — mirrors pi-a/pi-d0a/pi-e2-r2a's own established
// convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-e3a-enrichment-acceptability-helper-tests.ts
//
// Scope: the pure helper only. No UI wiring (professional-candidate-
// review.tsx), no IntakeForm.tsx change — those belong to a later,
// separately authorized E3-B slice, not implemented here.

import { readFileSync } from "fs";
import {
  type EmploymentCandidate,
  type EmploymentEnrichment,
  type CandidateProvenance,
  getEmploymentEnrichmentAcceptability,
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
    id, domain: "employment", status: "proposed", provenance: [prov()],
    company: "Expedia", title: "Senior Engineer", startDate: "2019-01", endDate: "2021-06",
    mainFunctions: "", importantProjects: "", mainAchievements: "",
    ...overrides,
  };
}

function entry(id: string, piOriginCandidateId: string | undefined, overrides: Partial<EmploymentEntry> = {}): EmploymentEntry {
  return {
    id, piOriginCandidateId, company: "Expedia", country: "", city: "", title: "Senior Engineer",
    startDate: "2019-01", endDate: "2021-06", isCurrent: false, mainFunctions: "", importantProjects: "",
    mainAchievements: "", peopleSupervised: "0", managesBudget: null, budgetAmount: "", whyImportant: "",
    supervisorName: "", supervisorTitle: "", supervisorEmail: "", supervisorPhone: "", companyWebsite: "",
    internationalRecognition: "",
    ...overrides,
  };
}

function enrichment(id: string, candidateId: string, patch: EmploymentEnrichment["patch"] = { mainFunctions: "Some narrative" }): EmploymentEnrichment {
  return { id, target: { domain: "employment", candidateId }, status: "proposed", provenance: [prov()], patch };
}

// ════════════════════════════════════════════════════════════════════════════
// T01 — valid Path A (CV-derived proposed candidate)
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c1", { status: "proposed", provenance: [prov("cv_extraction")] });
  const enr = enrichment("e1", "c1");
  const result = getEmploymentEnrichmentAcceptability(cand, enr, []);
  check("T01 Path A valid proposed CV candidate -> actionable", result.actionable === true);
  check("T01 path === pre_base", result.path === "pre_base");
}

// ════════════════════════════════════════════════════════════════════════════
// T02 — valid Path B (exactly one linked row)
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c2", { status: "accepted_in_module", provenance: [prov("cv_extraction")] });
  const enr = enrichment("e2", "c2");
  const row = entry("row1", "c2");
  const unrelated = entry("row2", "unrelated");
  const result = getEmploymentEnrichmentAcceptability(cand, enr, [row, unrelated]);
  check("T02 Path B exactly one link -> actionable", result.actionable === true);
  check("T02 path === post_base", result.path === "post_base");
}

// ════════════════════════════════════════════════════════════════════════════
// T03 — Path B zero link
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c3", { status: "accepted_in_module", provenance: [prov("cv_extraction")] });
  const enr = enrichment("e3", "c3");
  const unrelated = entry("row1", "unrelated");
  const result = getEmploymentEnrichmentAcceptability(cand, enr, [unrelated]);
  check("T03 Path B zero links -> not actionable", result.actionable === false);
  check("T03 reason === zero_linked_rows", !result.actionable && result.reason === "zero_linked_rows");
  check("T03 path === post_base", !result.actionable && result.path === "post_base");
}

// ════════════════════════════════════════════════════════════════════════════
// T04 — Path B multiple links
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c4", { status: "accepted_in_module", provenance: [prov("cv_extraction")] });
  const enr = enrichment("e4", "c4");
  const rowA = entry("row1", "c4");
  const rowB = entry("row2", "c4");
  const result = getEmploymentEnrichmentAcceptability(cand, enr, [rowA, rowB]);
  check("T04 Path B multiple links -> not actionable", result.actionable === false);
  check("T04 reason === multiple_linked_rows", !result.actionable && result.reason === "multiple_linked_rows");
  check("T04 path === post_base", !result.actionable && result.path === "post_base");
  check("T04 no row selected (helper exposes no chosen/resolved row field)", !("row" in result) && !("resolvedRow" in result));
}

// ════════════════════════════════════════════════════════════════════════════
// T05 — accepted Coach-only candidate
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c5", { status: "accepted_in_module", provenance: [prov("coach_discovery")] });
  const enr = enrichment("e5", "c5");
  const row = entry("row1", "c5"); // a real linked row exists, but eligibility fails first
  const result = getEmploymentEnrichmentAcceptability(cand, enr, [row]);
  check("T05 Path B Coach-only -> not actionable", result.actionable === false);
  check("T05 reason === not_eligible", !result.actionable && result.reason === "not_eligible");
  check("T05 path === post_base", !result.actionable && result.path === "post_base");
  check("T05 no row-resolution fallback despite a real linked row existing", !result.actionable && result.reason === "not_eligible");
}

// ════════════════════════════════════════════════════════════════════════════
// T06 — blank patch / Path A
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c6", { status: "proposed", provenance: [prov("cv_extraction")] });
  for (const patch of [{}, { mainFunctions: "", importantProjects: "", mainAchievements: "" }, { mainFunctions: "   " }]) {
    const enr = enrichment("e6", "c6", patch);
    const result = getEmploymentEnrichmentAcceptability(cand, enr, []);
    check(`T06 blank patch ${JSON.stringify(patch)} (proposed candidate) -> not actionable`, result.actionable === false);
    check(`T06 reason === blank_patch`, !result.actionable && result.reason === "blank_patch");
    check(`T06 path === pre_base (classified from candidate.status, eligibility never run)`, !result.actionable && result.path === "pre_base");
  }
}

// ════════════════════════════════════════════════════════════════════════════
// T07 — blank patch / Path B
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c7", { status: "accepted_in_module", provenance: [prov("cv_extraction")] });
  const row = entry("row1", "c7"); // a real linked row exists, but blank-patch check runs first
  for (const patch of [{}, { mainFunctions: "", importantProjects: "", mainAchievements: "" }, { mainFunctions: "   " }]) {
    const enr = enrichment("e7", "c7", patch);
    const result = getEmploymentEnrichmentAcceptability(cand, enr, [row]);
    check(`T07 blank patch ${JSON.stringify(patch)} (accepted_in_module candidate, real linked row exists) -> not actionable`, result.actionable === false);
    check(`T07 reason === blank_patch`, !result.actionable && result.reason === "blank_patch");
    check(`T07 path === post_base (classified from candidate.status, eligibility/linkage never run)`, !result.actionable && result.path === "post_base");
  }
}

// ════════════════════════════════════════════════════════════════════════════
// T08 — rejected candidate
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c8", { status: "rejected", provenance: [prov("cv_extraction")] });
  const enr = enrichment("e8", "c8");
  const result = getEmploymentEnrichmentAcceptability(cand, enr, []);
  check("T08 rejected candidate -> not actionable", result.actionable === false);
  check("T08 reason === candidate_not_actionable", !result.actionable && result.reason === "candidate_not_actionable");
  check("T08 path === null", !result.actionable && result.path === null);
}

// ════════════════════════════════════════════════════════════════════════════
// T09 — exact-link firewall: lookalike rows (same company/title/dates) do
// NOT count unless piOriginCandidateId is an exact match
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c9", { status: "accepted_in_module", provenance: [prov("cv_extraction")], company: "Expedia", title: "Senior Engineer", startDate: "2019-01", endDate: "2021-06" });
  const enr = enrichment("e9", "c9");
  const lookalikeWrongId = entry("row1", "some-other-candidate-id", { company: "Expedia", title: "Senior Engineer", startDate: "2019-01", endDate: "2021-06" });
  const lookalikeNoId = entry("row2", undefined, { company: "Expedia", title: "Senior Engineer", startDate: "2019-01", endDate: "2021-06" });
  const result = getEmploymentEnrichmentAcceptability(cand, enr, [lookalikeWrongId, lookalikeNoId]);
  check("T09 lookalike company/title/date rows do NOT count as linked -> zero_linked_rows", !result.actionable && result.reason === "zero_linked_rows");
  check("T09 path === post_base", !result.actionable && result.path === "post_base");
  check("T09 no heuristic/positional fallback selected either lookalike row", result.actionable === false);
}

// ════════════════════════════════════════════════════════════════════════════
// T10 — multiple exact links: two rows with the exact same
// piOriginCandidateId, proving no first-match selection
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c10", { status: "accepted_in_module", provenance: [prov("cv_extraction")] });
  const enr = enrichment("e10", "c10");
  const rowA = entry("row1", "c10", { company: "First Co" });
  const rowB = entry("row2", "c10", { company: "Second Co" });
  const frozenRowA = JSON.stringify(rowA);
  const frozenRowB = JSON.stringify(rowB);

  const result = getEmploymentEnrichmentAcceptability(cand, enr, [rowA, rowB]);
  check("T10 multiple exact links -> multiple_linked_rows", !result.actionable && result.reason === "multiple_linked_rows");
  check("T10 no first-match selection: neither row is mutated/selected", JSON.stringify(rowA) === frozenRowA && JSON.stringify(rowB) === frozenRowB);
  check("T10 result exposes no chosen row field (proves no first-match was picked)", !("row" in result) && !("resolvedRow" in result) && !("selected" in result));

  // Reversed order must produce the identical classification -- order-independence
  // is further proof no positional/first-match rule exists.
  const resultReversed = getEmploymentEnrichmentAcceptability(cand, enr, [rowB, rowA]);
  check("T10 order-independent: reversed row order still -> multiple_linked_rows", !resultReversed.actionable && resultReversed.reason === "multiple_linked_rows");
}

// ════════════════════════════════════════════════════════════════════════════
// T11 — input immutability
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c11", { status: "accepted_in_module", provenance: [prov("cv_extraction")] });
  const enr = enrichment("e11", "c11");
  const row = entry("row1", "c11");
  const employmentRows = [row];
  const frozenCandidate = JSON.stringify(cand);
  const frozenEnrichment = JSON.stringify(enr);
  const frozenRows = JSON.stringify(employmentRows);

  getEmploymentEnrichmentAcceptability(cand, enr, employmentRows);

  check("T11 candidate input not mutated", JSON.stringify(cand) === frozenCandidate);
  check("T11 enrichment input not mutated", JSON.stringify(enr) === frozenEnrichment);
  check("T11 employmentRows input not mutated", JSON.stringify(employmentRows) === frozenRows);
}

// ════════════════════════════════════════════════════════════════════════════
// T12 — Owner-added: proposed Coach-only candidate (Path A)
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c12", { status: "proposed", provenance: [prov("coach_discovery")] });
  const enr = enrichment("e12", "c12");
  const lookalikeRow = entry("row1", "c12"); // even a real linked row cannot make a pre_base Coach-only candidate actionable
  const frozenRow = JSON.stringify(lookalikeRow);

  const result = getEmploymentEnrichmentAcceptability(cand, enr, [lookalikeRow]);
  check("T12 proposed Coach-only candidate -> not actionable", result.actionable === false);
  check("T12 reason === not_eligible", !result.actionable && result.reason === "not_eligible");
  check("T12 path === pre_base", !result.actionable && result.path === "pre_base");
  check("T12 no linkage lookup can make this candidate actionable (eligibility fails before any linkage logic runs)", result.actionable === false);
  check("T12 no EmploymentEntry is modified", JSON.stringify(lookalikeRow) === frozenRow);
  // Discard behavior is explicitly out of scope for E3-A -- this helper has
  // no reject/discard concept at all, confirmed structurally below.
}

// ════════════════════════════════════════════════════════════════════════════
// Structural: no forbidden matching signals, no persistence/React/mutation,
// no discard/reject vocabulary (Discard is out of scope for E3-A)
// ════════════════════════════════════════════════════════════════════════════
{
  const src = readFileSync(require.resolve("../../../src/lib/intake/professional-intelligence.ts"), "utf8");
  const fnStart = src.indexOf("export function getEmploymentEnrichmentAcceptability");
  const fnBody = src.slice(fnStart, fnStart + 2500);
  const closingBrace = fnBody.indexOf("\n}");
  const body = fnBody.slice(0, closingBrace + 2);

  check("No company/title/date matching inside the helper", !/entry\.company ===|entry\.title ===|\.startDate ===|\.endDate ===/.test(body));
  check("No fuzzy/semantic/LLM vocabulary inside the helper", !/fuzzy|semantic|LLM/i.test(body));
  check("No save/localStorage/React/persistence call inside the helper", !body.includes("save(") && !body.includes("localStorage") && !body.includes("useState") && !body.includes("useEffect") && !body.includes("setData"));
  check("No candidate mutation inside the helper (no candidate.<field> = write)", !/candidate\.\w+\s*=(?!=)/.test(body));
  check("No reject/discard logic inside the helper (out of scope for E3-A; the word \"rejected\" as a candidate status value in prose/comments is not a violation)",
    !/\bdiscard\b/i.test(body) && !/\breject\(/i.test(body) && !/onReject|handleReject/.test(body));
  check("Exact-id-only linkage reused verbatim from R2A", body.includes("entry.piOriginCandidateId === candidate.id"));
  check("Reuses isCandidateEligibleForEnrichmentAnchor verbatim (no duplicate implementation)", body.includes("isCandidateEligibleForEnrichmentAnchor(candidate)"));
  check("Reuses isCandidateEligibleForPostAcceptanceEnrichmentTarget verbatim (no duplicate implementation)", body.includes("isCandidateEligibleForPostAcceptanceEnrichmentTarget(candidate)"));
  check("Reuses hasNonBlankEmploymentEnrichmentPatch verbatim (no duplicate implementation)", body.includes("hasNonBlankEmploymentEnrichmentPatch(enrichment.patch)"));
}

console.log(failures === 0 ? "\nALL E3-A CHECKS PASS" : `\n${failures} E3-A CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
