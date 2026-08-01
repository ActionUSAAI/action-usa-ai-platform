-- ============================================================
-- Migration 020: Explicit currency status for agent_intake_analysis
-- ============================================================
-- Purpose: agent_intake_analysis already has version/superseded_by
-- since its original design (migration 002), but neither column
-- was ever populated by a1-intake-analyzer/route.ts — confirmed
-- during Fase 2 implementation (2026-08-01). Determining "which
-- version is current" today would require inferring it via
-- created_at DESC or superseded_by IS NULL, neither of which
-- represents the Generated -> Current -> Superseded lifecycle
-- already defined in AUCIS_CRITERION_ASSESSMENT_CONTRACT_V1.md as
-- an explicit state of the entity.
--
-- This is a distinct concept from the existing `status` column
-- (added in migration 004: 'completed'/'failed', describing the
-- outcome of the A1 execution itself) — this new column describes
-- the CURRENCY of the row as a Criterion Assessment, independent
-- of whether its generation succeeded. A row can be
-- status = 'completed' (migration 004) and
-- currency_status = 'superseded' (this migration) at the same
-- time — two different questions about the same row.
--
-- Additive only, same idempotent pattern as migrations 004/013/019.
-- Existing rows default to 'current' (each one was, at the time it
-- was written, the only version for its case — none has ever been
-- explicitly superseded by code, consistent with the version/
-- superseded_by gap this migration closes).
-- ============================================================

BEGIN;

ALTER TABLE public.agent_intake_analysis
  ADD COLUMN IF NOT EXISTS currency_status TEXT NOT NULL DEFAULT 'current'
    CHECK (currency_status IN ('generated', 'current', 'superseded'));

CREATE INDEX IF NOT EXISTS idx_intake_analysis_case_currency
  ON public.agent_intake_analysis(case_id, currency_status, created_at DESC);

COMMIT;
