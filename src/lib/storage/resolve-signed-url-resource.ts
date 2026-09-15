import type { SupabaseClient } from "@supabase/supabase-js";
import { extractTranslatableFiles } from "@/app/(dashboard)/cases/[id]/extract-files";

// MTCS-07 — signed-URL hardening (docs/MTCS-07_FINAL_EXACT_DESIGN.md).
// Framework-agnostic resource-binding resolution, shared by
// src/app/api/storage/signed-url/route.ts and its TEST validation script
// (supabase/tests/mtcs07-validate.js), so both exercise the exact same
// logic rather than two independently-maintained implementations.

export const INTAKE_BUCKET = "intake-documents";

export interface ResolvedResource {
  caseId: string;
  bucket: string;
  filePath: string;
}

// LB-03 bucket reconstruction (CR-07-01): document_translations.document_id
// is an exact FK to documents.id, populated by A2 with the canonical
// document_id it resolved at generation time (never re-derived via
// case_id + original_file_path — that mechanism is explicitly superseded
// and non-normative). document_id IS NULL means A2 generated this
// translation in legacy mode, whose own default bucket is intake-documents
// (LB-03 FK NULL SEMANTICS: A — no runtime path deletes a documents row
// independently of its owning Case).
export async function resolveTranslationBucket(
  db: SupabaseClient,
  documentId: string | null
): Promise<string | null> {
  if (!documentId) return INTAKE_BUCKET;
  const { data, error } = await db
    .from("documents")
    .select("storage_bucket")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(`Failed to resolve translation's canonical original: ${error.message}`);
  // Referential-integrity defensive behavior: document_id is non-null but
  // the referenced row could not be resolved — fail closed, never fall
  // back to intake-documents for a canonical-origin translation.
  if (!data) return null;
  return data.storage_bucket as string;
}

// Canonical mode: document_id is authoritative. Any caller-supplied
// case_id/file_path/bucket is never accepted by the caller of this
// function in the first place. Returns null on unknown document_id.
export async function resolveCanonicalDocument(
  db: SupabaseClient,
  documentId: string
): Promise<ResolvedResource | null> {
  const { data, error } = await db
    .from("documents")
    .select("case_id, storage_bucket, file_path")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(`Canonical resolution failed: ${error.message}`);
  if (!data) return null;
  return { caseId: data.case_id as string, bucket: data.storage_bucket as string, filePath: data.file_path as string };
}

// Legacy-shaped mode (case_id + file_path supplied) — no current caller
// sends case_id (confirmed by direct inspection of download-file.ts,
// document-translation-section.tsx, document-generation-section.tsx), so
// resolved_case_id is derived from whichever authoritative row matches the
// exact requested path, never trusted from the caller. Ambiguous matches
// (which should not occur given how these paths are constructed) fail
// closed (null → 404), never guessed.
export async function resolveLegacyBinding(db: SupabaseClient, path: string): Promise<ResolvedResource | null> {
  // LB-01 — documents: an exact canonical match promotes this request to
  // canonical semantics rather than continuing under generic legacy
  // treatment.
  {
    const { data, error } = await db
      .from("documents")
      .select("case_id, storage_bucket, file_path")
      .eq("storage_bucket", INTAKE_BUCKET)
      .eq("file_path", path);
    if (error) throw new Error(`LB-01 lookup failed: ${error.message}`);
    if (data && data.length === 1) {
      return { caseId: data[0].case_id, bucket: data[0].storage_bucket, filePath: data[0].file_path };
    }
    if (data && data.length > 1) return null;
  }

  // LB-02 — intake_submissions: the legitimate path set is always
  // re-derived server-side via extractTranslatableFiles(), exactly as
  // src/lib/documents/reconcile-intake-documents.ts already does — never
  // trusts a caller-supplied path list.
  {
    const { data: submissions, error } = await db.from("intake_submissions").select("*");
    if (error) throw new Error(`LB-02 lookup failed: ${error.message}`);
    const matches = new Set<string>();
    for (const submission of submissions ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const files = extractTranslatableFiles(submission as Record<string, any>);
      if (files.some((f) => f.filePath === path)) matches.add(submission.case_id as string);
    }
    if (matches.size === 1) {
      return { caseId: Array.from(matches)[0], bucket: INTAKE_BUCKET, filePath: path };
    }
    if (matches.size > 1) return null;
  }

  // LB-03 — document_translations: exact binding on translation_docx_path;
  // never signs original_file_path for a translation download.
  {
    const { data, error } = await db
      .from("document_translations")
      .select("case_id, document_id, translation_docx_path")
      .eq("translation_docx_path", path);
    if (error) throw new Error(`LB-03 lookup failed: ${error.message}`);
    if (data && data.length === 1) {
      const translation = data[0];
      const bucket = await resolveTranslationBucket(db, translation.document_id as string | null);
      if (!bucket) return null; // referential-integrity defensive fail-closed
      return { caseId: translation.case_id as string, bucket, filePath: translation.translation_docx_path as string };
    }
    if (data && data.length > 1) return null;
  }

  // LB-04 — generated-document tables (recommendation letters, petition
  // drafts, I-129 drafts): exact binding on docx_path.
  {
    for (const table of ["agent_recommendation_letters", "agent_petition_drafts", "i129_form_drafts"] as const) {
      const { data, error } = await db.from(table).select("case_id, docx_path").eq("docx_path", path);
      if (error) throw new Error(`LB-04 (${table}) lookup failed: ${error.message}`);
      if (data && data.length === 1) {
        return { caseId: data[0].case_id as string, bucket: INTAKE_BUCKET, filePath: data[0].docx_path as string };
      }
      if (data && data.length > 1) return null;
    }
  }

  return null; // no authoritative binding found in any of LB-01–LB-04
}
