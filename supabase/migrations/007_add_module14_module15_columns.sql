-- ══════════════════════════════════════════════════════════════════════════
-- Migration 007: Add module14 and module15 columns to intake_submissions
-- ══════════════════════════════════════════════════════════════════════════
--
-- These columns store client intake data for:
--   module14 — Petitioner information (company, individual, or agent)
--   module15 — Consultative opinion and O-2 companions
--
-- Column type matches module1–module12: JSONB NOT NULL DEFAULT '{}'::jsonb
--
-- RLS: no changes required — existing row-level policies (service_role_intake_all,
-- staff_view_intakes, client_view_own_intake) cover all columns automatically.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.intake_submissions
  ADD COLUMN IF NOT EXISTS module14 JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS module15 JSONB NOT NULL DEFAULT '{}'::jsonb;
