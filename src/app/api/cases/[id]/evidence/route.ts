import { NextRequest, NextResponse } from "next/server";
import { authorizeCaseStaff, adminDb } from "@/lib/auth/authorize-case-staff";
import { createEvidenceComposition, mapEvidenceRpcError } from "@/lib/evidence/evidence-producer";
import type { DocumentaryCondition } from "@/lib/evidence/types";

// Single Governed Evidence Producer — creation entry point (MTCS-04, P-01/P-02/P-03).
// Atomically creates a v1 (evidenceId/expectedCurrentId both omitted) or supersedes an
// existing current composition (both supplied) together with its complete initial
// Document set, in one DB transaction (create_evidence_composition_with_documents).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const caseId = params.id;
  const auth = await authorizeCaseStaff(caseId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: {
    evidence_id?: string | null;
    expected_current_id?: string | null;
    fact: string;
    documentary_condition: DocumentaryCondition;
    source_type?: string | null;
    source_reference?: string | null;
    document_ids?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.fact || !body.documentary_condition) {
    return NextResponse.json(
      { error: "Missing required fields: fact, documentary_condition" },
      { status: 400 }
    );
  }

  try {
    const composition = await createEvidenceComposition(adminDb(), {
      evidenceId: body.evidence_id ?? null,
      expectedCurrentId: body.expected_current_id ?? null,
      caseId,
      fact: body.fact,
      documentaryCondition: body.documentary_condition,
      sourceType: body.source_type ?? null,
      sourceReference: body.source_reference ?? null,
      createdBy: auth.userId,
      documentIds: body.document_ids ?? [],
    });
    return NextResponse.json({ success: true, composition });
  } catch (error) {
    const { status, error: message } = mapEvidenceRpcError(error as { message?: string });
    return NextResponse.json({ error: message }, { status });
  }
}
