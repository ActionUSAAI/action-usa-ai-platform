import { NextRequest, NextResponse } from "next/server";
import { authorizeClientStaff, adminDb } from "@/lib/auth/authorize-client-staff";

// TX-03 wiring. clientId is resolved server-side from the observation row
// itself (never trusted from the request body) so Layer-1 authorization is
// checked against the real owning client before any RPC call. The actor id
// passed to the RPC is exclusively the SSR-resolved user id from
// authorizeClientStaff — never anything the caller supplies.
export async function POST(request: NextRequest) {
  let body: { observationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const observationId = body.observationId;
  if (!observationId) {
    return NextResponse.json({ error: "observationId es requerido" }, { status: 400 });
  }

  const db = adminDb();
  const { data: observation, error: obsErr } = await db
    .from("canonical_beneficiary_records")
    .select("client_id")
    .eq("id", observationId)
    .eq("record_type", "CANDIDATE_OBSERVED")
    .maybeSingle();
  if (obsErr || !observation) {
    return NextResponse.json({ error: "Observación no encontrada" }, { status: 404 });
  }

  const auth = await authorizeClientStaff(observation.client_id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await db
    .rpc("cbr_tx03_open_g3_review", { p_observation_id: observationId, p_actor_id: auth.userId })
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
