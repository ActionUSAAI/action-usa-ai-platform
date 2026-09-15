-- ============================================================
-- Migration 032: A1 Historical Reliance immutability trigger
-- ============================================================
-- Purpose: migration 029 enforced A1 Historical Reliance immutability
-- (Part XIV, docs/MTCS-06_FINAL_EXACT_DESIGN.md) via a REVOKE-grant/
-- no-application-caller convention only ("no UPDATE grant is issued to
-- any role beyond what CASCADE delete... performs" — Part VIII, literal
-- text). Caught during MTCS-06 TEST-environment validation
-- (supabase/tests/mtcs06-validate.js): a raw service_role UPDATE could
-- still mutate an already-persisted row, unlike this table's own closest
-- sibling, evidence_item_documents (migration 027), which enforces
-- immutability via a role-independent BEFORE INSERT/DELETE trigger. No
-- application code performs such a mutation today (confirmed by reading
-- a1-intake-analyzer/route.ts and src/lib/evidence/evidence-producer.ts)
-- — this migration closes the gap between the documented guarantee and
-- its actual enforcement, matching the sibling table's precedent
-- exactly, rather than leaving it convention-only.
--
-- Both a1_historical_reliance and a1_historical_reliance_documents gain
-- a BEFORE UPDATE OR DELETE trigger that unconditionally rejects UPDATE,
-- and rejects DELETE unless it is a legitimate downstream effect of one
-- of the row's own ON DELETE CASCADE parents already having been removed
-- in the same statement (e.g. whole-Case teardown via
-- cases -> agent_intake_analysis/evidence_items -> a1_historical_reliance
-- -> a1_historical_reliance_documents, or a canonical Document being
-- removed directly) — mirroring evidence_item_documents'
-- reject_immutable_evidence_document_mutation()'s exact FOUND-based
-- technique. a1_historical_reliance has two independent CASCADE parents
-- (agent_intake_analysis, evidence_items); a1_historical_reliance_documents
-- has two independent CASCADE parents (a1_historical_reliance, documents)
-- — the DELETE is allowed through as soon as either parent is already
-- gone.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.reject_immutable_a1_historical_reliance_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_assessment_exists BOOLEAN;
  v_evidence_exists    BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'A1 Historical Reliance is insert-only and immutable once persisted (criterion_assessment_id=%, evidence_item_id=%)',
      OLD.criterion_assessment_id, OLD.evidence_item_id
      USING ERRCODE = 'EV001';
  END IF;

  -- TG_OP = 'DELETE'. FOUND-equivalent (EXISTS) is false for a parent
  -- exactly when this row's own deletion is itself a downstream CASCADE
  -- effect of that parent already being gone — that cascade must be
  -- allowed through unblocked. Only a direct DELETE while both parents
  -- still exist is a genuine, illegitimate mutation attempt.
  SELECT EXISTS (SELECT 1 FROM public.agent_intake_analysis WHERE id = OLD.criterion_assessment_id) INTO v_assessment_exists;
  SELECT EXISTS (SELECT 1 FROM public.evidence_items WHERE id = OLD.evidence_item_id) INTO v_evidence_exists;

  IF v_assessment_exists AND v_evidence_exists THEN
    RAISE EXCEPTION
      'A1 Historical Reliance is insert-only and immutable once persisted (criterion_assessment_id=%, evidence_item_id=%)',
      OLD.criterion_assessment_id, OLD.evidence_item_id
      USING ERRCODE = 'EV001';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_a1_historical_reliance_immutability ON public.a1_historical_reliance;
CREATE TRIGGER trg_a1_historical_reliance_immutability
  BEFORE UPDATE OR DELETE ON public.a1_historical_reliance
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_a1_historical_reliance_mutation();

CREATE OR REPLACE FUNCTION public.reject_immutable_a1_historical_reliance_documents_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_reliance_exists BOOLEAN;
  v_document_exists BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'A1 Historical Reliance Document is insert-only and immutable once persisted (criterion_assessment_id=%, evidence_item_id=%, document_id=%)',
      OLD.criterion_assessment_id, OLD.evidence_item_id, OLD.document_id
      USING ERRCODE = 'EV001';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.a1_historical_reliance
    WHERE criterion_assessment_id = OLD.criterion_assessment_id AND evidence_item_id = OLD.evidence_item_id
  ) INTO v_reliance_exists;
  SELECT EXISTS (SELECT 1 FROM public.documents WHERE id = OLD.document_id) INTO v_document_exists;

  IF v_reliance_exists AND v_document_exists THEN
    RAISE EXCEPTION
      'A1 Historical Reliance Document is insert-only and immutable once persisted (criterion_assessment_id=%, evidence_item_id=%, document_id=%)',
      OLD.criterion_assessment_id, OLD.evidence_item_id, OLD.document_id
      USING ERRCODE = 'EV001';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_a1_historical_reliance_documents_immutability ON public.a1_historical_reliance_documents;
CREATE TRIGGER trg_a1_historical_reliance_documents_immutability
  BEFORE UPDATE OR DELETE ON public.a1_historical_reliance_documents
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_a1_historical_reliance_documents_mutation();

COMMIT;
