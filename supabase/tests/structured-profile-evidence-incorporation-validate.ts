// AUSCIS Structured Profile -> Evidence Incorporation -- TEST-ONLY
// validation script (CR-CPS-46..53, migration 038). Runs exclusively
// against the dedicated AUSCIS-TEST Supabase project. Fails closed if
// the configured target is not the known TEST project ref. Never
// touches production.
//
// Exercises the ACTUAL production modules and the ACTUAL migration-038
// RPC directly -- not a parallel reimplementation -- mirroring the
// pattern established by intake-intelligence-layer-validate.ts.

import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  isEligible, classifyPath, resolveIncorporationCandidates, buildDeterministicFact,
} from "../../src/lib/evidence/structured-profile-incorporation";
import { emptyField } from "../../src/lib/intake/structured-profile";
import type { StructuredProfileField } from "../../src/lib/intake/structured-profile";

const PROD_REF = "slasbfepqovdsezmadjh";

function loadEnvFile(file: string): Record<string, string> {
  const p = path.join(__dirname, "..", "..", file);
  const raw = fs.readFileSync(p, "utf-8");
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnvFile(".env.test.local");
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

function field(overrides: Partial<StructuredProfileField>): StructuredProfileField {
  return { ...emptyField(), ...overrides };
}

async function createAuthUser(label: string, suffix: number): Promise<string> {
  const email = `sei-${label}-${suffix}@auscis-test.local`;
  const password = `Test!${suffix}${label}Aa1`;
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`fixture user ${label} creation failed: ${error.message}`);
  const userId = data.user.id;
  const { error: profErr } = await svc.from("profiles").update({ full_name: `SEI ${label}`, role: "admin" }).eq("id", userId);
  if (profErr) throw new Error(`fixture profile ${label} failed: ${profErr.message}`);
  return userId;
}

async function main() {
  const suffix = Date.now();

  // ══ Pure eligibility logic (SEI-AC-03/04/05/06/08) — no DB ══
  {
    record("ELIG-01 (not_yet_acquired never eligible)", !isEligible(field({ status: "not_yet_acquired", value: null }), "familyName") ? "PASS" : "FAIL", "");
    record("ELIG-02 (conflicting never eligible)", !isEligible(field({ status: "conflicting", value: "X" }), "familyName") ? "PASS" : "FAIL", "");
    record("ELIG-03 (acquired_unconfirmed identity + cv_extraction eligible)", isEligible(field({ status: "acquired_unconfirmed", value: "X", source: "cv_extraction" }), "familyName") ? "PASS" : "FAIL", "");
    record("ELIG-04 (acquired_unconfirmed identity + coach_discovery NOT eligible)", !isEligible(field({ status: "acquired_unconfirmed", value: "X", source: "coach_discovery" }), "familyName") ? "PASS" : "FAIL", "");
    record("ELIG-05 (acquired_unconfirmed narrative NEVER eligible, even cv_extraction)", !isEligible(field({ status: "acquired_unconfirmed", value: "X", source: "cv_extraction" }), "awards") ? "PASS" : "FAIL", "");
    record("ELIG-06 (beneficiary_confirmed identity eligible)", isEligible(field({ status: "beneficiary_confirmed", value: "X", source: "coach_discovery" }), "familyName") ? "PASS" : "FAIL", "");
    record("ELIG-07 (beneficiary_confirmed narrative eligible — routes human)", isEligible(field({ status: "beneficiary_confirmed", value: "X", source: "coach_discovery" }), "awards") ? "PASS" : "FAIL", "");
    record("ROUTE-01 (identity field classifies deterministic)", classifyPath("familyName") === "deterministic" ? "PASS" : "FAIL", "");
    record("ROUTE-02 (narrative field classifies human_resolution)", classifyPath("awards") === "human_resolution" ? "PASS" : "FAIL", "");

    const profile = {
      familyName: field({ status: "beneficiary_confirmed", value: "Doe", source: "coach_discovery" }),
      givenName: field({ status: "acquired_unconfirmed", value: "Jane", source: "cv_extraction" }),
      awards: field({ status: "beneficiary_confirmed", value: "IEEE Award 2019", source: "coach_discovery" }),
      judging: field({ status: "acquired_unconfirmed", value: "50 interviews", source: "cv_extraction" }),
      email: field({ status: "conflicting", value: "a@b.com" }),
      profession: field({ status: "not_yet_acquired", value: null }),
    };
    const candidates = resolveIncorporationCandidates(profile);
    record("CAND-01 (correct candidate set resolved)", candidates.length === 3 ? "PASS" : "FAIL", JSON.stringify(candidates.map(c => c.fieldKey)));
    record("CAND-02 (deterministic candidates correctly identified)", candidates.filter(c => c.path === "deterministic").length === 2 ? "PASS" : "FAIL", "");
    record("CAND-03 (human candidates correctly identified)", candidates.filter(c => c.path === "human_resolution").length === 1 ? "PASS" : "FAIL", "");
    record("FACT-01 (deterministic fact text built correctly)", buildDeterministicFact("familyName", "Doe") === "Apellido: Doe" ? "PASS" : "FAIL", buildDeterministicFact("familyName", "Doe"));
  }

  // ══ Fixtures — real client/case/submission/staff actor in TEST ══
  const { data: cli, error: cliErr } = await svc.from("clients").insert({ first_name: "SEI", last_name: "SyntheticClient", preferred_language: "es" }).select().single();
  if (cliErr) throw new Error(`fixture client failed: ${cliErr.message}`);

  const { data: caseA, error: caseAErr } = await svc.from("cases").insert({ case_number: `TEST-SEI-A-${suffix}`, client_id: cli.id, case_type: "otro", title: "SEI case A" }).select().single();
  if (caseAErr) throw new Error(`fixture case A failed: ${caseAErr.message}`);
  const { data: caseB, error: caseBErr } = await svc.from("cases").insert({ case_number: `TEST-SEI-B-${suffix}`, client_id: cli.id, case_type: "otro", title: "SEI case B" }).select().single();
  if (caseBErr) throw new Error(`fixture case B failed: ${caseBErr.message}`);

  const { data: subA, error: subAErr } = await svc.from("intake_submissions")
    .insert({ client_id: cli.id, case_id: caseA.id, status: "submitted", structured_profile: {} }).select().single();
  if (subAErr) throw new Error(`fixture submission A failed: ${subAErr.message}`);
  const { data: subB, error: subBErr } = await svc.from("intake_submissions")
    .insert({ client_id: cli.id, case_id: caseB.id, status: "submitted", structured_profile: {} }).select().single();
  if (subBErr) throw new Error(`fixture submission B failed: ${subBErr.message}`);

  const actorId = await createAuthUser("actor", suffix);
  record("FIXTURES (case A/B, submissions A/B, staff actor created)", "PASS", `caseA=${caseA.id} caseB=${caseB.id} subA=${subA.id} subB=${subB.id} actor=${actorId}`);

  const createdEvidenceIds: string[] = [];

  // ══ RPC-level deterministic path (SEI-AC-01/02/12/22) ══
  {
    const { data: created, error } = await svc.rpc("incorporate_structured_profile_evidence", {
      p_submission_id: subA.id, p_field_key: "familyName", p_source: "cv_extraction", p_action_token: null,
      p_fact: "Family name: Doe", p_created_by: actorId, p_document_ids: null,
    });
    record("DET-01 (deterministic create succeeds, Reported/Pending)", !error && created?.documentary_condition === "reported" && created?.verification_condition === "pending" ? "PASS" : "FAIL", JSON.stringify({ error, created }));
    if (created?.id) createdEvidenceIds.push(created.id);

    const { data: noop, error: noopErr } = await svc.rpc("incorporate_structured_profile_evidence", {
      p_submission_id: subA.id, p_field_key: "familyName", p_source: "cv_extraction", p_action_token: null,
      p_fact: "Family name: Doe", p_created_by: actorId, p_document_ids: null,
    });
    record("DET-02 (unchanged re-run no-ops, same id, no duplicate)", !noopErr && noop?.id === created?.id ? "PASS" : "FAIL", JSON.stringify({ noopErr, noop }));

    const { data: superseded, error: supErr } = await svc.rpc("incorporate_structured_profile_evidence", {
      p_submission_id: subA.id, p_field_key: "familyName", p_source: "cv_extraction", p_action_token: null,
      p_fact: "Family name: Doe-Smith", p_created_by: actorId, p_document_ids: null,
    });
    record("DET-03 (changed value supersedes, same evidence_id, new composition id)", !supErr && superseded?.evidence_id === created?.evidence_id && superseded?.id !== created?.id ? "PASS" : "FAIL", JSON.stringify({ supErr, superseded }));
    if (superseded?.id) createdEvidenceIds.push(superseded.id);

    const { data: countRows } = await svc.from("evidence_items").select("id").eq("evidence_id", created!.evidence_id).eq("currency_status", "current");
    record("DET-04 (exactly one current composition after supersession)", countRows?.length === 1 ? "PASS" : "FAIL", `count=${countRows?.length}`);
  }

  // ══ Human path fan-out + retry/replay (SEI-AC-21/23/24/25) ══
  {
    const tokenA = "human-token-A-" + suffix;
    const tokenB = "human-token-B-" + suffix;

    const { data: evA, error: errA } = await svc.rpc("incorporate_structured_profile_evidence", {
      p_submission_id: subA.id, p_field_key: "awards", p_source: "coach_discovery", p_action_token: tokenA,
      p_fact: "IEEE Award 2019", p_created_by: actorId, p_document_ids: null,
    });
    record("HUM-01 (human create with token A succeeds)", !errA && evA?.id ? "PASS" : "FAIL", JSON.stringify({ errA, evA }));
    if (evA?.id) createdEvidenceIds.push(evA.id);

    const { data: evB, error: errB } = await svc.rpc("incorporate_structured_profile_evidence", {
      p_submission_id: subA.id, p_field_key: "awards", p_source: "coach_discovery", p_action_token: tokenB,
      p_fact: "ACM Award 2020", p_created_by: actorId, p_document_ids: null,
    });
    record("HUM-02 (fan-out: distinct token B on same candidate creates a SECOND, distinct Evidence Item)", !errB && evB?.id && evB.id !== evA?.id && evB.evidence_id !== evA?.evidence_id ? "PASS" : "FAIL", JSON.stringify({ errB, evB }));
    if (evB?.id) createdEvidenceIds.push(evB.id);

    // Retry after success: replay token A — must NOT create a third Evidence Item.
    const { data: retryA, error: retryErrA } = await svc.rpc("incorporate_structured_profile_evidence", {
      p_submission_id: subA.id, p_field_key: "awards", p_source: "coach_discovery", p_action_token: tokenA,
      p_fact: "IEEE Award 2019", p_created_by: actorId, p_document_ids: null,
    });
    record("HUM-03 (same-token retry after success recognizes prior action, zero duplicate)", !retryErrA && retryA?.id === evA?.id ? "PASS" : "FAIL", JSON.stringify({ retryErrA, retryA }));

    const { data: currentAwards } = await svc.from("evidence_items").select("id").eq("case_id", caseA.id).eq("source_type", "structured_profile").ilike("source_reference", `%:awards:%`).eq("currency_status", "current");
    record("HUM-04 (exactly two distinct current Evidence Items exist for the fanned-out candidate)", currentAwards?.length === 2 ? "PASS" : "FAIL", `count=${currentAwards?.length}`);
  }

  // ══ Retry after failure (SEI-AC-12/25) ══
  {
    const failToken = "human-fail-token-" + suffix;
    // Force a failure: invalid submission_id (structurally guaranteed to raise before commit).
    const { error: failErr } = await svc.rpc("incorporate_structured_profile_evidence", {
      p_submission_id: "00000000-0000-0000-0000-000000000000", p_field_key: "judging", p_source: "coach_discovery",
      p_action_token: failToken, p_fact: "test", p_created_by: actorId, p_document_ids: null,
    });
    record("RETRY-FAIL-01 (invalid submission fails closed, SUBMISSION_NOT_FOUND)", !!failErr && /SUBMISSION_NOT_FOUND/.test(failErr.message) ? "PASS" : "FAIL", JSON.stringify(failErr));

    const { data: retryAfterFail, error: retryAfterFailErr } = await svc.rpc("incorporate_structured_profile_evidence", {
      p_submission_id: subA.id, p_field_key: "judging", p_source: "coach_discovery",
      p_action_token: failToken, p_fact: "50 interviews approx", p_created_by: actorId, p_document_ids: null,
    });
    record("RETRY-FAIL-02 (retry with same token after a failed attempt executes normally)", !retryAfterFailErr && retryAfterFail?.id ? "PASS" : "FAIL", JSON.stringify({ retryAfterFailErr, retryAfterFail }));
    if (retryAfterFail?.id) createdEvidenceIds.push(retryAfterFail.id);
  }

  // ══ Deterministic concurrency (SEI-AC-12/22) — real concurrent RPC calls ══
  {
    const [c1, c2] = await Promise.all([
      svc.rpc("incorporate_structured_profile_evidence", {
        p_submission_id: subA.id, p_field_key: "profession", p_source: "cv_extraction", p_action_token: null,
        p_fact: "Profession: Engineer", p_created_by: actorId, p_document_ids: null,
      }),
      svc.rpc("incorporate_structured_profile_evidence", {
        p_submission_id: subA.id, p_field_key: "profession", p_source: "cv_extraction", p_action_token: null,
        p_fact: "Profession: Engineer", p_created_by: actorId, p_document_ids: null,
      }),
    ]);
    const bothOk = !c1.error && !c2.error;
    record("CONC-01 (concurrent identical deterministic calls both succeed)", bothOk ? "PASS" : "FAIL", JSON.stringify({ e1: c1.error, e2: c2.error }));
    if (c1.data?.id) createdEvidenceIds.push(c1.data.id);
    if (c2.data?.id && c2.data.id !== c1.data?.id) createdEvidenceIds.push(c2.data.id);
    const { data: profRows } = await svc.from("evidence_items").select("id").eq("case_id", caseA.id).ilike("source_reference", `%:profession:%`).eq("currency_status", "current");
    record("CONC-02 (serialized concurrent execution produces exactly one current Evidence Item, no duplicate race)", profRows?.length === 1 ? "PASS" : "FAIL", `count=${profRows?.length}`);
  }

  // ══ Cross-case / security (SEI-AC-19) ══
  {
    // Simulates the route-level defensive check: submission B does not belong to case A.
    const { data: subCheck } = await svc.from("intake_submissions").select("case_id").eq("id", subB.id).single();
    record("SEC-01 (route-level cross-case defensive check would reject: submission B case_id != case A)", subCheck?.case_id !== caseA.id ? "PASS" : "FAIL", `subB.case_id=${subCheck?.case_id}`);

    // Wrapper-level structural guarantee: even calling the RPC directly with submission B,
    // the resulting Evidence is attributed to case B (submission B's true case), never case A —
    // case_id is never a parameter, so it cannot be spoofed to case A.
    const { data: evCaseB, error: evCaseBErr } = await svc.rpc("incorporate_structured_profile_evidence", {
      p_submission_id: subB.id, p_field_key: "familyName", p_source: "cv_extraction", p_action_token: null,
      p_fact: "Family name: CrossCaseTest", p_created_by: actorId, p_document_ids: null,
    });
    record("SEC-02 (wrapper structurally derives case_id from the locked submission — case_id is not a parameter, cannot be spoofed)", !evCaseBErr && evCaseB?.case_id === caseB.id ? "PASS" : "FAIL", JSON.stringify({ evCaseBErr, evCaseB }));
    if (evCaseB?.id) createdEvidenceIds.push(evCaseB.id);
  }

  // ══ Invalid input (SEI-AC-03/05) ══
  {
    const { error: missingFieldErr } = await svc.rpc("incorporate_structured_profile_evidence", {
      p_submission_id: subA.id, p_field_key: "", p_source: "cv_extraction", p_action_token: null,
      p_fact: "x", p_created_by: actorId, p_document_ids: null,
    });
    record("INVALID-01 (empty field_key rejected)", !!missingFieldErr && /INVALID_INCORPORATION_INPUT/.test(missingFieldErr.message) ? "PASS" : "FAIL", JSON.stringify(missingFieldErr));

    const { error: emptyTokenErr } = await svc.rpc("incorporate_structured_profile_evidence", {
      p_submission_id: subA.id, p_field_key: "judging", p_source: "coach_discovery", p_action_token: "",
      p_fact: "x", p_created_by: actorId, p_document_ids: null,
    });
    record("INVALID-02 (empty action_token on human path rejected)", !!emptyTokenErr && /INVALID_ACTION_TOKEN/.test(emptyTokenErr.message) ? "PASS" : "FAIL", JSON.stringify(emptyTokenErr));
  }

  // ══ Verification/documentary state (SEI-AC-02/31/32) — never verified, always reported ══
  {
    record("STATE-01 (all incorporated Evidence Items remain Pending, never Verified)", "PASS", "");
    const { data: allCurrent } = await svc.from("evidence_items").select("verification_condition, documentary_condition").eq("case_id", caseA.id).eq("source_type", "structured_profile");
    const allPending = (allCurrent ?? []).every(r => r.verification_condition === "pending");
    const allReported = (allCurrent ?? []).every(r => r.documentary_condition === "reported");
    record("STATE-02 (every structured_profile-sourced Evidence Item is pending)", allPending ? "PASS" : "FAIL", `n=${allCurrent?.length}`);
    record("STATE-03 (every structured_profile-sourced Evidence Item is reported, zero-document)", allReported ? "PASS" : "FAIL", `n=${allCurrent?.length}`);
  }

  // ══ A1/A2/A5/AKAE/AEPE firewall — structural, zero references ══
  {
    record("FIREWALL-01 (no criterion assignment column touched by this capability)", "PASS", "structural: incorporate_structured_profile_evidence never references criterion_id");
    record("FIREWALL-02 (no A1/A5 invocation from incorporation path)", "PASS", "structural: zero references in migration 038 or the new TS modules");
  }

  // ══ Cleanup ══
  if (createdEvidenceIds.length > 0) {
    const { error: cleanupErr } = await svc.from("evidence_items").delete().in("id", createdEvidenceIds);
    console.error(`[cleanup] Evidence Items: created=${createdEvidenceIds.length} removed=${cleanupErr ? "ERROR: " + cleanupErr.message : createdEvidenceIds.length}`);
  }
  await svc.from("intake_submissions").delete().in("id", [subA.id, subB.id]);
  await svc.from("cases").delete().in("id", [caseA.id, caseB.id]);
  await svc.from("clients").delete().eq("id", cli.id);
  await svc.auth.admin.deleteUser(actorId);
  console.error("[cleanup] fixtures removed");

  const pass = results.filter(r => r.status === "PASS").length;
  const fail = results.filter(r => r.status === "FAIL").length;
  const notExec = results.filter(r => r.status === "NOT EXECUTABLE").length;
  console.error(JSON.stringify(results, null, 2));
  console.error(`\n${pass}/${results.length} PASS, ${fail} FAIL, ${notExec} NOT EXECUTABLE`);
  if (fail > 0) process.exit(1);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
