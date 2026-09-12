export type DocumentaryCondition = "reported" | "partial" | "documented";
export type VerificationCondition = "pending" | "verified" | "needs_attention";
export type CurrencyStatus = "current" | "superseded";

export interface EvidenceComposition {
  id: string;
  evidence_id: string;
  case_id: string;
  fact: string;
  version: number;
  currency_status: CurrencyStatus;
  superseded_by: string | null;
  documentary_condition: DocumentaryCondition;
  documentary_condition_updated_by: string | null;
  documentary_condition_updated_at: string | null;
  verification_condition: VerificationCondition;
  reviewed_by: string | null;
  reviewed_at: string | null;
  verification_reason: string | null;
  probative_revision: number;
  fact_updated_by: string | null;
  fact_updated_at: string | null;
  source_type: string | null;
  source_reference: string | null;
  created_by: string | null;
  created_at: string;
}

export interface EvidenceDocumentAssociation {
  evidence_item_id: string;
  document_id: string;
  case_id: string;
  created_by: string | null;
  created_at: string;
}

export interface AssociatedDocument {
  id: string;
  name: string;
  file_path: string;
  storage_bucket: string;
}
