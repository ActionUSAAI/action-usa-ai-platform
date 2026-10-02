import { NextRequest, NextResponse } from "next/server";
import { authorizeClientStaff, adminDb } from "@/lib/auth/authorize-client-staff";

// TX-04 wiring. `expectedPriorValue` MUST be exactly the canonical value
// the client UI last displayed to the reviewer (the pending-reviews GET
// response's `currentCanonical`) — this route never re-fetches a fresh
// canonical value to substitute for it; that is precisely what TX-04's own
// STALE_PRIOR_VALUE check exists to detect. clientId is resolved
// server-side from the decision row, never trusted from the request body.
export async function POST(request: NextRequest) {
  let body: { decisionId?: string; expectedPriorValue?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const decisionId = body.decisionId;
  if (!decisionId) {
    return NextResponse.json({ error: "decisionId es requerido" }, { status: 400 });
  }
  // expectedPriorValue MAY be null (absent canonical at review time) but
  // must be an explicit field on the request — never silently defaulted.
  if (!("expectedPriorValue" in body)) {
    return NextResponse.json({ error: "expectedPriorValue es requerido (puede ser null)" }, { status: 400 });
  }

  const db = adminDb();
  const { data: decision, error: decErr } = await db
    .from("canonical_beneficiary_records")
    .select("client_id")
    .eq("id", decisionId)
    .eq("record_type", "DECISION")
    .maybeSingle();
  if (decErr || !decision) {
    return NextResponse.json({ error: "Decisión no encontrada" }, { status: 404 });
  }

  const auth = await authorizeClientStaff(decision.client_id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await db
    .rpc("cbr_tx04_approve_g3", {
      p_decision_id: decisionId,
      p_actor_id: auth.userId,
      p_expected_prior_value: body.expectedPriorValue ?? null,
    })
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
