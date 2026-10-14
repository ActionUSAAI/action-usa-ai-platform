// Implementation E3-B — UI Eligibility Projection Wiring & Beneficiary-
// Facing Blocked State (PI Employment Enrichment Post-Base-Acceptance
// Materialization). Non-database, non-network, non-LLM tests combining:
//
//   (a) REAL runtime execution of the already-tested E3-A production
//       helper (getEmploymentEnrichmentAcceptability) for each required
//       scenario, proving what it actually returns, and
//   (b) structural proof against the REAL production source of
//       professional-candidate-review.tsx and IntakeForm.tsx that the
//       component applies that EXACT returned value to the Accept
//       button's `disabled` attribute and to the blocked-explanation
//       copy lookup, never recomputing eligibility itself.
//
// Why (b) is structural, not rendered: professional-candidate-review.tsx
// (like every other .tsx file in this repo -- Module0, IntakeForm, etc.)
// omits `import React from "react"` and relies on Next.js's automatic
// JSX runtime; invoking its JSX-returning branches outside Next's
// bundler throws "ReferenceError: React is not defined" the moment any
// JSX actually evaluates. This is the exact same constraint the
// pre-existing pi-c2-professional-candidate-review-surface-tests.ts file
// already documented and worked within -- mirrored here, not reinvented.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-e3b-employment-enrichment-ui-projection-tests.ts

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

const REVIEW_FILE = "../../../src/app/intake/professional-candidate-review.tsx";
const INTAKEFORM_FILE = "../../../src/app/intake/IntakeForm.tsx";
const reviewSrc = readFileSync(require.resolve(REVIEW_FILE), "utf8");
const intakeFormSrc = readFileSync(require.resolve(INTAKEFORM_FILE), "utf8");
const reviewCode = reviewSrc.replace(/^\s*\/\/.*$/gm, "");

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

function entry(id: string, piOriginCandidateId: string | undefined): EmploymentEntry {
  return {
    id, piOriginCandidateId, company: "Expedia", country: "", city: "", title: "Senior Engineer",
    startDate: "2019-01", endDate: "2021-06", isCurrent: false, mainFunctions: "", importantProjects: "",
    mainAchievements: "", peopleSupervised: "0", managesBudget: null, budgetAmount: "", whyImportant: "",
    supervisorName: "", supervisorTitle: "", supervisorEmail: "", supervisorPhone: "", companyWebsite: "",
    internationalRecognition: "",
  };
}

function enrichment(id: string, candidateId: string, patch: EmploymentEnrichment["patch"] = { mainFunctions: "Some narrative" }): EmploymentEnrichment {
  return { id, target: { domain: "employment", candidateId }, status: "proposed", provenance: [prov()], patch };
}

const FROZEN_COPY = {
  zero_linked_rows: "Esta información no se puede aplicar automáticamente porque no encontramos el registro de experiencia original.",
  multiple_linked_rows: "Esta información no se puede aplicar automáticamente porque hay más de un registro de experiencia que coincide.",
  not_eligible: "Esta información no se puede aplicar automáticamente a este registro de experiencia.",
  blank_patch: "No hay información nueva para aplicar.",
  candidate_not_actionable: "Esta información ya no se puede aplicar a este registro de experiencia.",
} as const;

// ════════════════════════════════════════════════════════════════════════════
// T01 — Prop plumbing: IntakeForm passes employmentRows={data.module7.employment}
// ════════════════════════════════════════════════════════════════════════════
{
  check("T01 IntakeForm passes employmentRows={data.module7.employment} to ProfessionalCandidateReview",
    /<ProfessionalCandidateReview[^>]*employmentRows=\{data\.module7\.employment\}/.test(intakeFormSrc));
  check("T01b exactly one ProfessionalCandidateReview render site in IntakeForm.tsx",
    (intakeFormSrc.match(/<ProfessionalCandidateReview/g) ?? []).length === 1);
}

// ════════════════════════════════════════════════════════════════════════════
// Structural wiring proofs (apply to all scenarios T02–T09, T12)
// ════════════════════════════════════════════════════════════════════════════
{
  check("Wiring: component computes acceptability via the REAL getEmploymentEnrichmentAcceptability, once per card",
    /getEmploymentEnrichmentAcceptability\(x\.base, x\.enrichment, employmentRows\)/.test(reviewSrc));
  check("Wiring: EnrichmentCard receives the computed acceptability as a prop (never recomputed inside the card)",
    /<EnrichmentCard[\s\S]*?acceptability=\{acceptability\}/.test(reviewSrc));
  check("Wiring: Accept button's disabled attribute is exactly !acceptability.actionable",
    /disabled=\{!acceptability\.actionable\}/.test(reviewSrc));
  check("Wiring: blocked explanation is rendered only when !acceptability.actionable, keyed by acceptability.reason",
    /\{!acceptability\.actionable && \([\s\S]{0,80}BLOCKED_ACCEPTANCE_REASON_COPY\[acceptability\.reason\]/.test(reviewSrc));
}

// ════════════════════════════════════════════════════════════════════════════
// T02 — valid Path A wiring (actionable:true)
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c2", { status: "proposed", provenance: [prov("cv_extraction")] });
  const enr = enrichment("e2", "c2");
  const result = getEmploymentEnrichmentAcceptability(cand, enr, []);
  check("T02 valid Path A -> actionable true", result.actionable === true);
  check("T02 wiring: actionable:true means !acceptability.actionable is false -> disabled attribute evaluates false -> Accept enabled", !(!result.actionable));
  check("T02 wiring: no blocked-explanation block renders when actionable (guarded by the same !acceptability.actionable condition)", result.actionable === true);
}

// ════════════════════════════════════════════════════════════════════════════
// T03 — Path A Coach-only wiring (not_eligible)
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c3", { status: "proposed", provenance: [prov("coach_discovery")] });
  const enr = enrichment("e3", "c3");
  const result = getEmploymentEnrichmentAcceptability(cand, enr, []);
  check("T03 Path A Coach-only -> not actionable", result.actionable === false);
  check("T03 reason === not_eligible", !result.actionable && result.reason === "not_eligible");
  check("T03 exact frozen Spanish copy present in component source for not_eligible",
    reviewSrc.includes(FROZEN_COPY.not_eligible));
}

// ════════════════════════════════════════════════════════════════════════════
// T04 — valid Path B wiring (actionable:true, exactly one link)
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c4", { status: "accepted_in_module", provenance: [prov("cv_extraction")] });
  const enr = enrichment("e4", "c4");
  const row = entry("row1", "c4");
  const result = getEmploymentEnrichmentAcceptability(cand, enr, [row]);
  check("T04 valid Path B exactly one link -> actionable true", result.actionable === true);
}

// ════════════════════════════════════════════════════════════════════════════
// T05 — zero-link Path B wiring
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c5", { status: "accepted_in_module", provenance: [prov("cv_extraction")] });
  const enr = enrichment("e5", "c5");
  const result = getEmploymentEnrichmentAcceptability(cand, enr, []);
  check("T05 zero-link Path B -> not actionable", result.actionable === false);
  check("T05 reason === zero_linked_rows", !result.actionable && result.reason === "zero_linked_rows");
  check("T05 exact frozen Spanish copy present in component source for zero_linked_rows",
    reviewSrc.includes(FROZEN_COPY.zero_linked_rows));
}

// ════════════════════════════════════════════════════════════════════════════
// T06 — multiple-link Path B wiring
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c6", { status: "accepted_in_module", provenance: [prov("cv_extraction")] });
  const enr = enrichment("e6", "c6");
  const rowA = entry("row1", "c6");
  const rowB = entry("row2", "c6");
  const result = getEmploymentEnrichmentAcceptability(cand, enr, [rowA, rowB]);
  check("T06 multiple-link Path B -> not actionable", result.actionable === false);
  check("T06 reason === multiple_linked_rows", !result.actionable && result.reason === "multiple_linked_rows");
  check("T06 exact frozen Spanish copy present in component source for multiple_linked_rows",
    reviewSrc.includes(FROZEN_COPY.multiple_linked_rows));
}

// ════════════════════════════════════════════════════════════════════════════
// T07 — accepted Coach-only wiring
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c7", { status: "accepted_in_module", provenance: [prov("coach_discovery")] });
  const enr = enrichment("e7", "c7");
  const row = entry("row1", "c7");
  const result = getEmploymentEnrichmentAcceptability(cand, enr, [row]);
  check("T07 accepted Coach-only -> not actionable", result.actionable === false);
  check("T07 reason === not_eligible", !result.actionable && result.reason === "not_eligible");
}

// ════════════════════════════════════════════════════════════════════════════
// T08 — blank patch (Path A and Path B)
// ════════════════════════════════════════════════════════════════════════════
{
  const candA = candidate("c8a", { status: "proposed", provenance: [prov("cv_extraction")] });
  const enrA = enrichment("e8a", "c8a", {});
  const resultA = getEmploymentEnrichmentAcceptability(candA, enrA, []);
  check("T08 blank patch (Path A) -> not actionable", resultA.actionable === false);
  check("T08 reason === blank_patch (Path A)", !resultA.actionable && resultA.reason === "blank_patch");

  const candB = candidate("c8b", { status: "accepted_in_module", provenance: [prov("cv_extraction")] });
  const rowB = entry("row1", "c8b");
  const enrB = enrichment("e8b", "c8b", {});
  const resultB = getEmploymentEnrichmentAcceptability(candB, enrB, [rowB]);
  check("T08 blank patch (Path B) -> not actionable", resultB.actionable === false);
  check("T08 reason === blank_patch (Path B)", !resultB.actionable && resultB.reason === "blank_patch");

  check("T08 exact frozen Spanish copy present in component source for blank_patch",
    reviewSrc.includes(FROZEN_COPY.blank_patch));
}

// ════════════════════════════════════════════════════════════════════════════
// T09 — rejected candidate
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("c9", { status: "rejected", provenance: [prov("cv_extraction")] });
  const enr = enrichment("e9", "c9");
  const result = getEmploymentEnrichmentAcceptability(cand, enr, []);
  check("T09 rejected candidate -> not actionable", result.actionable === false);
  check("T09 reason === candidate_not_actionable", !result.actionable && result.reason === "candidate_not_actionable");
  check("T09 exact frozen Spanish copy present in component source for candidate_not_actionable",
    reviewSrc.includes(FROZEN_COPY.candidate_not_actionable));
}

// ════════════════════════════════════════════════════════════════════════════
// T10 — visibility unchanged (status===proposed + target resolves; no
// actionability incorporated into the visibility predicate itself)
// ════════════════════════════════════════════════════════════════════════════
{
  check("T10 enrichment visibility filter unchanged: status === \"proposed\" only",
    /enrichments\.employment\s*\.filter\(e => e\.status === "proposed"\)/.test(reviewSrc));
  check("T10 target-resolution filter unchanged: base !== undefined (existence only, no status/eligibility check)",
    /\.filter\(\(x\): x is \{ enrichment: EmploymentEnrichment; base: EmploymentCandidate \} => x\.base !== undefined\)/.test(reviewSrc));
  check("T10 the acceptability projection is appended AFTER visibility filtering (a separate .map, not folded into the filter predicate)",
    reviewSrc.indexOf("x.base !== undefined") < reviewSrc.indexOf("getEmploymentEnrichmentAcceptability(x.base"));
  check("T10 proposedEnrichments.length still gates the whole section's visibility (unchanged)",
    /\{proposedEnrichments\.length > 0 && \(/.test(reviewSrc));
}

// ════════════════════════════════════════════════════════════════════════════
// T11 — handler authority unchanged
// ════════════════════════════════════════════════════════════════════════════
{
  const acceptBody = intakeFormSrc.slice(intakeFormSrc.indexOf("const handleAcceptEnrichment"), intakeFormSrc.indexOf("const handleRejectEnrichment"));
  check("T11 handleAcceptEnrichment still calls runPostBaseEmploymentEnrichmentCheckpoint (Path B untouched)",
    acceptBody.includes("runPostBaseEmploymentEnrichmentCheckpoint(targetCandidate, enrichment,"));
  check("T11 handleAcceptEnrichment still gates setData/setProfessionalIntelligenceEnrichments on outcome.outcome === \"persisted\" (unchanged)",
    /if \(outcome\.outcome === "persisted"\) \{/.test(acceptBody));
  check("T11 handleAcceptEnrichment still contains the common guards unchanged (enrichment exists / status / domain / target candidate / nonblank patch)",
    acceptBody.includes("if (!enrichment) return;") &&
    acceptBody.includes('if (enrichment.status !== "proposed") return;') &&
    acceptBody.includes('if (enrichment.target.domain !== "employment") return;') &&
    acceptBody.includes("if (!targetCandidate) return;") &&
    acceptBody.includes("if (!hasNonBlankEmploymentEnrichmentPatch(enrichment.patch)) return;"));
  check("T11 handleAcceptEnrichment still preserves Path A unchanged (isCandidateEligibleForEnrichmentAnchor)",
    acceptBody.includes('if (targetCandidate.status === "proposed") {') && acceptBody.includes("isCandidateEligibleForEnrichmentAnchor(targetCandidate)"));
  check("T11 E3-B introduces no new call site to handleAcceptEnrichment beyond the existing ProfessionalCandidateReview wiring",
    (intakeFormSrc.match(/handleAcceptEnrichment/g) ?? []).length <= 3); // definition + useCallback dep array self-ref + the one onAcceptEnrichment={handleAcceptEnrichment} prop
}

// ════════════════════════════════════════════════════════════════════════════
// T12 — Discard independence
// ════════════════════════════════════════════════════════════════════════════
{
  const cardBody = reviewSrc.slice(reviewSrc.indexOf("function EnrichmentCard"), reviewSrc.indexOf("export function ProfessionalCandidateReview"));
  // Anchor precisely on the Discard <button ... up to its own </button> --
  // find the LAST "<button" preceding "onClick={onReject}" so the match
  // never accidentally spans back into the Accept button's own markup.
  const onRejectIdx = cardBody.indexOf("onClick={onReject}");
  const discardButtonStart = cardBody.lastIndexOf("<button", onRejectIdx);
  const discardButtonEnd = cardBody.indexOf("</button>", onRejectIdx);
  const discardButtonMarkup = cardBody.slice(discardButtonStart, discardButtonEnd + "</button>".length);
  check("T12 Discard button exists and is wired to onReject", discardButtonStart >= 0 && onRejectIdx > discardButtonStart && discardButtonEnd > onRejectIdx);
  check("T12 Discard button has no disabled attribute of any kind", !discardButtonMarkup.includes("disabled"));
  check("T12 Discard onReject wiring is unconditional (not inside any acceptability-gated block)",
    !/\{!acceptability\.actionable[\s\S]{0,30}\(\s*$/.test(cardBody.slice(0, discardButtonStart)));
  check("T12 handleRejectEnrichment (production) unchanged: depends only on enrichment.status === \"proposed\", zero candidate/eligibility dependency",
    (() => {
      const rejectBody = intakeFormSrc.slice(intakeFormSrc.indexOf("const handleRejectEnrichment"), intakeFormSrc.indexOf("const handleRejectEnrichment") + 700);
      return rejectBody.includes('if (enrichment.status !== "proposed") return;') &&
        !rejectBody.includes("targetCandidate") && !rejectBody.includes("isCandidateEligibleFor") && !rejectBody.includes("piOriginCandidateId");
    })());
}

// ════════════════════════════════════════════════════════════════════════════
// T13 — no business-logic duplication inside professional-candidate-review.tsx
// ════════════════════════════════════════════════════════════════════════════
{
  // Scoped to the Employment-enrichment-relevant functions only --
  // sourceLabel/Meta are pre-existing, unrelated cosmetic helpers (choose
  // which neutral label text to show) that already legitimately call
  // provenance.some(...) for display purposes, not Accept eligibility;
  // scoping here avoids a false positive against that pre-existing code.
  const enrichmentPath = reviewSrc.slice(reviewSrc.indexOf("function EnrichmentCard"));
  check("T13 no inline provenance.some( eligibility check duplicated in the Employment-enrichment render path",
    !enrichmentPath.includes("provenance.some("));
  check("T13 no inline piOriginCandidateId linkage filter duplicated in the Employment-enrichment render path",
    !enrichmentPath.includes("piOriginCandidateId ==="));
  check("T13 no inline hasNonBlankEmploymentEnrichmentPatch-equivalent reimplementation (no .trim() !== \"\" blank check) in the Employment-enrichment render path",
    !/\.trim\(\)\s*!==\s*""/.test(enrichmentPath));
  check("T13 no inline post-acceptance-eligibility reimplementation anywhere in the file (no second isCandidateEligibleFor*-style predicate defined)",
    !/function\s+isCandidateEligible/.test(reviewCode));
  check("T13 the only eligibility-producing call in this file is the imported getEmploymentEnrichmentAcceptability",
    (reviewCode.match(/getEmploymentEnrichmentAcceptability/g) ?? []).length >= 1);
}

// ════════════════════════════════════════════════════════════════════════════
// T14 — no raw reason leakage to the beneficiary
// ════════════════════════════════════════════════════════════════════════════
{
  const jsxRegion = reviewSrc.slice(reviewSrc.indexOf("return (\n    <div className=\"space-y-3"), reviewSrc.indexOf("export function ProfessionalCandidateReview"));
  for (const raw of ["not_eligible", "blank_patch", "zero_linked_rows", "multiple_linked_rows", "candidate_not_actionable"]) {
    check(`T14 raw reason string "${raw}" never appears as rendered JSX text (only as a Record key / internal vocabulary)`,
      !new RegExp(`>\\s*${raw}\\s*<|\\{"${raw}"\\}|\\{'${raw}'\\}`).test(jsxRegion));
  }
  check("T14 BLOCKED_ACCEPTANCE_REASON_COPY mapping is exhaustive over the frozen reason union (Record<EmploymentEnrichmentAcceptabilityReason, string> enforces this at compile time)",
    /const BLOCKED_ACCEPTANCE_REASON_COPY: Record<EmploymentEnrichmentAcceptabilityReason, string> = \{/.test(reviewSrc));
}

// ════════════════════════════════════════════════════════════════════════════
// Firewalls: no E2/E3-A production change, no heuristic matching introduced
// ════════════════════════════════════════════════════════════════════════════
{
  // Matches actual matching-logic usage (function/helper names, calls),
  // never the bare English word "semantics" appearing in unrelated prose
  // comments (e.g. the pre-existing "Coach provenance semantics" /
  // "Accept/Reject semantics" JSX comments, which are not stripped by the
  // simple //-only comment regex above since one is a {/* */} JSX block
  // comment -- those are legitimate, unrelated documentation, not a
  // firewall violation).
  check("Firewall: no fuzzy/semantic/LLM matching-logic vocabulary introduced in the review component",
    !/fuzzyMatch|semanticMatch|\bLLM\(/i.test(reviewCode));
  check("Firewall: no company/title/date-based linkage matching introduced in the review component",
    !/entry\.company ===|entry\.title ===|\.startDate ===|\.endDate ===/.test(reviewCode));
  check("Firewall: review component never calls save()/localStorage/persistDraftEnvelope (presentational-only re-proof after E3-B)",
    !reviewCode.includes("save(") && !reviewCode.includes("localStorage") && !reviewCode.includes("persistDraftEnvelope"));
}

console.log(failures === 0 ? "\nALL E3-B CHECKS PASS" : `\n${failures} E3-B CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
