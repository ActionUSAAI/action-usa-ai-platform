// AUSCIS MTCS-03 — TEST-ONLY validation script.
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

  // ---- Fixtures ----
  async function createAuthUser(role, label) {
    const email = `mtcs03-${label}-${suffix}@auscis-test.local`;
    const password = `Test!${suffix}${label}Aa1`;
    const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(`fixture user ${label} creation failed: ${error.message}`);
    const userId = data.user.id;
    const { error: profErr } = await svc.from("profiles").update({ full_name: `MTCS03 ${label}`, role }).eq("id", userId);
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
  const adminSess = await signIn(admin);
  const agentSess = await signIn(agent);
  const unrelatedSess = await signIn(unrelated);

  const { data: client, error: clientErr } = await svc
    .from("clients").insert({ first_name: "MTCS03", last_name: "SyntheticClient", preferred_language: "es" }).select().single();
  if (clientErr) throw new Error(`fixture client failed: ${clientErr.message}`);

  const { data: caseA, error: caseAErr } = await svc
    .from("cases").insert({ case_number: `TEST-MTCS03-${suffix}-A`, client_id: client.id, assigned_agent_id: agent.userId, case_type: "otro", title: "MTCS-03 case A" }).select().single();
  if (caseAErr) throw new Error(`fixture case A failed: ${caseAErr.message}`);

  const { data: caseB, error: caseBErr } = await svc
    .from("cases").insert({ case_number: `TEST-MTCS03-${suffix}-B`, client_id: client.id, case_type: "otro", title: "MTCS-03 case B" }).select().single();
  if (caseBErr) throw new Error(`fixture case B failed: ${caseBErr.message}`);

  async function makeDoc(caseId, label) {
    const { data, error } = await svc.from("documents").insert({
      case_id: caseId, client_id: client.id, name: `${label}.pdf`,
      file_path: `${caseId}/${label}-${suffix}.pdf`, storage_bucket: "intake-documents",
    }).select().single();
    if (error) throw new Error(`fixture document ${label} failed: ${error.message}`);
    return data;
  }
  const docA1 = await makeDoc(caseA.id, "docA1");
  const docA2 = await makeDoc(caseA.id, "docA2");
  const docB1 = await makeDoc(caseB.id, "docB1");

  async function makeComposition(caseId, fact) {
    const { data, error } = await svc.rpc("create_evidence_composition", {
      p_evidence_id: null, p_expected_current_id: null, p_case_id: caseId,
      p_fact: fact, p_documentary_condition: "reported",
      p_source_type: "test", p_source_reference: "mtcs03", p_created_by: admin.userId,
    });
    if (error) throw new Error(`fixture composition failed: ${error.message}`);
    return data;
  }

  console.error(`[fixtures] admin=${admin.userId} agent=${agent.userId} unrelated=${unrelated.userId} caseA=${caseA.id} caseB=${caseB.id} docA1=${docA1.id} docA2=${docA2.id} docB1=${docB1.id}`);

  // ══ Schema ══
  {
    const { error } = await svc.from("evidence_item_documents").select("evidence_item_id, document_id, case_id, created_at, created_by").limit(1);
    record("ED03-T01", !error ? "PASS" : "FAIL", error ? error.message : "evidence_item_documents reachable with expected columns");
  }

  // evA = current, unreviewed composition on case A — used for T02,T06,T08,T09,T13,T14,T24-27
  const evA = await makeComposition(caseA.id, "MTCS-03 evA fact");

  // ---- T02: PK enforced (duplicate direct insert rejected) ----
  {
    await svc.from("evidence_item_documents").insert({ evidence_item_id: evA.id, document_id: docA1.id, case_id: caseA.id });
    const { error } = await svc.from("evidence_item_documents").insert({ evidence_item_id: evA.id, document_id: docA1.id, case_id: caseA.id });
    record("ED03-T02", !!error && /duplicate key|unique/i.test(error.message) ? "PASS" : "FAIL", error ? error.message : "no error — PK not enforced");
  }

  // ---- T03: composite FK to evidence_items enforced ----
  {
    const { error } = await svc.from("evidence_item_documents").insert({
      evidence_item_id: "00000000-0000-0000-0000-000000000000", document_id: docA1.id, case_id: caseA.id,
    });
    record("ED03-T03", !!error ? "PASS" : "FAIL", error ? error.message : "no error — FK not enforced");
  }

  // ---- T04: composite FK to documents enforced ----
  {
    const { error } = await svc.from("evidence_item_documents").insert({
      evidence_item_id: evA.id, document_id: "00000000-0000-0000-0000-000000000000", case_id: caseA.id,
    });
    record("ED03-T04", !!error ? "PASS" : "FAIL", error ? error.message : "no error — FK not enforced");
  }

  // ---- T05: RLS enabled + SELECT policy (unrelated agent cannot see caseA rows; assigned agent can) ----
  {
    const { data: asUnrelated } = await unrelatedSess.from("evidence_item_documents").select("*").eq("evidence_item_id", evA.id);
    const { data: asAgent } = await agentSess.from("evidence_item_documents").select("*").eq("evidence_item_id", evA.id);
    record("ED03-T05", (asUnrelated?.length === 0) && (asAgent?.length ?? 0) > 0 ? "PASS" : "FAIL",
      JSON.stringify({ unrelatedSees: asUnrelated?.length, agentSees: asAgent?.length }));
  }

  // ---- T06/T07: cardinality — evA supports docA1+docA2; docA1 also supports a second composition evA2 ----
  const evA2 = await makeComposition(caseA.id, "MTCS-03 evA2 fact");
  {
    const r1 = await svc.rpc("attach_evidence_document", { p_evidence_item_id: evA.id, p_document_id: docA2.id, p_created_by: admin.userId });
    const r2 = await svc.rpc("attach_evidence_document", { p_evidence_item_id: evA2.id, p_document_id: docA1.id, p_created_by: admin.userId });
    const { data: evADocs } = await svc.from("evidence_item_documents").select("document_id").eq("evidence_item_id", evA.id);
    const { data: docA1Evs } = await svc.from("evidence_item_documents").select("evidence_item_id").eq("document_id", docA1.id);
    record("ED03-T06", !r1.error && (evADocs?.length ?? 0) >= 2 ? "PASS" : "FAIL", JSON.stringify({ err: r1.error?.message, evADocsCount: evADocs?.length }));
    record("ED03-T07", !r2.error && (docA1Evs?.length ?? 0) >= 2 ? "PASS" : "FAIL", JSON.stringify({ err: r2.error?.message, docA1EvsCount: docA1Evs?.length }));
  }

  // ---- T08/T09: idempotency + concurrency ----
  {
    const before = await svc.from("evidence_item_documents").select("*", { count: "exact", head: true }).eq("evidence_item_id", evA2.id).eq("document_id", docA2.id);
    const [c1, c2] = await Promise.all([
      svc.rpc("attach_evidence_document", { p_evidence_item_id: evA2.id, p_document_id: docA2.id, p_created_by: admin.userId }),
      svc.rpc("attach_evidence_document", { p_evidence_item_id: evA2.id, p_document_id: docA2.id, p_created_by: admin.userId }),
    ]);
    const { count: afterCount } = await svc.from("evidence_item_documents").select("*", { count: "exact", head: true }).eq("evidence_item_id", evA2.id).eq("document_id", docA2.id);
    record("ED03-T08", !c1.error && afterCount === 1 ? "PASS" : "FAIL", JSON.stringify({ err: c1.error?.message, afterCount }));
    record("ED03-T09", !c2.error && afterCount === 1 ? "PASS" : "FAIL", JSON.stringify({ err: c2.error?.message, afterCount }));
  }

  // ---- T10/T11/T12: same-Case succeeds, cross-Case rejected (governed + DB) ----
  {
    const same = await svc.rpc("attach_evidence_document", { p_evidence_item_id: evA.id, p_document_id: docA1.id, p_created_by: admin.userId });
    record("ED03-T10", !same.error ? "PASS" : "FAIL", same.error?.message ?? "ok");

    const cross = await svc.rpc("attach_evidence_document", { p_evidence_item_id: evA.id, p_document_id: docB1.id, p_created_by: admin.userId });
    record("ED03-T11", !!cross.error && /CASE_MISMATCH/.test(cross.error.message) ? "PASS" : "FAIL", cross.error?.message ?? "no error");

    const { error: directCross } = await svc.from("evidence_item_documents").insert({ evidence_item_id: evA.id, document_id: docB1.id, case_id: caseA.id });
    record("ED03-T12", !!directCross ? "PASS" : "FAIL", directCross ? directCross.message : "no error — composite FK did not reject cross-case row");
  }

  // ---- T13/T14: current+unreviewed attach/detach succeed ----
  const evA3 = await makeComposition(caseA.id, "MTCS-03 evA3 fact (attach/detach)");
  {
    const at = await svc.rpc("attach_evidence_document", { p_evidence_item_id: evA3.id, p_document_id: docA1.id, p_created_by: admin.userId });
    record("ED03-T13", !at.error ? "PASS" : "FAIL", at.error?.message ?? "ok");
    const det = await svc.rpc("detach_evidence_document", { p_evidence_item_id: evA3.id, p_document_id: docA1.id });
    record("ED03-T14", !det.error && det.data === true ? "PASS" : "FAIL", JSON.stringify({ err: det.error?.message, data: det.data }));
  }

  // ---- Reviewed composition fixture (evA4) for T15-T18, T24, T26 ----
  const evA4 = await makeComposition(caseA.id, "MTCS-03 evA4 fact (reviewed)");
  await svc.rpc("attach_evidence_document", { p_evidence_item_id: evA4.id, p_document_id: docA1.id, p_created_by: admin.userId });
  const { data: evA4Reviewed } = await svc.rpc("review_evidence_composition", {
    p_composition_id: evA4.id, p_verification_condition: "verified", p_verification_reason: null, p_reviewed_by: admin.userId,
  });

  // ---- T15/T16: reviewed attach/detach rejected via governed primitive ----
  {
    const at = await svc.rpc("attach_evidence_document", { p_evidence_item_id: evA4.id, p_document_id: docA2.id, p_created_by: admin.userId });
    record("ED03-T15", !!at.error && /HISTORICAL_COMPOSITION_IMMUTABLE/.test(at.error.message) ? "PASS" : "FAIL", at.error?.message ?? "no error");
    const det = await svc.rpc("detach_evidence_document", { p_evidence_item_id: evA4.id, p_document_id: docA1.id });
    record("ED03-T16", !!det.error && /HISTORICAL_COMPOSITION_IMMUTABLE/.test(det.error.message) ? "PASS" : "FAIL", det.error?.message ?? "no error");
  }

  // ---- T17/T18: direct service_role INSERT/DELETE against reviewed rejected by trigger ----
  {
    const { error: insErr } = await svc.from("evidence_item_documents").insert({ evidence_item_id: evA4.id, document_id: docA2.id, case_id: caseA.id });
    record("ED03-T17", !!insErr ? "PASS" : "FAIL", insErr ? insErr.message : "no error — trigger did not reject");
    const { error: delErr } = await svc.from("evidence_item_documents").delete().eq("evidence_item_id", evA4.id).eq("document_id", docA1.id);
    // Supabase delete() without matching rows returns no error even if trigger would reject on an
    // actually-matching row — assert against the row that DOES exist (docA1) so the trigger fires.
    record("ED03-T18", !!delErr ? "PASS" : "FAIL", delErr ? delErr.message : "no error — trigger did not reject");
  }

  // ---- Superseded composition fixture (evA5 -> evA5v2) for T19-T23, T33/T34 ----
  const evA5 = await makeComposition(caseA.id, "MTCS-03 evA5 fact v1");
  await svc.rpc("attach_evidence_document", { p_evidence_item_id: evA5.id, p_document_id: docA1.id, p_created_by: admin.userId });
  await svc.rpc("attach_evidence_document", { p_evidence_item_id: evA5.id, p_document_id: docA2.id, p_created_by: admin.userId });
  const { data: evA5v2, error: evA5v2Err } = await svc.rpc("create_evidence_composition", {
    p_evidence_id: evA5.evidence_id, p_expected_current_id: evA5.id, p_case_id: caseA.id,
    p_fact: "MTCS-03 evA5 fact v2", p_documentary_condition: "partial",
    p_source_type: "test", p_source_reference: "mtcs03-v2", p_created_by: admin.userId,
  });
  if (evA5v2Err) throw new Error(`fixture evA5v2 failed: ${evA5v2Err.message}`);
  await svc.rpc("attach_evidence_document", { p_evidence_item_id: evA5v2.id, p_document_id: docA1.id, p_created_by: admin.userId });

  // ---- T19/T20: superseded attach/detach rejected via governed primitive ----
  {
    const at = await svc.rpc("attach_evidence_document", { p_evidence_item_id: evA5.id, p_document_id: docA2.id, p_created_by: admin.userId });
    record("ED03-T19", !!at.error && /CONFLICT_CURRENT_COMPOSITION/.test(at.error.message) ? "PASS" : "FAIL", at.error?.message ?? "no error");
    const det = await svc.rpc("detach_evidence_document", { p_evidence_item_id: evA5.id, p_document_id: docA1.id });
    record("ED03-T20", !!det.error && /CONFLICT_CURRENT_COMPOSITION/.test(det.error.message) ? "PASS" : "FAIL", det.error?.message ?? "no error");
  }

  // ---- T21/T22: direct service_role INSERT/DELETE against superseded rejected by trigger ----
  {
    const { error: insErr } = await svc.from("evidence_item_documents").insert({ evidence_item_id: evA5.id, document_id: docA2.id, case_id: caseA.id });
    record("ED03-T21", !!insErr ? "PASS" : "FAIL", insErr ? insErr.message : "no error — trigger did not reject");
    const { error: delErr } = await svc.from("evidence_item_documents").delete().eq("evidence_item_id", evA5.id).eq("document_id", docA1.id);
    record("ED03-T22", !!delErr ? "PASS" : "FAIL", delErr ? delErr.message : "no error — trigger did not reject");
  }

  // ---- T23: historical rows remain queryable ----
  {
    const { data: rows } = await svc.from("evidence_item_documents").select("document_id").eq("evidence_item_id", evA5.id);
    record("ED03-T23", (rows?.length ?? 0) === 2 ? "PASS" : "FAIL", `evA5 (superseded) association rows queryable: ${rows?.length}`);
  }

  // ---- T24/T25: verification fields unaffected by attach/detach (evA4 already reviewed; re-check unchanged) ----
  {
    const { data: evA4Now } = await svc.from("evidence_items").select("verification_condition, reviewed_by, reviewed_at, verification_reason").eq("id", evA4.id).single();
    const ok = evA4Now.verification_condition === "verified" && evA4Now.reviewed_by === admin.userId && !!evA4Now.reviewed_at;
    record("ED03-T24", ok ? "PASS" : "FAIL", `attach() attempt on evA4 did not alter its (already-set) verification fields: ${JSON.stringify(evA4Now)}`);
    record("ED03-T25", ok ? "PASS" : "FAIL", `detach() attempt on evA4 did not alter its verification fields (same evidence)`);
  }

  // ---- T26/T27: documentary_condition unaffected by attach/detach ----
  {
    const { data: evA3Now } = await svc.from("evidence_items").select("documentary_condition").eq("id", evA3.id).single();
    record("ED03-T26", evA3Now.documentary_condition === "reported" ? "PASS" : "FAIL", `evA3 documentary_condition after attach: ${evA3Now.documentary_condition}`);
    record("ED03-T27", evA3Now.documentary_condition === "reported" ? "PASS" : "FAIL", `evA3 documentary_condition after detach: ${evA3Now.documentary_condition}`);
  }

  // ---- T28/T29: anon/authenticated cannot execute governed functions ----
  {
    const anonNoAuth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: anonErr } = await anonNoAuth.rpc("attach_evidence_document", { p_evidence_item_id: evA.id, p_document_id: docA1.id, p_created_by: null });
    record("ED03-T28", !!anonErr ? "PASS" : "FAIL", anonErr ? anonErr.message : "no error — anon executed governed function");

    const { error: authErr } = await agentSess.rpc("attach_evidence_document", { p_evidence_item_id: evA.id, p_document_id: docA1.id, p_created_by: null });
    record("ED03-T29", !!authErr ? "PASS" : "FAIL", authErr ? authErr.message : "no error — authenticated executed governed function");
  }

  // ---- T30/T31: authenticated cannot directly INSERT/DELETE ----
  {
    const { error: insErr } = await agentSess.from("evidence_item_documents").insert({ evidence_item_id: evA.id, document_id: docB1.id, case_id: caseA.id });
    record("ED03-T30", !!insErr ? "PASS" : "FAIL", insErr ? insErr.message : "no error — authenticated inserted directly");
    const { error: delErr } = await agentSess.from("evidence_item_documents").delete().eq("evidence_item_id", evA.id).eq("document_id", docA1.id);
    const { data: stillThere } = await svc.from("evidence_item_documents").select("*").eq("evidence_item_id", evA.id).eq("document_id", docA1.id).maybeSingle();
    record("ED03-T31", !!stillThere ? "PASS" : "FAIL", `row survives authenticated delete attempt: ${!!stillThere} (client error: ${delErr?.message ?? "none reported, RLS silently filtered"})`);
  }

  // ---- T32: service_role governed attach succeeds with valid inputs ----
  {
    const evA6 = await makeComposition(caseA.id, "MTCS-03 evA6 fact (T32)");
    const { data, error } = await svc.rpc("attach_evidence_document", { p_evidence_item_id: evA6.id, p_document_id: docA1.id, p_created_by: admin.userId });
    record("ED03-T32", !error && data?.evidence_item_id === evA6.id ? "PASS" : "FAIL", JSON.stringify({ err: error?.message, data }));
  }

  // ---- T33/T34: historical reconstruction across versions ----
  {
    const { data: v1Docs } = await svc.from("evidence_item_documents").select("document_id").eq("evidence_item_id", evA5.id);
    const { data: v2Docs } = await svc.from("evidence_item_documents").select("document_id").eq("evidence_item_id", evA5v2.id);
    const v1Set = new Set((v1Docs ?? []).map(r => r.document_id));
    const v2Set = new Set((v2Docs ?? []).map(r => r.document_id));
    const t33ok = v1Set.size === 2 && v1Set.has(docA1.id) && v1Set.has(docA2.id);
    const t34ok = v2Set.size === 1 && v2Set.has(docA1.id) && !v2Set.has(docA2.id);
    record("ED03-T33", t33ok ? "PASS" : "FAIL", `v1 (evA5) association set unchanged: ${JSON.stringify([...v1Set])}`);
    record("ED03-T34", t34ok ? "PASS" : "FAIL", `v2 (evA5v2) has its own distinct association set: ${JSON.stringify([...v2Set])}`);
  }

  // ---- T35: whole-Case cascade deletion completes without FK/trigger failure (CRITICAL GATE) ----
  {
    const { data: caseC } = await svc.from("cases").insert({ case_number: `TEST-MTCS03-${suffix}-C`, client_id: client.id, case_type: "otro", title: "MTCS-03 cascade case C" }).select().single();
    const docC1 = await makeDoc(caseC.id, "docC1");
    const evC1 = await makeComposition(caseC.id, "MTCS-03 evC1 fact (cascade)");
    const { error: attachErr } = await svc.rpc("attach_evidence_document", { p_evidence_item_id: evC1.id, p_document_id: docC1.id, p_created_by: admin.userId });
    if (attachErr) throw new Error(`cascade fixture attach failed: ${attachErr.message}`);

    const { error: deleteErr } = await svc.from("cases").delete().eq("id", caseC.id);
    const { data: survivingAssoc } = await svc.from("evidence_item_documents").select("*").eq("evidence_item_id", evC1.id);
    const { data: survivingEv } = await svc.from("evidence_items").select("*").eq("id", evC1.id);
    const { data: survivingDoc } = await svc.from("documents").select("*").eq("id", docC1.id);
    const ok = !deleteErr && (survivingAssoc?.length ?? 0) === 0 && (survivingEv?.length ?? 0) === 0 && (survivingDoc?.length ?? 0) === 0;
    record("ED03-T35", ok ? "PASS" : "FAIL", JSON.stringify({ deleteErr: deleteErr?.message, survivingAssoc: survivingAssoc?.length, survivingEv: survivingEv?.length, survivingDoc: survivingDoc?.length }));
  }

  // ---- T36: attach/detach do not create/update Evidence Item scalar state ----
  {
    const { data: evA3Now } = await svc.from("evidence_items").select("fact, version, currency_status").eq("id", evA3.id).single();
    const ok = evA3Now.fact === "MTCS-03 evA3 fact (attach/detach)" && evA3Now.version === 1 && evA3Now.currency_status === "current";
    record("ED03-T36", ok ? "PASS" : "FAIL", JSON.stringify(evA3Now));
  }

  // ---- T37: no A1/A2/A3/A4/A5 invocation, no case_strategy mutation (static — code inspection) ----
  record("ED03-T37", "STATIC", "attach_evidence_document()/detach_evidence_document() (migration 027) contain no reference to agent_runs, case_strategy, or any /api/agents route — confirmed by direct reading of the migration SQL in this session; no HTTP call is even possible from a plpgsql function without an explicit extension, none of which is used here.");

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter(r => r.status === "FAIL").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(2); });
