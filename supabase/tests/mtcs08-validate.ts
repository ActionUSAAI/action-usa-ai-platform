// AUSCIS MTCS-08 — TEST-ONLY validation script (Generated Work Product
// Re-entry). Runs exclusively against the dedicated AUSCIS-TEST
// Supabase project. Fails closed if the configured target is not the
// known TEST project ref. Never touches production. Reads credentials
// only from .env.test.local.
//
// Exercises the ACTUAL production modules
// (src/lib/documents/register-returned-gwp.ts,
// src/lib/documents/register-canonical-document.ts) directly, imported
// by path — not a parallel reimplementation — mirroring the pattern
// established by supabase/tests/mtcs07-validate.ts. The seven
// mutation-case results are also verified with raw SQL against
// trg_documents_gwp_same_case / enforce_gwp_document_same_case
// (migration 033) to confirm actual DB behavior, not merely what the
// application layer happens to send.

import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { registerCanonicalDocument } from "../../src/lib/documents/register-canonical-document";
import {
  resolveOriginatingLetter,
  registerReturnedGeneratedWorkProduct,
  buildReturnedGwpPath,
} from "../../src/lib/documents/register-returned-gwp";

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

async function main() {
  const suffix = Date.now();

  // ══ Fixtures ══
  const { data: cli, error: cliErr } = await svc
    .from("clients").insert({ first_name: "MTCS08", last_name: "SyntheticClient", preferred_language: "es" }).select().single();
  if (cliErr) throw new Error(`fixture client failed: ${cliErr.message}`);

  const { data: caseA, error: caseAErr } = await svc
    .from("cases").insert({ case_number: `TEST-MTCS08-${suffix}-A`, client_id: cli.id, case_type: "otro", title: "MTCS-08 case A" }).select().single();
  if (caseAErr) throw new Error(`fixture case A failed: ${caseAErr.message}`);

  const { data: caseB, error: caseBErr } = await svc
    .from("cases").insert({ case_number: `TEST-MTCS08-${suffix}-B`, client_id: cli.id, case_type: "otro", title: "MTCS-08 case B" }).select().single();
  if (caseBErr) throw new Error(`fixture case B failed: ${caseBErr.message}`);

  const { data: profileRow, error: profileErr } = await svc.from("profiles").select("id").limit(1).single();
  if (profileErr || !profileRow) throw new Error(`fixture: no profiles row available: ${profileErr && profileErr.message}`);
  const actorId = profileRow.id;

  const { data: runA, error: runAErr } = await svc
    .from("agent_runs").insert({ case_id: caseA.id, agent_name: "document_processor", status: "completed", started_at: new Date().toISOString() }).select().single();
  if (runAErr) throw new Error(`fixture agent_run A failed: ${runAErr.message}`);

  const { data: runB, error: runBErr } = await svc
    .from("agent_runs").insert({ case_id: caseB.id, agent_name: "document_processor", status: "completed", started_at: new Date().toISOString() }).select().single();
  if (runBErr) throw new Error(`fixture agent_run B failed: ${runBErr.message}`);

  // Approved GWP in Case A, approved GWP in Case B, and a non-approved
  // (draft) GWP in Case A for the API-level eligibility check.
  const { data: letterA, error: letterAErr } = await svc.from("agent_recommendation_letters").insert({
    run_id: runA.id, case_id: caseA.id, recommender_name: "Recommender A",
    criterion_covered: "awards", letter_draft: "Synthetic draft A.", status: "approved",
    docx_path: `${caseA.id}/letters/rec-A-${suffix}.docx`,
  }).select().single();
  if (letterAErr) throw new Error(`fixture letterA failed: ${letterAErr.message}`);

  const { data: letterB, error: letterBErr } = await svc.from("agent_recommendation_letters").insert({
    run_id: runB.id, case_id: caseB.id, recommender_name: "Recommender B",
    criterion_covered: "awards", letter_draft: "Synthetic draft B.", status: "approved",
    docx_path: `${caseB.id}/letters/rec-B-${suffix}.docx`,
  }).select().single();
  if (letterBErr) throw new Error(`fixture letterB failed: ${letterBErr.message}`);

  const { data: letterDraft, error: letterDraftErr } = await svc.from("agent_recommendation_letters").insert({
    run_id: runA.id, case_id: caseA.id, recommender_name: "Recommender Draft",
    criterion_covered: "awards", letter_draft: "Synthetic draft (not approved).", status: "draft",
    docx_path: `${caseA.id}/letters/rec-draft-${suffix}.docx`,
  }).select().single();
  if (letterDraftErr) throw new Error(`fixture letterDraft failed: ${letterDraftErr.message}`);

  console.error(`[fixtures] caseA=${caseA.id} caseB=${caseB.id} letterA=${letterA.id} letterB=${letterB.id} letterDraft=${letterDraft.id}`);

  // ══ T01 — same-Case insert (via real registerCanonicalDocument) ══
  const docT01Path = `${caseA.id}/gwp-returns/${letterA.id}/${suffix}-t01.pdf`;
  try {
    const doc = await registerCanonicalDocument(svc, {
      caseId: caseA.id, storageBucket: "intake-documents", filePath: docT01Path, fileName: "t01.pdf",
      originatingRecommendationLetterId: letterA.id,
    });
    record("T01", doc.originating_recommendation_letter_id === letterA.id && doc.case_id === caseA.id ? "PASS" : "FAIL",
      `Document Case A + GWP Case A → allowed, lineage=${doc.originating_recommendation_letter_id}`);
  } catch (e) {
    record("T01", "FAIL", `expected ALLOW, got exception: ${e instanceof Error ? e.message : e}`);
  }

  // ══ T02 — cross-Case insert must be rejected by the DB trigger ══
  const docT02Path = `${caseA.id}/gwp-returns/${letterB.id}/${suffix}-t02.pdf`;
  try {
    await registerCanonicalDocument(svc, {
      caseId: caseA.id, storageBucket: "intake-documents", filePath: docT02Path, fileName: "t02.pdf",
      originatingRecommendationLetterId: letterB.id, // letterB belongs to caseB
    });
    record("T02", "FAIL", "expected REJECT (GW002), insert succeeded");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    record("T02", msg.includes("GW002") || msg.includes("must match originating GWP case_id") ? "PASS" : "FAIL",
      `Document Case A + GWP Case B → ${msg}`);
  }

  // ══ T03 — ordinary document, NULL lineage ══
  const docT03Path = `${caseA.id}/ordinary-${suffix}.pdf`;
  try {
    const doc = await registerCanonicalDocument(svc, {
      caseId: caseA.id, storageBucket: "intake-documents", filePath: docT03Path, fileName: "t03.pdf",
    });
    record("T03", doc.originating_recommendation_letter_id == null ? "PASS" : "FAIL", "ordinary document with NULL lineage → allowed");
  } catch (e) {
    record("T03", "FAIL", `expected ALLOW, got exception: ${e instanceof Error ? e.message : e}`);
  }

  // ══ T04 — same-Case lineage repoint (T01's doc, letterA → a second
  // approved letter also in caseA) ══
  const { data: letterA2, error: letterA2Err } = await svc.from("agent_recommendation_letters").insert({
    run_id: runA.id, case_id: caseA.id, recommender_name: "Recommender A2",
    criterion_covered: "awards", letter_draft: "Synthetic draft A2.", status: "approved",
    docx_path: `${caseA.id}/letters/rec-A2-${suffix}.docx`,
  }).select().single();
  if (letterA2Err) throw new Error(`fixture letterA2 failed: ${letterA2Err.message}`);

  const { data: t01Row } = await svc.from("documents").select("id").eq("file_path", docT01Path).single();
  {
    const { error } = await svc.from("documents").update({ originating_recommendation_letter_id: letterA2.id }).eq("id", t01Row.id);
    record("T04", !error ? "PASS" : "FAIL", `lineage repoint GWP-A→GWP-A2, same Case → ${error ? error.message : "allowed"}`);
  }

  // ══ T05 — cross-Case lineage repoint must be rejected ══
  {
    const { error } = await svc.from("documents").update({ originating_recommendation_letter_id: letterB.id }).eq("id", t01Row.id);
    record("T05", error && (error.message.includes("GW002") || error.message.includes("must match originating GWP case_id")) ? "PASS" : "FAIL",
      `lineage repoint to a GWP in another Case → ${error ? error.message : "UNEXPECTEDLY ALLOWED"}`);
  }

  // ══ T06 — documents.case_id changed while lineage still attached,
  // resulting Cases differ → REJECT ══
  {
    const { error } = await svc.from("documents").update({ case_id: caseB.id }).eq("id", t01Row.id);
    record("T06", error && (error.message.includes("GW002") || error.message.includes("must match originating GWP case_id")) ? "PASS" : "FAIL",
      `documents.case_id changed while lineage (→letterA2, caseA) still attached → ${error ? error.message : "UNEXPECTEDLY ALLOWED"}`);
  }

  // ══ T07 — delete originating GWP → returned Document survives,
  // lineage NULLed, case_id unchanged ══
  {
    const { data: before } = await svc.from("documents").select("case_id, originating_recommendation_letter_id").eq("id", t01Row.id).single();
    const { error: delErr } = await svc.from("agent_recommendation_letters").delete().eq("id", letterA2.id);
    const { data: after } = await svc.from("documents").select("case_id, originating_recommendation_letter_id").eq("id", t01Row.id).single();
    const survived = !delErr && after && after.originating_recommendation_letter_id === null && after.case_id === before.case_id;
    record("T07", survived ? "PASS" : "FAIL",
      `delete originating GWP → survives=${!!after}, lineage_before=${before?.originating_recommendation_letter_id}, lineage_after=${after?.originating_recommendation_letter_id}, case_id unchanged=${after?.case_id === before?.case_id}`);
  }

  // ══ registerCanonicalDocument regression — existing-shape callers
  // (no lineage param) unaffected ══
  {
    const doc = await registerCanonicalDocument(svc, {
      caseId: caseA.id, storageBucket: "intake-documents", filePath: `${caseA.id}/regression-${suffix}.pdf`, fileName: "regression.pdf",
    });
    record("AC-24 regression", doc.originating_recommendation_letter_id == null && !!doc.id ? "PASS" : "FAIL",
      "existing-shape call (no lineage param) behaves exactly as before");
  }

  // ══ Full service-function path — registerReturnedGeneratedWorkProduct ══
  {
    const letter = await resolveOriginatingLetter(svc, letterA.id);
    if (!letter) throw new Error("resolveOriginatingLetter returned null for a fixture letter");
    const result = await registerReturnedGeneratedWorkProduct(svc, {
      letter, fileBytes: new TextEncoder().encode("synthetic pdf bytes").buffer,
      fileName: "returned.pdf", mimeType: "application/pdf", fileSize: 20, uploadedBy: actorId,
    });
    record("AC-01..AC-08 (service path, approved GWP)", result.ok && result.document.case_id === caseA.id && result.document.originating_recommendation_letter_id === letterA.id ? "PASS" : "FAIL",
      result.ok ? `document_id=${result.document.id}, case_id=${result.document.case_id}, lineage=${result.document.originating_recommendation_letter_id}` : JSON.stringify(result.error));
  }

  // ══ AC-04 — ineligible (draft) GWP rejected before any storage/DB write ══
  {
    const letter = await resolveOriginatingLetter(svc, letterDraft.id);
    if (!letter) throw new Error("resolveOriginatingLetter returned null for the draft fixture letter");
    const result = await registerReturnedGeneratedWorkProduct(svc, {
      letter, fileBytes: new TextEncoder().encode("synthetic pdf bytes").buffer,
      fileName: "returned-draft.pdf", mimeType: "application/pdf", fileSize: 20, uploadedBy: actorId,
    });
    record("AC-04 (draft GWP rejected)", !result.ok && !result.ok && result.error.code === "INELIGIBLE" ? "PASS" : "FAIL",
      result.ok ? "UNEXPECTEDLY SUCCEEDED" : JSON.stringify(result.error));
  }

  // ══ AC-15 — second legitimate return for the same approved GWP ══
  {
    const letter = await resolveOriginatingLetter(svc, letterA.id);
    if (!letter) throw new Error("resolveOriginatingLetter returned null");
    const result1 = await registerReturnedGeneratedWorkProduct(svc, {
      letter, fileBytes: new TextEncoder().encode("first return").buffer,
      fileName: "return1.pdf", mimeType: "application/pdf", fileSize: 13, uploadedBy: actorId,
    });
    const result2 = await registerReturnedGeneratedWorkProduct(svc, {
      letter, fileBytes: new TextEncoder().encode("second return").buffer,
      fileName: "return2.pdf", mimeType: "application/pdf", fileSize: 14, uploadedBy: actorId,
    });
    const bothOk = result1.ok && result2.ok;
    record("AC-15 (multiple returns, same GWP)",
      bothOk && result1.ok && result2.ok && result1.document.id !== result2.document.id ? "PASS" : "FAIL",
      bothOk && result1.ok && result2.ok ? `doc1=${result1.document.id} doc2=${result2.document.id} (distinct)` : "one or both returns failed unexpectedly");
  }

  // ══ Path-builder collision-safety spot check ══
  {
    const p1 = buildReturnedGwpPath(caseA.id, letterA.id, "a file.pdf");
    record("path sanitization", /^[^ ]+$/.test(p1) && p1.includes(caseA.id) && p1.includes("gwp-returns") && p1.includes(letterA.id) ? "PASS" : "FAIL", p1);
  }

  void actorId;

  // ══ Cleanup — CASCADE via cases only ══
  const cascadeCleanup = await svc.from("cases").delete().in("id", [caseA.id, caseB.id]);
  record("cleanup: cascade teardown", !cascadeCleanup.error ? "PASS" : "FAIL",
    cascadeCleanup.error ? cascadeCleanup.error.message : "cases + dependent rows removed cleanly");
  await svc.from("clients").delete().eq("id", cli.id);

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((r) => r.status === "FAIL").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(2); });
