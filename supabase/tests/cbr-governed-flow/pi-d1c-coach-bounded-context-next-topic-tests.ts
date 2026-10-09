// Implementation PI-D1C — Coach Bounded Context & Next Professional
// Topic Contract. Non-network unit tests against the REAL production
// exports of src/lib/intake/coach.ts (imported by path, not
// reimplemented) -- mirrors a3-r1/pi-d1a/pi-d1b's own established
// convention. buildSystemPrompt/parseCoachResponse are pure and
// directly testable without a live model call; sendCoachTurn's one
// live network dependency is exercised via the same canned
// global.fetch stub technique already established in this file set.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-d1c-coach-bounded-context-next-topic-tests.ts
//
// Scope: the bounded-context/NEXT_TOPIC CONTRACT only (PI-D1C). No
// client runtime exists yet to create boundedEmploymentContexts or
// consume nextProfessionalTopic (PI-D1D) -- this file asserts exactly
// that boundary too, alongside D1A/D1B's already-frozen separations.

import { readFileSync } from "fs";
import {
  type BoundedEmploymentContext,
  buildSystemPrompt,
  parseCoachResponse,
  sendCoachTurn,
} from "../../../src/lib/intake/coach";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const COACH_FILE = "../../../src/lib/intake/coach.ts";
const coachSrc = readFileSync(require.resolve(COACH_FILE), "utf8");

const P1: BoundedEmploymentContext = { alias: "P1", identity: { company: "Expedia", title: "Senior Engineer", startDate: "2022-01", endDate: "" } };
const P2: BoundedEmploymentContext = { alias: "P2", identity: { company: "Nordstrom", title: "Analyst", startDate: "2019", endDate: "2021" } };
const P3: BoundedEmploymentContext = { alias: "P3", identity: { company: "Globant", title: "Developer", startDate: "2021", endDate: "2022" } };

// ── §54/§55 — bounded input / prompt ────────────────────────────────────────
{
  const noContext = buildSystemPrompt(undefined, undefined);
  check("T01 no boundedEmploymentContexts -> no 'CONTEXTOS PROFESIONALES CONOCIDOS' block", !noContext.includes("CONTEXTOS PROFESIONALES CONOCIDOS"));

  const emptyArr = buildSystemPrompt(undefined, []);
  check("T02 empty array -> same as absent (no contexts block)", !emptyArr.includes("CONTEXTOS PROFESIONALES CONOCIDOS"));
  check("T02b empty array -> byte-identical prompt to absent", emptyArr === noContext);

  const oneP1 = buildSystemPrompt(undefined, [P1]);
  check("T03 one P1 -> alias and identity appear", oneP1.includes("P1") && oneP1.includes("Expedia") && oneP1.includes("Senior Engineer"));

  const p1p2 = buildSystemPrompt(undefined, [P1, P2]);
  check("T04 P1/P2 -> both appear", p1p2.includes("P1") && p1p2.includes("P2") && p1p2.includes("Expedia") && p1p2.includes("Nordstrom"));

  const all3 = buildSystemPrompt(undefined, [P1, P2, P3]);
  check("T05 P1/P2/P3 -> all three accepted and appear", all3.includes("P1") && all3.includes("P2") && all3.includes("P3") && all3.includes("Globant"));

  check("T06 candidateId never a field on BoundedEmploymentContext (structural)", !/interface BoundedEmploymentContext\s*\{[^}]*candidateId/.test(coachSrc));
  check("T07 no provenance/status/material fields on bounded context prompt output", !all3.includes("provenance") && !/\bstatus\b/.test(all3.split("CONTEXTOS PROFESIONALES")[1]?.split("Puedes usar")[0] ?? "") && !all3.includes("mainFunctions") && !all3.includes("importantProjects") && !all3.includes("mainAchievements"));
}

// ── §55 — prompt instructs internal-only aliases + requires NEXT_TOPIC ─────
{
  const withCtx = buildSystemPrompt(undefined, [P1]);
  check("T08 prompt tells Coach aliases are internal routing, never beneficiary-facing", /nunca.*mencionar.*beneficiario|mecánica interna/i.test(withCtx));
  check("T09 prompt explicitly forbids saying P1/P2/P3/mode names to the beneficiary", withCtx.includes('Nunca menciones "P1", "P2", "P3"'));
  check("T10 prompt requires a NEXT_TOPIC marker unconditionally (present even with no bounded contexts)", buildSystemPrompt(undefined, undefined).includes("---NEXT_TOPIC---"));
  check("T11 prompt contains all four exact routing modes", ["known_employment", "open_discovery", "continue_new_employment", "none"].every(m => withCtx.includes(m)));
  check("T12 prompt preserves existing FACTS instruction/example unchanged", withCtx.includes("---FACTS---") && withCtx.includes('{"fields":'));
  check("T13 FACTS vocabulary not expanded with professional-intelligence terms", !/employment.*:.*\[/i.test(withCtx) && !withCtx.includes("mainFunctions\":") );
  // The marker names are also mentioned in earlier explanatory prose
  // (e.g. "reporta ... en ---NEXT_TOPIC---"); the actual required output
  // *format block* is what must preserve REPLY/FACTS/NEXT_TOPIC order --
  // scope the check to that literal block, not the first occurrence of
  // each substring anywhere in the prompt.
  const formatBlock = withCtx.slice(withCtx.indexOf("Responde EXACTAMENTE en este formato"));
  check("T14 marker order within the required output format block is REPLY, FACTS, NEXT_TOPIC",
    formatBlock.indexOf("---REPLY---") < formatBlock.indexOf("---FACTS---") && formatBlock.indexOf("---FACTS---") < formatBlock.indexOf("---NEXT_TOPIC---"));
}

// ── §56 — parser ─────────────────────────────────────────────────────────────
function rawWith(topicJson: string | null): string {
  const base = '---REPLY---\nHola.\n---FACTS---\n{"fields":{}}';
  return topicJson === null ? base : `${base}\n---NEXT_TOPIC---\n${topicJson}`;
}
{
  const r1 = parseCoachResponse(rawWith('{"mode":"known_employment","alias":"P1"}'), [P1, P2]);
  check("T15 known_employment P1 valid when P1 exists", r1.nextProfessionalTopic.mode === "known_employment" && (r1.nextProfessionalTopic as { alias: string }).alias === "P1");

  const r2 = parseCoachResponse(rawWith('{"mode":"known_employment","alias":"P2"}'), [P1, P2]);
  check("T16 known_employment P2 valid when P2 exists", r2.nextProfessionalTopic.mode === "known_employment" && (r2.nextProfessionalTopic as { alias: string }).alias === "P2");

  const r3 = parseCoachResponse(rawWith('{"mode":"known_employment","alias":"P3"}'), [P1, P2, P3]);
  check("T17 known_employment P3 valid when P3 exists", r3.nextProfessionalTopic.mode === "known_employment" && (r3.nextProfessionalTopic as { alias: string }).alias === "P3");

  const r4 = parseCoachResponse(rawWith('{"mode":"known_employment","alias":"P3"}'), [P1, P2]);
  check("T18 known_employment P3 when only P1/P2 supplied -> none", r4.nextProfessionalTopic.mode === "none");

  const r5 = parseCoachResponse(rawWith('{"mode":"known_employment","alias":"P9"}'), [P1]);
  check("T19 known_employment invalid alias -> none", r5.nextProfessionalTopic.mode === "none");

  const r6 = parseCoachResponse(rawWith('{"mode":"open_discovery"}'), []);
  check("T20 open_discovery preserved", r6.nextProfessionalTopic.mode === "open_discovery");

  const r7 = parseCoachResponse(rawWith('{"mode":"continue_new_employment"}'), []);
  check("T21 continue_new_employment preserved", r7.nextProfessionalTopic.mode === "continue_new_employment");

  const r8 = parseCoachResponse(rawWith('{"mode":"none"}'), []);
  check("T22 none preserved", r8.nextProfessionalTopic.mode === "none");

  const r9 = parseCoachResponse(rawWith(null), []);
  check("T23 missing marker -> none", r9.nextProfessionalTopic.mode === "none");

  const r10 = parseCoachResponse(rawWith(""), []);
  check("T24 empty marker -> none", r10.nextProfessionalTopic.mode === "none");

  const r11 = parseCoachResponse(rawWith("not json at all"), []);
  check("T25 malformed JSON -> none", r11.nextProfessionalTopic.mode === "none");

  const r12 = parseCoachResponse(rawWith("[1,2,3]"), []);
  check("T26 array instead of object -> none", r12.nextProfessionalTopic.mode === "none");

  const r13 = parseCoachResponse(rawWith('{"mode":"something_unknown"}'), []);
  check("T27 unknown mode -> none", r13.nextProfessionalTopic.mode === "none");

  const r14 = parseCoachResponse(rawWith('{"mode":"known_employment"}'), [P1]);
  check("T28 known_employment missing alias -> none", r14.nextProfessionalTopic.mode === "none");

  const r15 = parseCoachResponse(rawWith('{"mode":"known_employment","alias":"P1","candidateId":"INJECTED","confidence":"high","reason":"because"}'), [P1]);
  check("T29 known_employment with extra irrelevant fields -> no extra authority survives (only mode/alias)", r15.nextProfessionalTopic.mode === "known_employment" && Object.keys(r15.nextProfessionalTopic).sort().join(",") === "alias,mode");

  // §43 -- no fuzzy alias
  for (const fuzzy of ["p1", "P01", "1", "job1", "employment1"]) {
    const rf = parseCoachResponse(rawWith(`{"mode":"known_employment","alias":"${fuzzy}"}`), [P1]);
    check(`T30 fuzzy alias "${fuzzy}" rejected -> none`, rf.nextProfessionalTopic.mode === "none");
  }
}

// ── §57 — off-by-one / no same-turn binding ─────────────────────────────────
{
  check("T31 nextProfessionalTopic is parsed only from the NEXT_TOPIC marker, never from currentMessage/history", !/parseNextProfessionalTopic\([^)]*message/.test(coachSrc) && !/parseNextProfessionalTopic\([^)]*history/.test(coachSrc));
  check("T32 coach.ts never imports professionalContext/activeContext/D1A module", !coachSrc.includes("coach-professional-extraction") && !coachSrc.includes("professionalContext"));
  check("T33 coach.ts never inspects professionalIntelligence/discoveries (no same-turn join)", !coachSrc.includes("professionalIntelligence") && !coachSrc.includes("discoveries.employment"));
  check("T34 continue_new_employment carries no entity identity in its own type (mode only)", /\{\s*mode:\s*"continue_new_employment"\s*\}/.test(coachSrc));
}

// ── §58 — reply cleaning ─────────────────────────────────────────────────────
{
  const raw = '---REPLY---\nHola, cuéntame más.\n---FACTS---\n{"fields":{"profession":{"value":"Engineer","confidence":"high"}}}\n---NEXT_TOPIC---\n{"mode":"known_employment","alias":"P1"}';
  const r = parseCoachResponse(raw, [P1]);
  check("T35 reply contains only the beneficiary-facing text", r.reply === "Hola, cuéntame más.");
  check("T36 reply has no marker leakage", !r.reply.includes("---") );
  check("T37 reply has no JSON leakage", !r.reply.includes("{") && !r.reply.includes("}"));
  check("T38 reply has no alias leakage", !r.reply.includes("P1"));
}

// ── §59 — FACTS independence ─────────────────────────────────────────────────
{
  const validFactsMalformedTopic = parseCoachResponse('---REPLY---\nOk.\n---FACTS---\n{"fields":{"profession":{"value":"Engineer","confidence":"high"}}}\n---NEXT_TOPIC---\nnot valid json', []);
  check("T39 valid FACTS + malformed NEXT_TOPIC -> fields preserved", validFactsMalformedTopic.fields.profession?.value === "Engineer");
  check("T40 valid FACTS + malformed NEXT_TOPIC -> topic none", validFactsMalformedTopic.nextProfessionalTopic.mode === "none");

  const malformedFactsValidTopic = parseCoachResponse('---REPLY---\nOk.\n---FACTS---\nnot valid json\n---NEXT_TOPIC---\n{"mode":"open_discovery"}', []);
  check("T41 malformed FACTS -> existing empty-fields fallback preserved", Object.keys(malformedFactsValidTopic.fields).length === 0);
  check("T42 malformed FACTS does not block a valid NEXT_TOPIC", malformedFactsValidTopic.nextProfessionalTopic.mode === "open_discovery");

  const missingFactsValidTopic = parseCoachResponse('---REPLY---\nOk.\n---NEXT_TOPIC---\n{"mode":"none"}', []);
  check("T43 missing FACTS marker -> existing behavior preserved (empty fields, reply still extracted)", Object.keys(missingFactsValidTopic.fields).length === 0 && missingFactsValidTopic.reply.length > 0);
}

// ── §35/§36/§37/§38 — modes valid without bounded contexts ─────────────────
{
  const r1 = parseCoachResponse(rawWith('{"mode":"known_employment","alias":"P1"}'), []);
  check("T44 known_employment cannot survive with zero bounded contexts -> none", r1.nextProfessionalTopic.mode === "none");
  const r2 = parseCoachResponse(rawWith('{"mode":"continue_new_employment"}'), []);
  check("T45 continue_new_employment valid with zero bounded contexts", r2.nextProfessionalTopic.mode === "continue_new_employment");
  const r3 = parseCoachResponse(rawWith('{"mode":"open_discovery"}'), []);
  check("T46 open_discovery valid with zero bounded contexts", r3.nextProfessionalTopic.mode === "open_discovery");
  const r4 = parseCoachResponse(rawWith('{"mode":"none"}'), []);
  check("T47 none valid with zero bounded contexts", r4.nextProfessionalTopic.mode === "none");
}

// ── §49/§50 — no rotation, no pin semantics hardcoded ───────────────────────
{
  check("T48 coach.ts contains no rotation/pointer/pin state", !coachSrc.includes("rotationNextCandidateIdRef") && !coachSrc.includes("shownCandidateIdsRef") && !/\bpinned\b/i.test(coachSrc));
  check("T49 coach.ts contains no questionContextRef/boundedSnapshotRef client-runtime state", !coachSrc.includes("questionContextRef") && !coachSrc.includes("boundedSnapshotRef"));
  check("T50 P1 is not hardcoded to mean 'current/pinned target' anywhere in parser logic", !/alias === "P1".*pin/i.test(coachSrc) && !/pin.*alias === "P1"/i.test(coachSrc));
}

// ── §65 — static firewall on coach.ts ───────────────────────────────────────
{
  check("T51 no Supabase/DB import", !coachSrc.includes("@supabase") && !coachSrc.includes("createClient"));
  check("T52 no database query / Candidate overlay query", !coachSrc.includes(".from(\"") && !coachSrc.includes("professionalIntelligenceCandidates"));
  check("T53 no DraftEnvelope/localStorage write", !coachSrc.includes("DraftEnvelope") && !coachSrc.includes("localStorage"));
  check("T54 no Candidate/Enrichment mutation vocabulary", !coachSrc.includes("accepted_in_module") && !coachSrc.includes("withCandidateStatus") && !coachSrc.includes("composeEffectiveCandidate"));
  // The pre-existing describeProfileContext() documentation legitimately
  // mentions acquireCoachFields() by name in prose (belt-and-suspenders
  // rationale, predating D1C) -- that is not an import or a call. The
  // real invariant D1C must not violate is the import list itself.
  const importLines = coachSrc.match(/^import .*$/gm) ?? [];
  check("T55 coach.ts's import list is unchanged (only a0-extract + structured-profile, no new StructuredProfile/DB/Module import)",
    importLines.length === 2 && importLines[0].includes("./a0-extract") && importLines[1].includes("./structured-profile"));
  check("T56 no CBR reference", !/\bCBR\b/.test(coachSrc));
  check("T57 no Evidence persistence", !coachSrc.includes("Module9") && !coachSrc.includes("\"tengo\""));
  check("T58 no semantic/fuzzy reanchor helper defined", !/function\s+(fuzzyMatch|semanticMatch|reanchor)/i.test(coachSrc));
  check("T59 no automatic acceptance vocabulary", !coachSrc.includes("autoAccept") && !coachSrc.includes("automaticAcceptance"));
}

console.log(failures === 0 ? `\nALL PI-D1C CHECKS PASS` : `\n${failures} PI-D1C CHECK(S) FAILED`);

// ── §60 — route-level tests (deferred to async section below) ──────────────
async function runNetworkTests() {
  // sendCoachTurn end-to-end with a stubbed fetch, confirming the real
  // network wrapper forwards boundedEmploymentContexts into the real
  // buildSystemPrompt/parseCoachResponse pipeline unmodified.
  const realFetch = globalThis.fetch;
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { system?: string };
    const sawP1 = typeof body.system === "string" && body.system.includes("P1") && body.system.includes("Expedia");
    const replyText = sawP1
      ? '---REPLY---\n¿Qué impacto medible tuvo esa migración?\n---FACTS---\n{"fields":{}}\n---NEXT_TOPIC---\n{"mode":"known_employment","alias":"P1"}'
      : '---REPLY---\nHola.\n---FACTS---\n{"fields":{}}\n---NEXT_TOPIC---\n{"mode":"none"}';
    return new Response(JSON.stringify({ content: [{ text: replyText }] }), { status: 200 });
  }) as typeof fetch;

  const result = await sendCoachTurn([], "Lideré la migración en Expedia", "fake-key", undefined, [P1]);
  check("T60 sendCoachTurn forwards boundedEmploymentContexts into the real prompt/parse pipeline end-to-end", result.nextProfessionalTopic.mode === "known_employment");

  globalThis.fetch = realFetch;

  console.log(failures === 0 ? `ALL PI-D1C NETWORK CHECKS PASS` : `${failures} TOTAL PI-D1C CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
runNetworkTests();
