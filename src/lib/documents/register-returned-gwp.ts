import type { SupabaseClient } from "@supabase/supabase-js";
import { registerCanonicalDocument, type CanonicalDocument } from "@/lib/documents/register-canonical-document";

// MTCS-08 — Generated Work Product Re-entry
// (docs/MTCS-08_FINAL_EXACT_DESIGN.md, SHA256
// ae73ab1e4bf4e00e9cfcc0b1fff92073f0fa301d505848e85434d4a6dc31a5dd).
// Framework-agnostic domain logic, shared by
// src/app/api/case-letters/[id]/returned-document/route.ts and
// supabase/tests/mtcs08-validate.ts, mirroring the separation already
// established by src/lib/storage/resolve-signed-url-resource.ts (MTCS-07).
//
// Responsibility boundary (design §13/§16): resolves the originating
// GWP, enforces the approved eligibility precondition, derives the
// authoritative case_id, builds the deterministic storage path,
// uploads to the existing intake-documents bucket, and calls the
// generic registerCanonicalDocument with the lineage reference. Does
// NOT authorize (the caller must call authorizeCaseStaff first), does
// NOT trigger A2/Evidence/A1/A5/Blueprint, and does NOT interpret GWP
// business lifecycle beyond the single 'approved' precondition.

export const RETURNED_GWP_BUCKET = "intake-documents";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export interface OriginatingLetter {
  id: string;
  case_id: string;
  status: string;
}

export type RegisterReturnedGwpError =
  | { code: "NOT_FOUND"; message: string }
  | { code: "INELIGIBLE"; message: string }
  | { code: "INVALID_FILE"; message: string }
  | { code: "STORAGE_FAILURE"; message: string }
  | { code: "PERSISTENCE_FAILURE"; message: string };

export type RegisterReturnedGwpResult =
  | { ok: true; document: CanonicalDocument }
  | { ok: false; error: RegisterReturnedGwpError };

// Bound identity resolution (design §13 "Binding") — the route calls
// this before authorizeCaseStaff, so authorization is performed
// against the authoritative, server-resolved case_id.
export async function resolveOriginatingLetter(
  db: SupabaseClient,
  letterId: string
): Promise<OriginatingLetter | null> {
  const { data, error } = await db
    .from("agent_recommendation_letters")
    .select("id, case_id, status")
    .eq("id", letterId)
    .maybeSingle();
  if (error) throw new Error(`resolveOriginatingLetter: ${error.message}`);
  if (!data) return null;
  return data as OriginatingLetter;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Design §14/§25 — case-scoped, origin-scoped, timestamped, collision-
// resistant, never overwrites the originating GWP's own docx_path.
export function buildReturnedGwpPath(caseId: string, letterId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  return `${caseId}/gwp-returns/${letterId}/${Date.now()}_${safeName}`;
}

export interface RegisterReturnedGwpParams {
  letter: OriginatingLetter;
  fileBytes: ArrayBuffer;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
}

export async function registerReturnedGeneratedWorkProduct(
  db: SupabaseClient,
  params: RegisterReturnedGwpParams
): Promise<RegisterReturnedGwpResult> {
  const { letter, fileBytes, fileName, mimeType, fileSize, uploadedBy } = params;

  // Status precondition (design §21) — 'approved' only; 'sent' is not
  // a re-entry prerequisite (Tier 1 gate, reaffirmed).
  if (letter.status !== "approved") {
    return {
      ok: false,
      error: {
        code: "INELIGIBLE",
        message: `Letter ${letter.id} is not eligible for GWP re-entry (status='${letter.status}', expected 'approved')`,
      },
    };
  }

  if (fileSize > MAX_SIZE) {
    return { ok: false, error: { code: "INVALID_FILE", message: "El archivo no puede exceder 10MB." } };
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { ok: false, error: { code: "INVALID_FILE", message: "Solo se permiten archivos PDF, JPG, PNG, DOC o DOCX." } };
  }

  const storagePath = buildReturnedGwpPath(letter.case_id, letter.id, fileName);

  const { error: uploadErr } = await db.storage
    .from(RETURNED_GWP_BUCKET)
    .upload(storagePath, fileBytes, { contentType: mimeType, upsert: true });
  if (uploadErr) {
    return { ok: false, error: { code: "STORAGE_FAILURE", message: uploadErr.message } };
  }

  try {
    const document = await registerCanonicalDocument(db, {
      caseId: letter.case_id,
      storageBucket: RETURNED_GWP_BUCKET,
      filePath: storagePath,
      fileName,
      uploadedBy,
      mimeType,
      fileSize,
      originatingRecommendationLetterId: letter.id,
    });
    return { ok: true, document };
  } catch (e) {
    // Design §29 — DB failure must never report re-entry as successful,
    // whether the rejection came from registerCanonicalDocument itself
    // or from trg_documents_gwp_same_case (migration 033).
    return {
      ok: false,
      error: { code: "PERSISTENCE_FAILURE", message: e instanceof Error ? e.message : "Unknown persistence failure" },
    };
  }
}
