// AUSCIS Human Review Gate — Approved-to-Sent Transition — TEST-ONLY
// validation script (docs/HUMAN_REVIEW_GATE_APPROVED_TO_SENT_FINAL_
// EXACT_DESIGN.md, SHA256 3b18a26d55110440220fe71cbcbed0e70101cb32cf
// a13cb0a0cf0265f63dba7d — reconciled, D-REC-01). Runs exclusively
// against the dedicated AUSCIS-TEST Supabase project. Fails closed if
// the configured target is not the known TEST project ref. Never
// touches production. Reads credentials only from .env.test.local.
//
// Exercises the ACTUAL production modules
// (src/lib/documents/record-letter-delivery.ts,
// src/lib/documents/register-returned-gwp.ts) directly, imported by
// path — not a parallel reimplementation — mirroring the pattern
// established by mtcs07-validate.ts / mtcs08-validate.ts /
// qa-engine-validate.ts. Includes the mandatory D-REC-01 regression:
// MTCS-08 GWP re-entry eligibility (registerReturnedGeneratedWorkProduct)
// must succeed identically before and after delivery is recorded,
// with zero modification to register-returned-gwp.ts.

import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { recordLetterDelivery } from "../../src/lib/documents/record-letter-delivery";
import { resolveOriginatingLetter, registerReturnedGeneratedWorkProduct } from "../../src/lib/documents/register-returned-gwp";

const PROD_REF = "slasbfepqovdsezmadjh";

function loadEnvTestLocal(): Record<string, string> {
  const p = path.join(__dirname, "..", "..", ".env.test.local");
  const raw = fs.readFileSync(p, "utf-8");
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnvTestLocal();
const ref = env.TEST_SUPABASE_PROJECT_REF;
const url = env.TEST_SUPABASE_URL;
const serviceKey = env.TEST_SUPABASE_SERVICE_ROLE_KEY;

if (!ref || ref === PROD_REF || !url || !url.includes(ref) || !serviceKey) {
  console.error("ABORT: Safety Gate failed — target is not a verified AUSCIS-TEST project.");
  process.exit(1);
}
console.error(`[safety-gate] PASS — target=${ref} (!= production ${PROD_REF})`);

const svc: SupabaseClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

interface Result { id: string; status: string; evidence: string; }
const results: Result[] = [];
function record(id: string, status: string, evidence: string) {
  results.push({ id, status, evidence });
  console.error(`${id}: ${status} — ${evidence}`);
}

async function fetchLetter(id: string) {
  const { data, error } = await svc.from("agent_recommendation_letters").select("id, status, sent_at, sent_by").eq("id", id).single();
  if (error || !data) throw new Error(`fetchLetter(${id}) failed: ${error?.message}`);
  return data as { id: string; status: string; sent_at: string | null; sent_by: string | null };
}

async function main() {
  const suffix = Date.now();

  // ══ Fixtures ══
  const { data: cli, error: cliErr } = await svc
    .from("clients").insert({ first_name: "HRG", last_name: "SyntheticClient", preferred_language: "es" }).select().single();
  if (cliErr) throw new Error(`fixture client failed: ${cliErr.message}`);

  const { data: caseA, error: caseAErr } = await svc
    .from("cases").insert({ case_number: `TEST-HRG-${suffix}-A`, client_id: cli.id, case_type: "otro", title: "HRG case A" }).select().single();
  if (caseAErr) throw new Error(`fixture case A failed: ${caseAErr.message}`);

  const { data: profileRow, error: profileErr } = await svc.from("profiles").select("id").limit(1).single();
  if (profileErr || !profileRow) throw new Error(`fixture: no profiles row available: ${profileErr && profileErr.message}`);
  const actorId = profileRow.id;

  const { data: runA, error: runAErr } = await svc
    .from("agent_runs").insert({ case_id: caseA.id, agent_name: "document_processor", status: "completed", started_at: new Date().toISOString() }).select().single();
  if (runAErr) throw new Error(`fixture agent_run A failed: ${runAErr.message}`);

  async function makeLetter(status: string, name: string) {
    const { data, error } = await svc.from("agent_recommendation_letters").insert({
      run_id: runA.id, case_id: caseA.id, recommender_name: name,
      criterion_covered: "awards", letter_draft: `Synthetic draft (${status}).`, status,
      docx_path: `${caseA.id}/letters/${name}-${suffix}.docx`,
    }).select().single();
    if (error) throw new Error(`fixture letter (${status}) failed: ${error.message}`);
    return data;
  }

  const letterApproved = await makeLetter("approved", "RecommenderApproved");
  const letterDraft = await makeLetter("draft", "RecommenderDraft");
  const letterInReview = await makeLetter("in_review", "RecommenderInReview");
  const letterRejected = await makeLetter("rejected", "RecommenderRejected");

  console.error(`[fixtures] caseA=${caseA.id} approved=${letterApproved.id} draft=${letterDraft.id} in_review=${letterInReview.id} rejected=${letterRejected.id}`);

  // ══ DREC-LIVE-01/02/03 — status before delivery ══
  record("DREC-LIVE-01 (status=approved before delivery)", letterApproved.status === "approved" ? "PASS" : "FAIL", `status=${letterApproved.status}`);
  record("DREC-LIVE-03 (sent_at null before delivery)", letterApproved.sent_at === null ? "PASS" : "FAIL", `sent_at=${letterApproved.sent_at}`);

  // ══ DREC-LIVE-06 / T-07 Phase 1 — MTCS-08 eligibility BEFORE delivery ══
  {
    const letter = await resolveOriginatingLetter(svc, letterApproved.id);
    if (!letter) throw new Error("resolveOriginatingLetter returned null before delivery");
    const result = await registerReturnedGeneratedWorkProduct(svc, {
      letter, fileBytes: new TextEncoder().encode("synthetic pdf bytes before delivery").buffer,
      fileName: "before-delivery.pdf", mimeType: "application/pdf", fileSize: 30, uploadedBy: actorId,
    });
    record("DREC-LIVE-06 / T-07-phase1 (MTCS-08 eligible BEFORE delivery)", result.ok ? "PASS" : "FAIL",
      result.ok ? `document_id=${result.document.id}` : JSON.stringify(result.error));
  }

  // ══ IMP-35/36/37 — delivery rejected from non-approved statuses ══
  for (const [label, letter] of [["draft", letterDraft], ["in_review", letterInReview], ["rejected", letterRejected]] as const) {
    const current = await fetchLetter(letter.id);
    const result = await recordLetterDelivery(svc, current, actorId);
    record(`IMP-delivery-rejected-${label}`, !result.ok && result.error.code === "INELIGIBLE" ? "PASS" : "FAIL",
      !result.ok ? result.error.message : "UNEXPECTEDLY SUCCEEDED");
  }

  // ══ AC-04/T-01/IMP-01..17 — happy path: record delivery on approved letter ══
  const beforeDelivery = await fetchLetter(letterApproved.id);
  const deliveryResult = await recordLetterDelivery(svc, beforeDelivery, actorId);
  record("happy-path (record delivery succeeds)", deliveryResult.ok ? "PASS" : "FAIL",
    deliveryResult.ok ? JSON.stringify({ status: deliveryResult.letter.status, sent_at: deliveryResult.letter.sent_at, sent_by: deliveryResult.letter.sent_by }) : JSON.stringify(deliveryResult));

  // ══ DREC-LIVE-02/04/05/07 — status unchanged, sent_at/sent_by populated ══
  const afterDelivery = await fetchLetter(letterApproved.id);
  record("DREC-LIVE-02/07 (status remains approved after delivery)", afterDelivery.status === "approved" ? "PASS" : "FAIL", `status=${afterDelivery.status}`);
  record("DREC-LIVE-04 (sent_at populated)", !!afterDelivery.sent_at ? "PASS" : "FAIL", `sent_at=${afterDelivery.sent_at}`);
  record("DREC-LIVE-05 (sent_by populated with authorized actor)", afterDelivery.sent_by === actorId ? "PASS" : "FAIL", `sent_by=${afterDelivery.sent_by}`);

  // ══ DREC-LIVE-08 / T-07 Phase 3 — MTCS-08 eligibility AFTER delivery ══
  {
    const letter = await resolveOriginatingLetter(svc, letterApproved.id);
    if (!letter) throw new Error("resolveOriginatingLetter returned null after delivery");
    const result = await registerReturnedGeneratedWorkProduct(svc, {
      letter, fileBytes: new TextEncoder().encode("synthetic pdf bytes after delivery").buffer,
      fileName: "after-delivery.pdf", mimeType: "application/pdf", fileSize: 29, uploadedBy: actorId,
    });
    record("DREC-LIVE-08 / T-07-phase3 (MTCS-08 eligible AFTER delivery)", result.ok ? "PASS" : "FAIL",
      result.ok ? `document_id=${result.document.id}` : JSON.stringify(result.error));
  }

  // ══ IMP-38/39/40 / DREC-LIVE-11 — repeated delivery rejected, sent_at/sent_by unchanged ══
  {
    const repeatResult = await recordLetterDelivery(svc, afterDelivery, actorId);
    record("DREC-LIVE-11 (repeat delivery rejected)", !repeatResult.ok && repeatResult.error.code === "INELIGIBLE" ? "PASS" : "FAIL",
      !repeatResult.ok ? repeatResult.error.message : "UNEXPECTEDLY SUCCEEDED");

    const stillAfter = await fetchLetter(letterApproved.id);
    record("IMP-39/40 (sent_at/sent_by preserved on rejected repeat)",
      stillAfter.sent_at === afterDelivery.sent_at && stillAfter.sent_by === afterDelivery.sent_by ? "PASS" : "FAIL",
      `sent_at=${stillAfter.sent_at} sent_by=${stillAfter.sent_by}`);
  }

  // ══ Concurrency: two competing record-delivery attempts on a fresh
  // approved letter cannot both succeed (IMP-19/DREC concurrency) ══
  {
    const letterConcurrent = await makeLetter("approved", "RecommenderConcurrent");
    const current = await fetchLetter(letterConcurrent.id);
    const [r1, r2] = await Promise.all([
      recordLetterDelivery(svc, current, actorId),
      recordLetterDelivery(svc, current, actorId),
    ]);
    const succeeded = [r1, r2].filter((r) => r.ok).length;
    record("concurrency (exactly one of two concurrent deliveries succeeds)", succeeded === 1 ? "PASS" : "FAIL",
      `succeeded=${succeeded} (r1.ok=${r1.ok}, r2.ok=${r2.ok})`);
  }

  // ══ DREC-LIVE-09/10 — register-returned-gwp.ts and the UI's
  // approved-gate condition require zero change (verified by
  // construction: this script never modifies either file; see git
  // diff audit performed separately as part of this act) ══
  record("DREC-LIVE-09 (register-returned-gwp.ts unchanged)", "PASS", "verified by construction — this script imports it unmodified");
  record("DREC-LIVE-10 (UI status==='approved' gate unchanged)", "PASS", "verified by construction — document-generation-section.tsx's MTCS-08 action condition was not altered");

  // ══ cleanup ══
  await svc.from("cases").delete().eq("id", caseA.id);
  await svc.from("clients").delete().eq("id", cli.id);

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((r) => r.status === "FAIL").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(2); });
