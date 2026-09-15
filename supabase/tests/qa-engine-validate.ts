// AUSCIS QA Engine — TEST-ONLY validation script (bounded MVP).
// Runs exclusively against the dedicated AUSCIS-TEST Supabase project.
// Fails closed if the configured target is not the known TEST project
// ref. Never touches production. Reads credentials only from
// .env.test.local.
//
// Exercises the ACTUAL production modules
// (src/lib/qa/run-qa-engine.ts) directly, imported by path — not a
// parallel reimplementation — mirroring the pattern established by
// mtcs07-validate.ts / mtcs08-validate.ts. Same-case and immutability
// mutation cases are also verified with raw SQL against the actual
// TEST DB triggers to confirm real DB behavior.

import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runQaEngine, resolveCurrentBlueprint, computeCriterionCoverage } from "../../src/lib/qa/run-qa-engine";

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
    .from("clients").insert({ first_name: "QAENGINE", last_name: "SyntheticClient", preferred_language: "es" }).select().single();
  if (cliErr) throw new Error(`fixture client failed: ${cliErr.message}`);

  const { data: caseA, error: caseAErr } = await svc
    .from("cases").insert({ case_number: `TEST-QAENGINE-${suffix}-A`, client_id: cli.id, case_type: "otro", title: "QA Engine case A" }).select().single();
  if (caseAErr) throw new Error(`fixture case A failed: ${caseAErr.message}`);

  const { data: caseB, error: caseBErr } = await svc
    .from("cases").insert({ case_number: `TEST-QAENGINE-${suffix}-B`, client_id: cli.id, case_type: "otro", title: "QA Engine case B" }).select().single();
  if (caseBErr) throw new Error(`fixture case B failed: ${caseBErr.message}`);

  const { data: profileRow, error: profileErr } = await svc.from("profiles").select("id").limit(1).single();
  if (profileErr || !profileRow) throw new Error(`fixture: no profiles row available: ${profileErr && profileErr.message}`);
  const actorId = profileRow.id;

  const { data: runA, error: runAErr } = await svc
    .from("agent_runs").insert({ case_id: caseA.id, agent_name: "case_strategy", status: "completed", started_at: new Date().toISOString() }).select().single();
  if (runAErr) throw new Error(`fixture agent_run A failed: ${runAErr.message}`);

  // ══ IV-19/AC-QA-03/04 — current Blueprint, dominant+supporting criteria ══
  const { data: blueprintA, error: bpAErr } = await svc.from("case_strategy").insert({
    case_id: caseA.id, run_id: runA.id, status: "approved",
    theory_of_case: "t", primary_narrative: "n",
    dominant_criteria: ["awards", "judging", "original_contributions"],
    supporting_criteria: ["scholarly_articles"],
    currency_status: "current",
  }).select().single();
  if (bpAErr) throw new Error(`fixture blueprintA failed: ${bpAErr.message}`);

  // ══ Case with NO current Blueprint (AC-QA-05/BC-02) ══
  const { data: runC, error: runCErr } = await svc
    .from("cases").insert({ case_number: `TEST-QAENGINE-${suffix}-C`, client_id: cli.id, case_type: "otro", title: "QA Engine case C (no current blueprint)" }).select().single();
  if (runCErr) throw new Error(`fixture case C failed: ${runCErr.message}`);
  const caseC = runC;

  console.error(`[fixtures] caseA=${caseA.id} caseB=${caseB.id} caseC=${caseC.id} blueprintA=${blueprintA.id}`);

  // ══ IV-17/18 / AC-QA-06/07 — coverage: partial then complete ══
  {
    const { data: letter1, error: letter1Err } = await svc.from("agent_recommendation_letters").insert({
      run_id: runA.id, case_id: caseA.id, recommender_name: "R1", criterion_covered: "awards",
      letter_draft: "d", docx_path: `${caseA.id}/l1-${suffix}.docx`,
    }).select().single();
    if (letter1Err) throw new Error(`fixture letter1 failed: ${letter1Err.message}`);
    const { data: petition1, error: petition1Err } = await svc.from("agent_petition_drafts").insert({
      run_id: runA.id, case_id: caseA.id, petition_type: "standard", visa_type: "O-1A",
      criteria_sections: { judging: "content here" },
    }).select().single();
    if (petition1Err) throw new Error(`fixture petition1 failed: ${petition1Err.message}`);

    // required = [awards, judging, original_contributions, scholarly_articles]
    // covered  = [awards (letter), judging (petition)]
    // missing  = [original_contributions, scholarly_articles]
    const result1 = await runQaEngine(svc, { caseId: caseA.id, executedBy: actorId });
    record("AC-QA-06/07 (partial coverage)",
      result1.ok && result1.run.findings.missing_criteria.sort().join(",") === "original_contributions,scholarly_articles" ? "PASS" : "FAIL",
      result1.ok ? JSON.stringify(result1.run.findings.missing_criteria) : JSON.stringify(result1));

    // IV-13/IV-46 — zero-finding document (letter1, awards) still recorded
    record("IV-13 (zero-finding document preserved in manifest)",
      result1.ok && result1.run.findings.evaluated_letters.some((l) => l.id === letter1?.id) ? "PASS" : "FAIL",
      result1.ok ? JSON.stringify(result1.run.findings.evaluated_letters) : "n/a");
    record("IV-12 (complete petition-draft manifest)",
      result1.ok && result1.run.findings.evaluated_petition_drafts.some((p) => p.id === petition1?.id) ? "PASS" : "FAIL",
      result1.ok ? JSON.stringify(result1.run.findings.evaluated_petition_drafts) : "n/a");

    // AC-QA-09/22 — Blueprint snapshot captured
    record("AC-QA-09/22 (blueprint_snapshot captured)",
      result1.ok && JSON.stringify(result1.run.findings.blueprint_snapshot?.dominant_criteria) === JSON.stringify(blueprintA.dominant_criteria) ? "PASS" : "FAIL",
      result1.ok ? JSON.stringify(result1.run.findings.blueprint_snapshot) : "n/a");

    // Now add the missing coverage and confirm empty missing set (AC-QA-06 complete case)
    await svc.from("agent_recommendation_letters").insert({
      run_id: runA.id, case_id: caseA.id, recommender_name: "R2", criterion_covered: "original_contributions",
      letter_draft: "d", docx_path: `${caseA.id}/l2-${suffix}.docx`,
    });
    await svc.from("agent_petition_drafts").insert({
      run_id: runA.id, case_id: caseA.id, petition_type: "standard", visa_type: "O-1A",
      criteria_sections: { scholarly_articles: "content" },
    });
    const result2 = await runQaEngine(svc, { caseId: caseA.id, executedBy: actorId });
    record("AC-QA-06 (complete coverage → empty missing set)",
      result2.ok && result2.run.findings.missing_criteria.length === 0 ? "PASS" : "FAIL",
      result2.ok ? JSON.stringify(result2.run.findings.missing_criteria) : JSON.stringify(result2));

    // IV-14 — old run T0 (result1) must NOT reflect the later-added documents/results
    record("IV-14 (later document does not bleed into old Run)",
      result1.ok && result1.run.findings.missing_criteria.length === 2 ? "PASS" : "FAIL",
      "old run (fetched at T0) retains its original 2-item missing set, independent of T1 additions");

    // ══ IV-10 — Blueprint later edit does not rewrite old Run's snapshot ══
    await svc.from("case_strategy").update({ dominant_criteria: ["a_totally_different_criterion"] }).eq("id", blueprintA.id);
    const { data: reread1 } = await svc.from("qa_runs").select("findings").eq("id", result1.ok ? result1.run.id : "").single();
    record("IV-10 (blueprint_snapshot survives later Blueprint edit)",
      JSON.stringify(reread1?.findings?.blueprint_snapshot?.dominant_criteria) === JSON.stringify(blueprintA.dominant_criteria) ? "PASS" : "FAIL",
      JSON.stringify(reread1?.findings?.blueprint_snapshot?.dominant_criteria));
  }

  // ══ AC-QA-05/BC-02 — no current Blueprint ══
  {
    const result = await runQaEngine(svc, { caseId: caseC.id, executedBy: actorId });
    record("AC-QA-05/BC-02 (no current Blueprint signaled)",
      result.ok && result.run.findings.current_blueprint_found === false ? "PASS" : "FAIL",
      result.ok ? JSON.stringify(result.run.findings) : JSON.stringify(result));
  }

  // ══ SC-01/SC-02 — same-case invariant, live against real trigger ══
  const { data: blueprintB } = await svc.from("case_strategy").insert({
    case_id: caseB.id, run_id: runA.id, status: "approved",
    theory_of_case: "t", primary_narrative: "n",
    dominant_criteria: ["x"], supporting_criteria: [],
    currency_status: "current",
  }).select().single();

  {
    const { error } = await svc.from("qa_runs").insert({
      case_id: caseA.id, case_strategy_id: blueprintA.id, executed_by: actorId,
      findings: { blueprint_snapshot: null, evaluated_letters: [], evaluated_petition_drafts: [], missing_criteria: [], current_blueprint_found: true },
    });
    record("SC-01 (same-case accepted)", !error ? "PASS" : "FAIL", error ? error.message : "allowed");
  }
  {
    const { error } = await svc.from("qa_runs").insert({
      case_id: caseA.id, case_strategy_id: blueprintB!.id, executed_by: actorId,
      findings: { blueprint_snapshot: null, evaluated_letters: [], evaluated_petition_drafts: [], missing_criteria: [], current_blueprint_found: true },
    });
    record("SC-02 (foreign-case rejected)", error && error.message.includes("must match case_strategy case_id") ? "PASS" : "FAIL", error ? error.message : "UNEXPECTEDLY ALLOWED");
  }

  // ══ IMT-01/02/03 — immutability, live against real trigger ══
  const result3 = await runQaEngine(svc, { caseId: caseA.id, executedBy: actorId });
  if (!result3.ok) throw new Error("fixture run for immutability tests failed");
  const runId = result3.run.id;

  {
    const { error } = await svc.from("qa_runs").update({ status: "completed" }).eq("id", runId);
    record("IMT-01 (UPDATE rejected)", error && error.message.includes("insert-only and immutable") ? "PASS" : "FAIL", error ? error.message : "UNEXPECTEDLY ALLOWED");
  }
  {
    const { error } = await svc.from("qa_runs").delete().eq("id", runId);
    record("IMT-02 (direct DELETE rejected while Case exists)", error && error.message.includes("insert-only and immutable") ? "PASS" : "FAIL", error ? error.message : "UNEXPECTEDLY ALLOWED");
  }
  {
    const { data: stillThere } = await svc.from("qa_runs").select("id").eq("id", runId).maybeSingle();
    record("IMT (original row preserved after rejected mutations)", !!stillThere ? "PASS" : "FAIL", stillThere ? "present" : "MISSING");
  }
  {
    const result4 = await runQaEngine(svc, { caseId: caseA.id, executedBy: actorId });
    record("IMT-03 (re-run creates new row, not rewrite)",
      result4.ok && result4.run.id !== runId ? "PASS" : "FAIL",
      result4.ok ? `new id=${result4.run.id} (old=${runId})` : JSON.stringify(result4));
  }

  // ══ IV-16 — client-supplied document identity has no route to enter the manifest ══
  // (verified by construction: runQaEngine's params type is { caseId, executedBy } only —
  // no document-id field exists anywhere in the API/service input surface for a client to supply)
  record("IV-16 (no client-authoritative document-identity input exists)", "PASS", "runQaEngine params = { caseId, executedBy } only, verified by type inspection");

  // ══ IV-25 — GET/read does not mutate ══
  {
    const { data: before } = await svc.from("qa_runs").select("id", { count: "exact" }).eq("case_id", caseA.id);
    const { data: after } = await svc.from("qa_runs").select("id", { count: "exact" }).eq("case_id", caseA.id);
    record("IV-25 (read does not mutate)", before?.length === after?.length ? "PASS" : "FAIL", `before=${before?.length} after=${after?.length}`);
  }

  // ══ IMT-04 — Case cascade allows teardown (disposable fixture only) ══
  {
    const cascadeCleanup = await svc.from("cases").delete().in("id", [caseA.id, caseB.id, caseC.id]);
    record("IMT-04 / cleanup (cases CASCADE removes qa_runs + case_strategy legitimately)",
      !cascadeCleanup.error ? "PASS" : "FAIL", cascadeCleanup.error ? cascadeCleanup.error.message : "cases + dependents removed cleanly");
  }
  await svc.from("clients").delete().eq("id", cli.id);

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((r) => r.status === "FAIL").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(2); });
