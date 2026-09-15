-- ============================================================
-- Migration 034: QA Engine runs (bounded MVP)
-- ============================================================
-- Purpose: materializes the frozen QA Engine Final Exact Design
-- (docs/QA_ENGINE_FINAL_EXACT_DESIGN.md, SHA256
-- 33d5f7f07cebfd1acc261e66ea1d10e4f2298671b3c0271a8f0ef8ab678510ab) —
-- an additive, immutable persistence surface for explicit, staff-
-- triggered QA runs. Bounded MVP only: criterion documentary coverage
-- (dominant_criteria/supporting_criteria vs. agent_recommendation_
-- letters/agent_petition_drafts) + Blueprint currency precondition
-- (case_strategy.currency_status). Read-only over case_strategy,
-- agent_intake_analysis (transitively), agent_recommendation_letters,
-- agent_petition_drafts — none of those tables are modified here.
--
-- findings JSONB carries the complete evaluated-input manifest
-- (blueprint_snapshot, evaluated_letters, evaluated_petition_drafts,
-- missing_criteria, current_blueprint_found) per the design's §9a
-- targeted provenance reconciliation — not only failing criteria.
--
-- Same-Case invariant (SC-02 pattern, mirrors MTCS-08's resolved
-- design): trg_qa_runs_same_case, BEFORE INSERT only — qa_runs rows
-- are never updated, so no UPDATE OF trigger is needed here the way
-- MTCS-08's documents.originating_recommendation_letter_id required.
--
-- Immutability (CR-IA-01, §9b of the design): trg_qa_runs_immutability
-- reuses migration 032's a1_historical_reliance pattern verbatim in
-- shape — a role-independent BEFORE UPDATE OR DELETE trigger, since
-- RLS alone does not protect against the service-role write plane the
-- QA service itself uses (the same gap migration 032 already found and
-- fixed once for a1_historical_reliance's original REVOKE/GRANT-only
-- protection).
--
-- No backfill: new table, no pre-existing data. Does not reopen
-- MTCS-01–08. Does not modify case_strategy, agent_intake_analysis,
-- agent_recommendation_letters, or agent_petition_drafts.
-- ============================================================

BEGIN;

CREATE TABLE public.qa_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  case_strategy_id  UUID REFERENCES public.case_strategy(id) ON DELETE SET NULL,
  executed_by       UUID NOT NULL REFERENCES public.profiles(id),
  executed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  status            TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed')),
  findings          JSONB NOT NULL
);

CREATE INDEX idx_qa_runs_case_id ON public.qa_runs(case_id, executed_at DESC);

ALTER TABLE public.qa_runs ENABLE ROW LEVEL SECURITY;

-- Mirrors migration 017's staff_select_case_strategy exactly.
CREATE POLICY "staff_select_qa_runs"
  ON public.qa_runs
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

-- ── Same-Case invariant ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_qa_run_same_case()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_bp_case_id UUID;
BEGIN
  IF NEW.case_strategy_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT case_id INTO v_bp_case_id
  FROM public.case_strategy
  WHERE id = NEW.case_strategy_id;

  IF v_bp_case_id IS DISTINCT FROM NEW.case_id THEN
    RAISE EXCEPTION 'qa_runs.case_id (%) must match case_strategy case_id (%)', NEW.case_id, v_bp_case_id
      USING ERRCODE = 'QA001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_qa_runs_same_case
  BEFORE INSERT ON public.qa_runs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_qa_run_same_case();

-- ── Immutability (CR-IA-01) — reuses migration 032's exact shape ──
CREATE OR REPLACE FUNCTION public.reject_immutable_qa_run_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_case_exists BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'qa_runs is insert-only and immutable once persisted (id=%)', OLD.id
      USING ERRCODE = 'QA002';
  END IF;

  -- TG_OP = 'DELETE'. Allowed only as a legitimate downstream effect of
  -- the row's own cases ON DELETE CASCADE parent already being removed
  -- in the same statement (whole-Case teardown).
  SELECT EXISTS (SELECT 1 FROM public.cases WHERE id = OLD.case_id) INTO v_case_exists;
  IF v_case_exists THEN
    RAISE EXCEPTION 'qa_runs is insert-only and immutable once persisted (id=%)', OLD.id
      USING ERRCODE = 'QA002';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_qa_runs_immutability
  BEFORE UPDATE OR DELETE ON public.qa_runs
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_qa_run_mutation();

COMMIT;
