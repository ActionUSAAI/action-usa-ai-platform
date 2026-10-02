-- ============================================================
-- CBR Governed Confirmation & Promotion Flow — TEST-ONLY fixture helpers
-- ============================================================
-- NOT PART OF ANY MIGRATION. Never apply to TEST or Production. Intended
-- exclusively for a disposable local Supabase instance (`supabase start`,
-- requires Docker/Podman). Creates a dedicated `cbr_test` schema holding
-- only fixture-construction helpers; drops and recreates it so this file
-- is safely re-runnable.
--
-- UNEXECUTED: written and statically reviewed only. No isolated database
-- was available in the implementing environment. See ../README.md.
-- ============================================================

DROP SCHEMA IF EXISTS cbr_test CASCADE;
CREATE SCHEMA cbr_test;

-- Creates a synthetic auth.users row and returns the resulting profile id.
-- Fixture Auto-Creation Correction: INSERT INTO auth.users fires the
-- REAL, installed on_auth_user_created trigger -> public.handle_new_user()
-- (SECURITY DEFINER, supabase/schema.sql lines 298-317), which itself
-- INSERTs the matching public.profiles row (id, email, full_name, role),
-- with role HARDCODED to the literal 'agent' -- auth.users.raw_user_meta_data
-- has NO effect on role, only on full_name. A separate, explicit
-- `INSERT INTO public.profiles` for the same id therefore collides on
-- the primary key (SQLSTATE 23505, confirmed by real AUSCIS-TEST
-- execution against this suite's finding-02 artifact) and must not be
-- attempted. This helper instead works WITH the trigger: it verifies the
-- trigger-created row actually exists (that function's own exception
-- handler only logs and swallows failures, so this is not assumed), and
-- performs a minimal UPDATE only if the requested role differs from the
-- trigger-created 'agent' default -- the enum cast (profiles.role is
-- public.user_role, not text) now belongs on that UPDATE, not on an
-- INSERT that no longer exists. Every postcondition (row exists, email
-- matches, role matches p_role) is verified explicitly, with a loud
-- RAISE EXCEPTION on any mismatch.
CREATE OR REPLACE FUNCTION cbr_test.make_profile(p_role TEXT DEFAULT 'agent')
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_email TEXT := 'cbr-test-' || v_id || '@example.invalid';
  v_final_email TEXT;
  v_final_role TEXT;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    VALUES (v_id, v_email, '', now(), now(), now(), 'authenticated', 'authenticated')
    ON CONFLICT DO NOTHING;

  SELECT email, role::TEXT INTO v_final_email, v_final_role FROM public.profiles WHERE id = v_id;
  IF v_final_role IS NULL THEN
    RAISE EXCEPTION 'make_profile: on_auth_user_created did not create a public.profiles row for id=% (trigger-created row not found)', v_id;
  END IF;

  IF v_final_role IS DISTINCT FROM p_role THEN
    UPDATE public.profiles SET role = p_role::public.user_role WHERE id = v_id;
    SELECT role::TEXT INTO v_final_role FROM public.profiles WHERE id = v_id;
  END IF;

  IF v_final_email IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'make_profile: postcondition failed -- expected email=%, actual email=% for id=%', v_email, v_final_email, v_id;
  END IF;
  IF v_final_role IS DISTINCT FROM p_role THEN
    RAISE EXCEPTION 'make_profile: postcondition failed -- expected role=%, actual role=% for id=%', p_role, v_final_role, v_id;
  END IF;

  RETURN v_id;
END; $$;

-- Creates a minimal clients row and returns its id. p_assigned_agent_id optional.
-- IC Finding 5.3: clients.first_name/last_name are NOT NULL (schema.sql) -- they can
-- NEVER be NULL for any client, fixture or otherwise. This helper's fixed values
-- ('CBRTest'/'Client') are a deliberate, known, non-NULL fixture identity -- tests
-- must assert against THESE values (or their own explicit override via
-- make_client_with_identity below), never against NULL for these two columns.
-- date_of_birth and middle_name ARE nullable and are correctly left unset (NULL) here.
CREATE OR REPLACE FUNCTION cbr_test.make_client(p_assigned_agent_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.clients (first_name, last_name, assigned_agent_id)
    VALUES ('CBRTest', 'Client', p_assigned_agent_id) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- Explicit variant for tests that need a SPECIFIC, non-default canonical
-- first/last name (e.g. asserting an exact pre-existing value before a CBR
-- call, rather than relying on -- and having to remember -- make_client()'s
-- fixed default). date_of_birth/middle_name remain NULL unless separately
-- UPDATEd by the calling test, exactly as with make_client().
CREATE OR REPLACE FUNCTION cbr_test.make_client_with_identity(p_first_name TEXT, p_last_name TEXT, p_assigned_agent_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.clients (first_name, last_name, assigned_agent_id)
    VALUES (p_first_name, p_last_name, p_assigned_agent_id) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- Creates a minimal case for a client and returns its id.
CREATE OR REPLACE FUNCTION cbr_test.make_case(p_client_id UUID)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.cases (client_id, case_type, title)
    VALUES (p_client_id, 'otro', 'CBR test case') RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- Creates an intake_invitations row (status defaults 'pending') and returns its id.
CREATE OR REPLACE FUNCTION cbr_test.make_invitation(p_case_id UUID, p_client_id UUID, p_email TEXT, p_created_by UUID)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.intake_invitations (token, case_id, client_id, email, created_by)
    VALUES (encode(gen_random_bytes(16), 'hex'), p_case_id, p_client_id, p_email, p_created_by)
    RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- Builds one structured_profile field object for a single CBR field.
-- IC Finding 5.2: p_confirmed_at's default is a FIXED, safely-early sentinel
-- (2000-01-01), NOT now(). Every eligible CBR submission requires
-- confirmed_at <= submitted_at (TX-01/TX-02's eligibility check); many
-- fixtures in this suite deliberately pass historical p_submitted_at values
-- (e.g. '2026-01-0X...') to control event ordering. A default of now()
-- would make confirmed_at track the ACTUAL wall-clock time the test runs,
-- which is virtually always LATER than any such historical submitted_at --
-- silently turning every one of those fixtures into an unintended
-- INELIGIBLE case. The fixed sentinel is guaranteed earlier than every
-- submitted_at value used anywhere in this suite. Callers testing
-- INELIGIBLE specifically (confirmed_at > submitted_at) must pass
-- p_confirmed_at explicitly, making that intent visible in the test itself.
CREATE OR REPLACE FUNCTION cbr_test.sp_field(
  p_value TEXT,
  p_status TEXT DEFAULT 'beneficiary_confirmed',
  p_confirmed_by TEXT DEFAULT 'test-actor',
  p_confirmed_at TIMESTAMPTZ DEFAULT '2000-01-01T00:00:00Z'::TIMESTAMPTZ,
  p_source TEXT DEFAULT 'beneficiary_confirmed',
  p_confirmed_from_source TEXT DEFAULT NULL   -- absent in real data; NULL by design (see migration 040 header)
) RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'value', p_value, 'source', p_source, 'confidence', 1,
    'status', p_status, 'confirmed_by', p_confirmed_by,
    'confirmed_at', CASE WHEN p_confirmed_at IS NULL THEN NULL ELSE to_char(p_confirmed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MSZ') END,
    'confirmed_from_source', p_confirmed_from_source
  ));
$$;

-- Creates an intake_submissions row with an arbitrary structured_profile JSONB
-- and an explicit submitted_at (event-time control for ordering tests).
-- p_fields: jsonb object mapping field_key -> cbr_test.sp_field(...) result.
--
-- Residual correction (fixture timing): p_submitted_at's default is
-- clock_timestamp(), NOT now(). now() is STABLE -- it returns the
-- CALLING TRANSACTION's start time, frozen for the whole transaction --
-- while cbr_internal.cbr_toggle_gate sets admission_window.opened_at
-- from clock_timestamp(), which keeps advancing within a transaction.
-- Every test in this suite that opens a gate and THEN calls
-- make_submission(...) with the default, in the SAME DO block/
-- transaction, would otherwise get submitted_at = transaction-start
-- time -- necessarily EARLIER than opened_at, since the toggle call
-- itself runs partway through that same transaction. That silently
-- forces ADMISSION_BOUNDARY instead of the test's intended outcome,
-- regardless of statement order. clock_timestamp() advances per
-- statement, so a submission created after a toggle (in real call
-- order) genuinely gets a later timestamp than that toggle's own
-- opened_at. Fixtures that deliberately test retrospective-admission
-- rejection are unaffected: they still submit BEFORE the toggle runs
-- (in real call order), which clock_timestamp() preserves exactly as
-- correctly-ineligible, same as before.
CREATE OR REPLACE FUNCTION cbr_test.make_submission(
  p_client_id UUID, p_case_id UUID, p_invitation_id UUID,
  p_fields JSONB, p_submitted_at TIMESTAMPTZ DEFAULT clock_timestamp()
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.intake_submissions (client_id, case_id, invitation_id, structured_profile, submitted_at)
    VALUES (p_client_id, p_case_id, p_invitation_id, p_fields, p_submitted_at)
    RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- cbr_superseded_by_required probe procedures (AC-71) — PL/pgSQL does not
-- allow procedure/function definitions inside a DO block's DECLARE
-- section, so these live here as real, parameterized, top-level procedures.
CREATE OR REPLACE PROCEDURE cbr_test.expect_superseded_by_pass(
  p_case TEXT, p_client_id UUID, p_observation_id UUID, p_admin_id UUID, p_state TEXT, p_superseded_by UUID
) LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_observation_id, candidate_value, decision_state, reviewed_by, reviewed_at, superseded_by_submission_id)
    VALUES (p_client_id, 'DECISION', 'firstName', p_observation_id, 'X', p_state,
      CASE WHEN p_state IN ('approved','rejected') THEN p_admin_id ELSE NULL END,
      CASE WHEN p_state IS NOT NULL AND p_state != 'pending' THEN now() ELSE NULL END,
      p_superseded_by)
    RETURNING id INTO v_id;
  DELETE FROM public.canonical_beneficiary_records WHERE id = v_id;
  RAISE NOTICE '[PASS] % (accepted, as expected)', p_case;
EXCEPTION WHEN check_violation THEN
  RAISE EXCEPTION '[FAIL] %: unexpectedly rejected', p_case;
END; $$;

CREATE OR REPLACE PROCEDURE cbr_test.expect_superseded_by_reject(
  p_case TEXT, p_client_id UUID, p_observation_id UUID, p_admin_id UUID, p_state TEXT, p_superseded_by UUID
) LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_observation_id, candidate_value, decision_state, reviewed_by, reviewed_at, superseded_by_submission_id)
    VALUES (p_client_id, 'DECISION', 'firstName', p_observation_id, 'X', p_state,
      CASE WHEN p_state IN ('approved','rejected') THEN p_admin_id ELSE NULL END,
      CASE WHEN p_state IS NOT NULL AND p_state != 'pending' THEN now() ELSE NULL END,
      p_superseded_by);
  RAISE EXCEPTION '[FAIL] %: expected constraint violation, none raised', p_case;
EXCEPTION WHEN check_violation THEN RAISE NOTICE '[PASS] % (rejected, as expected)', p_case;
END; $$;

-- Assertion helper: raises if actual != expected, otherwise notices PASS.
-- IC Finding 5.4: an accidental expected=NULL/actual=NULL pair (typically a
-- broken fixture whose SELECT INTO found no row, silently leaving a variable
-- NULL) must FAIL here, not warn and continue -- "a broken fixture must
-- fail, not warn." The prior [SUSPECT-PASS] WARNING model is withdrawn as
-- the final safety mechanism. A DELIBERATE NULL-equality check must use
-- assert_null() below instead, which makes the intent explicit in the test
-- itself rather than relying on assert_eq to guess it.
CREATE OR REPLACE FUNCTION cbr_test.assert_eq(p_case TEXT, p_expected TEXT, p_actual TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_expected IS NULL AND p_actual IS NULL THEN
    RAISE EXCEPTION '[FAIL] %: both expected and actual are NULL -- assert_eq() never treats this as a pass (a broken fixture must fail, not warn); use cbr_test.assert_null(case, actual) for a deliberate NULL-equality check', p_case;
  ELSIF p_expected IS DISTINCT FROM p_actual THEN
    RAISE EXCEPTION '[FAIL] % : expected=% actual=%', p_case, p_expected, p_actual;
  ELSE
    RAISE NOTICE '[PASS] % (outcome=%)', p_case, p_actual;
  END IF;
END; $$;

-- Explicit, deliberate NULL-equality assertion -- use this, never assert_eq
-- with a NULL literal, whenever the test genuinely intends to check that a
-- value IS NULL.
CREATE OR REPLACE FUNCTION cbr_test.assert_null(p_case TEXT, p_actual ANYELEMENT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_actual IS NOT NULL THEN
    RAISE EXCEPTION '[FAIL] %: expected NULL, actual=%', p_case, p_actual;
  END IF;
  RAISE NOTICE '[PASS] %(deliberately NULL)', p_case;
END; $$;

-- Fails loudly and immediately if p_value is NULL — use right after
-- obtaining an observation_id/decision_id/outcome before it is used in any
-- downstream query, so a broken fixture cannot silently propagate a NULL
-- into a comparison that might coincidentally also expect NULL.
CREATE OR REPLACE FUNCTION cbr_test.assert_not_null(p_case TEXT, p_value ANYELEMENT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_value IS NULL THEN
    RAISE EXCEPTION '[FAIL] %: required value is NULL (fixture/setup did not produce the expected record)', p_case;
  END IF;
  RAISE NOTICE '[PASS] %(not-null)', p_case;
END; $$;

-- Fails loudly if the given id does not resolve to a row of the expected
-- record_type in canonical_beneficiary_records — confirms "the fixture
-- value actually reached the intended record", not merely that some id
-- was returned.
CREATE OR REPLACE FUNCTION cbr_test.assert_record_type(p_case TEXT, p_id UUID, p_expected_type TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_actual TEXT;
BEGIN
  SELECT record_type INTO v_actual FROM public.canonical_beneficiary_records WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[FAIL] %: id % does not exist in canonical_beneficiary_records', p_case, p_id;
  END IF;
  IF v_actual IS DISTINCT FROM p_expected_type THEN
    RAISE EXCEPTION '[FAIL] %: id % has record_type=% expected=%', p_case, p_id, v_actual, p_expected_type;
  END IF;
  RAISE NOTICE '[PASS] %(record_type=%)', p_case, v_actual;
END; $$;
