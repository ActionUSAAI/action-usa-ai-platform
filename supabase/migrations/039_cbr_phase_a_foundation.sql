-- ============================================================
-- Migration 039: Canonical Beneficiary Record — Phase A Foundation
-- ============================================================
-- Purpose: materializes the sole schema/security foundation authorized
-- by the approved CBR Governance Design, CBR Implementation
-- Feasibility Review, CBR Final Exact Implementation Design, the
-- Final Independent MR, the MR-01/MR-02 Corrective Reconciliation, and
-- the MR-01 Internal Mutation Boundary Final Correction. This is
-- PHASE A — FOUNDATION ONLY. It installs zero live canonical-mutation
-- workflow: no application route in this codebase calls any object
-- created here. record_canonical_confirmation, resolve_g3_decision,
-- T3 wiring, and the G3 staff review surface are explicitly NOT part
-- of this migration and remain unauthorized.
--
-- Canonical ownership model (unchanged, pre-existing): clients is the
-- current canonical owner of beneficiary identity facts;
-- intake_submissions is the immutable case snapshot; Structured
-- Profile is acquisition/confirmation staging. canonical_beneficiary_
-- records is the new candidate/decision/history layer — it is not,
-- and must never become, a competing canonical truth owner.
--
-- Field registry (14 fields; G1=low-risk contact, G2=changeable
-- personal, G3=core identity, per CBR governance):
--   G1: email, whatsapp
--   G2: countryOfResidence, cityOfResidence, foreignStreet,
--       foreignProvince, foreignPostalCode, foreignCountry
--   G3: firstName, lastName, middleName, dateOfBirth, countryOfBirth,
--       nationality
-- cityOfResidence maps to the new clients.current_city column, NOT
-- clients.city — clients.city (schema.sql) is proven, by direct
-- source inspection of clientes/nuevo/page.tsx, to be a staff-entered
-- city component of a US-only mailing address (paired with a
-- US-states-only dropdown and US ZIP formatting), structurally
-- incompatible with a beneficiary's current city of residence, which
-- must support non-US locations. clients.city is untouched by this
-- migration and carries no CBR meaning. clients.country_of_origin is,
-- for the same previously-established reason, likewise untouched and
-- distinct from the new country_of_birth/country_of_residence columns.
--
-- Registry authority split (two distinct, each-singular
-- responsibilities — not one, and not three):
--   cbr_internal.cbr_resolve_field       — sole semantic recognition
--                                           + G1/G2/G3 class authority.
--   cbr_internal.cbr_apply_clients_mutation — sole physical field_key
--                                           -> literal clients UPDATE
--                                           mapping. No dynamic SQL,
--                                           no caller-provided column
--                                           identifier anywhere.
-- Both functions live in the new cbr_internal schema, which is
-- deliberately NOT added to supabase/config.toml's [api].schemas list
-- (left unchanged: ["public","graphql_public"]) — this is the
-- governing control that keeps both functions outside PostgREST's
-- REST/RPC surface entirely, in addition to the standard
-- REVOKE/GRANT-service_role-only pattern already used by every
-- existing governed function in this codebase (submit_intake_for_
-- invitation, migration 037; the evidence_items functions, migration
-- 024; incorporate_structured_profile_evidence, migration 038).
-- Neither function is called by this migration or by any application
-- code — they exist as installed, dormant, internal-only primitives
-- pending Phase B/C authorization.
--
-- canonical_beneficiary_records: exactly 4 record_type values
-- (CANDIDATE_OBSERVED, CONFLICT_DETECTED, DECISION, CHANGE_REALIZED —
-- not the six-value model originally proposed and later corrected).
-- DECISION rows carry a single mutable decision_state
-- (pending|approved|rejected), mirroring evidence_items'
-- verification_condition pattern exactly (migration 024) rather than
-- representing decision outcomes as distinct record types. Every
-- other record type is immutable from creation. RLS is enabled with a
-- staff-only SELECT policy (mirroring evidence_items'
-- staff_select_evidence_items exactly, scoped via clients.
-- assigned_agent_id); no INSERT/UPDATE/DELETE policy exists for any
-- application role — all future mutation is exclusively through
-- governed, service_role-only functions (none of which are created by
-- this migration).
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- A. Additive clients columns (all nullable; NULL = NOT ESTABLISHED;
--    no default, no backfill, prospective only)
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS country_of_residence TEXT,
  ADD COLUMN IF NOT EXISTS current_city TEXT,
  ADD COLUMN IF NOT EXISTS foreign_street TEXT,
  ADD COLUMN IF NOT EXISTS foreign_province TEXT,
  ADD COLUMN IF NOT EXISTS foreign_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS foreign_country TEXT,
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS country_of_birth TEXT,
  ADD COLUMN IF NOT EXISTS nationality TEXT;

-- ────────────────────────────────────────────────────────────────
-- B. canonical_beneficiary_records — CBR persistence foundation
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.canonical_beneficiary_records (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id              UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,

  record_type            TEXT NOT NULL,
  field_key              TEXT NOT NULL,

  source_case_id         UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  source_submission_id   UUID REFERENCES public.intake_submissions(id) ON DELETE SET NULL,
  source_document_id     UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  origin                 TEXT,

  candidate_value        TEXT,
  prior_value            TEXT,
  new_value              TEXT,
  authority_basis        TEXT,

  decision_state         TEXT,
  reviewed_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at            TIMESTAMPTZ,
  decision_reason        TEXT,
  expected_prior_value   TEXT,

  related_decision_id    UUID REFERENCES public.canonical_beneficiary_records(id) ON DELETE SET NULL,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cbr_field_key_not_blank CHECK (btrim(field_key) <> ''),
  CONSTRAINT cbr_record_type_values CHECK (
    record_type IN ('CANDIDATE_OBSERVED', 'CONFLICT_DETECTED', 'DECISION', 'CHANGE_REALIZED')
  ),
  CONSTRAINT cbr_decision_state_values CHECK (
    decision_state IS NULL OR decision_state IN ('pending', 'approved', 'rejected')
  ),
  CONSTRAINT cbr_decision_state_scope CHECK (
    (record_type = 'DECISION' AND decision_state IS NOT NULL)
    OR (record_type <> 'DECISION' AND decision_state IS NULL)
  ),
  CONSTRAINT cbr_decision_terminal_requires_review CHECK (
    decision_state IS NULL OR decision_state = 'pending'
    OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS cbr_client_field_idx
  ON public.canonical_beneficiary_records (client_id, field_key);

-- Idempotency: one CANDIDATE_OBSERVED per (client, field, submission).
CREATE UNIQUE INDEX IF NOT EXISTS cbr_candidate_observed_unique
  ON public.canonical_beneficiary_records (client_id, field_key, source_submission_id)
  WHERE record_type = 'CANDIDATE_OBSERVED';

-- Idempotency: at most one open (pending) DECISION per (client, field).
CREATE UNIQUE INDEX IF NOT EXISTS cbr_decision_pending_unique
  ON public.canonical_beneficiary_records (client_id, field_key)
  WHERE record_type = 'DECISION' AND decision_state = 'pending';

-- ── RLS: staff SELECT only; no direct authenticated/anon mutation ──────
ALTER TABLE public.canonical_beneficiary_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_canonical_beneficiary_records"
  ON public.canonical_beneficiary_records FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR client_id IN (SELECT id FROM public.clients WHERE assigned_agent_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────────
-- C. cbr_internal — non-PostgREST-exposed schema for CBR primitives
--    (config.toml [api].schemas is NOT modified by this migration;
--    it remains exactly ["public","graphql_public"])
-- ────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS cbr_internal;

REVOKE ALL ON SCHEMA cbr_internal FROM PUBLIC;
GRANT USAGE ON SCHEMA cbr_internal TO service_role;

-- ── cbr_internal.cbr_resolve_field: sole semantic recognition/class ────
CREATE OR REPLACE FUNCTION cbr_internal.cbr_resolve_field(p_field_key TEXT)
RETURNS TABLE(recognized BOOLEAN, field_class TEXT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = cbr_internal, public, pg_temp AS $$
DECLARE
  v_class TEXT;
BEGIN
  v_class := CASE p_field_key
    WHEN 'email'              THEN 'G1'
    WHEN 'whatsapp'            THEN 'G1'
    WHEN 'countryOfResidence'  THEN 'G2'
    WHEN 'cityOfResidence'     THEN 'G2'
    WHEN 'foreignStreet'       THEN 'G2'
    WHEN 'foreignProvince'     THEN 'G2'
    WHEN 'foreignPostalCode'   THEN 'G2'
    WHEN 'foreignCountry'      THEN 'G2'
    WHEN 'firstName'           THEN 'G3'
    WHEN 'lastName'            THEN 'G3'
    WHEN 'middleName'          THEN 'G3'
    WHEN 'dateOfBirth'         THEN 'G3'
    WHEN 'countryOfBirth'      THEN 'G3'
    WHEN 'nationality'         THEN 'G3'
    ELSE NULL
  END;

  RETURN QUERY SELECT (v_class IS NOT NULL), v_class;
END;
$$;

REVOKE ALL ON FUNCTION cbr_internal.cbr_resolve_field(text) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION cbr_internal.cbr_resolve_field(text) TO service_role;

-- ── cbr_internal.cbr_apply_clients_mutation: sole physical mapping ─────
CREATE OR REPLACE FUNCTION cbr_internal.cbr_apply_clients_mutation(
  p_client_id  UUID,
  p_field_key  TEXT,
  p_new_value  TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY INVOKER SET search_path = cbr_internal, public, pg_temp AS $$
BEGIN
  CASE p_field_key
    WHEN 'email' THEN
      UPDATE public.clients SET email = p_new_value WHERE id = p_client_id;
    WHEN 'whatsapp' THEN
      UPDATE public.clients SET whatsapp = p_new_value WHERE id = p_client_id;
    WHEN 'countryOfResidence' THEN
      UPDATE public.clients SET country_of_residence = p_new_value WHERE id = p_client_id;
    WHEN 'cityOfResidence' THEN
      UPDATE public.clients SET current_city = p_new_value WHERE id = p_client_id;
    WHEN 'foreignStreet' THEN
      UPDATE public.clients SET foreign_street = p_new_value WHERE id = p_client_id;
    WHEN 'foreignProvince' THEN
      UPDATE public.clients SET foreign_province = p_new_value WHERE id = p_client_id;
    WHEN 'foreignPostalCode' THEN
      UPDATE public.clients SET foreign_postal_code = p_new_value WHERE id = p_client_id;
    WHEN 'foreignCountry' THEN
      UPDATE public.clients SET foreign_country = p_new_value WHERE id = p_client_id;
    WHEN 'firstName' THEN
      UPDATE public.clients SET first_name = p_new_value WHERE id = p_client_id;
    WHEN 'lastName' THEN
      UPDATE public.clients SET last_name = p_new_value WHERE id = p_client_id;
    WHEN 'middleName' THEN
      UPDATE public.clients SET middle_name = p_new_value WHERE id = p_client_id;
    WHEN 'dateOfBirth' THEN
      UPDATE public.clients SET date_of_birth = p_new_value::DATE WHERE id = p_client_id;
    WHEN 'countryOfBirth' THEN
      UPDATE public.clients SET country_of_birth = p_new_value WHERE id = p_client_id;
    WHEN 'nationality' THEN
      UPDATE public.clients SET nationality = p_new_value WHERE id = p_client_id;
    ELSE
      RETURN FALSE;
  END CASE;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION cbr_internal.cbr_apply_clients_mutation(uuid,text,text) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION cbr_internal.cbr_apply_clients_mutation(uuid,text,text) TO service_role;

COMMIT;
