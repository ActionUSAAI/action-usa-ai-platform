-- ============================================================
-- IC Targeted Correction 3 of 6 — single-session fixture corrections
-- (manual AUSCIS-TEST verification artifact — follow-up revision)
-- ============================================================
-- Governing authority: approved CBR Consolidated Design.
--
-- TARGET: AUSCIS-TEST (the designated modifying-test environment). ACTIONUSA AI
-- is the principal project and must NEVER be targeted or modified by this file.
--
-- PREREQUISITE: the reviewed migration 040 (unchanged functional logic --
-- Finding 3 corrects test fixtures only, never TX-01..05 themselves) must
-- ALREADY be installed on the target database. This file does not install
-- it. Step 0 below checks that the required objects EXIST before creating
-- any fixture, and fails immediately, with a clear message, if they do not.
--
-- WHAT PASSING THIS ARTIFACT DOES AND DOES NOT DEMONSTRATE: Step 0's check,
-- and this file's execution in general, confirm only that the named
-- objects exist under the expected signatures and that the SPECIFIC
-- behaviors each block actually exercises produce the recorded PASS
-- results. Neither proves that the installed function BODIES are
-- byte-identical to the reviewed Findings 1/2 source -- an installed
-- function could coincidentally produce the same outcomes tested here
-- while differing in code not exercised by these particular cases. Source
-- identity (e.g. comparing pg_get_functiondef() output against the
-- reviewed migration text) is a separate, distinct verification this
-- artifact does not perform and does not claim to perform.
--
-- SCOPE: this artifact now provides self-contained manual coverage for
-- every corrected case identified in the accepted affected-case table,
-- grouped by scenario, mapped to explicit assertions -- not a small
-- representative subset. See the case-to-block coverage table in this
-- round's README for the exact mapping. Two corrected cases are
-- deliberately NOT included, with reasons stated inline at their would-be
-- location below: AC-32(b) (BLOCKED -- requires disabling a trigger, see
-- Block C) and AC-49/AC-52 (never required manual re-verification here --
-- AC-49 is a constraint-only proof whose correctness never depended on the
-- field-key change, and AC-52's own integrity check never reads canonical
-- at all, so neither was actually broken by the defect Finding 3 corrects;
-- both remain, unchanged in substance, in 01-single-session-tests.sql).
--
-- SELF-CONTAINED: every helper is defined here, scoped to `pg_temp` (the
-- current session's own private, automatically-cleaned-up temp schema --
-- never a shared, persistent, or collision-risking schema name). Does NOT
-- assume any `cbr_test` schema exists, does NOT create, drop, or overwrite
-- one, and has no dependency on 00-helpers.sql, 01-single-session-tests.sql,
-- or any other file.
--
-- TRANSACTION / ROLLBACK BEHAVIOR (read before running):
--   - Run this file's statements IN ORDER, in ONE session, inside the
--     explicit BEGIN below. There is no intermediate COMMIT anywhere.
--   - EVERYTHING -- helper creation, fixtures, gate toggles, assertions --
--     happens inside that one transaction, and the file ends with an
--     explicit ROLLBACK. Nothing persists after this file finishes: no
--     gate is left enabled, no fixture row survives, and no pre-existing
--     AUSCIS-TEST data of any kind is touched.
--   - IF EXECUTION FAILS PARTWAY (a raised error before reaching the final
--     ROLLBACK statement): your session's transaction is left OPEN and
--     ABORTED. Every further statement will itself immediately error with
--     "current transaction is aborted, commands ignored until end of
--     transaction block" until the transaction is explicitly ended. Run
--         ROLLBACK;
--     as its own, separate statement right away. ROLLBACK is the correct,
--     unambiguous statement for this situation and always safely discards
--     everything this file did. (PostgreSQL treats COMMIT issued against
--     an already-aborted transaction as equivalent to ROLLBACK too -- an
--     aborted transaction can never actually commit any change -- but
--     ROLLBACK is the statement that says what you mean; do not rely on
--     COMMIT's behavior here instead of using ROLLBACK.)
--   - No trigger is disabled and no constraint is weakened anywhere in
--     this file. No existing application record is modified -- every row
--     touched is created fresh by this file's own fixtures.
--
-- RESULTS: every assertion is recorded as a row in a temporary results
-- table (not merely a RAISE NOTICE), and a full SELECT over that table is
-- returned before the final hard-failure check runs. Read that result grid
-- if your SQL client displays it. Separately, and not depending on the
-- grid being visible: the final hard-failure check (just before ROLLBACK)
-- aggregates every FAILing row's block/assertion/expected/actual directly
-- INTO its own RAISE EXCEPTION message text, so a failed run is
-- diagnosable from the exception alone even if an earlier SELECT result
-- was not displayed by your client.
--
-- EXPECTED RESULT: if the reviewed migration 040 is installed and its
-- installed function bodies behave as the reviewed source describes, every
-- row in the final result set reads status='PASS' and the final
-- hard-failure check does not raise (the transaction still ends in
-- ROLLBACK either way -- this file never intends to persist anything).
--
-- UNEXECUTED here: written and statically reviewed (traced against the
-- actual corrected function branches) only. No PostgreSQL execution
-- occurred in the implementing environment (no local Docker/Podman/psql
-- available). NOT run against AUSCIS-TEST by Code -- Alex executes this
-- manually and returns results for review, per the owner workflow. No SQL
-- PASS is claimed here.
-- ============================================================

BEGIN;

-- ── Step 0: prerequisite object-existence check ─────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.cbr_tx01_realize_g1g2(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: public.cbr_tx01_realize_g1g2(uuid,text) does not exist. Install the reviewed migration 040 on this database before running this artifact. Aborting before creating any fixture.';
  END IF;
  IF to_regprocedure('public.cbr_tx02_observe_g3(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: public.cbr_tx02_observe_g3(uuid,text) does not exist.';
  END IF;
  IF to_regprocedure('public.cbr_tx03_open_g3_review(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: public.cbr_tx03_open_g3_review(uuid,uuid) does not exist.';
  END IF;
  IF to_regprocedure('public.cbr_tx04_approve_g3(uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: public.cbr_tx04_approve_g3(uuid,uuid,text) does not exist.';
  END IF;
  IF to_regprocedure('cbr_internal.cbr_toggle_gate(text,boolean,uuid)') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: cbr_internal.cbr_toggle_gate(text,boolean,uuid) does not exist.';
  END IF;
  IF to_regclass('cbr_internal.cbr_field_gate_state') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: cbr_internal.cbr_field_gate_state does not exist.';
  END IF;
  IF to_regclass('cbr_internal.cbr_field_admission_window') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: cbr_internal.cbr_field_admission_window does not exist.';
  END IF;
  IF to_regclass('cbr_internal.cbr_field_processing_state') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: cbr_internal.cbr_field_processing_state does not exist.';
  END IF;
  IF to_regclass('public.canonical_beneficiary_records') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: public.canonical_beneficiary_records does not exist.';
  END IF;
  RAISE NOTICE '[OK] all prerequisite objects found (existence only -- see header note on what this does and does not demonstrate) -- proceeding.';
END $$;

-- ── Step 0b: transaction-local results table + recording helper ────────
CREATE TEMP TABLE f3_results (
  seq SERIAL PRIMARY KEY,
  block TEXT NOT NULL,
  assertion TEXT NOT NULL,
  expected TEXT,
  actual TEXT,
  status TEXT NOT NULL
);

CREATE OR REPLACE FUNCTION pg_temp.f3_record(p_block TEXT, p_assertion TEXT, p_expected TEXT, p_actual TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO f3_results (block, assertion, expected, actual, status)
  VALUES (p_block, p_assertion, p_expected, p_actual,
    CASE WHEN p_expected IS NOT DISTINCT FROM p_actual THEN 'PASS' ELSE 'FAIL' END);
END;
$$;

-- ── Step 0c: transaction-local fixture helpers, all in pg_temp ─────────
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
CREATE OR REPLACE FUNCTION pg_temp.f3_make_profile(p_role TEXT DEFAULT 'agent')
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_email TEXT := 'cbr-f3-' || v_id || '@example.invalid';
  v_final_email TEXT;
  v_final_role TEXT;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    VALUES (v_id, v_email, '', now(), now(), now(), 'authenticated', 'authenticated')
    ON CONFLICT DO NOTHING;

  SELECT email, role::TEXT INTO v_final_email, v_final_role FROM public.profiles WHERE id = v_id;
  IF v_final_role IS NULL THEN
    RAISE EXCEPTION 'f3_make_profile: on_auth_user_created did not create a public.profiles row for id=% (trigger-created row not found)', v_id;
  END IF;

  IF v_final_role IS DISTINCT FROM p_role THEN
    UPDATE public.profiles SET role = p_role::public.user_role WHERE id = v_id;
    SELECT role::TEXT INTO v_final_role FROM public.profiles WHERE id = v_id;
  END IF;

  IF v_final_email IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'f3_make_profile: postcondition failed -- expected email=%, actual email=% for id=%', v_email, v_final_email, v_id;
  END IF;
  IF v_final_role IS DISTINCT FROM p_role THEN
    RAISE EXCEPTION 'f3_make_profile: postcondition failed -- expected role=%, actual role=% for id=%', p_role, v_final_role, v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- clients.first_name/last_name are NOT NULL (schema.sql) -- this fixed,
-- known, non-NULL fixture identity is the EXACT condition several blocks
-- below exercise; middle_name/date_of_birth remain NULL unless separately set.
CREATE OR REPLACE FUNCTION pg_temp.f3_make_client(p_assigned_agent_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.clients (first_name, last_name, assigned_agent_id)
    VALUES ('F3Test', 'Client', p_assigned_agent_id) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.f3_make_case(p_client_id UUID)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.cases (client_id, case_type, title) VALUES (p_client_id, 'otro', 'IC Finding 3 regression case')
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.f3_make_invitation(p_case_id UUID, p_client_id UUID, p_email TEXT, p_created_by UUID)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.intake_invitations (token, case_id, client_id, email, created_by)
    VALUES (encode(gen_random_bytes(16), 'hex'), p_case_id, p_client_id, p_email, p_created_by)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.f3_sp_field(
  p_value TEXT,
  p_status TEXT DEFAULT 'beneficiary_confirmed',
  p_confirmed_by TEXT DEFAULT 'test-actor',
  p_confirmed_at TIMESTAMPTZ DEFAULT '2000-01-01T00:00:00Z'::TIMESTAMPTZ,
  p_source TEXT DEFAULT 'beneficiary_confirmed',
  p_confirmed_from_source TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'value', p_value, 'source', p_source, 'confidence', 1,
    'status', p_status, 'confirmed_by', p_confirmed_by,
    'confirmed_at', CASE WHEN p_confirmed_at IS NULL THEN NULL ELSE to_char(p_confirmed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MSZ') END,
    'confirmed_from_source', p_confirmed_from_source
  ));
$$;

-- p_submitted_at defaults to clock_timestamp() (real, per-statement wall
-- time), NOT now() -- see 00-helpers.sql's identical, already-reviewed
-- rationale (Finding 5 timing correction): cbr_toggle_gate also uses
-- clock_timestamp() for admission_window.opened_at, and it keeps advancing
-- within a transaction, so a submission created via the default AFTER a
-- gate toggle (in real statement order) must anchor to the same volatile
-- clock to reliably land inside the window it needs to fall inside.
CREATE OR REPLACE FUNCTION pg_temp.f3_make_submission(
  p_client_id UUID, p_case_id UUID, p_invitation_id UUID,
  p_fields JSONB, p_submitted_at TIMESTAMPTZ DEFAULT clock_timestamp()
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.intake_submissions (client_id, case_id, invitation_id, structured_profile, submitted_at)
    VALUES (p_client_id, p_case_id, p_invitation_id, p_fields, p_submitted_at)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── Step 0d: gate/window prerequisite-state helpers ─────────────────────
-- IC follow-up requirement (§3): assert the actual gate/window state that
-- determines branch reachability, rather than relying only on a returned
-- outcome to imply it was correct.
CREATE OR REPLACE FUNCTION pg_temp.f3_gate_enabled(p_gate TEXT)
RETURNS BOOLEAN LANGUAGE sql AS $$
  SELECT enabled FROM cbr_internal.cbr_field_gate_state WHERE gate = p_gate;
$$;

CREATE OR REPLACE FUNCTION pg_temp.f3_window_open(p_gate TEXT)
RETURNS BOOLEAN LANGUAGE sql AS $$
  SELECT EXISTS(SELECT 1 FROM cbr_internal.cbr_field_admission_window WHERE gate = p_gate AND closed_at IS NULL);
$$;

CREATE OR REPLACE FUNCTION pg_temp.f3_window_opened_at(p_gate TEXT)
RETURNS TIMESTAMPTZ LANGUAGE sql AS $$
  SELECT opened_at FROM cbr_internal.cbr_field_admission_window WHERE gate = p_gate AND closed_at IS NULL
    ORDER BY opened_at DESC LIMIT 1;
$$;

-- ============================================================
-- Block A: observation / replay / supersession scenarios affected by the
-- field change (middleName, mirrors 01-single-session-tests.sql's
-- corrected AC-45/AC-47/AC-50/AC-48/AC-46).
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_s2 UUID; v_o TEXT; v_obs UUID; v_dec UUID;
BEGIN
  v_admin := pg_temp.f3_make_profile('admin');
  v_client := pg_temp.f3_make_client();
  v_case := pg_temp.f3_make_case(v_client);
  v_inv := pg_temp.f3_make_invitation(v_case, v_client, 'f3-a@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM pg_temp.f3_record('A', 'gate-g3_observation-enabled', 'true', pg_temp.f3_gate_enabled('g3_observation')::TEXT);
  PERFORM pg_temp.f3_record('A', 'gate-g3_staff_resolution-enabled', 'true', pg_temp.f3_gate_enabled('g3_staff_resolution')::TEXT);
  PERFORM pg_temp.f3_record('A', 'window-g3_observation-open', 'true', pg_temp.f3_window_open('g3_observation')::TEXT);
  PERFORM pg_temp.f3_record('A', 'canonical-precondition-absent', 'true', (SELECT (middle_name IS NULL)::TEXT FROM public.clients WHERE id = v_client));

  -- AC-45: first-ever event, canonical absent, no prior candidate -> OBSERVED.
  v_s1 := pg_temp.f3_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f3_sp_field('Alejandro')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_s1, 'middleName');
  PERFORM pg_temp.f3_record('A', 'ac45-observed', 'OBSERVED', v_o);

  -- AC-47: replay of a candidate with zero associated conflicts.
  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_s1, 'middleName');
  PERFORM pg_temp.f3_record('A', 'ac47-replay-observed', 'OBSERVED', v_o);

  -- AC-50: newer event, pending decision, strictly-older origin -> supersession.
  SELECT decision_id INTO v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  v_s2 := pg_temp.f3_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f3_sp_field('Alexander')));
  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_s2, 'middleName');
  PERFORM pg_temp.f3_record('A', 'ac50-conflict', 'CONFLICT', v_o);
  PERFORM pg_temp.f3_record('A', 'ac50-superseded', 'superseded', (SELECT decision_state FROM public.canonical_beneficiary_records WHERE id = v_dec));

  -- AC-48: replay of a candidate with exactly one associated conflict.
  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_s2, 'middleName');
  PERFORM pg_temp.f3_record('A', 'ac48-replay-conflict', 'CONFLICT', v_o);

  -- AC-46: >1 CURRENT candidate, via direct fault injection (no trigger
  -- bypass, no constraint weakened -- "at most one CURRENT candidate" is
  -- an ALGORITHMIC invariant TX-02 itself maintains, not a database
  -- constraint, so a plain second INSERT is sufficient).
  DECLARE v_client2 UUID := pg_temp.f3_make_client(); v_case2 UUID; v_inv2 UUID; v_s3 UUID; v_s3b UUID; v_s4 UUID; v_obs2 UUID;
  BEGIN
    v_case2 := pg_temp.f3_make_case(v_client2);
    v_inv2 := pg_temp.f3_make_invitation(v_case2, v_client2, 'f3-a2@example.invalid', v_admin);
    v_s3 := pg_temp.f3_make_submission(v_client2, v_case2, v_inv2, jsonb_build_object('middleName', pg_temp.f3_sp_field('First')));
    SELECT outcome, observation_id INTO v_o, v_obs2 FROM public.cbr_tx02_observe_g3(v_s3, 'middleName');
    PERFORM pg_temp.f3_record('A', 'ac46-setup-observed', 'OBSERVED', v_o);
    v_s3b := pg_temp.f3_make_submission(v_client2, v_case2, v_inv2, jsonb_build_object('middleName', pg_temp.f3_sp_field('AlsoCurrent')));
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, candidate_value)
      VALUES (v_client2, 'CANDIDATE_OBSERVED', 'middleName', v_s3b, 'AlsoCurrent'); -- bypasses only the ALGORITHM's uniqueness discipline
    v_s4 := pg_temp.f3_make_submission(v_client2, v_case2, v_inv2, jsonb_build_object('middleName', pg_temp.f3_sp_field('Newer')));
    BEGIN
      PERFORM public.cbr_tx02_observe_g3(v_s4, 'middleName');
      PERFORM pg_temp.f3_record('A', 'ac46-multiple-current-raised', 'true', 'false');
    EXCEPTION WHEN OTHERS THEN
      PERFORM pg_temp.f3_record('A', 'ac46-multiple-current-raised', 'true', (SQLERRM LIKE 'CBR_MULTIPLE_CURRENT_CANDIDATES%')::TEXT);
    END;
  END;
END $$;

-- ============================================================
-- Block B: AC-31 -- value-binding at TX-03 creation (middleName).
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT; v_obs UUID; v_dec UUID;
        v_bound_value TEXT; v_stored_value TEXT;
BEGIN
  v_admin := pg_temp.f3_make_profile('admin');
  v_client := pg_temp.f3_make_client();
  v_case := pg_temp.f3_make_case(v_client);
  v_inv := pg_temp.f3_make_invitation(v_case, v_client, 'f3-b@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM pg_temp.f3_record('B', 'gate-g3_observation-enabled', 'true', pg_temp.f3_gate_enabled('g3_observation')::TEXT);
  PERFORM pg_temp.f3_record('B', 'window-g3_observation-open', 'true', pg_temp.f3_window_open('g3_observation')::TEXT);
  PERFORM pg_temp.f3_record('B', 'canonical-precondition-absent', 'true', (SELECT (middle_name IS NULL)::TEXT FROM public.clients WHERE id = v_client));

  v_sub := pg_temp.f3_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f3_sp_field('Value31')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  PERFORM pg_temp.f3_record('B', 'ac31-setup-observed', 'OBSERVED', v_o);
  SELECT candidate_value INTO v_bound_value FROM public.canonical_beneficiary_records WHERE id = v_obs;
  PERFORM pg_temp.f3_record('B', 'ac31-fixture-value-reached-observation', 'Value31', v_bound_value);

  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f3_record('B', 'ac31-open-outcome', 'OPENED', v_o);
  SELECT candidate_value INTO v_stored_value FROM public.canonical_beneficiary_records WHERE id = v_dec;
  PERFORM pg_temp.f3_record('B', 'ac31-value-bound-through-to-decision', v_bound_value, v_stored_value);
END $$;

-- ============================================================
-- Block C: AC-32(a) -- the specifically-named TX-04 prerequisite defect
-- (NULL supplied as p_expected_prior_value despite a non-NULL canonical).
-- AC-32(b) is NOT included here -- see the final NOTICE at the end of this
-- file for its explicit BLOCKED status and reason (requires disabling
-- cbr_validate_relationship_trg, which this artifact does not do).
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT; v_obs UUID; v_dec UUID;
BEGIN
  v_admin := pg_temp.f3_make_profile('admin');
  v_client := pg_temp.f3_make_client();
  v_case := pg_temp.f3_make_case(v_client);
  v_inv := pg_temp.f3_make_invitation(v_case, v_client, 'f3-c@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM pg_temp.f3_record('C', 'gate-g3_observation-enabled', 'true', pg_temp.f3_gate_enabled('g3_observation')::TEXT);
  PERFORM pg_temp.f3_record('C', 'window-g3_observation-open', 'true', pg_temp.f3_window_open('g3_observation')::TEXT);
  PERFORM pg_temp.f3_record('C', 'canonical-precondition', 'F3Test', (SELECT first_name FROM public.clients WHERE id = v_client));

  v_sub := pg_temp.f3_make_submission(v_client, v_case, v_inv, jsonb_build_object('givenName', pg_temp.f3_sp_field('Value32a')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'firstName');
  PERFORM pg_temp.f3_record('C', 'setup-observe-conflict', 'CONFLICT', v_o); -- canonical present ('F3Test'), differs from 'Value32a'
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f3_record('C', 'setup-open', 'OPENED', v_o);

  -- The defect: supplying NULL here would reach STALE_PRIOR_VALUE at STEP
  -- 8b before ever reaching STEP 9's defensive re-check / STEP 10/11
  -- approval path this case is meant to exercise. Corrected: supply the
  -- exact live canonical value.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'F3Test');
  PERFORM pg_temp.f3_record('C', 'ac32a-approved', 'APPROVED', v_o);
END $$;

-- ============================================================
-- Block D: AC-53 -- equality-before-mutation. Corrected this round: the
-- prior version of this block exercised approval WITH mutation (candidate
-- and canonical differed at approval time), not AC-53's actual branch,
-- which requires canonical to be made EXACTLY equal to the candidate
-- BEFORE approval, so TX-04 STEP 10 finds them equal and skips the
-- mutation entirely.
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT; v_obs UUID; v_dec UUID;
        v_before_canon TEXT; v_sub_submitted_at TIMESTAMPTZ; v_gov_sub UUID; v_gov_ts TIMESTAMPTZ; v_last_proc TIMESTAMPTZ;
        v_pre_row_exists BOOLEAN; v_pre_last_proc TIMESTAMPTZ; v_pre_call_marker TIMESTAMPTZ; v_post_row_exists BOOLEAN;
BEGIN
  v_admin := pg_temp.f3_make_profile('admin');
  v_client := pg_temp.f3_make_client();
  v_case := pg_temp.f3_make_case(v_client);
  v_inv := pg_temp.f3_make_invitation(v_case, v_client, 'f3-d@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM pg_temp.f3_record('D', 'gate-g3_observation-enabled', 'true', pg_temp.f3_gate_enabled('g3_observation')::TEXT);
  PERFORM pg_temp.f3_record('D', 'window-g3_observation-open', 'true', pg_temp.f3_window_open('g3_observation')::TEXT);
  -- canonical starts as 'Client' (f3_make_client()'s default last_name) -- differs from the candidate we submit.
  PERFORM pg_temp.f3_record('D', 'canonical-precondition', 'Client', (SELECT last_name FROM public.clients WHERE id = v_client));

  v_sub := pg_temp.f3_make_submission(v_client, v_case, v_inv, jsonb_build_object('familyName', pg_temp.f3_sp_field('Duarte')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'lastName');
  PERFORM pg_temp.f3_record('D', 'setup-observe-conflict', 'CONFLICT', v_o); -- canonical 'Client' differs from candidate 'Duarte' -> pending decision opened while they differ
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f3_record('D', 'setup-open', 'OPENED', v_o);

  -- Change the fixture's canonical value to EXACTLY the candidate value.
  UPDATE public.clients SET last_name = 'Duarte' WHERE id = v_client;
  SELECT last_name INTO v_before_canon FROM public.clients WHERE id = v_client;
  PERFORM pg_temp.f3_record('D', 'canonical-now-equals-candidate', 'Duarte', v_before_canon);

  -- Capture the PRE-approval processing-state baseline. TX-02 (STEP 7)
  -- already creates/advances this row -- governing_submission_id,
  -- governing_submitted_at, and a non-NULL last_processed_at are all set
  -- BEFORE TX-04 ever runs. Asserting only that these columns hold
  -- expected-looking values AFTER approval would therefore still pass
  -- even if TX-04's own STEP 12 update were missing entirely. Capturing
  -- this baseline first, and requiring the post-approval last_processed_at
  -- to have strictly ADVANCED past it, is what actually isolates TX-04's
  -- own contribution.
  SELECT EXISTS(SELECT 1 FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client AND field_key = 'lastName')
    INTO v_pre_row_exists;
  PERFORM pg_temp.f3_record('D', 'processing-state-preexisting-row', 'true', v_pre_row_exists::TEXT);
  SELECT last_processed_at INTO v_pre_last_proc FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client AND field_key = 'lastName';
  PERFORM pg_temp.f3_record('D', 'processing-state-pre-approval-last-processed-at-set', 'true', (v_pre_last_proc IS NOT NULL)::TEXT);

  -- Short test-only delay so the pre-call marker cannot tie, at clock
  -- resolution, with the pre-approval last_processed_at captured above --
  -- makes the "strictly later" assertion below deterministic rather than
  -- dependent on how much real time the setup statements happened to take.
  PERFORM pg_sleep(0.02);
  v_pre_call_marker := clock_timestamp();

  -- Supply that exact current value as p_expected_prior_value -> APPROVED.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'Duarte');
  PERFORM pg_temp.f3_record('D', 'ac53-approved', 'APPROVED', v_o);

  -- Canonical value remains unchanged (STEP 10 found current==candidate, skipped mutation).
  PERFORM pg_temp.f3_record('D', 'canonical-unchanged-by-approval', v_before_canon, (SELECT last_name FROM public.clients WHERE id = v_client));
  -- Decision transitioned to approved.
  PERFORM pg_temp.f3_record('D', 'decision-approved', 'approved', (SELECT decision_state FROM public.canonical_beneficiary_records WHERE id = v_dec));
  -- No CHANGE_REALIZED row for this decision.
  PERFORM pg_temp.f3_record('D', 'no-change-realized', '0', (SELECT count(*)::TEXT FROM public.canonical_beneficiary_records WHERE record_type='CHANGE_REALIZED' AND related_decision_id = v_dec));

  -- POST-approval processing-state verification, against the PRE-approval
  -- baseline and pre-call marker captured above -- proves TX-04 STEP 12
  -- itself acted, not merely that TX-02's earlier write is still visible.
  SELECT submitted_at INTO v_sub_submitted_at FROM public.intake_submissions WHERE id = v_sub;
  SELECT EXISTS(SELECT 1 FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client AND field_key = 'lastName')
    INTO v_post_row_exists;
  PERFORM pg_temp.f3_record('D', 'processing-state-row-still-exists', 'true', v_post_row_exists::TEXT);
  SELECT governing_submission_id, governing_submitted_at, last_processed_at
    INTO v_gov_sub, v_gov_ts, v_last_proc
    FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client AND field_key = 'lastName';
  PERFORM pg_temp.f3_record('D', 'processing-state-governing-submission', v_sub::TEXT, v_gov_sub::TEXT);
  PERFORM pg_temp.f3_record('D', 'processing-state-governing-submitted-at', v_sub_submitted_at::TEXT, v_gov_ts::TEXT);
  PERFORM pg_temp.f3_record('D', 'processing-state-last-processed-at-advanced-past-pre-approval-baseline', 'true', (v_last_proc > v_pre_last_proc)::TEXT);
  PERFORM pg_temp.f3_record('D', 'processing-state-last-processed-at-not-before-pre-call-marker', 'true', (v_last_proc >= v_pre_call_marker)::TEXT);
END $$;

-- ============================================================
-- Block E: live-value-vs-snapshot distinction. NOT AC-53 coverage -- this
-- is the general Finding-2 semantics proof (TX-04 compares against the
-- LIVE canonical, never DECISION.expected_prior_value's immutable
-- open-time snapshot), retained from the prior round's Block C and
-- relabeled accurately per this round's instruction. It exercises
-- approval WITH mutation (candidate and live canonical still differ from
-- the open-time value at approval), which is why it is distinct from
-- Block D's actual AC-53 equality-before-mutation branch above.
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT; v_obs UUID; v_dec UUID; v_snapshot TEXT;
BEGIN
  v_admin := pg_temp.f3_make_profile('admin');
  v_client := pg_temp.f3_make_client();
  v_case := pg_temp.f3_make_case(v_client);
  v_inv := pg_temp.f3_make_invitation(v_case, v_client, 'f3-e@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM pg_temp.f3_record('E', 'gate-g3_observation-enabled', 'true', pg_temp.f3_gate_enabled('g3_observation')::TEXT);
  -- canonical = A ('Client', f3_make_client()'s default last_name) at open time.
  PERFORM pg_temp.f3_record('E', 'canonical-is-A', 'Client', (SELECT last_name FROM public.clients WHERE id = v_client));

  v_sub := pg_temp.f3_make_submission(v_client, v_case, v_inv, jsonb_build_object('familyName', pg_temp.f3_sp_field('Vargas')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'lastName');
  PERFORM pg_temp.f3_record('E', 'setup-observe-conflict', 'CONFLICT', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f3_record('E', 'setup-open', 'OPENED', v_o);

  SELECT expected_prior_value INTO v_snapshot FROM public.canonical_beneficiary_records WHERE id = v_dec;
  PERFORM pg_temp.f3_record('E', 'snapshot-is-A', 'Client', v_snapshot);

  -- Canonical independently changes to B, after the review was opened.
  UPDATE public.clients SET last_name = 'Restrepo' WHERE id = v_client;

  -- Supplying the STALE open-time snapshot (A) must be rejected.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'Client');
  PERFORM pg_temp.f3_record('E', 'stale-snapshot-A-rejected', 'STALE_PRIOR_VALUE', v_o);

  -- Supplying the CURRENT live canonical value (B) proceeds (with mutation, unlike Block D).
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'Restrepo');
  PERFORM pg_temp.f3_record('E', 'current-B-approved', 'APPROVED', v_o);
  PERFORM pg_temp.f3_record('E', 'canonical-mutated-to-candidate', 'Vargas', (SELECT last_name FROM public.clients WHERE id = v_client));
END $$;

-- ============================================================
-- Block F: AC-56 and the SEQUENTIAL outcome portion of AC-57 only.
-- AC-57's lock-wait / no-retroactive-invalidation claim requires two
-- concurrent sessions and is explicitly NOT exercised here -- see
-- concurrency/ac-lockorder-and-concurrency.sh for that proof.
-- ============================================================
DO $$
DECLARE v_admin UUID; v_agent1 UUID; v_agent2 UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_o TEXT; v_obs UUID; v_dec UUID;
BEGIN
  v_admin := pg_temp.f3_make_profile('admin');
  v_agent1 := pg_temp.f3_make_profile('agent');
  v_agent2 := pg_temp.f3_make_profile('agent');
  v_client := pg_temp.f3_make_client(v_agent1);
  v_case := pg_temp.f3_make_case(v_client);
  v_inv := pg_temp.f3_make_invitation(v_case, v_client, 'f3-f@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM pg_temp.f3_record('F', 'gate-g3_observation-enabled', 'true', pg_temp.f3_gate_enabled('g3_observation')::TEXT);
  PERFORM pg_temp.f3_record('F', 'canonical-precondition', 'F3Test', (SELECT first_name FROM public.clients WHERE id = v_client));

  v_s1 := pg_temp.f3_make_submission(v_client, v_case, v_inv, jsonb_build_object('givenName', pg_temp.f3_sp_field('Name')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_s1, 'firstName');
  PERFORM pg_temp.f3_record('F', 'setup-observe-conflict', 'CONFLICT', v_o);
  SELECT decision_id INTO v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);

  -- AC-56: revoke agent1's assignment (reassign to agent2) BEFORE agent1's Layer-2 check.
  -- STEP 5 (authority) fires before STEP 8b (stale-value check), so p_expected_prior_value's
  -- value does not matter for this specific call.
  UPDATE public.clients SET assigned_agent_id = v_agent2 WHERE id = v_client;
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_agent1, NULL);
  PERFORM pg_temp.f3_record('F', 'ac56-unauthorized', 'UNAUTHORIZED', v_o);

  -- AC-57 (sequential outcome only): agent2 IS authorized and reaches STEP
  -- 8b, where the exact live canonical value ('F3Test', unchanged since
  -- setup) must be supplied.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_agent2, 'F3Test');
  PERFORM pg_temp.f3_record('F', 'ac57-sequential-approved', 'APPROVED', v_o);
END $$;

-- ============================================================
-- Block G: AC-59/AC-60 -- admission-window persistence across a
-- disable/re-enable cycle (middleName).
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_o TEXT;
BEGIN
  v_admin := pg_temp.f3_make_profile('admin');
  v_client := pg_temp.f3_make_client();
  v_case := pg_temp.f3_make_case(v_client);
  v_inv := pg_temp.f3_make_invitation(v_case, v_client, 'f3-g@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM pg_temp.f3_record('G', 'gate-g3_observation-enabled', 'true', pg_temp.f3_gate_enabled('g3_observation')::TEXT);
  PERFORM pg_temp.f3_record('G', 'window-g3_observation-open', 'true', pg_temp.f3_window_open('g3_observation')::TEXT);
  PERFORM pg_temp.f3_record('G', 'canonical-precondition-absent', 'true', (SELECT (middle_name IS NULL)::TEXT FROM public.clients WHERE id = v_client));

  v_s1 := pg_temp.f3_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f3_sp_field('Retry')));
  -- Simulate "processing fails" by disabling staff (breaks the compound gate) before the call.
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', false, v_admin);
  PERFORM pg_temp.f3_record('G', 'gate-g3_staff_resolution-disabled', 'false', pg_temp.f3_gate_enabled('g3_staff_resolution')::TEXT);
  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_s1, 'middleName');
  PERFORM pg_temp.f3_record('G', 'ac60-disabled', 'DISABLED', v_o);

  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin); -- re-enable: new window opens
  PERFORM pg_temp.f3_record('G', 'window-g3_observation-reopened', 'true', pg_temp.f3_window_open('g3_observation')::TEXT);
  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_s1, 'middleName'); -- s1's original window still covers it
  PERFORM pg_temp.f3_record('G', 'ac59-observed', 'OBSERVED', v_o);
END $$;

-- ============================================================
-- Block H: IC§9 -- DECISION/CONFLICT_DETECTED origin propagation
-- (middleName).
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_s2 UUID;
        v_obs UUID; v_dec UUID; v_new_cand UUID; v_o TEXT; v_origin TEXT; v_obs_origin TEXT;
BEGIN
  v_admin := pg_temp.f3_make_profile('admin');
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM pg_temp.f3_record('H', 'gate-g3_observation-enabled', 'true', pg_temp.f3_gate_enabled('g3_observation')::TEXT);

  -- IC9-DECISION: TX-03's DECISION.origin must equal source_observation.origin, COPIED not re-derived.
  v_client := pg_temp.f3_make_client(); v_case := pg_temp.f3_make_case(v_client);
  v_inv := pg_temp.f3_make_invitation(v_case, v_client, 'f3-h1@example.invalid', v_admin);
  v_s1 := pg_temp.f3_make_submission(v_client, v_case, v_inv,
    jsonb_build_object('middleName', pg_temp.f3_sp_field('IC9Dec', 'beneficiary_confirmed', 'test-actor', '2000-01-01T00:00:00Z'::TIMESTAMPTZ, 'beneficiary_confirmed', 'cv_extraction')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_s1, 'middleName');
  PERFORM pg_temp.f3_record('H', 'ic9-decision-setup-observed', 'OBSERVED', v_o);
  SELECT origin INTO v_obs_origin FROM public.canonical_beneficiary_records WHERE id = v_obs;
  PERFORM pg_temp.f3_record('H', 'ic9-decision-observation-origin', 'cv_extraction', v_obs_origin);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f3_record('H', 'ic9-decision-open', 'OPENED', v_o);
  SELECT origin INTO v_origin FROM public.canonical_beneficiary_records WHERE id = v_dec;
  PERFORM pg_temp.f3_record('H', 'ic9-decision-origin-copied', v_obs_origin, v_origin);

  -- IC9-CONFLICT: TX-02's CONFLICT_DETECTED.origin must equal the incoming
  -- (new) candidate's own origin.
  v_client := pg_temp.f3_make_client(); v_case := pg_temp.f3_make_case(v_client);
  v_inv := pg_temp.f3_make_invitation(v_case, v_client, 'f3-h2@example.invalid', v_admin);
  v_s1 := pg_temp.f3_make_submission(v_client, v_case, v_inv,
    jsonb_build_object('middleName', pg_temp.f3_sp_field('IC9ConA', 'beneficiary_confirmed', 'test-actor', '2000-01-01T00:00:00Z'::TIMESTAMPTZ, 'beneficiary_confirmed', 'cv_extraction')));
  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_s1, 'middleName');
  PERFORM pg_temp.f3_record('H', 'ic9-conflict-setup-observed', 'OBSERVED', v_o);
  v_s2 := pg_temp.f3_make_submission(v_client, v_case, v_inv,
    jsonb_build_object('middleName', pg_temp.f3_sp_field('IC9ConB', 'beneficiary_confirmed', 'test-actor', '2000-01-01T00:00:00Z'::TIMESTAMPTZ, 'beneficiary_confirmed', 'beneficiary_provided')));
  SELECT outcome, observation_id INTO v_o, v_new_cand FROM public.cbr_tx02_observe_g3(v_s2, 'middleName');
  PERFORM pg_temp.f3_record('H', 'ic9-conflict-outcome', 'CONFLICT', v_o);
  SELECT origin INTO v_origin FROM public.canonical_beneficiary_records
    WHERE record_type = 'CONFLICT_DETECTED' AND related_candidate_id = v_new_cand;
  PERFORM pg_temp.f3_record('H', 'ic9-conflict-origin', 'beneficiary_provided', v_origin);
END $$;

-- ============================================================
-- Block I: IC§10 -- relationship-trigger origin-mismatch rejection
-- (middleName).
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_o TEXT; v_raised BOOLEAN;
BEGIN
  v_admin := pg_temp.f3_make_profile('admin');
  v_client := pg_temp.f3_make_client();
  v_case := pg_temp.f3_make_case(v_client);
  v_inv := pg_temp.f3_make_invitation(v_case, v_client, 'f3-i@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  v_sub := pg_temp.f3_make_submission(v_client, v_case, v_inv,
    jsonb_build_object('middleName', pg_temp.f3_sp_field('IC10', 'beneficiary_confirmed', 'test-actor', '2000-01-01T00:00:00Z'::TIMESTAMPTZ, 'beneficiary_confirmed', 'cv_extraction')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  PERFORM pg_temp.f3_record('I', 'setup-observed', 'OBSERVED', v_o);

  -- IC10-DECISION: candidate_value matches, origin deliberately does not.
  BEGIN
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_observation_id, candidate_value, origin, decision_state, expected_prior_value)
      VALUES (v_client, 'DECISION', 'middleName', v_obs, 'IC10', 'beneficiary_provided', 'pending', NULL);
    v_raised := false;
  EXCEPTION WHEN OTHERS THEN
    v_raised := (SQLERRM LIKE 'CBR_RELATIONSHIP_VIOLATION%');
  END;
  PERFORM pg_temp.f3_record('I', 'ic10-decision-origin-mismatch-rejected', 'true', v_raised::TEXT);

  -- IC10-CONFLICT: source_submission_id/candidate_value/related_candidate_id all match, origin deliberately does not.
  BEGIN
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, candidate_value, origin, prior_value, related_candidate_id)
      VALUES (v_client, 'CONFLICT_DETECTED', 'middleName', v_sub, 'IC10', 'beneficiary_provided', 'SomePrior', v_obs);
    v_raised := false;
  EXCEPTION WHEN OTHERS THEN
    v_raised := (SQLERRM LIKE 'CBR_RELATIONSHIP_VIOLATION%');
  END;
  PERFORM pg_temp.f3_record('I', 'ic10-conflict-origin-mismatch-rejected', 'true', v_raised::TEXT);
END $$;

-- ============================================================
-- Block J: G1G2 admission-boundary correction (countryOfResidence).
-- cbr_toggle_gate returns NO_CHANGE, and leaves any existing window's
-- opened_at untouched, when called with the gate's CURRENT value -- a
-- toggle-to-true is never assumed to open a fresh window. This block
-- forces a known-disabled starting state FIRST.
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT; v_sub_submitted_at TIMESTAMPTZ; v_opened_at TIMESTAMPTZ;
BEGIN
  v_admin := pg_temp.f3_make_profile('admin');
  PERFORM cbr_internal.cbr_toggle_gate('g1g2', false, v_admin); -- force a known-disabled starting state
  v_client := pg_temp.f3_make_client();
  v_case := pg_temp.f3_make_case(v_client);
  v_inv := pg_temp.f3_make_invitation(v_case, v_client, 'f3-j@example.invalid', v_admin);
  v_sub := pg_temp.f3_make_submission(v_client, v_case, v_inv, jsonb_build_object('countryOfResidence', pg_temp.f3_sp_field('Chile')));
  PERFORM cbr_internal.cbr_toggle_gate('g1g2', true, v_admin); -- REAL enable, guaranteed by the disable above
  PERFORM pg_temp.f3_record('J', 'gate-g1g2-enabled', 'true', pg_temp.f3_gate_enabled('g1g2')::TEXT);
  PERFORM pg_temp.f3_record('J', 'window-g1g2-open', 'true', pg_temp.f3_window_open('g1g2')::TEXT);

  -- Check resulting state directly: the window's opened_at must be AFTER
  -- the submission's submitted_at -- the exact condition that makes
  -- ADMISSION_BOUNDARY the correct outcome, not merely implied by it.
  SELECT submitted_at INTO v_sub_submitted_at FROM public.intake_submissions WHERE id = v_sub;
  v_opened_at := pg_temp.f3_window_opened_at('g1g2');
  PERFORM pg_temp.f3_record('J', 'window-opened-after-submission', 'true', (v_opened_at > v_sub_submitted_at)::TEXT);

  SELECT outcome INTO v_o FROM public.cbr_tx01_realize_g1g2(v_sub, 'countryOfResidence');
  PERFORM pg_temp.f3_record('J', 'admission-boundary-rejected', 'ADMISSION_BOUNDARY', v_o);
END $$;

-- ============================================================
-- Block K: G3 admission-boundary correction (middleName).
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT; v_sub_submitted_at TIMESTAMPTZ; v_opened_at TIMESTAMPTZ;
BEGIN
  v_admin := pg_temp.f3_make_profile('admin');
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', false, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', false, v_admin);
  v_client := pg_temp.f3_make_client();
  v_case := pg_temp.f3_make_case(v_client);
  v_inv := pg_temp.f3_make_invitation(v_case, v_client, 'f3-k@example.invalid', v_admin);
  v_sub := pg_temp.f3_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f3_sp_field('Boundary')));
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM pg_temp.f3_record('K', 'gate-g3_observation-enabled', 'true', pg_temp.f3_gate_enabled('g3_observation')::TEXT);
  PERFORM pg_temp.f3_record('K', 'gate-g3_staff_resolution-enabled', 'true', pg_temp.f3_gate_enabled('g3_staff_resolution')::TEXT);
  PERFORM pg_temp.f3_record('K', 'window-g3_observation-open', 'true', pg_temp.f3_window_open('g3_observation')::TEXT);

  SELECT submitted_at INTO v_sub_submitted_at FROM public.intake_submissions WHERE id = v_sub;
  v_opened_at := pg_temp.f3_window_opened_at('g3_observation');
  PERFORM pg_temp.f3_record('K', 'window-opened-after-submission', 'true', (v_opened_at > v_sub_submitted_at)::TEXT);

  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  PERFORM pg_temp.f3_record('K', 'admission-boundary-rejected', 'ADMISSION_BOUNDARY', v_o);
END $$;

-- ============================================================
-- Block L: firstName storage trimming, with the correct CONFLICT setup
-- (canonical is non-NULL 'F3Test', so this reaches branch 2, not branch
-- 3 -- storage trimming is computed identically in every action-table
-- branch, so this still proves the same claim the original OBSERVED-based
-- test intended).
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT; v_obs UUID; v_stored TEXT;
BEGIN
  v_admin := pg_temp.f3_make_profile('admin');
  v_client := pg_temp.f3_make_client();
  v_case := pg_temp.f3_make_case(v_client);
  v_inv := pg_temp.f3_make_invitation(v_case, v_client, 'f3-l@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM pg_temp.f3_record('L', 'gate-g3_observation-enabled', 'true', pg_temp.f3_gate_enabled('g3_observation')::TEXT);
  PERFORM pg_temp.f3_record('L', 'canonical-precondition', 'F3Test', (SELECT first_name FROM public.clients WHERE id = v_client));

  v_sub := pg_temp.f3_make_submission(v_client, v_case, v_inv, jsonb_build_object('givenName', pg_temp.f3_sp_field('  Mariana  ')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'firstName');
  PERFORM pg_temp.f3_record('L', 'setup-observe-conflict', 'CONFLICT', v_o);
  SELECT candidate_value INTO v_stored FROM public.canonical_beneficiary_records WHERE id = v_obs;
  PERFORM pg_temp.f3_record('L', 'firstname-stored-trimmed', 'Mariana', v_stored);
END $$;

-- ============================================================
-- Results: readable result set, returned before the final hard-failure check.
-- ============================================================
SELECT seq, block, assertion, expected, actual, status FROM f3_results ORDER BY seq;

SELECT
  count(*) FILTER (WHERE status = 'PASS') AS pass_count,
  count(*) FILTER (WHERE status = 'FAIL') AS fail_count,
  count(*) AS total_count
FROM f3_results;

DO $$
BEGIN
  RAISE NOTICE '[BLOCKED, NOT INCLUDED ABOVE] AC-32(b) (disclosed fault-injection negative branch: TX-04 STEP 9''s defensive CBR_DECISION_VALUE_MISMATCH check) requires ALTER TABLE ... DISABLE TRIGGER cbr_validate_relationship_trg to construct an inconsistent prior-value state that no ordinary, protected write path can produce. This artifact does not disable triggers, weaken constraints, or modify production functions, so this negative branch is BLOCKED for AUSCIS-TEST manual execution, for this specific, stated reason. It is not substituted with a different test claiming equivalent coverage, and constraint enforcement (IC10 above) is never treated as a substitute for this distinct defensive-function branch. It remains, corrected for the SAME AC-32-class prerequisite defect, in 01-single-session-tests.sql for a disposable local database only.';
  RAISE NOTICE '[NOT INCLUDED, NOT AFFECTED] AC-49 (unique-index constraint-proof; its correctness never depended on the field-key change) and AC-52 (its integrity check never reads canonical at all) required no manual re-verification for this round -- both remain, unchanged in substance, in 01-single-session-tests.sql.';
END $$;

-- ── Final hard-failure check: raises (a genuine error, not a notice) if ──
-- ── ANY assertion above recorded FAIL. Failing detail is built directly ──
-- ── into the exception message itself, so a failed run remains          ──
-- ── diagnosable even if the SELECTs above are not displayed.            ──
DO $$
DECLARE v_fail_count INT; v_detail TEXT;
BEGIN
  SELECT count(*), string_agg(format('[%s] %s: expected=%s actual=%s', block, assertion, expected, actual), E'\n' ORDER BY seq)
    INTO v_fail_count, v_detail
    FROM f3_results WHERE status = 'FAIL';
  IF v_fail_count > 0 THEN
    RAISE EXCEPTION '% assertion(s) FAILED:%', v_fail_count, (E'\n' || v_detail);
  END IF;
  RAISE NOTICE '[OK] all % assertions PASSED.', (SELECT count(*) FROM f3_results);
END $$;

-- Always ends here, pass or fail: nothing this file did is intended to persist.
ROLLBACK;
