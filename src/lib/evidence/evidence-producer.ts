import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentaryCondition, EvidenceComposition, VerificationCondition } from "./types";

// Thin RPC-wrapping helpers for the MTCS-04 governed Evidence primitives (migration
// 028). This is the Single Governed Evidence Producer's runtime surface — internal
// only, callable exclusively from server-side API routes after Case-scoped staff
// authorization (src/lib/auth/authorize-case-staff.ts). Never exposed to the browser
// directly. Mirrors the reuse-not-duplicate convention of
// src/lib/documents/register-canonical-document.ts.

// Deterministic HTTP mapping for the governed Evidence error vocabulary (EV001-EV008).
// Message-content matching, consistent with this repo's existing TEST-validation
// convention (mtcs01/02a/02b/03-validate.js all match on error.message, not error.code).
export function mapEvidenceRpcError(error: { message?: string } | null | undefined): { status: number; error: string } {
  const msg = error?.message ?? "Unknown error";
  if (/CONFLICT_CURRENT_COMPOSITION|HISTORICAL_COMPOSITION_IMMUTABLE/.test(msg)) return { status: 409, error: msg };
  if (/CASE_MISMATCH/.test(msg)) return { status: 409, error: msg };
  if (/DOCUMENT_NOT_FOUND/.test(msg)) return { status: 404, error: msg };
  if (/STALE_PROBATIVE_SNAPSHOT/.test(msg)) return { status: 409, error: msg };
  if (/STALE_VERIFICATION_STATE/.test(msg)) return { status: 409, error: msg };
  if (/INVALID_REVIEW_DECISION|INVALID_DOCUMENTARY_CONDITION|INVALID_CREATE_MODE/.test(msg)) return { status: 400, error: msg };
  if (/verification_condition|needs_attention_requires_reason|documentary_condition_values|check constraint/.test(msg)) return { status: 400, error: msg };
  return { status: 500, error: msg };
}

export interface CreateEvidenceCompositionParams {
  evidenceId?: string | null;
  expectedCurrentId?: string | null;
  caseId: string;
  fact: string;
  documentaryCondition: DocumentaryCondition;
  sourceType?: string | null;
  sourceReference?: string | null;
  createdBy: string;
  documentIds?: string[];
}

export async function createEvidenceComposition(
  db: SupabaseClient,
  params: CreateEvidenceCompositionParams
): Promise<EvidenceComposition> {
  const { data, error } = await db.rpc("create_evidence_composition_with_documents", {
    p_evidence_id: params.evidenceId ?? null,
    p_expected_current_id: params.expectedCurrentId ?? null,
    p_case_id: params.caseId,
    p_fact: params.fact,
    p_documentary_condition: params.documentaryCondition,
    p_source_type: params.sourceType ?? null,
    p_source_reference: params.sourceReference ?? null,
    p_created_by: params.createdBy,
    p_document_ids: params.documentIds ?? [],
  });
  if (error) throw error;
  return data as EvidenceComposition;
}

export async function attachDocument(
  db: SupabaseClient,
  evidenceItemId: string,
  documentId: string,
  createdBy: string
) {
  const { data, error } = await db.rpc("attach_evidence_document", {
    p_evidence_item_id: evidenceItemId,
    p_document_id: documentId,
    p_created_by: createdBy,
  });
  if (error) throw error;
  return data;
}

export async function detachDocument(
  db: SupabaseClient,
  evidenceItemId: string,
  documentId: string
): Promise<boolean> {
  const { data, error } = await db.rpc("detach_evidence_document", {
    p_evidence_item_id: evidenceItemId,
    p_document_id: documentId,
  });
  if (error) throw error;
  return data as boolean;
}

export async function updateFact(
  db: SupabaseClient,
  compositionId: string,
  fact: string,
  actorId: string
): Promise<EvidenceComposition> {
  const { data, error } = await db.rpc("update_evidence_fact", {
    p_composition_id: compositionId,
    p_fact: fact,
    p_actor_id: actorId,
  });
  if (error) throw error;
  return data as EvidenceComposition;
}

export async function updateDocumentaryCondition(
  db: SupabaseClient,
  compositionId: string,
  documentaryCondition: DocumentaryCondition,
  actorId: string
): Promise<EvidenceComposition> {
  const { data, error } = await db.rpc("update_evidence_documentary_condition", {
    p_composition_id: compositionId,
    p_documentary_condition: documentaryCondition,
    p_actor_id: actorId,
  });
  if (error) throw error;
  return data as EvidenceComposition;
}

export interface ReviewCompositionParams {
  compositionId: string;
  expectedProbativeRevision: number;
  expectedReviewedAt: string | null;
  verificationCondition: VerificationCondition;
  verificationReason?: string | null;
  reviewedBy: string;
}

// RV-04-01/RV-04-02: expectedProbativeRevision/expectedReviewedAt must be forwarded
// exactly as received from the client's loaded snapshot — never replaced with a
// freshly-queried current value, or stale-view protection is silently defeated.
export async function reviewComposition(
  db: SupabaseClient,
  params: ReviewCompositionParams
): Promise<EvidenceComposition> {
  const { data, error } = await db.rpc("review_evidence_composition_if_current", {
    p_composition_id: params.compositionId,
    p_expected_probative_revision: params.expectedProbativeRevision,
    p_expected_reviewed_at: params.expectedReviewedAt,
    p_verification_condition: params.verificationCondition,
    p_verification_reason: params.verificationReason ?? null,
    p_reviewed_by: params.reviewedBy,
  });
  if (error) throw error;
  return data as EvidenceComposition;
}
