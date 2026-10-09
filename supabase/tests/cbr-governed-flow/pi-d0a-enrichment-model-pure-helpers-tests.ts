// Implementation PI-D0A — Professional Enrichment Model + Pure Helpers.
// Non-database, non-network, non-LLM unit tests against the REAL
// production exports of src/lib/intake/professional-intelligence.ts
// (imported by path, not reimplemented) — mirrors pi-a/pi-c1's own
// established convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-d0a-enrichment-model-pure-helpers-tests.ts
//
// Scope: the enrichment model/pure-helper foundation only. No Active
// Professional Context, no IntakeForm/Module0/Coach wiring, no runtime
// consumption — none of that exists yet, by design (PI-D0B/PI-D1/PI-D2/
// PI-D3 own that).

import { readFileSync } from "fs";
import {
  type EmploymentEnrichment,
  type ProfessionalIntelligenceEnrichments,
  type EmploymentCandidate,
  type CandidateProvenance,
  type ProfessionalIntelligenceCandidates,
  emptyProfessionalIntelligenceEnrichments,
  emptyProfessionalIntelligenceCandidates,
  isCandidateEligibleForEnrichmentAnchor,
  appendPreserveExisting,
  composeEffectiveCandidate,
  removeOrphanedEnrichments,
  isValidProfessionalIntelligenceEnrichmentsOverlay,
  replaceCvExtractionCandidates,
} from "../../../src/lib/intake/professional-intelligence";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const PROD_FILE = "../../../src/lib/intake/professional-intelligence.ts";
const src = readFileSync(require.resolve(PROD_FILE), "utf8");

const prov = (source: "cv_extraction" | "coach_discovery" = "cv_extraction"): CandidateProvenance =>
  ({ source, rawText: "x", confidence: "high" });

function emp(id: string, overrides: Partial<EmploymentCandidate> = {}): EmploymentCandidate {
  return {
    id, domain: "employment", status: "proposed", provenance: [prov()],
    company: "Expedia", title: "Software Engineer", startDate: "2022-01", endDate: "2024-01",
    mainFunctions: "", importantProjects: "", mainAchievements: "",
    ...overrides,
  };
}

function enrichment(id: string, overrides: Partial<EmploymentEnrichment> = {}): EmploymentEnrichment {
  return {
    id,
    target: { domain: "employment", candidateId: "emp1" },
    status: "proposed",
    provenance: [prov("coach_discovery")],
    patch: {},
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// §21 — type tests
// ════════════════════════════════════════════════════════════════════════════
{
  const statusMatch = src.match(/export type EnrichmentStatus = ([^;]+);/)?.[1].replace(/\s+/g, " ").trim();
  check("T01 EnrichmentStatus contains exactly proposed|accepted|rejected", statusMatch === '"proposed" | "accepted" | "rejected"');
  check("T02 EnrichmentStatus is NOT CandidateStatus (no accepted_in_module literal)", !/EnrichmentStatus[^;]*accepted_in_module/.test(src));

  const patchMatch = src.match(/export interface EmploymentEnrichmentPatch \{([\s\S]*?)\}/)?.[1] ?? "";
  check("T03 EmploymentEnrichmentPatch has exactly mainFunctions/importantProjects/mainAchievements",
    /mainFunctions\?: string;/.test(patchMatch) && /importantProjects\?: string;/.test(patchMatch) && /mainAchievements\?: string;/.test(patchMatch) &&
    !/company/.test(patchMatch) && !/title/.test(patchMatch) && !/startDate/.test(patchMatch) && !/endDate/.test(patchMatch));

  const enrichmentMatch = src.match(/export interface EmploymentEnrichment \{([\s\S]*?)\n\}/)?.[1] ?? "";
  check("T04 EmploymentEnrichment has no acceptedAt/createdAt/updatedAt/moduleEntryId/acceptedModuleEntryId",
    !/acceptedAt|createdAt|updatedAt|moduleEntryId|acceptedModuleEntryId/.test(enrichmentMatch));
  check("T05 EmploymentEnrichment has exactly id/target/status/provenance/patch",
    /id: string;/.test(enrichmentMatch) && /target: EnrichmentTarget;/.test(enrichmentMatch) &&
    /status: EnrichmentStatus;/.test(enrichmentMatch) && /provenance: CandidateProvenance\[\];/.test(enrichmentMatch) &&
    /patch: EmploymentEnrichmentPatch;/.test(enrichmentMatch));

  check("T06 ProfessionalIntelligenceEnrichments contains only an employment array",
    /export interface ProfessionalIntelligenceEnrichments \{\s*employment: EmploymentEnrichment\[\];\s*\}/.test(src));
  check("T07 ProfessionalIntelligenceCandidates shape unchanged (still exactly 7 keys)",
    Object.keys(emptyProfessionalIntelligenceCandidates()).sort().join(",") ===
    ["employment", "education", "certification", "business", "reference", "evidence", "strategicAnswer"].sort().join(","));
  check("T08 EnrichmentTarget is Employment-only (domain literal \"employment\")",
    /export interface EnrichmentTarget \{\s*domain: "employment";\s*candidateId: string;\s*\}/.test(src));

  const empty = emptyProfessionalIntelligenceEnrichments();
  check("T09 emptyProfessionalIntelligenceEnrichments() returns { employment: [] }", Object.keys(empty).length === 1 && Array.isArray(empty.employment) && empty.employment.length === 0);
  check("T10 two empty() calls return distinct array references", emptyProfessionalIntelligenceEnrichments().employment !== emptyProfessionalIntelligenceEnrichments().employment);
}

// ════════════════════════════════════════════════════════════════════════════
// §22 — eligibility tests
// ════════════════════════════════════════════════════════════════════════════
{
  const cvOnly = emp("e1", { provenance: [prov("cv_extraction")] });
  const cvAndCoach = emp("e2", { provenance: [prov("cv_extraction"), prov("coach_discovery")] });
  const coachOnly = emp("e3", { provenance: [prov("coach_discovery")] });
  const cvRejected = emp("e4", { provenance: [prov("cv_extraction")], status: "rejected" });
  const cvAccepted = emp("e5", { provenance: [prov("cv_extraction")], status: "accepted_in_module" });

  check("T11 CV-only proposed Employment -> eligible", isCandidateEligibleForEnrichmentAnchor(cvOnly) === true);
  check("T12 CV + Coach proposed Employment -> eligible", isCandidateEligibleForEnrichmentAnchor(cvAndCoach) === true);
  check("T13 Coach-only proposed Employment -> ineligible", isCandidateEligibleForEnrichmentAnchor(coachOnly) === false);
  check("T14 CV-only rejected Employment -> ineligible", isCandidateEligibleForEnrichmentAnchor(cvRejected) === false);
  check("T15 CV-only accepted_in_module Employment -> ineligible", isCandidateEligibleForEnrichmentAnchor(cvAccepted) === false);

  const fnBody = src.slice(src.indexOf("export function isCandidateEligibleForEnrichmentAnchor"), src.indexOf("\n}", src.indexOf("export function isCandidateEligibleForEnrichmentAnchor")));
  check("T16 implementation uses provenance.some(...), never .every(...)", fnBody.includes(".some(") && !fnBody.includes(".every("));
  check("T17 implementation uses no identity comparator (*SameIdentity/*MaterialEquals absent)", !/SameIdentity|MaterialEquals/.test(fnBody));
}

// ════════════════════════════════════════════════════════════════════════════
// §23 — append tests
// ════════════════════════════════════════════════════════════════════════════
{
  check("T18 empty existing, incoming A -> A", appendPreserveExisting("", "A") === "A");
  check("T19 existing A, empty incoming -> A", appendPreserveExisting("A", "") === "A");
  check("T20 whitespace existing, incoming A -> A", appendPreserveExisting("   ", "A") === "A");
  check("T21 existing A, whitespace incoming -> A", appendPreserveExisting("A", "   ") === "A");
  check("T22 existing A, incoming B -> A\\n\\nB", appendPreserveExisting("A", "B") === "A\n\nB");
  check("T23 existing padded with whitespace is preserved verbatim, then separator + B",
    appendPreserveExisting("  A  ", "B") === "  A  \n\nB");
  check("T24 exact normalized duplicate (case/whitespace) -> existing unchanged",
    appendPreserveExisting("Led Migration", " led   migration ") === "Led Migration");
  check("T25 both empty -> empty string", appendPreserveExisting("", "") === "");
  check("T26 no fuzzy duplicate behavior (punctuation differences are NOT treated as duplicates)",
    appendPreserveExisting("Led the migration.", "Led the migration") === "Led the migration.\n\nLed the migration");
}

// ════════════════════════════════════════════════════════════════════════════
// §24 — composition tests
// ════════════════════════════════════════════════════════════════════════════
{
  const base = emp("emp1");
  const frozenBase = JSON.stringify(base);

  check("T27 zero enrichments -> same effective material values", (() => {
    const eff = composeEffectiveCandidate(base, []);
    return eff.mainFunctions === "" && eff.importantProjects === "" && eff.mainAchievements === "";
  })());

  const proposedE = enrichment("p1", { status: "proposed", patch: { mainFunctions: "ignored" } });
  check("T28 proposed enrichment -> ignored", composeEffectiveCandidate(base, [proposedE]).mainFunctions === "");

  const rejectedE = enrichment("r1", { status: "rejected", patch: { mainFunctions: "ignored" } });
  check("T29 rejected enrichment -> ignored", composeEffectiveCandidate(base, [rejectedE]).mainFunctions === "");

  const acceptedE = enrichment("a1", { status: "accepted", patch: { mainFunctions: "Led migration" } });
  check("T30 accepted enrichment -> applied", composeEffectiveCandidate(base, [acceptedE]).mainFunctions === "Led migration");

  const wrongTarget = enrichment("w1", { status: "accepted", target: { domain: "employment", candidateId: "someone-else" }, patch: { mainFunctions: "nope" } });
  check("T31 wrong candidateId -> ignored", composeEffectiveCandidate(base, [wrongTarget]).mainFunctions === "");

  const multiField = enrichment("m1", { status: "accepted", patch: { mainFunctions: "F", importantProjects: "P", mainAchievements: "A" } });
  const multi = composeEffectiveCandidate(base, [multiField]);
  check("T32 multi-field accepted enrichment -> all patch fields applied", multi.mainFunctions === "F" && multi.importantProjects === "P" && multi.mainAchievements === "A");

  const e1 = enrichment("seq1", { status: "accepted", patch: { mainFunctions: "First" } });
  const e2 = enrichment("seq2", { status: "accepted", patch: { mainFunctions: "Second" } });
  check("T33 multiple accepted enrichments applied in array/acquisition order", composeEffectiveCandidate(base, [e1, e2]).mainFunctions === "First\n\nSecond");
  check("T34 reversed array order folds in that (acquisition) order, not any other order", composeEffectiveCandidate(base, [e2, e1]).mainFunctions === "Second\n\nFirst");
  check("T35 no acceptedAt/timestamp read anywhere in composeEffectiveCandidate", !src.slice(src.indexOf("export function composeEffectiveCandidate"), src.indexOf("\n}\n", src.indexOf("export function composeEffectiveCandidate"))).includes("acceptedAt"));

  const mixed = [
    enrichment("mx1", { status: "proposed", patch: { mainFunctions: "X" } }),
    enrichment("mx2", { status: "accepted", patch: { mainFunctions: "Y" } }),
    enrichment("mx3", { status: "rejected", patch: { mainFunctions: "Z" } }),
  ];
  check("T36 mixed statuses -> only accepted applied", composeEffectiveCandidate(base, mixed).mainFunctions === "Y");

  const dup1 = enrichment("d1", { status: "accepted", patch: { mainFunctions: "Same thing" } });
  const dup2 = enrichment("d2", { status: "accepted", patch: { mainFunctions: "same   thing" } });
  check("T37 duplicate accepted material (normalized-equal) -> no duplicate paragraph", composeEffectiveCandidate(base, [dup1, dup2]).mainFunctions === "Same thing");

  composeEffectiveCandidate(base, [e1, e2, acceptedE]);
  check("T38 base object not mutated", JSON.stringify(base) === frozenBase);
  const enrichFrozen = JSON.stringify(acceptedE);
  composeEffectiveCandidate(base, [acceptedE]);
  check("T39 enrichment objects not mutated", JSON.stringify(acceptedE) === enrichFrozen);

  const eff2 = composeEffectiveCandidate(base, [acceptedE]);
  check("T40 identity fields unchanged (company/title/startDate/endDate/id/domain)",
    eff2.company === base.company && eff2.title === base.title && eff2.startDate === base.startDate &&
    eff2.endDate === base.endDate && eff2.id === base.id && eff2.domain === base.domain);
  check("T41 status unchanged", eff2.status === base.status);
  check("T42 provenance not modified (same reference, untouched)", eff2.provenance === base.provenance);
  check("T43 effective candidate is a fresh object (not the same reference as base)", eff2 !== base);
}

// ════════════════════════════════════════════════════════════════════════════
// §25 — orphan removal tests
// ════════════════════════════════════════════════════════════════════════════
{
  const candidates: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: [emp("exists1")] };
  const keep = enrichment("k1", { target: { domain: "employment", candidateId: "exists1" } });
  const drop = enrichment("d1", { target: { domain: "employment", candidateId: "gone" } });
  const similarButDifferentId = enrichment("s1", { target: { domain: "employment", candidateId: "expedia-lookalike" } });
  const enrichments: ProfessionalIntelligenceEnrichments = { employment: [keep, drop, similarButDifferentId] };
  const frozenEnrichments = JSON.stringify(enrichments);
  const frozenCandidates = JSON.stringify(candidates);

  const result = removeOrphanedEnrichments(enrichments, candidates);
  check("T44 target exists -> retained", result.employment.some(e => e.id === "k1"));
  check("T45 target absent -> dropped", !result.employment.some(e => e.id === "d1"));
  check("T46 similar-looking but different candidateId -> dropped (no semantic/fuzzy match)", !result.employment.some(e => e.id === "s1"));

  const rejectedCandidates: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: [emp("rej1", { status: "rejected" })] };
  const rejTarget: ProfessionalIntelligenceEnrichments = { employment: [enrichment("rj1", { target: { domain: "employment", candidateId: "rej1" } })] };
  check("T47 candidate exists but rejected -> retained (orphan helper tests existence only)", removeOrphanedEnrichments(rejTarget, rejectedCandidates).employment.length === 1);

  const acceptedCandidates: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: [emp("acc1", { status: "accepted_in_module" })] };
  const accTarget: ProfessionalIntelligenceEnrichments = { employment: [enrichment("ac1", { target: { domain: "employment", candidateId: "acc1" } })] };
  check("T48 candidate exists but accepted_in_module -> retained (existence only)", removeOrphanedEnrichments(accTarget, acceptedCandidates).employment.length === 1);

  check("T49 input enrichments not mutated", JSON.stringify(enrichments) === frozenEnrichments);
  check("T50 input candidates not mutated", JSON.stringify(candidates) === frozenCandidates);
}

// ════════════════════════════════════════════════════════════════════════════
// §26 — CV re-extraction protection tests
// ════════════════════════════════════════════════════════════════════════════
{
  const cvOnly = emp("cv1", { provenance: [prov("cv_extraction")] });
  const coachOnly = emp("coach1", { provenance: [prov("coach_discovery")] });
  const multiSource = emp("multi1", { provenance: [prov("cv_extraction"), prov("coach_discovery")] });
  const current: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: [cvOnly, coachOnly, multiSource] };
  const incomingNew = emp("incoming1");
  const incoming: ProfessionalIntelligenceCandidates = { ...emptyProfessionalIntelligenceCandidates(), employment: [incomingNew] };

  check("T51 CV-only candidate not protected -> removed (existing behavior unchanged)",
    !replaceCvExtractionCandidates(current, incoming).employment.some(c => c.id === "cv1"));
  check("T52 CV-only candidate protected -> preserved",
    replaceCvExtractionCandidates(current, incoming, new Set(["cv1"])).employment.some(c => c.id === "cv1"));
  check("T53 Coach-only candidate preserved exactly as before (unaffected by protection)",
    replaceCvExtractionCandidates(current, incoming).employment.some(c => c.id === "coach1") &&
    replaceCvExtractionCandidates(current, incoming, new Set(["cv1"])).employment.some(c => c.id === "coach1"));
  check("T54 multi-source candidate preserved exactly as before (unaffected by protection)",
    replaceCvExtractionCandidates(current, incoming).employment.some(c => c.id === "multi1") &&
    replaceCvExtractionCandidates(current, incoming, new Set(["cv1"])).employment.some(c => c.id === "multi1"));
  check("T55 incoming CV candidates appended exactly as before", replaceCvExtractionCandidates(current, incoming).employment.some(c => c.id === "incoming1"));
  check("T56 protected set omitted -> identical to historical (unprotected) behavior",
    JSON.stringify(replaceCvExtractionCandidates(current, incoming)) === JSON.stringify(replaceCvExtractionCandidates(current, incoming, undefined)));
  check("T57 protected set empty -> identical to historical (unprotected) behavior",
    JSON.stringify(replaceCvExtractionCandidates(current, incoming)) === JSON.stringify(replaceCvExtractionCandidates(current, incoming, new Set())));
  check("T58 no enrichment-specific symbol referenced inside replaceDomain/replaceCvExtractionCandidates",
    !src.slice(src.indexOf("function replaceDomain"), src.indexOf("export function replaceCvExtractionCandidates") + 600).includes("EmploymentEnrichment"));
}

// ════════════════════════════════════════════════════════════════════════════
// §27 — hydration guard tests
// ════════════════════════════════════════════════════════════════════════════
{
  check("T59 null -> false", isValidProfessionalIntelligenceEnrichmentsOverlay(null) === false);
  check("T60 undefined -> false", isValidProfessionalIntelligenceEnrichmentsOverlay(undefined) === false);
  check("T61 {} -> false", isValidProfessionalIntelligenceEnrichmentsOverlay({}) === false);
  check("T62 {employment: []} -> true", isValidProfessionalIntelligenceEnrichmentsOverlay({ employment: [] }) === true);
  check("T63 {employment: [arbitrary object]} -> true (intentionally coarse)", isValidProfessionalIntelligenceEnrichmentsOverlay({ employment: [{ anything: "goes" }] }) === true);
  check('T64 {employment: "not-array"} -> false', isValidProfessionalIntelligenceEnrichmentsOverlay({ employment: "not-array" }) === false);
  // emptyProfessionalIntelligenceCandidates() also has an `employment`
  // array key (a different element type, EmploymentCandidate[]) -- the
  // guard is intentionally coarse (T63) and correctly accepts it too;
  // this is not a false positive, it is the documented coarseness.
  check("T65 a shape missing employment entirely (wrong overlay kind) -> false",
    isValidProfessionalIntelligenceEnrichmentsOverlay({ education: [], certification: [] }) === false);
}

// ════════════════════════════════════════════════════════════════════════════
// Static scope / firewall proofs (structural)
// ════════════════════════════════════════════════════════════════════════════
{
  check("T66 ProfessionalIntelligenceEnrichments never merged into ProfessionalIntelligenceCandidates",
    !/ProfessionalIntelligenceCandidates[^;{]*employment: EmploymentEnrichment/.test(src));
  check("T67 no Project entity", !/ProjectCandidate|ProjectEnrichment/.test(src));
  check("T68 no Compensation entity", !/CompensationCandidate|CompensationEnrichment/.test(src));
  check("T69 no ActiveProfessionalContext type defined (not part of PI-D0A)", !src.includes("ActiveProfessionalContext"));
  check("T70 no acceptedAt field anywhere in the enrichment model", !/EmploymentEnrichment[\s\S]{0,400}acceptedAt/.test(src));
}

console.log(failures === 0 ? "\nALL PI-D0A CHECKS PASS" : `\n${failures} PI-D0A CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
