import { NextRequest, NextResponse } from "next/server";
import { authorizeCaseStaff, adminDb } from "@/lib/auth/authorize-case-staff";
import { updateDocumentaryCondition, mapEvidenceRpcError } from "@/lib/evidence/evidence-producer";
import type { DocumentaryCondition } from "@/lib/evidence/types";

// Human confirmation/correction of Documentary Condition — independent dimension,
// permitted regardless of review state (existing update_evidence_documentary_condition
// primitive, migration 024, reused unmodified).
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; compositionId: string } }
) {
  const auth = await authorizeCaseStaff(params.id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { documentary_condition?: DocumentaryCondition };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.documentary_condition) {
    return NextResponse.json({ error: "Missing required field: documentary_condition" }, { status: 400 });
  }

  try {
    const composition = await updateDocumentaryCondition(
      adminDb(), params.compositionId, body.documentary_condition, auth.userId
    );
    return NextResponse.json({ success: true, composition });
  } catch (error) {
    const { status, error: message } = mapEvidenceRpcError(error as { message?: string });
    return NextResponse.json({ error: message }, { status });
  }
}
