-- ============================================================
-- IC Targeted Correction 2 of 6 — TX-04 expected-prior-value regression
-- (Second follow-up revision: corrected Block 11 DATE case, full-row
-- DECISION/processing-state snapshot comparison, corrected wording)
-- ============================================================
-- Governing authority: approved CBR Consolidated Design, §H.2.
--
-- TARGET: AUSCIS-TEST (the designated modifying-test environment). ACTIONUSA AI
-- is the principal project and must NEVER be targeted or modified by this file.
--
-- PREREQUISITE: the reviewed, corrected migration 040 (TX-04 STEP 8b fix) must
-- ALREADY be installed on the target database. This file does not install it.
-- Step 0 below checks that the required objects EXIST before creating any
-- fixture, and fails immediately, with a clear message, if they do not. This is
-- an OBJECT-EXISTENCE check only -- it confirms the named functions/tables are
-- present under those signatures; it does NOT and cannot inspect or prove that
-- an installed function's BODY is the corrected version described in this
-- round's review. Only actually running the assertions below (Blocks 1 onward)
-- and reading their PASS/FAIL results does that.
--
-- SELF-CONTAINED: this file defines every helper it needs itself, scoped to
-- `pg_temp` (the current session's own private, automatically-cleaned-up temp
-- schema — never a shared, persistent, or collision-risking schema name). It
-- does NOT assume any `cbr_test` schema exists, does NOT create, drop, or
-- overwrite one, and has no dependency on 00-helpers.sql or any other file.
-- Every object it creates (helper functions, the results table) is ordinary
-- transactional DDL and is therefore fully undone by the ROLLBACK at the end,
-- on top of `pg_temp`'s own automatic session-scoped cleanup.
--
-- OWNER WORKFLOW: Alex manually executes modifying tests only in AUSCIS-TEST,
-- after reviewing this file and confirming its prerequisite is met. ACTIONUSA AI
-- (the principal project) must never be targeted or modified. Code does not
-- execute remote SQL, install migration 040, commit, push, deploy, or enable
-- operational gates as part of preparing this file.
--
-- TRANSACTION / ROLLBACK BEHAVIOR (read before running):
--   - Run this file's statements IN ORDER, in ONE session, inside the explicit
--     BEGIN below. There is no intermediate COMMIT anywhere in this file.
--   - EVERYTHING — helper creation, fixtures, gate toggles, assertions — happens
--     inside that one transaction, and the file ends with an explicit ROLLBACK.
--     This means NOTHING persists after this file finishes: no gate is left
--     enabled, no fixture client/case/submission/decision row survives, and no
--     pre-existing AUSCIS-TEST data of any kind is touched.
--   - IF EXECUTION FAILS PARTWAY (a raised error before reaching the final
--     ROLLBACK statement): your session's transaction is left OPEN and ABORTED.
--     In that state, every further statement will itself immediately error with
--     "current transaction is aborted, commands ignored until end of transaction
--     block" until the transaction is explicitly ended. Run
--         ROLLBACK;
--     as its own, separate statement right away. ROLLBACK is the correct,
--     unambiguous statement to use here and always safely discards everything
--     this file did. (For completeness: PostgreSQL treats COMMIT issued against
--     an already-aborted transaction as equivalent to ROLLBACK too — an aborted
--     transaction can never actually commit any change — but ROLLBACK is the
--     statement that says what you mean and is what these instructions assume;
--     do not rely on COMMIT's behavior here instead of using ROLLBACK.)
--   - No trigger is disabled and no constraint is weakened anywhere in this file.
--
-- RESULTS: every assertion is recorded as a row in a temporary results table
-- (not merely a RAISE NOTICE), and a full SELECT over that table is returned
-- before the final hard-failure check runs. Read that result grid if your SQL
-- client displays it. Separately, and not depending on the grid being visible:
-- the final hard-failure check (just before ROLLBACK) aggregates every FAILing
-- row's block/assertion/expected/actual directly INTO its own RAISE EXCEPTION
-- message text, so a failed run is diagnosable from the exception alone even if
-- an earlier SELECT result was not displayed by your client.
--
-- EXPECTED RESULT: if migration 040's TX-04 correction is installed and correct,
-- every row in the final result set reads status='PASS' and the final
-- hard-failure check does not raise (the transaction still ends in ROLLBACK
-- either way — this file never intends to persist anything, pass or fail).
--
-- UNEXECUTED here: written and statically reviewed (traced against the actual
-- corrected function branches) only. No PostgreSQL execution occurred in the
-- implementing environment (no local Docker/Podman/psql available). NOT run
-- against AUSCIS-TEST by Code — Alex executes this manually and returns
-- results for review, per the owner workflow. No SQL PASS is claimed here.
-- ============================================================

BEGIN;

-- ── Step 0: prerequisite object-existence check — fail fast, before any ──
-- ── fixture is created. See the header note above: this proves the named ──
-- ── objects EXIST, not that their installed body is the corrected version. ──
DO $$
BEGIN
  IF to_regprocedure('public.cbr_tx04_approve_g3(uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: public.cbr_tx04_approve_g3(uuid,uuid,text) does not exist. Install the corrected migration 040 on this database before running this regression file. Aborting before creating any fixture.';
  END IF;
  IF to_regprocedure('public.cbr_tx02_observe_g3(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: public.cbr_tx02_observe_g3(uuid,text) does not exist.';
  END IF;
  IF to_regprocedure('public.cbr_tx03_open_g3_review(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: public.cbr_tx03_open_g3_review(uuid,uuid) does not exist.';
  END IF;
  IF to_regprocedure('cbr_internal.cbr_toggle_gate(text,boolean,uuid)') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: cbr_internal.cbr_toggle_gate(text,boolean,uuid) does not exist.';
  END IF;
  IF to_regprocedure('cbr_internal.cbr_values_equal(text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: cbr_internal.cbr_values_equal(text,text,text) does not exist.';
  END IF;
  IF to_regclass('cbr_internal.cbr_field_gate_state') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: cbr_internal.cbr_field_gate_state does not exist.';
  END IF;
  IF to_regclass('cbr_internal.cbr_field_processing_state') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: cbr_internal.cbr_field_processing_state does not exist.';
  END IF;
  IF to_regclass('public.canonical_beneficiary_records') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: public.canonical_beneficiary_records does not exist.';
  END IF;
  RAISE NOTICE '[OK] all prerequisite objects found (existence only, not body verification) -- proceeding.';
END $$;

-- ── Step 0b: transaction-local results table + recording helper ────────────
-- CREATE TEMP TABLE always lands in the session's own temp schema regardless
-- of search_path -- never a shared/persistent schema -- and is itself ordinary
-- transactional DDL, so ROLLBACK removes it completely (on top of pg_temp's
-- own automatic session-scoped cleanup).
CREATE TEMP TABLE f2_results (
  seq SERIAL PRIMARY KEY,
  block TEXT NOT NULL,
  assertion TEXT NOT NULL,
  expected TEXT,
  actual TEXT,
  status TEXT NOT NULL
);

CREATE OR REPLACE FUNCTION pg_temp.f2_record(p_block TEXT, p_assertion TEXT, p_expected TEXT, p_actual TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO f2_results (block, assertion, expected, actual, status)
  VALUES (p_block, p_assertion, p_expected, p_actual,
    CASE WHEN p_expected IS NOT DISTINCT FROM p_actual THEN 'PASS' ELSE 'FAIL' END);
END;
$$;

-- ── Step 0c: transaction-local fixture helpers, all in pg_temp ─────────────
-- Fixture Auto-Creation Correction (round following the SECOND real
-- AUSCIS-TEST execution): INSERT INTO auth.users fires the REAL,
-- installed on_auth_user_created trigger -> public.handle_new_user()
-- (SECURITY DEFINER, supabase/schema.sql lines 298-317), which itself
-- performs `INSERT INTO public.profiles (id, email, full_name, role)
-- VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name',
-- ''), 'agent')` -- role is HARDCODED to the literal 'agent' by that
-- function; auth.users.raw_user_meta_data has NO effect on role (it only
-- ever feeds full_name). A public.profiles row for this id therefore
-- ALREADY EXISTS by the time this function used to reach its own,
-- separate `INSERT INTO public.profiles`, which collided on the
-- (id) primary key -- SQLSTATE 23505 "duplicate key value violates
-- unique constraint profiles_pkey", confirmed by real AUSCIS-TEST
-- execution. The prior round's `p_role::public.user_role` cast fix
-- (still correct in principle -- profiles.role genuinely is an ENUM, not
-- text) was necessary but not sufficient: it fixed a type error on an
-- INSERT that should never have been attempted in the first place.
--
-- CORRECTED STRATEGY: work WITH the real, installed auto-creation path,
-- not around it. auth.users is inserted exactly as before (this alone
-- is what creates the trigger-generated profiles row, with role='agent'
-- always). The resulting row's actual state is read back explicitly;
-- if the trigger did not create it at all (its own exception handler in
-- schema.sql only logs and swallows failures -- RAISE LOG, then RETURN
-- NEW -- so silent non-creation is possible in principle and must be
-- checked, not assumed), this fails loudly rather than proceeding on a
-- missing row. Only if the trigger-created role differs from the
-- fixture's requested p_role is a minimal, targeted UPDATE performed --
-- never a second INSERT. The enum cast now belongs on that UPDATE
-- (p_role::public.user_role), not on an INSERT that no longer exists.
-- Every postcondition the fixture actually depends on (row exists,
-- email matches, role matches p_role) is verified explicitly at the
-- end, with a loud RAISE EXCEPTION on any mismatch.
CREATE OR REPLACE FUNCTION pg_temp.f2_make_profile(p_role TEXT DEFAULT 'agent')
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_email TEXT := 'cbr-f2-' || v_id || '@example.invalid';
  v_final_email TEXT;
  v_final_role TEXT;
BEGIN
  -- This INSERT alone is what fires on_auth_user_created and creates the
  -- matching public.profiles row (role='agent', always, per that
  -- function's own hardcoded literal) -- no separate profiles INSERT
  -- follows it.
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    VALUES (v_id, v_email, '', now(), now(), now(), 'authenticated', 'authenticated')
    ON CONFLICT DO NOTHING;

  SELECT email, role::TEXT INTO v_final_email, v_final_role FROM public.profiles WHERE id = v_id;
  IF v_final_role IS NULL THEN
    RAISE EXCEPTION 'f2_make_profile: on_auth_user_created did not create a public.profiles row for id=% (trigger-created row not found -- see handle_new_user''s own swallowed-exception handling in schema.sql)', v_id;
  END IF;

  -- Minimum deterministic adjustment: only touch role if the
  -- trigger-created value ('agent') differs from what this fixture
  -- actually needs.
  IF v_final_role IS DISTINCT FROM p_role THEN
    UPDATE public.profiles SET role = p_role::public.user_role WHERE id = v_id;
    SELECT role::TEXT INTO v_final_role FROM public.profiles WHERE id = v_id;
  END IF;

  -- Postcondition, verified explicitly, not assumed: id (by construction
  -- of every lookup above), email, and role must all match what this
  -- fixture actually needs.
  IF v_final_email IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'f2_make_profile: postcondition failed -- expected email=%, actual email=% for id=%', v_email, v_final_email, v_id;
  END IF;
  IF v_final_role IS DISTINCT FROM p_role THEN
    RAISE EXCEPTION 'f2_make_profile: postcondition failed -- expected role=%, actual role=% for id=%', p_role, v_final_role, v_id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.f2_make_client(p_assigned_agent_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  -- clients.first_name/last_name are NOT NULL (schema.sql) -- fixed, known,
  -- non-NULL fixture identity; date_of_birth/middle_name remain NULL unless
  -- separately set by a test.
  INSERT INTO public.clients (first_name, last_name, assigned_agent_id)
    VALUES ('F2Test', 'Client', p_assigned_agent_id) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.f2_make_case(p_client_id UUID)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.cases (client_id, case_type, title) VALUES (p_client_id, 'otro', 'IC Finding 2 regression case')
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.f2_make_invitation(p_case_id UUID, p_client_id UUID, p_email TEXT, p_created_by UUID)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.intake_invitations (token, case_id, client_id, email, created_by)
    VALUES (encode(gen_random_bytes(16), 'hex'), p_case_id, p_client_id, p_email, p_created_by)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- p_confirmed_at defaults to a fixed, safely-early sentinel (2000-01-01), never
-- now()/clock_timestamp() -- every eligible submission below requires
-- confirmed_at <= submitted_at, and submitted_at is anchored to
-- clock_timestamp() at call time (see f2_make_submission below); a fixed,
-- far-past sentinel is guaranteed earlier than any of those.
CREATE OR REPLACE FUNCTION pg_temp.f2_sp_field(
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

-- p_submitted_at defaults to clock_timestamp() (real, per-statement wall time),
-- NOT now() (transaction-start time, frozen for this whole transaction) --
-- cbr_internal.cbr_toggle_gate sets admission_window.opened_at from
-- clock_timestamp() too, and it keeps advancing within this transaction, so a
-- submission created via the default AFTER a gate toggle (in real statement
-- order) must anchor to the same volatile clock, not the frozen transaction
-- start, or it would be timestamped BEFORE the window it needs to fall inside.
CREATE OR REPLACE FUNCTION pg_temp.f2_make_submission(
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

-- ── Step 0d: full-row, existence-distinguishing snapshot helpers ───────────
-- IC follow-up requirement: distinguish "row is missing" from "row exists but
-- its columns happen to be NULL" -- a plain value comparison alone cannot do
-- this (both cases would compare as NULL). Each pair below captures existence
-- and full-row content (via to_jsonb) SEPARATELY, so both are asserted
-- explicitly, before and after, rather than inferred from one another.
CREATE OR REPLACE FUNCTION pg_temp.f2_decision_exists(p_decision_id UUID)
RETURNS BOOLEAN LANGUAGE sql AS $$
  SELECT EXISTS(SELECT 1 FROM public.canonical_beneficiary_records WHERE id = p_decision_id);
$$;

CREATE OR REPLACE FUNCTION pg_temp.f2_decision_snapshot(p_decision_id UUID)
RETURNS JSONB LANGUAGE sql AS $$
  SELECT to_jsonb(cbr) FROM public.canonical_beneficiary_records cbr WHERE cbr.id = p_decision_id;
$$;

CREATE OR REPLACE FUNCTION pg_temp.f2_processing_state_exists(p_client_id UUID, p_field_key TEXT)
RETURNS BOOLEAN LANGUAGE sql AS $$
  SELECT EXISTS(SELECT 1 FROM cbr_internal.cbr_field_processing_state WHERE client_id = p_client_id AND field_key = p_field_key);
$$;

CREATE OR REPLACE FUNCTION pg_temp.f2_processing_state_snapshot(p_client_id UUID, p_field_key TEXT)
RETURNS JSONB LANGUAGE sql AS $$
  SELECT to_jsonb(pcs) FROM cbr_internal.cbr_field_processing_state pcs WHERE pcs.client_id = p_client_id AND pcs.field_key = p_field_key;
$$;

-- Consolidated rejected-attempt invariant check: existence (before/after) and
-- full-row content (before/after, NULL-safe via to_jsonb::TEXT equality) for
-- BOTH the DECISION row and its processing-state row, plus the retained
-- explicit pending-state check (NOT a substitute for the full-row comparison
-- above it -- both are asserted) and the CHANGE_REALIZED-absence check. Callers
-- capture the "before" snapshots themselves (via f2_decision_exists/
-- f2_decision_snapshot/f2_processing_state_exists/f2_processing_state_snapshot
-- above) immediately before invoking TX-04, then pass them in here immediately
-- after. Canonical-value-unchanged is NOT included here (it is field-specific
-- -- a different client column per field_key -- and is asserted by each caller
-- directly).
CREATE OR REPLACE FUNCTION pg_temp.f2_assert_rejected_invariants(
  p_block TEXT, p_client_id UUID, p_field_key TEXT, p_decision_id UUID,
  p_before_dec_exists BOOLEAN, p_before_dec_snapshot JSONB,
  p_before_pcs_exists BOOLEAN, p_before_pcs_snapshot JSONB
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_after_dec_exists BOOLEAN; v_after_dec_snapshot JSONB; v_after_pcs_exists BOOLEAN; v_after_pcs_snapshot JSONB;
BEGIN
  v_after_dec_exists := pg_temp.f2_decision_exists(p_decision_id);
  v_after_dec_snapshot := pg_temp.f2_decision_snapshot(p_decision_id);
  v_after_pcs_exists := pg_temp.f2_processing_state_exists(p_client_id, p_field_key);
  v_after_pcs_snapshot := pg_temp.f2_processing_state_snapshot(p_client_id, p_field_key);

  PERFORM pg_temp.f2_record(p_block, 'decision-exists-before', 'true', p_before_dec_exists::TEXT);
  PERFORM pg_temp.f2_record(p_block, 'decision-exists-after', 'true', v_after_dec_exists::TEXT);
  PERFORM pg_temp.f2_record(p_block, 'decision-full-row-unchanged', p_before_dec_snapshot::TEXT, v_after_dec_snapshot::TEXT);
  -- Retained explicitly per instruction -- NOT treated as a substitute for the
  -- full-row comparison immediately above it.
  PERFORM pg_temp.f2_record(p_block, 'decision-still-pending', 'pending',
    (SELECT decision_state FROM public.canonical_beneficiary_records WHERE id = p_decision_id));
  PERFORM pg_temp.f2_record(p_block, 'no-change-realized', '0',
    (SELECT count(*)::TEXT FROM public.canonical_beneficiary_records WHERE record_type = 'CHANGE_REALIZED' AND related_decision_id = p_decision_id));
  PERFORM pg_temp.f2_record(p_block, 'processing-state-exists-before', 'true', p_before_pcs_exists::TEXT);
  PERFORM pg_temp.f2_record(p_block, 'processing-state-exists-after', 'true', v_after_pcs_exists::TEXT);
  PERFORM pg_temp.f2_record(p_block, 'processing-state-full-row-unchanged', p_before_pcs_snapshot::TEXT, v_after_pcs_snapshot::TEXT);
END;
$$;

-- ============================================================
-- Block 1: exact TEXT match proceeds to APPROVED (firstName)
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client();
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b1@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);

  PERFORM pg_temp.f2_record('B1', 'canonical-precondition', 'F2Test', (SELECT first_name FROM public.clients WHERE id = v_client));

  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('givenName', pg_temp.f2_sp_field('Roberto')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'firstName');
  PERFORM pg_temp.f2_record('B1', 'observe', 'CONFLICT', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B1', 'open', 'OPENED', v_o);

  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'F2Test');
  PERFORM pg_temp.f2_record('B1', 'exact-match-approved', 'APPROVED', v_o);
  PERFORM pg_temp.f2_record('B1', 'canonical-mutated', 'Roberto', (SELECT first_name FROM public.clients WHERE id = v_client));
END $$;

-- ============================================================
-- Block 1b: exact TEXT match, non-NULL canonical, proceeds (middleName —
-- covers "exact TEXT matches" for the third name field, distinct from
-- Block 9's NULL-canonical middleName scenario below)
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client();
  UPDATE public.clients SET middle_name = 'Andrea' WHERE id = v_client;
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b1b@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);

  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f2_sp_field('Beatriz')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  PERFORM pg_temp.f2_record('B1b', 'observe', 'CONFLICT', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B1b', 'open', 'OPENED', v_o);

  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'Andrea');
  PERFORM pg_temp.f2_record('B1b', 'exact-match-approved', 'APPROVED', v_o);
  PERFORM pg_temp.f2_record('B1b', 'canonical-mutated', 'Beatriz', (SELECT middle_name FROM public.clients WHERE id = v_client));
END $$;

-- ============================================================
-- Block 2: LEADING whitespace mismatch -> STALE_PRIOR_VALUE (firstName)
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
        v_before_canon TEXT; v_before_dec_exists BOOLEAN; v_before_dec_snapshot JSONB;
        v_before_pcs_exists BOOLEAN; v_before_pcs_snapshot JSONB;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client();
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b2@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);

  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('givenName', pg_temp.f2_sp_field('Marco')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'firstName');
  PERFORM pg_temp.f2_record('B2', 'observe', 'CONFLICT', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B2', 'open', 'OPENED', v_o);

  SELECT first_name INTO v_before_canon FROM public.clients WHERE id = v_client;
  v_before_dec_exists := pg_temp.f2_decision_exists(v_dec);
  v_before_dec_snapshot := pg_temp.f2_decision_snapshot(v_dec);
  v_before_pcs_exists := pg_temp.f2_processing_state_exists(v_client, 'firstName');
  v_before_pcs_snapshot := pg_temp.f2_processing_state_snapshot(v_client, 'firstName');

  -- Reviewer's supplied expectation has a LEADING space; canonical is exactly 'F2Test'.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, ' F2Test');
  PERFORM pg_temp.f2_record('B2', 'leading-whitespace-mismatch-stale', 'STALE_PRIOR_VALUE', v_o);

  PERFORM pg_temp.f2_record('B2', 'canonical-unchanged', v_before_canon, (SELECT first_name FROM public.clients WHERE id = v_client));
  PERFORM pg_temp.f2_assert_rejected_invariants('B2', v_client, 'firstName', v_dec,
    v_before_dec_exists, v_before_dec_snapshot, v_before_pcs_exists, v_before_pcs_snapshot);

  -- Recovery: exact value proceeds.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'F2Test');
  PERFORM pg_temp.f2_record('B2', 'corrected-resupply-approved', 'APPROVED', v_o);
END $$;

-- ============================================================
-- Block 3: TRAILING whitespace mismatch -> STALE_PRIOR_VALUE (lastName)
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
        v_before_canon TEXT; v_before_dec_exists BOOLEAN; v_before_dec_snapshot JSONB;
        v_before_pcs_exists BOOLEAN; v_before_pcs_snapshot JSONB;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client();
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b3@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);

  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('familyName', pg_temp.f2_sp_field('Gomez')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'lastName');
  PERFORM pg_temp.f2_record('B3', 'observe', 'CONFLICT', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B3', 'open', 'OPENED', v_o);

  SELECT last_name INTO v_before_canon FROM public.clients WHERE id = v_client;
  v_before_dec_exists := pg_temp.f2_decision_exists(v_dec);
  v_before_dec_snapshot := pg_temp.f2_decision_snapshot(v_dec);
  v_before_pcs_exists := pg_temp.f2_processing_state_exists(v_client, 'lastName');
  v_before_pcs_snapshot := pg_temp.f2_processing_state_snapshot(v_client, 'lastName');

  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'Client ');
  PERFORM pg_temp.f2_record('B3', 'trailing-whitespace-mismatch-stale', 'STALE_PRIOR_VALUE', v_o);

  PERFORM pg_temp.f2_record('B3', 'canonical-unchanged', v_before_canon, (SELECT last_name FROM public.clients WHERE id = v_client));
  PERFORM pg_temp.f2_assert_rejected_invariants('B3', v_client, 'lastName', v_dec,
    v_before_dec_exists, v_before_dec_snapshot, v_before_pcs_exists, v_before_pcs_snapshot);

  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'Client');
  PERFORM pg_temp.f2_record('B3', 'corrected-resupply-approved', 'APPROVED', v_o);
END $$;

-- ============================================================
-- Block 4: LEADING + TRAILING whitespace mismatch -> STALE_PRIOR_VALUE (middleName)
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
        v_before_canon TEXT; v_before_dec_exists BOOLEAN; v_before_dec_snapshot JSONB;
        v_before_pcs_exists BOOLEAN; v_before_pcs_snapshot JSONB;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client();
  UPDATE public.clients SET middle_name = 'Solange' WHERE id = v_client;
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b4@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);

  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f2_sp_field('Isabel')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  PERFORM pg_temp.f2_record('B4', 'observe', 'CONFLICT', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B4', 'open', 'OPENED', v_o);

  SELECT middle_name INTO v_before_canon FROM public.clients WHERE id = v_client;
  v_before_dec_exists := pg_temp.f2_decision_exists(v_dec);
  v_before_dec_snapshot := pg_temp.f2_decision_snapshot(v_dec);
  v_before_pcs_exists := pg_temp.f2_processing_state_exists(v_client, 'middleName');
  v_before_pcs_snapshot := pg_temp.f2_processing_state_snapshot(v_client, 'middleName');

  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, '  Solange  ');
  PERFORM pg_temp.f2_record('B4', 'both-sides-whitespace-mismatch-stale', 'STALE_PRIOR_VALUE', v_o);

  PERFORM pg_temp.f2_record('B4', 'canonical-unchanged', v_before_canon, (SELECT middle_name FROM public.clients WHERE id = v_client));
  PERFORM pg_temp.f2_assert_rejected_invariants('B4', v_client, 'middleName', v_dec,
    v_before_dec_exists, v_before_dec_snapshot, v_before_pcs_exists, v_before_pcs_snapshot);
END $$;

-- ============================================================
-- Block 5: case mismatch -> STALE_PRIOR_VALUE (firstName)
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
        v_before_canon TEXT; v_before_dec_exists BOOLEAN; v_before_dec_snapshot JSONB;
        v_before_pcs_exists BOOLEAN; v_before_pcs_snapshot JSONB;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client();
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b5@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);

  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('givenName', pg_temp.f2_sp_field('Fernanda')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'firstName');
  PERFORM pg_temp.f2_record('B5', 'observe', 'CONFLICT', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B5', 'open', 'OPENED', v_o);

  SELECT first_name INTO v_before_canon FROM public.clients WHERE id = v_client;
  v_before_dec_exists := pg_temp.f2_decision_exists(v_dec);
  v_before_dec_snapshot := pg_temp.f2_decision_snapshot(v_dec);
  v_before_pcs_exists := pg_temp.f2_processing_state_exists(v_client, 'firstName');
  v_before_pcs_snapshot := pg_temp.f2_processing_state_snapshot(v_client, 'firstName');

  -- Canonical is exactly 'F2Test'; reviewer supplies a differently-cased string.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'f2test');
  PERFORM pg_temp.f2_record('B5', 'case-mismatch-stale', 'STALE_PRIOR_VALUE', v_o);

  PERFORM pg_temp.f2_record('B5', 'canonical-unchanged', v_before_canon, (SELECT first_name FROM public.clients WHERE id = v_client));
  PERFORM pg_temp.f2_assert_rejected_invariants('B5', v_client, 'firstName', v_dec,
    v_before_dec_exists, v_before_dec_snapshot, v_before_pcs_exists, v_before_pcs_snapshot);
END $$;

-- ============================================================
-- Block 6: case mismatch -> STALE_PRIOR_VALUE (lastName), with recovery
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
        v_before_canon TEXT; v_before_dec_exists BOOLEAN; v_before_dec_snapshot JSONB;
        v_before_pcs_exists BOOLEAN; v_before_pcs_snapshot JSONB;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client();
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b6@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);

  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('familyName', pg_temp.f2_sp_field('Duarte')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'lastName');
  PERFORM pg_temp.f2_record('B6', 'observe', 'CONFLICT', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B6', 'open', 'OPENED', v_o);

  SELECT last_name INTO v_before_canon FROM public.clients WHERE id = v_client;
  v_before_dec_exists := pg_temp.f2_decision_exists(v_dec);
  v_before_dec_snapshot := pg_temp.f2_decision_snapshot(v_dec);
  v_before_pcs_exists := pg_temp.f2_processing_state_exists(v_client, 'lastName');
  v_before_pcs_snapshot := pg_temp.f2_processing_state_snapshot(v_client, 'lastName');

  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'CLIENT');
  PERFORM pg_temp.f2_record('B6', 'case-mismatch-stale', 'STALE_PRIOR_VALUE', v_o);

  PERFORM pg_temp.f2_record('B6', 'canonical-unchanged', v_before_canon, (SELECT last_name FROM public.clients WHERE id = v_client));
  PERFORM pg_temp.f2_assert_rejected_invariants('B6', v_client, 'lastName', v_dec,
    v_before_dec_exists, v_before_dec_snapshot, v_before_pcs_exists, v_before_pcs_snapshot);

  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'Client');
  PERFORM pg_temp.f2_record('B6', 'corrected-resupply-approved', 'APPROVED', v_o);
END $$;

-- ============================================================
-- Block 7: NULL expected vs NON-NULL canonical -> STALE_PRIOR_VALUE (middleName)
-- (direction 1 of "both directions of NULL versus non-NULL")
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
        v_before_canon TEXT; v_before_dec_exists BOOLEAN; v_before_dec_snapshot JSONB;
        v_before_pcs_exists BOOLEAN; v_before_pcs_snapshot JSONB;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client();
  UPDATE public.clients SET middle_name = 'Teodoro' WHERE id = v_client;
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b7@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);

  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f2_sp_field('Bautista')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  PERFORM pg_temp.f2_record('B7', 'observe', 'CONFLICT', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B7', 'open', 'OPENED', v_o);

  SELECT middle_name INTO v_before_canon FROM public.clients WHERE id = v_client;
  v_before_dec_exists := pg_temp.f2_decision_exists(v_dec);
  v_before_dec_snapshot := pg_temp.f2_decision_snapshot(v_dec);
  v_before_pcs_exists := pg_temp.f2_processing_state_exists(v_client, 'middleName');
  v_before_pcs_snapshot := pg_temp.f2_processing_state_snapshot(v_client, 'middleName');

  -- Reviewer supplies NULL against a non-NULL canonical ('Teodoro').
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, NULL);
  PERFORM pg_temp.f2_record('B7', 'null-expected-vs-nonnull-canonical-stale', 'STALE_PRIOR_VALUE', v_o);

  PERFORM pg_temp.f2_record('B7', 'canonical-unchanged', v_before_canon, (SELECT middle_name FROM public.clients WHERE id = v_client));
  PERFORM pg_temp.f2_assert_rejected_invariants('B7', v_client, 'middleName', v_dec,
    v_before_dec_exists, v_before_dec_snapshot, v_before_pcs_exists, v_before_pcs_snapshot);
END $$;

-- ============================================================
-- Block 8: NON-NULL expected vs NULL canonical -> STALE_PRIOR_VALUE (middleName)
-- (direction 2 of "both directions of NULL versus non-NULL")
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
        v_before_canon TEXT; v_before_dec_exists BOOLEAN; v_before_dec_snapshot JSONB;
        v_before_pcs_exists BOOLEAN; v_before_pcs_snapshot JSONB;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client(); -- middle_name NULL by default
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b8@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM pg_temp.f2_record('B8', 'canonical-null-precondition', 'true', (SELECT (middle_name IS NULL)::TEXT FROM public.clients WHERE id = v_client));

  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f2_sp_field('Xavier')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  PERFORM pg_temp.f2_record('B8', 'observe', 'OBSERVED', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B8', 'open', 'OPENED', v_o);

  SELECT middle_name INTO v_before_canon FROM public.clients WHERE id = v_client;
  v_before_dec_exists := pg_temp.f2_decision_exists(v_dec);
  v_before_dec_snapshot := pg_temp.f2_decision_snapshot(v_dec);
  v_before_pcs_exists := pg_temp.f2_processing_state_exists(v_client, 'middleName');
  v_before_pcs_snapshot := pg_temp.f2_processing_state_snapshot(v_client, 'middleName');

  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'SomeOtherValue');
  PERFORM pg_temp.f2_record('B8', 'nonnull-expected-vs-null-canonical-stale', 'STALE_PRIOR_VALUE', v_o);

  PERFORM pg_temp.f2_record('B8', 'canonical-unchanged', v_before_canon, (SELECT middle_name FROM public.clients WHERE id = v_client));
  PERFORM pg_temp.f2_assert_rejected_invariants('B8', v_client, 'middleName', v_dec,
    v_before_dec_exists, v_before_dec_snapshot, v_before_pcs_exists, v_before_pcs_snapshot);
END $$;

-- ============================================================
-- Block 9: both NULL operands proceed (middleName)
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client();
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b9@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM pg_temp.f2_record('B9', 'canonical-null-precondition', 'true', (SELECT (middle_name IS NULL)::TEXT FROM public.clients WHERE id = v_client));

  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f2_sp_field('Ines')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  PERFORM pg_temp.f2_record('B9', 'observe', 'OBSERVED', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B9', 'open', 'OPENED', v_o);

  -- NULL IS DISTINCT FROM NULL is FALSE ("not distinct") -> proceeds.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, NULL);
  PERFORM pg_temp.f2_record('B9', 'both-null-approved', 'APPROVED', v_o);
  PERFORM pg_temp.f2_record('B9', 'canonical-mutated', 'Ines', (SELECT middle_name FROM public.clients WHERE id = v_client));
END $$;

-- ============================================================
-- Block 10: dateOfBirth both NULL -> proceeds
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client();
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b10@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM pg_temp.f2_record('B10', 'canonical-null-precondition', 'true', (SELECT (date_of_birth IS NULL)::TEXT FROM public.clients WHERE id = v_client));

  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('dateOfBirth', pg_temp.f2_sp_field('1985-05-05')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'dateOfBirth');
  PERFORM pg_temp.f2_record('B10', 'observe', 'OBSERVED', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B10', 'open', 'OPENED', v_o);

  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, NULL);
  PERFORM pg_temp.f2_record('B10', 'dob-both-null-approved', 'APPROVED', v_o);
  PERFORM pg_temp.f2_record('B10', 'dob-mutated', '1985-05-05', (SELECT date_of_birth::TEXT FROM public.clients WHERE id = v_client));
END $$;

-- ============================================================
-- Block 11: valid matching DATE (exact YYYY-MM-DD) -> APPROVED;
-- malformed-but-plausible '1990-1-1' -> INVALID_EXPECTED_VALUE. Corrected
-- this round: STEP 8b's regex ^\d{4}-\d{2}-\d{2}$ requires exactly two
-- digits for month and day; '1990-1-1' does NOT match it and must be
-- rejected as a format error, never treated as a tolerated equivalent of
-- '1990-01-01'. The prior round's test incorrectly expected APPROVED for
-- '1990-1-1' and is corrected here; production validation is NOT weakened
-- to accommodate that error -- the fix is entirely in this test.
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
        v_before_canon TEXT; v_before_dec_exists BOOLEAN; v_before_dec_snapshot JSONB;
        v_before_pcs_exists BOOLEAN; v_before_pcs_snapshot JSONB;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client();
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b11@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  UPDATE public.clients SET date_of_birth = '1990-01-01' WHERE id = v_client;

  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('dateOfBirth', pg_temp.f2_sp_field('1992-02-02')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'dateOfBirth');
  PERFORM pg_temp.f2_record('B11', 'observe', 'CONFLICT', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B11', 'open', 'OPENED', v_o);

  SELECT date_of_birth::TEXT INTO v_before_canon FROM public.clients WHERE id = v_client;
  v_before_dec_exists := pg_temp.f2_decision_exists(v_dec);
  v_before_dec_snapshot := pg_temp.f2_decision_snapshot(v_dec);
  v_before_pcs_exists := pg_temp.f2_processing_state_exists(v_client, 'dateOfBirth');
  v_before_pcs_snapshot := pg_temp.f2_processing_state_snapshot(v_client, 'dateOfBirth');

  -- '1990-1-1' does not match ^\d{4}-\d{2}-\d{2}$ (month/day must be two
  -- digits) -> rejected at the FORMAT check, before any DATE cast or
  -- comparison is attempted -> INVALID_EXPECTED_VALUE, not APPROVED.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, '1990-1-1');
  PERFORM pg_temp.f2_record('B11', 'malformed-non-zero-padded-date-invalid', 'INVALID_EXPECTED_VALUE', v_o);

  PERFORM pg_temp.f2_record('B11', 'canonical-unchanged-after-malformed', v_before_canon, (SELECT date_of_birth::TEXT FROM public.clients WHERE id = v_client));
  PERFORM pg_temp.f2_assert_rejected_invariants('B11', v_client, 'dateOfBirth', v_dec,
    v_before_dec_exists, v_before_dec_snapshot, v_before_pcs_exists, v_before_pcs_snapshot);

  -- Recovery: exact YYYY-MM-DD, matching current canonical, proceeds.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, '1990-01-01');
  PERFORM pg_temp.f2_record('B11', 'valid-zero-padded-matching-date-approved', 'APPROVED', v_o);
  PERFORM pg_temp.f2_record('B11', 'dob-mutated', '1992-02-02', (SELECT date_of_birth::TEXT FROM public.clients WHERE id = v_client));
END $$;

-- ============================================================
-- Block 11b: valid, correctly-formatted, but DIFFERING DATE -> STALE_PRIOR_VALUE
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
        v_before_canon TEXT; v_before_dec_exists BOOLEAN; v_before_dec_snapshot JSONB;
        v_before_pcs_exists BOOLEAN; v_before_pcs_snapshot JSONB;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client();
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b11b@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  UPDATE public.clients SET date_of_birth = '1990-01-01' WHERE id = v_client;

  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('dateOfBirth', pg_temp.f2_sp_field('1992-02-02')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'dateOfBirth');
  PERFORM pg_temp.f2_record('B11B', 'observe', 'CONFLICT', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B11B', 'open', 'OPENED', v_o);

  SELECT date_of_birth::TEXT INTO v_before_canon FROM public.clients WHERE id = v_client;
  v_before_dec_exists := pg_temp.f2_decision_exists(v_dec);
  v_before_dec_snapshot := pg_temp.f2_decision_snapshot(v_dec);
  v_before_pcs_exists := pg_temp.f2_processing_state_exists(v_client, 'dateOfBirth');
  v_before_pcs_snapshot := pg_temp.f2_processing_state_snapshot(v_client, 'dateOfBirth');

  -- Valid, correctly-formatted, but DIFFERENT date -> STALE_PRIOR_VALUE.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, '1991-06-15');
  PERFORM pg_temp.f2_record('B11B', 'valid-differing-date-stale', 'STALE_PRIOR_VALUE', v_o);

  PERFORM pg_temp.f2_record('B11B', 'canonical-unchanged', v_before_canon, (SELECT date_of_birth::TEXT FROM public.clients WHERE id = v_client));
  PERFORM pg_temp.f2_assert_rejected_invariants('B11B', v_client, 'dateOfBirth', v_dec,
    v_before_dec_exists, v_before_dec_snapshot, v_before_pcs_exists, v_before_pcs_snapshot);
END $$;

-- ============================================================
-- Block 12: invalid calendar date -> INVALID_EXPECTED_VALUE
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
        v_before_canon TEXT; v_before_dec_exists BOOLEAN; v_before_dec_snapshot JSONB;
        v_before_pcs_exists BOOLEAN; v_before_pcs_snapshot JSONB;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client();
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b12@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  UPDATE public.clients SET date_of_birth = '1990-01-01' WHERE id = v_client;

  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('dateOfBirth', pg_temp.f2_sp_field('1992-02-02')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'dateOfBirth');
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B12', 'open', 'OPENED', v_o);

  SELECT date_of_birth::TEXT INTO v_before_canon FROM public.clients WHERE id = v_client;
  v_before_dec_exists := pg_temp.f2_decision_exists(v_dec);
  v_before_dec_snapshot := pg_temp.f2_decision_snapshot(v_dec);
  v_before_pcs_exists := pg_temp.f2_processing_state_exists(v_client, 'dateOfBirth');
  v_before_pcs_snapshot := pg_temp.f2_processing_state_snapshot(v_client, 'dateOfBirth');

  -- Shape-valid (matches ^\d{4}-\d{2}-\d{2}$) but calendar-invalid (Feb 30 does not exist).
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, '2024-02-30');
  PERFORM pg_temp.f2_record('B12', 'invalid-calendar', 'INVALID_EXPECTED_VALUE', v_o);
  PERFORM pg_temp.f2_record('B12', 'canonical-unchanged', v_before_canon, (SELECT date_of_birth::TEXT FROM public.clients WHERE id = v_client));
  PERFORM pg_temp.f2_assert_rejected_invariants('B12', v_client, 'dateOfBirth', v_dec,
    v_before_dec_exists, v_before_dec_snapshot, v_before_pcs_exists, v_before_pcs_snapshot);

  -- Recovery: reviewer resupplies the correct current value -> proceeds (confirms the
  -- decision was never corrupted by the invalid attempt above).
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, '1990-01-01');
  PERFORM pg_temp.f2_record('B12', 'recovery-approved', 'APPROVED', v_o);
END $$;

-- ============================================================
-- Block 13: open-time snapshot A, current canonical B
-- Proves TX-04 compares against the LIVE canonical value, never
-- DECISION.expected_prior_value (the immutable open-time snapshot).
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT; v_snapshot TEXT;
        v_before_dec_exists BOOLEAN; v_before_dec_snapshot JSONB;
        v_before_pcs_exists BOOLEAN; v_before_pcs_snapshot JSONB;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client();
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b13@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  -- canonical = A ('Client', f2_make_client()'s default last_name) at open time.
  PERFORM pg_temp.f2_record('B13', 'canonical-is-A', 'Client', (SELECT last_name FROM public.clients WHERE id = v_client));

  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('familyName', pg_temp.f2_sp_field('Vargas')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'lastName');
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B13', 'open', 'OPENED', v_o);

  -- DECISION's own open-time snapshot must equal A -- captured for reference only;
  -- TX-04 must NOT read this column as its comparison operand.
  SELECT expected_prior_value INTO v_snapshot FROM public.canonical_beneficiary_records WHERE id = v_dec;
  PERFORM pg_temp.f2_record('B13', 'snapshot-is-A', 'Client', v_snapshot);

  -- Canonical independently changes to B (e.g. a staff correction made via a
  -- different path, after the review was opened but before this approval --
  -- this is also, more generally, an instance of "the value most recently
  -- displayed to the reviewer" diverging from the open-time snapshot).
  UPDATE public.clients SET last_name = 'Restrepo' WHERE id = v_client; -- canonical is now B

  v_before_dec_exists := pg_temp.f2_decision_exists(v_dec);
  v_before_dec_snapshot := pg_temp.f2_decision_snapshot(v_dec);
  v_before_pcs_exists := pg_temp.f2_processing_state_exists(v_client, 'lastName');
  v_before_pcs_snapshot := pg_temp.f2_processing_state_snapshot(v_client, 'lastName');

  -- Supplying the STALE open-time snapshot (A) must be rejected, even though it exactly
  -- matches DECISION.expected_prior_value -- proving A alone is not treated as valid.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'Client');
  PERFORM pg_temp.f2_record('B13', 'stale-snapshot-A-rejected', 'STALE_PRIOR_VALUE', v_o);

  PERFORM pg_temp.f2_record('B13', 'canonical-still-B', 'Restrepo', (SELECT last_name FROM public.clients WHERE id = v_client));
  PERFORM pg_temp.f2_assert_rejected_invariants('B13', v_client, 'lastName', v_dec,
    v_before_dec_exists, v_before_dec_snapshot, v_before_pcs_exists, v_before_pcs_snapshot);

  -- Supplying the CURRENT live canonical value (B) proceeds.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'Restrepo');
  PERFORM pg_temp.f2_record('B13', 'current-B-approved', 'APPROVED', v_o);
END $$;

-- ============================================================
-- Block 14: STEP 10 retains approved candidate/canonical equality semantics
-- Isolated proof that STEP 10 (candidate-vs-canonical, decides whether to
-- mutate) is UNCHANGED by this correction -- it still uses the centralized,
-- trimmed cbr_values_equal() rule, distinct from STEP 8b's now-strict
-- IS DISTINCT FROM check. Constructed via a direct, trigger-respecting UPDATE
-- to canonical (not a TX-0x call) to introduce a residual-whitespace canonical
-- value -- no trigger disabled, no constraint weakened.
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
BEGIN
  v_admin := pg_temp.f2_make_profile('admin');
  v_client := pg_temp.f2_make_client();
  v_case := pg_temp.f2_make_case(v_client);
  v_inv := pg_temp.f2_make_invitation(v_case, v_client, 'f2-b14@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);

  -- middle_name starts NULL -> OBSERVED (not CONFLICT), candidate_value bound exactly.
  v_sub := pg_temp.f2_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f2_sp_field('Xavier')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  PERFORM pg_temp.f2_record('B14', 'observe', 'OBSERVED', v_o);
  PERFORM pg_temp.f2_record('B14', 'candidate-value-exact', 'Xavier', (SELECT candidate_value FROM public.canonical_beneficiary_records WHERE id = v_obs));
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f2_record('B14', 'open', 'OPENED', v_o);

  -- Independently introduce residual whitespace on the canonical side.
  UPDATE public.clients SET middle_name = '  Xavier  ' WHERE id = v_client;

  -- Reviewer supplies the exact, current (padded) canonical value for STEP 8b.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, '  Xavier  ');
  PERFORM pg_temp.f2_record('B14', 'approved', 'APPROVED', v_o);

  -- STEP 10 must still treat candidate 'Xavier' and canonical '  Xavier  ' as EQUAL
  -- (trimmed comparison, unchanged) -> mutation skipped -> canonical remains padded,
  -- NOT overwritten to the trimmed candidate, and no CHANGE_REALIZED row is created.
  PERFORM pg_temp.f2_record('B14', 'step10-mutation-skipped-canonical-unchanged', '  Xavier  ', (SELECT middle_name FROM public.clients WHERE id = v_client));
  PERFORM pg_temp.f2_record('B14', 'step10-no-change-realized-row', '0', (SELECT count(*)::TEXT FROM public.canonical_beneficiary_records WHERE record_type='CHANGE_REALIZED' AND related_decision_id = v_dec));
END $$;

-- ============================================================
-- Results: readable result set, returned before the final hard-failure check.
-- ============================================================
SELECT seq, block, assertion, expected, actual, status FROM f2_results ORDER BY seq;

SELECT
  count(*) FILTER (WHERE status = 'PASS') AS pass_count,
  count(*) FILTER (WHERE status = 'FAIL') AS fail_count,
  count(*) AS total_count
FROM f2_results;

-- ── Final hard-failure check: raises (a genuine error, not a notice) if ANY ──
-- ── assertion above recorded FAIL. The failing block/assertion/expected/    ──
-- ── actual detail is built directly INTO the exception message itself, so   ──
-- ── a failed run remains diagnosable from the exception alone even if the   ──
-- ── SELECTs above are not displayed by your particular SQL client.          ──
DO $$
DECLARE v_fail_count INT; v_detail TEXT;
BEGIN
  SELECT count(*), string_agg(format('[%s] %s: expected=%s actual=%s', block, assertion, expected, actual), E'\n' ORDER BY seq)
    INTO v_fail_count, v_detail
    FROM f2_results WHERE status = 'FAIL';
  IF v_fail_count > 0 THEN
    RAISE EXCEPTION '% assertion(s) FAILED:%', v_fail_count, (E'\n' || v_detail);
  END IF;
  RAISE NOTICE '[OK] all % assertions PASSED.', (SELECT count(*) FROM f2_results);
END $$;

-- Always ends here, pass or fail: nothing this file did is intended to persist.
-- If the hard-failure check above raised, this session's transaction is
-- already aborted -- ROLLBACK is still the correct, safe next statement (see
-- the header comment above for what to do if you reach this file's end with
-- an already-aborted transaction).
ROLLBACK;
