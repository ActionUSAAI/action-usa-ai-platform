-- ============================================================
-- Migration 036: AUSCIS Intake Intelligence Layer — Stage 1 persistence
-- ============================================================
-- Materializes docs/AUSCIS_INTAKE_INTELLIGENCE_LAYER_FINAL_EXACT_DESIGN.md
-- (CR-CPS-34, SHA256 51928f1d53a6249a8a5117ac8d8b58dac037645314ee658
-- ff83fbfc7d1eef981), authorized TEST-only by CR-CPS-35.
--
-- structured_profile: per-field acquired/discovered beneficiary
-- information (design §5.4). Shape per field:
--   { value, source, confidence, status, confirmed_by, confirmed_at }
-- status in (not_yet_acquired | acquired_unconfirmed |
-- beneficiary_confirmed | conflicting) -- enforced in application code,
-- not a DB constraint, matching the existing module1-15 JSONB pattern
-- (no per-module JSON schema is enforced at the DB layer in this
-- repository; canonical-criteria.ts / Module*.tsx are the source of
-- truth for shape, same precedent applies here).
--
-- coach_conversation: minimum technical persistence for a functional
-- multi-turn Coach in TEST (design §22 -- explicitly an IMPLEMENTATION
-- MECHANISM, not a retention policy; CR-CPS-34 left Coach
-- session-retention policy NOT ESTABLISHED, non-blocking).
--
-- Both additive, nullable-default-empty, following migrations 007/026
-- precedent. No backfill, no destructive change, no RLS change
-- required (existing service_role_intake_all / staff_view_intakes /
-- client_view_own_intake policies cover all columns automatically,
-- same as migration 007).
-- ============================================================

ALTER TABLE public.intake_submissions
  ADD COLUMN IF NOT EXISTS structured_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS coach_conversation JSONB NOT NULL DEFAULT '[]'::jsonb;
