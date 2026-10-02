import { NextRequest, NextResponse } from "next/server";
import { authorizeClientStaff, adminDb } from "@/lib/auth/authorize-client-staff";
import { extractConfirmedAt, isCurrent, isResolvable, describeNotCurrent, type GoverningTuple } from "@/lib/cbr/review-surface";

// CBR §J review surface (read side).
//
// IC Finding 4: this route must be AUTHORITATIVE, not a display-side filter
// that "lists everything and lets TX-03 sort it out". It reproduces §G's
// CURRENT test and OPENABLE's "never approved/rejected" condition from
// actual data (via the new, narrowly-scoped
// public.cbr_review_surface_governing_state RPC, since cbr_internal itself
// is never exposed via PostgREST — unchanged, by design). TX-03 remains the
// FINAL authoritative re-check at open time; this route's computation must
// still be correct on its own, not merely "usually right until TX-03
// corrects it".
const CBR_G3_FIELDS = ["middleName", "dateOfBirth", "firstName", "lastName"] as const;

type Row = {
  id: string;
  record_type: string;
  field_key: string;
  candidate_value: string | null;
  origin: string | null;
  created_at: string;
  source_submission_id: string | null;
  source_observation_id: string | null;
  related_candidate_id: string | null;
  decision_state: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_reason: string | null;
  expected_prior_value: string | null;
  superseded_by_submission_id: string | null;
};

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId es requerido" }, { status: 400 });
  }

  const auth = await authorizeClientStaff(clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = adminDb();

  const { data: client, error: clientErr } = await db
    .from("clients")
    .select("first_name, last_name, date_of_birth, middle_name")
    .eq("id", clientId)
    .single();
  if (clientErr || !client) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const { data: governing, error: governingErr } = await db.rpc("cbr_review_surface_governing_state", { p_client_id: clientId });
  if (governingErr) {
    return NextResponse.json({ error: governingErr.message }, { status: 500 });
  }
  const governingByField = new Map<string, GoverningTuple>();
  for (const g of governing ?? []) {
    governingByField.set(g.field_key, { submissionId: g.governing_submission_id, submittedAt: g.governing_submitted_at });
  }

  const { data: rows, error: rowsErr } = await db
    .from("canonical_beneficiary_records")
    .select("id, record_type, field_key, candidate_value, origin, created_at, source_submission_id, source_observation_id, related_candidate_id, decision_state, reviewed_by, reviewed_at, decision_reason, expected_prior_value, superseded_by_submission_id")
    .eq("client_id", clientId)
    .in("record_type", ["CANDIDATE_OBSERVED", "CONFLICT_DETECTED", "DECISION"]);
  if (rowsErr) {
    return NextResponse.json({ error: rowsErr.message }, { status: 500 });
  }
  const allRows = (rows ?? []) as Row[];

  // submitted_at + structured_profile for every referenced submission, via the public, exposed
  // intake_submissions table — needed to evaluate CURRENT's event-order tuple (§G) AND to read
  // the authoritative confirmation timestamp (§D) from the EXACT submission that produced each
  // candidate — never the client's current/live structured_profile, which may reflect a LATER
  // reconfirmation than the one that actually produced this candidate, and never a CBR record's
  // own created_at/submitted_at/review-open time.
  const submissionIds = Array.from(new Set(allRows.map((r) => r.source_submission_id).filter((x): x is string => !!x)));
  const submittedAtBySubmission = new Map<string, string>();
  const structuredProfileBySubmission = new Map<string, Record<string, unknown> | null>();
  if (submissionIds.length > 0) {
    const { data: subs, error: subsErr } = await db
      .from("intake_submissions")
      .select("id, submitted_at, structured_profile")
      .in("id", submissionIds);
    if (subsErr) return NextResponse.json({ error: subsErr.message }, { status: 500 });
    for (const s of subs ?? []) {
      submittedAtBySubmission.set(s.id, s.submitted_at);
      structuredProfileBySubmission.set(s.id, s.structured_profile ?? null);
    }
  }

  function currentFor(fieldKey: string, submissionId: string | null): boolean {
    return isCurrent(governingByField.get(fieldKey), submissionId ? submittedAtBySubmission.get(submissionId) ?? null : null, submissionId);
  }

  function confirmationTimestampFor(fieldKey: string, submissionId: string | null): string | null {
    if (!submissionId) return null;
    return extractConfirmedAt(structuredProfileBySubmission.get(submissionId) ?? null, fieldKey);
  }

  const candidates = allRows.filter((r) => r.record_type === "CANDIDATE_OBSERVED");
  const conflicts = allRows.filter((r) => r.record_type === "CONFLICT_DETECTED");
  const decisionsAll = allRows.filter((r) => r.record_type === "DECISION");
  const candidatesById = new Map(candidates.map((c) => [c.id, c] as const));

  const currentCanonicalByField: Record<string, string | null> = {
    firstName: client.first_name ?? null,
    lastName: client.last_name ?? null,
    middleName: client.middle_name ?? null,
    dateOfBirth: client.date_of_birth ?? null,
  };

  // §J requires the review surface to display current canonical and origin for every reviewable
  // item, openable candidates included — not only already-opened pending decisions. Both were
  // previously omitted here.
  const openable = candidates
    .filter((c) => CBR_G3_FIELDS.includes(c.field_key as (typeof CBR_G3_FIELDS)[number]))
    .filter((c) => currentFor(c.field_key, c.source_submission_id))
    .filter((c) => !decisionsAll.some((d) => d.field_key === c.field_key && d.decision_state === "pending"))
    .filter((c) => !decisionsAll.some((d) => d.source_observation_id === c.id && (d.decision_state === "approved" || d.decision_state === "rejected")))
    .map((c) => ({
      observationId: c.id,
      fieldKey: c.field_key,
      candidateValue: c.candidate_value,
      origin: c.origin,
      currentCanonical: currentCanonicalByField[c.field_key] ?? null,
      createdAt: c.created_at,
      hasConflict: conflicts.some((x) => x.related_candidate_id === c.id),
      // §D: the actual beneficiary confirmation timestamp, read from the structured_profile
      // snapshot captured on the submission that produced THIS candidate — never CBR created_at.
      confirmationTimestamp: confirmationTimestampFor(c.field_key, c.source_submission_id),
    }));
  // NOTE: this list is authoritative given the data read above, but TX-03's own OPENABLE
  // re-check under lock remains the FINAL word at open time (a race between this read and a
  // concurrent write is always possible; TX-03 correctly rejects it if so, per its own design).

  // Complete decision history per field — not merely the single pending one. Reviewer
  // information is exposed ONLY where it actually exists (approved/rejected); superseded
  // decisions explicitly never carry a fabricated reviewer (reviewed_by is null by the
  // database's own CHECK constraint for that state) and instead expose
  // supersededBySubmissionId.
  // RESOLVABLE (§G, TX-04): DECISION pending AND source_observation_id still CURRENT — never
  // "pending alone". Computed here as ADVISORY display state only; cbr_tx04_approve_g3's own
  // STEP 7 (under lock) remains the sole authoritative check at approval time — this can go
  // stale between this read and an approval attempt, exactly like currentCanonical can.
  const decisions = decisionsAll.map((d) => {
    const observation = d.source_observation_id ? candidatesById.get(d.source_observation_id) : undefined;
    const observationSubmissionId = observation?.source_submission_id ?? null;
    const observationSubmittedAt = observationSubmissionId ? submittedAtBySubmission.get(observationSubmissionId) ?? null : null;
    return {
      decisionId: d.id,
      fieldKey: d.field_key,
      decisionState: d.decision_state,
      candidateValue: d.candidate_value,
      expectedPriorValueAtOpen: d.expected_prior_value, // immutable audit snapshot — display separately
      currentCanonical: currentCanonicalByField[d.field_key] ?? null, // live value, distinct from the snapshot above
      origin: d.origin,
      createdAt: d.created_at,
      // §D: the source observation's own confirmation timestamp — same rule as `openable` above.
      confirmationTimestamp: observationSubmissionId ? confirmationTimestampFor(d.field_key, observationSubmissionId) : null,
      resolvable: isResolvable(d.decision_state, governingByField.get(d.field_key), observationSubmittedAt, observationSubmissionId),
      // Only meaningful for a pending decision; null for any other decisionState (the UI never
      // renders this badge outside the pending section). Distinguishes an actual, confirmed
      // supersession by a newer submission ("stale") from a missing/unresolved observation link
      // ("missing_data", a data/integrity condition) — never described to staff as "superseded"
      // when the real reason is that the linked data could not be resolved at all.
      notResolvableReason: d.decision_state === "pending"
        ? describeNotCurrent(governingByField.get(d.field_key), observationSubmittedAt, observationSubmissionId)
        : null,
      reviewedBy: d.decision_state === "approved" || d.decision_state === "rejected" ? d.reviewed_by : null,
      reviewedAt: d.decision_state === "approved" || d.decision_state === "rejected" ? d.reviewed_at : null,
      decisionReason: d.decision_reason,
      supersededBySubmissionId: d.decision_state === "superseded" ? d.superseded_by_submission_id : null,
    };
  });

  return NextResponse.json({ openable, decisions });
}
