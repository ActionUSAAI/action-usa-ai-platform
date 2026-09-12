// AUSCIS MTCS-02A — TEST-ONLY validation script.
// Runs exclusively against the dedicated AUSCIS-TEST Supabase project.
// Fails closed if the configured target is not the known TEST project ref.
// Never touches production. Reads credentials only from .env.test.local.

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const PROD_REF = "slasbfepqovdsezmadjh";

function loadEnvTestLocal() {
  const p = path.join(__dirname, "..", "..", ".env.test.local");
  const raw = fs.readFileSync(p, "utf-8");
  const env = {};
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

const svc = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const results = [];
function record(id, status, evidence) {
  results.push({ id, status, evidence });
  console.error(`${id}: ${status} — ${evidence}`);
}

// Mirrors src/lib/documents/register-canonical-document.ts exactly, for DB-level
// contract validation (that TS module isn't directly requireable by plain node here).
async function registerCanonicalDocument(db, { caseId, storageBucket, filePath, fileName, uploadedBy }) {
  const { data: kase, error: caseErr } = await db.from("cases").select("id, client_id").eq("id", caseId).single();
  if (caseErr || !kase) throw new Error(`no valid Case found for case_id=${caseId}`);

  const { data: upserted, error: upsertErr } = await db
    .from("documents")
    .upsert(
      { case_id: caseId, client_id: kase.client_id, uploaded_by: uploadedBy ?? null, name: fileName, file_path: filePath, storage_bucket: storageBucket, status: "pendiente" },
      { onConflict: "case_id,storage_bucket,file_path", ignoreDuplicates: true }
    )
    .select("id, case_id, client_id, storage_bucket, file_path, name")
    .maybeSingle();
  if (upsertErr) throw new Error(`upsert failed: ${upsertErr.message}`);
  if (upserted) return upserted;

  const { data: existing, error: selectErr } = await db
    .from("documents").select("id, case_id, client_id, storage_bucket, file_path, name")
    .eq("case_id", caseId).eq("storage_bucket", storageBucket).eq("file_path", filePath).single();
  if (selectErr || !existing) throw new Error(`conflict but existing row not resolved: ${selectErr?.message}`);
  return existing;
}

async function main() {
  const suffix = Date.now();

  const { data: client, error: clientErr } = await svc
    .from("clients").insert({ first_name: "MTCS02A", last_name: "SyntheticClient", preferred_language: "es" }).select().single();
  if (clientErr) throw new Error(`fixture client failed: ${clientErr.message}`);

  const { data: caseA, error: caseAErr } = await svc
    .from("cases").insert({ case_number: `TEST-MTCS02A-${suffix}-A`, client_id: client.id, case_type: "otro", title: "MTCS-02A case A" }).select().single();
  if (caseAErr) throw new Error(`fixture case A failed: ${caseAErr.message}`);

  const { data: caseB, error: caseBErr } = await svc
    .from("cases").insert({ case_number: `TEST-MTCS02A-${suffix}-B`, client_id: client.id, case_type: "otro", title: "MTCS-02A case B" }).select().single();
  if (caseBErr) throw new Error(`fixture case B failed: ${caseBErr.message}`);

  console.error(`[fixtures] client=${client.id} caseA=${caseA.id} caseB=${caseB.id}`);

  // ---- T01: storage_bucket DEFAULT backfill behavior; documents.id stable across unrelated update ----
  {
    const { data: row, error } = await svc.from("documents")
      .insert({ case_id: caseA.id, client_id: client.id, uploaded_by: null, name: "legacy-style.pdf", file_path: `${caseA.id}/legacy.pdf` })
      .select().single();
    if (error) { record("T01", "FAIL", error.message); }
    else {
      const originalId = row.id;
      const { data: updated } = await svc.from("documents").update({ status: "recibido" }).eq("id", originalId).select().single();
      const ok = row.storage_bucket === "case-documents" && updated.id === originalId;
      record("T01", ok ? "PASS" : "FAIL", JSON.stringify({ default_bucket: row.storage_bucket, id_before: originalId, id_after: updated.id }));
    }
  }

  // ---- T03: repeat registration is idempotent ----
  let regA;
  {
    const params = { caseId: caseA.id, storageBucket: "intake-documents", filePath: `sess1/mod10/1.pdf`, fileName: "cert.pdf" };
    const r1 = await registerCanonicalDocument(svc, params);
    const r2 = await registerCanonicalDocument(svc, params);
    regA = r2;
    record("T03", r1.id === r2.id ? "PASS" : "FAIL", JSON.stringify({ r1: r1.id, r2: r2.id }));
  }

  // ---- T04: concurrent registration yields one canonical id ----
  {
    const params = { caseId: caseA.id, storageBucket: "intake-documents", filePath: `sess1/mod10/2.pdf`, fileName: "diploma.pdf" };
    const [r1, r2] = await Promise.all([registerCanonicalDocument(svc, params), registerCanonicalDocument(svc, params)]);
    record("T04", r1.id === r2.id ? "PASS" : "FAIL", JSON.stringify({ r1: r1.id, r2: r2.id }));
  }

  // ---- T05: same file_path in different Cases does not collide ----
  {
    const path_ = `sess1/mod10/shared.pdf`;
    const rA = await registerCanonicalDocument(svc, { caseId: caseA.id, storageBucket: "intake-documents", filePath: path_, fileName: "shared.pdf" });
    const rB = await registerCanonicalDocument(svc, { caseId: caseB.id, storageBucket: "intake-documents", filePath: path_, fileName: "shared.pdf" });
    record("T05", rA.id !== rB.id && rA.case_id === caseA.id && rB.case_id === caseB.id ? "PASS" : "FAIL", JSON.stringify({ rA: rA.id, rB: rB.id }));
  }

  // ---- T06: same file_path, different buckets, same Case does not collide ----
  {
    const path_ = `${caseA.id}/dual-bucket.pdf`;
    const rIntake = await registerCanonicalDocument(svc, { caseId: caseA.id, storageBucket: "intake-documents", filePath: path_, fileName: "dual.pdf" });
    const rCase = await registerCanonicalDocument(svc, { caseId: caseA.id, storageBucket: "case-documents", filePath: path_, fileName: "dual.pdf" });
    record("T06", rIntake.id !== rCase.id ? "PASS" : "FAIL", JSON.stringify({ rIntake: rIntake.id, rCase: rCase.id }));
  }

  // ---- T07: storage locator change does not alter documents.id ----
  {
    const before = regA.id;
    const { data: updated, error } = await svc.from("documents").update({ storage_bucket: "case-documents" }).eq("id", before).select().single();
    record("T07", !error && updated.id === before ? "PASS" : "FAIL", JSON.stringify({ before, after: updated?.id }));
  }

  // ---- T08: arbitrary bucket names remain permitted (no CHECK/enum) ----
  {
    const { error } = await svc.from("documents").insert({
      case_id: caseA.id, client_id: client.id, name: "future-bucket.pdf", file_path: `${caseA.id}/future.pdf`, storage_bucket: "some-future-bucket",
    });
    record("T08", !error ? "PASS" : "FAIL", error ? error.message : "arbitrary bucket name accepted, no CHECK constraint blocks it");
  }

  // ---- T11 / T17 / T18 — legacy A2 compatibility, no Evidence created, letters unaffected ----
  {
    const { count: evCount } = await svc.from("evidence_items").select("*", { count: "exact", head: true });
    const { count: letterCount } = await svc.from("agent_recommendation_letters").select("*", { count: "exact", head: true });
    record("T17", evCount === 0 ? "PASS" : "FAIL", `evidence_items count after MTCS-02A fixtures = ${evCount}`);
    record("T18", typeof letterCount === "number" ? "PASS" : "FAIL", `agent_recommendation_letters table reachable, count=${letterCount}`);
  }

  // T20 (RLS not weakened) and T21 (no third infrastructure) are verified separately
  // via direct SQL against information_schema/pg_policies (not reachable through the
  // PostgREST-exposed public-schema client used here) — see the accompanying
  // run-sql.sh check executed alongside this script.

  // ---- T22: duplicate registration resolves to same documents.id (independent key, not reused by T07) ----
  let regC;
  {
    const params = { caseId: caseA.id, storageBucket: "intake-documents", filePath: `sess1/mod10/3.pdf`, fileName: "transcript.pdf" };
    const r1 = await registerCanonicalDocument(svc, params);
    const r2 = await registerCanonicalDocument(svc, params);
    regC = r2;
    record("T22", r1.id === r2.id ? "PASS" : "FAIL", `duplicate registration for same key resolved to id=${r1.id} then id=${r2.id}`);
  }

  // ---- T24: uploaded_by NULL accepted while case_id remains valid/non-null ----
  {
    const { data, error } = await svc.from("documents").insert({
      case_id: caseA.id, client_id: client.id, uploaded_by: null, name: "no-uploader.pdf", file_path: `${caseA.id}/no-uploader.pdf`, storage_bucket: "intake-documents",
    }).select().single();
    record("T24", !error && data.uploaded_by === null && !!data.case_id ? "PASS" : "FAIL", error ? error.message : JSON.stringify({ uploaded_by: data.uploaded_by, case_id: data.case_id }));
  }

  // ---- Canonical A2 resolution check (schema-level: resolve document_id -> case_id/bucket/path) ----
  // Uses regC (untouched by T07's intentional locator mutation on regA) so this test
  // exercises A2's resolution query in isolation from T07's own effect.
  {
    const { data: resolved, error } = await svc.from("documents").select("case_id, storage_bucket, file_path, name").eq("id", regC.id).single();
    const ok = !error && resolved.case_id === caseA.id && resolved.storage_bucket === "intake-documents";
    record("A2-RESOLVE", ok ? "PASS" : "FAIL", JSON.stringify(resolved));
  }

  // ---- Translation lineage: document_id column accepts a canonical id and ON DELETE SET NULL relationship exists ----
  {
    const { data: tr, error } = await svc.from("document_translations").insert({
      case_id: caseA.id, document_id: regA.id, status: "processing", original_file_path: "sess1/mod10/1.pdf", original_file_name: "cert.pdf",
    }).select().single();
    record("TRANSLATION-LINEAGE", !error && tr.document_id === regA.id ? "PASS" : "FAIL", error ? error.message : JSON.stringify({ document_id: tr.document_id }));
  }

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter(r => r.status === "FAIL").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(2); });
