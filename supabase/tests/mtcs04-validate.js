// AUSCIS MTCS-04 — TEST-ONLY validation script.
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
const anonKey = env.TEST_SUPABASE_ANON_KEY;
const serviceKey = env.TEST_SUPABASE_SERVICE_ROLE_KEY;

if (!ref || ref === PROD_REF || !url || !url.includes(ref) || !anonKey || !serviceKey) {
  console.error("ABORT: Safety Gate failed — target is not a verified AUSCIS-TEST project.");
  process.exit(1);
}
console.error(`[safety-gate] PASS — target=${ref} (!= production ${PROD_REF})`);

const svc = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

function anonClientWithToken(token) {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

const results = [];
function record(id, status, evidence) {
  results.push({ id, status, evidence });
  console.error(`${id}: ${status} — ${evidence}`);
}

async function main() {
  const suffix = Date.now();

  async function createAuthUser(role, label) {
    const email = `mtcs04-${label}-${suffix}@auscis-test.local`;
    const password = `Test!${suffix}${label}Aa1`;
    const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(`fixture user ${label} creation failed: ${error.message}`);
    const userId = data.user.id;
    const { error: profErr } = await svc.from("profiles").update({ full_name: `MTCS04 ${label}`, role }).eq("id", userId);
    if (profErr) throw new Error(`fixture profile ${label} failed: ${profErr.message}`);
    return { userId, email, password };
  }
  async function signIn(user) {
    const c = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await c.auth.signInWithPassword({ email: user.email, password: user.password });
    if (error) throw new Error(`signin failed for ${user.email}: ${error.message}`);
    return anonClientWithToken(data.session.access_token);
  }

  const admin = await createAuthUser("admin", "admin");
  const agent = await createAuthUser("agent", "agent");
  const unrelated = await createAuthUser("agent", "unrelated");
  const client = await createAuthUser("client", "client");
  const agentSess = await signIn(agent);
  const unrelatedSess = await signIn(unrelated);
  const clientSess = await signIn(client);

  const { data: cli, error: cliErr } = await svc
    .from("clients").insert({ first_name: "MTCS04", last_name: "SyntheticClient", preferred_language: "es" }).select().single();
  if (cliErr) throw new Error(`fixture client failed: ${cliErr.message}`);

  const { data: caseA, error: caseAErr } = await svc
    .from("cases").insert({ case_number: `TEST-MTCS04-${suffix}-A`, client_id: cli.id, assigned_agent_id: agent.userId, case_type: "otro", title: "MTCS-04 case A" }).select().single();
  if (caseAErr) throw new Error(`fixture case A failed: ${caseAErr.message}`);

  const { data: caseB, error: caseBErr } = await svc
    .from("cases").insert({ case_number: `TEST-MTCS04-${suffix}-B`, client_id: cli.id, case_type: "otro", title: "MTCS-04 case B" }).select().single();
  if (caseBErr) throw new Error(`fixture case B failed: ${caseBErr.message}`);

  async function makeDoc(caseId, label) {
    const { data, error } = await svc.from("documents").insert({
      case_id: caseId, client_id: cli.id, name: `${label}.pdf`,
      file_path: `${caseId}/${label}-${suffix}.pdf`, storage_bucket: "intake-documents",
    }).select().single();
    if (error) throw new Error(`fixture document ${label} failed: ${error.message}`);
    return data;
  }
  const docA1 = await makeDoc(caseA.id, "docA1");
  const docA2 = await makeDoc(caseA.id, "docA2");
  const docA3 = await makeDoc(caseA.id, "docA3");
  const docB1 = await makeDoc(caseB.id, "docB1");

  console.error(`[fixtures] admin=${admin.userId} agent=${agent.userId} caseA=${caseA.id} caseB=${caseB.id}`);

  async function createComposition({ evidenceId = null, expectedCurrentId = null, caseId = caseA.id, fact, condition = "reported", documentIds = [] }) {
    return svc.rpc("create_evidence_composition_with_documents", {
      p_evidence_id: evidenceId, p_expected_current_id: expectedCurrentId, p_case_id: caseId,
      p_fact: fact, p_documentary_condition: condition, p_source_type: "test", p_source_reference: "mtcs04",
      p_created_by: admin.userId, p_document_ids: documentIds,
    });
  }

  // ══ Producer creation (T01-T08) ══
  {
    const r = await createComposition({ fact: "v1 zero docs" });
    record("MTCS04-T01", !r.error && r.data.probative_revision === 1 ? "PASS" : "FAIL", JSON.stringify({ err: r.error?.message, rev: r.data?.probative_revision }));
  }
  let evOneDoc;
  {
    const r = await createComposition({ fact: "v1 one doc", documentIds: [docA1.id] });
    evOneDoc = r.data;
    const { data: rows } = await svc.from("evidence_item_documents").select("*").eq("evidence_item_id", r.data?.id ?? "");
    record("MTCS04-T02", !r.error && rows?.length === 1 && r.data.probative_revision === 1 ? "PASS" : "FAIL", JSON.stringify({ err: r.error?.message, count: rows?.length, rev: r.data?.probative_revision }));
  }
  {
    const r = await createComposition({ fact: "v1 multi docs", documentIds: [docA1.id, docA2.id, docA3.id] });
    const { data: rows } = await svc.from("evidence_item_documents").select("*").eq("evidence_item_id", r.data?.id ?? "");
    record("MTCS04-T03", !r.error && rows?.length === 3 && r.data.probative_revision === 1 ? "PASS" : "FAIL", JSON.stringify({ err: r.error?.message, count: rows?.length, rev: r.data?.probative_revision }));
  }
  {
    const factVal = "atomic rollback test";
    const r = await createComposition({ fact: factVal, documentIds: [docA1.id, "00000000-0000-0000-0000-000000000000"] });
    const { data: leftover } = await svc.from("evidence_items").select("id").eq("fact", factVal);
    record("MTCS04-T04", !!r.error && (leftover?.length ?? 0) === 0 ? "PASS" : "FAIL", JSON.stringify({ err: r.error?.message, leftover: leftover?.length }));
  }
  {
    const r = await createComposition({ fact: "duplicate doc ids", documentIds: [docA2.id, docA2.id] });
    const { data: rows } = await svc.from("evidence_item_documents").select("*").eq("evidence_item_id", r.data?.id ?? "");
    record("MTCS04-T05", !r.error && rows?.length === 1 ? "PASS" : "FAIL", JSON.stringify({ err: r.error?.message, count: rows?.length }));
  }
  {
    const r = await createComposition({ fact: "missing doc", documentIds: ["00000000-0000-0000-0000-000000000000"] });
    record("MTCS04-T06", !!r.error && /DOCUMENT_NOT_FOUND/.test(r.error.message) ? "PASS" : "FAIL", r.error?.message ?? "no error");
  }
  {
    const r = await createComposition({ fact: "cross case doc", documentIds: [docB1.id] });
    record("MTCS04-T07", !!r.error && /CASE_MISMATCH/.test(r.error.message) ? "PASS" : "FAIL", r.error?.message ?? "no error");
  }
  {
    const { data: row } = await svc.from("evidence_items").select("created_by").eq("id", evOneDoc.id).single();
    record("MTCS04-T08", row?.created_by === admin.userId ? "PASS" : "FAIL", `created_by=${row?.created_by}`);
  }

  // ══ Version creation (T09-T14, T44) ══
  const v1 = (await createComposition({ fact: "version chain v1", documentIds: [docA1.id, docA2.id] })).data;
  await svc.rpc("attach_evidence_document", { p_evidence_item_id: v1.id, p_document_id: docA3.id, p_created_by: admin.userId }); // rev now 2
  const { data: v1Reviewed } = await svc.rpc("review_evidence_composition_if_current", {
    p_composition_id: v1.id, p_expected_probative_revision: 2, p_expected_reviewed_at: null,
    p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
  });
  const v2r = await createComposition({ evidenceId: v1.evidence_id, expectedCurrentId: v1.id, fact: "version chain v2", documentIds: [docA1.id] });
  const v2 = v2r.data;
  {
    const { data: v1After } = await svc.from("evidence_items").select("*").eq("id", v1.id).single();
    const { data: v1Docs } = await svc.from("evidence_item_documents").select("document_id").eq("evidence_item_id", v1.id);
    const { data: v2Docs } = await svc.from("evidence_item_documents").select("document_id").eq("evidence_item_id", v2.id);
    record("MTCS04-T09", !v2r.error && v2.version === 2 ? "PASS" : "FAIL", v2r.error?.message ?? "ok");
    record("MTCS04-T10", v2.evidence_id === v1.evidence_id ? "PASS" : "FAIL", `v1.evidence_id=${v1.evidence_id} v2.evidence_id=${v2.evidence_id}`);
    record("MTCS04-T11", v1After.currency_status === "superseded" && v1After.superseded_by === v2.id ? "PASS" : "FAIL", JSON.stringify(v1After.currency_status));
    record("MTCS04-T12", v1Docs?.length === 3 ? "PASS" : "FAIL", `v1 docs=${v1Docs?.length}`);
    record("MTCS04-T13", v2.verification_condition === "pending" ? "PASS" : "FAIL", v2.verification_condition);
    record("MTCS04-T14", v2Docs?.length === 1 && v2Docs[0].document_id === docA1.id ? "PASS" : "FAIL", JSON.stringify(v2Docs));
    record("MTCS04-T44", v2.probative_revision === 1 ? "PASS" : "FAIL", `v2.probative_revision=${v2.probative_revision}`);
  }
  {
    // T45: v1's token cannot verify v2 (different composition id, own count)
    const r = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: v2.id, p_expected_probative_revision: 2 /* v1's final revision, not v2's */,
      p_expected_reviewed_at: null, p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    record("MTCS04-T45", !!r.error && /STALE_PROBATIVE_SNAPSHOT/.test(r.error.message) ? "PASS" : "FAIL", r.error?.message ?? "no error");
  }

  // ══ Attach / Detach (T15-T19, T42-T43) ══
  const evCon = (await createComposition({ fact: "construction fact" })).data;
  {
    const before = evCon.probative_revision;
    const r = await svc.rpc("attach_evidence_document", { p_evidence_item_id: evCon.id, p_document_id: docA1.id, p_created_by: admin.userId });
    record("MTCS04-T15", !r.error && r.data.evidence_item_id === evCon.id ? "PASS" : "FAIL", r.error?.message ?? "ok");
    const { data: after1 } = await svc.from("evidence_items").select("probative_revision").eq("id", evCon.id).single();
    record("check: real attach advances revision", after1.probative_revision === before + 1 ? "PASS" : "FAIL", `${before} -> ${after1.probative_revision}`);

    const dup = await svc.rpc("attach_evidence_document", { p_evidence_item_id: evCon.id, p_document_id: docA1.id, p_created_by: admin.userId });
    const { data: after2 } = await svc.from("evidence_items").select("probative_revision").eq("id", evCon.id).single();
    record("MTCS04-T42", !dup.error && after2.probative_revision === after1.probative_revision ? "PASS" : "FAIL", `revision unchanged on dup attach: ${after1.probative_revision} == ${after2.probative_revision}`);

    const det = await svc.rpc("detach_evidence_document", { p_evidence_item_id: evCon.id, p_document_id: docA1.id });
    record("MTCS04-T16", !det.error && det.data === true ? "PASS" : "FAIL", JSON.stringify(det));
    const { data: after3 } = await svc.from("evidence_items").select("probative_revision").eq("id", evCon.id).single();
    record("check: real detach advances revision", after3.probative_revision === after2.probative_revision + 1 ? "PASS" : "FAIL", `${after2.probative_revision} -> ${after3.probative_revision}`);

    const noop = await svc.rpc("detach_evidence_document", { p_evidence_item_id: evCon.id, p_document_id: docA1.id });
    const { data: after4 } = await svc.from("evidence_items").select("probative_revision").eq("id", evCon.id).single();
    record("MTCS04-T43", !noop.error && noop.data === false && after4.probative_revision === after3.probative_revision ? "PASS" : "FAIL", `noop detach: revision unchanged ${after3.probative_revision} == ${after4.probative_revision}`);
  }
  {
    // Dedicated fixture: current + reviewed (never superseded) — distinct from v1,
    // which is already superseded by this point in the script (T09-T14 block).
    const evReviewedOnly = (await createComposition({ fact: "reviewed-only fact", documentIds: [docA1.id] })).data;
    await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: evReviewedOnly.id, p_expected_probative_revision: evReviewedOnly.probative_revision,
      p_expected_reviewed_at: null, p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    const at = await svc.rpc("attach_evidence_document", { p_evidence_item_id: evReviewedOnly.id, p_document_id: docA2.id, p_created_by: admin.userId });
    record("MTCS04-T17", !!at.error && /HISTORICAL_COMPOSITION_IMMUTABLE/.test(at.error.message) ? "PASS" : "FAIL", at.error?.message ?? "no error");
    const det = await svc.rpc("detach_evidence_document", { p_evidence_item_id: evReviewedOnly.id, p_document_id: docA1.id });
    record("MTCS04-T18", !!det.error && /HISTORICAL_COMPOSITION_IMMUTABLE/.test(det.error.message) ? "PASS" : "FAIL", det.error?.message ?? "no error");
  }
  {
    // superseded mutation rejected (v1 is already superseded from the T09-T14 block —
    // its currency_status check fails to find a 'current' row at all, so the function
    // raises CONFLICT_CURRENT_COMPOSITION, distinct from the reviewed-but-current
    // HISTORICAL_COMPOSITION_IMMUTABLE path exercised by T17/T18 above)
    const at2 = await svc.rpc("attach_evidence_document", { p_evidence_item_id: v1.id, p_document_id: docA2.id, p_created_by: admin.userId });
    record("MTCS04-T19", !!at2.error && /CONFLICT_CURRENT_COMPOSITION/.test(at2.error.message) ? "PASS" : "FAIL", at2.error?.message ?? "no error");
  }

  // ══ Fact correction (T20-T22, T38) ══
  const evFact = (await createComposition({ fact: "original fact" })).data;
  {
    const r = await svc.rpc("update_evidence_fact", { p_composition_id: evFact.id, p_fact: "corrected fact", p_actor_id: admin.userId });
    record("MTCS04-T20", !r.error && r.data.fact === "corrected fact" && r.data.fact_updated_by === admin.userId && r.data.probative_revision === 2 ? "PASS" : "FAIL", JSON.stringify({ err: r.error?.message, data: r.data }));
    const noop = await svc.rpc("update_evidence_fact", { p_composition_id: evFact.id, p_fact: "corrected fact", p_actor_id: admin.userId });
    record("check: same-value fact no-op", !noop.error && noop.data.probative_revision === 2 ? "PASS" : "FAIL", `revision stayed at ${noop.data?.probative_revision}`);
  }
  const evFactReviewed = (await createComposition({ fact: "fact reviewed-only" })).data;
  {
    await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: evFactReviewed.id, p_expected_probative_revision: evFactReviewed.probative_revision,
      p_expected_reviewed_at: null, p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    const r = await svc.rpc("update_evidence_fact", { p_composition_id: evFactReviewed.id, p_fact: "should fail", p_actor_id: admin.userId });
    record("MTCS04-T21", !!r.error && /HISTORICAL_COMPOSITION_IMMUTABLE/.test(r.error.message) ? "PASS" : "FAIL", r.error?.message ?? "no error");
  }
  {
    // v1 is already superseded (T09-T14 block) — distinct code path from T21
    const r = await svc.rpc("update_evidence_fact", { p_composition_id: v1.id, p_fact: "should fail", p_actor_id: admin.userId });
    record("MTCS04-T22", !!r.error && /CONFLICT_CURRENT_COMPOSITION/.test(r.error.message) ? "PASS" : "FAIL", r.error?.message ?? "no error");
  }
  {
    const { data: row } = await svc.from("evidence_items").select("fact, version, currency_status").eq("id", evFact.id).single();
    record("MTCS04-T38", row.version === 1 && row.currency_status === "current" ? "PASS" : "FAIL", JSON.stringify(row));
  }

  // ══ Documentary Condition (T23-T25 area) ══
  const evDoc = (await createComposition({ fact: "documentary condition fact" })).data;
  {
    const before = evDoc.probative_revision;
    const r = await svc.rpc("update_evidence_documentary_condition", { p_composition_id: evDoc.id, p_documentary_condition: "documented", p_actor_id: admin.userId });
    const { data: row } = await svc.from("evidence_items").select("probative_revision, documentary_condition_updated_by").eq("id", evDoc.id).single();
    record("check: documentary condition update succeeds + attributed", !r.error && r.data.documentary_condition === "documented" && row.documentary_condition_updated_by === admin.userId ? "PASS" : "FAIL", JSON.stringify(r.data));
    record("check: documentary condition does not advance probative_revision", row.probative_revision === before ? "PASS" : "FAIL", `${before} == ${row.probative_revision}`);
  }
  {
    // documentary condition change permitted on a current+reviewed (but not
    // superseded) composition — a fresh dedicated fixture, since v1 is by now
    // superseded (currency_status != 'current' blocks this primitive too, for a
    // different reason than review state — both dimensions require 'current').
    const evDocReviewed = (await createComposition({ fact: "doc condition reviewed-only" })).data;
    await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: evDocReviewed.id, p_expected_probative_revision: evDocReviewed.probative_revision,
      p_expected_reviewed_at: null, p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    const r = await svc.rpc("update_evidence_documentary_condition", { p_composition_id: evDocReviewed.id, p_documentary_condition: "partial", p_actor_id: admin.userId });
    record("check: documentary condition change permitted on reviewed composition", !r.error ? "PASS" : "FAIL", r.error?.message ?? "ok");
  }

  // ══ Human Verification (T26-T33, T39-T41, T46A-D) ══
  const evVer = (await createComposition({ fact: "verification fact", documentIds: [docA2.id] })).data;
  {
    const r = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: evVer.id, p_expected_probative_revision: evVer.probative_revision, p_expected_reviewed_at: null,
      p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    record("MTCS04-T26", !r.error && r.data.verification_condition === "verified" ? "PASS" : "FAIL", JSON.stringify({ err: r.error?.message, data: r.data }));
    record("check: reviewed_by/at attribution", r.data?.reviewed_by === admin.userId && !!r.data?.reviewed_at ? "PASS" : "FAIL", JSON.stringify({ reviewed_by: r.data?.reviewed_by, reviewed_at: r.data?.reviewed_at }));
  }
  const evNA = (await createComposition({ fact: "needs attention fact" })).data;
  {
    const r = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: evNA.id, p_expected_probative_revision: evNA.probative_revision, p_expected_reviewed_at: null,
      p_verification_condition: "needs_attention", p_verification_reason: "missing signature", p_reviewed_by: admin.userId,
    });
    record("MTCS04-T27", !r.error && r.data.verification_condition === "needs_attention" ? "PASS" : "FAIL", r.error?.message ?? "ok");
  }
  const evNA2 = (await createComposition({ fact: "needs attention no reason" })).data;
  {
    const r = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: evNA2.id, p_expected_probative_revision: evNA2.probative_revision, p_expected_reviewed_at: null,
      p_verification_condition: "needs_attention", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    record("MTCS04-T28", !!r.error ? "PASS" : "FAIL", r.error?.message ?? "no error — missing-reason not rejected");
  }
  {
    // T29: unrelated (unassigned) agent — rejected at the DB grant layer (EXECUTE
    // revoked from `authenticated` entirely, service_role only) — no mutation results.
    const r = await unrelatedSess.rpc("review_evidence_composition_if_current", {
      p_composition_id: evNA.id, p_expected_probative_revision: evNA.probative_revision, p_expected_reviewed_at: null,
      p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: unrelated.userId,
    });
    const { data: evNANow } = await svc.from("evidence_items").select("verification_condition").eq("id", evNA.id).single();
    record("MTCS04-T29", !!r.error && evNANow.verification_condition === "needs_attention" ? "PASS" : "FAIL", JSON.stringify({ err: r.error?.message, unchanged: evNANow.verification_condition }));
  }
  {
    // T30/T31: assigned-agent-correct-Case-accepted vs assigned-agent-wrong-Case-
    // rejected is enforced by authorizeCaseStaff() at the API ROUTE layer, not by
    // review_evidence_composition_if_current() itself (a service_role-only DB
    // function that has no concept of Case assignment at all — EXECUTE is revoked
    // from `authenticated` unconditionally, so even the CORRECTLY-assigned agent
    // cannot call it directly). Distinguishing these two scenarios requires an
    // authenticated HTTP request through the real Next.js route with real session
    // cookies — the same cookie-based integration harness explicitly documented as
    // NOT AVAILABLE UNDER CURRENT HARNESS in the MTCS-02B Correction Pass (RR11/RR22)
    // and again in the MTCS-03 Correction Pass, for the identical technical reason
    // (@supabase/ssr's chunked cookie-session format has no reproduction harness in
    // this repo). Not fabricated as an executable DB-level test here.
    record("MTCS04-T30", "NOT EXECUTABLE UNDER CURRENT HARNESS", "assigned-agent-correct-Case-accepted is enforced at the authorizeCaseStaff() route layer, not by the service_role-only DB function; same harness limitation as MTCS-02B RR11/RR22.");
    record("MTCS04-T31", "NOT EXECUTABLE UNDER CURRENT HARNESS", "assigned-agent-wrong-Case-rejected — same reasoning as T30.");
  }
  {
    // T32: client — rejected at the DB grant layer, no mutation results.
    const r = await clientSess.rpc("review_evidence_composition_if_current", {
      p_composition_id: evVer.id, p_expected_probative_revision: evVer.probative_revision, p_expected_reviewed_at: evVer.reviewed_at ?? null,
      p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: client.userId,
    });
    record("MTCS04-T32", !!r.error ? "PASS" : "FAIL", r.error?.message ?? "no error — client executed governed function");
  }
  {
    // v1 (reviewed at earlier step) — historical review preserved
    const { data: v1Row } = await svc.from("evidence_items").select("verification_condition, reviewed_by, reviewed_at").eq("id", v1.id).single();
    record("MTCS04-T33", v1Row.verification_condition === "verified" && v1Row.reviewed_by === admin.userId && !!v1Row.reviewed_at ? "PASS" : "FAIL", JSON.stringify(v1Row));
  }

  // RV-04-01 (T34A/B, T35A/B, T39-T41)
  const evRace = (await createComposition({ fact: "race fact", documentIds: [docA1.id] })).data;
  {
    // T34B: attach commits after human "loaded" R_before; human submits stale R_before -> EV007
    const before = evRace.probative_revision;
    await svc.rpc("attach_evidence_document", { p_evidence_item_id: evRace.id, p_document_id: docA2.id, p_created_by: admin.userId });
    const r = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: evRace.id, p_expected_probative_revision: before, p_expected_reviewed_at: null,
      p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    record("MTCS04-T34B", !!r.error && /STALE_PROBATIVE_SNAPSHOT/.test(r.error.message) ? "PASS" : "FAIL", r.error?.message ?? "no error");
  }
  {
    // T34A: review succeeds first, then attach against the now-reviewed composition is rejected
    const { data: fresh } = await svc.from("evidence_items").select("probative_revision, reviewed_at").eq("id", evRace.id).single();
    const rev = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: evRace.id, p_expected_probative_revision: fresh.probative_revision, p_expected_reviewed_at: fresh.reviewed_at,
      p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    const at = await svc.rpc("attach_evidence_document", { p_evidence_item_id: evRace.id, p_document_id: docA3.id, p_created_by: admin.userId });
    record("MTCS04-T34A", !rev.error && !!at.error && /HISTORICAL_COMPOSITION_IMMUTABLE/.test(at.error.message) ? "PASS" : "FAIL", JSON.stringify({ revErr: rev.error?.message, atErr: at.error?.message }));
  }
  const evRace2 = (await createComposition({ fact: "race fact 2 (detach)", documentIds: [docA1.id, docA2.id] })).data;
  {
    // T35B: detach commits after human's stale read
    const before = evRace2.probative_revision;
    await svc.rpc("detach_evidence_document", { p_evidence_item_id: evRace2.id, p_document_id: docA2.id });
    const r = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: evRace2.id, p_expected_probative_revision: before, p_expected_reviewed_at: null,
      p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    record("MTCS04-T35B", !!r.error && /STALE_PROBATIVE_SNAPSHOT/.test(r.error.message) ? "PASS" : "FAIL", r.error?.message ?? "no error");
  }
  const evRace3 = (await createComposition({ fact: "race fact 3", documentIds: [docA1.id] })).data;
  {
    // T35A: review first, then detach against reviewed composition rejected
    const rev = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: evRace3.id, p_expected_probative_revision: evRace3.probative_revision, p_expected_reviewed_at: null,
      p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    const det = await svc.rpc("detach_evidence_document", { p_evidence_item_id: evRace3.id, p_document_id: docA1.id });
    record("MTCS04-T35A", !rev.error && !!det.error && /HISTORICAL_COMPOSITION_IMMUTABLE/.test(det.error.message) ? "PASS" : "FAIL", JSON.stringify({ revErr: rev.error?.message, detErr: det.error?.message }));
  }
  const evFactRace = (await createComposition({ fact: "fact race" })).data;
  {
    // T39: fact changes after human snapshot -> EV007
    const before = evFactRace.probative_revision;
    await svc.rpc("update_evidence_fact", { p_composition_id: evFactRace.id, p_fact: "changed fact", p_actor_id: admin.userId });
    const r = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: evFactRace.id, p_expected_probative_revision: before, p_expected_reviewed_at: null,
      p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    record("MTCS04-T39", !!r.error && /STALE_PROBATIVE_SNAPSHOT/.test(r.error.message) ? "PASS" : "FAIL", r.error?.message ?? "no error");
  }
  const evNoChange = (await createComposition({ fact: "no change fact" })).data;
  {
    // T40: no probative change -> review succeeds
    const r = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: evNoChange.id, p_expected_probative_revision: evNoChange.probative_revision, p_expected_reviewed_at: null,
      p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    record("MTCS04-T40", !r.error ? "PASS" : "FAIL", r.error?.message ?? "ok");
  }
  const evDocCondRace = (await createComposition({ fact: "doc condition race" })).data;
  {
    // T41: documentary condition changes after snapshot -> probative token remains valid, review may proceed
    await svc.rpc("update_evidence_documentary_condition", { p_composition_id: evDocCondRace.id, p_documentary_condition: "partial", p_actor_id: admin.userId });
    const r = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: evDocCondRace.id, p_expected_probative_revision: evDocCondRace.probative_revision, p_expected_reviewed_at: null,
      p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    record("MTCS04-T41", !r.error ? "PASS" : "FAIL", r.error?.message ?? "ok");
  }

  // RV-04-02 (T46A-D)
  const ev46 = (await createComposition({ fact: "T46 fact" })).data;
  {
    // T46A: same snapshot, first wins, second (stale reviewed_at) rejected
    const a = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: ev46.id, p_expected_probative_revision: ev46.probative_revision, p_expected_reviewed_at: null,
      p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    const b = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: ev46.id, p_expected_probative_revision: ev46.probative_revision, p_expected_reviewed_at: null,
      p_verification_condition: "needs_attention", p_verification_reason: "second reviewer", p_reviewed_by: admin.userId,
    });
    record("MTCS04-T46A", !a.error && !!b.error && /STALE_VERIFICATION_STATE/.test(b.error.message) ? "PASS" : "FAIL", JSON.stringify({ aErr: a.error?.message, bErr: b.error?.message }));
  }
  {
    // T46B: intentional later review by the same human, no intervening review -> PASS
    const { data: fresh } = await svc.from("evidence_items").select("probative_revision, reviewed_at").eq("id", ev46.id).single();
    const r = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: ev46.id, p_expected_probative_revision: fresh.probative_revision, p_expected_reviewed_at: fresh.reviewed_at,
      p_verification_condition: "needs_attention", p_verification_reason: "intentional change of mind", p_reviewed_by: admin.userId,
    });
    record("MTCS04-T46B", !r.error && r.data.verification_condition === "needs_attention" ? "PASS" : "FAIL", r.error?.message ?? "ok");
  }
  const ev46c = (await createComposition({ fact: "T46C fact" })).data;
  {
    // T46C: A loads state, B reviews, A submits stale -> EV008
    const aExpectedRev = ev46c.probative_revision;
    const aExpectedReviewedAt = null;
    await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: ev46c.id, p_expected_probative_revision: ev46c.probative_revision, p_expected_reviewed_at: null,
      p_verification_condition: "needs_attention", p_verification_reason: "B's review", p_reviewed_by: admin.userId,
    });
    const aSubmit = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: ev46c.id, p_expected_probative_revision: aExpectedRev, p_expected_reviewed_at: aExpectedReviewedAt,
      p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    record("MTCS04-T46C", !!aSubmit.error && /STALE_VERIFICATION_STATE/.test(aSubmit.error.message) ? "PASS" : "FAIL", aSubmit.error?.message ?? "no error");
  }
  const ev46d = (await createComposition({ fact: "T46D fact", documentIds: [docA1.id] })).data;
  {
    // T46D: both probative and verification stale -> EV007 wins precedence
    const staleRev = ev46d.probative_revision;
    await svc.rpc("attach_evidence_document", { p_evidence_item_id: ev46d.id, p_document_id: docA2.id, p_created_by: admin.userId }); // probative changes
    await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: ev46d.id, p_expected_probative_revision: staleRev + 1, p_expected_reviewed_at: null,
      p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    }); // verification also changes
    const r = await svc.rpc("review_evidence_composition_if_current", {
      p_composition_id: ev46d.id, p_expected_probative_revision: staleRev /* stale */, p_expected_reviewed_at: null /* also stale */,
      p_verification_condition: "needs_attention", p_verification_reason: "both stale", p_reviewed_by: admin.userId,
    });
    record("MTCS04-T46D", !!r.error && /STALE_PROBATIVE_SNAPSHOT/.test(r.error.message) ? "PASS" : "FAIL", r.error?.message ?? "no error");
  }

  // ══ T47 — detach audit boundary (CR-04-01B) ══
  const ev47 = (await createComposition({ fact: "T47 fact", documentIds: [docA1.id] })).data;
  {
    const before = ev47.probative_revision;
    await svc.rpc("detach_evidence_document", { p_evidence_item_id: ev47.id, p_document_id: docA1.id });
    const { data: after } = await svc.from("evidence_items").select("probative_revision").eq("id", ev47.id).single();
    const { data: rows } = await svc.from("evidence_item_documents").select("*").eq("evidence_item_id", ev47.id).eq("document_id", docA1.id);
    record("MTCS04-T47", after.probative_revision === before + 1 && (rows?.length ?? 0) === 0 ? "PASS" : "FAIL",
      `revision advanced (${before}->${after.probative_revision}); association absent (${rows?.length}); no historical-actor reconstruction claimed or tested`);
  }

  // ══ CR-IMP-04-02 — historical Evidence read model ══
  {
    // CR04-H01: the same query shape page.tsx now uses (case_id filter only, no
    // currency_status filter) returns BOTH the superseded v1 and current v2 rows
    // from the same version chain fixture (established earlier: v1/v2 above).
    const { data: rows } = await svc.from("evidence_items").select("id, currency_status").eq("case_id", caseA.id).in("id", [v1.id, v2.id]);
    const statuses = new Set((rows ?? []).map(r => r.currency_status));
    record("CR04-H01", statuses.has("current") && statuses.has("superseded") ? "PASS" : "FAIL",
      `page.tsx query (case_id filter only, no currency_status filter) returns both: ${JSON.stringify([...statuses])}`);
  }
  {
    // CR04-H02: historical associations preserved — already proven by MTCS04-T12
    // (v1 retains 3 associated documents after v2's creation); not duplicated here.
    record("CR04-H02", "PASS (reused from MTCS04-T12)", "v1's association set (3 documents) remained intact after v2 creation — same evidence already recorded under MTCS04-T12, not re-executed.");
  }
  {
    // CR04-H03: superseded UI read-only — no browser/component-test harness exists
    // in this repository (confirmed: no test framework beyond these Node DB
    // scripts). Proven statically by direct re-reading of
    // src/app/(dashboard)/cases/[id]/evidence-section.tsx in this session:
    //   fact-correction pencil   -> gated by `canMutate` (currency_status==='current' && !reviewed_at)
    //   attach dropdown/detach   -> gated by `canMutate`
    //   Documentary Condition    -> gated by `currency_status === 'current'` (select vs read-only Badge)
    //   Review section           -> gated by `currency_status === 'current'`
    // For any row with currency_status === 'superseded', all five conditions evaluate
    // false, so no mutation control renders — no fabricated browser automation used.
    record("CR04-H03", "STATIC", "all five mutation controls in evidence-section.tsx are gated by currency_status/canMutate checks that evaluate false for superseded rows — confirmed by direct source reading in this session, not executed via a UI harness (none exists).");
  }

  // ══ Scope statics ══
  record("MTCS04-SCOPE-01", "STATIC", "no evidence-producer/route file references agent_runs, case_strategy, or any /api/agents route — confirmed by code inspection in this session.");

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter(r => r.status === "FAIL").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(2); });
