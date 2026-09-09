-- ============================================================
-- Migration 023: Explicit currency status for case_strategy
-- ============================================================
-- Purpose: applies ADR-010 (docs/AUCIS_ARCHITECTURE_DECISIONS.md)
-- to case_strategy, mirroring the pattern already implemented for
-- agent_intake_analysis (migration 020). `status` (migrations
-- 017/019: proposed/edited/approved/locked/superseded) describes
-- the editorial maturity of ONE row; it does not by itself
-- guarantee that row is still the Blueprint currently authoritative
-- for the case. This migration adds a second, independent
-- dimension for that: currency_status.
--
-- Backfill is deliberately NOT "everything defaults to current".
-- Verified during diagnosis (2026-09-09) that at least one existing
-- case_strategy row (case bb82d396-f1d8-4734-9c0c-516e7e28da5f) is
-- the head of its own version chain (never in-type superseded, i.e.
-- no later case_strategy version exists) but was built from a
-- criterion_assessment_id whose agent_intake_analysis row is itself
-- already currency_status = 'superseded'. Marking that row
-- 'current' would let A3/A4 keep silently consuming a Blueprint
-- built on a superseded Criterion Assessment.
--
-- So a case_strategy row is backfilled as 'current' only if BOTH
-- hold:
--   (a) it is the latest version for its case_id (MAX(version) per
--       case_id — structural, independent of the `status` value,
--       since every version bump has always meant a real
--       supersession, even before this migration existed);
--   (b) either its criterion_assessment_id is NULL (migration 019
--       added that column without backfilling it for older rows,
--       so those rows have no link to cross-validate and are not
--       penalized for a gap that predates them), or the
--       agent_intake_analysis row it references is itself
--       currency_status = 'current'.
--
-- Every row that fails this (including a "latest version" row that
-- fails (b)) is left/set as 'superseded'. A case can therefore end
-- up with NO current case_strategy row at all — that is the
-- correct, intended outcome when its Blueprint no longer matches
-- the current Criterion Assessment, not a bug in this migration.
--
-- Additive only, same idempotent pattern as migrations 004/013/
-- 019/020. Column default is 'current' (matching migration 020's
-- convention exactly for agent_intake_analysis); the UPDATE below
-- immediately demotes every row that does not pass (a)+(b).
-- ============================================================

BEGIN;

ALTER TABLE public.case_strategy
  ADD COLUMN IF NOT EXISTS currency_status TEXT NOT NULL DEFAULT 'current'
    CHECK (currency_status IN ('generated', 'current', 'superseded'));

WITH latest_per_case AS (
  SELECT DISTINCT ON (case_id) id
  FROM public.case_strategy
  ORDER BY case_id, version DESC
),
valid_current AS (
  SELECT cs.id
  FROM public.case_strategy cs
  JOIN latest_per_case lpc ON lpc.id = cs.id
  WHERE cs.criterion_assessment_id IS NULL
     OR EXISTS (
       SELECT 1 FROM public.agent_intake_analysis aia
       WHERE aia.id = cs.criterion_assessment_id
         AND aia.currency_status = 'current'
     )
)
UPDATE public.case_strategy
SET currency_status = 'superseded'
WHERE id NOT IN (SELECT id FROM valid_current);

CREATE INDEX IF NOT EXISTS idx_case_strategy_case_currency
  ON public.case_strategy(case_id, currency_status, created_at DESC);

COMMIT;
