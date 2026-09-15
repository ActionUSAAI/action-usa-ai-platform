-- ============================================================
-- Migration 033: GWP Re-entry lineage + same-Case invariant (MTCS-08)
-- ============================================================
-- Purpose: materializes the approved MTCS-08 Final Exact Design
-- (docs/MTCS-08_FINAL_EXACT_DESIGN.md, SHA256
-- ae73ab1e4bf4e00e9cfcc0b1fff92073f0fa301d505848e85434d4a6dc31a5dd) —
-- an additive, nullable lineage reference from a canonical Case
-- Document (documents.id, MTCS-02A) back to the A3 Generated Work
-- Product it was returned against (agent_recommendation_letters.id),
-- preserving provenance "where known" per Evidence Item Contract V2
-- §47, plus a database-level same-Case invariant (§11 of the design,
-- selected model SC-02 — a BEFORE trigger, not a composite FK: a
-- composite FK's ON DELETE SET NULL would null every column in the
-- FK, including the NOT NULL case_id, breaking the frozen rule that a
-- returned Case Document survives deletion of its originating GWP).
--
-- ON DELETE SET NULL is single-column only (originating_recommendation_
-- letter_id) — documents.case_id is never touched by this FK.
--
-- No RLS delta: public.documents carries three pre-existing RLS
-- policies from schema.sql ("Staff sube/actualiza/ve documentos" —
-- INSERT/UPDATE/SELECT), predating and outside the numbered MTCS
-- migration sequence (correction: the Final Exact Design's repository
-- constraint map grepped only supabase/migrations/*.sql, not
-- schema.sql, and understated this). No new policy is introduced or
-- required — this migration's own write path (registerCanonicalDocument,
-- called via a service-role client, exactly like every other existing
-- caller of that helper) already bypasses RLS by design, matching how
-- every other write to documents in this repository operates today.
-- Authorization for the new route remains authorizeCaseStaff at the
-- application layer, unaffected by this correction.
--
-- No backfill: provenance is preserved "where known", never
-- reconstructed speculatively. Every pre-existing documents row keeps
-- originating_recommendation_letter_id = NULL.
--
-- Does not reopen MTCS-01–07. Does not modify agent_recommendation_
-- letters, evidence_items, evidence_item_documents, or any closed
-- MTCS's own tables/triggers.
-- ============================================================

BEGIN;

-- ── Lineage column ───────────────────────────────────────────────
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS originating_recommendation_letter_id UUID
    REFERENCES public.agent_recommendation_letters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_originating_recommendation_letter_id
  ON public.documents(originating_recommendation_letter_id);

-- ── Same-Case DB invariant (SC-02, design §11) ───────────────────
-- Mirrors migration 027's function-security precedent for this exact
-- class of guard (SECURITY INVOKER, search_path pinned).
CREATE OR REPLACE FUNCTION public.enforce_gwp_document_same_case()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_gwp_case_id UUID;
BEGIN
  IF NEW.originating_recommendation_letter_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT case_id INTO v_gwp_case_id
  FROM public.agent_recommendation_letters
  WHERE id = NEW.originating_recommendation_letter_id;

  IF v_gwp_case_id IS NULL THEN
    RAISE EXCEPTION 'originating_recommendation_letter_id % does not reference an existing agent_recommendation_letters row', NEW.originating_recommendation_letter_id
      USING ERRCODE = 'GW001';
  END IF;

  IF v_gwp_case_id IS DISTINCT FROM NEW.case_id THEN
    RAISE EXCEPTION 'documents.case_id (%) must match originating GWP case_id (%) for MTCS-08 lineage', NEW.case_id, v_gwp_case_id
      USING ERRCODE = 'GW002';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documents_gwp_same_case ON public.documents;
CREATE TRIGGER trg_documents_gwp_same_case
  BEFORE INSERT OR UPDATE OF originating_recommendation_letter_id, case_id
  ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_gwp_document_same_case();

COMMIT;
