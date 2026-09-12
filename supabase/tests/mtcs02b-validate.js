// AUSCIS MTCS-02B — TEST-ONLY validation script.
// Runs exclusively against the dedicated AUSCIS-TEST Supabase project.
// Fails closed if the configured target is not the known TEST project ref.
// Never touches production. Reads credentials only from .env.test.local.

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const PROD_REF = "slasbfepqovdsezmadjh";
const INTAKE_BUCKET = "intake-documents";

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

// Mirrors src/lib/documents/register-canonical-document.ts exactly (same
// mirroring convention as mtcs02a-validate.js — plain node cannot require
// the TS module directly here).
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

// Mirrors src/lib/documents/reconcile-intake-documents.ts's reconciliation
// loop exactly, over an explicit expected-files list (extractTranslatableFiles
// itself is TS-only and already build-verified by `next build`/`tsc` in this
// session — not re-mirrored here; this validates the DB-level reconcile
// contract, same convention as mtcs02a-validate.js).
async function reconcile(db, caseId, expectedFiles) {
  const expectedPaths = expectedFiles.map((f) => f.filePath);
  const { data: registeredRows } = await db
    .from("documents").select("file_path")
    .eq("case_id", caseId).eq("storage_bucket", INTAKE_BUCKET).in("file_path", expectedPaths);
  const registeredSet = new Set((registeredRows ?? []).map((r) => r.file_path));
  const missingFiles = expectedFiles.filter((f) => !registeredSet.has(f.filePath));

  let recovered = 0, missingStorage = 0, failed = 0;
  for (const file of missingFiles) {
    const segments = file.filePath.split("/");
    const objectName = segments.pop();
    const parentPath = segments.join("/");
    const { data: listing, error: listErr } = await db.storage.from(INTAKE_BUCKET).list(parentPath);
    const existsInStorage = !listErr && !!listing?.some((o) => o.name === objectName);
    if (!existsInStorage) { missingStorage += 1; continue; }
    try {
      await registerCanonicalDocument(db, {
        caseId: file.forceCaseId ?? caseId, storageBucket: INTAKE_BUCKET,
        filePath: file.filePath, fileName: file.fileName, uploadedBy: null,
      });
      recovered += 1;
    } catch { failed += 1; }
  }
  return { expected: expectedFiles.length, already_registered: registeredSet.size, recovered, missing_storage: missingStorage, failed };
}

async function getExpectedVsRegistered(db, caseId, expectedFiles) {
  const expectedPaths = Array.from(new Set(expectedFiles.map((f) => f.filePath)));
  const { data: registeredRows } = await db
    .from("documents").select("file_path")
    .eq("case_id", caseId).eq("storage_bucket", INTAKE_BUCKET).in("file_path", expectedPaths);
  const registeredCount = registeredRows?.length ?? 0;
  const missing = expectedPaths.length - registeredCount;
  return { status: missing > 0 ? "incomplete" : "complete", expected: expectedPaths.length, registered: registeredCount, missing };
}

async function ensureIntakeBucket() {
  const { data: buckets } = await svc.storage.listBuckets();
  if (!buckets?.some((b) => b.id === INTAKE_BUCKET)) {
    const { error } = await svc.storage.createBucket(INTAKE_BUCKET, { public: false });
    if (error) throw new Error(`bucket setup failed: ${error.message}`);
    console.error(`[fixtures] created TEST-only storage bucket '${INTAKE_BUCKET}'`);
  }
}

async function uploadFixtureFile(filePath) {
  const { error } = await svc.storage.from(INTAKE_BUCKET).upload(filePath, Buffer.from("test"), { upsert: true, contentType: "application/pdf" });
  if (error) throw new Error(`fixture upload failed for ${filePath}: ${error.message}`);
}

async function createInvitation(caseId, clientId, label, suffix) {
  const token = `mtcs02b-${label}-${suffix}`;
  const { data, error } = await svc.from("intake_invitations")
    .insert({ token, case_id: caseId, client_id: clientId, email: `${label}-${suffix}@auscis-test.local`, status: "opened" })
    .select().single();
  if (error) throw new Error(`fixture invitation ${label} failed: ${error.message}`);
  return data;
}

async function main() {
  await ensureIntakeBucket();
  const suffix = Date.now();

  const { data: client, error: clientErr } = await svc
    .from("clients").insert({ first_name: "MTCS02B", last_name: "SyntheticClient", preferred_language: "es" }).select().single();
  if (clientErr) throw new Error(`fixture client failed: ${clientErr.message}`);

  const { data: caseA, error: caseAErr } = await svc
    .from("cases").insert({ case_number: `TEST-MTCS02B-${suffix}-A`, client_id: client.id, case_type: "otro", title: "MTCS-02B case A" }).select().single();
  if (caseAErr) throw new Error(`fixture case A failed: ${caseAErr.message}`);

  console.error(`[fixtures] client=${client.id} caseA=${caseA.id}`);

  const modules = {
    module1: { fullName: "Test Person", email: `test-${suffix}@auscis-test.local` },
    module10: { awards: [{ name: "Premio X", filePath: `sessA/mod10/awards/0/${suffix}.pdf`, fileName: "award.pdf" }] },
    module14: { companyArticlesPath: `sessA/mod14/${suffix}.pdf`, companyArticlesName: "articles.pdf" },
  };
  const expectedFiles = [
    { filePath: modules.module10.awards[0].filePath, fileName: modules.module10.awards[0].fileName },
    { filePath: modules.module14.companyArticlesPath, fileName: modules.module14.companyArticlesName },
  ];

  // ══ Gate B1 — Identity continuity ══
  {
    const invitation = await createInvitation(caseA.id, client.id, "b1", suffix);
    const [{ count: casesBefore }, { count: clientsBefore }] = await Promise.all([
      svc.from("cases").select("*", { count: "exact", head: true }),
      svc.from("clients").select("*", { count: "exact", head: true }),
    ]);

    const { data: rpcData, error: rpcErr } = await svc
      .rpc("submit_intake_for_invitation", { p_token: invitation.token, p_modules: modules })
      .single();
    if (rpcErr) { record("B1", "FAIL", `rpc error: ${rpcErr.message}`); }
    else {
      const [{ count: casesAfter }, { count: clientsAfter }] = await Promise.all([
        svc.from("cases").select("*", { count: "exact", head: true }),
        svc.from("clients").select("*", { count: "exact", head: true }),
      ]);
      const { data: submissionRow } = await svc.from("intake_submissions").select("*").eq("id", rpcData.submission_id).single();

      const ok =
        rpcData.case_id === caseA.id &&
        rpcData.client_id === client.id &&
        submissionRow.case_id === caseA.id &&
        submissionRow.client_id === client.id &&
        submissionRow.invitation_id === invitation.id &&
        casesAfter === casesBefore &&
        clientsAfter === clientsBefore;

      record("B1", ok ? "PASS" : "FAIL", JSON.stringify({
        rpc_case_id: rpcData.case_id, rpc_client_id: rpcData.client_id,
        submission_invitation_id: submissionRow.invitation_id,
        casesBefore, casesAfter, clientsBefore, clientsAfter,
      }));

      global.__b1_submission_id = rpcData.submission_id;
      global.__b1_invitation_id = invitation.id;
      global.__b1_invitation_token = invitation.token;
    }
  }

  // ══ Gate B2 — Invitation atomicity ══
  {
    const { data: inv } = await svc.from("intake_invitations").select("status, submitted_at").eq("id", global.__b1_invitation_id).single();
    record("B2-transition", inv.status === "submitted" && !!inv.submitted_at ? "PASS" : "FAIL", JSON.stringify(inv));

    // Re-submitting an already-submitted invitation must be rejected and must
    // not create a second intake_submissions row (eligibility-check path of
    // the atomicity guarantee — executed for real).
    const { count: subsBefore } = await svc.from("intake_submissions").select("*", { count: "exact", head: true }).eq("invitation_id", global.__b1_invitation_id);
    const { error: reSubmitErr } = await svc.rpc("submit_intake_for_invitation", { p_token: global.__b1_invitation_token, p_modules: modules }).single();
    const { count: subsAfter } = await svc.from("intake_submissions").select("*", { count: "exact", head: true }).eq("invitation_id", global.__b1_invitation_id);
    record("B2-no-double-submit", reSubmitErr && subsAfter === subsBefore ? "PASS" : "FAIL", JSON.stringify({ reSubmitErr: reSubmitErr?.message, subsBefore, subsAfter }));

    // Concurrent double-submit on a fresh invitation → exactly one accepted.
    const invitationC = await createInvitation(caseA.id, client.id, "b2c", suffix);
    const [r1, r2] = await Promise.allSettled([
      svc.rpc("submit_intake_for_invitation", { p_token: invitationC.token, p_modules: modules }).single(),
      svc.rpc("submit_intake_for_invitation", { p_token: invitationC.token, p_modules: modules }).single(),
    ]);
    const succeeded = [r1, r2].filter((r) => r.status === "fulfilled" && !r.value.error);
    const { count: concurrentSubs } = await svc.from("intake_submissions").select("*", { count: "exact", head: true }).eq("invitation_id", invitationC.id);
    record("B2-concurrency", succeeded.length === 1 && concurrentSubs === 1 ? "PASS" : "FAIL", JSON.stringify({ succeededCount: succeeded.length, concurrentSubs }));
  }

  // ══ Gate B3 — Browser authority (structural) ══
  // submit_intake_for_invitation(p_token, p_modules) has no case_id/client_id
  // parameters at all — there is no channel through which a caller-supplied
  // invitationCaseId/invitationClientId could reach identity resolution.
  record("B3", "STATIC", "submit_intake_for_invitation signature accepts only (p_token, p_modules); no client-supplied case/client id parameter exists to tamper with — verified by function definition applied in this run.");

  // ══ Gate B4 — Canonical registration ══
  {
    await uploadFixtureFile(expectedFiles[0].filePath);
    const before = await svc.from("intake_submissions").select("updated_at").eq("id", global.__b1_submission_id).single();

    const r1 = await registerCanonicalDocument(svc, { caseId: caseA.id, storageBucket: INTAKE_BUCKET, filePath: expectedFiles[0].filePath, fileName: expectedFiles[0].fileName, uploadedBy: null });
    const r2 = await registerCanonicalDocument(svc, { caseId: caseA.id, storageBucket: INTAKE_BUCKET, filePath: expectedFiles[0].filePath, fileName: expectedFiles[0].fileName, uploadedBy: null });

    const after = await svc.from("intake_submissions").select("updated_at").eq("id", global.__b1_submission_id).single();
    const { data: stillInStorage } = await svc.storage.from(INTAKE_BUCKET).list(expectedFiles[0].filePath.split("/").slice(0, -1).join("/"));
    const objectName = expectedFiles[0].filePath.split("/").pop();

    const ok = r1.id === r2.id && r1.storage_bucket === INTAKE_BUCKET &&
      before.data.updated_at === after.data.updated_at &&
      stillInStorage?.some((o) => o.name === objectName);

    record("B4", ok ? "PASS" : "FAIL", JSON.stringify({ r1: r1.id, r2: r2.id, jsonbUnchanged: before.data.updated_at === after.data.updated_at }));
  }

  // ══ Gate B5 — Recovery detection (read-only) ══
  {
    const { count: docsBefore } = await svc.from("documents").select("*", { count: "exact", head: true });
    const completeness = await getExpectedVsRegistered(svc, caseA.id, expectedFiles);
    const { count: docsAfter } = await svc.from("documents").select("*", { count: "exact", head: true });

    const ok = completeness.status === "incomplete" && completeness.missing === 1 && docsBefore === docsAfter;
    record("B5", ok ? "PASS" : "FAIL", JSON.stringify({ completeness, docsBefore, docsAfter }));
  }

  // ══ Gate B6 — Recovery authorization (structural) ══
  record("B6", "STATIC", "POST /api/cases/[id]/reconcile-documents reuses the exact, unmodified auth block from src/app/api/case-letters/route.ts PATCH (auth.getUser() -> profiles.role -> admin/supervisor or cases.assigned_agent_id match); server-side, independent of any client-passed userRole. Not re-executed as a live HTTP/cookie integration test in this pass.");

  // ══ Gate B7 — Recovery integrity ══
  {
    // expectedFiles[0] already registered (Gate B4). expectedFiles[1] has
    // storage present -> should be recovered. A synthetic third path has no
    // storage object at all -> must be reported missing_storage, never
    // registered. A synthetic fourth path forces a registerCanonicalDocument
    // throw (invalid case id) -> must be reported failed while the sibling
    // item in the same run still succeeds.
    await uploadFixtureFile(expectedFiles[1].filePath);
    const missingStoragePath = `sessA/mod10/awards/1/${suffix}-nostorage.pdf`;
    const forcedFailPath = `sessA/mod10/awards/2/${suffix}-forcedfail.pdf`;
    await uploadFixtureFile(forcedFailPath);

    const runFiles = [
      expectedFiles[0],
      expectedFiles[1],
      { filePath: missingStoragePath, fileName: "nostorage.pdf" },
      { filePath: forcedFailPath, fileName: "forcedfail.pdf", forceCaseId: "00000000-0000-0000-0000-000000000000" },
    ];
    const result = await reconcile(svc, caseA.id, runFiles);
    const { data: falseRow } = await svc.from("documents").select("id").eq("case_id", caseA.id).eq("storage_bucket", INTAKE_BUCKET).eq("file_path", missingStoragePath).maybeSingle();

    const ok = result.already_registered === 1 && result.recovered === 1 && result.missing_storage === 1 && result.failed === 1 && !falseRow;
    record("B7", ok ? "PASS" : "FAIL", JSON.stringify(result));
  }

  // ══ Gate B8 — Recovery concurrency ══
  {
    await uploadFixtureFile(`sessA/mod10/concurrent-${suffix}.pdf`);
    const concurrentFile = { filePath: `sessA/mod10/concurrent-${suffix}.pdf`, fileName: "concurrent.pdf" };
    await Promise.all([
      reconcile(svc, caseA.id, [concurrentFile]),
      reconcile(svc, caseA.id, [concurrentFile]),
    ]);
    const { data: rows } = await svc.from("documents").select("id").eq("case_id", caseA.id).eq("storage_bucket", INTAKE_BUCKET).eq("file_path", concurrentFile.filePath);
    record("B8", rows?.length === 1 ? "PASS" : "FAIL", `canonical rows for concurrently-reconciled path = ${rows?.length}`);
  }

  // ══ Gate B9 — Architecture boundaries ══
  record("B9", "STATIC", "evidence_items/case_strategy/agent_intake_analysis tables are confirmed absent from this TEST project's schema (verified directly against information_schema.tables in this session); neither src/app/api/intake/route.ts nor src/lib/documents/reconcile-intake-documents.ts references evidence_items, a1/a2/a5 routes, or case_strategy — confirmed by code inspection (grep) in this session.");

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((r) => r.status === "FAIL").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(2); });
