-- ============================================================
-- Migration 035: Human Review Gate — Approved-to-Sent delivery
-- ============================================================
-- Purpose: materializes the reconciled Final Exact Design
-- (docs/HUMAN_REVIEW_GATE_APPROVED_TO_SENT_FINAL_EXACT_DESIGN.md,
-- SHA256 3b18a26d55110440220fe71cbcbed0e70101cb32cfa13cb0a0cf0265f63dba7d).
--
-- sent_by / sent_at record staff confirmation that an approved
-- Generated Work Product was delivered externally. They do not
-- represent AUSCIS dispatch and do not change
-- agent_recommendation_letters.status (D-REC-01) — status remains
-- 'approved' permanently after delivery is recorded, so
-- src/lib/documents/register-returned-gwp.ts's existing eligibility
-- check requires no modification.
--
-- Additive only: no backfill, no status rewrite, no letter_status_enum
-- change (the schema-present 'sent' member remains permanently unused
-- by this design).
-- ============================================================

BEGIN;

ALTER TABLE public.agent_recommendation_letters
  ADD COLUMN sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN sent_at TIMESTAMPTZ;

COMMIT;
