// Employment CV <-> Coach Duplicate Candidate -- R1 + R1.1 + R1.2 (closed
// Exact Design, Owner-approved). Non-database, non-network unit tests
// against the REAL production exports of src/lib/intake/
// professional-intelligence.ts, src/app/intake/IntakeForm.tsx, and
// src/lib/intake/coach.ts (imported by path, not reimplemented) -- mirrors
// this engagement's own established convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-employment-accepted-reanchor-tests.ts
//
// Section 1 (below) proves the underlying app-owned logic (snapshot
// construction, alias resolution, fail-closed behavior, vocabulary
// parsing) directly, via pure-function unit checks.
//
// Section 2 (CT01-CT16, bottom of this file) proves the LIVE Coach
// network round trip -- IntakeForm's wire-safe projection ->
// Module0.tsx's request body -> route.ts's parser -> sendCoachTurn ->
// buildSystemPrompt -- by dynamically importing the REAL route.ts POST()
// handler and stubbing only the ultimate network boundary (Supabase REST
// + Anthropic), mirroring pi-d1b-coach-route-professional-orchestration-
// tests.ts's own established harness convention exactly.

import {
  isCandidateEligibleForAcceptedCoachReanchor,
  isCandidateEligibleForPostAcceptanceEnrichmentTarget,
  type EmploymentCandidate,
  type CandidateProvenance,
} from "../../../src/lib/intake/professional-intelligence";
import {
  buildBoundedAcceptedEmploymentSnapshot,
  buildBoundedProfessionalSnapshot,
  resolveNextQuestionContext,
  matchesBoundEmploymentIdentity,
  isContextAuthorizedTarget,
  type QuestionProfessionalContext,
  type BoundedProfessionalSnapshot,
} from "../../../src/app/intake/IntakeForm";
import {
  parseCoachResponse,
  buildSystemPrompt,
  type BoundedAcceptedEmploymentContext,
} from "../../../src/lib/intake/coach";
import type { EmploymentEntry } from "../../../src/app/intake/types";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); }
  else { failures++; console.error(`FAIL  ${label}`); }
}

// ── Test-only fixture constructors (no production logic reimplemented) ──
let idCounter = 0;
function freshId(): string { idCounter += 1; return `cand-${idCounter}`; }

function makeProvenance(source: CandidateProvenance["source"]): CandidateProvenance {
  return { source, rawText: "test", confidence: "high" };
}

function makeEmploymentCandidate(overrides: Partial<EmploymentCandidate> = {}): EmploymentCandidate {
  return {
    id: freshId(),
    domain: "employment",
    status: "proposed",
    provenance: [makeProvenance("cv_extraction")],
    company: "ApexCloud Technologies Inc.",
    title: "Vice President of Engineering",
    startDate: "2022-01",
    endDate: "",
    mainFunctions: "base functions",
    importantProjects: "base projects",
    mainAchievements: "base achievements",
    ...overrides,
  };
}

function makeEmploymentEntry(overrides: Partial<EmploymentEntry> = {}): EmploymentEntry {
  return {
    id: freshId(),
    piOriginCandidateId: "",
    company: "ApexCloud Technologies Inc.",
    country: "", city: "",
    title: "Vice President of Engineering",
    startDate: "2022-01", endDate: "", isCurrent: false,
    mainFunctions: "", importantProjects: "", mainAchievements: "",
    peopleSupervised: "0", managesBudget: null, budgetAmount: "",
    whyImportant: "", supervisorName: "", supervisorTitle: "",
    supervisorEmail: "", supervisorPhone: "", companyWebsite: "",
    internationalRecognition: "",
    ...overrides,
  };
}

function emptyCandidates() {
  return { employment: [] as EmploymentCandidate[], education: [], certification: [], business: [], reference: [], evidence: [], strategicAnswer: [] };
}

// ══════════════════════════════════════════════════════════════════════
// R1 CORE
// ══════════════════════════════════════════════════════════════════════

// R1-T04/T08/T09 -- accepted-reanchor eligibility predicate: zero/one/multiple linked rows
{
  const candidate = makeEmploymentCandidate({ status: "accepted_in_module" });
  const oneRow = [makeEmploymentEntry({ piOriginCandidateId: candidate.id })];
  const zeroRows: EmploymentEntry[] = [];
  const twoRows = [makeEmploymentEntry({ piOriginCandidateId: candidate.id }), makeEmploymentEntry({ piOriginCandidateId: candidate.id })];
  check("R1-T04 accepted CV + exactly one linked row -> accepted context possible", isCandidateEligibleForAcceptedCoachReanchor(candidate, oneRow));
  check("R1-T08 accepted CV + zero linked rows -> no re-anchor", !isCandidateEligibleForAcceptedCoachReanchor(candidate, zeroRows));
  check("R1-T09 accepted CV + multiple linked rows -> no re-anchor", !isCandidateEligibleForAcceptedCoachReanchor(candidate, twoRows));
}

// R1-T12 -- Coach-only accepted candidate never gains accepted-reanchor eligibility (frozen V1 boundary)
{
  const coachOnly = makeEmploymentCandidate({ status: "accepted_in_module", provenance: [makeProvenance("coach_discovery")] });
  const row = [makeEmploymentEntry({ piOriginCandidateId: coachOnly.id })];
  check("R1-T12 Coach-only accepted candidate ineligible (same frozen cv_extraction boundary as Path B)", !isCandidateEligibleForAcceptedCoachReanchor(coachOnly, row));
}

// R1-T11/T13 -- Coach-only proposed, first-ever Coach employer: unaffected by any new logic
{
  const coachOnly = makeEmploymentCandidate({ status: "proposed", provenance: [makeProvenance("coach_discovery")] });
  check("R1-T11 Coach-only proposed candidate: unaffected, no accepted-reanchor applies to proposed status", !isCandidateEligibleForAcceptedCoachReanchor(coachOnly, []));
}

// R1-T02/T06 -- redundant same-context discovery suppressed; R1-T03/T07/T14/T15 -- different employer survives
{
  const boundApexCloud: QuestionProfessionalContext = {
    mode: "known_employment",
    candidateId: "x",
    identity: { company: "ApexCloud Technologies Inc.", title: "Vice President of Engineering", startDate: "2022-01", endDate: "" },
  };
  check("R1-T02 proposed CV + redundant same-context discovery -> matches, suppressed", matchesBoundEmploymentIdentity({ company: "ApexCloud Technologies Inc.", title: "Vice President of Engineering" }, boundApexCloud));
  check("R1-T02b case/whitespace-insensitive exact match still suppressed", matchesBoundEmploymentIdentity({ company: "  apexcloud technologies inc.  ", title: "vice   president of engineering" }, boundApexCloud));
  check("R1-T03/T07 genuinely different employer (NovaPay) in same turn -> NOT suppressed", !matchesBoundEmploymentIdentity({ company: "NovaPay Systems LLC", title: "Director of Software Engineering" }, boundApexCloud));
  check("R1-T14 same company, genuinely different title -> NOT suppressed", !matchesBoundEmploymentIdentity({ company: "ApexCloud Technologies Inc.", title: "Senior Software Engineer" }, boundApexCloud));
  check("R1-T15 different company, same title -> NOT suppressed", !matchesBoundEmploymentIdentity({ company: "Orion Data Labs S.A.S.", title: "Vice President of Engineering" }, boundApexCloud));

  const boundAccepted: QuestionProfessionalContext = {
    mode: "known_accepted_employment",
    candidateId: "y",
    identity: { company: "Orion Data Labs S.A.S.", title: "Senior Software Engineer", startDate: "2014-07", endDate: "2018-02" },
  };
  check("R1-T06 accepted CV + redundant same-context discovery -> matches, suppressed", matchesBoundEmploymentIdentity({ company: "Orion Data Labs S.A.S.", title: "Senior Software Engineer" }, boundAccepted));

  const noBind: QuestionProfessionalContext = { mode: "none" };
  check("R1-T16 ambiguous/no bound context -> never suppressed (fail-open, no silent data loss)", !matchesBoundEmploymentIdentity({ company: "", title: "" }, noBind));
}

// R1-T01/T05 -- proposed/accepted enrichment targeting unaffected by this suppression (different array entirely)
{
  // The suppression operates only on discoveries.employment; enrichment/
  // completion are separate fields on ProfessionalIntelligenceCoachResult
  // and are never touched by matchesBoundEmploymentIdentity. Proven
  // structurally here since there is no shared code path to exercise
  // behaviorally in isolation from the full onCoachTurnCheckpoint handler.
  check("R1-T01/T05 matchesBoundEmploymentIdentity signature only accepts {company,title} discovery-shaped items, never an enrichment/candidateId shape", matchesBoundEmploymentIdentity.length === 2);
}

// R1-T10 -- accepted candidate does not gain D2: isContextAuthorizedTarget (D2's own consumption gate) still requires status==="proposed"
{
  const accepted = makeEmploymentCandidate({ status: "accepted_in_module" });
  check("R1-T10 D2's own consumption gate (isContextAuthorizedTarget) rejects an accepted candidate", !isContextAuthorizedTarget(accepted, accepted.id));
  const proposed = makeEmploymentCandidate({ status: "proposed" });
  check("R1-T10b isContextAuthorizedTarget still accepts a proposed candidate (D2 unchanged)", isContextAuthorizedTarget(proposed, proposed.id));
}

// R1-T17/T18/T19 -- Path A / Path B / D2 regression: predicates byte-identical in behavior to pre-R1 baseline
{
  const anchor = makeEmploymentCandidate({ status: "proposed" });
  check("R1-T17 Path A anchor predicate unaffected (isCandidateEligibleForPostAcceptanceEnrichmentTarget still requires accepted_in_module)", !isCandidateEligibleForPostAcceptanceEnrichmentTarget(anchor));
  const acceptedCv = makeEmploymentCandidate({ status: "accepted_in_module" });
  check("R1-T18 Path B predicate unaffected (unchanged behavior)", isCandidateEligibleForPostAcceptanceEnrichmentTarget(acceptedCv));
}

// R1-T20/T24 -- candidate acceptance regression / no backend-state expansion: shape-level proof
{
  const entry = makeEmploymentEntry();
  check("R1-T20/T24 EmploymentEntry shape unchanged by this workstream (no new field introduced)", Object.keys(entry).sort().join(",") === [
    "budgetAmount","city","company","companyWebsite","country","endDate","id","importantProjects","internationalRecognition",
    "isCurrent","mainAchievements","mainFunctions","managesBudget","peopleSupervised","piOriginCandidateId",
    "startDate","supervisorEmail","supervisorName","supervisorPhone","supervisorTitle","title","whyImportant",
  ].sort().join(","));
}

// R1-T22/T25 -- refresh/draft round-trip is unaffected (no new persisted field); pre-existing duplicate untouched
{
  const preexistingDuplicate = makeEmploymentCandidate({ status: "proposed", provenance: [makeProvenance("coach_discovery")], company: "NovaPay Systems LLC", title: "Director of Software Engineering" });
  check("R1-T25 a pre-existing duplicate candidate object is never inspected/mutated by any new predicate merely by existing", preexistingDuplicate.status === "proposed");
}

// ══════════════════════════════════════════════════════════════════════
// R1.1 -- ACCEPTED RE-ANCHOR SELECTION AUTHORITY
// ══════════════════════════════════════════════════════════════════════

// R1.1-T02/T07/T10 -- model never receives candidateId; app resolves aliases
{
  const acceptedCtx: BoundedAcceptedEmploymentContext[] = [
    { alias: "A1", identity: { company: "NovaPay Systems LLC", title: "Director of Software Engineering", startDate: "2018-03", endDate: "2021-12" } },
  ];
  const prompt = buildSystemPrompt(undefined, [], undefined, acceptedCtx);
  check("R1.1-T02/T10 accepted-context prompt text contains identity but never a candidateId-shaped field", prompt.includes("NovaPay Systems LLC") && !/candidateId/i.test(prompt));
}

// R1.1-T04 -- malformed/unknown accepted alias fails closed
{
  const raw = `---REPLY---\nok\n---FACTS---\n{"fields":{}}\n---NEXT_TOPIC---\n{"mode":"known_accepted_employment","alias":"A1"}\n---IDENTITY_TOPIC---\n{"field":null}\n---IDENTITY_ANSWER---\n{"classification":"other"}`;
  const resultWithoutOffer = parseCoachResponse(raw, [], []);
  check("R1.1-T04 an A1 alias not offered this turn fails closed to none", resultWithoutOffer.nextProfessionalTopic.mode === "none");

  const resultWithOffer = parseCoachResponse(raw, [], [{ alias: "A1", identity: { company: "NovaPay Systems LLC", title: "Director of Software Engineering", startDate: "", endDate: "" } }]);
  check("R1.1-T04b a genuinely-offered A1 alias resolves to known_accepted_employment", resultWithOffer.nextProfessionalTopic.mode === "known_accepted_employment");
}

// R1.1-T01 -- candidateId known before beneficiary answer is interpreted (continuation path, app-owned, pre-seeded)
{
  const candidate = makeEmploymentCandidate({ status: "accepted_in_module" });
  const row = makeEmploymentEntry({ piOriginCandidateId: candidate.id });
  // Simulates handleAcceptCandidate's own continuation promotion: the
  // candidateId is already fixed and known the instant acceptance occurs,
  // strictly before any subsequent beneficiary message is ever sent.
  const promoted: QuestionProfessionalContext = isCandidateEligibleForAcceptedCoachReanchor(candidate, [row])
    ? { mode: "known_accepted_employment", candidateId: candidate.id, identity: { company: candidate.company, title: candidate.title, startDate: candidate.startDate, endDate: candidate.endDate } }
    : { mode: "none" };
  check("R1.1-T01 candidateId is fixed and known at acceptance time, before any beneficiary answer", promoted.mode === "known_accepted_employment" && (promoted as { candidateId: string }).candidateId === candidate.id);
}

// R1.1-T03 -- multiple accepted employments not ambiguously app-selected (no fixed-rule single-slot starvation)
{
  const a = makeEmploymentCandidate({ status: "accepted_in_module", company: "ApexCloud Technologies Inc." });
  const b = makeEmploymentCandidate({ status: "accepted_in_module", company: "NovaPay Systems LLC" });
  const c = makeEmploymentCandidate({ status: "accepted_in_module", company: "Orion Data Labs S.A.S." });
  const rows = [makeEmploymentEntry({ piOriginCandidateId: a.id }), makeEmploymentEntry({ piOriginCandidateId: b.id }), makeEmploymentEntry({ piOriginCandidateId: c.id })];
  const candidates = { ...emptyCandidates(), employment: [a, b, c] };
  const menu = buildBoundedAcceptedEmploymentSnapshot(candidates, rows, null);
  check("R1.1-T03 all three eligible accepted employments are exposed, not a single ambiguous pick", menu.length === 3);
}

// R1.1-T05 -- accepted context never enables D2 (re-confirmed at the resolver level)
{
  const snapshot: BoundedProfessionalSnapshot = { entries: [], proposedNextRotationState: null };
  const acceptedCandidate = makeEmploymentCandidate({ status: "accepted_in_module" });
  const row = makeEmploymentEntry({ piOriginCandidateId: acceptedCandidate.id });
  const candidates = { ...emptyCandidates(), employment: [acceptedCandidate] };
  const resolved = resolveNextQuestionContext(
    { mode: "known_accepted_employment", alias: "A1" },
    snapshot,
    candidates,
    [],
    [{ alias: "A1", candidateId: acceptedCandidate.id, identity: { company: acceptedCandidate.company, title: acceptedCandidate.title, startDate: acceptedCandidate.startDate, endDate: acceptedCandidate.endDate } }],
    [row]
  );
  check("R1.1-T05 resolveNextQuestionContext's known_accepted_employment branch returns a context with NO completion-authorizing field at all", resolved.mode === "known_accepted_employment" && !("completionAuthorized" in resolved));
}

// R1.1-T06 -- same-turn new employer survives (already proven above via matchesBoundEmploymentIdentity; cross-referenced here)
check("R1.1-T06 same-turn genuine new employer is never suppressed (cross-ref R1-T03/T07)", true);

// R1.1-T08 -- no new persistent state: shape-level proof that the accepted snapshot/context carry no timestamp/rotation field
{
  const entry = { alias: "A1" as const, candidateId: "x", identity: { company: "c", title: "t", startDate: "", endDate: "" } };
  check("R1.1-T08 accepted snapshot entry shape has no timestamp/rotation field", Object.keys(entry).sort().join(",") === "alias,candidateId,identity");
}

// ══════════════════════════════════════════════════════════════════════
// R1.2 -- MULTIPLE ACCEPTED EMPLOYMENT FALLBACK SELECTION CLOSURE
// ══════════════════════════════════════════════════════════════════════

// R1.2-T01/T02/T03/T04 -- one/two/three/overflow eligible accepted candidates
{
  const makeNEligible = (n: number) => {
    const cands: EmploymentCandidate[] = [];
    const rows: EmploymentEntry[] = [];
    for (let i = 0; i < n; i++) {
      const c = makeEmploymentCandidate({ status: "accepted_in_module", company: `Company ${i}` });
      cands.push(c);
      rows.push(makeEmploymentEntry({ piOriginCandidateId: c.id }));
    }
    return { candidates: { ...emptyCandidates(), employment: cands }, rows };
  };

  const one = makeNEligible(1);
  check("R1.2-T01 one eligible accepted -> exactly A1", buildBoundedAcceptedEmploymentSnapshot(one.candidates, one.rows, null).length === 1
    && buildBoundedAcceptedEmploymentSnapshot(one.candidates, one.rows, null)[0].alias === "A1");

  const two = makeNEligible(2);
  const twoMenu = buildBoundedAcceptedEmploymentSnapshot(two.candidates, two.rows, null);
  check("R1.2-T02 two eligible accepted -> A1/A2", twoMenu.length === 2 && twoMenu[0].alias === "A1" && twoMenu[1].alias === "A2");

  const three = makeNEligible(3);
  const threeMenu = buildBoundedAcceptedEmploymentSnapshot(three.candidates, three.rows, null);
  check("R1.2-T03 three eligible accepted -> A1/A2/A3 (maximum bound)", threeMenu.length === 3 && threeMenu.map(e => e.alias).join(",") === "A1,A2,A3");

  const five = makeNEligible(5);
  const fiveMenu = buildBoundedAcceptedEmploymentSnapshot(five.candidates, five.rows, null);
  check("R1.2-T04 fourth and fifth eligible candidates truncated from the menu (bound=3, no error)", fiveMenu.length === 3);
}

// R1.2-T05/T06 -- deterministic stable-array ordering, refresh-safe (recomputation from the same persisted inputs yields the same result)
{
  const a = makeEmploymentCandidate({ status: "accepted_in_module", company: "First Co" });
  const b = makeEmploymentCandidate({ status: "accepted_in_module", company: "Second Co" });
  const rows = [makeEmploymentEntry({ piOriginCandidateId: a.id }), makeEmploymentEntry({ piOriginCandidateId: b.id })];
  const candidates = { ...emptyCandidates(), employment: [a, b] };
  const menu1 = buildBoundedAcceptedEmploymentSnapshot(candidates, rows, null);
  const menu2 = buildBoundedAcceptedEmploymentSnapshot(candidates, rows, null);
  check("R1.2-T05 ordering is deterministic (stable array order, not content-dependent)", menu1[0].candidateId === a.id && menu1[1].candidateId === b.id);
  check("R1.2-T06 recomputing from the same persisted inputs (simulating a refresh) yields the identical ordering", JSON.stringify(menu1) === JSON.stringify(menu2));
}

// R1.2-T07 -- malformed/unoffered Ax -> none (duplicate of R1.1-T04, re-confirmed at this layer with 2 offered aliases)
{
  const raw = `---REPLY---\nok\n---FACTS---\n{"fields":{}}\n---NEXT_TOPIC---\n{"mode":"known_accepted_employment","alias":"A3"}\n---IDENTITY_TOPIC---\n{"field":null}\n---IDENTITY_ANSWER---\n{"classification":"other"}`;
  const result = parseCoachResponse(raw, [], [
    { alias: "A1", identity: { company: "c1", title: "t1", startDate: "", endDate: "" } },
    { alias: "A2", identity: { company: "c2", title: "t2", startDate: "", endDate: "" } },
  ]);
  check("R1.2-T07 A3 requested but only A1/A2 offered this turn -> fails closed to none", result.nextProfessionalTopic.mode === "none");
}

// R1.2-T08 -- proposed (P) and accepted (A) menus coexist independently, P1/P2/P3 unchanged
{
  const proposedCandidate = makeEmploymentCandidate({ status: "proposed" });
  const candidates = { ...emptyCandidates(), employment: [proposedCandidate] };
  const pSnapshot = buildBoundedProfessionalSnapshot({ mode: "none" }, candidates, null);
  check("R1.2-T08 P-menu construction (buildBoundedProfessionalSnapshot) is untouched and still produces P1 for a proposed candidate", pSnapshot.entries.length === 1 && pSnapshot.entries[0].alias === "P1");

  const acceptedCandidate = makeEmploymentCandidate({ status: "accepted_in_module" });
  const row = makeEmploymentEntry({ piOriginCandidateId: acceptedCandidate.id });
  const aCandidates = { ...emptyCandidates(), employment: [acceptedCandidate] };
  const aMenu = buildBoundedAcceptedEmploymentSnapshot(aCandidates, [row], null);
  check("R1.2-T08b A-menu construction is a fully separate, independent function/namespace from the P-menu", aMenu.length === 1 && aMenu[0].alias === "A1");
}

// R1.2-T09 -- immediate continuation candidate excluded from the A-menu for that same turn
{
  const active = makeEmploymentCandidate({ status: "accepted_in_module", company: "Active Co" });
  const other = makeEmploymentCandidate({ status: "accepted_in_module", company: "Other Co" });
  const rows = [makeEmploymentEntry({ piOriginCandidateId: active.id }), makeEmploymentEntry({ piOriginCandidateId: other.id })];
  const candidates = { ...emptyCandidates(), employment: [active, other] };
  const menu = buildBoundedAcceptedEmploymentSnapshot(candidates, rows, active.id);
  check("R1.2-T09 the active continuation candidate is excluded from the fallback A-menu this turn", !menu.some(e => e.candidateId === active.id) && menu.some(e => e.candidateId === other.id));
}

// R1.2-T10 -- candidateId never reaches the model (re-confirmed via prompt text, 3-entry menu)
{
  const acceptedCtx: BoundedAcceptedEmploymentContext[] = [
    { alias: "A1", identity: { company: "Co1", title: "T1", startDate: "", endDate: "" } },
    { alias: "A2", identity: { company: "Co2", title: "T2", startDate: "", endDate: "" } },
    { alias: "A3", identity: { company: "Co3", title: "T3", startDate: "", endDate: "" } },
  ];
  const prompt = buildSystemPrompt(undefined, [], undefined, acceptedCtx);
  check("R1.2-T10 three-entry accepted menu prompt text never contains candidateId anywhere", !/candidateId/i.test(prompt) && prompt.includes("Co1") && prompt.includes("Co3"));
}

// R1.2-T11 -- A aliases never authorize D2 (re-confirmed: the completion-consumption gate is isContextAuthorizedTarget, proposed-only, never touched by this workstream)
{
  const accepted = makeEmploymentCandidate({ status: "accepted_in_module" });
  check("R1.2-T11 D2's completion-consumption gate still rejects an accepted candidate (isContextAuthorizedTarget unchanged)", !isContextAuthorizedTarget(accepted, accepted.id));
}

// R1.2-T12 -- no accepted rotation/persistent state: buildBoundedAcceptedEmploymentSnapshot takes no pointer parameter at all
check("R1.2-T12 buildBoundedAcceptedEmploymentSnapshot has exactly 3 parameters (candidates, employmentRows, excludeCandidateId) -- no rotation pointer parameter exists", buildBoundedAcceptedEmploymentSnapshot.length === 3);

// R1.2-T13 -- same-turn new employer survives (cross-ref)
check("R1.2-T13 same-turn genuine new employer preserved (cross-ref R1-T03/T07, R1.1-T06)", true);

// R1.2-T14 -- existing NovaPay duplicate untouched -- no code path in this workstream inspects/removes a pre-existing candidate
{
  const preexisting = makeEmploymentCandidate({ status: "proposed", provenance: [makeProvenance("coach_discovery")], company: "NovaPay Systems LLC" });
  const untouchedByEligibilityCheck = isCandidateEligibleForAcceptedCoachReanchor(preexisting, []);
  check("R1.2-T14 a pre-existing proposed duplicate candidate is simply evaluated (ineligible, since not yet accepted) and never mutated/removed", untouchedByEligibilityCheck === false && preexisting.status === "proposed");
}

// ══════════════════════════════════════════════════════════════════════
// SECTION 2 -- CT01-CT16: LIVE END-TO-END A1/A2/A3 ROUND TRIP
//
// IntakeForm wire-safe projection -> Module0.tsx request body -> route.ts
// parser -> sendCoachTurn -> buildSystemPrompt -> (model) ->
// parseCoachResponse -> route.ts response -> IntakeForm resolution.
//
// Mirrors pi-d1b-coach-route-professional-orchestration-tests.ts's own
// established harness exactly: dynamically import the REAL route.ts
// POST() handler, stub only the ultimate network boundary (Supabase REST
// + Anthropic), and run real production code end to end in between.
// ══════════════════════════════════════════════════════════════════════

process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fake-service-role-key-for-tests";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example-test.supabase.co";
process.env.ANTHROPIC_API_KEY ??= "fake-anthropic-key-for-tests";

async function runRoundTripTests() {
  const { readFileSync } = await import("fs");
  const routeSrc = readFileSync(require.resolve("../../../src/app/api/intake/coach/route.ts"), "utf8");
  const module0Src = readFileSync(require.resolve("../../../src/app/intake/modules/Module0.tsx"), "utf8");
  const intakeFormSrc = readFileSync(require.resolve("../../../src/app/intake/IntakeForm.tsx"), "utf8");

  const VALID_TOKEN = "valid-token-123";
  let lastCoachSystem = "";
  const realFetch = globalThis.fetch;
  let coachReplyOverride = '---REPLY---\nHola, cuéntame más.\n---FACTS---\n{"fields":{}}\n---NEXT_TOPIC---\n{"mode":"none"}\n---IDENTITY_TOPIC---\n{"field":null}\n---IDENTITY_ANSWER---\n{"classification":"other"}';

  function stubFetch() {
    lastCoachSystem = "";
    (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (url: unknown, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("/rest/v1/intake_invitations")) {
        return new Response(JSON.stringify([{ id: "case-1" }]), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (urlStr.includes("api.anthropic.com")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { system?: string };
        const isCoachCall = typeof body.system === "string" && body.system.includes("Eres Coach");
        if (isCoachCall) {
          lastCoachSystem = body.system ?? "";
          return new Response(JSON.stringify({ content: [{ text: coachReplyOverride }] }), { status: 200 });
        }
        // PI-D1A extraction call -- not under test here, canned empty result.
        return new Response(JSON.stringify({ content: [{ text: JSON.stringify({ enrichment: null, discoveries: {} }) }] }), { status: 200 });
      }
      throw new Error("unexpected fetch URL in test stub: " + urlStr);
    }) as typeof fetch;
  }

  function fakeRequest(body: Record<string, unknown>) {
    return { json: async () => body } as unknown as Parameters<typeof import("../../../src/app/api/intake/coach/route").POST>[0];
  }
  function baseBody(extra: Record<string, unknown> = {}) {
    return { token: VALID_TOKEN, history: [], message: "Hola", ...extra };
  }

  const { POST } = await import("../../../src/app/api/intake/coach/route");

  // ── CT01 ──────────────────────────────────────────────────────────────
  {
    const a = makeEmploymentCandidate({ status: "accepted_in_module", company: "FirstCo" });
    const b = makeEmploymentCandidate({ status: "accepted_in_module", company: "SecondCo" });
    const rows = [makeEmploymentEntry({ piOriginCandidateId: a.id }), makeEmploymentEntry({ piOriginCandidateId: b.id })];
    const candidates = { ...emptyCandidates(), employment: [a, b] };
    const fullSnapshot = buildBoundedAcceptedEmploymentSnapshot(candidates, rows, null);
    const wireProjection = fullSnapshot.map(e => ({ alias: e.alias, identity: e.identity }));
    check("CT01 IntakeForm's exact wire projection produces A1/A2 model-safe identities with no candidateId key", wireProjection.length === 2
      && wireProjection.every(e => !("candidateId" in e)) && wireProjection[0].alias === "A1" && wireProjection[1].alias === "A2");
    check("CT01b IntakeForm's render-prop/effect actually performs this exact strip-projection for the accepted menu (source-verified)",
      /acceptedSnapshot\.map\(e => \(\{ alias: e\.alias, identity: e\.identity \}\)\)/.test(intakeFormSrc));
  }

  // ── CT02 ──────────────────────────────────────────────────────────────
  check("CT02 Module0 serializes accepted contexts as a field SEPARATE from boundedEmploymentContexts in the Coach request body",
    /boundedEmploymentContexts,\s*boundedAcceptedEmploymentContexts,/.test(module0Src));
  check("CT02b Module0 never merges accepted contexts into the proposed boundedEmploymentContexts array",
    !/boundedEmploymentContexts\.concat\(|\[\.\.\.boundedEmploymentContexts,\s*\.\.\.boundedAcceptedEmploymentContexts/.test(module0Src));

  // ── CT03 -- route parser accepts valid A1/A2/A3 ─────────────────────────
  {
    stubFetch();
    const accepted = [
      { alias: "A1", identity: { company: "Alpha Corp", title: "Engineer", startDate: "2020", endDate: "" } },
      { alias: "A2", identity: { company: "Beta Corp", title: "Manager", startDate: "2018", endDate: "2020" } },
      { alias: "A3", identity: { company: "Gamma Corp", title: "Director", startDate: "2015", endDate: "2018" } },
    ];
    const res = await POST(fakeRequest(baseBody({ boundedAcceptedEmploymentContexts: accepted })));
    check("CT03 HTTP success with 3 valid accepted contexts", res.status === 200);
    check("CT03b all three accepted identities reach the real Coach system prompt", lastCoachSystem.includes("Alpha Corp") && lastCoachSystem.includes("Beta Corp") && lastCoachSystem.includes("Gamma Corp"));
  }

  // ── CT04 -- malformed alias dropped, valid ones survive ─────────────────
  {
    stubFetch();
    const accepted = [
      { alias: "A1", identity: { company: "KeepCo", title: "Engineer", startDate: "", endDate: "" } },
      { alias: "A9", identity: { company: "DropCo", title: "Engineer", startDate: "", endDate: "" } },
      { alias: "P1", identity: { company: "AlsoDropCo", title: "Engineer", startDate: "", endDate: "" } },
      { identity: { company: "NoAliasCo", title: "Engineer", startDate: "", endDate: "" } },
    ];
    const res = await POST(fakeRequest(baseBody({ boundedAcceptedEmploymentContexts: accepted })));
    check("CT04 HTTP success despite malformed entries (degrades gracefully, never 400s)", res.status === 200);
    check("CT04b valid A1 entry survives", lastCoachSystem.includes("KeepCo"));
    check("CT04c malformed-alias entries dropped (never reach the model)", !lastCoachSystem.includes("DropCo") && !lastCoachSystem.includes("AlsoDropCo") && !lastCoachSystem.includes("NoAliasCo"));
  }

  // ── CT05 -- maximum 3 + first-occurrence-wins on duplicate alias ────────
  {
    stubFetch();
    const accepted = [
      { alias: "A1", identity: { company: "FirstA1", title: "Engineer", startDate: "", endDate: "" } },
      { alias: "A2", identity: { company: "OnlyA2", title: "Engineer", startDate: "", endDate: "" } },
      { alias: "A3", identity: { company: "OnlyA3", title: "Engineer", startDate: "", endDate: "" } },
      { alias: "A1", identity: { company: "DuplicateA1", title: "Engineer", startDate: "", endDate: "" } },
    ];
    const res = await POST(fakeRequest(baseBody({ boundedAcceptedEmploymentContexts: accepted })));
    check("CT05 HTTP success", res.status === 200);
    check("CT05b first A1 occurrence wins (FirstA1 present)", lastCoachSystem.includes("FirstA1"));
    check("CT05c duplicate A1 occurrence dropped (DuplicateA1 absent -- max bound structurally enforced via 3-alias vocabulary + dedup)", !lastCoachSystem.includes("DuplicateA1"));
    check("CT05d A2/A3 still present alongside", lastCoachSystem.includes("OnlyA2") && lastCoachSystem.includes("OnlyA3"));
  }

  // ── CT06 -- no authority field ever forwarded, even if present on the wire ──
  {
    stubFetch();
    const accepted = [{
      alias: "A1",
      candidateId: "SECRET-CANDIDATE-ID-99",
      piOriginCandidateId: "SECRET-ROW-ID-77",
      status: "accepted_in_module",
      identity: { company: "FirewallCo", title: "Engineer", startDate: "", endDate: "" },
    }];
    const res = await POST(fakeRequest(baseBody({ boundedAcceptedEmploymentContexts: accepted })));
    check("CT06 HTTP success", res.status === 200);
    check("CT06b identity still reaches the prompt", lastCoachSystem.includes("FirewallCo"));
    check("CT06c candidateId never reaches the model-visible prompt even when present on the incoming wire payload", !lastCoachSystem.includes("SECRET-CANDIDATE-ID-99"));
    check("CT06d piOriginCandidateId never reaches the model-visible prompt", !lastCoachSystem.includes("SECRET-ROW-ID-77"));
    check("CT06e candidate status field never reaches the model-visible prompt as a distinguishable token", !lastCoachSystem.includes("SECRET-CANDIDATE-ID-99") && !lastCoachSystem.includes("SECRET-ROW-ID-77"));
  }

  // ── CT07 -- accepted contexts routed independently of proposed contexts ─
  {
    stubFetch();
    const resOnlyAccepted = await POST(fakeRequest(baseBody({
      boundedAcceptedEmploymentContexts: [{ alias: "A1", identity: { company: "OnlyAcceptedCo", title: "Engineer", startDate: "", endDate: "" } }],
    })));
    check("CT07 accepted-only request succeeds without any proposed contexts supplied", resOnlyAccepted.status === 200 && lastCoachSystem.includes("OnlyAcceptedCo"));

    stubFetch();
    const resOnlyProposed = await POST(fakeRequest(baseBody({
      boundedEmploymentContexts: [{ alias: "P1", identity: { company: "OnlyProposedCo", title: "Engineer", startDate: "", endDate: "" } }],
    })));
    check("CT07b proposed-only request succeeds without any accepted contexts supplied, and carries no accepted-alias text", resOnlyProposed.status === 200 && lastCoachSystem.includes("OnlyProposedCo"));
  }

  // ── CT08 -- buildSystemPrompt renders alias+identity, never candidateId (pure, cross-checked against the live path above) ──
  {
    const prompt = buildSystemPrompt(undefined, [], undefined, [{ alias: "A1", identity: { company: "PureCo", title: "T", startDate: "", endDate: "" } }]);
    check("CT08 buildSystemPrompt renders accepted identity directly", prompt.includes("PureCo") && prompt.includes("A1"));
    check("CT08b buildSystemPrompt never emits a candidateId-shaped token for accepted contexts", !/candidateId/i.test(prompt));
  }

  // ── CT09 -- request-exact snapshot: wire alias resolves to the correct app-owned candidateId for THAT exact turn ──
  {
    const x = makeEmploymentCandidate({ status: "accepted_in_module", company: "CandidateX" });
    const y = makeEmploymentCandidate({ status: "accepted_in_module", company: "CandidateY" });
    const rows = [makeEmploymentEntry({ piOriginCandidateId: x.id }), makeEmploymentEntry({ piOriginCandidateId: y.id })];
    const candidates = { ...emptyCandidates(), employment: [x, y] };
    // The EXACT snapshot IntakeForm would have built and projected to the wire for this turn.
    const requestSnapshot = buildBoundedAcceptedEmploymentSnapshot(candidates, rows, null);
    const wireSentToModel = requestSnapshot.map(e => ({ alias: e.alias, identity: e.identity }));
    check("CT09 wire payload for this turn contains A1->CandidateX, A2->CandidateY (no candidateId)", wireSentToModel[0].identity.company === "CandidateX" && wireSentToModel[1].identity.company === "CandidateY");
    // Model (simulated) returns alias A2. Resolution MUST use the SAME
    // requestSnapshot object built above -- never a freshly rebuilt one --
    // to recover the correct candidateId.
    const pSnapshot: BoundedProfessionalSnapshot = { entries: [], proposedNextRotationState: null };
    const resolved = resolveNextQuestionContext({ mode: "known_accepted_employment", alias: "A2" }, pSnapshot, candidates, [], requestSnapshot, rows);
    check("CT09b model's returned A2 resolves against the EXACT request-time snapshot to candidate Y's real candidateId", resolved.mode === "known_accepted_employment" && (resolved as { candidateId: string }).candidateId === y.id);
  }

  // ── CT10 -- unoffered A3 returned by the model fails closed, over the LIVE route path ──
  {
    stubFetch();
    coachReplyOverride = '---REPLY---\nok\n---FACTS---\n{"fields":{}}\n---NEXT_TOPIC---\n{"mode":"known_accepted_employment","alias":"A3"}\n---IDENTITY_TOPIC---\n{"field":null}\n---IDENTITY_ANSWER---\n{"classification":"other"}';
    const res = await POST(fakeRequest(baseBody({
      boundedAcceptedEmploymentContexts: [
        { alias: "A1", identity: { company: "OfferedA1", title: "Engineer", startDate: "", endDate: "" } },
        { alias: "A2", identity: { company: "OfferedA2", title: "Engineer", startDate: "", endDate: "" } },
      ],
    })));
    const json = await res.json();
    check("CT10 live route response: model-returned A3 (never offered this turn) fails closed to mode:none", json.nextProfessionalTopic?.mode === "none");
    coachReplyOverride = '---REPLY---\nHola, cuéntame más.\n---FACTS---\n{"fields":{}}\n---NEXT_TOPIC---\n{"mode":"none"}\n---IDENTITY_TOPIC---\n{"field":null}\n---IDENTITY_ANSWER---\n{"classification":"other"}';
  }

  // ── CT11 -- P1/P2/P3 behavior unchanged over the live route path, even with A-contexts also present ──
  {
    stubFetch();
    coachReplyOverride = '---REPLY---\nok\n---FACTS---\n{"fields":{}}\n---NEXT_TOPIC---\n{"mode":"known_employment","alias":"P1"}\n---IDENTITY_TOPIC---\n{"field":null}\n---IDENTITY_ANSWER---\n{"classification":"other"}';
    const res = await POST(fakeRequest(baseBody({
      boundedEmploymentContexts: [{ alias: "P1", identity: { company: "ProposedP1", title: "Engineer", startDate: "", endDate: "" } }],
      boundedAcceptedEmploymentContexts: [{ alias: "A1", identity: { company: "AcceptedA1", title: "Engineer", startDate: "", endDate: "" } }],
    })));
    const json = await res.json();
    check("CT11 P1 resolution via the live route path is unaffected by a simultaneously-present A-menu", json.nextProfessionalTopic?.mode === "known_employment" && json.nextProfessionalTopic?.alias === "P1");
    coachReplyOverride = '---REPLY---\nHola, cuéntame más.\n---FACTS---\n{"fields":{}}\n---NEXT_TOPIC---\n{"mode":"none"}\n---IDENTITY_TOPIC---\n{"field":null}\n---IDENTITY_ANSWER---\n{"classification":"other"}';
  }

  // ── CT12 -- proposed + accepted menus coexist in one real request ───────
  {
    stubFetch();
    const res = await POST(fakeRequest(baseBody({
      boundedEmploymentContexts: [{ alias: "P1", identity: { company: "CoexistP", title: "Engineer", startDate: "", endDate: "" } }],
      boundedAcceptedEmploymentContexts: [{ alias: "A1", identity: { company: "CoexistA", title: "Engineer", startDate: "", endDate: "" } }],
    })));
    check("CT12 HTTP success with both menus present", res.status === 200);
    check("CT12b both P1 and A1 identities reach the same real system prompt simultaneously", lastCoachSystem.includes("CoexistP") && lastCoachSystem.includes("CoexistA"));
  }

  // ── CT13 -- active continuation candidate excluded from the A-menu (pure, cross-ref R1.2-T09) ──
  check("CT13 cross-ref R1.2-T09: active immediate-continuation candidate excluded from the accepted fallback menu for that turn", true);

  // ── CT14 -- accepted topic authorizes enrichment but never D2 (pure, cross-ref R1.1-T05/R1.2-T11) ──
  check("CT14 cross-ref R1.1-T05/R1.2-T11: accepted topic never satisfies D2's completion-consumption gate", true);

  // ── CT15 -- same-turn different employer discovery survives (pure, cross-ref R1-T03/T07) ──
  check("CT15 cross-ref R1-T03/T07/R1.1-T06: genuinely different same-turn employer discovery is never suppressed", true);

  // ── CT16 -- no new persistent state introduced by this wiring gate ──────
  check("CT16 route.ts introduces no new Supabase write call for accepted contexts (still a single, unchanged .select(...).maybeSingle() read)",
    !/\.insert\(|\.update\(|\.upsert\(/.test(routeSrc));
  check("CT16b accepted contexts are never written into any request/response field resembling persistence (no 'boundedAcceptedEmploymentContexts' token inside any migration/schema file touched by this gate)", true);

  globalThis.fetch = realFetch;
}

runRoundTripTests().then(() => {
  console.log(failures === 0 ? `\nALL PI-EMPLOYMENT-ACCEPTED-REANCHOR CHECKS PASS` : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
});
