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
  emptyStructuredProfile, acquireField, confirmField, isConflicting, hasAnyAcquiredInformation,
} from "../../src/lib/intake/structured-profile";
import { prefillModule1 } from "../../src/lib/intake/prefill-engine";
import { extractCvFields } from "../../src/lib/intake/a0-extract";
import { sendCoachTurn } from "../../src/lib/intake/coach";

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

  console.error(`[fixtures] caseA=${caseA.id} invitation=${invitation.id}`);

  // ══ AUTH-01..03 — upload-route ownership check, replicated against
  // real TEST rows (identical query the route executes) ══
  {
    const now = new Date().toISOString();
    const { data: validLookup } = await svc.from("intake_invitations").select("id").eq("token", token).in("status", ["pending", "opened"]).gt("expires_at", now).maybeSingle();
    record("AUTH-01 (valid unexpired invitation token resolves)", validLookup?.id === invitation.id ? "PASS" : "FAIL", `resolved=${validLookup?.id}`);

    const { data: expiredLookup } = await svc.from("intake_invitations").select("id").eq("token", expiredToken).in("status", ["pending", "opened"]).gt("expires_at", now).maybeSingle();
    record("AUTH-02 (expired invitation token denied)", expiredLookup === null ? "PASS" : "FAIL", `resolved=${expiredLookup}`);

    const { data: bogusLookup } = await svc.from("intake_invitations").select("id").eq("token", "nonexistent-token").in("status", ["pending", "opened"]).gt("expires_at", now).maybeSingle();
    record("AUTH-03 (nonexistent token denied — client-supplied sessionId alone is insufficient)", bogusLookup === null ? "PASS" : "FAIL", `resolved=${bogusLookup}`);
  }

  // ══ RPC-01..04 — submit_intake_for_invitation accepts/persists
  // structured_profile and coach_conversation ══
  let submissionId = "";
  {
    let profile = emptyStructuredProfile();
    profile.givenName = confirmField(acquireField(profile.givenName, { value: "Jane", source: "cv_extraction", confidence: "high" }), "beneficiary");
    const coachConversation = [
      { role: "assistant", content: "¿A qué te dedicas?", at: new Date().toISOString() },
      { role: "user", content: "Soy ingeniera de software.", at: new Date().toISOString() },
    ];

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
    record("RPC-03 (coach_conversation persisted, 2 turns)", Array.isArray(row?.coach_conversation) && row.coach_conversation.length === 2 ? "PASS" : "FAIL", `len=${row?.coach_conversation?.length}`);
    record("RPC-04 (invitation-driven case/client resolution unchanged — status=submitted)", row?.status === "submitted" ? "PASS" : "FAIL", `status=${row?.status}`);
  }

  // ══ IC-01..05 — Intake Complete prerequisites (replicates
  // /api/intake-intelligence/complete's exact logic against the real row) ══
  {
    const checkPrerequisites = (m1: Record<string, string>, coachConv: unknown[], profile: Record<string, { status?: string }>) => {
      const missing = ["fullName", "email", "whatsapp", "profession"].filter(f => !m1[f]?.trim());
      if (missing.length > 0) return { ok: false, reason: `missing identity: ${missing.join(",")}` };
      if (coachConv.length === 0) return { ok: false, reason: "no coach discovery" };
      if (Object.values(profile).some(f => f.status === "conflicting")) return { ok: false, reason: "unresolved conflict" };
      return { ok: true, reason: "" };
    };

    const { data: row } = await svc.from("intake_submissions").select("module1, coach_conversation, structured_profile").eq("id", submissionId).single();
    const okCheck = checkPrerequisites(row!.module1, row!.coach_conversation, row!.structured_profile);
    record("IC-01 (valid submission passes Intake Complete prerequisites)", okCheck.ok ? "PASS" : "FAIL", okCheck.reason);

    const missingIdentityCheck = checkPrerequisites({}, row!.coach_conversation, row!.structured_profile);
    record("IC-02 (missing identity fields blocks completion)", !missingIdentityCheck.ok ? "PASS" : "FAIL", missingIdentityCheck.reason);

    const noCoachCheck = checkPrerequisites(row!.module1, [], row!.structured_profile);
    record("IC-03 (zero Coach turns blocks completion — Coach never bypassed)", !noCoachCheck.ok ? "PASS" : "FAIL", noCoachCheck.reason);

    const conflictingProfile = { ...row!.structured_profile, givenName: { ...row!.structured_profile.givenName, status: "conflicting" } };
    const conflictCheck = checkPrerequisites(row!.module1, row!.coach_conversation, conflictingProfile);
    record("IC-04 (unresolved conflicting field blocks completion)", !conflictCheck.ok ? "PASS" : "FAIL", conflictCheck.reason);

    // Live transition, exact same conditional-update pattern as the route
    const { data: updated, error: updateErr } = await svc.from("intake_submissions").update({ status: "complete" }).eq("id", submissionId).eq("status", "submitted").select("*").maybeSingle();
    record("IC-05 (live status='complete' transition succeeds on the pre-existing dormant enum value)", !updateErr && updated?.status === "complete" ? "PASS" : "FAIL", `status=${updated?.status}`);
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
  await svc.from("cases").delete().eq("id", caseA.id);
  await svc.from("clients").delete().eq("id", cli.id);

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter(r => r.status === "FAIL").length;
  const notExecutable = results.filter(r => r.status === "NOT EXECUTABLE").length;
  console.error(`\n${results.length - failed - notExecutable}/${results.length} PASS, ${failed} FAIL, ${notExecutable} NOT EXECUTABLE`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(2); });
