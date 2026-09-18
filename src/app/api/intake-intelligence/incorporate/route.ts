import { NextRequest, NextResponse } from "next/server";
import { authorizeCaseStaff, adminDb } from "@/lib/auth/authorize-case-staff";
import { incorporateStructuredProfileEvidence, mapEvidenceRpcError } from "@/lib/evidence/evidence-producer";
import { resolveIncorporationCandidates, buildDeterministicFact } from "@/lib/evidence/structured-profile-incorporation";
import type { StructuredProfile } from "@/lib/intake/structured-profile";

// AUSCIS Structured Profile -> Evidence Incorporation (CR-CPS-46..53,
// migration 038). Two modes over the same authorized surface:
//
// "deterministic" -- staff-triggered batch action; incorporates every
// currently-eligible IDENTITY_FIELDS candidate (DDR-SEI-01/02) with no
// per-field human interpretation, one wrapper call per candidate,
// each independently atomic/retry-safe.
//
// "human" -- staff-triggered single-candidate Create action for a
// CRITERION_NARRATIVE_FIELDS candidate; requires a client-generated
// stable action_token (retry/replay discriminator only -- never
// Evidence/fact/criterion/verification identity, DDR-SEI-05/06) and
// the staff-authored fact text (may reproduce, excerpt, or correct the
// candidate's raw value, per design section 10).
//
// case_id is used only for authorization (authorizeCaseStaff) and a
// defensive cross-check against the submission's own case_id; the
// wrapper itself independently derives case_id from the locked
// intake_submissions row, so Evidence is never attributable to the
// wrong case even if this route-level check were bypassed.
export async function POST(request: NextRequest) {
  let body: {
    case_id?: string;
    submission_id?: string;
    mode?: "deterministic" | "human";
    field_key?: string;
    action_token?: string;
    fact?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.case_id || !body.submission_id || !body.mode) {
    return NextResponse.json({ error: "Missing required fields: case_id, submission_id, mode" }, { status: 400 });
  }

  const auth = await authorizeCaseStaff(body.case_id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = adminDb();
  const { data: submission, error: subErr } = await db
    .from("intake_submissions")
    .select("id, case_id, structured_profile")
    .eq("id", body.submission_id)
    .maybeSingle();
  if (subErr) {
    return NextResponse.json({ error: `Error fetching submission: ${subErr.message}` }, { status: 500 });
  }
  if (!submission || submission.case_id !== body.case_id) {
    return NextResponse.json({ error: "No intake submission found for this case." }, { status: 404 });
  }

  const structuredProfile = (submission.structured_profile ?? {}) as StructuredProfile;
  const candidates = resolveIncorporationCandidates(structuredProfile);

  if (body.mode === "deterministic") {
    const deterministicCandidates = candidates.filter(c => c.path === "deterministic");
    const results: unknown[] = [];
    for (const candidate of deterministicCandidates) {
      try {
        const composition = await incorporateStructuredProfileEvidence(db, {
          submissionId: submission.id,
          fieldKey: candidate.fieldKey,
          source: candidate.source,
          actionToken: null,
          fact: buildDeterministicFact(candidate.fieldKey, candidate.value),
          createdBy: auth.userId,
        });
        results.push({ field_key: candidate.fieldKey, success: true, composition });
      } catch (error) {
        const { status, error: message } = mapEvidenceRpcError(error as { message?: string });
        results.push({ field_key: candidate.fieldKey, success: false, status, error: message });
      }
    }
    return NextResponse.json({ success: true, mode: "deterministic", results });
  }

  // mode === "human"
  if (!body.field_key || !body.action_token || !body.fact) {
    return NextResponse.json({ error: "Missing required fields for human mode: field_key, action_token, fact" }, { status: 400 });
  }

  const candidate = candidates.find(c => c.fieldKey === body.field_key && c.path === "human_resolution");
  if (!candidate) {
    return NextResponse.json({ error: "Field is not an eligible human-resolution candidate." }, { status: 400 });
  }

  try {
    const composition = await incorporateStructuredProfileEvidence(db, {
      submissionId: submission.id,
      fieldKey: candidate.fieldKey,
      source: candidate.source,
      actionToken: body.action_token,
      fact: body.fact,
      createdBy: auth.userId,
    });
    return NextResponse.json({ success: true, mode: "human", composition });
  } catch (error) {
    const { status, error: message } = mapEvidenceRpcError(error as { message?: string });
    return NextResponse.json({ error: message }, { status });
  }
}
