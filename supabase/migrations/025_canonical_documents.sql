-- ============================================================
-- Migration 025: Canonical Case Document infrastructure (MTCS-02A)
-- ============================================================
-- Purpose: materializes MTCS-02A — Canonical Document Infrastructure, per the
-- approved MTCS-02 Exact Convergence Design (Correction Pass C-01–C-11,
-- TD2-01–TD2-20, CD-01–CD-14), governed by ADR-011 and Evidence Item Contract V2.
--
-- documents.id becomes the canonical Case Document logical identity (TD2-01).
-- storage_bucket is added as the physical locator component, alongside the
-- existing file_path column — together they are the physical locator only;
-- neither is ever the logical identity (TD2-02, CD-03).
--
-- The (case_id, storage_bucket, file_path) unique index governs REGISTRATION
-- uniqueness of a physical storage object only — it does not define or
-- substitute for logical Case Document identity, which remains exclusively
-- documents.id (CD-04, corrected per C-01/C-08).
--
-- storage_bucket carries no governed business-provenance semantics (CD-13,
-- corrected per C-02) — it is physical-location metadata only.
--
-- uploaded_by becomes nullable to permit future legacy-registered documents
-- whose historical uploader is unknown or not represented in available source
-- data (MTCS-02B). NULL never means system-generated, anonymous, unowned, or
-- unknown-Case — documents.case_id remains NOT NULL throughout.
--
-- document_translations.document_id is an additive, nullable lineage reference
-- to the canonical source document, populated only when A2 is invoked in
-- canonical (document_id-resolving) mode; legacy path-based invocation is
-- fully preserved and continues to produce document_id = NULL.
--
-- This migration does NOT implement MTCS-02B (Case↔Intake Submission linkage,
-- legacy Intake backfill), MTCS-03 (Evidence↔Document association), MTCS-05
-- (provenance taxonomy, returned-document re-entry), or MTCS-07 (signed-URL
-- hardening). No third document infrastructure is introduced (CD-12); no
-- existing data is rewritten or moved.
-- ============================================================

BEGIN;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT NOT NULL DEFAULT 'case-documents';

ALTER TABLE public.documents
  ALTER COLUMN uploaded_by DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS documents_case_bucket_path_key
  ON public.documents(case_id, storage_bucket, file_path);

ALTER TABLE public.document_translations
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_document_translations_document_id
  ON public.document_translations(document_id);

COMMIT;
