import { NextRequest, NextResponse } from "next/server";
import { authorizeCaseStaff, adminDb } from "@/lib/auth/authorize-case-staff";
import { updateFact, mapEvidenceRpcError } from "@/lib/evidence/evidence-producer";

// FC-A governed fact correction — current+unreviewed only (P-06).
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; compositionId: string } }
) {
  const auth = await authorizeCaseStaff(params.id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { fact?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.fact) {
    return NextResponse.json({ error: "Missing required field: fact" }, { status: 400 });
  }

  try {
    const composition = await updateFact(adminDb(), params.compositionId, body.fact, auth.userId);
    return NextResponse.json({ success: true, composition });
  } catch (error) {
    const { status, error: message } = mapEvidenceRpcError(error as { message?: string });
    return NextResponse.json({ error: message }, { status });
  }
}
