import { NextRequest, NextResponse } from "next/server";
import { authorizeClientStaff, adminDb } from "@/lib/auth/authorize-client-staff";

// TX-05 wiring. clientId resolved server-side from the decision row.
export async function POST(request: NextRequest) {
  let body: { decisionId?: string; reason?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const decisionId = body.decisionId;
  if (!decisionId) {
    return NextResponse.json({ error: "decisionId es requerido" }, { status: 400 });
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
    .rpc("cbr_tx05_reject_g3", { p_decision_id: decisionId, p_actor_id: auth.userId, p_reason: body.reason ?? null })
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
