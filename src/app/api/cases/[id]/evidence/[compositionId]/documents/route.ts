import { NextRequest, NextResponse } from "next/server";
import { authorizeCaseStaff, adminDb } from "@/lib/auth/authorize-case-staff";
import { attachDocument, mapEvidenceRpcError } from "@/lib/evidence/evidence-producer";

// Attach a canonical Document to a current+unreviewed Evidence composition (P-04).
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; compositionId: string } }
) {
  const auth = await authorizeCaseStaff(params.id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { document_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.document_id) {
    return NextResponse.json({ error: "Missing required field: document_id" }, { status: 400 });
  }

  try {
    const association = await attachDocument(adminDb(), params.compositionId, body.document_id, auth.userId);
    return NextResponse.json({ success: true, association });
  } catch (error) {
    const { status, error: message } = mapEvidenceRpcError(error as { message?: string });
    return NextResponse.json({ error: message }, { status });
  }
}
