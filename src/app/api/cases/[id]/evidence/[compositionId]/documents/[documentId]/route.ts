import { NextRequest, NextResponse } from "next/server";
import { authorizeCaseStaff, adminDb } from "@/lib/auth/authorize-case-staff";
import { detachDocument, mapEvidenceRpcError } from "@/lib/evidence/evidence-producer";

// Detach a canonical Document from a current+unreviewed Evidence composition (P-05).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; compositionId: string; documentId: string } }
) {
  const auth = await authorizeCaseStaff(params.id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const removed = await detachDocument(adminDb(), params.compositionId, params.documentId);
    return NextResponse.json({ success: true, removed });
  } catch (error) {
    const { status, error: message } = mapEvidenceRpcError(error as { message?: string });
    return NextResponse.json({ error: message }, { status });
  }
}
