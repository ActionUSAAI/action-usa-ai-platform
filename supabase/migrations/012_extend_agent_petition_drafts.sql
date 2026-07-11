-- ============================================================
-- Migration 012: Extend agent_petition_drafts for A4 Motor Abogado
-- ============================================================
-- Purpose: agent_petition_drafts existed since migration 002 and
-- had its petition_type CHECK corrected in migration 008
-- ('standard' | 'consultation_exception'), but had no code
-- reading or writing it (0 rows in production). This migration
-- adds the columns needed to persist the structured output
-- contract of A4's Motor Abogado
-- (docs/A4_ENGINE_ABOGADO.md v1.3): Tipo 0 (Attorney Petition
-- Letter) and Tipo 0b (Consultation Exception Letter).
--
-- New columns:
--   blocks              - JSONB, preserves the exact block shape
--                          of whichever letter type produced it
--                          (7 blocks for Tipo 0, 4 movements for
--                          Tipo 0b) rather than flattening into
--                          the pre-existing cover_letter /
--                          criteria_sections / evidence_checklist
--                          columns, which do not match A4's
--                          output contract shape.
--   petition_strategy   - Tipo 0 only ('multiCriteria' |
--                          'singleAchievement'); NULL for Tipo 0b,
--                          which has no route concept.
--   docx_path           - Storage path of the generated .docx,
--                          same pattern as
--                          agent_recommendation_letters.docx_path
--                          (migration 010).
--
-- Does not touch petition_type, build_phase, or any constraint
-- from migration 008 — additive only.
-- ============================================================

BEGIN;

ALTER TABLE public.agent_petition_drafts
  ADD COLUMN blocks JSONB NULL,
  ADD COLUMN petition_strategy TEXT NULL
    CHECK (petition_strategy IN ('multiCriteria', 'singleAchievement')),
  ADD COLUMN docx_path TEXT NULL;

COMMIT;
