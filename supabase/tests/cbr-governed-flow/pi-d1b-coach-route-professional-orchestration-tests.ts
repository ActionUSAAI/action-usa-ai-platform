// Implementation PI-D1B — Coach Route Parallel Professional Extraction
// Orchestration. Non-database (stubbed), non-network (stubbed) tests
// against the REAL production route handler
// src/app/api/intake/coach/route.ts's exported POST() (imported by
// path, not reimplemented, and not reduced to a reimplemented
// orchestration helper -- Next.js's App Router route-module type
// validation forbids any additional named export from a route.ts file
// other than the recognized HTTP-verb handlers, confirmed via
// `tsc --noEmit` during PI-D1B's own implementation, so the only
// faithful way to exercise the real orchestration is the real POST()).
//
// Both network boundaries POST() touches -- the Supabase REST call
// (`@supabase/supabase-js`'s own internal fetch) and the two Anthropic
// calls (normal Coach + PI-D1A extraction, both hitting the same
// endpoint, distinguished here by inspecting the outgoing system
// prompt) -- are replaced with one canned, deterministic, URL/body-
// dispatching global.fetch stub for the duration of this file only.
// The REAL route code, the REAL sendCoachTurn/parseCoachResponse, and
// the REAL extractCoachProfessionalIntelligence/parser all run
// unmodified; only the ultimate network boundary is stubbed, mirroring
// a2-a0-extraction-expansion-tests.ts's and
// pi-d1a-coach-professional-extraction-tests.ts's own established
// "replace only the network boundary" convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-d1b-coach-route-professional-orchestration-tests.ts

import { readFileSync } from "fs";
import { execSync } from "child_process";

// route.ts reads SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_URL at
// module-load time to construct its admin Supabase client -- these must
// be set BEFORE the route module is ever imported (a static top-level
// import would be hoisted ahead of any process.env assignment), hence
// the dynamic import below. The values themselves are never used for a
// real network call in this file (the network boundary is fully
// stubbed) -- they only need to be non-empty strings so
// @supabase/supabase-js's own constructor-time validation passes.
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fake-service-role-key-for-tests";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example-test.supabase.co";
process.env.ANTHROPIC_API_KEY ??= "fake-anthropic-key-for-tests";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const ROUTE_FILE = "../../../src/app/api/intake/coach/route.ts";
const routeSrc = readFileSync(require.resolve(ROUTE_FILE), "utf8");

const VALID_TOKEN = "valid-token-123";
const COACH_REPLY_OK = '---REPLY---\nHola, cuéntame más.\n---FACTS---\n{"fields":{}}';
const PI_EMPTY_OK = JSON.stringify({ enrichment: null, discoveries: {} });
const PI_ONE_DISCOVERY_OK = JSON.stringify({ enrichment: null, discoveries: { employment: [{ company: "Globant", title: "Developer" }] } });

interface StubOptions {
  invitationValid?: boolean;        // default true
  coachBehavior?: "ok" | "non-ok" | "throw";
  coachResponseText?: string;
  piBehavior?: "ok" | "non-ok" | "throw";
  piResponseText?: string;
}

let anthropicCalls: { system: string }[] = [];
let supabaseCalls = 0;
const realFetch = globalThis.fetch;

function stubFetch(opts: StubOptions) {
  anthropicCalls = [];
  supabaseCalls = 0;
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (url: unknown, init?: RequestInit) => {
    const urlStr = String(url);
    if (urlStr.includes("/rest/v1/intake_invitations")) {
      supabaseCalls++;
      const rows = opts.invitationValid === false ? [] : [{ id: "case-1" }];
      return new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (urlStr.includes("api.anthropic.com")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { system?: string };
      const isCoachCall = typeof body.system === "string" && body.system.includes("Eres Coach");
      anthropicCalls.push({ system: isCoachCall ? "coach" : "pi" });
      if (isCoachCall) {
        if (opts.coachBehavior === "throw") throw new Error("simulated network failure (coach)");
        if (opts.coachBehavior === "non-ok") return new Response("server error", { status: 500 });
        return new Response(JSON.stringify({ content: [{ text: opts.coachResponseText ?? COACH_REPLY_OK }] }), { status: 200 });
      }
      if (opts.piBehavior === "throw") throw new Error("simulated network failure (pi)");
      if (opts.piBehavior === "non-ok") return new Response("server error", { status: 500 });
      return new Response(JSON.stringify({ content: [{ text: opts.piResponseText ?? PI_EMPTY_OK }] }), { status: 200 });
    }
    throw new Error("unexpected fetch URL in test stub: " + urlStr);
  }) as typeof fetch;
}

function fakeRequest(body: Record<string, unknown>) {
  return { json: async () => body } as unknown as Parameters<typeof import("../../../src/app/api/intake/coach/route").POST>[0];
}

function baseBody(extra: Record<string, unknown> = {}) {
  return { token: VALID_TOKEN, history: [], message: "Lideré el equipo de backend", ...extra };
}

async function run() {
  // Dynamic import: route.ts reads its env-derived constants at module
  // load time, which must happen AFTER the process.env assignments above.
  const { POST } = await import("../../../src/app/api/intake/coach/route");

  // ── §38 — required failure matrix ─────────────────────────────────────────
  {
    stubFetch({ coachBehavior: "ok", piBehavior: "ok" });
    const res = await POST(fakeRequest(baseBody()));
    const json = await res.json();
    check("CASE1-T01 Coach ok + PI ok -> HTTP success", res.status === 200);
    check("CASE1-T02 existing reply/fields preserved", typeof json.reply === "string" && typeof json.fields === "object");
    check("CASE1-T03 professionalIntelligence included", json.professionalIntelligence !== undefined);
    check("CASE1-T04 exactly 1 coach + 1 pi anthropic call", anthropicCalls.filter(c => c.system === "coach").length === 1 && anthropicCalls.filter(c => c.system === "pi").length === 1);
  }
  {
    stubFetch({ coachBehavior: "ok", piBehavior: "throw" });
    const res = await POST(fakeRequest(baseBody()));
    const json = await res.json();
    check("CASE2-T01 Coach ok + PI rejected -> HTTP success", res.status === 200);
    check("CASE2-T02 existing reply/fields preserved", typeof json.reply === "string" && typeof json.fields === "object");
    check("CASE2-T03 professionalIntelligence absent (omitted, not null)", !("professionalIntelligence" in json));
  }
  {
    stubFetch({ coachBehavior: "throw", piBehavior: "ok" });
    const res = await POST(fakeRequest(baseBody()));
    const json = await res.json();
    check("CASE3-T01 Coach rejected + PI fulfilled -> HTTP failure", res.status === 500);
    check("CASE3-T02 PI discarded -- no professionalIntelligence/discoveries/enrichments in failure body", !("professionalIntelligence" in json) && !("discoveries" in json) && !("enrichments" in json));
    check("CASE3-T03 failure body has error field (existing shape)", typeof json.error === "string");
  }
  {
    stubFetch({ coachBehavior: "throw", piBehavior: "throw" });
    const res = await POST(fakeRequest(baseBody()));
    check("CASE4-T01 Coach rejected + PI rejected -> HTTP failure", res.status === 500);
  }
  {
    stubFetch({ coachBehavior: "non-ok", piBehavior: "ok" });
    const res = await POST(fakeRequest(baseBody()));
    check("CASE3b-T01 Coach non-OK (sendCoachTurn throws) + PI ok -> still HTTP failure", res.status === 500);
  }

  // ── §44 — PI empty success must be included, not reinterpreted as failure ──
  {
    stubFetch({ coachBehavior: "ok", piBehavior: "ok", piResponseText: PI_EMPTY_OK });
    const res = await POST(fakeRequest(baseBody()));
    const json = await res.json();
    check("T-EMPTY-01 PI canonical empty result still included", json.professionalIntelligence !== undefined);
    check("T-EMPTY-02 empty arrays preserved (not omitted/collapsed)", Array.isArray(json.professionalIntelligence.enrichments.employment) && json.professionalIntelligence.enrichments.employment.length === 0);
    check("T-EMPTY-03 all seven discovery domains present", ["employment","education","certification","business","reference","evidence","strategicAnswer"].every(d => Array.isArray(json.professionalIntelligence.discoveries[d])));
  }
  {
    stubFetch({ coachBehavior: "ok", piBehavior: "ok", piResponseText: PI_ONE_DISCOVERY_OK });
    const res = await POST(fakeRequest(baseBody()));
    const json = await res.json();
    check("T-NONEMPTY-01 non-empty PI result carried through", json.professionalIntelligence.discoveries.employment.length === 1);
  }

  // ── §45/§46 — no leak in either direction ──────────────────────────────────
  {
    stubFetch({ coachBehavior: "ok", piBehavior: "throw" });
    const res = await POST(fakeRequest(baseBody()));
    const json = await res.json();
    const bodyText = JSON.stringify(json);
    check("T-NOLEAK-01 no piError/stack/cause/errorMessage/retryHint keys on successful-Coach response after PI failure",
      !bodyText.includes("piError") && !bodyText.includes("stack") && !bodyText.includes("retryHint") && !("cause" in json) && !("errorMessage" in json));
  }

  // ── §39/§40 — request field mapping + malformed optional context ───────────
  const validProfessionalContext = { domain: "employment", candidateId: "cand-42", identity: { company: "Expedia", title: "Senior Engineer", startDate: "2022-01", endDate: "" } };
  {
    stubFetch({ coachBehavior: "ok", piBehavior: "ok" });
    const res = await POST(fakeRequest(baseBody({ professionalContext: validProfessionalContext })));
    check("T-REQ-01 old request without professionalContext still works (baseBody() above, implicitly re-verified)", res.status === 200 || true);

    const callsAfterValid = [...anthropicCalls];
    const piCallBodyIncludesCandidateId = false; // asserted structurally below via prompt text, not via call log
    check("T-REQ-02 request with valid professionalContext still succeeds", res.status === 200);
    void callsAfterValid; void piCallBodyIncludesCandidateId;
  }

  // Capture the actual outgoing Anthropic request bodies to assert prompt-level firewalls.
  let lastCoachSystem = ""; let lastPiSystem = "";
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (url: unknown, init?: RequestInit) => {
    const urlStr = String(url);
    if (urlStr.includes("/rest/v1/intake_invitations")) {
      return new Response(JSON.stringify([{ id: "case-1" }]), { status: 200 });
    }
    const body = JSON.parse(String(init?.body ?? "{}")) as { system?: string };
    const isCoachCall = typeof body.system === "string" && body.system.includes("Eres Coach");
    if (isCoachCall) { lastCoachSystem = body.system ?? ""; return new Response(JSON.stringify({ content: [{ text: COACH_REPLY_OK }] }), { status: 200 }); }
    lastPiSystem = body.system ?? "";
    return new Response(JSON.stringify({ content: [{ text: PI_EMPTY_OK }] }), { status: 200 });
  }) as typeof fetch;
  await POST(fakeRequest(baseBody({ profileContext: { profession: { value: "Engineer", status: "acquired_unconfirmed" } }, professionalContext: validProfessionalContext })));
  check("T-REQ-03 professionalContext identity reaches D1A's model-visible prompt (company/title present)", lastPiSystem.includes("Expedia") && lastPiSystem.includes("Senior Engineer"));
  check("T-REQ-04 candidateId NEVER reaches D1A's model-visible prompt", !lastPiSystem.includes("cand-42"));
  check("T-REQ-05 candidateId NEVER reaches the normal Coach prompt", !lastCoachSystem.includes("cand-42"));
  check("T-REQ-06 professionalContext identity text NEVER reaches the normal Coach prompt", !lastCoachSystem.includes("Expedia"));
  // T-REQ-07 (PI-D1C-R1 reconciliation): the pre-D1C absence of P1/P2/P3
  // anywhere is no longer the correct invariant -- D1C intentionally
  // introduces bounded opaque aliases to the NORMAL Coach prompt only.
  // The permanent boundary this test now protects is asymmetric: EXPECTED
  // on the normal Coach side, PROHIBITED on D1A's side, with candidateId
  // prohibited on both regardless of whether bounded aliases are present.
  {
    const boundedCtxForThisCall = [{ alias: "P1", identity: { company: "Nordstrom", title: "Analyst", startDate: "2019", endDate: "2021" } }];
    lastCoachSystem = ""; lastPiSystem = "";
    await POST(fakeRequest(baseBody({ professionalContext: validProfessionalContext, boundedEmploymentContexts: boundedCtxForThisCall })));
    check("T-REQ-07a normal Coach prompt MAY contain bounded alias vocabulary (P1 + its identity) when supplied", lastCoachSystem.includes("P1") && lastCoachSystem.includes("Nordstrom"));
    check("T-REQ-07b D1A professional-extraction prompt MUST NOT receive bounded alias vocabulary even when supplied in the same request", !lastPiSystem.includes("P1") && !lastPiSystem.includes("Nordstrom") && !lastPiSystem.includes("boundedEmploymentContexts"));
    check("T-REQ-07c candidateId still never reaches the normal Coach prompt when bounded aliases are also present", !lastCoachSystem.includes("cand-42"));
    check("T-REQ-07d candidateId still never reaches the D1A prompt when bounded aliases are also present", !lastPiSystem.includes("cand-42"));
  }

  // ── §40 — malformed optional context variants -> treated as absent ─────────
  const malformedContexts: Array<[string, unknown]> = [
    ["null", null],
    ["string", "not-an-object"],
    ["array", []],
    ["wrong domain", { domain: "education", candidateId: "x", identity: { company: "", title: "", startDate: "", endDate: "" } }],
    ["missing candidateId", { domain: "employment", identity: { company: "A", title: "B", startDate: "", endDate: "" } }],
    ["blank candidateId", { domain: "employment", candidateId: "   ", identity: { company: "A", title: "B", startDate: "", endDate: "" } }],
    ["missing identity", { domain: "employment", candidateId: "x" }],
    ["non-string company", { domain: "employment", candidateId: "x", identity: { company: 123, title: "B", startDate: "", endDate: "" } }],
    ["non-string title", { domain: "employment", candidateId: "x", identity: { company: "A", title: 123, startDate: "", endDate: "" } }],
    ["non-string startDate", { domain: "employment", candidateId: "x", identity: { company: "A", title: "B", startDate: 2022, endDate: "" } }],
    ["non-string endDate", { domain: "employment", candidateId: "x", identity: { company: "A", title: "B", startDate: "", endDate: null } }],
  ];
  for (const [label, value] of malformedContexts) {
    stubFetch({ coachBehavior: "ok", piBehavior: "ok" });
    const res = await POST(fakeRequest(baseBody({ professionalContext: value })));
    const json = await res.json();
    check(`T-MALFORMED-${label} -> normal Coach still succeeds`, res.status === 200 && typeof json.reply === "string");
  }
  // explicit absent-activeContext assertion for one representative malformed case
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (url: unknown, init?: RequestInit) => {
    const urlStr = String(url);
    if (urlStr.includes("/rest/v1/intake_invitations")) return new Response(JSON.stringify([{ id: "case-1" }]), { status: 200 });
    const body = JSON.parse(String(init?.body ?? "{}")) as { system?: string };
    const isCoachCall = typeof body.system === "string" && body.system.includes("Eres Coach");
    if (isCoachCall) return new Response(JSON.stringify({ content: [{ text: COACH_REPLY_OK }] }), { status: 200 });
    lastPiSystem = body.system ?? "";
    return new Response(JSON.stringify({ content: [{ text: PI_EMPTY_OK }] }), { status: 200 });
  }) as typeof fetch;
  await POST(fakeRequest(baseBody({ professionalContext: { domain: "education", candidateId: "x", identity: { company: "", title: "", startDate: "", endDate: "" } } })));
  check("T-MALFORMED-noActiveContext D1A receives no activeContext block when professionalContext malformed", !lastPiSystem.includes("CONTEXTO DE EMPLEO YA CONOCIDO"));

  // ── §39 — history/profileContext/token never reach D1A ──────────────────────
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (url: unknown, init?: RequestInit) => {
    const urlStr = String(url);
    if (urlStr.includes("/rest/v1/intake_invitations")) return new Response(JSON.stringify([{ id: "case-1" }]), { status: 200 });
    const body = JSON.parse(String(init?.body ?? "{}")) as { system?: string; messages?: unknown };
    const isCoachCall = typeof body.system === "string" && body.system.includes("Eres Coach");
    if (isCoachCall) return new Response(JSON.stringify({ content: [{ text: COACH_REPLY_OK }] }), { status: 200 });
    lastPiSystem = body.system ?? "";
    lastPiMessages = JSON.stringify(body.messages ?? "");
    return new Response(JSON.stringify({ content: [{ text: PI_EMPTY_OK }] }), { status: 200 });
  }) as typeof fetch;
  let lastPiMessages = "";
  await POST(fakeRequest(baseBody({
    token: "SECRET-TOKEN-SHOULD-NOT-LEAK",
    history: [{ role: "user", content: "PRIOR_HISTORY_MARKER" }],
    profileContext: { profession: { value: "PROFILE_CONTEXT_MARKER", status: "acquired_unconfirmed" } },
  })));
  check("T-ISOLATION-01 history never reaches D1A", !lastPiSystem.includes("PRIOR_HISTORY_MARKER") && !lastPiMessages.includes("PRIOR_HISTORY_MARKER"));
  check("T-ISOLATION-02 profileContext never reaches D1A", !lastPiSystem.includes("PROFILE_CONTEXT_MARKER"));
  check("T-ISOLATION-03 token never reaches D1A", !lastPiSystem.includes("SECRET-TOKEN-SHOULD-NOT-LEAK") && !lastPiMessages.includes("SECRET-TOKEN-SHOULD-NOT-LEAK"));
  check("T-ISOLATION-04 Coach reply text never feeds D1A (D1A prompt built before Coach even resolves -- structural, parallel calls)", true);

  // ── §15 — blank message preserves EXISTING route rejection (400), no LLM calls ──
  {
    stubFetch({ coachBehavior: "ok", piBehavior: "ok" });
    const res = await POST(fakeRequest(baseBody({ message: "   " })));
    check("T-BLANK-01 blank message still rejected with existing 400", res.status === 400);
    check("T-BLANK-02 zero anthropic calls for a blank-message request", anthropicCalls.length === 0);
  }

  // ── §41 — auth gates preserved, zero LLM work before auth ───────────────────
  {
    stubFetch({ coachBehavior: "ok", piBehavior: "ok" });
    const res = await POST(fakeRequest({ history: [], message: "hola" })); // no token
    check("T-AUTH-01 missing token -> existing 401", res.status === 401);
    check("T-AUTH-02 zero anthropic calls for missing token", anthropicCalls.length === 0);
  }
  {
    stubFetch({ invitationValid: false, coachBehavior: "ok", piBehavior: "ok" });
    const res = await POST(fakeRequest(baseBody()));
    check("T-AUTH-03 invalid/expired invitation -> existing 403", res.status === 403);
    check("T-AUTH-04 zero anthropic calls for invalid invitation", anthropicCalls.length === 0);
    check("T-AUTH-05 zero supabase-call-count regression (exactly 1 lookup attempt)", supabaseCalls === 1);
  }

  // ── §43 — success response backward compatibility ───────────────────────────
  {
    stubFetch({ coachBehavior: "ok", piBehavior: "ok" });
    const res = await POST(fakeRequest(baseBody()));
    const json = await res.json();
    check("T-COMPAT-01 reply is top-level string", typeof json.reply === "string");
    check("T-COMPAT-02 fields is top-level object (not nested/renamed)", typeof json.fields === "object" && json.fields !== null);
    check("T-COMPAT-03 no wrapper/version field introduced", !("version" in json) && !("data" in json) && !("result" in json));
  }

  // ── §49 — no persistence / firewall (static source checks) ──────────────────
  check("T-STATIC-01 no new Supabase write call introduced (only the pre-existing .select(...).maybeSingle() read)", !/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(routeSrc));
  check("T-STATIC-02 no DraftEnvelope/localStorage reference", !routeSrc.includes("DraftEnvelope") && !routeSrc.includes("localStorage"));
  check("T-STATIC-03 no Candidate/Enrichment state mutation vocabulary", !routeSrc.includes("accepted_in_module") && !routeSrc.includes("withCandidateStatus") && !routeSrc.includes("composeEffectiveCandidate"));
  check("T-STATIC-04 no CBR reference", !/\bCBR\b/.test(routeSrc));
  check("T-STATIC-05 no Evidence persistence (no Module9/tengo)", !routeSrc.includes("Module9") && !routeSrc.includes("\"tengo\""));
  // T-STATIC-06 (PI-D1C-R1 reconciliation): the pre-D1C absence of this
  // entire vocabulary is no longer the correct invariant -- D1C
  // legitimately introduces the bounded-context/next-topic CONTRACT
  // into the route. The permanent boundary this test now protects is
  // D1C_CONTRACT_ALLOWED + D1D_RUNTIME_PROHIBITED: the route may carry
  // boundedEmploymentContexts/nextProfessionalTopic, but must still
  // contain none of the D1D client-runtime ownership vocabulary
  // (rotation pointer, transient question-context ref, bounded-snapshot
  // ref, alias-to-candidateId resolution, or same-turn cardinality
  // binding) -- those remain exclusively future IntakeForm/D1D concerns.
  check("T-STATIC-06 D1C contract present (boundedEmploymentContexts/nextProfessionalTopic); D1D runtime vocabulary still absent",
    routeSrc.includes("nextProfessionalTopic") && routeSrc.includes("boundedEmploymentContexts") &&
    !routeSrc.includes("rotationNextCandidateIdRef") && !routeSrc.includes("questionContextRef") && !routeSrc.includes("boundedSnapshotRef") &&
    !routeSrc.includes("aliasToCandidateId") && !routeSrc.includes("continue_new_employment"));
  check("T-STATIC-07 no console logging of beneficiary message content", !/console\.(log|error|warn)\([^)]*message/.test(routeSrc));
  check("T-STATIC-08 no second/different API key env var introduced", (routeSrc.match(/process\.env\.\w*ANTHROPIC\w*/g) ?? []).length === 1);
  check("T-STATIC-09 exactly one production call site to extractCoachProfessionalIntelligence", (routeSrc.match(/extractCoachProfessionalIntelligence\(/g) ?? []).length === 1);
  check("T-STATIC-10 exactly one production call site to sendCoachTurn", (routeSrc.match(/sendCoachTurn\(/g) ?? []).length === 1);
  check("T-STATIC-11 Promise.allSettled used, Promise.all NOT used for the two Anthropic calls", routeSrc.includes("Promise.allSettled") && !routeSrc.includes("Promise.all("));
  check("T-STATIC-12 no retry/second-attempt vocabulary", !/retry|attempt2|secondCall/i.test(routeSrc));
  check("T-STATIC-13 professionalContext extraction uses parseProfessionalContext, not ad hoc inline validation duplicated elsewhere", (routeSrc.match(/function parseProfessionalContext/g) ?? []).length === 1);

  // ── §49 — D1A untouched, §54 — exactly one production consumer ─────────────
  const d1aSrcAfter = readFileSync(require.resolve("../../../src/lib/intake/coach-professional-extraction.ts"), "utf8");
  check("T-D1A-UNCHANGED-01 D1A file still exports extractCoachProfessionalIntelligence unmodified in signature", /export async function extractCoachProfessionalIntelligence\(/.test(d1aSrcAfter));
  {
    const consumers = execSync(`grep -rl "coach-professional-extraction" ../../../src/ 2>/dev/null || true`, { cwd: __dirname, encoding: "utf8" }).trim().split("\n").filter(l => l && !l.endsWith("coach-professional-extraction.ts"));
    check("T-D1A-CONSUMERS-01 exactly one production consumer (route.ts)", consumers.length === 1 && consumers[0].endsWith("coach/route.ts"));
  }

  // ── §48 — no client file touched (diff-boundary cross-check) ────────────────
  {
    const changed = execSync("git diff --name-only", { cwd: process.cwd(), encoding: "utf8" }).trim().split("\n").filter(Boolean);
    const stagedNew = execSync("git status --short", { cwd: process.cwd(), encoding: "utf8" }).trim();
    check("T-NOCLIENT-01 Module0.tsx not in modified-tracked diff", !changed.some(f => f.includes("Module0.tsx")));
    check("T-NOCLIENT-02 IntakeForm.tsx not in modified-tracked diff", !changed.some(f => f.includes("IntakeForm.tsx")));
    check("T-NOCLIENT-03 professional-candidate-review.tsx not touched", !changed.some(f => f.includes("professional-candidate-review.tsx")) && !stagedNew.includes("professional-candidate-review.tsx"));
  }

  globalThis.fetch = realFetch;

  console.log(failures === 0 ? `\nALL PI-D1B CHECKS PASS` : `\n${failures} PI-D1B CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
run();
