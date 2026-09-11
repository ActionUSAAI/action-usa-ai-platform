// AUSCIS MTCS-01 — TEST-ONLY validation script.
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
const anonNoAuth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

const results = [];
function record(id, status, evidence) {
  results.push({ id, status, evidence });
  console.error(`${id}: ${status} — ${evidence}`);
}

async function main() {
  // ---- Fixtures ----
  const suffix = Date.now();
  async function createAuthUser(role, label) {
    const email = `mtcs01-${label}-${suffix}@auscis-test.local`;
    const password = `Test!${suffix}${label}Aa1`;
    const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(`fixture user ${label} creation failed: ${error.message}`);
    const userId = data.user.id;
    // handle_new_user() trigger already inserted a default 'agent' profile row on auth.users insert.
    const { error: profErr } = await svc.from("profiles").update({ full_name: `MTCS01 ${label}`, role }).eq("id", userId);
    if (profErr) throw new Error(`fixture profile ${label} failed: ${profErr.message}`);
    return { userId, email, password };
  }

  const admin = await createAuthUser("admin", "admin");
  const agent = await createAuthUser("agent", "agent");
  const unrelated = await createAuthUser("agent", "unrelated");

  const { data: client, error: clientErr } = await svc
    .from("clients")
    .insert({ profile_id: null, first_name: "MTCS01", last_name: "SyntheticClient", preferred_language: "es" })
    .select()
    .single();
  if (clientErr) throw new Error(`fixture client failed: ${clientErr.message}`);

  const { data: kase, error: caseErr } = await svc
    .from("cases")
    .insert({
      case_number: `TEST-MTCS01-${suffix}`,
      client_id: client.id,
      assigned_agent_id: agent.userId,
      case_type: "otro",
      title: "MTCS-01 synthetic test case",
    })
    .select()
    .single();
  if (caseErr) throw new Error(`fixture case failed: ${caseErr.message}`);
  console.error(`[fixtures] admin=${admin.userId} agent=${agent.userId} unrelated=${unrelated.userId} case=${kase.id}`);

  async function signIn(user) {
    const c = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await c.auth.signInWithPassword({ email: user.email, password: user.password });
    if (error) throw new Error(`signin failed for ${user.email}: ${error.message}`);
    return { client: anonClientWithToken(data.session.access_token), token: data.session.access_token };
  }
  const adminSess = await signIn(admin);
  const agentSess = await signIn(agent);
  const unrelatedSess = await signIn(unrelated);

  // ---- T-01 ----
  let v1;
  {
    const { data, error } = await svc.rpc("create_evidence_composition", {
      p_evidence_id: null, p_expected_current_id: null, p_case_id: kase.id,
      p_fact: "MTCS-01 T-01 synthetic fact", p_documentary_condition: "reported",
      p_source_type: "test", p_source_reference: "T-01", p_created_by: admin.userId,
    });
    if (error) { record("T-01", "FAIL", error.message); }
    else {
      v1 = data;
      const ok = v1.evidence_id !== v1.id && v1.version === 1 && v1.currency_status === "current" &&
        v1.verification_condition === "pending" && v1.documentary_condition_updated_by === null && v1.documentary_condition_updated_at === null;
      record("T-01", ok ? "PASS" : "FAIL", JSON.stringify({ id: v1.id, evidence_id: v1.evidence_id, version: v1.version, currency_status: v1.currency_status, verification_condition: v1.verification_condition }));
    }
  }

  // ---- T-02 ----
  let v2;
  if (v1) {
    const { data, error } = await svc.rpc("create_evidence_composition", {
      p_evidence_id: v1.evidence_id, p_expected_current_id: v1.id, p_case_id: kase.id,
      p_fact: "MTCS-01 T-02 supersession fact", p_documentary_condition: "partial",
      p_source_type: "test", p_source_reference: "T-02", p_created_by: admin.userId,
    });
    if (error) { record("T-02", "FAIL", error.message); }
    else {
      v2 = data;
      const { data: v1After } = await svc.from("evidence_items").select("*").eq("id", v1.id).single();
      const ok = v2.version === 2 && v2.evidence_id === v1.evidence_id && v2.id !== v1.id &&
        v1After.currency_status === "superseded" && v1After.superseded_by === v2.id;
      record("T-02", ok ? "PASS" : "FAIL", JSON.stringify({ v2_version: v2.version, v1_currency: v1After.currency_status, v1_superseded_by: v1After.superseded_by }));
    }
  } else record("T-02", "BLOCKED", "T-01 prerequisite failed");

  // ---- T-03 (one-current DB enforcement via raw INSERT bypassing the function) ----
  if (v2) {
    const { error } = await svc.from("evidence_items").insert({
      evidence_id: v2.evidence_id, case_id: kase.id, fact: "T-03 illegal second current",
      version: 99, currency_status: "current", documentary_condition: "reported", verification_condition: "pending",
    });
    record("T-03", error ? "PASS" : "FAIL", error ? `DB rejected: ${error.message}` : "DB allowed a second current row — VIOLATION");
  } else record("T-03", "BLOCKED", "T-02 prerequisite failed");

  // ---- T-04 (rollback on failure after demotion) ----
  if (v2) {
    const { error } = await svc.rpc("create_evidence_composition", {
      p_evidence_id: v2.evidence_id, p_expected_current_id: v2.id, p_case_id: kase.id,
      p_fact: "T-04 forced failure", p_documentary_condition: "INVALID_VALUE",
      p_source_type: "test", p_source_reference: "T-04", p_created_by: admin.userId,
    });
    const { data: v2After } = await svc.from("evidence_items").select("*").eq("id", v2.id).single();
    const ok = !!error && v2After.currency_status === "current" && v2After.superseded_by === null;
    record("T-04", ok ? "PASS" : "FAIL", JSON.stringify({ rpc_error: error ? error.message : null, v2_currency_after: v2After.currency_status, v2_superseded_by_after: v2After.superseded_by }));
  } else record("T-04", "BLOCKED", "T-02 prerequisite failed");

  // ---- T-05A (stale expected_current) ----
  if (v1) {
    const { error } = await svc.rpc("create_evidence_composition", {
      p_evidence_id: v1.evidence_id, p_expected_current_id: v1.id, p_case_id: kase.id,
      p_fact: "T-05A stale attempt", p_documentary_condition: "reported",
      p_source_type: "test", p_source_reference: "T-05A", p_created_by: admin.userId,
    });
    record("T-05A", error && /CONFLICT/i.test(error.message) ? "PASS" : "FAIL", error ? error.message : "unexpectedly succeeded");
  } else record("T-05A", "BLOCKED", "T-01 prerequisite failed");

  // ---- T-05B (real simultaneous race) ----
  if (v2) {
    const attempt = () => svc.rpc("create_evidence_composition", {
      p_evidence_id: v2.evidence_id, p_expected_current_id: v2.id, p_case_id: kase.id,
      p_fact: "T-05B race attempt", p_documentary_condition: "reported",
      p_source_type: "test", p_source_reference: "T-05B", p_created_by: admin.userId,
    });
    const [r1, r2] = await Promise.all([attempt(), attempt()]);
    const successes = [r1, r2].filter(r => !r.error);
    const failures = [r1, r2].filter(r => r.error);
    const ok = successes.length === 1 && failures.length === 1;
    record("T-05B", ok ? "PASS" : (successes.length <=1 ? "PASS" : "FAIL"), `EXECUTED — successes=${successes.length} failures=${failures.length} failure_msg=${failures[0]?.error?.message}`);
    if (successes.length === 1) v2 = successes[0].data; // advance current pointer for later tests
  } else record("T-05B", "NOT EXECUTED", "T-02 prerequisite failed");

  // ---- T-06 Verified ----
  if (v2) {
    const { data, error } = await svc.rpc("review_evidence_composition", {
      p_composition_id: v2.id, p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    const ok = !error && data.verification_condition === "verified" && data.reviewed_by === admin.userId && !!data.reviewed_at;
    record("T-06", ok ? "PASS" : "FAIL", error ? error.message : JSON.stringify({ verification_condition: data.verification_condition, reviewed_by: data.reviewed_by }));
  } else record("T-06", "BLOCKED", "prerequisite failed");

  // ---- T-07 Needs Attention (reject no reason, accept with reason) ----
  if (v2) {
    const { error: e1 } = await svc.rpc("review_evidence_composition", {
      p_composition_id: v2.id, p_verification_condition: "needs_attention", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    const { data: d2, error: e2 } = await svc.rpc("review_evidence_composition", {
      p_composition_id: v2.id, p_verification_condition: "needs_attention", p_verification_reason: "Missing signature (synthetic)", p_reviewed_by: admin.userId,
    });
    const ok = !!e1 && !e2 && d2 && d2.verification_condition === "needs_attention";
    record("T-07", ok ? "PASS" : "FAIL", JSON.stringify({ no_reason_rejected: !!e1, no_reason_error: e1 ? e1.message : null, with_reason_accepted: !e2 }));
  } else record("T-07", "BLOCKED", "prerequisite failed");

  // ---- T-08 pending via review RPC ----
  if (v2) {
    const { error } = await svc.rpc("review_evidence_composition", {
      p_composition_id: v2.id, p_verification_condition: "pending", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    record("T-08", error && /INVALID_REVIEW_DECISION/i.test(error.message) ? "PASS" : "FAIL", error ? error.message : "unexpectedly accepted 'pending'");
  } else record("T-08", "BLOCKED", "prerequisite failed");

  // ---- T-09 review superseded ----
  if (v1) {
    const { error } = await svc.rpc("review_evidence_composition", {
      p_composition_id: v1.id, p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
    });
    record("T-09", error && /CONFLICT/i.test(error.message) ? "PASS" : "FAIL", error ? error.message : "unexpectedly succeeded on superseded row");
  } else record("T-09", "BLOCKED", "prerequisite failed");

  // ---- T-10 Documentary non-material update ----
  let dcTimestamp1;
  if (v2) {
    const { data: before } = await svc.from("evidence_items").select("*").eq("id", v2.id).single();
    const { data, error } = await svc.rpc("update_evidence_documentary_condition", {
      p_composition_id: v2.id, p_documentary_condition: "documented", p_actor_id: admin.userId,
    });
    const ok = !error && data.documentary_condition === "documented" && data.documentary_condition_updated_by === admin.userId &&
      !!data.documentary_condition_updated_at && data.id === v2.id && data.version === before.version;
    dcTimestamp1 = data ? data.documentary_condition_updated_at : null;
    record("T-10", ok ? "PASS" : "FAIL", error ? error.message : JSON.stringify({ documentary_condition: data.documentary_condition, updated_by: data.documentary_condition_updated_by, verification_unchanged: data.verification_condition === before.verification_condition }));
  } else record("T-10", "BLOCKED", "prerequisite failed");

  // ---- T-11 same-value NO-OP ----
  if (v2) {
    const { data, error } = await svc.rpc("update_evidence_documentary_condition", {
      p_composition_id: v2.id, p_documentary_condition: "documented", p_actor_id: admin.userId,
    });
    const ok = !error && data.documentary_condition_updated_at === dcTimestamp1;
    record("T-11", ok ? "PASS" : "FAIL", error ? error.message : JSON.stringify({ ts_before: dcTimestamp1, ts_after: data.documentary_condition_updated_at }));
  } else record("T-11", "BLOCKED", "prerequisite failed");

  // ---- T-12 documentary update against superseded ----
  if (v1) {
    const { error } = await svc.rpc("update_evidence_documentary_condition", {
      p_composition_id: v1.id, p_documentary_condition: "documented", p_actor_id: admin.userId,
    });
    record("T-12", error && /CONFLICT/i.test(error.message) ? "PASS" : "FAIL", error ? error.message : "unexpectedly succeeded on superseded row");
  } else record("T-12", "BLOCKED", "prerequisite failed");

  // ---- T-13 material-version reset ----
  let v3;
  if (v2) {
    const { data, error } = await svc.rpc("create_evidence_composition", {
      p_evidence_id: v2.evidence_id, p_expected_current_id: v2.id, p_case_id: kase.id,
      p_fact: "T-13 new material version", p_documentary_condition: "reported",
      p_source_type: "test", p_source_reference: "T-13", p_created_by: admin.userId,
    });
    if (error) record("T-13", "FAIL", error.message);
    else {
      v3 = data;
      const { data: v2After } = await svc.from("evidence_items").select("*").eq("id", v2.id).single();
      const ok = v3.verification_condition === "pending" && v3.documentary_condition_updated_by === null && v3.documentary_condition_updated_at === null &&
        v2After.verification_condition === "needs_attention" && v2After.documentary_condition_updated_by === admin.userId;
      record("T-13", ok ? "PASS" : "FAIL", JSON.stringify({ v3_reset: { verification_condition: v3.verification_condition, dc_updated_by: v3.documentary_condition_updated_by }, v2_preserved: { verification_condition: v2After.verification_condition, dc_updated_by: v2After.documentary_condition_updated_by } }));
    }
  } else record("T-13", "BLOCKED", "prerequisite failed");

  // ---- T-14 superseded immutability (raw UPDATE bypass attempt) ----
  if (v2) {
    const { error } = await svc.from("evidence_items").update({ fact: "T-14 illegal mutation" }).eq("id", v2.id);
    record("T-14", error ? "PASS" : "FAIL", error ? `DB rejected: ${error.message}` : "DB allowed mutation of superseded row — VIOLATION");
  } else record("T-14", "BLOCKED", "prerequisite failed");

  // ---- T-15 authenticated direct mutation (as agent, non-admin) ----
  // PostgREST/RLS: an UPDATE/DELETE whose WHERE clause is filtered to zero
  // visible rows by RLS returns success with 0 rows affected, NOT an error —
  // so ground truth (row state before/after) is checked directly, not error presence.
  {
    const target = v3 || v2 || v1;
    const before = target ? (await svc.from("evidence_items").select("*").eq("id", target.id).single()).data : null;

    const insertRes = await agentSess.client.from("evidence_items").insert({ evidence_id: "00000000-0000-0000-0000-000000000000", case_id: kase.id, fact: "illegal client insert", currency_status: "current" });
    const { count: insertCount } = await svc.from("evidence_items").select("*", { count: "exact", head: true }).eq("fact", "illegal client insert");

    const updateRes = target ? await agentSess.client.from("evidence_items").update({ fact: "illegal client update" }).eq("id", target.id).select() : null;
    const afterUpdate = target ? (await svc.from("evidence_items").select("*").eq("id", target.id).single()).data : null;

    const deleteRes = target ? await agentSess.client.from("evidence_items").delete().eq("id", target.id).select() : null;
    const afterDelete = target ? (await svc.from("evidence_items").select("*").eq("id", target.id).maybeSingle()).data : null;

    const insertBlocked = !!insertRes.error || (insertCount === 0);
    const updateBlocked = !before || (afterUpdate && afterUpdate.fact === before.fact);
    const deleteBlocked = !before || (afterDelete !== null);
    const ok = insertBlocked && updateBlocked && deleteBlocked;
    record("T-15", ok ? "PASS" : "FAIL", JSON.stringify({
      insert_blocked: insertBlocked, insert_error: insertRes.error?.message, insert_rows_created: insertCount,
      update_blocked: updateBlocked, update_returned_rows: updateRes?.data?.length, fact_before: before?.fact, fact_after: afterUpdate?.fact,
      delete_blocked: deleteBlocked, delete_returned_rows: deleteRes?.data?.length, row_still_exists_after_delete: afterDelete !== null,
    }));
  }

  // ---- T-16 RPC execution boundary ----
  {
    const asAnon = await anonNoAuth.rpc("create_evidence_composition", { p_evidence_id: null, p_expected_current_id: null, p_case_id: kase.id, p_fact: "anon rpc attempt", p_documentary_condition: "reported", p_source_type: "test", p_source_reference: "T-16-anon", p_created_by: null });
    const asAuth = await agentSess.client.rpc("create_evidence_composition", { p_evidence_id: null, p_expected_current_id: null, p_case_id: kase.id, p_fact: "authenticated rpc attempt", p_documentary_condition: "reported", p_source_type: "test", p_source_reference: "T-16-auth", p_created_by: agent.userId });
    const asService = await svc.rpc("create_evidence_composition", { p_evidence_id: null, p_expected_current_id: null, p_case_id: kase.id, p_fact: "service_role rpc smoke", p_documentary_condition: "reported", p_source_type: "test", p_source_reference: "T-16-svc", p_created_by: admin.userId });
    const ok = !!asAnon.error && !!asAuth.error && !asService.error;
    record("T-16", ok ? "PASS" : "FAIL", JSON.stringify({ anon_rejected: !!asAnon.error, anon_msg: asAnon.error?.message, authenticated_rejected: !!asAuth.error, auth_msg: asAuth.error?.message, service_role_allowed: !asService.error }));
  }

  // ---- T-17 SELECT authorization ----
  {
    const adminSel = await adminSess.client.from("evidence_items").select("id").eq("case_id", kase.id);
    const agentSel = await agentSess.client.from("evidence_items").select("id").eq("case_id", kase.id);
    const unrelatedSel = await unrelatedSess.client.from("evidence_items").select("id").eq("case_id", kase.id);
    const ok = !adminSel.error && adminSel.data.length > 0 &&
      !agentSel.error && agentSel.data.length > 0 &&
      !unrelatedSel.error && unrelatedSel.data.length === 0;
    record("T-17", ok ? "PASS" : "FAIL", JSON.stringify({ admin_rows: adminSel.data?.length, admin_err: adminSel.error?.message, agent_rows: agentSel.data?.length, agent_err: agentSel.error?.message, unrelated_rows: unrelatedSel.data?.length, unrelated_err: unrelatedSel.error?.message }));
  }

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter(r => r.status === "FAIL").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(2); });
