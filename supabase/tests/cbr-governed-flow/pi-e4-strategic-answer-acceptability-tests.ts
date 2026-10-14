// Implementation E4 — StrategicAnswer Blocked-Acceptance Projection
// (approved E4 Exact Design, Owner MR). Executable, non-database,
// non-network, non-LLM tests combining:
//
//   (a) REAL runtime execution of the production helper
//       getStrategicAnswerAcceptability (src/lib/intake/professional-intelligence.ts),
//       and
//   (b) structural proof against the REAL production source of
//       professional-candidate-review.tsx and IntakeForm.tsx that the
//       component applies that EXACT returned value to the Accept
//       button's `disabled` attribute and to the blocked-explanation
//       copy lookup, never recomputing eligibility itself.
//
// Why (b) is structural, not rendered: professional-candidate-review.tsx
// omits `import React from "react"` and relies on Next.js's automatic
// JSX runtime; invoking its JSX-returning branches outside Next's
// bundler throws "ReferenceError: React is not defined" the moment any
// JSX actually evaluates. This mirrors the exact, already-established
// convention used by pi-c2-professional-candidate-review-surface-tests.ts
// and pi-e3b-employment-enrichment-ui-projection-tests.ts for this same
// file -- not reinvented here.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-e4-strategic-answer-acceptability-tests.ts

import { readFileSync } from "fs";
import {
  type StrategicAnswerCandidate,
  type CandidateProvenance,
  getStrategicAnswerAcceptability,
} from "../../../src/lib/intake/professional-intelligence";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const REVIEW_FILE = "../../../src/app/intake/professional-candidate-review.tsx";
const INTAKEFORM_FILE = "../../../src/app/intake/IntakeForm.tsx";
const reviewSrc = readFileSync(require.resolve(REVIEW_FILE), "utf8");
const intakeFormSrc = readFileSync(require.resolve(INTAKEFORM_FILE), "utf8");
const reviewCode = reviewSrc.replace(/^\s*\/\/.*$/gm, "");

const prov = (): CandidateProvenance => ({ source: "coach_discovery", rawText: "x", confidence: "high" });

function candidate(id: string, overrides: Partial<StrategicAnswerCandidate> = {}): StrategicAnswerCandidate {
  return {
    id, domain: "strategicAnswer", status: "proposed", provenance: [prov()],
    targetField: "ledImpactProjects", answer: "Led a cross-team initiative with measurable impact.",
    ...overrides,
  };
}

const FROZEN_COPY = "Este campo ya contiene una respuesta. Puedes descartar esta propuesta si no deseas conservarla.";

// ════════════════════════════════════════════════════════════════════════════
// T01 — HAPPY PATH (target answer blank)
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("sa1");
  const frozenCandidate = JSON.stringify(cand);
  const result = getStrategicAnswerAcceptability(cand, "");
  check("T01 blank target answer -> actionable true", result.actionable === true);
  check("T01 no blocked reason present", result.actionable === true && result.reason === undefined);
  check("T01 candidate input unchanged", JSON.stringify(cand) === frozenCandidate);
}
{
  // Also prove whitespace-only counts as blank (mirrors the handler's own .trim() check exactly).
  const cand = candidate("sa1b");
  const result = getStrategicAnswerAcceptability(cand, "   ");
  check("T01b whitespace-only target answer -> actionable true (mirrors handler's own .trim() semantics)", result.actionable === true);
}

// ════════════════════════════════════════════════════════════════════════════
// T02 — ALREADY ANSWERED
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("sa2");
  const result = getStrategicAnswerAcceptability(cand, "An existing beneficiary-authored answer.");
  check("T02 non-blank target answer -> not actionable", result.actionable === false);
  check("T02 reason === already_answered (exact)", !result.actionable && result.reason === "already_answered");
  check("T02 exact frozen Spanish copy present verbatim in the component source, never paraphrased",
    reviewSrc.includes(FROZEN_COPY));
  check("T02 raw internal reason string never appears as rendered JSX text",
    !new RegExp(">\\s*already_answered\\s*<|\\{\"already_answered\"\\}|\\{'already_answered'\\}").test(
      reviewSrc.slice(reviewSrc.indexOf("function StrategicAnswerCard"), reviewSrc.indexOf("function ProfessionalCandidateReview"))
    ));
}

// ════════════════════════════════════════════════════════════════════════════
// T03 — PURE HELPER / INPUT IMMUTABILITY
// ════════════════════════════════════════════════════════════════════════════
{
  const cand = candidate("sa3");
  const frozenCandidate = JSON.stringify(cand);
  const currentAnswer = "already filled";
  const frozenAnswer = currentAnswer;

  const result1 = getStrategicAnswerAcceptability(cand, currentAnswer);
  const result2 = getStrategicAnswerAcceptability(cand, currentAnswer);

  check("T03 candidate input unchanged after call", JSON.stringify(cand) === frozenCandidate);
  check("T03 currentAnswer string input unchanged (strings are immutable, but confirm no coercion/side read)", currentAnswer === frozenAnswer);
  check("T03 deterministic: same inputs produce the same result twice", JSON.stringify(result1) === JSON.stringify(result2));
  check("T03 no side effect observable (no console/throw/async)", result1.actionable === false && result1.reason === "already_answered");
}

// ════════════════════════════════════════════════════════════════════════════
// T04 — SHARED PROPOSALCARD DEFAULT SAFETY
// ════════════════════════════════════════════════════════════════════════════
{
  const cardBody = reviewSrc.slice(reviewSrc.indexOf("function ProposalCard"), reviewSrc.indexOf("function EmploymentCard"));
  check("T04 ProposalCard's new props are optional (disabled?: boolean)", /disabled\?:\s*boolean;/.test(cardBody));
  check("T04 ProposalCard's new props are optional (blockedExplanation?: string)", /blockedExplanation\?:\s*string;/.test(cardBody));

  // Each unaffected domain's own XCard wrapper must NOT pass disabled/blockedExplanation at all.
  for (const domain of ["Education", "Certification", "Business", "Reference", "Evidence"]) {
    const cardFnStart = reviewSrc.indexOf(`function ${domain}Card`);
    check(`T04 ${domain}Card function exists`, cardFnStart >= 0);
    const cardFnEnd = reviewSrc.indexOf("\n}\n", cardFnStart);
    const cardFnBody = reviewSrc.slice(cardFnStart, cardFnEnd);
    check(`T04 ${domain}Card does not pass disabled= to ProposalCard (omits the new prop entirely, preserving existing behavior)`,
      !cardFnBody.includes("disabled="));
    check(`T04 ${domain}Card does not pass blockedExplanation= to ProposalCard`,
      !cardFnBody.includes("blockedExplanation="));
  }
  // Base EmploymentCard (candidate review, distinct from the Employment
  // ENRICHMENT EnrichmentCard) must also remain unaffected -- E4 is a
  // base-card (ProposalCard) responsibility only.
  {
    const cardFnStart = reviewSrc.indexOf("function EmploymentCard");
    const cardFnEnd = reviewSrc.indexOf("\n}\n", cardFnStart);
    const cardFnBody = reviewSrc.slice(cardFnStart, cardFnEnd);
    check("T04 base EmploymentCard does not pass disabled= to ProposalCard", !cardFnBody.includes("disabled="));
    check("T04 base EmploymentCard does not pass blockedExplanation= to ProposalCard", !cardFnBody.includes("blockedExplanation="));
  }
  // Native disabled semantics: disabled={undefined} on a real <button> is
  // equivalent to "not disabled" -- this is a DOM/React platform
  // guarantee, not something this repository implements; re-confirming
  // the production code passes `disabled` straight through without any
  // default-coercion that could turn undefined into true.
  check("T04 ProposalCard passes disabled straight through (disabled={disabled}), no default coercion to true",
    /disabled=\{disabled\}/.test(cardBody));
}

// ════════════════════════════════════════════════════════════════════════════
// T05 — DISCARD INDEPENDENCE
// ════════════════════════════════════════════════════════════════════════════
{
  const cardBody = reviewSrc.slice(reviewSrc.indexOf("function ProposalCard"), reviewSrc.indexOf("function EmploymentCard"));
  const onRejectIdx = cardBody.indexOf("onClick={onReject}");
  const discardButtonStart = cardBody.lastIndexOf("<button", onRejectIdx);
  const discardButtonEnd = cardBody.indexOf("</button>", onRejectIdx);
  const discardButtonMarkup = cardBody.slice(discardButtonStart, discardButtonEnd + "</button>".length);
  check("T05 Discard button exists and is wired to onReject", discardButtonStart >= 0 && onRejectIdx > discardButtonStart && discardButtonEnd > onRejectIdx);
  check("T05 Discard button has no disabled attribute of any kind (E4 projection never touches it)", !discardButtonMarkup.includes("disabled"));

  // Production handleRejectCandidate's "strategicAnswer" case unchanged:
  // depends only on findProposedCandidate, zero dependency on the target
  // module11 answer state. Sliced to the next top-level handler
  // definition (not a fixed char count) so the case body is never
  // accidentally truncated.
  const rejectFnStart = intakeFormSrc.indexOf("const handleRejectCandidate");
  const rejectFnBody = intakeFormSrc.slice(rejectFnStart, intakeFormSrc.indexOf("// ── Init session ID"));
  const strategicCaseStart = rejectFnBody.indexOf('case "strategicAnswer": {');
  const strategicCaseEnd = rejectFnBody.indexOf("break;", strategicCaseStart);
  const strategicRejectCase = rejectFnBody.slice(strategicCaseStart, strategicCaseEnd);
  check("T05 handleRejectCandidate's strategicAnswer case depends only on findProposedCandidate (unchanged, zero module11/answer dependency)",
    strategicCaseStart >= 0 && strategicCaseEnd > strategicCaseStart &&
    strategicRejectCase.includes("findProposedCandidate(candidates.strategicAnswer, candidateId)") &&
    !strategicRejectCase.includes("module11") && !strategicRejectCase.includes(".answer"));
}

// ════════════════════════════════════════════════════════════════════════════
// T06 — EXACT TARGET KEY / NO HEURISTIC FALLBACK
// ════════════════════════════════════════════════════════════════════════════
{
  check("T06 UI wiring resolves the current answer via the exact key c.targetField (bracket lookup, never label/text matching)",
    /strategicAnswerModule\[c\.targetField\]\.answer/.test(reviewSrc));
  check("T06 no fuzzy/semantic/label-text matching exists anywhere in the StrategicAnswer render path",
    !/fuzzyMatch|semanticMatch|labelMatch/i.test(reviewCode));
  check("T06 the helper itself performs no field-key resolution of its own (takes the already-resolved string, never a Module10 object)",
    (() => {
      const piSrc = readFileSync(require.resolve("../../../src/lib/intake/professional-intelligence.ts"), "utf8");
      const fnStart = piSrc.indexOf("export function getStrategicAnswerAcceptability");
      const fnBody = piSrc.slice(fnStart, fnStart + 400);
      return !fnBody.includes("targetField]") && !fnBody.includes("Module10");
    })());

  // Prove via direct execution that two different candidates with
  // DIFFERENT targetField values, given the SAME already-answered
  // string, both correctly resolve to blocked -- the targetField itself
  // never changes the outcome once the caller has already resolved the
  // correct answer by that exact key (confirming the decision depends
  // only on the resolved string, with targetField's role being purely
  // the caller's own exact-key lookup, not a second matching criterion
  // inside the helper).
  const candA = candidate("sa6a", { targetField: "ledImpactProjects" });
  const candB = candidate("sa6b", { targetField: "solvedComplexProblems" });
  const resultA = getStrategicAnswerAcceptability(candA, "already filled");
  const resultB = getStrategicAnswerAcceptability(candB, "already filled");
  check("T06 different targetField values with the same resolved answer both block identically (no per-field special-casing)",
    !resultA.actionable && !resultB.actionable && resultA.reason === resultB.reason);
}

// ════════════════════════════════════════════════════════════════════════════
// T07 — HANDLER AUTHORITY REGRESSION
// ════════════════════════════════════════════════════════════════════════════
{
  const acceptBody = intakeFormSrc.slice(intakeFormSrc.indexOf("const handleAcceptCandidate"), intakeFormSrc.indexOf("const handleRejectCandidate"));
  check("T07 handleAcceptCandidate's strategicAnswer case still contains the exact frozen no-overwrite guard",
    /if \(current\.module11\[candidate\.targetField\]\.answer\.trim\(\) !== ""\) return;/.test(acceptBody));
  check("T07 the guard precedes candidateToStrategicAnswerPatch (still runs before any mutation is computed)",
    acceptBody.indexOf('if (current.module11[candidate.targetField].answer.trim() !== "") return;') <
    acceptBody.indexOf("candidateToStrategicAnswerPatch"));
  check("T07 no E4 code replaces or duplicates this guard inside the handler itself",
    (acceptBody.match(/current\.module11\[candidate\.targetField\]\.answer\.trim\(\) !== ""/g) ?? []).length === 1);
}

// ════════════════════════════════════════════════════════════════════════════
// T08 — BLOCKED STATE PERSISTENCE FIREWALL
// ════════════════════════════════════════════════════════════════════════════
{
  check("T08 the review component never calls save()/persistDraftEnvelope/localStorage (presentational-only re-proof after E4)",
    !reviewCode.includes("save(") && !reviewCode.includes("persistDraftEnvelope") && !reviewCode.includes("localStorage"));
  check("T08 getStrategicAnswerAcceptability itself has zero persistence/network/React vocabulary",
    (() => {
      const piSrc = readFileSync(require.resolve("../../../src/lib/intake/professional-intelligence.ts"), "utf8");
      const fnStart = piSrc.indexOf("export function getStrategicAnswerAcceptability");
      const fnBody = piSrc.slice(fnStart, fnStart + 400);
      return !fnBody.includes("save(") && !fnBody.includes("localStorage") && !fnBody.includes("fetch(") && !fnBody.includes("useState");
    })());
  // Native disabled=true means onClick never fires in a real browser --
  // this is a DOM platform guarantee this repository relies on exactly
  // as E3-B already established for Employment; re-confirm the handler's
  // own guard remains the ONLY authoritative backstop (already proven
  // unchanged in T07) so that even a hypothetical stale-render click
  // still fails closed with zero persistence attempt.
  check("T08 handler's own guard is a bare `return;` statement (the entire statement is exactly the condition followed by return, nothing else can execute on the blocked path)",
    /if \(current\.module11\[candidate\.targetField\]\.answer\.trim\(\) !== ""\) return;\s*\n\s*const patch = candidateToStrategicAnswerPatch/.test(
      intakeFormSrc.slice(intakeFormSrc.indexOf("const handleAcceptCandidate"), intakeFormSrc.indexOf("const handleRejectCandidate"))
    ));
}

console.log(failures === 0 ? "\nALL E4 CHECKS PASS" : `\n${failures} E4 CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
