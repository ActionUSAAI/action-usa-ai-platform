-- ============================================================
-- Migration 008: Fix petition_type CHECK constraint
-- ============================================================
-- Purpose: agent_petition_drafts.petition_type was defined with
-- CHECK ('initial','rfe_response'), which duplicates the same axis
-- already covered by build_phase_enum ('initial','rfe'). This
-- migration repurposes petition_type to distinguish the two Motor
-- Abogado letter types (A4_ENGINE_ABOGADO.md): Tipo 0 (Attorney
-- Petition Letter, 'standard') vs Tipo 0b (Consultation Exception
-- Letter, 'consultation_exception'). build_phase remains the sole
-- source of truth for the initial/RFE filing-phase axis.
--
-- Verified before writing: agent_petition_drafts has 0 rows in
-- production; no application code (src/) reads or writes
-- petition_type, agent_petition_drafts, or the old check values.
-- No backfill required.
-- ============================================================

BEGIN;

ALTER TABLE agent_petition_drafts
  DROP CONSTRAINT IF EXISTS agent_petition_drafts_petition_type_check;

ALTER TABLE agent_petition_drafts
  ADD CONSTRAINT agent_petition_drafts_petition_type_check
  CHECK (petition_type IN ('standard', 'consultation_exception'));

COMMIT;
