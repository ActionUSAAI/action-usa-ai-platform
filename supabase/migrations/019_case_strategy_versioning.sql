-- ============================================================
-- Migration 019: Real versioning and full lifecycle for case_strategy
-- ============================================================
-- Purpose: implements the version/superseded_by pattern already
-- used by agent_intake_analysis (migration 002), and expands
-- status from the current two values (proposed/approved) to the
-- full five-state lifecycle already defined in
-- A5_CASE_BLUEPRINT_SPECIFICATION_V1.md and
-- AUCIS_BLUEPRINT_CONTRACT_V1.md: proposed -> edited -> approved
-- -> locked -> superseded.
--
-- Closes the "Nota de implementación pendiente" already documented
-- in AUCIS_CRITERION_ASSESSMENT_CONTRACT_V1.md's sibling gap for
-- case_strategy, and is the first concrete step of Capacidad 1
-- (Core Legal Decision Pipeline) in
-- AUCIS_IMPLEMENTATION_ROADMAP_PHASE_2.md.
--
-- Additive only, consistent with migrations 004/013's idempotent
-- pattern: no existing column is dropped or renamed. Existing rows
-- default to version = 1, superseded_by = NULL (all currently
-- current), and their existing status values (proposed/approved)
-- remain valid under the expanded CHECK.
-- ============================================================

BEGIN;

ALTER TABLE public.case_strategy
  DROP CONSTRAINT IF EXISTS case_strategy_status_check;

ALTER TABLE public.case_strategy
  ADD CONSTRAINT case_strategy_status_check
    CHECK (status IN ('proposed', 'edited', 'approved', 'locked', 'superseded'));

ALTER TABLE public.case_strategy
  ADD COLUMN IF NOT EXISTS version        INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_by  UUID REFERENCES public.case_strategy(id),
  ADD COLUMN IF NOT EXISTS criterion_assessment_id UUID REFERENCES public.agent_intake_analysis(id);

CREATE INDEX IF NOT EXISTS idx_case_strategy_case_status
  ON public.case_strategy(case_id, status, created_at DESC);

COMMIT;
