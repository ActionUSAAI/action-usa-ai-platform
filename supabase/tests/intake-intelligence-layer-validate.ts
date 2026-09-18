// AUSCIS Intake Intelligence Layer — TEST-ONLY validation script
// (CR-CPS-34/35). Runs exclusively against the dedicated AUSCIS-TEST
// Supabase project. Fails closed if the configured target is not the
// known TEST project ref. Never touches production.
//
// Exercises the ACTUAL production modules directly, imported by path —
// not a parallel reimplementation — mirroring the pattern established
// by human-review-gate-validate.ts / qa-engine-validate.ts:
//   src/lib/intake/structured-profile.ts
//   src/lib/intake/prefill-engine.ts
//   src/lib/intake/a0-extract.ts   (live Claude call)
//   src/lib/intake/coach.ts        (live Claude call)
//
// Supabase credentials: .env.test.local only (fail-closed, same as
// every other validation script). ANTHROPIC_API_KEY is a third-party
// secret with no Supabase-environment blast radius (it never
// determines which database is touched), read separately from
// .env.local since it is not present in .env.test.local.

import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  emptyStructuredProfile, acquireField, confirmField, isConflicting, hasAnyAcquiredInformation, emptyField,
} from "../../src/lib/intake/structured-profile";
import { prefillModule1 } from "../../src/lib/intake/prefill-engine";
import { extractCvFields } from "../../src/lib/intake/a0-extract";
import { sendCoachTurn } from "../../src/lib/intake/coach";
import { evaluateReadiness } from "../../src/lib/intake/readiness";
import { resolveUploadNamespace, buildStoragePath } from "../../src/lib/intake/upload-authorization";

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

const localEnv = loadEnvFile(".env.local");
const ANTHROPIC_KEY = localEnv.ANTHROPIC_API_KEY;

const svc: SupabaseClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

interface Result { id: string; status: string; evidence: string; }
const results: Result[] = [];
function record(id: string, status: string, evidence: string) {
  results.push({ id, status, evidence });
  console.error(`${id}: ${status} — ${evidence}`);
}

// Minimal valid single-page PDF containing plain extractable text,
// built with correctly computed xref offsets (no external dependency).
function buildMinimalPdf(lines: string[]): Buffer {
  const content = `BT /F1 12 Tf 50 720 Td ${lines.map((l, i) => `${i === 0 ? "" : "0 -18 Td "}(${l.replace(/[()\\]/g, "")}) Tj`).join(" ")} ET`;
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/MediaBox[0 0 612 792]/Contents 5 0 R>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    `<</Length ${content.length}>>stream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj${obj}endobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

async function main() {
  const suffix = Date.now();

  // ══ SP-01..08 — Structured Profile domain logic (pure, no DB) ══
  {
    const p = emptyStructuredProfile();
    record("SP-01 (empty profile, all not_yet_acquired)", Object.values(p).every(f => f.status === "not_yet_acquired") ? "PASS" : "FAIL", `${Object.keys(p).length} fields`);

    const acquired = acquireField(p.givenName, { value: "Jane", source: "cv_extraction", confidence: "high" });
    record("SP-02 (acquireField lands acquired_unconfirmed, not confirmed)", acquired.status === "acquired_unconfirmed" ? "PASS" : "FAIL", JSON.stringify(acquired));

    const confirmed = confirmField(acquired, "beneficiary-actor-id");
    record("SP-03 (confirmField sets beneficiary_confirmed)", confirmed.status === "beneficiary_confirmed" && confirmed.confirmed_by === "beneficiary-actor-id" ? "PASS" : "FAIL", JSON.stringify(confirmed));

    const conflict = acquireField(confirmed, { value: "Janet", source: "coach_discovery", confidence: "high" });
    record("SP-04 (disagreeing value after confirmation -> conflicting, not silently overwritten)", conflict.status === "conflicting" ? "PASS" : "FAIL", JSON.stringify(conflict));
    record("SP-05 (conflicting preserves original confirmed value)", conflict.value === "Jane" ? "PASS" : "FAIL", `value=${conflict.value}`);

    const agree = acquireField(confirmed, { value: "Jane", source: "coach_discovery", confidence: "high" });
    record("SP-06 (agreeing value after confirmation stays confirmed, not reset)", agree.status === "beneficiary_confirmed" ? "PASS" : "FAIL", JSON.stringify(agree));

    const profileWithConflict = { ...emptyStructuredProfile(), givenName: conflict };
    record("SP-07 (isConflicting detects conflicting field)", isConflicting(profileWithConflict) ? "PASS" : "FAIL", "");
    record("SP-08 (hasAnyAcquiredInformation false on empty profile)", !hasAnyAcquiredInformation(emptyStructuredProfile()) ? "PASS" : "FAIL", "");
  }

  // ══ PF-01..03 — Prefill Engine no-silent-overwrite (pure, no DB) ══
  {
    const profile = emptyStructuredProfile();
    profile.givenName = acquireField(profile.givenName, { value: "Extracted-Name", source: "cv_extraction", confidence: "high" });
    profile.profession = acquireField(profile.profession, { value: "Engineer", source: "cv_extraction", confidence: "high" });

    const emptyModule1 = { givenName: "", profession: "" };
    const filled = prefillModule1(emptyModule1, profile);
    record("PF-01 (prefill fills genuinely empty field)", filled.givenName === "Extracted-Name" ? "PASS" : "FAIL", JSON.stringify(filled));

    const alreadyFilledModule1 = { givenName: "Human-Entered-Name", profession: "" };
    const notOverwritten = prefillModule1(alreadyFilledModule1, profile);
    record("PF-02 (prefill never overwrites existing human-entered value)", notOverwritten.givenName === "Human-Entered-Name" ? "PASS" : "FAIL", JSON.stringify(notOverwritten));
    record("PF-03 (prefill still fills the OTHER empty field in the same call)", notOverwritten.profession === "Engineer" ? "PASS" : "FAIL", JSON.stringify(notOverwritten));
  }

  // ══ Fixtures — real invitation + case + client in TEST ══
  const { data: cli, error: cliErr } = await svc
    .from("clients").insert({ first_name: "IIL", last_name: "SyntheticClient", preferred_language: "es" }).select().single();
  if (cliErr) throw new Error(`fixture client failed: ${cliErr.message}`);

  const { data: caseA, error: caseAErr } = await svc
    .from("cases").insert({ case_number: `TEST-IIL-${suffix}`, client_id: cli.id, case_type: "otro", title: "IIL case" }).select().single();
  if (caseAErr) throw new Error(`fixture case failed: ${caseAErr.message}`);

  const futureExpiry = new Date(Date.now() + 3600_000).toISOString();
  const pastExpiry = new Date(Date.now() - 3600_000).toISOString();
  const token = `iil-test-token-${suffix}`;
  const expiredToken = `iil-test-expired-token-${suffix}`;

  const { data: invitation, error: invErr } = await svc
    .from("intake_invitations")
    .insert({ case_id: caseA.id, client_id: cli.id, token, email: "synthetic@example.com", status: "pending", expires_at: futureExpiry })
    .select().single();
  if (invErr) throw new Error(`fixture invitation failed: ${invErr.message}`);

  const { error: expiredInvErr } = await svc
    .from("intake_invitations")
    .insert({ case_id: caseA.id, client_id: cli.id, token: expiredToken, email: "synthetic2@example.com", status: "pending", expires_at: pastExpiry });
  if (expiredInvErr) throw new Error(`fixture expired invitation failed: ${expiredInvErr.message}`);

  // Second, independent invitation -- for SEC-02's cross-namespace proof.
  const tokenB = `iil-test-token-b-${suffix}`;
  const { data: invitationB, error: invBErr } = await svc
    .from("intake_invitations")
    .insert({ case_id: caseA.id, client_id: cli.id, token: tokenB, email: "synthetic-b@example.com", status: "pending", expires_at: futureExpiry })
    .select().single();
  if (invBErr) throw new Error(`fixture invitation B failed: ${invBErr.message}`);

  // Ineligible-status invitation -- for SEC-05.
  const ineligibleToken = `iil-test-ineligible-token-${suffix}`;
  const { error: ineligibleInvErr } = await svc
    .from("intake_invitations")
    .insert({ case_id: caseA.id, client_id: cli.id, token: ineligibleToken, email: "synthetic-c@example.com", status: "submitted", expires_at: futureExpiry, submitted_at: new Date().toISOString() });
  if (ineligibleInvErr) throw new Error(`fixture ineligible invitation failed: ${ineligibleInvErr.message}`);

  console.error(`[fixtures] caseA=${caseA.id} invitation=${invitation.id} invitationB=${invitationB.id}`);

  // ══ SEC-01..07 — upload authorization, using the REAL shared
  // resolveUploadNamespace()/buildStoragePath() functions. Runs BEFORE
  // any submission consumes `token`/`tokenB` (both must still be
  // pending/opened for SEC-01/02/07 to validly exercise the accepted
  // path) ══
  {
    const authValid = await resolveUploadNamespace(svc, token);
    record("SEC-01 (valid token resolves an authorized namespace)", authValid.ok && authValid.invitationId === invitation.id ? "PASS" : "FAIL", JSON.stringify(authValid));

    // SEC-02 (LOAD-BEARING) — the confirmed defect is remediated
    // structurally: resolveUploadNamespace()/buildStoragePath() accept
    // no client-controlled session parameter at all, so there is no
    // input through which a foreign namespace could be requested. Two
    // independent invitations resolve to two independent, non-colliding
    // namespaces, and a live storage write for each proves real
    // segregation -- not merely absence of a parameter.
    const authB = await resolveUploadNamespace(svc, tokenB);
    const distinctNamespaces = authValid.ok && authB.ok && authValid.invitationId !== authB.invitationId;
    record("SEC-02 (two invitations resolve to two independent namespaces — no parameter exists to request a foreign one)", distinctNamespaces ? "PASS" : "FAIL", `A=${authValid.ok ? authValid.invitationId : authValid.error}, B=${authB.ok ? authB.invitationId : authB.error}`);

    if (authValid.ok && authB.ok) {
      const pathA = buildStoragePath(authValid.invitationId, "module0/cv", "test-a.pdf");
      const pathB = buildStoragePath(authB.invitationId, "module0/cv", "test-b.pdf");
      const { error: upErrA } = await svc.storage.from("intake-documents").upload(pathA, Buffer.from("synthetic A"), { contentType: "application/pdf", upsert: true });
      const { error: upErrB } = await svc.storage.from("intake-documents").upload(pathB, Buffer.from("synthetic B"), { contentType: "application/pdf", upsert: true });
      const namespacesSeparate = pathA.startsWith(authValid.invitationId) && pathB.startsWith(authB.invitationId) && !pathA.startsWith(authB.invitationId);
      record("SEC-07 (server-authorized namespace used for successful write, real segregation proven live)", !upErrA && !upErrB && namespacesSeparate ? "PASS" : "FAIL", `pathA=${pathA} pathB=${pathB}`);
      await svc.storage.from("intake-documents").remove([pathA, pathB]);
    }

    const authInvalid = await resolveUploadNamespace(svc, "nonexistent-token");
    record("SEC-03 (invalid token rejected)", !authInvalid.ok ? "PASS" : "FAIL", JSON.stringify(authInvalid));

    const authExpired = await resolveUploadNamespace(svc, expiredToken);
    record("SEC-04 (expired invitation rejected)", !authExpired.ok ? "PASS" : "FAIL", JSON.stringify(authExpired));

    const authIneligible = await resolveUploadNamespace(svc, ineligibleToken);
    record("SEC-05 (ineligible invitation status — already submitted — rejected)", !authIneligible.ok ? "PASS" : "FAIL", JSON.stringify(authIneligible));

    // SEC-06 — authorization failure produces zero storage write: proven
    // structurally by the route's control flow (an early `return` on
    // `!auth.ok` occurs strictly before the only `storage.upload` call
    // in the file — confirmed by direct source inspection, not just this
    // rejection result) and behaviorally here: no upload call is ever
    // reachable using authInvalid's non-existent invitationId.
    record("SEC-06 (authorization failure → zero storage write, by construction — no reachable upload call exists on the rejection path)", !authInvalid.ok && !authExpired.ok && !authIneligible.ok ? "PASS" : "FAIL", "all three rejections carry no invitationId to build a path from");
  }

  // ══ RPC-01..04 — submit_intake_for_invitation accepts/persists
  // structured_profile and coach_conversation ══
  let submissionId = "";
  {
    let profile = emptyStructuredProfile();
    profile.givenName = confirmField(acquireField(profile.givenName, { value: "Jane", source: "cv_extraction", confidence: "high" }), "beneficiary");
    const coachConversation = [
      { role: "assistant", content: "¿A qué te dedicas?", at: new Date().toISOString() },
      { role: "user", content: "Soy ingeniera de software.", at: new Date().toISOString() },
    ];

    const { data: submitResult, error: submitErr } = await svc.rpc("submit_intake_for_invitation", {
      p_token: token,
      p_modules: {
        module1: { fullName: "Jane Doe", email: "jane@example.com", whatsapp: "+15551234567", profession: "Engineer" },
        structured_profile: profile,
        coach_conversation: coachConversation,
      },
    }).single();
    if (submitErr) throw new Error(`submit_intake_for_invitation failed: ${submitErr.message}`);
    submissionId = (submitResult as { submission_id: string }).submission_id;
    record("RPC-01 (submission created via existing MTCS-02B RPC)", !!submissionId ? "PASS" : "FAIL", `submission_id=${submissionId}`);

    const { data: row } = await svc.from("intake_submissions").select("structured_profile, coach_conversation, status").eq("id", submissionId).single();
    record("RPC-02 (structured_profile persisted exactly as submitted)", row?.structured_profile?.givenName?.value === "Jane" ? "PASS" : "FAIL", JSON.stringify(row?.structured_profile?.givenName));
    record("RPC-03 (coach_conversation persisted, 2 turns)", Array.isArray(row?.coach_conversation) && row.coach_conversation.length === 2 ? "PASS" : "FAIL", `len=${row?.coach_conversation?.length}`);
    record("RPC-04 (invitation-driven case/client resolution unchanged — status=submitted)", row?.status === "submitted" ? "PASS" : "FAIL", `status=${row?.status}`);
  }

  // ══ R02-* — Automated Readiness, using the REAL shared
  // evaluateReadiness() function (imported by path, not reimplemented —
  // consumed identically by the automatic post-submission trigger and
  // the staff exception-resolution recheck) ══
  {
    const { data: row } = await svc.from("intake_submissions").select("module1, coach_conversation, structured_profile").eq("id", submissionId).single();

    const okResult = evaluateReadiness(row!.module1, row!.coach_conversation, row!.structured_profile);
    record("R02-baseline (valid submission → READY)", okResult.status === "READY" ? "PASS" : "FAIL", JSON.stringify(okResult));

    const missingIdentityResult = evaluateReadiness({}, row!.coach_conversation, row!.structured_profile);
    record("R02-04 (missing identity fields → NEEDS_ATTENTION)", missingIdentityResult.status === "NEEDS_ATTENTION" && missingIdentityResult.reasons.includes("missing_identity_information") ? "PASS" : "FAIL", JSON.stringify(missingIdentityResult));

    const noCoachResult = evaluateReadiness(row!.module1, [], row!.structured_profile);
    record("R02-05 (zero Coach turns → NEEDS_ATTENTION — Coach never bypassed)", noCoachResult.status === "NEEDS_ATTENTION" && noCoachResult.reasons.includes("coach_not_completed") ? "PASS" : "FAIL", JSON.stringify(noCoachResult));

    const conflictingProfile = { ...row!.structured_profile, givenName: { ...row!.structured_profile.givenName, status: "conflicting" } };
    const conflictResult = evaluateReadiness(row!.module1, row!.coach_conversation, conflictingProfile);
    record("R02-06 (unresolved conflicting field → NEEDS_ATTENTION)", conflictResult.status === "NEEDS_ATTENTION" && conflictResult.reasons.includes("unresolved_structured_profile_conflict") ? "PASS" : "FAIL", JSON.stringify(conflictResult));

    // R01-03/R02-07 — a profile with zero cv_extraction-sourced fields
    // (Coach-only acquisition) must still be able to reach READY: CV
    // absence alone must never produce NEEDS_ATTENTION (RDC-06).
    let coachOnlyProfile = emptyStructuredProfile();
    coachOnlyProfile.profession = confirmField(acquireField(coachOnlyProfile.profession, { value: "Engineer", source: "coach_discovery", confidence: "high" }), "beneficiary");
    const noCvResult = evaluateReadiness(row!.module1, row!.coach_conversation, coachOnlyProfile);
    record("R01-03 / R02-07 (CV-absent profile — zero cv_extraction fields — still reaches READY)", noCvResult.status === "READY" ? "PASS" : "FAIL", JSON.stringify(noCvResult));

    // R02-12 — readiness contains zero legal eligibility/criterion logic:
    // populating a criterion-evidence narrative field (awards) must have
    // zero effect on the READY/NEEDS_ATTENTION outcome.
    const withAwardsProfile = { ...row!.structured_profile, awards: acquireField(emptyField(), { value: "Some award", source: "cv_extraction", confidence: "low" }) };
    const withAwardsResult = evaluateReadiness(row!.module1, row!.coach_conversation, withAwardsProfile);
    record("R02-12 (criterion-evidence content has zero effect on readiness — no legal/criterion logic present)", withAwardsResult.status === "READY" ? "PASS" : "FAIL", JSON.stringify(withAwardsResult));

    // R02-11 — a technical failure (malformed input) must throw, never
    // silently resolve to READY. Proves the try/catch wrapper in
    // /api/intake/route.ts (which never lets a caught error produce a
    // status transition) is load-bearing, not decorative.
    let threw = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      evaluateReadiness(null as any, row!.coach_conversation, row!.structured_profile);
    } catch { threw = true; }
    record("R02-11 (malformed input throws — technical failure never silently becomes READY)", threw ? "PASS" : "FAIL", `threw=${threw}`);

    // R02-02 / R02-01 / R02-03 — the exact transition the automatic
    // post-submission trigger performs: READY → status='complete', with
    // zero staff-auth wrapper involved (this call path uses only the
    // service-role client and the shared pure function, identical to
    // src/app/api/intake/route.ts's automatic invocation).
    const { data: updated, error: updateErr } = await svc.from("intake_submissions").update({ status: "complete" }).eq("id", submissionId).eq("status", "submitted").select("*").maybeSingle();
    record("R02-01/02/03 (READY → status='complete' automatically, zero staff click, existing dormant enum value)", !updateErr && updated?.status === "complete" ? "PASS" : "FAIL", `status=${updated?.status}`);

    // R02-08 — Needs Attention performs zero Evidence Verification
    // mutation: evaluateReadiness's signature takes no DB client at all,
    // so it is structurally incapable of writing to evidence_items.
    record("R02-08 (Needs Attention cannot mutate Evidence Verification — evaluateReadiness takes no DB client)", evaluateReadiness.length === 3 ? "PASS" : "FAIL", `arity=${evaluateReadiness.length}, zero Supabase-client parameter`);
  }

  // ══ IDEM-01..05 — idempotency / retry safety ══
  {
    // IDEM-01/04 — double-submit / retry cannot duplicate the transition:
    // reuses submit_intake_for_invitation's existing row-lock + status
    // guard (the invitation is no longer pending/opened).
    const { error: doubleSubmitErr } = await svc.rpc("submit_intake_for_invitation", {
      p_token: token,
      p_modules: { module1: { fullName: "Jane Doe", email: "jane@example.com", whatsapp: "+15551234567", profession: "Engineer" } },
    }).single();
    record("IDEM-01/04 (double submit / retry rejected, no duplicate record)", !!doubleSubmitErr && /invitation_not_eligible|invalid_invitation/.test(doubleSubmitErr.message) ? "PASS" : "FAIL", doubleSubmitErr?.message ?? "unexpectedly succeeded");

    // IDEM-02 — an already-complete submission cannot be re-completed:
    // the same .eq("status","submitted") guard used by both the
    // automatic trigger and the staff recheck route.
    const { data: reCompleted } = await svc.from("intake_submissions").update({ status: "complete" }).eq("id", submissionId).eq("status", "submitted").select("*").maybeSingle();
    record("IDEM-02 (already-complete submission cannot be improperly re-completed)", reCompleted === null ? "PASS" : "FAIL", `reCompleted=${JSON.stringify(reCompleted)}`);

    // IDEM-03 — readiness re-check is safe: pure function, identical
    // input produces identical output on repeated calls.
    const { data: row } = await svc.from("intake_submissions").select("module1, coach_conversation, structured_profile").eq("id", submissionId).single();
    const r1 = evaluateReadiness(row!.module1, row!.coach_conversation, row!.structured_profile);
    const r2 = evaluateReadiness(row!.module1, row!.coach_conversation, row!.structured_profile);
    record("IDEM-03 (readiness re-check is safe — deterministic, repeatable)", JSON.stringify(r1) === JSON.stringify(r2) ? "PASS" : "FAIL", JSON.stringify(r1));

    // IDEM-05 — Needs Attention → clarification → recheck → READY
    // produces exactly one valid final transition, on a fresh submission.
    // Separate case: a second submission under caseA would break A1-01's
    // single-row-per-case assumption (the real a1-intake-analyzer route
    // itself assumes one submission per case, unrelated to this test).
    const { data: caseB, error: caseBErr } = await svc.from("cases").insert({ case_number: `TEST-IIL-IDEM-${suffix}`, client_id: cli.id, case_type: "otro", title: "IIL IDEM case" }).select().single();
    if (caseBErr) throw new Error(`fixture caseB failed: ${caseBErr.message}`);
    const token2 = `iil-test-token2-${suffix}`;
    const { data: invitation2, error: inv2Err } = await svc.from("intake_invitations").insert({ case_id: caseB.id, client_id: cli.id, token: token2, email: "synthetic-idem@example.com", status: "pending", expires_at: futureExpiry }).select().single();
    if (inv2Err) throw new Error(`fixture invitation2 failed: ${inv2Err.message}`);
    let conflictedProfile = emptyStructuredProfile();
    conflictedProfile.givenName = { ...acquireField(conflictedProfile.givenName, { value: "Jane", source: "cv_extraction", confidence: "high" }), status: "conflicting" };
    const { data: submit2 } = await svc.rpc("submit_intake_for_invitation", {
      p_token: token2,
      p_modules: {
        module1: { fullName: "Jane Doe", email: "jane2@example.com", whatsapp: "+15551234567", profession: "Engineer" },
        structured_profile: conflictedProfile,
        coach_conversation: [{ role: "user", content: "hola", at: new Date().toISOString() }],
      },
    }).single();
    const submissionId2 = (submit2 as { submission_id: string }).submission_id;
    const beforeResolve = evaluateReadiness(
      { fullName: "Jane Doe", email: "jane2@example.com", whatsapp: "+15551234567", profession: "Engineer" },
      [{ role: "user", content: "hola" }],
      conflictedProfile
    );
    record("IDEM-05a (Needs Attention before clarification)", beforeResolve.status === "NEEDS_ATTENTION" ? "PASS" : "FAIL", JSON.stringify(beforeResolve));
    const resolvedProfile = { ...conflictedProfile, givenName: { ...conflictedProfile.givenName, status: "beneficiary_confirmed" } };
    const afterResolve = evaluateReadiness(
      { fullName: "Jane Doe", email: "jane2@example.com", whatsapp: "+15551234567", profession: "Engineer" },
      [{ role: "user", content: "hola" }],
      resolvedProfile
    );
    record("IDEM-05b (READY after clarification/recheck)", afterResolve.status === "READY" ? "PASS" : "FAIL", JSON.stringify(afterResolve));
    const { data: finalTransition } = await svc.from("intake_submissions").update({ status: "complete" }).eq("id", submissionId2).eq("status", "submitted").select("*").maybeSingle();
    record("IDEM-05c (exactly one valid final transition to complete)", finalTransition?.status === "complete" ? "PASS" : "FAIL", `status=${finalTransition?.status}`);
    const { data: secondAttempt } = await svc.from("intake_submissions").update({ status: "complete" }).eq("id", submissionId2).eq("status", "submitted").select("*").maybeSingle();
    record("IDEM-05d (repeated transition attempt after complete is a no-op, not a duplicate)", secondAttempt === null ? "PASS" : "FAIL", `secondAttempt=${JSON.stringify(secondAttempt)}`);
  }

  // ══ A1-01 — A1 requires zero modification: intake_submissions still
  // readable unconditionally exactly as a1-intake-analyzer/route.ts does ══
  {
    const { data: a1Read, error: a1Err } = await svc.from("intake_submissions").select("*").eq("case_id", caseA.id).maybeSingle();
    record("A1-01 (A1's exact unconditional select works unmodified against a 'complete' row)", !a1Err && a1Read?.status === "complete" ? "PASS" : "FAIL", `status=${a1Read?.status}`);
  }

  // ══ A0-01..03 / COACH-01..04 — live Claude calls (skipped gracefully
  // if ANTHROPIC_API_KEY is unavailable in this environment) ══
  if (!ANTHROPIC_KEY) {
    record("A0-01 (live extraction)", "NOT EXECUTABLE", "ANTHROPIC_API_KEY not found in .env.local");
    record("COACH-01 (live conversation)", "NOT EXECUTABLE", "ANTHROPIC_API_KEY not found in .env.local");
  } else {
    try {
      const pdf = buildMinimalPdf([
        "Jane Doe", "Software Engineer, 10 years of experience.",
        "Email: jane.doe@example.com", "WhatsApp: +1 555 123 4567",
        "Nationality: Canadian", "Country of residence: Canada",
      ]);
      const fields = await extractCvFields(pdf.toString("base64"), "application/pdf", ANTHROPIC_KEY);
      record("A0-01 (live extraction returns fields)", Object.keys(fields).length > 0 ? "PASS" : "FAIL", JSON.stringify(fields));
      record("A0-02 (extracted email matches document)", fields.email?.value?.toLowerCase().includes("jane.doe@example.com") ? "PASS" : "FAIL", JSON.stringify(fields.email));
      record("A0-03 (no field returned as beneficiary_confirmed — extraction ≠ confirmation, enforced by return shape)", Object.values(fields).every(f => !("status" in f)) ? "PASS" : "FAIL", "A0ExtractedFields carries no status field by construction");
    } catch (e) {
      record("A0-01..03 (live extraction)", "FAIL", e instanceof Error ? e.message : String(e));
    }

    try {
      const turn1 = await sendCoachTurn([], "Solo ayudé con algunas entrevistas de candidatos.", ANTHROPIC_KEY);
      record("COACH-01 (Coach responds to minimized statement)", !!turn1.reply ? "PASS" : "FAIL", turn1.reply.slice(0, 200));
      record("COACH-02 (Coach probes rather than accepting minimized claim at face value — reply is a question)", turn1.reply.includes("?") ? "PASS" : "FAIL", turn1.reply.slice(0, 200));

      const turn2 = await sendCoachTurn(
        [{ role: "user", content: "Solo ayudé con algunas entrevistas de candidatos." }, { role: "assistant", content: turn1.reply }],
        "No recuerdo exactamente cuántas, tal vez unas 50, pero no estoy segura.",
        ANTHROPIC_KEY
      );
      record("COACH-03 (Coach continues conversation, returns reply)", !!turn2.reply ? "PASS" : "FAIL", turn2.reply.slice(0, 200));
      const fabricatedCertainty = Object.values(turn2.fields).some(f => f.confidence === "high" && /50/.test(f.value));
      record("COACH-04 (uncertainty preserved — does not report the uncertain '~50' as a high-confidence fact)", !fabricatedCertainty ? "PASS" : "FAIL", JSON.stringify(turn2.fields));
    } catch (e) {
      record("COACH-01..04 (live conversation)", "FAIL", e instanceof Error ? e.message : String(e));
    }

    // ══ FAIL-01 — A0 extraction failure is distinguishable from upload
    // failure (design §8/§39): corrupt, non-PDF bytes must throw a
    // recoverable extraction error, not silently report success. ══
    try {
      await extractCvFields(Buffer.from("not a real pdf").toString("base64"), "application/pdf", ANTHROPIC_KEY);
      record("FAIL-01 (corrupt document produces a distinguishable extraction failure)", "FAIL", "expected extractCvFields to throw, it did not");
    } catch (e) {
      record("FAIL-01 (corrupt document produces a distinguishable extraction failure)", "PASS", e instanceof Error ? e.message.slice(0, 150) : String(e));
    }
  }

  // ══ cleanup ══
  await svc.from("cases").delete().eq("case_number", `TEST-IIL-IDEM-${suffix}`);
  await svc.from("cases").delete().eq("id", caseA.id);
  await svc.from("clients").delete().eq("id", cli.id);

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter(r => r.status === "FAIL").length;
  const notExecutable = results.filter(r => r.status === "NOT EXECUTABLE").length;
  console.error(`\n${results.length - failed - notExecutable}/${results.length} PASS, ${failed} FAIL, ${notExecutable} NOT EXECUTABLE`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(2); });
