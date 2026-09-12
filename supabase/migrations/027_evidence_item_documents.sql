-- ============================================================
-- Migration 027: Evidence Item ↔ Document association (MTCS-03)
-- ============================================================
-- Purpose: materializes the approved MTCS-03 Exact Design — a governed
-- many-to-many relationship between an immutable Evidence composition/
-- version (evidence_items.id, MTCS-01) and a canonical Case Document
-- (documents.id, MTCS-02). AD-03-02/AD-03-06/ED-03-D02 frozen decisions.
--
-- Evidence Item ≠ Document. This table associates them; it does not
-- merge their identities, does not store files, and is not a third
-- document infrastructure — it references canonical documents.id only.
--
-- Association targets the specific composition (evidence_items.id), not
-- the stable evidence_id — this is what makes historical documentary
-- composition reconstructable per Evidence version (AD-03-02).
--
-- Same-Case membership is enforced authoritatively at the database
-- level via composite foreign keys against additive UNIQUE(id, case_id)
-- constraints on evidence_items and documents (AD-03-06); the governed
-- attach function also validates this explicitly for deterministic
-- failure semantics (defense in depth, not a replacement).
--
-- Mutability rule (ED-03-D02, frozen): association rows may be
-- attached/detached only while the target Evidence composition is
-- currency_status = 'current' AND reviewed_at IS NULL. Once a
-- composition has been reviewed (reviewed_at IS NOT NULL) or superseded,
-- its association set is historically immutable — enforced by a
-- dedicated BEFORE INSERT OR DELETE trigger, independent of role, so
-- a service_role raw-SQL mutation cannot bypass it either.
--
-- Composition construction remains Model C: create_evidence_composition()
-- (migration 024) is not modified. A new composition version always
-- starts with zero associations; copy-forward/orchestration is left to
-- the future Evidence Producer (MTCS-04), not implemented here.
--
-- No UPDATE semantics exist on this table (attach/detach only, no
-- updated_at). No association UUID — (evidence_item_id, document_id) is
-- the complete semantic identity. No speculative metadata (support_type,
-- role, sequence, notes, status fields) — none has a frozen requirement.
--
-- Both association FKs use ON DELETE CASCADE to remain compatible with
-- the existing, unmodified cases→evidence_items and cases→documents
-- CASCADE chains — RESTRICT here would block legitimate whole-Case
-- deletion (Case cascade already destroys Evidence/Document history
-- together, by pre-existing design outside MTCS-03's authority).
--
-- Governed mutation (attach_evidence_document, detach_evidence_document)
-- follows migration 024's exact function-security precedent: SECURITY
-- INVOKER, search_path pinned, EXECUTE revoked from PUBLIC/anon/
-- authenticated, granted only to service_role. Internal-only in MTCS-03 —
-- no route, no UI, no runtime TypeScript helper (no caller exists yet).
--
-- This migration does not implement the Evidence Producer, Human
-- Verification workflow, Documentary Condition automation, Blueprint↔
-- Evidence linkage, or any historical backfill — all explicitly out of
-- scope for MTCS-03.
-- ============================================================

BEGIN;

-- ── Additive support for composite same-Case FKs (AD-03-06) ─────────────
-- Both are non-destructive: id is already globally unique on each table,
-- so id+case_id is trivially unique too. These exist solely because
-- PostgreSQL requires the referenced side of a composite FK to expose a
-- UNIQUE/PK constraint whose column set exactly matches the FK's columns.
ALTER TABLE public.evidence_items
  ADD CONSTRAINT evidence_items_id_case_id_key UNIQUE (id, case_id);

ALTER TABLE public.documents
  ADD CONSTRAINT documents_id_case_id_key UNIQUE (id, case_id);

-- ── Association table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evidence_item_documents (
  evidence_item_id  UUID NOT NULL,
  document_id       UUID NOT NULL,
  case_id           UUID NOT NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  PRIMARY KEY (evidence_item_id, document_id),

  FOREIGN KEY (evidence_item_id, case_id)
    REFERENCES public.evidence_items(id, case_id) ON DELETE CASCADE,

  FOREIGN KEY (document_id, case_id)
    REFERENCES public.documents(id, case_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_item_documents_document_id
  ON public.evidence_item_documents(document_id);

-- ── Historical immutability — independent of role, applies to current+
-- reviewed compositions and to superseded compositions alike ────────────
CREATE OR REPLACE FUNCTION public.reject_immutable_evidence_document_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_target_id UUID := COALESCE(NEW.evidence_item_id, OLD.evidence_item_id);
  v_status    TEXT;
  v_reviewed  TIMESTAMPTZ;
BEGIN
  SELECT currency_status, reviewed_at INTO v_status, v_reviewed
  FROM public.evidence_items
  WHERE id = v_target_id;

  -- FOUND is false when the evidence_items row no longer exists — this
  -- happens exactly when this row's own deletion is itself a downstream
  -- effect of that parent row being cascade-deleted (e.g. whole-Case
  -- teardown via cases -> evidence_items -> evidence_item_documents
  -- ON DELETE CASCADE). That cascade must be allowed through unblocked;
  -- only an existing, still-referenced composition that is superseded or
  -- already reviewed must reject the mutation.
  IF FOUND AND (v_status IS DISTINCT FROM 'current' OR v_reviewed IS NOT NULL) THEN
    RAISE EXCEPTION
      'Evidence composition % is not eligible for document association mutation (currency_status=%, reviewed_at=%)',
      v_target_id, v_status, v_reviewed
      USING ERRCODE = 'EV001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_evidence_item_documents_immutability ON public.evidence_item_documents;
CREATE TRIGGER trg_evidence_item_documents_immutability
  BEFORE INSERT OR DELETE ON public.evidence_item_documents
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_evidence_document_mutation();

-- ── Governed attach (idempotent) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.attach_evidence_document(
  p_evidence_item_id UUID,
  p_document_id      UUID,
  p_created_by       UUID DEFAULT NULL
) RETURNS public.evidence_item_documents
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_evidence public.evidence_items;
  v_document public.documents;
  v_row      public.evidence_item_documents;
BEGIN
  SELECT * INTO v_evidence
  FROM public.evidence_items
  WHERE id = p_evidence_item_id AND currency_status = 'current';

  IF v_evidence.id IS NULL THEN
    RAISE EXCEPTION 'CONFLICT_CURRENT_COMPOSITION' USING ERRCODE = 'EV001';
  END IF;

  IF v_evidence.reviewed_at IS NOT NULL THEN
    RAISE EXCEPTION 'HISTORICAL_COMPOSITION_IMMUTABLE' USING ERRCODE = 'EV001';
  END IF;

  SELECT * INTO v_document
  FROM public.documents
  WHERE id = p_document_id;

  IF v_document.id IS NULL THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'EV006';
  END IF;

  IF v_evidence.case_id IS DISTINCT FROM v_document.case_id THEN
    RAISE EXCEPTION 'CASE_MISMATCH' USING ERRCODE = 'EV004';
  END IF;

  INSERT INTO public.evidence_item_documents (evidence_item_id, document_id, case_id, created_by)
  VALUES (p_evidence_item_id, p_document_id, v_evidence.case_id, p_created_by)
  ON CONFLICT (evidence_item_id, document_id) DO NOTHING;

  SELECT * INTO v_row
  FROM public.evidence_item_documents
  WHERE evidence_item_id = p_evidence_item_id AND document_id = p_document_id;

  RETURN v_row;
END;
$$;

-- ── Governed detach (idempotent) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.detach_evidence_document(
  p_evidence_item_id UUID,
  p_document_id      UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_evidence public.evidence_items;
  v_deleted  INTEGER;
BEGIN
  SELECT * INTO v_evidence
  FROM public.evidence_items
  WHERE id = p_evidence_item_id AND currency_status = 'current';

  IF v_evidence.id IS NULL THEN
    RAISE EXCEPTION 'CONFLICT_CURRENT_COMPOSITION' USING ERRCODE = 'EV001';
  END IF;

  IF v_evidence.reviewed_at IS NOT NULL THEN
    RAISE EXCEPTION 'HISTORICAL_COMPOSITION_IMMUTABLE' USING ERRCODE = 'EV001';
  END IF;

  DELETE FROM public.evidence_item_documents
  WHERE evidence_item_id = p_evidence_item_id AND document_id = p_document_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

-- ── RLS: authenticated SELECT only (mirrors evidence_items); no direct
-- authenticated mutation — attach/detach are the only mutation paths ────
ALTER TABLE public.evidence_item_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_evidence_item_documents"
  ON public.evidence_item_documents FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid())
  );

REVOKE EXECUTE ON FUNCTION public.attach_evidence_document(uuid,uuid,uuid) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.attach_evidence_document(uuid,uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.detach_evidence_document(uuid,uuid) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.detach_evidence_document(uuid,uuid) TO service_role;

COMMIT;
