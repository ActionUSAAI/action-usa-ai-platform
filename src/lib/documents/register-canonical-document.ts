import type { SupabaseClient } from "@supabase/supabase-js";

export interface RegisterCanonicalDocumentParams {
  caseId: string;
  storageBucket: string;
  filePath: string;
  fileName: string;
  uploadedBy?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}

export interface CanonicalDocument {
  id: string;
  case_id: string;
  client_id: string;
  storage_bucket: string;
  file_path: string;
  name: string;
}

/**
 * Idempotently registers a physical storage object as a canonical Case Document
 * (MTCS-02A). Requires an already-known, valid Case identity — never infers or
 * fabricates Case ownership from path, session, uploader, or filename (CD-14).
 *
 * Concurrency-safe via the DB-level unique constraint on
 * (case_id, storage_bucket, file_path) — a race between two callers registering
 * the same physical object resolves to exactly one canonical row (CD-04).
 *
 * Does not create Evidence, does not invoke A1/A5, does not assign business
 * provenance (CD-13), does not move or copy the underlying storage object.
 */
export async function registerCanonicalDocument(
  db: SupabaseClient,
  params: RegisterCanonicalDocumentParams
): Promise<CanonicalDocument> {
  const { caseId, storageBucket, filePath, fileName, uploadedBy, mimeType, fileSize } = params;

  const { data: kase, error: caseErr } = await db
    .from("cases")
    .select("id, client_id")
    .eq("id", caseId)
    .single();

  if (caseErr || !kase) {
    throw new Error(`registerCanonicalDocument: no valid Case found for case_id=${caseId}`);
  }

  const { data: upserted, error: upsertErr } = await db
    .from("documents")
    .upsert(
      {
        case_id: caseId,
        client_id: kase.client_id,
        uploaded_by: uploadedBy ?? null,
        name: fileName,
        file_path: filePath,
        storage_bucket: storageBucket,
        mime_type: mimeType ?? null,
        file_size: fileSize ?? null,
        status: "pendiente",
      },
      { onConflict: "case_id,storage_bucket,file_path", ignoreDuplicates: true }
    )
    .select("id, case_id, client_id, storage_bucket, file_path, name")
    .maybeSingle();

  if (upsertErr) {
    throw new Error(`registerCanonicalDocument: upsert failed: ${upsertErr.message}`);
  }

  if (upserted) {
    return upserted;
  }

  // ignoreDuplicates skipped the insert (conflict on the unique key) — resolve
  // the already-canonical row rather than treat this as a new registration.
  const { data: existing, error: selectErr } = await db
    .from("documents")
    .select("id, case_id, client_id, storage_bucket, file_path, name")
    .eq("case_id", caseId)
    .eq("storage_bucket", storageBucket)
    .eq("file_path", filePath)
    .single();

  if (selectErr || !existing) {
    throw new Error(
      `registerCanonicalDocument: conflict occurred but existing row could not be resolved: ${selectErr?.message}`
    );
  }

  return existing;
}
