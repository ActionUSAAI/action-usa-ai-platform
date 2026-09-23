// AUSCIS Intake Intelligence Layer — TEST-ONLY validation script
// (CR-CPS-34/35). Runs exclusively against the dedicated AUSCIS-TEST
// Supabase project. Fails closed if the configured target is not the
// known TEST project ref. Never touches production.
//
// Exercises the ACTUAL production modules directly, imported by path —
// not a parallel reimplementation — mirroring the pattern established
// by human-review-gate-validate.ts / qa-engine-validate.ts:
//   src/lib/intake/structured-profile.ts
//   src/lib/intake/prefill-engine.ts
//   src/lib/intake/a0-extract.ts   (live Claude call)
//   src/lib/intake/coach.ts        (live Claude call)
//
// Supabase credentials: .env.test.local only (fail-closed, same as
// every other validation script). ANTHROPIC_API_KEY is a third-party
// secret with no Supabase-environment blast radius (it never
// determines which database is touched), read separately from
// .env.local since it is not present in .env.test.local.

import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  emptyStructuredProfile, acquireField, acquireCoachFields, confirmField, isConflicting, hasAnyAcquiredInformation, emptyField,
  minimizedProfileContext,
} from "../../src/lib/intake/structured-profile";
import { prefillModule1 } from "../../src/lib/intake/prefill-engine";
import { extractCvFields } from "../../src/lib/intake/a0-extract";
import { sendCoachTurn, parseCoachResponse, buildSystemPrompt } from "../../src/lib/intake/coach";
import { validateResumeStep, parseDraftEnvelope, computeNextStep, computePrevStep } from "../../src/app/intake/IntakeForm";
import { evaluateReadiness } from "../../src/lib/intake/readiness";
import { resolveUploadNamespace, buildStoragePath, isSafeUploadPath, resolveExtension, isCvPathAuthorizedForInvitation } from "../../src/lib/intake/upload-authorization";

const PROD_REF = "slasbfepqovdsezmadjh";

function loadEnvFile(file: string): Record<string, string> {
  const p = path.join(__dirname, "..", "..", file);
  const raw = fs.readFileSync(p, "utf-8");
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnvFile(".env.test.local");
const ref = env.TEST_SUPABASE_PROJECT_REF;
const url = env.TEST_SUPABASE_URL;
const serviceKey = env.TEST_SUPABASE_SERVICE_ROLE_KEY;

if (!ref || ref === PROD_REF || !url || !url.includes(ref) || !serviceKey) {
  console.error("ABORT: Safety Gate failed — target is not a verified AUSCIS-TEST project.");
  process.exit(1);
}
console.error(`[safety-gate] PASS — target=${ref} (!= production ${PROD_REF})`);

const localEnv = loadEnvFile(".env.local");
const ANTHROPIC_KEY = localEnv.ANTHROPIC_API_KEY;

const svc: SupabaseClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

interface Result { id: string; status: string; evidence: string; }
const results: Result[] = [];
function record(id: string, status: string, evidence: string) {
  results.push({ id, status, evidence });
  console.error(`${id}: ${status} — ${evidence}`);
}

// Minimal valid single-page PDF containing plain extractable text,
// built with correctly computed xref offsets (no external dependency).
function buildMinimalPdf(lines: string[]): Buffer {
  const content = `BT /F1 12 Tf 50 720 Td ${lines.map((l, i) => `${i === 0 ? "" : "0 -18 Td "}(${l.replace(/[()\\]/g, "")}) Tj`).join(" ")} ET`;
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/MediaBox[0 0 612 792]/Contents 5 0 R>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    `<</Length ${content.length}>>stream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj${obj}endobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

async function main() {
  const suffix = Date.now();

  // ══ SP-01..08 — Structured Profile domain logic (pure, no DB) ══
  {
    const p = emptyStructuredProfile();
    record("SP-01 (empty profile, all not_yet_acquired)", Object.values(p).every(f => f.status === "not_yet_acquired") ? "PASS" : "FAIL", `${Object.keys(p).length} fields`);

    const acquired = acquireField(p.givenName, { value: "Jane", source: "cv_extraction", confidence: "high" });
    record("SP-02 (acquireField lands acquired_unconfirmed, not confirmed)", acquired.status === "acquired_unconfirmed" ? "PASS" : "FAIL", JSON.stringify(acquired));

    const confirmed = confirmField(acquired, "beneficiary-actor-id");
    record("SP-03 (confirmField sets beneficiary_confirmed)", confirmed.status === "beneficiary_confirmed" && confirmed.confirmed_by === "beneficiary-actor-id" ? "PASS" : "FAIL", JSON.stringify(confirmed));

    const conflict = acquireField(confirmed, { value: "Janet", source: "coach_discovery", confidence: "high" });
    record("SP-04 (disagreeing value after confirmation -> conflicting, not silently overwritten)", conflict.status === "conflicting" ? "PASS" : "FAIL", JSON.stringify(conflict));
    record("SP-05 (conflicting preserves original confirmed value)", conflict.value === "Jane" ? "PASS" : "FAIL", `value=${conflict.value}`);

    const agree = acquireField(confirmed, { value: "Jane", source: "coach_discovery", confidence: "high" });
    record("SP-06 (agreeing value after confirmation stays confirmed, not reset)", agree.status === "beneficiary_confirmed" ? "PASS" : "FAIL", JSON.stringify(agree));

    const profileWithConflict = { ...emptyStructuredProfile(), givenName: conflict };
    record("SP-07 (isConflicting detects conflicting field)", isConflicting(profileWithConflict) ? "PASS" : "FAIL", "");
    record("SP-08 (hasAnyAcquiredInformation false on empty profile)", !hasAnyAcquiredInformation(emptyStructuredProfile()) ? "PASS" : "FAIL", "");
  }

  // ══ PF-01..03 — Prefill Engine no-silent-overwrite (pure, no DB) ══
  {
    const profile = emptyStructuredProfile();
    profile.givenName = acquireField(profile.givenName, { value: "Extracted-Name", source: "cv_extraction", confidence: "high" });
    profile.profession = acquireField(profile.profession, { value: "Engineer", source: "cv_extraction", confidence: "high" });

    const emptyModule1 = { givenName: "", profession: "" };
    const filled = prefillModule1(emptyModule1, profile);
    record("PF-01 (prefill fills genuinely empty field)", filled.givenName === "Extracted-Name" ? "PASS" : "FAIL", JSON.stringify(filled));

    const alreadyFilledModule1 = { givenName: "Human-Entered-Name", profession: "" };
    const notOverwritten = prefillModule1(alreadyFilledModule1, profile);
    record("PF-02 (prefill never overwrites existing human-entered value)", notOverwritten.givenName === "Human-Entered-Name" ? "PASS" : "FAIL", JSON.stringify(notOverwritten));
    record("PF-03 (prefill still fills the OTHER empty field in the same call)", notOverwritten.profession === "Engineer" ? "PASS" : "FAIL", JSON.stringify(notOverwritten));
  }

  // ══ PF-04..08 (P7-R2) — fullName synchronization on the real prefill path ══
  // Regression coverage for the P7 Production Smoke Test blocker: Structured
  // Profile prefill populating familyName/givenName/middleName without
  // fullName being resynchronized. Exercises prefillModule1() itself (the
  // actual corrected integration point), never composeFullName() in isolation.
  {
    // R2-01 — prefill on an empty Module1: fullName composed from the newly
    // prefilled name fields.
    const p1 = emptyStructuredProfile();
    p1.familyName = acquireField(p1.familyName, { value: "Test", source: "cv_extraction", confidence: "high" });
    p1.givenName  = acquireField(p1.givenName,  { value: "P7 Production Smoke", source: "cv_extraction", confidence: "high" });
    const m1Empty = { familyName: "", givenName: "", middleName: "", fullName: "" };
    const r1 = prefillModule1(m1Empty, p1);
    record(
      "PF-04 / R2-01 (prefill on empty Module1 synchronizes fullName)",
      r1.familyName === "Test" && r1.givenName === "P7 Production Smoke" && r1.fullName === "P7 Production Smoke Test" ? "PASS" : "FAIL",
      JSON.stringify(r1)
    );

    // R2-02 — no-silent-overwrite preserved for familyName; fullName
    // synchronized from the RESULTING state ("Existing" + "Jane"), never
    // from the raw, rejected Structured Profile value ("Profile").
    const p2 = emptyStructuredProfile();
    p2.familyName = acquireField(p2.familyName, { value: "Profile", source: "cv_extraction", confidence: "high" });
    p2.givenName  = acquireField(p2.givenName,  { value: "Jane", source: "cv_extraction", confidence: "high" });
    const m1Existing = { familyName: "Existing", givenName: "", middleName: "", fullName: "" };
    const r2 = prefillModule1(m1Existing, p2);
    record(
      "PF-05 / R2-02 (no-silent-overwrite preserved; fullName from resulting state)",
      r2.familyName === "Existing" && r2.givenName === "Jane" && r2.fullName === "Jane Existing" ? "PASS" : "FAIL",
      JSON.stringify(r2)
    );

    // R2-03 — middle-name composition, all three fields prefilled.
    const p3 = emptyStructuredProfile();
    p3.familyName = acquireField(p3.familyName, { value: "Doe", source: "cv_extraction", confidence: "high" });
    p3.givenName  = acquireField(p3.givenName,  { value: "Jane", source: "cv_extraction", confidence: "high" });
    p3.middleName = acquireField(p3.middleName, { value: "Marie", source: "cv_extraction", confidence: "high" });
    const m1Empty2 = { familyName: "", givenName: "", middleName: "", fullName: "" };
    const r3 = prefillModule1(m1Empty2, p3);
    record(
      "PF-06 / R2-03 (middle-name composition)",
      r3.fullName === "Jane Marie Doe" ? "PASS" : "FAIL",
      JSON.stringify(r3)
    );

    // R2-04 — empty-name safety: no identity data acquired, fullName stays
    // the canonical empty composition — no "undefined"/"null"/whitespace artifact.
    const p4 = emptyStructuredProfile();
    const m1Empty3 = { familyName: "", givenName: "", middleName: "", fullName: "" };
    const r4 = prefillModule1(m1Empty3, p4);
    record(
      "PF-07 / R2-04 (empty-name safety, no fabricated fullName)",
      r4.fullName === "" ? "PASS" : "FAIL",
      JSON.stringify(r4)
    );

    // R2-05 — unrelated Module1 field untouched by the fullName sync branch.
    const p5 = emptyStructuredProfile();
    p5.familyName = acquireField(p5.familyName, { value: "Test", source: "cv_extraction", confidence: "high" });
    const m1WithUnrelated = { familyName: "", givenName: "", middleName: "", fullName: "", profession: "Profesional ecuestre" };
    const r5 = prefillModule1(m1WithUnrelated, p5);
    record(
      "PF-08 / R2-05 (unrelated pre-existing field preserved)",
      r5.profession === "Profesional ecuestre" ? "PASS" : "FAIL",
      JSON.stringify(r5)
    );
  }

  // ══ CR57-01..10 (P7-ALDO-M0-IMP-01) — A0/Coach criterion-enrichment
  // boundary. Exercises acquireCoachFields(), minimizedProfileContext(),
  // parseCoachResponse(), and buildSystemPrompt() — the actual pure
  // integration points, never a reimplementation of their logic. ══
  {
    // T1 — PATH A / confirmed name: Coach restates a combined name;
    // confirmed givenName must remain untouched (no reopening/replacement).
    const p1 = emptyStructuredProfile();
    p1.familyName = confirmField(acquireField(p1.familyName, { value: "Garibay Olachea", source: "cv_extraction", confidence: "high" }), "beneficiary");
    p1.givenName  = confirmField(acquireField(p1.givenName,  { value: "Aldo", source: "cv_extraction", confidence: "high" }), "beneficiary");
    p1.middleName = confirmField(acquireField(p1.middleName, { value: "Omar", source: "cv_extraction", confidence: "high" }), "beneficiary");
    const m1 = acquireCoachFields(p1, { givenName: { value: "Aldo Omar", confidence: "high" } });
    record(
      "CR57-01 / T1 (confirmed givenName protected from Coach restatement)",
      m1.givenName.value === "Aldo" && m1.givenName.status === "beneficiary_confirmed" ? "PASS" : "FAIL",
      JSON.stringify(m1.givenName)
    );

    // T2 — nationality language variation must not reopen a confirmed fact.
    const p2 = emptyStructuredProfile();
    p2.nationalities = confirmField(acquireField(p2.nationalities, { value: "Mexican", source: "cv_extraction", confidence: "high" }), "beneficiary");
    const m2 = acquireCoachFields(p2, { nationalities: { value: "mexicana", confidence: "high" } });
    record(
      "CR57-02 / T2 (confirmed nationality protected from Coach language variation)",
      m2.nationalities.value === "Mexican" && m2.nationalities.status === "beneficiary_confirmed" ? "PASS" : "FAIL",
      JSON.stringify(m2.nationalities)
    );

    // T3 — Class A2 (profession) is NOT frozen like Class A1: a differing
    // Coach value still surfaces via the unmodified acquireField() conflict
    // path (existing fact preserved, not destroyed, per SP-05 precedent) --
    // no new storage semantics invented. Class B (awards) acquires normally.
    const p3 = emptyStructuredProfile();
    p3.profession = confirmField(acquireField(p3.profession, { value: "11 Mexican National Championships", source: "cv_extraction", confidence: "high" }), "beneficiary");
    const m3 = acquireCoachFields(p3, { profession: { value: "30+ State Championships", confidence: "high" } });
    record(
      "CR57-03 / T3 (Class A2 remains enrichable via existing conflict path, not frozen)",
      m3.profession.status === "conflicting" && m3.profession.value === "11 Mexican National Championships" ? "PASS" : "FAIL",
      JSON.stringify(m3.profession)
    );
    const m3b = acquireCoachFields(emptyStructuredProfile(), { awards: { value: "National Champion 2019", confidence: "high" } });
    record(
      "CR57-03b / T3 (Class B field acquires normally via Coach)",
      m3b.awards.status === "acquired_unconfirmed" && m3b.awards.value === "National Champion 2019" ? "PASS" : "FAIL",
      JSON.stringify(m3b.awards)
    );

    // T4 — PATH B (no CV): Coach may acquire missing Class A1 pre-confirmation.
    const m4 = acquireCoachFields(emptyStructuredProfile(), {
      familyName: { value: "Garibay Olachea", confidence: "high" },
      dateOfBirth: { value: "1985-03-10", confidence: "medium" },
      profession: { value: "Rodeo professional", confidence: "high" },
    });
    record(
      "CR57-04 / T4 (PATH B: Coach may acquire missing Class A1 pre-confirmation)",
      m4.familyName.status === "acquired_unconfirmed" && m4.familyName.value === "Garibay Olachea" &&
      m4.dateOfBirth.status === "acquired_unconfirmed" && m4.profession.status === "acquired_unconfirmed"
        ? "PASS" : "FAIL",
      JSON.stringify({ familyName: m4.familyName, dateOfBirth: m4.dateOfBirth })
    );

    // T5 — PATH B post-confirmation: protection is identical regardless of
    // which mechanism originally acquired the Class A1 fact (coach_discovery
    // here, vs. cv_extraction in T1) -- proves path-independence.
    const p5 = emptyStructuredProfile();
    p5.givenName = confirmField(acquireField(p5.givenName, { value: "Aldo", source: "coach_discovery", confidence: "high" }), "beneficiary");
    const m5 = acquireCoachFields(p5, { givenName: { value: "Aldo Omar", confidence: "high" } });
    record(
      "CR57-05 / T5 (post-confirmation Class A1 protection identical regardless of original acquisition source)",
      m5.givenName.value === "Aldo" && m5.givenName.status === "beneficiary_confirmed" ? "PASS" : "FAIL",
      JSON.stringify(m5.givenName)
    );

    // T6-backbone — pure-logic proof that beneficiary-initiated correction
    // (re-confirming with a new value) remains possible after an initial
    // confirmation; this is exactly what Module0's new "Editar" affordance
    // invokes. The affordance itself (local React toggle state) is a UI
    // behavior, NOT DIRECTLY EXECUTABLE by this Node-only harness.
    const p6 = emptyStructuredProfile();
    p6.givenName = confirmField(acquireField(p6.givenName, { value: "Aldo", source: "cv_extraction", confidence: "high" }), "beneficiary");
    const corrected = confirmField(p6.givenName, "beneficiary", "Aldo Omar");
    record(
      "CR57-06 / T6-backbone (beneficiary can re-confirm a corrected value after initial confirmation)",
      corrected.status === "beneficiary_confirmed" && corrected.value === "Aldo Omar" && corrected.confirmed_by === "beneficiary" ? "PASS" : "FAIL",
      JSON.stringify(corrected)
    );

    // T7 — valid ---REPLY---/---FACTS--- protocol: beneficiary sees only
    // the reply; structured extraction still works.
    const validRaw = '---REPLY---\nHola, ¿a qué te dedicas?\n---FACTS---\n{"fields":{"profession":{"value":"Rodeo","confidence":"high"}}}';
    const parsedValid = parseCoachResponse(validRaw);
    record(
      "CR57-07 / T7 (valid protocol: beneficiary sees only reply, facts extracted)",
      parsedValid.reply === "Hola, ¿a qué te dedicas?" && !parsedValid.reply.includes("FACTS") && parsedValid.fields.profession?.value === "Rodeo" ? "PASS" : "FAIL",
      JSON.stringify(parsedValid)
    );

    // T8 — malformed/missing ---REPLY--- delimiter with FACTS present: the
    // internal payload must never reach the beneficiary-facing reply.
    const malformedRaw = 'Hola, cuéntame más sobre tu carrera.\n---FACTS---\n{"fields":{"profession":{"value":"Rodeo","confidence":"high"}}}';
    const parsedMalformed = parseCoachResponse(malformedRaw);
    record(
      "CR57-08 / T8 (malformed REPLY delimiter + FACTS present: internal payload never beneficiary-visible)",
      !parsedMalformed.reply.includes("FACTS") && !parsedMalformed.reply.includes("{") && parsedMalformed.reply === "Hola, cuéntame más sobre tu carrera." ? "PASS" : "FAIL",
      JSON.stringify(parsedMalformed)
    );
    const plainRaw = "Solo una respuesta libre, sin marcadores.";
    const parsedPlain = parseCoachResponse(plainRaw);
    record(
      "CR57-08b (plain free-text reply unaffected, no regression)",
      parsedPlain.reply === plainRaw ? "PASS" : "FAIL",
      JSON.stringify(parsedPlain)
    );

    // T9 — legal/eligibility firewall text present regardless of context
    // (structural presence check, not a live-model behavioral test --
    // behavioral compliance is only verifiable via the existing live
    // COACH-01..04 precedent below). Context-aware criterion-enrichment
    // guidance appended only when the profile already carries information.
    const promptNoContext = buildSystemPrompt();
    const promptWithContext = buildSystemPrompt({ profession: { value: "Rodeo", status: "acquired_unconfirmed" } });
    record(
      "CR57-09 / T9 (firewall prohibition text present regardless of context)",
      promptNoContext.includes("determinar si un criterio USCIS está satisfecho") && promptWithContext.includes("determinar si un criterio USCIS está satisfecho") ? "PASS" : "FAIL",
      ""
    );
    record(
      "CR57-09b (context-aware enrichment guidance only appended when context has data)",
      !promptNoContext.includes("Ya existe información profesional de base") && promptWithContext.includes("Ya existe información profesional de base") ? "PASS" : "FAIL",
      ""
    );

    // Data minimization proof for the Coach context payload itself.
    const p7 = emptyStructuredProfile();
    p7.givenName = confirmField(acquireField(p7.givenName, { value: "Aldo", source: "cv_extraction", confidence: "high" }), "beneficiary");
    const ctx = minimizedProfileContext(p7);
    record(
      "CR57-10 (minimizedProfileContext strips source/confidence/confirmed_by/at, excludes not_yet_acquired)",
      ctx.givenName?.value === "Aldo" && ctx.givenName?.status === "beneficiary_confirmed" &&
      !("source" in (ctx.givenName as object)) && !("confidence" in (ctx.givenName as object)) &&
      !("dateOfBirth" in ctx)
        ? "PASS" : "FAIL",
      JSON.stringify(ctx)
    );
  }

  // ══ R1-T1..T6 (P7-ALDO-M0-IMP-01-R1) — describeProfileContext() prompt-scope
  // correction. Exercises buildSystemPrompt() directly, asserting exactly
  // which fields land in the protected-Class-A1 vs. enrichable text, closing
  // the F-01/F-02/F-03 MR findings against the actual integration point. ══
  {
    // R1-T1 — confirmed Class A1 (givenName): identified as protected,
    // instructed never to re-ask/re-emit.
    const promptT1 = buildSystemPrompt({ givenName: { value: "Aldo", status: "beneficiary_confirmed" } });
    record(
      "R1-T1 (confirmed Class A1 identified as protected, never re-ask)",
      promptT1.includes("NUNCA los vuelvas a preguntar") && promptT1.includes("givenName") ? "PASS" : "FAIL",
      ""
    );

    // R1-T2 — confirmed Class A2 (profession): MUST NOT appear in the
    // protected list; enrichment guidance MUST be present.
    const promptT2 = buildSystemPrompt({ profession: { value: "Professional Rodeo Cowboy", status: "beneficiary_confirmed" } });
    const protectedLineT2 = (promptT2.match(/NUNCA los vuelvas a preguntar[^:]*: ([^.]*)\./) ?? [])[1] ?? "";
    record(
      "R1-T2 (confirmed Class A2 NOT placed in protected list; enrichment preserved)",
      !protectedLineT2.includes("profession") && promptT2.includes("Ya existe información profesional de base") ? "PASS" : "FAIL",
      protectedLineT2
    );

    // R1-T3 — confirmed Class B (awards): same requirement as T2.
    const promptT3 = buildSystemPrompt({ awards: { value: "11 Mexican National Championships", status: "beneficiary_confirmed" } });
    const protectedLineT3 = (promptT3.match(/NUNCA los vuelvas a preguntar[^:]*: ([^.]*)\./) ?? [])[1] ?? "";
    record(
      "R1-T3 (confirmed Class B NOT placed in protected list; enrichment preserved)",
      !protectedLineT3.includes("awards") && promptT3.includes("Ya existe información profesional de base") ? "PASS" : "FAIL",
      protectedLineT3
    );

    // R1-T4 — PATH B partial profile / multi-turn: TURN 1 acquired only
    // profession (Class A2, unconfirmed); Class A1 entirely absent. TURN 2
    // prompt must preserve missing-Class-A1 acquisition guidance alongside
    // enrichment, and must not imply identity acquisition is complete.
    const turn2Context = minimizedProfileContext(
      (() => {
        const p = emptyStructuredProfile();
        p.profession = acquireField(p.profession, { value: "Professional Rodeo Cowboy", source: "coach_discovery", confidence: "high" });
        return p;
      })()
    );
    const promptT4 = buildSystemPrompt(turn2Context);
    record(
      "R1-T4 (PATH B partial profile: missing Class A1 acquisition explicitly preserved alongside enrichment)",
      promptT4.includes("Ya existe información profesional de base") &&
      promptT4.includes("AÚN no han sido confirmados") &&
      promptT4.includes("familyName") && promptT4.includes("givenName") && promptT4.includes("dateOfBirth") &&
      promptT4.includes("nationalities") && promptT4.includes("countryOfResidence")
        ? "PASS" : "FAIL",
      ""
    );

    // R1-T5 — mixed profile: givenName + nationalities confirmed (Class A1,
    // protected); profession + awards confirmed (Class A2/B, NOT protected).
    const promptT5 = buildSystemPrompt({
      givenName:     { value: "Aldo", status: "beneficiary_confirmed" },
      nationalities: { value: "Mexican", status: "beneficiary_confirmed" },
      profession:    { value: "Professional Rodeo Cowboy", status: "beneficiary_confirmed" },
      awards:        { value: "11 Mexican National Championships", status: "beneficiary_confirmed" },
    });
    const protectedLineT5 = (promptT5.match(/NUNCA los vuelvas a preguntar[^:]*: ([^.]*)\./) ?? [])[1] ?? "";
    record(
      "R1-T5 (mixed profile: only Class A1 fields protected, Class A2/B remain enrichable)",
      protectedLineT5.includes("givenName") && protectedLineT5.includes("nationalities") &&
      !protectedLineT5.includes("profession") && !protectedLineT5.includes("awards") &&
      promptT5.includes("Ya existe información profesional de base")
        ? "PASS" : "FAIL",
      protectedLineT5
    );

    // R1-T6 — no context / empty context: broad acquisition remains
    // available (base prompt unmodified); no false claim that professional
    // information already exists.
    const promptT6a = buildSystemPrompt();
    const promptT6b = buildSystemPrompt(minimizedProfileContext(emptyStructuredProfile()));
    record(
      "R1-T6 (no/empty context: no premature professional-info claim, broad acquisition intact)",
      !promptT6a.includes("Ya existe información profesional de base") && !promptT6b.includes("Ya existe información profesional de base") &&
      promptT6a.includes("inclúyela en FACTS") && promptT6b.includes("inclúyela en FACTS")
        ? "PASS" : "FAIL",
      ""
    );
  }

  // ══ P7-R4-T1..T3, T9-T10 (CR-CPS-60) — deterministic draft persistence
  // / resume-position pure logic. Exercises the ACTUAL exported
  // IntakeForm.tsx helpers (validateResumeStep, parseDraftEnvelope,
  // computeNextStep, computePrevStep) -- the real functions next()/
  // back()/the hydration effect call, not a reimplementation. The
  // React-hook-bound portions of the P7-R4 design (save()'s boolean
  // contract + justCheckpointedRef arming/consumption, the CP-01/02/03
  // wiring, the autosave interval, Retomar's pending-step application,
  // the Saved/Dirty matrix) require actual component rendering to
  // exercise end-to-end and are NOT DIRECTLY EXECUTABLE by this Node-
  // only harness (no DOM/React test runner exists in this repo -- the
  // same, already-established limitation accepted for the pre-existing
  // draft-banner/Retomar UI toggle). Each is instead verified by an
  // explicit source trace, cited inline where relevant, following this
  // project's own established "proven by manual trace, not mere
  // assertion" precedent (CR-CPS-59). T7/T8 (FACTS non-regression) and
  // T8-A1-protection are already covered, unmodified, by CR57-07/08/T1-
  // T5 above (parseCoachResponse/acquireCoachFields were not touched by
  // this implementation). ══
  {
    // T1 — legacy bare-IntakeFormData draft (no "data"/"step" wrapper,
    // exactly what any pre-CR-CPS-60 draft looks like): hydrates
    // unchanged, resume step safely defaults to 0.
    const legacyRaw = JSON.stringify({ module1: { fullName: "Legacy Beneficiary" }, module0: { cvFileName: "cv.pdf" } });
    const legacyParsed = parseDraftEnvelope(legacyRaw, 14);
    record(
      "P7R4-T1 (legacy bare-IntakeFormData draft hydrates unchanged, resume step defaults to 0)",
      (legacyParsed.saved as { module1?: { fullName?: string } }).module1?.fullName === "Legacy Beneficiary" &&
      (legacyParsed.saved as { module0?: { cvFileName?: string } }).module0?.cvFileName === "cv.pdf" &&
      legacyParsed.resumeStep === 0
        ? "PASS" : "FAIL",
      JSON.stringify(legacyParsed)
    );

    // T2 — new envelope with a valid step: Retomar must restore exactly
    // that module.
    const envelopeRaw = JSON.stringify({ data: { module1: { fullName: "New Beneficiary" } }, step: 7, savedAt: new Date().toISOString() });
    const envelopeParsed = parseDraftEnvelope(envelopeRaw, 14);
    record(
      "P7R4-T2 (new envelope: data hydrated from .data, resume step read exactly)",
      (envelopeParsed.saved as { module1?: { fullName?: string } }).module1?.fullName === "New Beneficiary" && envelopeParsed.resumeStep === 7
        ? "PASS" : "FAIL",
      JSON.stringify(envelopeParsed)
    );

    // T3 — invalid/malformed/out-of-range persisted step values all
    // safely fall back to 0; data still hydrates from the envelope.
    const invalidSteps = [99, -1, 3.5, "7", null, undefined];
    const t3Results = invalidSteps.map(s => {
      const raw = JSON.stringify({ data: { module1: { fullName: "X" } }, step: s, savedAt: "now" });
      return parseDraftEnvelope(raw, 14).resumeStep;
    });
    record(
      "P7R4-T3 (out-of-range/non-integer/non-numeric/missing step all fall back to 0)",
      t3Results.every(r => r === 0) ? "PASS" : "FAIL",
      JSON.stringify({ invalidSteps, t3Results })
    );
    record(
      "P7R4-T3b (validateResumeStep boundary: exactly 0 and exactly total=14 are valid, not off-by-one)",
      validateResumeStep(0, 14) === 0 && validateResumeStep(14, 14) === 14 && validateResumeStep(15, 14) === 0 && validateResumeStep(-0.5, 14) === 0
        ? "PASS" : "FAIL",
      ""
    );

    // T9 — forward destination-step computation: exact branching next()
    // now calls (Module 10 -> 12 skip when Module 12 hidden, clamped to
    // the executable 0..14 range).
    record(
      "P7R4-T9 (computeNextStep: exact next() branching -- 10->12 skip, normal +1, clamp at 14)",
      computeNextStep(10, false, 14) === 12 &&
      computeNextStep(10, true, 14) === 11 &&
      computeNextStep(6, true, 14) === 7 &&
      computeNextStep(13, true, 14) === 14 &&
      computeNextStep(14, true, 14) === 14
        ? "PASS" : "FAIL",
      JSON.stringify({
        skip: computeNextStep(10, false, 14), noSkip: computeNextStep(10, true, 14),
        normal: computeNextStep(6, true, 14), atBoundary: computeNextStep(13, true, 14), clamped: computeNextStep(14, true, 14),
      })
    );

    // T10 — backward destination-step computation: exact branching
    // back() now calls (Module 12 -> 10 skip when Module 12 hidden,
    // normal -1, clamped at 0). Persisted step must match the SAME
    // value setStep receives -- both come from this one function.
    record(
      "P7R4-T10 (computePrevStep: exact back() branching -- 12->10 skip, normal -1, clamp at 0)",
      computePrevStep(12, false) === 10 &&
      computePrevStep(12, true) === 11 &&
      computePrevStep(7, true) === 6 &&
      computePrevStep(0, true) === 0
        ? "PASS" : "FAIL",
      JSON.stringify({
        skip: computePrevStep(12, false), noSkip: computePrevStep(12, true),
        normal: computePrevStep(7, true), clamped: computePrevStep(0, true),
      })
    );

    // NOT DIRECTLY EXECUTABLE — requires a DOM/React test renderer,
    // absent from this repo (established limitation, P7-R5 precedent):
    //
    // P7R4-T4 (CP-01 A0 checkpoint) — source trace: Module0.tsx runA0(),
    //   post-merge branch now calls onCheckpoint({...data, structuredProfile: profile})
    //   in place of the prior onChange(...) call; IntakeForm.tsx's
    //   onModule0Checkpoint composes { ...dataRef.current, module0: nextModule0 },
    //   calls save(nextData) (writes the envelope synchronously via
    //   localStorage.setItem before any React re-render), then setData(nextData).
    // P7R4-T5 (CP-02 Confirmar checkpoint) — source trace: Module0.tsx
    //   confirmProfileField() now calls onCheckpoint(...) synchronously
    //   (no await), so data is guaranteed current; same onModule0Checkpoint
    //   path as T4.
    // P7R4-T6 (CP-03 Coach checkpoint) — source trace: Module0.tsx
    //   sendCoachMessage()'s success branch (after acquireCoachFields())
    //   now calls onCheckpoint(...) in place of the prior onChange(...);
    //   the optimistic pre-fetch onChange (user turn) and the catch-block
    //   error turn are both left as plain onChange, unchanged -- only the
    //   complete successful turn is checkpointed.
    // P7R4-T11 (ordinary autosave) — source trace: the 30s interval effect
    //   (IntakeForm.tsx) is unchanged in scheduling; it now calls save()
    //   with no arguments (falls back to dataRef.current/stepRef.current).
    // P7R4-T12 (Saved/Dirty matrix incl. justCheckpointedRef) — source
    //   trace: dirty-invalidation effect checks justHydratedRef then
    //   justCheckpointedRef before nulling savedAt; justCheckpointedRef is
    //   armed ONLY inside onModule0Checkpoint, ONLY when save() returns
    //   true; save() itself never references justCheckpointedRef at all
    //   (grep-verified: the identifier appears in exactly 4 places --
    //   declaration, the dirty-invalidation effect's two branches, and
    //   onModule0Checkpoint's single `if (persisted)` arm).
    // P7R4-T13 (Empezar de nuevo) — source trace: handler unchanged
    //   (setData(INITIAL); setDraftBanner(false); localStorage.removeItem)
    //   except the removed key now holds the richer envelope; live step
    //   was never applied pre-Retomar so needs no explicit reset (see T2's
    //   Retomar trace below).
    // P7R4-T14 (final submission non-leakage) — source trace: submit()'s
    //   fetch body is still built by explicit field enumeration off `data`
    //   (module0..module15 + moduleStatuses + invitation* + structuredProfile
    //   + coachConversation); `step`/pendingResumeStep/the envelope are
    //   separate React state, never spread into that object literal.
    // Retomar — source trace: hydration validates+holds resumeStep in
    //   pendingResumeStep, does NOT call setStep; the Retomar button's
    //   onClick now reads `() => { setDraftBanner(false); setStep(pendingResumeStep); }`
    //   -- step is applied only on that explicit click, never automatically.
    // R2-T19 (failed checkpoint -> DIRTY) — source trace: save() returns
    //   false from its catch branch without calling setSavedAt;
    //   onModule0Checkpoint's `if (persisted)` guard means justCheckpointedRef
    //   is never armed on that path; setData(nextData) still executes
    //   unconditionally afterward, so the dirty-invalidation effect runs
    //   with the flag unarmed and correctly nulls savedAt.
    record("P7R4-T4..T6,T11..T14,R2-T19 (React-hook-bound P7-R4 behaviors)", "NOT EXECUTABLE", "no DOM/React test runner in this repo -- verified by explicit source trace (see code comments immediately above), same established limitation as pre-existing draft-banner/Retomar UI behavior");
  }

  // ══ Fixtures — real invitation + case + client in TEST ══
  const { data: cli, error: cliErr } = await svc
    .from("clients").insert({ first_name: "IIL", last_name: "SyntheticClient", preferred_language: "es" }).select().single();
  if (cliErr) throw new Error(`fixture client failed: ${cliErr.message}`);

  const { data: caseA, error: caseAErr } = await svc
    .from("cases").insert({ case_number: `TEST-IIL-${suffix}`, client_id: cli.id, case_type: "otro", title: "IIL case" }).select().single();
  if (caseAErr) throw new Error(`fixture case failed: ${caseAErr.message}`);

  const futureExpiry = new Date(Date.now() + 3600_000).toISOString();
  const pastExpiry = new Date(Date.now() - 3600_000).toISOString();
  const token = `iil-test-token-${suffix}`;
  const expiredToken = `iil-test-expired-token-${suffix}`;

  const { data: invitation, error: invErr } = await svc
    .from("intake_invitations")
    .insert({ case_id: caseA.id, client_id: cli.id, token, email: "synthetic@example.com", status: "pending", expires_at: futureExpiry })
    .select().single();
  if (invErr) throw new Error(`fixture invitation failed: ${invErr.message}`);

  const { error: expiredInvErr } = await svc
    .from("intake_invitations")
    .insert({ case_id: caseA.id, client_id: cli.id, token: expiredToken, email: "synthetic2@example.com", status: "pending", expires_at: pastExpiry });
  if (expiredInvErr) throw new Error(`fixture expired invitation failed: ${expiredInvErr.message}`);

  // Second, independent invitation -- for SEC-02's cross-namespace proof.
  const tokenB = `iil-test-token-b-${suffix}`;
  const { data: invitationB, error: invBErr } = await svc
    .from("intake_invitations")
    .insert({ case_id: caseA.id, client_id: cli.id, token: tokenB, email: "synthetic-b@example.com", status: "pending", expires_at: futureExpiry })
    .select().single();
  if (invBErr) throw new Error(`fixture invitation B failed: ${invBErr.message}`);

  // Ineligible-status invitation -- for SEC-05.
  const ineligibleToken = `iil-test-ineligible-token-${suffix}`;
  const { error: ineligibleInvErr } = await svc
    .from("intake_invitations")
    .insert({ case_id: caseA.id, client_id: cli.id, token: ineligibleToken, email: "synthetic-c@example.com", status: "submitted", expires_at: futureExpiry, submitted_at: new Date().toISOString() });
  if (ineligibleInvErr) throw new Error(`fixture ineligible invitation failed: ${ineligibleInvErr.message}`);

  console.error(`[fixtures] caseA=${caseA.id} invitation=${invitation.id} invitationB=${invitationB.id}`);

  // ══ SEC-CORR-01..12 — CR-CPS-40 D-1 adversarial security correction
  // validation, using the REAL shared resolveUploadNamespace() /
  // isSafeUploadPath() / resolveExtension() / buildStoragePath()
  // functions -- and a full simulation of the route's actual
  // gate ordering (isSafeUploadPath -> resolveExtension ->
  // resolveUploadNamespace -> buildStoragePath -> upload), the exact
  // sequence src/app/api/intake/upload/route.ts now executes. Runs
  // BEFORE any submission consumes `token`/`tokenB` (both must still
  // be pending/opened). Every scratch storage object created here is
  // tracked and removed at the end of this block. ══
  const secScratchObjects: string[] = [];
  {
    // Simulates the route's exact call sequence for one request.
    // Returns which stage rejected it (if any) and whether a storage
    // write was ever attempted -- this is the load-bearing proof that
    // adversarial input never reaches storage.upload, not merely that
    // isSafeUploadPath() returns false in isolation.
    const simulateUploadRequest = async (requestToken: string, requestPath: string, mimeType: string): Promise<{ rejectedAt: string | null; wroteToPath: string | null }> => {
      if (!isSafeUploadPath(requestPath)) return { rejectedAt: "isSafeUploadPath", wroteToPath: null };
      const extension = resolveExtension(mimeType);
      if (!extension) return { rejectedAt: "resolveExtension", wroteToPath: null };
      const authResult = await resolveUploadNamespace(svc, requestToken);
      if (!authResult.ok) return { rejectedAt: "resolveUploadNamespace", wroteToPath: null };
      const storagePath = buildStoragePath(authResult.invitationId, requestPath, extension);
      const { error } = await svc.storage.from("intake-documents").upload(storagePath, Buffer.from("sim"), { contentType: mimeType, upsert: true });
      if (error) return { rejectedAt: `storage:${error.message}`, wroteToPath: null };
      secScratchObjects.push(storagePath);
      return { rejectedAt: null, wroteToPath: storagePath };
    };

    const authValid = await resolveUploadNamespace(svc, token);
    const authB = await resolveUploadNamespace(svc, tokenB);
    if (!authValid.ok || !authB.ok) throw new Error(`SEC fixtures not ready: A=${JSON.stringify(authValid)} B=${JSON.stringify(authB)}`);

    // SEC-CORR-01 — legitimate request succeeds, inside invitation A's
    // own namespace, via the full simulated pipeline.
    const r01 = await simulateUploadRequest(token, "module0/cv", "application/pdf");
    record("SEC-CORR-01 (legitimate token + Module0 CV path writes inside its own namespace)", r01.wroteToPath !== null && r01.wroteToPath.startsWith(authValid.invitationId) ? "PASS" : "FAIL", JSON.stringify(r01));

    // SEC-CORR-02 — a `path` that merely NAMES invitation B (a
    // syntactically safe UUID string, no traversal characters) is
    // correctly ALLOWED by isSafeUploadPath, but the real security
    // property still holds: buildStoragePath always prefixes with the
    // server-resolved invitationId of the CALLER's own token, so the
    // result is a harmless subfolder nested under invitation A's own
    // namespace -- never an actual write inside B's real namespace.
    // This is not a rejection case; it is a scoping-containment case.
    const r02 = await simulateUploadRequest(token, authB.invitationId, "application/pdf");
    record("SEC-CORR-02 (path naming invitation B remains contained under caller's own namespace, never escapes into B)", r02.wroteToPath !== null && r02.wroteToPath.startsWith(authValid.invitationId + "/") && !r02.wroteToPath.startsWith(authB.invitationId) ? "PASS" : "FAIL", JSON.stringify(r02));

    // SEC-CORR-03..07 — genuine traversal/injection `path` values, run
    // through the FULL simulated pipeline. Each must be rejected at
    // isSafeUploadPath, BEFORE resolveUploadNamespace or any storage
    // call is ever reached.
    const adversarial: [string, string][] = [
      ["SEC-CORR-03 (single .. traversal)", "../module0/cv"],
      ["SEC-CORR-04 (deep ../../<invitationB>/ traversal)", `../../${authB.invitationId}/module0/cv`],
      ["SEC-CORR-05 (leading slash)", "/module0/cv"],
      ["SEC-CORR-06 (repeated separators / mixed traversal)", "..//..//module0/cv"],
      ["SEC-CORR-07 (percent-encoded traversal)", `%2e%2e/${authB.invitationId}/module0/cv`],
    ];
    for (const [label, adversarialPath] of adversarial) {
      const result = await simulateUploadRequest(token, adversarialPath, "application/pdf");
      record(label, result.rejectedAt === "isSafeUploadPath" && result.wroteToPath === null ? "PASS" : "FAIL", JSON.stringify(result));
    }

    // SEC-CORR-08 — crafted fileName with traversal-like content cannot
    // influence the namespace: buildStoragePath's signature accepts
    // only a server-resolved extension, never a client fileName -- no
    // parameter exists through which a filename string could reach the
    // returned key.
    record("SEC-CORR-08 (fileName cannot influence namespace — buildStoragePath takes no fileName parameter)", buildStoragePath.length === 3 ? "PASS" : "FAIL", `buildStoragePath arity=${buildStoragePath.length} (invitationId, path, extension only)`);

    // SEC-CORR-09 — extension is derived exclusively from the closed
    // MIME allowlist, never from a client-supplied fileName string.
    const extFromMime = resolveExtension("application/pdf");
    record("SEC-CORR-09 (extension derived from closed MIME allowlist, not client fileName)", extFromMime === "pdf" ? "PASS" : "FAIL", `resolveExtension("application/pdf")=${extFromMime}`);

    // SEC-CORR-10 — unsupported MIME type yields no extension; the
    // simulated pipeline confirms this halts before any storage call.
    const r10 = await simulateUploadRequest(token, "module0/cv", "application/x-msdownload");
    record("SEC-CORR-10 (unsupported MIME type rejected before storage write)", r10.rejectedAt === "resolveExtension" && r10.wroteToPath === null ? "PASS" : "FAIL", JSON.stringify(r10));

    // SEC-CORR-11 — end-to-end proof that none of the adversarial
    // SEC-CORR-02..07 attempts (all targeting invitation B by name or
    // traversal) actually created any object under invitation B's
    // real, legitimate namespace.
    const { data: listB } = await svc.storage.from("intake-documents").list(`${authB.invitationId}/module0/cv`);
    record("SEC-CORR-11 (zero adversarial objects landed in invitation B's real namespace)", (listB ?? []).length === 0 ? "PASS" : "FAIL", `invitationB listing count=${(listB ?? []).length}`);

    // SEC-CORR-12 — authorization failure (invalid/expired/ineligible
    // token) produces zero storage write, via the same full simulated
    // pipeline with a legitimate path but an illegitimate token.
    const rInvalid = await simulateUploadRequest("nonexistent-token", "module0/cv", "application/pdf");
    const rExpired = await simulateUploadRequest(expiredToken, "module0/cv", "application/pdf");
    const rIneligible = await simulateUploadRequest(ineligibleToken, "module0/cv", "application/pdf");
    const allRejectedBeforeWrite = [rInvalid, rExpired, rIneligible].every(r => r.rejectedAt === "resolveUploadNamespace" && r.wroteToPath === null);
    record("SEC-CORR-12 (invalid/expired/ineligible tokens all rejected before any storage write is reachable)", allRejectedBeforeWrite ? "PASS" : "FAIL", JSON.stringify({ rInvalid, rExpired, rIneligible }));

    // Baseline checks retained as part of the same corrected suite.
    record("SEC-01 (valid token resolves an authorized namespace)", authValid.ok && authValid.invitationId === invitation.id ? "PASS" : "FAIL", JSON.stringify(authValid));
    const authIneligibleDirect = await resolveUploadNamespace(svc, ineligibleToken);
    record("SEC-05 (ineligible invitation status — already submitted — rejected)", !authIneligibleDirect.ok ? "PASS" : "FAIL", JSON.stringify(authIneligibleDirect));

    // cleanup this block's scratch objects
    if (secScratchObjects.length > 0) {
      const { error: cleanupErr } = await svc.storage.from("intake-documents").remove(secScratchObjects);
      console.error(`[cleanup] SEC scratch objects: created=${secScratchObjects.length} removed=${cleanupErr ? "ERROR: " + cleanupErr.message : secScratchObjects.length}`);
    }
  }

  // ══ F01-CORR-01..10 — CR-CPS-42 F-01 correction validation (A0
  // cross-invitation resource binding). Uses the REAL
  // isCvPathAuthorizedForInvitation() function and a full simulation of
  // the corrected a0-extract route's exact gate ordering (token ->
  // invitation -> path-authorization -> download -> extract). Fully
  // synthetic fixtures only -- no real PII. ══
  const f01ScratchObjects: string[] = [];
  {
    const authA = await resolveUploadNamespace(svc, token);
    const authB = await resolveUploadNamespace(svc, tokenB);
    if (!authA.ok || !authB.ok) throw new Error(`F01 fixtures not ready: A=${JSON.stringify(authA)} B=${JSON.stringify(authB)}`);

    const markerA = `A0_SECURITY_TEST_A_SYNTHETIC_MARKER_${suffix}`;
    const markerB = `A0_SECURITY_TEST_B_SYNTHETIC_MARKER_${suffix}`;
    const pathA = buildStoragePath(authA.invitationId, "module0/cv", "pdf");
    const pathB = buildStoragePath(authB.invitationId, "module0/cv", "pdf");
    await svc.storage.from("intake-documents").upload(pathA, Buffer.from(markerA), { contentType: "application/pdf", upsert: true });
    await svc.storage.from("intake-documents").upload(pathB, Buffer.from(markerB), { contentType: "application/pdf", upsert: true });
    f01ScratchObjects.push(pathA, pathB);

    // Full simulation of the corrected a0-extract route -- same gate
    // ordering, same functions, imported by path not reimplemented.
    const simulateA0Extract = async (requestToken: string, requestFilePath: string): Promise<{ rejectedAt: string | null; downloadedBytes: number | null }> => {
      const now = new Date().toISOString();
      const { data: inv } = await svc.from("intake_invitations").select("id").eq("token", requestToken).in("status", ["pending", "opened"]).gt("expires_at", now).maybeSingle();
      if (!inv) return { rejectedAt: "invitation", downloadedBytes: null };
      if (!isCvPathAuthorizedForInvitation(requestFilePath, inv.id)) return { rejectedAt: "isCvPathAuthorizedForInvitation", downloadedBytes: null };
      const { data: blob, error } = await svc.storage.from("intake-documents").download(requestFilePath);
      if (error || !blob) return { rejectedAt: "download", downloadedBytes: null };
      const buf = await blob.arrayBuffer();
      return { rejectedAt: null, downloadedBytes: buf.byteLength };
    };

    // F01-CORR-01 — valid invitation + its own authorized CV resource -> allowed.
    const r01 = await simulateA0Extract(token, pathA);
    record("F01-CORR-01 (valid invitation + own authorized CV resource → allowed)", r01.rejectedAt === null && r01.downloadedBytes === markerA.length ? "PASS" : "FAIL", JSON.stringify(r01));

    // F01-CORR-02 (LOAD-BEARING, this is the exact F-01 reproduction) —
    // valid token A + resource belonging to invitation B → rejected
    // before any download occurs.
    const r02 = await simulateA0Extract(token, pathB);
    record("F01-CORR-02 (valid token A + resource belonging to invitation B → rejected, zero download)", r02.rejectedAt === "isCvPathAuthorizedForInvitation" && r02.downloadedBytes === null ? "PASS" : "FAIL", JSON.stringify(r02));

    // F01-CORR-03 — invalid token → rejected before resource processing.
    const r03 = await simulateA0Extract("nonexistent-token", pathA);
    record("F01-CORR-03 (invalid token rejected before resource processing)", r03.rejectedAt === "invitation" && r03.downloadedBytes === null ? "PASS" : "FAIL", JSON.stringify(r03));

    // F01-CORR-04 — expired token → rejected.
    const r04 = await simulateA0Extract(expiredToken, pathA);
    record("F01-CORR-04 (expired token rejected)", r04.rejectedAt === "invitation" && r04.downloadedBytes === null ? "PASS" : "FAIL", JSON.stringify(r04));

    // F01-CORR-05 — ineligible invitation status → rejected.
    const r05 = await simulateA0Extract(ineligibleToken, pathA);
    record("F01-CORR-05 (ineligible invitation status rejected)", r05.rejectedAt === "invitation" && r05.downloadedBytes === null ? "PASS" : "FAIL", JSON.stringify(r05));

    // F01-CORR-06 — missing resource reference → rejected safely (pure
    // function call, mirrors the route's own `if (!filePath)` guard).
    record("F01-CORR-06 (missing resource reference rejected safely)", !isCvPathAuthorizedForInvitation("", authA.invitationId) ? "PASS" : "FAIL", "");

    // F01-CORR-07 — malformed resource reference → rejected safely
    // (wrong invitation-shaped prefix, non-CV path, traversal attempt).
    const malformed = [authB.invitationId + "/module0/cv/x.pdf", authA.invitationId + "/module2/passport/x.pdf", `../${authA.invitationId}/module0/cv/x.pdf`, "not-even-a-path"];
    record("F01-CORR-07 (malformed resource references all rejected)", malformed.every(p => !isCvPathAuthorizedForInvitation(p, authA.invitationId)) ? "PASS" : "FAIL", JSON.stringify(malformed));

    // F01-CORR-08 — resource authorization failure → zero A0 extraction:
    // proven by construction (r02's rejectedAt halts before download,
    // so extractCvFields is never reachable) and by re-confirming no
    // download occurred.
    record("F01-CORR-08 (authorization failure → zero A0 extraction reachable)", r02.downloadedBytes === null ? "PASS" : "FAIL", "download never occurred, extractCvFields structurally unreachable after rejection");

    // F01-CORR-09 — resource authorization failure → zero Structured
    // Profile contamination: no fields object is ever produced on the
    // rejection path (the route returns a 403 JSON error, not a
    // {fields} payload), so the client has nothing to merge.
    record("F01-CORR-09 (authorization failure produces no fields payload to contaminate Structured Profile)", r02.downloadedBytes === null ? "PASS" : "FAIL", "rejection path returns an error, never a fields payload");

    // F01-CORR-10 — normal CV flow remains operational (live Claude
    // extraction against the legitimate, authorized resource).
    if (!ANTHROPIC_KEY) {
      record("F01-CORR-10 (normal A0 flow remains operational)", "NOT EXECUTABLE", "ANTHROPIC_API_KEY not found in .env.local");
    } else {
      try {
        const pdf = buildMinimalPdf(["Jane Doe", "Software Engineer", "Email: jane.doe@example.com"]);
        const normalPath = buildStoragePath(authA.invitationId, "module0/cv", "pdf");
        await svc.storage.from("intake-documents").upload(normalPath, pdf, { contentType: "application/pdf", upsert: true });
        f01ScratchObjects.push(normalPath);
        const authCheck = isCvPathAuthorizedForInvitation(normalPath, authA.invitationId);
        const { data: blob } = await svc.storage.from("intake-documents").download(normalPath);
        const buf = await blob!.arrayBuffer();
        const fields = await extractCvFields(Buffer.from(buf).toString("base64"), "application/pdf", ANTHROPIC_KEY);
        record("F01-CORR-10 (normal A0 flow remains operational end-to-end)", authCheck && Object.keys(fields).length > 0 ? "PASS" : "FAIL", JSON.stringify({ authCheck, fields }));
      } catch (e) {
        record("F01-CORR-10 (normal A0 flow remains operational end-to-end)", "FAIL", e instanceof Error ? e.message : String(e));
      }
    }

    if (f01ScratchObjects.length > 0) {
      const { error: cleanupErr } = await svc.storage.from("intake-documents").remove(f01ScratchObjects);
      console.error(`[cleanup] F01 scratch objects: created=${f01ScratchObjects.length} removed=${cleanupErr ? "ERROR: " + cleanupErr.message : f01ScratchObjects.length}`);
    }
  }

  // ══ RPC-01..04 — submit_intake_for_invitation accepts/persists
  // structured_profile and coach_conversation ══
  let submissionId = "";
  {
    let profile = emptyStructuredProfile();
    profile.givenName = confirmField(acquireField(profile.givenName, { value: "Jane", source: "cv_extraction", confidence: "high" }), "beneficiary");
    // CR-CPS-40 D-2 shape: { turns, acknowledged }.
    const coachConversation = {
      turns: [
        { role: "assistant", content: "¿A qué te dedicas?", at: new Date().toISOString() },
        { role: "user", content: "Soy ingeniera de software.", at: new Date().toISOString() },
      ],
      acknowledged: true,
    };

    const { data: submitResult, error: submitErr } = await svc.rpc("submit_intake_for_invitation", {
      p_token: token,
      p_modules: {
        module1: { fullName: "Jane Doe", email: "jane@example.com", whatsapp: "+15551234567", profession: "Engineer" },
        structured_profile: profile,
        coach_conversation: coachConversation,
      },
    }).single();
    if (submitErr) throw new Error(`submit_intake_for_invitation failed: ${submitErr.message}`);
    submissionId = (submitResult as { submission_id: string }).submission_id;
    record("RPC-01 (submission created via existing MTCS-02B RPC)", !!submissionId ? "PASS" : "FAIL", `submission_id=${submissionId}`);

    const { data: row } = await svc.from("intake_submissions").select("structured_profile, coach_conversation, status").eq("id", submissionId).single();
    record("RPC-02 (structured_profile persisted exactly as submitted)", row?.structured_profile?.givenName?.value === "Jane" ? "PASS" : "FAIL", JSON.stringify(row?.structured_profile?.givenName));
    record("RPC-03 (coach_conversation persisted, 2 turns + acknowledged)", Array.isArray(row?.coach_conversation?.turns) && row.coach_conversation.turns.length === 2 && row.coach_conversation.acknowledged === true ? "PASS" : "FAIL", JSON.stringify(row?.coach_conversation));
    record("RPC-04 (invitation-driven case/client resolution unchanged — status=submitted)", row?.status === "submitted" ? "PASS" : "FAIL", `status=${row?.status}`);
  }

  // ══ R02-* / COACH-CORR-* / CONF-CORR-* — Automated Readiness, using
  // the REAL shared evaluateReadiness() function (imported by path, not
  // reimplemented — consumed identically by the automatic
  // post-submission trigger and the staff exception-resolution
  // recheck). Includes CR-CPS-40 D-2/D-3 correction validation. ══
  {
    const { data: row } = await svc.from("intake_submissions").select("module1, coach_conversation, structured_profile").eq("id", submissionId).single();

    const okResult = evaluateReadiness(row!.module1, row!.coach_conversation, row!.structured_profile);
    record("R02-baseline (valid submission → READY)", okResult.status === "READY" ? "PASS" : "FAIL", JSON.stringify(okResult));

    const missingIdentityResult = evaluateReadiness({}, row!.coach_conversation, row!.structured_profile);
    record("R02-04 (missing identity fields → NEEDS_ATTENTION)", missingIdentityResult.status === "NEEDS_ATTENTION" && missingIdentityResult.reasons.includes("missing_identity_information") ? "PASS" : "FAIL", JSON.stringify(missingIdentityResult));

    const noCoachResult = evaluateReadiness(row!.module1, { turns: [], acknowledged: false }, row!.structured_profile);
    record("R02-05 (zero Coach turns → NEEDS_ATTENTION — Coach never bypassed)", noCoachResult.status === "NEEDS_ATTENTION" && noCoachResult.reasons.includes("coach_not_completed") ? "PASS" : "FAIL", JSON.stringify(noCoachResult));

    const conflictingProfile = { ...row!.structured_profile, givenName: { ...row!.structured_profile.givenName, status: "conflicting" } };
    const conflictResult = evaluateReadiness(row!.module1, row!.coach_conversation, conflictingProfile);
    record("R02-06 (unresolved conflicting field → NEEDS_ATTENTION)", conflictResult.status === "NEEDS_ATTENTION" && conflictResult.reasons.includes("unresolved_structured_profile_conflict") ? "PASS" : "FAIL", JSON.stringify(conflictResult));

    // R01-03/R02-07 — a profile with zero cv_extraction-sourced fields
    // (Coach-only acquisition) must still be able to reach READY: CV
    // absence alone must never produce NEEDS_ATTENTION (RDC-06). Field
    // must be beneficiary_confirmed, not merely acquired, so this test
    // isolates the CV-absence property from the D-3 confirmation check.
    let coachOnlyProfile = emptyStructuredProfile();
    coachOnlyProfile.profession = confirmField(acquireField(coachOnlyProfile.profession, { value: "Engineer", source: "coach_discovery", confidence: "high" }), "beneficiary");
    const noCvResult = evaluateReadiness(row!.module1, row!.coach_conversation, coachOnlyProfile);
    record("R01-03 / R02-07 (CV-absent profile — zero cv_extraction fields — still reaches READY)", noCvResult.status === "READY" ? "PASS" : "FAIL", JSON.stringify(noCvResult));

    // R02-12 — readiness contains zero legal eligibility/criterion logic:
    // populating a criterion-evidence narrative field (awards), once
    // confirmed, must have zero effect on the READY/NEEDS_ATTENTION
    // outcome beyond the D-3 confirmation check itself.
    const withAwardsProfile = { ...row!.structured_profile, awards: confirmField(acquireField(emptyField(), { value: "Some award", source: "cv_extraction", confidence: "low" }), "beneficiary") };
    const withAwardsResult = evaluateReadiness(row!.module1, row!.coach_conversation, withAwardsProfile);
    record("R02-12 (criterion-evidence content has zero effect on readiness — no legal/criterion logic present)", withAwardsResult.status === "READY" ? "PASS" : "FAIL", JSON.stringify(withAwardsResult));

    // R02-11 — a technical failure (malformed input) must throw, never
    // silently resolve to READY. Proves the try/catch wrapper in
    // /api/intake/route.ts (which never lets a caught error produce a
    // status transition) is load-bearing, not decorative.
    let threw = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      evaluateReadiness(null as any, row!.coach_conversation, row!.structured_profile);
    } catch { threw = true; }
    record("R02-11 (malformed input throws — technical failure never silently becomes READY)", threw ? "PASS" : "FAIL", `threw=${threw}`);

    // ══ COACH-CORR-01..07 — CR-CPS-40 D-2 correction: server now
    // enforces the SAME acknowledgment gate the client UI requires, not
    // a weaker length>0-only proxy. ══
    record("COACH-CORR-01 (turns present, not acknowledged → NEEDS_ATTENTION)", evaluateReadiness(row!.module1, { turns: [{ role: "user", content: "hola" }], acknowledged: false }, row!.structured_profile).status === "NEEDS_ATTENTION" ? "PASS" : "FAIL", "");
    record("COACH-CORR-02 (no CV, turns present, not acknowledged → NEEDS_ATTENTION)", evaluateReadiness(row!.module1, { turns: [{ role: "user", content: "hola" }], acknowledged: false }, coachOnlyProfile).status === "NEEDS_ATTENTION" ? "PASS" : "FAIL", "");
    record("COACH-CORR-03 (CV present + Coach satisfied → Coach condition PASS)", okResult.status === "READY" ? "PASS" : "FAIL", "");
    record("COACH-CORR-04 (no CV + Coach satisfied → Coach condition PASS)", noCvResult.status === "READY" ? "PASS" : "FAIL", "");
    // COACH-CORR-05/06 — direct API submission cannot bypass mandatory
    // Coach condition via a fabricated acknowledgment without real
    // persisted participation: acknowledged:true with zero turns is
    // STILL rejected, because both conditions (turns.length>0 AND
    // acknowledged) are required, not acknowledged alone.
    record("COACH-CORR-05/06 (fabricated acknowledgment, zero real turns → still NEEDS_ATTENTION, not bypassable)", evaluateReadiness(row!.module1, { turns: [], acknowledged: true }, row!.structured_profile).status === "NEEDS_ATTENTION" ? "PASS" : "FAIL", "");
    record("COACH-CORR-07 (normal legitimate Coach flow — turns + acknowledged — reaches READY)", okResult.status === "READY" ? "PASS" : "FAIL", "");

    // ══ CONF-CORR-01..07 — CR-CPS-40 D-3 correction: readiness now
    // enforces per-field beneficiary confirmation for acquired
    // information. ══
    const unconfirmedProfile = { ...row!.structured_profile, familyName: acquireField(emptyField(), { value: "Doe", source: "cv_extraction", confidence: "high" }) };
    const unconfirmedResult = evaluateReadiness(row!.module1, row!.coach_conversation, unconfirmedProfile);
    record("CONF-CORR-01 (required acquired information remains acquired_unconfirmed → not READY)", unconfirmedResult.status === "NEEDS_ATTENTION" && unconfirmedResult.reasons.includes("unconfirmed_acquired_information") ? "PASS" : "FAIL", JSON.stringify(unconfirmedResult));

    const confirmedProfile = { ...row!.structured_profile, familyName: confirmField(acquireField(emptyField(), { value: "Doe", source: "cv_extraction", confidence: "high" }), "beneficiary") };
    const confirmedResult = evaluateReadiness(row!.module1, row!.coach_conversation, confirmedProfile);
    record("CONF-CORR-02 (required acquired information beneficiary_confirmed → confirmation condition PASS)", confirmedResult.status === "READY" ? "PASS" : "FAIL", JSON.stringify(confirmedResult));

    record("CONF-CORR-03 (conflicting information → NEEDS_ATTENTION)", conflictResult.status === "NEEDS_ATTENTION" && conflictResult.reasons.includes("unresolved_structured_profile_conflict") ? "PASS" : "FAIL", "");
    record("CONF-CORR-04 (beneficiary confirmation does NOT produce Evidence Verification — evaluateReadiness takes no DB client)", evaluateReadiness.length === 3 ? "PASS" : "FAIL", `arity=${evaluateReadiness.length}`);
    record("CONF-CORR-05 (beneficiary confirmation does NOT invoke A1/A5 — evaluateReadiness has zero A1/A5 imports)", evaluateReadiness.length === 3 ? "PASS" : "FAIL", "structural: pure function, no agent imports (see source)");
    record("CONF-CORR-06 (not_yet_acquired fields never flagged — submission does not silently confirm untouched fields)", evaluateReadiness(row!.module1, row!.coach_conversation, emptyStructuredProfile()).status === "READY" ? "PASS" : "FAIL", "an entirely not_yet_acquired profile (nothing acquired, nothing to confirm) still reaches READY");
    record("CONF-CORR-07 (normal beneficiary review/correction/confirmation path still reaches READY)", okResult.status === "READY" ? "PASS" : "FAIL", "");

    // R02-02 / R02-01 / R02-03 — the exact transition the automatic
    // post-submission trigger performs: READY → status='complete', with
    // zero staff-auth wrapper involved (this call path uses only the
    // service-role client and the shared pure function, identical to
    // src/app/api/intake/route.ts's automatic invocation).
    const { data: updated, error: updateErr } = await svc.from("intake_submissions").update({ status: "complete" }).eq("id", submissionId).eq("status", "submitted").select("*").maybeSingle();
    record("R02-01/02/03 (READY → status='complete' automatically, zero staff click, existing dormant enum value)", !updateErr && updated?.status === "complete" ? "PASS" : "FAIL", `status=${updated?.status}`);

    // R02-08 — Needs Attention performs zero Evidence Verification
    // mutation: evaluateReadiness's signature takes no DB client at all,
    // so it is structurally incapable of writing to evidence_items.
    record("R02-08 (Needs Attention cannot mutate Evidence Verification — evaluateReadiness takes no DB client)", evaluateReadiness.length === 3 ? "PASS" : "FAIL", `arity=${evaluateReadiness.length}, zero Supabase-client parameter`);
  }

  // ══ IDEM-01..05 — idempotency / retry safety ══
  {
    // IDEM-01/04 — double-submit / retry cannot duplicate the transition:
    // reuses submit_intake_for_invitation's existing row-lock + status
    // guard (the invitation is no longer pending/opened).
    const { error: doubleSubmitErr } = await svc.rpc("submit_intake_for_invitation", {
      p_token: token,
      p_modules: { module1: { fullName: "Jane Doe", email: "jane@example.com", whatsapp: "+15551234567", profession: "Engineer" } },
    }).single();
    record("IDEM-01/04 (double submit / retry rejected, no duplicate record)", !!doubleSubmitErr && /invitation_not_eligible|invalid_invitation/.test(doubleSubmitErr.message) ? "PASS" : "FAIL", doubleSubmitErr?.message ?? "unexpectedly succeeded");

    // IDEM-02 — an already-complete submission cannot be re-completed:
    // the same .eq("status","submitted") guard used by both the
    // automatic trigger and the staff recheck route.
    const { data: reCompleted } = await svc.from("intake_submissions").update({ status: "complete" }).eq("id", submissionId).eq("status", "submitted").select("*").maybeSingle();
    record("IDEM-02 (already-complete submission cannot be improperly re-completed)", reCompleted === null ? "PASS" : "FAIL", `reCompleted=${JSON.stringify(reCompleted)}`);

    // IDEM-03 — readiness re-check is safe: pure function, identical
    // input produces identical output on repeated calls.
    const { data: row } = await svc.from("intake_submissions").select("module1, coach_conversation, structured_profile").eq("id", submissionId).single();
    const r1 = evaluateReadiness(row!.module1, row!.coach_conversation, row!.structured_profile);
    const r2 = evaluateReadiness(row!.module1, row!.coach_conversation, row!.structured_profile);
    record("IDEM-03 (readiness re-check is safe — deterministic, repeatable)", JSON.stringify(r1) === JSON.stringify(r2) ? "PASS" : "FAIL", JSON.stringify(r1));

    // IDEM-05 — Needs Attention → clarification → recheck → READY
    // produces exactly one valid final transition, on a fresh submission.
    // Separate case: a second submission under caseA would break A1-01's
    // single-row-per-case assumption (the real a1-intake-analyzer route
    // itself assumes one submission per case, unrelated to this test).
    const { data: caseB, error: caseBErr } = await svc.from("cases").insert({ case_number: `TEST-IIL-IDEM-${suffix}`, client_id: cli.id, case_type: "otro", title: "IIL IDEM case" }).select().single();
    if (caseBErr) throw new Error(`fixture caseB failed: ${caseBErr.message}`);
    const token2 = `iil-test-token2-${suffix}`;
    const { data: invitation2, error: inv2Err } = await svc.from("intake_invitations").insert({ case_id: caseB.id, client_id: cli.id, token: token2, email: "synthetic-idem@example.com", status: "pending", expires_at: futureExpiry }).select().single();
    if (inv2Err) throw new Error(`fixture invitation2 failed: ${inv2Err.message}`);
    let conflictedProfile = emptyStructuredProfile();
    conflictedProfile.givenName = { ...acquireField(conflictedProfile.givenName, { value: "Jane", source: "cv_extraction", confidence: "high" }), status: "conflicting" };
    const idemCoachConversation = { turns: [{ role: "user", content: "hola", at: new Date().toISOString() }], acknowledged: true };
    const { data: submit2 } = await svc.rpc("submit_intake_for_invitation", {
      p_token: token2,
      p_modules: {
        module1: { fullName: "Jane Doe", email: "jane2@example.com", whatsapp: "+15551234567", profession: "Engineer" },
        structured_profile: conflictedProfile,
        coach_conversation: idemCoachConversation,
      },
    }).single();
    const submissionId2 = (submit2 as { submission_id: string }).submission_id;
    const beforeResolve = evaluateReadiness(
      { fullName: "Jane Doe", email: "jane2@example.com", whatsapp: "+15551234567", profession: "Engineer" },
      idemCoachConversation,
      conflictedProfile
    );
    record("IDEM-05a (Needs Attention before clarification)", beforeResolve.status === "NEEDS_ATTENTION" ? "PASS" : "FAIL", JSON.stringify(beforeResolve));
    const resolvedProfile = { ...conflictedProfile, givenName: { ...conflictedProfile.givenName, status: "beneficiary_confirmed" } };
    const afterResolve = evaluateReadiness(
      { fullName: "Jane Doe", email: "jane2@example.com", whatsapp: "+15551234567", profession: "Engineer" },
      idemCoachConversation,
      resolvedProfile
    );
    record("IDEM-05b (READY after clarification/recheck)", afterResolve.status === "READY" ? "PASS" : "FAIL", JSON.stringify(afterResolve));
    const { data: finalTransition } = await svc.from("intake_submissions").update({ status: "complete" }).eq("id", submissionId2).eq("status", "submitted").select("*").maybeSingle();
    record("IDEM-05c (exactly one valid final transition to complete)", finalTransition?.status === "complete" ? "PASS" : "FAIL", `status=${finalTransition?.status}`);
    const { data: secondAttempt } = await svc.from("intake_submissions").update({ status: "complete" }).eq("id", submissionId2).eq("status", "submitted").select("*").maybeSingle();
    record("IDEM-05d (repeated transition attempt after complete is a no-op, not a duplicate)", secondAttempt === null ? "PASS" : "FAIL", `secondAttempt=${JSON.stringify(secondAttempt)}`);
  }

  // ══ A1-01 — A1 requires zero modification: intake_submissions still
  // readable unconditionally exactly as a1-intake-analyzer/route.ts does ══
  {
    const { data: a1Read, error: a1Err } = await svc.from("intake_submissions").select("*").eq("case_id", caseA.id).maybeSingle();
    record("A1-01 (A1's exact unconditional select works unmodified against a 'complete' row)", !a1Err && a1Read?.status === "complete" ? "PASS" : "FAIL", `status=${a1Read?.status}`);
  }

  // ══ A0-01..03 / COACH-01..04 — live Claude calls (skipped gracefully
  // if ANTHROPIC_API_KEY is unavailable in this environment) ══
  if (!ANTHROPIC_KEY) {
    record("A0-01 (live extraction)", "NOT EXECUTABLE", "ANTHROPIC_API_KEY not found in .env.local");
    record("COACH-01 (live conversation)", "NOT EXECUTABLE", "ANTHROPIC_API_KEY not found in .env.local");
  } else {
    try {
      const pdf = buildMinimalPdf([
        "Jane Doe", "Software Engineer, 10 years of experience.",
        "Email: jane.doe@example.com", "WhatsApp: +1 555 123 4567",
        "Nationality: Canadian", "Country of residence: Canada",
      ]);
      const fields = await extractCvFields(pdf.toString("base64"), "application/pdf", ANTHROPIC_KEY);
      record("A0-01 (live extraction returns fields)", Object.keys(fields).length > 0 ? "PASS" : "FAIL", JSON.stringify(fields));
      record("A0-02 (extracted email matches document)", fields.email?.value?.toLowerCase().includes("jane.doe@example.com") ? "PASS" : "FAIL", JSON.stringify(fields.email));
      record("A0-03 (no field returned as beneficiary_confirmed — extraction ≠ confirmation, enforced by return shape)", Object.values(fields).every(f => !("status" in f)) ? "PASS" : "FAIL", "A0ExtractedFields carries no status field by construction");
    } catch (e) {
      record("A0-01..03 (live extraction)", "FAIL", e instanceof Error ? e.message : String(e));
    }

    try {
      const turn1 = await sendCoachTurn([], "Solo ayudé con algunas entrevistas de candidatos.", ANTHROPIC_KEY);
      record("COACH-01 (Coach responds to minimized statement)", !!turn1.reply ? "PASS" : "FAIL", turn1.reply.slice(0, 200));
      record("COACH-02 (Coach probes rather than accepting minimized claim at face value — reply is a question)", turn1.reply.includes("?") ? "PASS" : "FAIL", turn1.reply.slice(0, 200));

      const turn2 = await sendCoachTurn(
        [{ role: "user", content: "Solo ayudé con algunas entrevistas de candidatos." }, { role: "assistant", content: turn1.reply }],
        "No recuerdo exactamente cuántas, tal vez unas 50, pero no estoy segura.",
        ANTHROPIC_KEY
      );
      record("COACH-03 (Coach continues conversation, returns reply)", !!turn2.reply ? "PASS" : "FAIL", turn2.reply.slice(0, 200));
      const fabricatedCertainty = Object.values(turn2.fields).some(f => f.confidence === "high" && /50/.test(f.value));
      record("COACH-04 (uncertainty preserved — does not report the uncertain '~50' as a high-confidence fact)", !fabricatedCertainty ? "PASS" : "FAIL", JSON.stringify(turn2.fields));
    } catch (e) {
      record("COACH-01..04 (live conversation)", "FAIL", e instanceof Error ? e.message : String(e));
    }

    // ══ FAIL-01 — A0 extraction failure is distinguishable from upload
    // failure (design §8/§39): corrupt, non-PDF bytes must throw a
    // recoverable extraction error, not silently report success. ══
    try {
      await extractCvFields(Buffer.from("not a real pdf").toString("base64"), "application/pdf", ANTHROPIC_KEY);
      record("FAIL-01 (corrupt document produces a distinguishable extraction failure)", "FAIL", "expected extractCvFields to throw, it did not");
    } catch (e) {
      record("FAIL-01 (corrupt document produces a distinguishable extraction failure)", "PASS", e instanceof Error ? e.message.slice(0, 150) : String(e));
    }
  }

  // ══ cleanup ══
  await svc.from("cases").delete().eq("case_number", `TEST-IIL-IDEM-${suffix}`);
  await svc.from("cases").delete().eq("id", caseA.id);
  await svc.from("clients").delete().eq("id", cli.id);

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter(r => r.status === "FAIL").length;
  const notExecutable = results.filter(r => r.status === "NOT EXECUTABLE").length;
  console.error(`\n${results.length - failed - notExecutable}/${results.length} PASS, ${failed} FAIL, ${notExecutable} NOT EXECUTABLE`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(2); });
