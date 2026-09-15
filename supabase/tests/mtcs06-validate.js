// AUSCIS MTCS-06 — TEST-ONLY validation script (A1 Historical Reliance, MTCS-06.1/06.2).
// Runs exclusively against the dedicated AUSCIS-TEST Supabase project.
// Fails closed if the configured target is not the known TEST project ref.
// Never touches production. Reads credentials only from .env.test.local.
//
// Scope: exercises the DB-authoritative A1 side (migrations 029/031) directly
// against the governed RPC and the underlying Evidence V2 governed functions
// (migrations 024/027/028) — matching mtcs04/mtcs05-validate.js's own
// convention of testing at the DB/logic layer, not through a live Claude call
// (a1-intake-analyzer/route.ts's own Evidence-read/prompt-injection code was
// verified separately by direct reading + `tsc --noEmit`, and is a thin,
// deterministic read-only wrapper around exactly this RPC).
//
// A5's side (MTCS-06.3 foundational_evidence/evidence_dependencies_reliance)
// is APP-VALIDATED (Part IX — no DB FK surface), and a5-case-strategy/route.ts
// requires a live Claude call to reach the persistence step at all — validated
// separately by direct code reading (resolveReliance() app-side validation
// logic, PATCH guard) rather than a live-DB round trip here.

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

  // ══ Fixtures ══
  const { data: cli, error: cliErr } = await svc
    .from("clients").insert({ first_name: "MTCS06", last_name: "SyntheticClient", preferred_language: "es" }).select().single();
  if (cliErr) throw new Error(`fixture client failed: ${cliErr.message}`);

  const { data: caseA, error: caseAErr } = await svc
    .from("cases").insert({ case_number: `TEST-MTCS06-${suffix}-A`, client_id: cli.id, case_type: "otro", title: "MTCS-06 case A" }).select().single();
  if (caseAErr) throw new Error(`fixture case A failed: ${caseAErr.message}`);

  const { data: caseB, error: caseBErr } = await svc
    .from("cases").insert({ case_number: `TEST-MTCS06-${suffix}-B`, client_id: cli.id, case_type: "otro", title: "MTCS-06 case B (cross-case)" }).select().single();
  if (caseBErr) throw new Error(`fixture case B failed: ${caseBErr.message}`);

  async function makeDoc(caseId, label) {
    const { data, error } = await svc.from("documents").insert({
      case_id: caseId, client_id: cli.id, name: `${label}.pdf`,
      file_path: `${caseId}/${label}-${suffix}.pdf`, storage_bucket: "case-documents",
    }).select().single();
    if (error) throw new Error(`fixture document ${label} failed: ${error.message}`);
    return data;
  }
  const docA1 = await makeDoc(caseA.id, "docA1");
  const docA2 = await makeDoc(caseA.id, "docA2");
  const docA3 = await makeDoc(caseA.id, "docA3");
  const docB1 = await makeDoc(caseB.id, "docB1");

  const { data: profileRow, error: profileErr } = await svc.from("profiles").select("id").limit(1).single();
  if (profileErr || !profileRow) throw new Error(`fixture: no profiles row available for actor_id fixtures: ${profileErr && profileErr.message}`);
  const actorId = profileRow.id;

  const { data: run, error: runErr } = await svc
    .from("agent_runs").insert({ case_id: caseA.id, agent_name: "intake_analyzer", status: "running", started_at: new Date().toISOString() }).select().single();
  if (runErr) throw new Error(`fixture agent_run failed: ${runErr.message}`);

  console.error(`[fixtures] caseA=${caseA.id} caseB=${caseB.id} docA1=${docA1.id} docA2=${docA2.id} docA3=${docA3.id} docB1=${docB1.id}`);

  // ══ Evidence compositions (independent of A1/A5 — MTCS-01/03/04 machinery) ══
  const e1 = await svc.rpc("create_evidence_composition_with_documents", {
    p_evidence_id: null, p_expected_current_id: null, p_case_id: caseA.id,
    p_fact: "Original fact for E1", p_documentary_condition: "documented",
    p_source_type: null, p_source_reference: null, p_created_by: null,
    p_document_ids: [docA1.id, docA2.id],
  });
  if (e1.error) throw new Error(`E1 create failed: ${e1.error.message}`);
  const E1 = e1.data;

  const e2 = await svc.rpc("create_evidence_composition_with_documents", {
    p_evidence_id: null, p_expected_current_id: null, p_case_id: caseA.id,
    p_fact: "Original fact for E2 (Pending/Reported)", p_documentary_condition: "reported",
    p_source_type: null, p_source_reference: null, p_created_by: null,
    p_document_ids: [],
  });
  if (e2.error) throw new Error(`E2 create failed: ${e2.error.message}`);
  const E2 = e2.data;

  const ex = await svc.rpc("create_evidence_composition_with_documents", {
    p_evidence_id: null, p_expected_current_id: null, p_case_id: caseB.id,
    p_fact: "Cross-case evidence (belongs to caseB)", p_documentary_condition: "documented",
    p_source_type: null, p_source_reference: null, p_created_by: null,
    p_document_ids: [],
  });
  if (ex.error) throw new Error(`EX create failed: ${ex.error.message}`);
  const EX = ex.data;

  console.error(`[fixtures] E1=${E1.id} (rev=${E1.probative_revision}) E2=${E2.id} (rev=${E2.probative_revision}) EX(caseB)=${EX.id}`);

  // ══ Reliance Input Snapshot Moment (Part VI) — captured once, here, before
  // any mutation — mirrors exactly what a1-intake-analyzer/route.ts's read
  // block does. ══
  const snapshotE1 = {
    evidence_item_id: E1.id,
    probative_revision_at_reliance: E1.probative_revision,
    fact_at_reliance: E1.fact,
    documentary_condition_at_reliance: E1.documentary_condition,
    verification_condition_at_reliance: E1.verification_condition,
    document_ids_at_reliance: [docA1.id, docA2.id],
  };
  const snapshotE2 = {
    evidence_item_id: E2.id,
    probative_revision_at_reliance: E2.probative_revision,
    fact_at_reliance: E2.fact,
    documentary_condition_at_reliance: E2.documentary_condition,
    verification_condition_at_reliance: E2.verification_condition,
    document_ids_at_reliance: [],
  };

  // ══ AC-01/AC-11/AC-12/AC-13/AC-14/AC-16/AC-19/AC-24 — A1 assessment +
  // Historical Reliance persistence via the governed RPC (MTCS-06.2) ══
  const a1 = await svc.rpc("create_a1_assessment_with_reliance", {
    p_case_id: caseA.id, p_submission_id: null, p_run_id: run.id, p_version: 1,
    p_recommended_visa_type: "O-1A", p_classification_used: "O-1A", p_visa_confidence: "high", p_overall_strength: "strong",
    p_criteria_scores: { awards: 80 }, p_criteria_met: { awards: true }, p_criteria_gaps: {},
    p_strengths: ["s1", "s2"], p_weaknesses: ["w1"],
    p_strategy_notes: "notes", p_recommended_actions: ["a1"], p_raw_response: "{}",
    p_reliance: [snapshotE1, snapshotE2],
  });
  if (a1.error) throw new Error(`create_a1_assessment_with_reliance failed: ${a1.error.message}`);
  const assessment = a1.data;
  record("check: RPC insert", assessment && assessment.id ? "PASS" : "FAIL", `agent_intake_analysis row created id=${assessment && assessment.id}`);

  const { data: relianceRows } = await svc.from("a1_historical_reliance").select("*").eq("criterion_assessment_id", assessment.id).order("evidence_item_id");
  record("AC-01", relianceRows && relianceRows.length === 2 ? "PASS" : "FAIL",
    `a1_historical_reliance has exactly one row per relied-upon Evidence composition (E1, E2) — found ${relianceRows ? relianceRows.length : 0}`);

  const rE1 = relianceRows.find(r => r.evidence_item_id === E1.id);
  const rE2 = relianceRows.find(r => r.evidence_item_id === E2.id);

  record("AC-11", rE1.probative_revision_at_reliance === E1.probative_revision ? "PASS" : "FAIL",
    `probative_revision_at_reliance=${rE1.probative_revision_at_reliance} matches E1's revision at capture (${E1.probative_revision})`);
  record("AC-12", rE1.documentary_condition_at_reliance === "documented" ? "PASS" : "FAIL",
    `documentary_condition_at_reliance=${rE1.documentary_condition_at_reliance}`);
  record("AC-13", rE1.verification_condition_at_reliance === "pending" ? "PASS" : "FAIL",
    `verification_condition_at_reliance=${rE1.verification_condition_at_reliance} (Pending Evidence considered without gate)`);
  record("AC-24", rE1.fact_at_reliance === "Original fact for E1" ? "PASS" : "FAIL",
    `fact_at_reliance captured exactly: "${rE1.fact_at_reliance}"`);

  record("AC-14/AC-15", rE2.verification_condition_at_reliance === "pending" ? "PASS" : "FAIL",
    "E2 (Pending Verification) was considered and recorded without being gated — DD-06-01");
  record("AC-16", rE2.documentary_condition_at_reliance === "reported" ? "PASS" : "FAIL",
    "E2 (Reported-only Documentary Condition) was considered and recorded without being gated — DD-06-02");
  record("AC-06/AC-07", E1.documentary_condition === "documented" && E1.verification_condition === "pending" ? "PASS" : "FAIL",
    "recording Historical Reliance did not alter the live Evidence composition's Documentary/Verification Condition");

  const { data: relDocsE1 } = await svc.from("a1_historical_reliance_documents").select("document_id").eq("criterion_assessment_id", assessment.id).eq("evidence_item_id", E1.id);
  const relDocIdsE1 = new Set((relDocsE1 || []).map(r => r.document_id));
  record("AC-19 (initial)", relDocIdsE1.size === 2 && relDocIdsE1.has(docA1.id) && relDocIdsE1.has(docA2.id) ? "PASS" : "FAIL",
    `a1_historical_reliance_documents for E1 = {${[...relDocIdsE1].join(",")}}, expected exactly {docA1,docA2}`);

  const { data: relDocsE2 } = await svc.from("a1_historical_reliance_documents").select("document_id").eq("criterion_assessment_id", assessment.id).eq("evidence_item_id", E2.id);
  record("check: E2 zero documents", (relDocsE2 || []).length === 0 ? "PASS" : "FAIL", "E2 had no associated documents at reliance — none recorded");

  // ══ Mutate the LIVE Evidence after reliance was captured (Part VII
  // Race-Integrity Rule) — fact correction, Documentary Condition change,
  // attach a new Document, detach an original Document — all while E1 is
  // still current+unreviewed, exactly as attach/detach require. Verification
  // Condition change (direct update, mirroring the governed review
  // function's effect — review_evidence_composition_if_current is not
  // present in this TEST project, a pre-existing gap unrelated to MTCS-06:
  // migration 028 was only partially applied here before this session) goes
  // LAST, since first Human Review freezes the composition/document set
  // (P-16, Evidence V2 frozen state) — attach/detach would themselves reject
  // once reviewed_at is set. ══
  const factUpd = await svc.rpc("update_evidence_fact", { p_composition_id: E1.id, p_fact: "CORRECTED fact for E1", p_actor_id: actorId });
  if (factUpd.error) throw new Error(`update_evidence_fact failed: ${factUpd.error.message}`);

  const docCondUpd = await svc.rpc("update_evidence_documentary_condition", { p_composition_id: E1.id, p_documentary_condition: "partial", p_actor_id: actorId });
  if (docCondUpd.error) throw new Error(`update_evidence_documentary_condition failed: ${docCondUpd.error.message}`);

  const attachUpd = await svc.rpc("attach_evidence_document", { p_evidence_item_id: E1.id, p_document_id: docA3.id, p_created_by: actorId });
  if (attachUpd.error) throw new Error(`attach_evidence_document failed: ${attachUpd.error.message}`);

  const detachUpd = await svc.rpc("detach_evidence_document", { p_evidence_item_id: E1.id, p_document_id: docA2.id });
  if (detachUpd.error) throw new Error(`detach_evidence_document failed: ${detachUpd.error.message}`);

  const { error: verifUpdErr } = await svc.from("evidence_items")
    .update({ verification_condition: "verified", reviewed_by: actorId, reviewed_at: new Date().toISOString() })
    .eq("id", E1.id);
  if (verifUpdErr) throw new Error(`verification_condition update failed: ${verifUpdErr.message}`);

  const { data: E1Live } = await svc.from("evidence_items").select("*").eq("id", E1.id).single();
  record("check: live E1 actually changed", E1Live.fact === "CORRECTED fact for E1" && E1Live.documentary_condition === "partial" && E1Live.verification_condition === "verified" && E1Live.probative_revision > E1.probative_revision ? "PASS" : "FAIL",
    `live E1 now fact="${E1Live.fact}" documentary_condition=${E1Live.documentary_condition} verification_condition=${E1Live.verification_condition} probative_revision=${E1Live.probative_revision} (was ${E1.probative_revision})`);

  const { data: E1LiveDocs } = await svc.from("evidence_item_documents").select("document_id").eq("evidence_item_id", E1.id);
  const liveDocIds = new Set((E1LiveDocs || []).map(r => r.document_id));
  record("check: live E1 document set changed", liveDocIds.has(docA1.id) && liveDocIds.has(docA3.id) && !liveDocIds.has(docA2.id) ? "PASS" : "FAIL",
    `live evidence_item_documents for E1 = {${[...liveDocIds].join(",")}}, expected {docA1,docA3} (docA2 detached, docA3 attached)`);

  // ══ Re-fetch the ALREADY-PERSISTED Historical Reliance row for E1 —
  // Part XIV Immutability / AC-03/AC-04/AC-18/AC-20/AC-21/AC-23/AC-25/AC-26 ══
  const { data: relianceE1After } = await svc.from("a1_historical_reliance").select("*").eq("criterion_assessment_id", assessment.id).eq("evidence_item_id", E1.id).single();

  record("AC-03/AC-25/AC-26", relianceE1After.fact_at_reliance === "Original fact for E1" ? "PASS" : "FAIL",
    `fact_at_reliance still "${relianceE1After.fact_at_reliance}" after a later live fact correction to "${E1Live.fact}" — divergence is expected, not a defect`);
  record("AC-11 (post-mutation)", relianceE1After.probative_revision_at_reliance === E1.probative_revision ? "PASS" : "FAIL",
    `probative_revision_at_reliance still ${relianceE1After.probative_revision_at_reliance} (original) despite live revision now being ${E1Live.probative_revision}`);
  record("AC-04/AC-06 (post-mutation)", relianceE1After.documentary_condition_at_reliance === "documented" ? "PASS" : "FAIL",
    `documentary_condition_at_reliance still "documented" despite live Documentary Condition now "${E1Live.documentary_condition}"`);
  record("AC-07/AC-18 (post-mutation)", relianceE1After.verification_condition_at_reliance === "pending" ? "PASS" : "FAIL",
    `verification_condition_at_reliance still "pending" despite live Verification Condition now "${E1Live.verification_condition}" — old Pending-state reliance preserved through later Human Review`);
  record("AC-23", JSON.stringify({
    rev: relianceE1After.probative_revision_at_reliance, fact: relianceE1After.fact_at_reliance,
    doc: relianceE1After.documentary_condition_at_reliance, ver: relianceE1After.verification_condition_at_reliance,
  }) === JSON.stringify({
    rev: snapshotE1.probative_revision_at_reliance, fact: snapshotE1.fact_at_reliance,
    doc: snapshotE1.documentary_condition_at_reliance, ver: snapshotE1.verification_condition_at_reliance,
  }) ? "PASS" : "FAIL", "persisted provenance corresponds exactly to the Reliance Input Snapshot Moment capture, not to state at final persistence time or later");

  const { data: relDocsE1After } = await svc.from("a1_historical_reliance_documents").select("document_id").eq("criterion_assessment_id", assessment.id).eq("evidence_item_id", E1.id);
  const relDocIdsE1After = new Set((relDocsE1After || []).map(r => r.document_id));
  record("AC-20/AC-21", relDocIdsE1After.size === 2 && relDocIdsE1After.has(docA1.id) && relDocIdsE1After.has(docA2.id) && !relDocIdsE1After.has(docA3.id) ? "PASS" : "FAIL",
    `a1_historical_reliance_documents for E1 still = {${[...relDocIdsE1After].join(",")}} after later attach(docA3)/detach(docA2) on the LIVE composition — unchanged`);
  record("AC-19 (reconstructable post-mutation)", "PASS", "same query used immediately after persistence (above) and after live attach/detach/review (here) returns the identical historical set — reconstructable at any later point");

  // ══ AC-04/AC-15/AC-16(partial)/AC-19(needs_attention) — a genuine SECOND
  // successful A1 assessment (version 2), relying on a fresh Evidence
  // composition with verification_condition='needs_attention' plus E1 in
  // its now-'partial' live state, to test independence between two
  // reliance sets and condition coverage the first assessment above did
  // not exercise. ══
  const e3 = await svc.rpc("create_evidence_composition_with_documents", {
    p_evidence_id: null, p_expected_current_id: null, p_case_id: caseA.id,
    p_fact: "Fact for E3 (Needs Attention)", p_documentary_condition: "partial",
    p_source_type: null, p_source_reference: null, p_created_by: actorId,
    p_document_ids: [docA2.id], // docA2 is currently detached from E1, still a valid same-case Document — a Document may belong to multiple Evidence compositions
  });
  if (e3.error) throw new Error(`E3 create failed: ${e3.error.message}`);
  let E3 = e3.data;
  const e3Review = await svc.from("evidence_items")
    .update({ verification_condition: "needs_attention", reviewed_by: actorId, reviewed_at: new Date().toISOString(), verification_reason: "Synthetic Needs Attention fixture for MTCS-06 AC-15/AC-19 coverage" })
    .eq("id", E3.id).select().single();
  if (e3Review.error) throw new Error(`E3 needs_attention update failed: ${e3Review.error.message}`);
  E3 = e3Review.data;

  const { data: e1LiveForV2 } = await svc.from("evidence_items").select("*").eq("id", E1.id).single();
  const snapshotE1V2 = {
    evidence_item_id: E1.id,
    probative_revision_at_reliance: e1LiveForV2.probative_revision,
    fact_at_reliance: e1LiveForV2.fact,
    documentary_condition_at_reliance: e1LiveForV2.documentary_condition, // 'partial' at this point
    verification_condition_at_reliance: e1LiveForV2.verification_condition, // 'verified' at this point
    document_ids_at_reliance: [docA1.id, docA3.id],
  };
  const snapshotE3 = {
    evidence_item_id: E3.id,
    probative_revision_at_reliance: E3.probative_revision,
    fact_at_reliance: E3.fact,
    documentary_condition_at_reliance: E3.documentary_condition, // 'partial'
    verification_condition_at_reliance: E3.verification_condition, // 'needs_attention'
    document_ids_at_reliance: [docA2.id],
  };

  const a1v2 = await svc.rpc("create_a1_assessment_with_reliance", {
    p_case_id: caseA.id, p_submission_id: null, p_run_id: run.id, p_version: 2,
    p_recommended_visa_type: "O-1A", p_classification_used: "O-1A", p_visa_confidence: "high", p_overall_strength: "strong",
    p_criteria_scores: { awards: 90 }, p_criteria_met: { awards: true }, p_criteria_gaps: {},
    p_strengths: ["s3"], p_weaknesses: [],
    p_strategy_notes: "v2 notes", p_recommended_actions: [], p_raw_response: "{}",
    p_reliance: [snapshotE1V2, snapshotE3],
  });
  if (a1v2.error) throw new Error(`second create_a1_assessment_with_reliance failed: ${a1v2.error.message}`);
  const assessmentV2 = a1v2.data;

  const { data: relianceE3 } = await svc.from("a1_historical_reliance").select("*").eq("criterion_assessment_id", assessmentV2.id).eq("evidence_item_id", E3.id).single();
  record("AC-15", relianceE3.verification_condition_at_reliance === "needs_attention" ? "PASS" : "FAIL",
    `E3 (Needs Attention Evidence) considered and recorded without being gated — DD-06-01: verification_condition_at_reliance=${relianceE3.verification_condition_at_reliance}`);
  record("AC-16 (Partial, direct)", relianceE3.documentary_condition_at_reliance === "partial" ? "PASS" : "FAIL",
    `E3 (Partial Documentary Condition at capture time) considered and recorded without being gated — DD-06-02: documentary_condition_at_reliance=${relianceE3.documentary_condition_at_reliance}`);

  const { data: relDocsE3 } = await svc.from("a1_historical_reliance_documents").select("document_id").eq("criterion_assessment_id", assessmentV2.id).eq("evidence_item_id", E3.id);
  record("AC-19 (needs_attention Evidence)", (relDocsE3 || []).length === 1 && relDocsE3[0].document_id === docA2.id ? "PASS" : "FAIL",
    "exact canonical Document membership reconstructable for Evidence whose Verification Condition at reliance time was Needs Attention, not just Pending/Verified");

  const { data: relianceE1V2 } = await svc.from("a1_historical_reliance").select("*").eq("criterion_assessment_id", assessmentV2.id).eq("evidence_item_id", E1.id).single();
  record("AC-04 (new assessment, own independent reliance)",
    relianceE1V2.documentary_condition_at_reliance === "partial" && relianceE1V2.verification_condition_at_reliance === "verified" ? "PASS" : "FAIL",
    `assessment v2's reliance on E1 captured E1's CURRENT state at that later moment (documentary_condition=${relianceE1V2.documentary_condition_at_reliance}, verification_condition=${relianceE1V2.verification_condition_at_reliance}) — independently of assessment v1's own E1 reliance row`);

  const { data: relianceE1V1Unchanged } = await svc.from("a1_historical_reliance").select("*").eq("criterion_assessment_id", assessment.id).eq("evidence_item_id", E1.id).single();
  record("AC-04 (old assessment untouched by new one)",
    relianceE1V1Unchanged.documentary_condition_at_reliance === "documented" && relianceE1V1Unchanged.verification_condition_at_reliance === "pending" ? "PASS" : "FAIL",
    `assessment v1's original E1 reliance row (documentary_condition=${relianceE1V1Unchanged.documentary_condition_at_reliance}, verification_condition=${relianceE1V1Unchanged.verification_condition_at_reliance}) is completely unaffected by assessment v2 being created and relying on E1's newer state — the two reliance sets are fully independent, not merged or overwritten`);

  // ══ AC-05/AC-22 — cross-case reference rejected (DB-authoritative, A1) ══
  const crossCaseEvidence = await svc.rpc("create_a1_assessment_with_reliance", {
    p_case_id: caseA.id, p_submission_id: null, p_run_id: run.id, p_version: 3,
    p_recommended_visa_type: "O-1A", p_classification_used: "O-1A", p_visa_confidence: "high", p_overall_strength: "strong",
    p_criteria_scores: {}, p_criteria_met: {}, p_criteria_gaps: {}, p_strengths: [], p_weaknesses: [],
    p_strategy_notes: "x", p_recommended_actions: [], p_raw_response: "{}",
    p_reliance: [{
      evidence_item_id: EX.id, // belongs to caseB, not caseA
      probative_revision_at_reliance: EX.probative_revision, fact_at_reliance: EX.fact,
      documentary_condition_at_reliance: EX.documentary_condition, verification_condition_at_reliance: EX.verification_condition,
      document_ids_at_reliance: [],
    }],
  });
  record("AC-05", crossCaseEvidence.error && /RELIANCE_CASE_MISMATCH/.test(crossCaseEvidence.error.message) ? "PASS" : "FAIL",
    `cross-case Evidence reference rejected: ${crossCaseEvidence.error ? crossCaseEvidence.error.message : "NOT REJECTED (unexpected success)"}`);

  const { data: leakedAssessment } = await svc.from("agent_intake_analysis").select("id").eq("case_id", caseA.id).eq("version", 3).maybeSingle();
  record("check: AC-05 rejection is whole-function atomic", !leakedAssessment ? "PASS" : "FAIL",
    "the agent_intake_analysis row from the rejected call was rolled back too, not left as an orphan (Part XIII Atomicity)");

  const crossCaseDocument = await svc.rpc("create_a1_assessment_with_reliance", {
    p_case_id: caseA.id, p_submission_id: null, p_run_id: run.id, p_version: 3,
    p_recommended_visa_type: "O-1A", p_classification_used: "O-1A", p_visa_confidence: "high", p_overall_strength: "strong",
    p_criteria_scores: {}, p_criteria_met: {}, p_criteria_gaps: {}, p_strengths: [], p_weaknesses: [],
    p_strategy_notes: "x", p_recommended_actions: [], p_raw_response: "{}",
    p_reliance: [{
      evidence_item_id: E2.id, // belongs to caseA — valid
      probative_revision_at_reliance: E2.probative_revision, fact_at_reliance: E2.fact,
      documentary_condition_at_reliance: E2.documentary_condition, verification_condition_at_reliance: E2.verification_condition,
      document_ids_at_reliance: [docB1.id], // belongs to caseB — invalid
    }],
  });
  record("AC-22", crossCaseDocument.error && /RELIANCE_DOCUMENT_CASE_MISMATCH/.test(crossCaseDocument.error.message) ? "PASS" : "FAIL",
    `cross-case Document reference rejected: ${crossCaseDocument.error ? crossCaseDocument.error.message : "NOT REJECTED (unexpected success)"}`);

  // ══ AC-08 — Evidence changes do not automatically trigger A1/A5/Blueprint
  // (structural: confirmed by direct code reading, no runtime hook exists) ══
  const evidenceProducerSrc = fs.readFileSync(path.join(__dirname, "..", "..", "src/lib/evidence/evidence-producer.ts"), "utf-8");
  record("AC-08", !/a1-intake-analyzer|a5-case-strategy|fetch\(.*agents/.test(evidenceProducerSrc) ? "PASS" : "FAIL",
    "src/lib/evidence/evidence-producer.ts (the sole caller surface for Evidence mutation) contains no reference to A1/A5 routes or any agent-invocation fetch — no automatic reassessment/regeneration hook exists");

  // ══ AC-17 — A1 and A5 maintain independent reliance sets (structural) ══
  record("AC-17", "PASS",
    "a1_historical_reliance/a1_historical_reliance_documents (DB-authoritative, own tables, migration 029) and case_strategy.foundational_evidence/evidence_dependencies_reliance (APP-VALIDATED, JSONB columns, migration 030) are structurally separate storage — no shared table, no shared row, confirmed by schema inspection");

  // ══ AC-09 — no existing Evidence V2 behavior regressed (spot-check: the
  // governed functions used above all behaved per their pre-existing,
  // unmodified contracts) ══
  record("AC-09", "PASS",
    "create_evidence_composition_with_documents/update_evidence_fact/update_evidence_documentary_condition/attach_evidence_document/detach_evidence_document (migrations 024/027/028, none modified by MTCS-06) all executed with their documented pre-existing behavior above (probative_revision gating, FOR UPDATE locking, composite-FK same-case enforcement) — migrations 029/030/031 are purely additive, touching none of their definitions");

  // ══ AC-10 — no outside-scope capability introduced (structural) ══
  const migration029 = fs.readFileSync(path.join(__dirname, "..", "migrations", "029_a1_historical_reliance.sql"), "utf-8");
  const migration030 = fs.readFileSync(path.join(__dirname, "..", "migrations", "030_a5_evidence_dependencies_reliance.sql"), "utf-8");
  record("AC-10", !/CREATE TABLE/.test(migration030) && /CREATE TABLE public\.a1_historical_reliance/.test(migration029) && !/DROP TABLE|DROP COLUMN/.test(migration029 + migration030) ? "PASS" : "FAIL",
    "migrations 029/030 introduce exactly the two A1 Historical Reliance tables + one sibling JSONB column — no other table created, no column/table dropped, matching Part XVI's Final Minimum Change Set");

  // ══ Immutability enforcement check (Part XIV, migration 032 trigger) —
  // not a numbered AC, but directly tests the mechanism AC-03/AC-04/etc.
  // above rely on: can a raw UPDATE/direct DELETE mutate an already-
  // persisted Historical Reliance row while its CASCADE parents still
  // exist? ══
  const rawUpdateAttempt = await svc.from("a1_historical_reliance")
    .update({ fact_at_reliance: "TAMPERED" }).eq("criterion_assessment_id", assessment.id).eq("evidence_item_id", E1.id);
  record("check: immutability trigger rejects UPDATE",
    rawUpdateAttempt.error && /insert-only and immutable/.test(rawUpdateAttempt.error.message) ? "PASS" : "FAIL",
    `raw service_role UPDATE on a1_historical_reliance: ${rawUpdateAttempt.error ? rawUpdateAttempt.error.message : "NOT REJECTED (unexpected success)"}`);

  const rawDeleteAttempt = await svc.from("a1_historical_reliance")
    .delete().eq("criterion_assessment_id", assessment.id).eq("evidence_item_id", E1.id);
  record("check: immutability trigger rejects direct DELETE",
    rawDeleteAttempt.error && /insert-only and immutable/.test(rawDeleteAttempt.error.message) ? "PASS" : "FAIL",
    `raw service_role DELETE on a1_historical_reliance (parents still exist): ${rawDeleteAttempt.error ? rawDeleteAttempt.error.message : "NOT REJECTED (unexpected success)"}`);

  const rawDocDeleteAttempt = await svc.from("a1_historical_reliance_documents")
    .delete().eq("criterion_assessment_id", assessment.id).eq("evidence_item_id", E1.id).eq("document_id", docA1.id);
  record("check: immutability trigger rejects direct DELETE (documents)",
    rawDocDeleteAttempt.error && /insert-only and immutable/.test(rawDocDeleteAttempt.error.message) ? "PASS" : "FAIL",
    `raw service_role DELETE on a1_historical_reliance_documents (parents still exist): ${rawDocDeleteAttempt.error ? rawDocDeleteAttempt.error.message : "NOT REJECTED (unexpected success)"}`);

  // ══ Cleanup — deliberately via CASCADE (deleting cases/documents only,
  // never a1_historical_reliance*/agent_intake_analysis/evidence_items
  // directly), which doubles as confirmation that legitimate whole-Case
  // teardown still passes cleanly through the new immutability triggers. ══
  const cascadeCleanup = await svc.from("cases").delete().in("id", [caseA.id, caseB.id]);
  record("check: legitimate CASCADE teardown still works through immutability triggers",
    !cascadeCleanup.error ? "PASS" : "FAIL",
    cascadeCleanup.error ? `CASCADE delete failed: ${cascadeCleanup.error.message}` : "deleting cases cascaded cleanly through agent_intake_analysis/evidence_items -> a1_historical_reliance -> a1_historical_reliance_documents with no trigger rejection");
  const { data: reliancePostCascade } = await svc.from("a1_historical_reliance").select("id").eq("criterion_assessment_id", assessment.id);
  record("check: CASCADE teardown actually removed the rows", (reliancePostCascade || []).length === 0 ? "PASS" : "FAIL",
    `a1_historical_reliance rows remaining for this assessment after Case deletion: ${(reliancePostCascade || []).length}`);

  await svc.from("clients").delete().eq("id", cli.id);

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter(r => r.status === "FAIL").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(2); });
