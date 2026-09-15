// AUSCIS MTCS-07 — TEST-ONLY validation script (signed-URL hardening).
// Runs exclusively against the dedicated AUSCIS-TEST Supabase project.
// Fails closed if the configured target is not the known TEST project ref.
// Never touches production. Reads credentials only from .env.test.local.
//
// Exercises the ACTUAL production resolution module
// (src/lib/storage/resolve-signed-url-resource.ts) directly, imported by
// path — not a parallel reimplementation — so this script and the route
// (src/app/api/storage/signed-url/route.ts) are provably running the same
// code. authorizeCaseStaff() itself is not re-tested here: it is a
// pre-existing, unmodified primitive already exercised by six Evidence V2
// routes; this script validates only the new MTCS-07 resolution logic
// (which case_id/bucket/file_path each request mode produces) and its
// cross-Case rejection properties.

import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  resolveCanonicalDocument,
  resolveLegacyBinding,
  resolveTranslationBucket,
  INTAKE_BUCKET,
} from "../../src/lib/storage/resolve-signed-url-resource";

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
    .from("clients").insert({ first_name: "MTCS07", last_name: "SyntheticClient", preferred_language: "es" }).select().single();
  if (cliErr) throw new Error(`fixture client failed: ${cliErr.message}`);

  const { data: caseA, error: caseAErr } = await svc
    .from("cases").insert({ case_number: `TEST-MTCS07-${suffix}-A`, client_id: cli.id, case_type: "otro", title: "MTCS-07 case A" }).select().single();
  if (caseAErr) throw new Error(`fixture case A failed: ${caseAErr.message}`);

  const { data: caseB, error: caseBErr } = await svc
    .from("cases").insert({ case_number: `TEST-MTCS07-${suffix}-B`, client_id: cli.id, case_type: "otro", title: "MTCS-07 case B" }).select().single();
  if (caseBErr) throw new Error(`fixture case B failed: ${caseBErr.message}`);

  const { data: profileRow, error: profileErr } = await svc.from("profiles").select("id").limit(1).single();
  if (profileErr || !profileRow) throw new Error(`fixture: no profiles row available: ${profileErr && profileErr.message}`);
  const actorId = profileRow.id;

  console.error(`[fixtures] caseA=${caseA.id} caseB=${caseB.id}`);

  // ══ LB-01 — documents (canonical row) ══
  const docAPath = `${caseA.id}/docA-${suffix}.pdf`;
  const { data: docA, error: docAErr } = await svc.from("documents").insert({
    case_id: caseA.id, client_id: cli.id, name: "docA.pdf",
    file_path: docAPath, storage_bucket: INTAKE_BUCKET,
  }).select().single();
  if (docAErr) throw new Error(`fixture docA failed: ${docAErr.message}`);

  const docBPath = `${caseB.id}/docB-${suffix}.pdf`;
  const { data: docB, error: docBErr } = await svc.from("documents").insert({
    case_id: caseB.id, client_id: cli.id, name: "docB.pdf",
    file_path: docBPath, storage_bucket: INTAKE_BUCKET,
  }).select().single();
  if (docBErr) throw new Error(`fixture docB failed: ${docBErr.message}`);

  // A second canonical original, deliberately registered under a
  // NON-default bucket — proves LB-03's bucket reconstruction actually
  // reads documents.storage_bucket dynamically rather than merely
  // happening to match intake-documents by coincidence (the exact gap
  // CR-07-01 found and fixed). This row is never uploaded to real Storage
  // (case-documents is unprovisioned in TEST — a separate, pre-existing,
  // out-of-scope finding) — resolution is a pure DB read and never touches
  // Storage itself.
  const docA2Path = `${caseA.id}/docA2-${suffix}.pdf`;
  const { data: docA2, error: docA2Err } = await svc.from("documents").insert({
    case_id: caseA.id, client_id: cli.id, name: "docA2.pdf",
    file_path: docA2Path, storage_bucket: "case-documents",
  }).select().single();
  if (docA2Err) throw new Error(`fixture docA2 failed: ${docA2Err.message}`);

  // AC-07-07 / N-05 / N-06: canonical mode
  {
    const resolved = await resolveCanonicalDocument(svc, docA.id);
    record("AC-07-07", resolved && resolved.caseId === caseA.id && resolved.bucket === INTAKE_BUCKET && resolved.filePath === docAPath ? "PASS" : "FAIL",
      `document_id=${docA.id} resolved case_id=${resolved?.caseId}, bucket=${resolved?.bucket}, file_path=${resolved?.filePath}`);

    const unknown = await resolveCanonicalDocument(svc, "00000000-0000-0000-0000-000000000000");
    record("AC-07-09 / N-05", unknown === null ? "PASS" : "FAIL", "unknown document_id resolves to null (route returns 404, no fallback)");
  }

  // AC-07-08 / N-06: LB-01, cross-case — docB's path must never resolve to caseA
  {
    const resolved = await resolveLegacyBinding(svc, docBPath);
    record("AC-07-08 (LB-01)", resolved !== null && resolved.caseId === caseB.id ? "PASS" : "FAIL",
      `docB's path resolves to case_id=${resolved?.caseId} (must be caseB=${caseB.id}, never caseA=${caseA.id})`);
    record("N-06 (cross-case, LB-01)", resolved?.caseId !== caseA.id ? "PASS" : "FAIL",
      "docB's path never resolves to caseA under any circumstance");
  }

  // ══ LB-02 — intake_submissions ══
  const intakeFilePath = `sess-${suffix}/module5/degree.pdf`;
  const { error: subErr } = await svc.from("intake_submissions").insert({
    case_id: caseA.id, client_id: cli.id,
    module5: { degrees: [{ degreeName: "Test Degree", filePath: intakeFilePath, fileName: "degree.pdf" }] },
  });
  if (subErr) throw new Error(`fixture intake_submissions failed: ${subErr.message}`);

  {
    const resolved = await resolveLegacyBinding(svc, intakeFilePath);
    record("AC-07-08 (LB-02)", resolved !== null && resolved.caseId === caseA.id && resolved.bucket === INTAKE_BUCKET ? "PASS" : "FAIL",
      `intake path resolves to case_id=${resolved?.caseId} (expected caseA=${caseA.id}), bucket=${resolved?.bucket}`);

    const noMatch = await resolveLegacyBinding(svc, `sess-${suffix}/nonexistent.pdf`);
    record("N-10", noMatch === null ? "PASS" : "FAIL", "arbitrary path absent from all four authoritative sources resolves to null (404)");
  }

  // ══ LB-03 — document_translations (both branches) ══
  const { data: run, error: runErr } = await svc
    .from("agent_runs").insert({ case_id: caseA.id, agent_name: "document_processor", status: "completed", started_at: new Date().toISOString() }).select().single();
  if (runErr) throw new Error(`fixture agent_run failed: ${runErr.message}`);
  void run;

  // Branch A: canonical-origin translation (document_id set, points to docA2,
  // whose storage_bucket is deliberately NOT intake-documents — see docA2's
  // fixture comment above).
  const transCanonicalPath = `${caseA.id}/translations/docA2_EN-${suffix}.docx`;
  const { error: transCanonErr } = await svc.from("document_translations").insert({
    case_id: caseA.id, document_id: docA2.id, status: "completed",
    original_file_path: docA2Path, original_file_name: "docA2.pdf",
    translation_docx_path: transCanonicalPath, translation_docx_name: "docA2_EN.docx",
  });
  if (transCanonErr) throw new Error(`fixture translation (canonical) failed: ${transCanonErr.message}`);

  {
    const resolved = await resolveLegacyBinding(svc, transCanonicalPath);
    record("AC-07-13 (document_id set, non-default bucket)",
      resolved !== null && resolved.caseId === caseA.id && resolved.bucket === docA2.storage_bucket && resolved.bucket !== INTAKE_BUCKET ? "PASS" : "FAIL",
      `translation with document_id set resolves bucket=${resolved?.bucket} (must equal docA2.storage_bucket="${docA2.storage_bucket}", proving the bucket is NOT unconditionally intake-documents), case_id=${resolved?.caseId}`);
  }

  // Branch B: legacy-origin translation (document_id NULL)
  const legacySessId = `sess-legacy-${suffix}`;
  const transLegacyOriginalPath = `${legacySessId}/original.pdf`;
  const transLegacyPath = `${caseA.id}/translations/legacy_EN-${suffix}.docx`;
  const { error: transLegacyErr } = await svc.from("document_translations").insert({
    case_id: caseA.id, document_id: null, status: "completed",
    original_file_path: transLegacyOriginalPath, original_file_name: "original.pdf",
    translation_docx_path: transLegacyPath, translation_docx_name: "legacy_EN.docx",
  });
  if (transLegacyErr) throw new Error(`fixture translation (legacy) failed: ${transLegacyErr.message}`);

  {
    const resolved = await resolveLegacyBinding(svc, transLegacyPath);
    record("AC-07-13 (document_id NULL) / N-14", resolved !== null && resolved.caseId === caseA.id && resolved.bucket === INTAKE_BUCKET ? "PASS" : "FAIL",
      `translation with document_id NULL resolves bucket=${resolved?.bucket} (expected intake-documents, A2's own legacy default)`);
  }

  // Direct unit check of resolveTranslationBucket's two branches
  {
    const bucketSet = await resolveTranslationBucket(svc, docA2.id);
    record("resolveTranslationBucket(document_id set, non-default bucket)",
      bucketSet === docA2.storage_bucket && bucketSet !== INTAKE_BUCKET ? "PASS" : "FAIL", `resolved=${bucketSet}`);
    const bucketNull = await resolveTranslationBucket(svc, null);
    record("resolveTranslationBucket(document_id null)", bucketNull === INTAKE_BUCKET ? "PASS" : "FAIL", `resolved=${bucketNull}`);
    const bucketBroken = await resolveTranslationBucket(svc, "00000000-0000-0000-0000-000000000000");
    record("LB-03 referential-integrity defensive fail-closed", bucketBroken === null ? "PASS" : "FAIL",
      "non-null document_id pointing to a nonexistent documents row resolves to null (route returns 404, never falls back to intake-documents)");
  }

  // Cross-case: translation for caseB must never resolve to caseA
  const transBPath = `${caseB.id}/translations/docB_EN-${suffix}.docx`;
  const { error: transBErr } = await svc.from("document_translations").insert({
    case_id: caseB.id, document_id: docB.id, status: "completed",
    original_file_path: docBPath, original_file_name: "docB.pdf",
    translation_docx_path: transBPath, translation_docx_name: "docB_EN.docx",
  });
  if (transBErr) throw new Error(`fixture translation (caseB) failed: ${transBErr.message}`);
  {
    const resolved = await resolveLegacyBinding(svc, transBPath);
    record("N-08 (cross-case, LB-03)", resolved !== null && resolved.caseId === caseB.id && resolved.caseId !== caseA.id ? "PASS" : "FAIL",
      `caseB's translation path resolves to case_id=${resolved?.caseId} (must be caseB, never caseA)`);
  }

  // ══ LB-04 — generated-document tables (all three sub-families) ══
  const letterPath = `${caseA.id}/letters/rec-${suffix}.docx`;
  const { error: letterErr } = await svc.from("agent_recommendation_letters").insert({
    run_id: run.id, case_id: caseA.id, recommender_name: "Test Recommender",
    criterion_covered: "awards", letter_draft: "Synthetic draft for MTCS-07 fixture.", docx_path: letterPath,
  });
  if (letterErr) throw new Error(`fixture agent_recommendation_letters failed: ${letterErr.message}`);
  {
    const resolved = await resolveLegacyBinding(svc, letterPath);
    record("AC-07-08 (LB-04, recommendation letter)", resolved !== null && resolved.caseId === caseA.id && resolved.bucket === INTAKE_BUCKET ? "PASS" : "FAIL",
      `resolved case_id=${resolved?.caseId}, bucket=${resolved?.bucket}`);
  }

  const petitionPath = `${caseA.id}/petitions/draft-${suffix}.docx`;
  const { error: petitionErr } = await svc.from("agent_petition_drafts").insert({
    run_id: run.id, case_id: caseA.id, petition_type: "standard", visa_type: "O-1A", docx_path: petitionPath,
  });
  if (petitionErr) throw new Error(`fixture agent_petition_drafts failed: ${petitionErr.message}`);
  {
    const resolved = await resolveLegacyBinding(svc, petitionPath);
    record("AC-07-08 (LB-04, petition draft)", resolved !== null && resolved.caseId === caseA.id && resolved.bucket === INTAKE_BUCKET ? "PASS" : "FAIL",
      `resolved case_id=${resolved?.caseId}, bucket=${resolved?.bucket}`);
  }

  const i129Path = `${caseA.id}/i129/draft-${suffix}.docx`;
  const { error: i129Err } = await svc.from("i129_form_drafts").insert({
    case_id: caseA.id, docx_path: i129Path,
  });
  if (i129Err) throw new Error(`fixture i129_form_drafts failed: ${i129Err.message}`);
  {
    const resolved = await resolveLegacyBinding(svc, i129Path);
    record("AC-07-08 (LB-04, I-129 draft)", resolved !== null && resolved.caseId === caseA.id && resolved.bucket === INTAKE_BUCKET ? "PASS" : "FAIL",
      `resolved case_id=${resolved?.caseId}, bucket=${resolved?.bucket}`);
  }

  // Cross-case LB-04
  const letterBPath = `${caseB.id}/letters/rec-${suffix}.docx`;
  const { error: letterBErr } = await svc.from("agent_recommendation_letters").insert({
    run_id: run.id, case_id: caseB.id, recommender_name: "Test Recommender B",
    criterion_covered: "awards", letter_draft: "Synthetic draft B for MTCS-07 fixture.", docx_path: letterBPath,
  });
  if (letterBErr) throw new Error(`fixture agent_recommendation_letters (caseB) failed: ${letterBErr.message}`);
  {
    const resolved = await resolveLegacyBinding(svc, letterBPath);
    record("N-09 (cross-case, LB-04)", resolved !== null && resolved.caseId === caseB.id && resolved.caseId !== caseA.id ? "PASS" : "FAIL",
      `caseB's generated-letter path resolves to case_id=${resolved?.caseId} (must be caseB, never caseA)`);
  }

  // N-07: cross-case LB-02 (intake) — add a second submission for caseB with a distinct path
  const intakeBFilePath = `sess-b-${suffix}/module5/degree.pdf`;
  const { error: subBErr } = await svc.from("intake_submissions").insert({
    case_id: caseB.id, client_id: cli.id,
    module5: { degrees: [{ degreeName: "Test Degree B", filePath: intakeBFilePath, fileName: "degree.pdf" }] },
  });
  if (subBErr) throw new Error(`fixture intake_submissions (caseB) failed: ${subBErr.message}`);
  {
    const resolved = await resolveLegacyBinding(svc, intakeBFilePath);
    record("N-07 (cross-case, LB-02)", resolved !== null && resolved.caseId === caseB.id && resolved.caseId !== caseA.id ? "PASS" : "FAIL",
      `caseB's intake path resolves to case_id=${resolved?.caseId} (must be caseB, never caseA)`);
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
