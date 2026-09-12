import { NextRequest, NextResponse } from "next/server";
import { authorizeCaseStaff, adminDb } from "@/lib/auth/authorize-case-staff";
import { reviewComposition, mapEvidenceRpcError } from "@/lib/evidence/evidence-producer";
import type { VerificationCondition } from "@/lib/evidence/types";

// Human Verification — the only pathway authorized to confer Verified/Needs Attention
// (MTCS-04, RV-04-01 + RV-04-02). expected_probative_revision/expected_reviewed_at are
// the values the human's loaded UI snapshot held — forwarded to the governed wrapper
// EXACTLY as received. This route must NEVER query the current DB state and substitute
// it for these two fields; doing so would silently defeat stale-view protection.
// reviewed_by is always the server-authenticated actor, never taken from the request body.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; compositionId: string } }
) {
  const auth = await authorizeCaseStaff(params.id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    expected_probative_revision?: number;
    expected_reviewed_at?: string | null;
    verification_condition?: VerificationCondition;
    verification_reason?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.expected_probative_revision == null || !body.verification_condition) {
    return NextResponse.json(
      { error: "Missing required fields: expected_probative_revision, verification_condition" },
      { status: 400 }
    );
  }

  try {
    const composition = await reviewComposition(adminDb(), {
      compositionId: params.compositionId,
      expectedProbativeRevision: body.expected_probative_revision,
      expectedReviewedAt: body.expected_reviewed_at ?? null,
      verificationCondition: body.verification_condition,
      verificationReason: body.verification_reason ?? null,
      reviewedBy: auth.userId,
    });
    return NextResponse.json({ success: true, composition });
  } catch (error) {
    const { status, error: message } = mapEvidenceRpcError(error as { message?: string });
    return NextResponse.json({ error: message }, { status });
  }
}
