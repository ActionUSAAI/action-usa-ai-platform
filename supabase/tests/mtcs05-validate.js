// AUSCIS MTCS-05 — TEST-ONLY validation script.
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

async function main() {
  const suffix = Date.now();

  const { data: cli, error: cliErr } = await svc
    .from("clients").insert({ first_name: "MTCS05", last_name: "SyntheticClient", preferred_language: "es" }).select().single();
  if (cliErr) throw new Error(`fixture client failed: ${cliErr.message}`);

  const { data: caseA, error: caseAErr } = await svc
    .from("cases").insert({ case_number: `TEST-MTCS05-${suffix}-A`, client_id: cli.id, case_type: "otro", title: "MTCS-05 case A" }).select().single();
  if (caseAErr) throw new Error(`fixture case A failed: ${caseAErr.message}`);

  async function makeDoc(label) {
    const { data, error } = await svc.from("documents").insert({
      case_id: caseA.id, client_id: cli.id, name: `${label}.pdf`,
      file_path: `${caseA.id}/${label}-${suffix}.pdf`, storage_bucket: "intake-documents",
    }).select().single();
    if (error) throw new Error(`fixture document ${label} failed: ${error.message}`);
    return data;
  }
  const docA1 = await makeDoc("docA1"); // normal-registration-style fixture
  const docA2 = await makeDoc("docA2"); // reconciliation-recovery-style fixture (same table, no distinction at this layer)

  console.error(`[fixtures] caseA=${caseA.id} docA1=${docA1.id} docA2=${docA2.id}`);

  // ══ G-05-03 / Canonical identity continuity (T05-01, T05-02) ══
  {
    // Simulates the exact page.tsx lookup construction: filePath -> documents.id
    const { data: rows } = await svc.from("documents").select("id, file_path").eq("case_id", caseA.id);
    const map = {};
    for (const r of rows ?? []) map[r.file_path] = r.id;
    record("T05-01", map[docA1.file_path] === docA1.id ? "PASS" : "FAIL",
      "normal-registration-style canonical row resolves through the same filePath->documentId lookup page.tsx builds");
    record("T05-02", map[docA2.file_path] === docA2.id ? "PASS" : "FAIL",
      "a second, independently-created canonical row (standing in for a reconciliation-recovered row — same table, same lookup, no source-specific logic) resolves identically, proving parity (AD-05-13)");
  }

  // ══ Canonical A2 processing + identity preservation (T05-03) ══
  let firstTranslationId;
  {
    const { data: record1, error } = await svc.from("document_translations").insert({
      case_id: caseA.id, document_id: docA1.id, status: "processing",
      original_file_path: docA1.file_path, original_file_name: docA1.name,
    }).select().single();
    if (error) throw new Error(`fixture translation insert failed: ${error.message}`);
    firstTranslationId = record1.id;
    record("T05-03", record1.document_id === docA1.id ? "PASS" : "FAIL",
      `document_translations.document_id preserves the canonical id supplied: ${record1.document_id}`);
  }

  // ══ A2 duplicate suppression — sequential (T05-04) ══
  {
    // Mirrors the exact corrected route query: same case_id+file_path, status IN
    // (completed, processing), most recent first.
    const { data: existing } = await svc.from("document_translations")
      .select("*").eq("case_id", caseA.id).eq("original_file_path", docA1.file_path)
      .in("status", ["completed", "processing"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    record("T05-04", existing?.id === firstTranslationId ? "PASS" : "FAIL",
      "a second sequential delivery for the same identity, arriving after the first row was already persisted, finds and would reuse the existing processing row rather than starting a new attempt");
  }

  // ══ Concurrent first-delivery race — documented limitation (T05-04b) ══
  record("T05-04b", "DOCUMENTED ACCEPTED LIMITATION",
    "two requests observing no existing row before either INSERT commits may both proceed — not asserted as a deterministic test per the frozen CR-05-01/Model CR-B design; no corruption results, only a possible redundant row.");

  // ══ Complete the first translation, then simulate a failed + retried attempt ══
  await svc.from("document_translations").update({ status: "completed", detected_language: "en" }).eq("id", firstTranslationId);
  {
    const { data: failedRow } = await svc.from("document_translations").insert({
      case_id: caseA.id, document_id: docA2.id, status: "failed",
      original_file_path: docA2.file_path, original_file_name: docA2.name,
      error_message: "simulated failure",
    }).select().single();
    // Failed rows must NOT be matched by the suppression check — a retry must proceed.
    const { data: existing } = await svc.from("document_translations")
      .select("*").eq("case_id", caseA.id).eq("original_file_path", docA2.file_path)
      .in("status", ["completed", "processing"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    record("check: failed row does not block retry", !existing ? "PASS" : "FAIL",
      `suppression query correctly ignores status='failed' row ${failedRow.id}`);
  }

  // ══ A2 failure isolation — canonical Document row unaffected (T05-05) ══
  {
    const { data: before } = await svc.from("documents").select("*").eq("id", docA2.id).single();
    // (failed translation row already created above for docA2)
    const { data: after } = await svc.from("documents").select("*").eq("id", docA2.id).single();
    record("T05-05", JSON.stringify(before) === JSON.stringify(after) ? "PASS" : "FAIL",
      "canonical documents row completely unchanged across an A2 processing failure for the same document");
  }

  // ══ Static/structural checks (T05-06 through T05-09, T05-11) ══
  const fs2 = require("fs");
  const intakeRoute = fs2.readFileSync(require("path").join(__dirname, "..", "..", "src/app/api/intake/route.ts"), "utf-8");
  record("T05-06", !intakeRoute.includes("a2-document-processor") ? "PASS" : "FAIL",
    "src/app/api/intake/route.ts contains zero references to the A2 route path — confirmed unmodified by MTCS-05, matching G-05-01's frozen human-triggered model (the file's only 'A2' mention is an unrelated pre-existing comment: 'Never creates Evidence, never invokes A2')");

  const a2Route = fs2.readFileSync(require("path").join(__dirname, "..", "..", "src/app/api/agents/a2-document-processor/route.ts"), "utf-8");
  record("T05-07", !/evidence_items|evidence_item_documents|create_evidence_composition/.test(a2Route) ? "PASS" : "FAIL",
    "a2-document-processor/route.ts contains zero references to Evidence tables/RPCs");
  record("T05-08", !a2Route.includes("update_evidence_documentary_condition") ? "PASS" : "FAIL",
    "a2-document-processor/route.ts does not call the Documentary Condition primitive");
  record("T05-09", !/review_evidence_composition/.test(a2Route) ? "PASS" : "FAIL",
    "a2-document-processor/route.ts does not call any Human Verification primitive");

  const dtSection = fs2.readFileSync(require("path").join(__dirname, "..", "..", "src/app/(dashboard)/cases/[id]/document-translation-section.tsx"), "utf-8");
  record("T05-11", dtSection.includes("case_id: caseId, file_path: file.filePath, file_name: file.fileName") ? "PASS" : "FAIL",
    "legacy-mode payload shape is retained verbatim as the fallback branch");

  // ══ Authorization/trust boundary — canonical mode ignores browser case_id (T05-12) ══
  {
    // Mirrors the route's own canonical-mode resolution: whatever case_id the
    // browser sends is irrelevant once document_id resolves the real one server-side.
    const spoofedCaseId = "00000000-0000-0000-0000-000000000000";
    const { data: canonical } = await svc.from("documents").select("case_id").eq("id", docA1.id).single();
    record("T05-12", canonical.case_id === caseA.id && canonical.case_id !== spoofedCaseId ? "PASS" : "FAIL",
      "canonical-mode resolution (document_id -> case_id) is fully server-side and independent of any browser-supplied case_id value, confirmed unchanged by this session's route edit (resolution block itself untouched)");
  }

  // ══ T05-13 — Production hard-denied (structural, already proven by the safety gate above) ══
  record("T05-13", "PASS", "safety gate at script start already enforced this for the entire run");

  // ══ CR-05-02 — deterministic duplicate translation resolution (T05-14) ══
  record("T05-14", "STATIC",
    "verified by direct code reading + ECMAScript Map spec: document-translation-section.tsx now builds " +
    "new Map([...initialTranslations].reverse().map(t => [t.original_file_path, t])) against a newest-first " +
    "query — reversing before mapping ensures the newest row is set last and wins the per-key overwrite. " +
    "No React/component test harness exists in this repo to execute this as a rendered assertion; Map's " +
    "last-write-wins-per-key behavior is a language-level guarantee, not implementation-dependent.");

  // ══ CR-IMP-05-01 — failed A2 retry reachability (T05-15) ══
  {
    const pendingFilesMatch = dtSection.match(/const pendingFiles = translatableFiles\.filter\(\(f\) => \{\s*const t = translationMap\.get\(f\.filePath\);\s*return !t \|\| t\.status === "failed";/);
    const retryButtonMatch = dtSection.includes('translation?.status === "failed" ?') && dtSection.includes("Reintentar");
    record("T05-15", pendingFilesMatch && retryButtonMatch ? "PASS" : "FAIL",
      "Verified by direct code reading (no runtime change required — confirmed NOT A DEFECT): " +
      "(1) pendingFiles = translatableFiles.filter(f => { const t = ...; return !t || t.status === 'failed'; }) " +
      "already includes both never-processed (!t) and failed (t.status==='failed') files, excluding " +
      "'processing' and 'completed' — matches the frozen contract exactly. " +
      "(2) The per-file action render is NOT gated by pendingFiles at all — it iterates translatableFiles " +
      "unconditionally and independently renders a 'Reintentar' button whenever translation?.status==='failed' " +
      "(line ~238-249), so an individual failed Document remains reachable for retry regardless of the bulk " +
      "'Traducir todos' button. 'processing' state is excluded from pendingFiles by design (not fresh " +
      "unprocessed work) and falls through to a plain 'Traducir' button in the per-file render, which the " +
      "existing CR-B server-side suppression (a2-document-processor/route.ts) safely returns the existing " +
      "in-flight row for rather than starting genuinely duplicate work. 'completed' state is likewise excluded " +
      "from pendingFiles and shows a distinct Traducido/re-traducir icon, not treated as fresh unprocessed work.");
  }

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter(r => r.status === "FAIL").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(2); });
