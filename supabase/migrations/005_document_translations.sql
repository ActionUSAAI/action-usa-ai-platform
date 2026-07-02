-- ============================================================
-- AUCIS — Agent A2: Document Processor
-- Migration 005: document_translations table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_translations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  agent                 TEXT NOT NULL DEFAULT 'A2_DOCUMENT_PROCESSOR',
  status                TEXT NOT NULL DEFAULT 'processing', -- processing|completed|failed
  original_file_path    TEXT NOT NULL,
  original_file_name    TEXT NOT NULL,
  document_type         TEXT,
  document_category     TEXT,   -- structured|article|letter
  document_title        TEXT,
  detected_language     TEXT,
  issued_by             TEXT,
  issued_to             TEXT,
  document_date         TEXT,
  translated_content    TEXT,
  translation_docx_path TEXT,
  translation_docx_name TEXT,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_translations_case
  ON public.document_translations(case_id);

CREATE INDEX IF NOT EXISTS idx_doc_translations_case_status
  ON public.document_translations(case_id, status);

CREATE TRIGGER set_doc_translations_updated_at
  BEFORE UPDATE ON public.document_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
