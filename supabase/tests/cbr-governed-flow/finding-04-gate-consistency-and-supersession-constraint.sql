-- ============================================================
-- IC Targeted Correction 4 of 6 (v3, corrected) — AC-10(direction 2,
-- remaining 3 subcases), AC-71 (all 10 supersession-constraint
-- combinations), AC-73 (gate-init idempotency, full-row/window
-- invariants), AC-74/AC-75 (fail-closed missing gate rows for
-- TX-01, TX-02, TX-03, TX-04, TX-05)
-- ============================================================
-- Governing authority: approved CBR Consolidated Design, §F (gate
-- consistency/initialization), §E.3/§E.6 (NULL-safe supersession
-- constraint), §M AC-10/AC-71/AC-73/AC-74/AC-75.
--
-- TARGET: AUSCIS-TEST (the designated modifying-test environment). ACTIONUSA AI
-- is the principal project and must NEVER be targeted or modified by this file.
--
-- CORRECTIONS IN THIS ROUND (v2), each source-confirmed before being fixed —
-- see the accompanying change report for the full explanation of each:
--   1. AC-71's (NULL,non-NULL) case previously UPDATEd an existing
--      CANDIDATE_OBSERVED row. Traced against the actual trigger source
--      (cbr_internal.cbr_validate_relationship, migration 040 lines
--      171-236): on UPDATE, clause (2) fires first because
--      superseded_by_submission_id differs from OLD, OLD.decision_state
--      (NULL) IS DISTINCT FROM 'pending', so CBR_TERMINAL_REWRITE_VIOLATION
--      is raised -- NOT check_violation -- before cbr_superseded_by_required
--      is ever reached. Replaced with an otherwise-valid INSERT of a NEW
--      CANDIDATE_OBSERVED row (decision_state=NULL from creation, never an
--      UPDATE) -- the trigger's INSERT branch does not examine
--      decision_state/superseded_by_submission_id for a non-DECISION,
--      non-CONFLICT_DETECTED row at all, so this INSERT reaches the CHECK
--      constraint directly.
--   2. AC-73 previously asserted only the `enabled` column. Now captures
--      the complete gate row (to_jsonb) and the complete admission-window
--      state for the gate, both immediately before the initialization
--      statement (after the enabled=true fixture is established) and
--      after, and asserts full-row/full-window-set equality.
--   3. AC-74/75 previously covered only TX-01 and TX-05. Extended to
--      TX-02 (which checks TWO gate rows sequentially -- g3_observation
--      then g3_staff_resolution, migration 040 lines 613-617 -- so BOTH
--      "g3_observation missing" and "g3_observation present but
--      g3_staff_resolution missing" are distinct, separately-reachable
--      code paths, both tested), TX-03 (single g3_staff_resolution check,
--      line 835-836), and TX-04 (single g3_staff_resolution check, line
--      918-919). Each new case uses a REAL, valid, otherwise-would-write
--      fixture (a genuine eligible submission for TX-02; a genuine
--      CANDIDATE_OBSERVED row for TX-03; a genuine pending DECISION for
--      TX-04) so the accompanying no-write assertions are meaningful --
--      not vacuously true against fixtures that could never have produced
--      a write regardless of the gate check.
--   4. Every branching assertion (gate-window-inconsistency cases, AC-71's
--      rejection cases) now captures its outcome into a variable inside a
--      BEGIN/EXCEPTION block and records it with exactly ONE
--      pg_temp.f4_record call afterward -- never two alternate call sites
--      for the same logical case -- so the static count of f4_record call
--      sites in this file equals the exact number of result rows a single
--      successful run produces, with no ambiguity. This count is computed
--      and asserted explicitly at the end of this file (see the final
--      validation block).
--   5. Block A's window handling now captures the inserted admission_window
--      row's own id (RETURNING id) and deletes ONLY that row afterward --
--      never a blanket DELETE ... WHERE gate = '...', which could have
--      removed a legitimate, pre-existing (e.g. closed) window row for that
--      gate if one already existed in AUSCIS-TEST's real history. (Note:
--      cbr_field_admission_window.gate has CHECK (gate IN ('g1g2',
--      'g3_observation')) -- 'g3_staff_resolution' is never a valid window
--      row key; the ONE compound g3 window row, keyed 'g3_observation', is
--      what cbr_toggle_gate's own consistency check reads regardless of
--      which of the two g3 flags p_gate names (migration 040 lines
--      303-307) -- confirmed from source, not assumed; the prior round's
--      draft would have attempted an invalid gate='g3_staff_resolution'
--      window INSERT and failed the table's own CHECK constraint before
--      ever reaching the intended assertion.)
--   6. A hard, file-wide precondition check (Step 0c) now RAISES if not
--      every gate is enabled=false and no admission window is open at file
--      start -- this file no longer merely records a failed precondition
--      and continues building further assertions on top of a wrong
--      starting state.
--   7. This transaction now sets LOCAL lock_timeout and statement_timeout
--      (Step 0a) so that, if it is ever blocked by a genuinely concurrent
--      real session holding one of the few rows this file locks, it fails
--      fast with a clear Postgres error instead of hanging indefinitely
--      against a shared project. The prior round's unverified claim that
--      "this transaction is expected to run in well under a second" and
--      that "the worst case is a few seconds' delay" is withdrawn -- actual
--      duration under contention was never measured and is not asserted;
--      the timeouts below are what actually bounds the worst case, not an
--      expectation about timing.
--
-- CORRECTIONS IN THIS ROUND (v3), each source-confirmed before being fixed:
--   8. D4 and D5 (TX-03 and TX-04 missing-gate cases) created their
--      submission fixture BEFORE opening the compound g3 admission window.
--      f4_make_submission's default submitted_at and cbr_toggle_gate's
--      opened_at both use clock_timestamp() at their own respective call
--      time, so the submission's event time preceded its own window.
--      TX-02's STEP 10 (migration 040 lines 697-702) requires
--      opened_at <= submitted_at, so these fixtures produced
--      ADMISSION_BOUNDARY, not OBSERVED -- confirmed by tracing the actual
--      check before fixing it, not merely accepting the report. Fixed:
--      client/case/invitation are created first, the compound window is
--      opened next (with a hard-checked TOGGLED outcome), THEN the
--      submission is created, and its submitted_at is explicitly compared
--      against the window's own opened_at before TX-02 is ever called.
--      Every setup step (both toggles, the window-membership check, the
--      TX-02 call, and -- in D5/D6 -- the TX-03 call) now RAISEs
--      immediately on any unexpected outcome or NULL id, rather than
--      recording a FAIL and continuing to build further "unchanged"
--      assertions against a fixture that was never actually created.
--      D6 (TX-05) is rebuilt on the same corrected chronology, replacing
--      the prior round's fabricated, nonexistent decision_id with a real
--      pending DECISION.
--   9. D1-D3 now additionally assert the tested field's own canonical
--      client-table value is unchanged before/after the gate-missing call.
--  10. D4 and D6's no-write assertions now compare the fixture's FULL
--      canonical_beneficiary_records set (scoped to that fixture's own
--      client_id, via jsonb_agg), not only a DECISION-row count (D4) or
--      nothing at all (D6). D5 retains every previously-requested
--      decision/canonical/processing-state assertion and adds the same
--      full-set comparison alongside them.
--   11. The expected assertion count (final validation block) is
--      recalculated from this round's actual execution paths -- 71, not
--      54 -- computed mechanically (grep-based call-site counting,
--      cross-checked against the procedure-call fan-out), not retained
--      from the prior round merely to avoid recalculating it.
--
-- PREREQUISITE: the reviewed, installed migration 040 must ALREADY be
-- installed on the target database. This file does not install it. Step 0
-- below checks that the required objects EXIST before creating any
-- fixture, and fails immediately, with a clear message, if they do not.
-- This is an OBJECT-EXISTENCE check only.
--
-- SELF-CONTAINED: every helper this file needs is defined here, scoped to
-- `pg_temp`. It does NOT assume any `cbr_test` schema exists, does NOT
-- create, drop, or overwrite one, and has no dependency on 00-helpers.sql
-- or any other file.
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
--   - EVERYTHING happens inside that one transaction, and the file ends with
--     an explicit ROLLBACK. Nothing persists after this file finishes.
--   - IF EXECUTION FAILS PARTWAY: your session's transaction is left OPEN and
--     ABORTED. Run `ROLLBACK;` as its own, separate statement right away.
--   - No trigger is disabled and no constraint is weakened anywhere in this
--     file.
--   - lock_timeout=5s / statement_timeout=30s are set LOCAL to this
--     transaction only (Step 0a) -- they revert automatically at ROLLBACK
--     and never affect any other session or any later use of this same
--     session.
--
-- RESULTS: every assertion is recorded as a row in a temporary results table,
-- and a full SELECT over that table is returned before the final
-- hard-failure check runs. The final validation checks BOTH fail_count=0
-- AND total_count equals the exact expected count computed from this file's
-- own corrected execution paths (see the final block) -- a silently-skipped
-- assertion (e.g. a branch that never ran) is therefore also caught, not
-- only an explicit FAIL.
--
-- EXPECTED RESULT: if migration 040 is installed and behaves as reviewed,
-- every row in the final result set reads status='PASS', fail_count=0, and
-- total_count matches the asserted expected value.
--
-- UNEXECUTED here: written and statically reviewed (traced against the
-- actual production function branches, including this round's direct
-- re-reading of the relationship trigger, cbr_field_admission_window's own
-- CHECK constraint, and TX-02/03/04's exact gate-check sequences) only. No
-- PostgreSQL execution occurred in the implementing environment. NOT run
-- against AUSCIS-TEST by Code — Alex executes this manually and returns
-- results for review, per the owner workflow. No SQL PASS is claimed here.
-- ============================================================

BEGIN;

-- ── Step 0a: bounded lock/statement timeouts for this transaction only ────
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ── Step 0b: prerequisite object-existence check ─────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.cbr_tx01_realize_g1g2(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: public.cbr_tx01_realize_g1g2(uuid,text) does not exist. Install the reviewed migration 040 on this database before running this file. Aborting before creating any fixture.';
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
  IF to_regprocedure('public.cbr_tx05_reject_g3(uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'PREREQUISITE NOT MET: public.cbr_tx05_reject_g3(uuid,uuid,text) does not exist.';
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
  RAISE NOTICE '[OK] all prerequisite objects found (existence only, not body verification) -- proceeding.';
END $$;

-- ── Step 0c: hard starting-state precondition — fails immediately, does ───
-- ── NOT merely record a failed precondition and continue. ─────────────────
DO $$
DECLARE v_bad_gates TEXT; v_open_gate TEXT; v_row_count INT;
BEGIN
  SELECT count(*) INTO v_row_count FROM cbr_internal.cbr_field_gate_state;
  IF v_row_count <> 3 THEN
    RAISE EXCEPTION 'PRECONDITION NOT MET: cbr_internal.cbr_field_gate_state does not have exactly 3 rows (found %). This file assumes normal, fully-initialized gate state; AC-17-style incomplete-initialization is out of this file''s scope. Aborting before creating any fixture.', v_row_count;
  END IF;
  SELECT string_agg(gate || '=' || enabled::TEXT, ', ') INTO v_bad_gates
    FROM cbr_internal.cbr_field_gate_state WHERE enabled IS DISTINCT FROM false;
  IF v_bad_gates IS NOT NULL THEN
    RAISE EXCEPTION 'PRECONDITION NOT MET: not every gate is enabled=false at file start (found: %). This file assumes a clean, all-disabled starting state and does not reconcile a pre-existing enabled gate. Aborting before creating any fixture.', v_bad_gates;
  END IF;
  SELECT gate INTO v_open_gate FROM cbr_internal.cbr_field_admission_window WHERE closed_at IS NULL LIMIT 1;
  IF v_open_gate IS NOT NULL THEN
    RAISE EXCEPTION 'PRECONDITION NOT MET: an admission window is already open (gate=%). This file assumes no open window at start. Aborting before creating any fixture.', v_open_gate;
  END IF;
  RAISE NOTICE '[OK] all 3 gates enabled=false, no open admission window -- proceeding.';
END $$;

-- ── Step 0d: transaction-local results table + recording helper ────────────
CREATE TEMP TABLE f4_results (
  seq SERIAL PRIMARY KEY,
  block TEXT NOT NULL,
  assertion TEXT NOT NULL,
  expected TEXT,
  actual TEXT,
  status TEXT NOT NULL
);

CREATE OR REPLACE FUNCTION pg_temp.f4_record(p_block TEXT, p_assertion TEXT, p_expected TEXT, p_actual TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO f4_results (block, assertion, expected, actual, status)
  VALUES (p_block, p_assertion, p_expected, p_actual,
    CASE WHEN p_expected IS NOT DISTINCT FROM p_actual THEN 'PASS' ELSE 'FAIL' END);
END;
$$;

-- ── Step 0e: transaction-local fixture helpers, all in pg_temp ─────────────
CREATE OR REPLACE FUNCTION pg_temp.f4_make_profile(p_role TEXT DEFAULT 'agent')
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_email TEXT := 'cbr-f4-' || v_id || '@example.invalid';
  v_final_email TEXT;
  v_final_role TEXT;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    VALUES (v_id, v_email, '', now(), now(), now(), 'authenticated', 'authenticated')
    ON CONFLICT DO NOTHING;

  SELECT email, role::TEXT INTO v_final_email, v_final_role FROM public.profiles WHERE id = v_id;
  IF v_final_role IS NULL THEN
    RAISE EXCEPTION 'f4_make_profile: on_auth_user_created did not create a public.profiles row for id=% (trigger-created row not found)', v_id;
  END IF;

  IF v_final_role IS DISTINCT FROM p_role THEN
    UPDATE public.profiles SET role = p_role::public.user_role WHERE id = v_id;
    SELECT role::TEXT INTO v_final_role FROM public.profiles WHERE id = v_id;
  END IF;

  IF v_final_email IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'f4_make_profile: postcondition failed -- expected email=%, actual email=% for id=%', v_email, v_final_email, v_id;
  END IF;
  IF v_final_role IS DISTINCT FROM p_role THEN
    RAISE EXCEPTION 'f4_make_profile: postcondition failed -- expected role=%, actual role=% for id=%', p_role, v_final_role, v_id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.f4_make_client(p_assigned_agent_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.clients (first_name, last_name, assigned_agent_id)
    VALUES ('F4Test', 'Client', p_assigned_agent_id) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.f4_make_case(p_client_id UUID)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.cases (client_id, case_type, title) VALUES (p_client_id, 'otro', 'IC Finding 4 regression case')
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.f4_make_invitation(p_case_id UUID, p_client_id UUID, p_email TEXT, p_created_by UUID)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.intake_invitations (token, case_id, client_id, email, created_by)
    VALUES (encode(gen_random_bytes(16), 'hex'), p_case_id, p_client_id, p_email, p_created_by)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.f4_sp_field(
  p_value TEXT,
  p_status TEXT DEFAULT 'beneficiary_confirmed',
  p_confirmed_by TEXT DEFAULT 'test-actor',
  p_confirmed_at TIMESTAMPTZ DEFAULT '2000-01-01T00:00:00Z'::TIMESTAMPTZ,
  p_source TEXT DEFAULT 'beneficiary_confirmed'
) RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'value', p_value, 'source', p_source, 'confidence', 1,
    'status', p_status, 'confirmed_by', p_confirmed_by,
    'confirmed_at', CASE WHEN p_confirmed_at IS NULL THEN NULL ELSE to_char(p_confirmed_at, 'YYYY-MM-DD"T"HH24:MI:SS.MSZ') END
  ));
$$;

CREATE OR REPLACE FUNCTION pg_temp.f4_make_submission(
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

-- AC-71 helper (pass path only — see Block B for the corrected reject path,
-- which needs CONSTRAINT_NAME capture and is written inline there plus in
-- f4_expect_superseded_by_reject below).
CREATE OR REPLACE PROCEDURE pg_temp.f4_expect_superseded_by_pass(
  p_case TEXT, p_client_id UUID, p_observation_id UUID, p_admin_id UUID, p_state TEXT, p_superseded_by UUID
) LANGUAGE plpgsql AS $$
DECLARE v_id UUID; v_result TEXT;
BEGIN
  BEGIN
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_observation_id, candidate_value, decision_state, reviewed_by, reviewed_at, superseded_by_submission_id)
      VALUES (p_client_id, 'DECISION', 'firstName', p_observation_id, 'X', p_state,
        CASE WHEN p_state IN ('approved','rejected') THEN p_admin_id ELSE NULL END,
        CASE WHEN p_state IS NOT NULL AND p_state != 'pending' THEN now() ELSE NULL END,
        p_superseded_by)
      RETURNING id INTO v_id;
    v_result := 'accepted';
  EXCEPTION WHEN check_violation THEN
    v_result := 'unexpectedly rejected: ' || SQLERRM;
  END;
  IF v_result = 'accepted' THEN
    DELETE FROM public.canonical_beneficiary_records WHERE id = v_id;
  END IF;
  PERFORM pg_temp.f4_record('B', p_case, 'accepted', v_result);
END; $$;

-- AC-71 helper (reject path, corrected: captures CONSTRAINT_NAME via GET
-- STACKED DIAGNOSTICS, requires it be exactly cbr_superseded_by_required
-- (never reports PASS for an unrelated check_violation), and separately
-- verifies the attempted row did not persist.)
CREATE OR REPLACE PROCEDURE pg_temp.f4_expect_superseded_by_reject(
  p_case TEXT, p_client_id UUID, p_observation_id UUID, p_admin_id UUID, p_state TEXT, p_superseded_by UUID
) LANGUAGE plpgsql AS $$
DECLARE v_constraint_name TEXT; v_result TEXT; v_row_exists BOOLEAN;
BEGIN
  BEGIN
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_observation_id, candidate_value, decision_state, reviewed_by, reviewed_at, superseded_by_submission_id)
      VALUES (p_client_id, 'DECISION', 'firstName', p_observation_id, 'X', p_state,
        CASE WHEN p_state IN ('approved','rejected') THEN p_admin_id ELSE NULL END,
        CASE WHEN p_state IS NOT NULL AND p_state != 'pending' THEN now() ELSE NULL END,
        p_superseded_by);
    v_result := 'unexpectedly accepted, no violation raised';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
    IF v_constraint_name = 'cbr_superseded_by_required' THEN
      v_result := 'rejected';
    ELSE
      v_result := 'rejected by unrelated constraint: ' || v_constraint_name;
    END IF;
  END;
  PERFORM pg_temp.f4_record('B', p_case, 'rejected', v_result);

  SELECT EXISTS(
    SELECT 1 FROM public.canonical_beneficiary_records
    WHERE client_id = p_client_id AND field_key = 'firstName' AND record_type = 'DECISION'
      AND decision_state IS NOT DISTINCT FROM p_state
      AND superseded_by_submission_id IS NOT DISTINCT FROM p_superseded_by
  ) INTO v_row_exists;
  PERFORM pg_temp.f4_record('B', p_case || '-no-persisted-row', 'false', v_row_exists::TEXT);
END; $$;

-- ============================================================
-- Block A: AC-10, direction 2 — the 3 subcases not exercised by any
-- prior artifact (effective=false, but the compound g3 admission
-- window is nonetheless open). Corrected this round: a SINGLE
-- window row (gate='g3_observation' — the only value the table's own
-- CHECK constraint permits; there is no separate g3_staff_resolution
-- window row) is used for all three subcases, its own id retained and
-- deleted individually (never a blanket per-gate DELETE), and every
-- outcome is captured into a variable before exactly one f4_record
-- call.
-- ============================================================
DO $$
DECLARE v_admin UUID; v_window_id UUID; v_raised BOOLEAN;
BEGIN
  v_admin := pg_temp.f4_make_profile('admin');

  INSERT INTO cbr_internal.cbr_field_admission_window (gate, opened_at)
    VALUES ('g3_observation', now()) RETURNING id INTO v_window_id;

  BEGIN
    PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
    v_raised := false;
  EXCEPTION WHEN OTHERS THEN
    v_raised := (SQLERRM LIKE 'CBR_GATE_WINDOW_INCONSISTENT%');
  END;
  PERFORM pg_temp.f4_record('A', 'dir2-obs-differ-raised', 'true', v_raised::TEXT);

  BEGIN
    PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', false, v_admin);
    v_raised := false;
  EXCEPTION WHEN OTHERS THEN
    v_raised := (SQLERRM LIKE 'CBR_GATE_WINDOW_INCONSISTENT%');
  END;
  PERFORM pg_temp.f4_record('A', 'dir2-staff-match-raised', 'true', v_raised::TEXT);

  BEGIN
    PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
    v_raised := false;
  EXCEPTION WHEN OTHERS THEN
    v_raised := (SQLERRM LIKE 'CBR_GATE_WINDOW_INCONSISTENT%');
  END;
  PERFORM pg_temp.f4_record('A', 'dir2-staff-differ-raised', 'true', v_raised::TEXT);

  -- Delete ONLY the specific row this block inserted, by id -- never a
  -- blanket DELETE ... WHERE gate = 'g3_observation', which could remove
  -- an unrelated, legitimate row if one already existed.
  DELETE FROM cbr_internal.cbr_field_admission_window WHERE id = v_window_id;

  PERFORM pg_temp.f4_record('A', 'no-residual-window-this-fixture', '0',
    (SELECT count(*)::TEXT FROM cbr_internal.cbr_field_admission_window WHERE id = v_window_id));
  PERFORM pg_temp.f4_record('A', 'gate-state-unchanged-by-rejected-calls', 'false,false,false',
    (SELECT string_agg(enabled::TEXT, ',' ORDER BY gate) FROM cbr_internal.cbr_field_gate_state));
END $$;

-- ============================================================
-- Block B: AC-71 — NULL-safe supersession constraint, all 10
-- state/pointer combinations. Corrected this round: the (NULL,*)
-- pair now uses a fresh INSERT (never an UPDATE) so it reaches
-- cbr_superseded_by_required directly rather than being intercepted
-- by the relationship trigger's UPDATE-only CBR_TERMINAL_REWRITE_
-- VIOLATION path; an explicit (NULL,NULL) positive case is recorded;
-- every rejection captures and requires the specific constraint name.
-- ============================================================
DO $$
DECLARE v_client UUID; v_case UUID; v_admin UUID; v_inv UUID; v_s1 UUID; v_obs UUID;
        v_constraint_name TEXT; v_reject_row_id UUID; v_reject_result TEXT; v_row_exists BOOLEAN;
BEGIN
  v_admin := pg_temp.f4_make_profile('admin');
  v_client := pg_temp.f4_make_client();
  v_case := pg_temp.f4_make_case(v_client);
  v_inv := pg_temp.f4_make_invitation(v_case, v_client, 'f4-ac71@example.invalid', v_admin);
  v_s1 := pg_temp.f4_make_submission(v_client, v_case, v_inv, jsonb_build_object('givenName', pg_temp.f4_sp_field('X')));

  -- (NULL, NULL) — baseline CANDIDATE_OBSERVED row, decision_state NULL,
  -- superseded_by_submission_id NULL. This IS the (NULL,NULL) positive
  -- case, recorded explicitly rather than only implicitly relied upon by
  -- later steps.
  INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, candidate_value)
    VALUES (v_client, 'CANDIDATE_OBSERVED', 'firstName', v_s1, 'X') RETURNING id INTO v_obs;
  PERFORM pg_temp.f4_record('B', 'AC-71(NULL,NULL)-row-exists', 'true',
    (SELECT EXISTS(SELECT 1 FROM public.canonical_beneficiary_records WHERE id = v_obs))::TEXT);
  PERFORM pg_temp.f4_record('B', 'AC-71(NULL,NULL)-accepted', 'true',
    (SELECT (decision_state IS NULL AND superseded_by_submission_id IS NULL)
     FROM public.canonical_beneficiary_records WHERE id = v_obs)::TEXT);

  -- (NULL, non-NULL) — a SECOND, otherwise-valid CANDIDATE_OBSERVED row,
  -- inserted directly with decision_state=NULL and a valid non-NULL
  -- superseded_by_submission_id (v_s1, a real submission id, satisfying
  -- the column's own FK). The relationship trigger's INSERT branch only
  -- examines record_type IN ('DECISION','CONFLICT_DETECTED') -- neither
  -- applies to a CANDIDATE_OBSERVED row -- so this INSERT reaches
  -- cbr_superseded_by_required directly, confirmed by tracing the actual
  -- trigger source (migration 040 lines 171-236) before writing this
  -- block.
  BEGIN
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, candidate_value, superseded_by_submission_id)
      VALUES (v_client, 'CANDIDATE_OBSERVED', 'firstName', v_s1, 'Y', v_s1)
      RETURNING id INTO v_reject_row_id;
    v_reject_result := 'unexpectedly accepted, no violation raised';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
    IF v_constraint_name = 'cbr_superseded_by_required' THEN
      v_reject_result := 'rejected';
    ELSE
      v_reject_result := 'rejected by unrelated constraint: ' || v_constraint_name;
    END IF;
  END;
  PERFORM pg_temp.f4_record('B', 'AC-71(NULL,non-NULL)', 'rejected', v_reject_result);

  SELECT EXISTS(
    SELECT 1 FROM public.canonical_beneficiary_records
    WHERE client_id = v_client AND field_key = 'firstName' AND record_type = 'CANDIDATE_OBSERVED' AND candidate_value = 'Y'
  ) INTO v_row_exists;
  PERFORM pg_temp.f4_record('B', 'AC-71(NULL,non-NULL)-no-persisted-row', 'false', v_row_exists::TEXT);

  -- Remaining eight combinations, via DECISION rows (unaffected by the
  -- UPDATE-vs-INSERT defect above -- these were always INSERT-based and
  -- correctly reach the trigger's DECISION relationship check, which is
  -- satisfied by construction: source_observation_id=v_obs,
  -- candidate_value='X' matching v_obs exactly, origin NULL on both
  -- sides).
  CALL pg_temp.f4_expect_superseded_by_pass('AC-71(pending,NULL)', v_client, v_obs, v_admin, 'pending', NULL);
  CALL pg_temp.f4_expect_superseded_by_reject('AC-71(pending,non-NULL)', v_client, v_obs, v_admin, 'pending', v_s1);
  CALL pg_temp.f4_expect_superseded_by_pass('AC-71(approved,NULL)', v_client, v_obs, v_admin, 'approved', NULL);
  CALL pg_temp.f4_expect_superseded_by_reject('AC-71(approved,non-NULL)', v_client, v_obs, v_admin, 'approved', v_s1);
  CALL pg_temp.f4_expect_superseded_by_pass('AC-71(rejected,NULL)', v_client, v_obs, v_admin, 'rejected', NULL);
  CALL pg_temp.f4_expect_superseded_by_reject('AC-71(rejected,non-NULL)', v_client, v_obs, v_admin, 'rejected', v_s1);
  CALL pg_temp.f4_expect_superseded_by_reject('AC-71(superseded,NULL)', v_client, v_obs, v_admin, 'superseded', NULL);
  CALL pg_temp.f4_expect_superseded_by_pass('AC-71(superseded,non-NULL)', v_client, v_obs, v_admin, 'superseded', v_s1);
END $$;

-- ============================================================
-- Block C: AC-73 — gate initialization is idempotent and does not
-- reset an existing enabled flag. Corrected this round: captures the
-- COMPLETE gate row and the complete admission-window set for the
-- gate, both before and after the initialization statement, and
-- asserts full equality -- not merely the `enabled` column.
-- ============================================================
DO $$
DECLARE v_before_row JSONB; v_after_row JSONB; v_before_windows JSONB; v_after_windows JSONB;
BEGIN
  UPDATE cbr_internal.cbr_field_gate_state SET enabled = true WHERE gate = 'g1g2';

  SELECT to_jsonb(g) INTO v_before_row FROM cbr_internal.cbr_field_gate_state g WHERE gate = 'g1g2';
  SELECT COALESCE(jsonb_agg(to_jsonb(w) ORDER BY w.id), '[]'::jsonb) INTO v_before_windows
    FROM cbr_internal.cbr_field_admission_window w WHERE gate = 'g1g2';

  INSERT INTO cbr_internal.cbr_field_gate_state (gate, enabled) VALUES
    ('g1g2', false), ('g3_observation', false), ('g3_staff_resolution', false)
    ON CONFLICT (gate) DO NOTHING;

  SELECT to_jsonb(g) INTO v_after_row FROM cbr_internal.cbr_field_gate_state g WHERE gate = 'g1g2';
  SELECT COALESCE(jsonb_agg(to_jsonb(w) ORDER BY w.id), '[]'::jsonb) INTO v_after_windows
    FROM cbr_internal.cbr_field_admission_window w WHERE gate = 'g1g2';

  PERFORM pg_temp.f4_record('C', 'AC-73-complete-gate-row-unchanged', v_before_row::TEXT, v_after_row::TEXT);
  PERFORM pg_temp.f4_record('C', 'AC-73-enabled-remains-true', 'true', (v_after_row->>'enabled'));
  PERFORM pg_temp.f4_record('C', 'AC-73-admission-window-state-unchanged', v_before_windows::TEXT, v_after_windows::TEXT);

  UPDATE cbr_internal.cbr_field_gate_state SET enabled = false WHERE gate = 'g1g2';
END $$;

-- ============================================================
-- Block D: AC-74/AC-75 — fail-closed missing gate rows, TX-01 through
-- TX-05. Corrected/extended this round: TX-02 (two distinct missing-
-- gate variants -- it checks g3_observation THEN g3_staff_resolution
-- sequentially), TX-03, and TX-04 added, each against a REAL, valid,
-- otherwise-would-write fixture so the accompanying no-write
-- assertions are meaningful. TX-01/TX-05 retained.
-- ============================================================

-- D1: TX-01, missing g1g2. This round adds an explicit canonical-value
-- (email) before/after comparison for the tested field.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT;
        v_before_count INT; v_after_count INT; v_canon_before TEXT; v_canon_after TEXT;
BEGIN
  v_admin := pg_temp.f4_make_profile('admin');
  v_client := pg_temp.f4_make_client();
  v_case := pg_temp.f4_make_case(v_client);
  v_inv := pg_temp.f4_make_invitation(v_case, v_client, 'f4-ac74-tx01@example.invalid', v_admin);
  v_sub := pg_temp.f4_make_submission(v_client, v_case, v_inv, jsonb_build_object('email', pg_temp.f4_sp_field('f4-ac74-tx01@example.invalid')));

  SELECT count(*) INTO v_before_count FROM public.canonical_beneficiary_records WHERE client_id = v_client AND field_key = 'email';
  SELECT email INTO v_canon_before FROM public.clients WHERE id = v_client;

  DELETE FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g1g2';
  SELECT outcome INTO v_o FROM public.cbr_tx01_realize_g1g2(v_sub, 'email');
  PERFORM pg_temp.f4_record('D1', 'AC-74(TX-01)', 'GATE_NOT_INITIALIZED', v_o);
  INSERT INTO cbr_internal.cbr_field_gate_state (gate, enabled) VALUES ('g1g2', false);

  SELECT count(*) INTO v_after_count FROM public.canonical_beneficiary_records WHERE client_id = v_client AND field_key = 'email';
  SELECT email INTO v_canon_after FROM public.clients WHERE id = v_client;
  PERFORM pg_temp.f4_record('D1', 'AC-74(TX-01)-no-cbr-record-created', v_before_count::TEXT, v_after_count::TEXT);
  PERFORM pg_temp.f4_record('D1', 'AC-74(TX-01)-no-processing-state-created', 'false',
    (SELECT EXISTS(SELECT 1 FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client AND field_key = 'email'))::TEXT);
  PERFORM pg_temp.f4_record('D1', 'AC-74(TX-01)-canonical-unchanged', v_canon_before, v_canon_after);
  PERFORM pg_temp.f4_record('D1', 'AC-74(TX-01)-gate-row-restored', '1',
    (SELECT count(*)::TEXT FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g1g2'));
END $$;

-- D2: TX-02, variant (a) — g3_observation missing entirely (checked
-- first, migration 040 line 613-614); g3_staff_resolution row present.
-- This round adds a canonical-value (middle_name) before/after
-- comparison.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT;
        v_before_count INT; v_after_count INT; v_canon_before TEXT; v_canon_after TEXT;
BEGIN
  v_admin := pg_temp.f4_make_profile('admin');
  v_client := pg_temp.f4_make_client();
  v_case := pg_temp.f4_make_case(v_client);
  v_inv := pg_temp.f4_make_invitation(v_case, v_client, 'f4-ac74-tx02a@example.invalid', v_admin);
  v_sub := pg_temp.f4_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f4_sp_field('GateA')));

  SELECT count(*) INTO v_before_count FROM public.canonical_beneficiary_records WHERE client_id = v_client AND field_key = 'middleName';
  SELECT middle_name INTO v_canon_before FROM public.clients WHERE id = v_client;

  DELETE FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_observation';
  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  PERFORM pg_temp.f4_record('D2', 'AC-74(TX-02,g3_observation-missing)', 'GATE_NOT_INITIALIZED', v_o);
  INSERT INTO cbr_internal.cbr_field_gate_state (gate, enabled) VALUES ('g3_observation', false);

  SELECT count(*) INTO v_after_count FROM public.canonical_beneficiary_records WHERE client_id = v_client AND field_key = 'middleName';
  SELECT middle_name INTO v_canon_after FROM public.clients WHERE id = v_client;
  PERFORM pg_temp.f4_record('D2', 'AC-74(TX-02,g3_observation-missing)-no-cbr-record-created', v_before_count::TEXT, v_after_count::TEXT);
  PERFORM pg_temp.f4_record('D2', 'AC-74(TX-02,g3_observation-missing)-no-processing-state-created', 'false',
    (SELECT EXISTS(SELECT 1 FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client AND field_key = 'middleName'))::TEXT);
  PERFORM pg_temp.f4_record('D2', 'AC-74(TX-02,g3_observation-missing)-canonical-unchanged', v_canon_before, v_canon_after);
  PERFORM pg_temp.f4_record('D2', 'AC-74(TX-02,g3_observation-missing)-gate-row-restored', '1',
    (SELECT count(*)::TEXT FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_observation'));
END $$;

-- D3: TX-02, variant (b) — g3_observation row present (restored above),
-- g3_staff_resolution row missing -- proves the SECOND, sequential gate
-- check is actually reached and independently enforced. This round adds
-- a canonical-value (middle_name) before/after comparison.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT;
        v_before_count INT; v_after_count INT; v_canon_before TEXT; v_canon_after TEXT;
BEGIN
  v_admin := pg_temp.f4_make_profile('admin');
  v_client := pg_temp.f4_make_client();
  v_case := pg_temp.f4_make_case(v_client);
  v_inv := pg_temp.f4_make_invitation(v_case, v_client, 'f4-ac74-tx02b@example.invalid', v_admin);
  v_sub := pg_temp.f4_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f4_sp_field('GateB')));

  SELECT count(*) INTO v_before_count FROM public.canonical_beneficiary_records WHERE client_id = v_client AND field_key = 'middleName';
  SELECT middle_name INTO v_canon_before FROM public.clients WHERE id = v_client;

  DELETE FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_staff_resolution';
  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  PERFORM pg_temp.f4_record('D3', 'AC-74(TX-02,g3_staff_resolution-missing)', 'GATE_NOT_INITIALIZED', v_o);
  INSERT INTO cbr_internal.cbr_field_gate_state (gate, enabled) VALUES ('g3_staff_resolution', false);

  SELECT count(*) INTO v_after_count FROM public.canonical_beneficiary_records WHERE client_id = v_client AND field_key = 'middleName';
  SELECT middle_name INTO v_canon_after FROM public.clients WHERE id = v_client;
  PERFORM pg_temp.f4_record('D3', 'AC-74(TX-02,g3_staff_resolution-missing)-no-cbr-record-created', v_before_count::TEXT, v_after_count::TEXT);
  PERFORM pg_temp.f4_record('D3', 'AC-74(TX-02,g3_staff_resolution-missing)-no-processing-state-created', 'false',
    (SELECT EXISTS(SELECT 1 FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client AND field_key = 'middleName'))::TEXT);
  PERFORM pg_temp.f4_record('D3', 'AC-74(TX-02,g3_staff_resolution-missing)-canonical-unchanged', v_canon_before, v_canon_after);
  PERFORM pg_temp.f4_record('D3', 'AC-74(TX-02,g3_staff_resolution-missing)-gate-row-restored', '1',
    (SELECT count(*)::TEXT FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_staff_resolution'));
END $$;

-- D4: TX-03, missing g3_staff_resolution, against a REAL, existing
-- CANDIDATE_OBSERVED row. CORRECTED CHRONOLOGY this round: the prior
-- round created the submission BEFORE opening the compound g3 admission
-- window -- f4_make_submission's default submitted_at and
-- cbr_toggle_gate's opened_at both use clock_timestamp() at their own
-- respective call time, so the submission preceded its own window and
-- TX-02's STEP 10 (migration 040 lines 697-702, requires
-- opened_at <= submitted_at) returned ADMISSION_BOUNDARY, not OBSERVED.
-- Fixed: client/case/invitation created first, then the window opened,
-- THEN the submission created, THEN its submitted_at is explicitly
-- verified to fall within the open window before TX-02 is ever called.
-- Every setup step is hard-checked -- RAISE EXCEPTION on any unexpected
-- outcome or NULL id -- so this block never continues with a NULL
-- fixture id and never records a misleading "unchanged" result against
-- something that was never created. The no-write assertions now compare
-- the fixture's FULL canonical_beneficiary_records set (scoped to this
-- fixture's own client_id), not only a DECISION-row count.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_o TEXT;
        v_toggle_o TEXT; v_submitted_at TIMESTAMPTZ; v_window_open_at TIMESTAMPTZ;
        v_before_pcs JSONB; v_after_pcs JSONB; v_canon_before TEXT; v_canon_after TEXT;
        v_before_cbr_set JSONB; v_after_cbr_set JSONB;
BEGIN
  v_admin := pg_temp.f4_make_profile('admin');
  v_client := pg_temp.f4_make_client();
  v_case := pg_temp.f4_make_case(v_client);
  v_inv := pg_temp.f4_make_invitation(v_case, v_client, 'f4-ac75-tx03@example.invalid', v_admin);

  SELECT outcome INTO v_toggle_o FROM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  IF v_toggle_o <> 'TOGGLED' THEN
    RAISE EXCEPTION 'D4 setup failed: cbr_toggle_gate(g3_observation,true) returned % (expected TOGGLED). Aborting rather than continuing with an unverified gate state.', v_toggle_o;
  END IF;
  SELECT outcome INTO v_toggle_o FROM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  IF v_toggle_o <> 'TOGGLED' THEN
    RAISE EXCEPTION 'D4 setup failed: cbr_toggle_gate(g3_staff_resolution,true) returned % (expected TOGGLED). Aborting.', v_toggle_o;
  END IF;
  PERFORM pg_temp.f4_record('D4', 'setup-g3-window-open', 'true',
    (SELECT EXISTS(SELECT 1 FROM cbr_internal.cbr_field_admission_window WHERE gate='g3_observation' AND closed_at IS NULL))::TEXT);

  v_sub := pg_temp.f4_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f4_sp_field('GateC')));
  SELECT submitted_at INTO v_submitted_at FROM public.intake_submissions WHERE id = v_sub;
  SELECT opened_at INTO v_window_open_at FROM cbr_internal.cbr_field_admission_window WHERE gate='g3_observation' AND closed_at IS NULL;
  IF NOT (v_window_open_at <= v_submitted_at) THEN
    RAISE EXCEPTION 'D4 setup failed: submission submitted_at (%) is not within the open g3_observation window (opened_at=%). Aborting rather than proceeding with a chronologically-invalid fixture.', v_submitted_at, v_window_open_at;
  END IF;
  PERFORM pg_temp.f4_record('D4', 'setup-submitted-at-within-window', 'true', 'true');

  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  IF v_o IS DISTINCT FROM 'OBSERVED' OR v_obs IS NULL THEN
    RAISE EXCEPTION 'D4 setup failed: cbr_tx02_observe_g3 returned outcome=% observation_id=% (expected OBSERVED with a non-NULL id). Aborting rather than continuing with a NULL fixture id.', v_o, v_obs;
  END IF;
  PERFORM pg_temp.f4_record('D4', 'setup-observe', 'OBSERVED', v_o);

  SELECT outcome INTO v_toggle_o FROM cbr_internal.cbr_toggle_gate('g3_observation', false, v_admin);
  IF v_toggle_o <> 'TOGGLED' THEN
    RAISE EXCEPTION 'D4 teardown failed: cbr_toggle_gate(g3_observation,false) returned % (expected TOGGLED).', v_toggle_o;
  END IF;
  SELECT outcome INTO v_toggle_o FROM cbr_internal.cbr_toggle_gate('g3_staff_resolution', false, v_admin);
  IF v_toggle_o <> 'TOGGLED' THEN
    RAISE EXCEPTION 'D4 teardown failed: cbr_toggle_gate(g3_staff_resolution,false) returned % (expected TOGGLED).', v_toggle_o;
  END IF;

  SELECT to_jsonb(pcs) INTO v_before_pcs FROM cbr_internal.cbr_field_processing_state pcs WHERE client_id = v_client AND field_key = 'middleName';
  SELECT middle_name INTO v_canon_before FROM public.clients WHERE id = v_client;
  SELECT COALESCE(jsonb_agg(to_jsonb(cbr) ORDER BY cbr.id), '[]'::jsonb) INTO v_before_cbr_set
    FROM public.canonical_beneficiary_records cbr WHERE cbr.client_id = v_client;

  DELETE FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_staff_resolution';
  SELECT outcome INTO v_o FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM pg_temp.f4_record('D4', 'AC-75(TX-03,g3_staff_resolution-missing)', 'GATE_NOT_INITIALIZED', v_o);
  INSERT INTO cbr_internal.cbr_field_gate_state (gate, enabled) VALUES ('g3_staff_resolution', false);

  SELECT to_jsonb(pcs) INTO v_after_pcs FROM cbr_internal.cbr_field_processing_state pcs WHERE client_id = v_client AND field_key = 'middleName';
  SELECT middle_name INTO v_canon_after FROM public.clients WHERE id = v_client;
  SELECT COALESCE(jsonb_agg(to_jsonb(cbr) ORDER BY cbr.id), '[]'::jsonb) INTO v_after_cbr_set
    FROM public.canonical_beneficiary_records cbr WHERE cbr.client_id = v_client;

  PERFORM pg_temp.f4_record('D4', 'AC-75(TX-03,g3_staff_resolution-missing)-full-cbr-record-set-unchanged', v_before_cbr_set::TEXT, v_after_cbr_set::TEXT);
  PERFORM pg_temp.f4_record('D4', 'AC-75(TX-03,g3_staff_resolution-missing)-processing-state-unchanged', v_before_pcs::TEXT, v_after_pcs::TEXT);
  PERFORM pg_temp.f4_record('D4', 'AC-75(TX-03,g3_staff_resolution-missing)-canonical-unchanged', v_canon_before, v_canon_after);
  PERFORM pg_temp.f4_record('D4', 'AC-75(TX-03,g3_staff_resolution-missing)-gate-row-restored', '1',
    (SELECT count(*)::TEXT FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_staff_resolution'));
END $$;

-- D5: TX-04, missing g3_staff_resolution, against a REAL, existing
-- pending DECISION. Same chronology correction as D4 (window opened
-- before the submission is created, submitted_at explicitly verified
-- within the window, every setup step hard-checked). Retains all
-- previously-requested decision/canonical/processing-state assertions
-- and adds a full canonical_beneficiary_records-set comparison, scoped
-- to this fixture's own client_id.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
        v_toggle_o TEXT; v_submitted_at TIMESTAMPTZ; v_window_open_at TIMESTAMPTZ;
        v_before_dec JSONB; v_after_dec JSONB;
        v_before_pcs JSONB; v_after_pcs JSONB; v_canon_before TEXT; v_canon_after TEXT;
        v_before_cr INT; v_after_cr INT;
        v_before_cbr_set JSONB; v_after_cbr_set JSONB;
BEGIN
  v_admin := pg_temp.f4_make_profile('admin');
  v_client := pg_temp.f4_make_client();
  v_case := pg_temp.f4_make_case(v_client);
  v_inv := pg_temp.f4_make_invitation(v_case, v_client, 'f4-ac75-tx04@example.invalid', v_admin);

  SELECT outcome INTO v_toggle_o FROM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  IF v_toggle_o <> 'TOGGLED' THEN
    RAISE EXCEPTION 'D5 setup failed: cbr_toggle_gate(g3_observation,true) returned % (expected TOGGLED).', v_toggle_o;
  END IF;
  SELECT outcome INTO v_toggle_o FROM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  IF v_toggle_o <> 'TOGGLED' THEN
    RAISE EXCEPTION 'D5 setup failed: cbr_toggle_gate(g3_staff_resolution,true) returned % (expected TOGGLED).', v_toggle_o;
  END IF;
  PERFORM pg_temp.f4_record('D5', 'setup-g3-window-open', 'true',
    (SELECT EXISTS(SELECT 1 FROM cbr_internal.cbr_field_admission_window WHERE gate='g3_observation' AND closed_at IS NULL))::TEXT);

  v_sub := pg_temp.f4_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f4_sp_field('GateD')));
  SELECT submitted_at INTO v_submitted_at FROM public.intake_submissions WHERE id = v_sub;
  SELECT opened_at INTO v_window_open_at FROM cbr_internal.cbr_field_admission_window WHERE gate='g3_observation' AND closed_at IS NULL;
  IF NOT (v_window_open_at <= v_submitted_at) THEN
    RAISE EXCEPTION 'D5 setup failed: submission submitted_at (%) is not within the open g3_observation window (opened_at=%). Aborting.', v_submitted_at, v_window_open_at;
  END IF;
  PERFORM pg_temp.f4_record('D5', 'setup-submitted-at-within-window', 'true', 'true');

  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  IF v_o IS DISTINCT FROM 'OBSERVED' OR v_obs IS NULL THEN
    RAISE EXCEPTION 'D5 setup failed: cbr_tx02_observe_g3 returned outcome=% observation_id=% (expected OBSERVED, non-NULL id).', v_o, v_obs;
  END IF;
  PERFORM pg_temp.f4_record('D5', 'setup-observe', 'OBSERVED', v_o);

  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  IF v_o IS DISTINCT FROM 'OPENED' OR v_dec IS NULL THEN
    RAISE EXCEPTION 'D5 setup failed: cbr_tx03_open_g3_review returned outcome=% decision_id=% (expected OPENED, non-NULL id).', v_o, v_dec;
  END IF;
  PERFORM pg_temp.f4_record('D5', 'setup-open', 'OPENED', v_o);

  SELECT outcome INTO v_toggle_o FROM cbr_internal.cbr_toggle_gate('g3_observation', false, v_admin);
  IF v_toggle_o <> 'TOGGLED' THEN
    RAISE EXCEPTION 'D5 teardown failed: cbr_toggle_gate(g3_observation,false) returned % (expected TOGGLED).', v_toggle_o;
  END IF;
  SELECT outcome INTO v_toggle_o FROM cbr_internal.cbr_toggle_gate('g3_staff_resolution', false, v_admin);
  IF v_toggle_o <> 'TOGGLED' THEN
    RAISE EXCEPTION 'D5 teardown failed: cbr_toggle_gate(g3_staff_resolution,false) returned % (expected TOGGLED).', v_toggle_o;
  END IF;

  SELECT to_jsonb(cbr) INTO v_before_dec FROM public.canonical_beneficiary_records cbr WHERE cbr.id = v_dec;
  SELECT to_jsonb(pcs) INTO v_before_pcs FROM cbr_internal.cbr_field_processing_state pcs WHERE client_id = v_client AND field_key = 'middleName';
  SELECT middle_name INTO v_canon_before FROM public.clients WHERE id = v_client;
  SELECT count(*) INTO v_before_cr FROM public.canonical_beneficiary_records WHERE record_type = 'CHANGE_REALIZED' AND related_decision_id = v_dec;
  SELECT COALESCE(jsonb_agg(to_jsonb(cbr) ORDER BY cbr.id), '[]'::jsonb) INTO v_before_cbr_set
    FROM public.canonical_beneficiary_records cbr WHERE cbr.client_id = v_client;

  DELETE FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_staff_resolution';
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, NULL);
  PERFORM pg_temp.f4_record('D5', 'AC-75(TX-04,g3_staff_resolution-missing)', 'GATE_NOT_INITIALIZED', v_o);
  INSERT INTO cbr_internal.cbr_field_gate_state (gate, enabled) VALUES ('g3_staff_resolution', false);

  SELECT to_jsonb(cbr) INTO v_after_dec FROM public.canonical_beneficiary_records cbr WHERE cbr.id = v_dec;
  SELECT to_jsonb(pcs) INTO v_after_pcs FROM cbr_internal.cbr_field_processing_state pcs WHERE client_id = v_client AND field_key = 'middleName';
  SELECT middle_name INTO v_canon_after FROM public.clients WHERE id = v_client;
  SELECT count(*) INTO v_after_cr FROM public.canonical_beneficiary_records WHERE record_type = 'CHANGE_REALIZED' AND related_decision_id = v_dec;
  SELECT COALESCE(jsonb_agg(to_jsonb(cbr) ORDER BY cbr.id), '[]'::jsonb) INTO v_after_cbr_set
    FROM public.canonical_beneficiary_records cbr WHERE cbr.client_id = v_client;

  PERFORM pg_temp.f4_record('D5', 'AC-75(TX-04,g3_staff_resolution-missing)-decision-row-unchanged', v_before_dec::TEXT, v_after_dec::TEXT);
  PERFORM pg_temp.f4_record('D5', 'AC-75(TX-04,g3_staff_resolution-missing)-still-pending',
    'pending', (v_after_dec->>'decision_state'));
  PERFORM pg_temp.f4_record('D5', 'AC-75(TX-04,g3_staff_resolution-missing)-processing-state-unchanged', v_before_pcs::TEXT, v_after_pcs::TEXT);
  PERFORM pg_temp.f4_record('D5', 'AC-75(TX-04,g3_staff_resolution-missing)-canonical-unchanged', v_canon_before, v_canon_after);
  PERFORM pg_temp.f4_record('D5', 'AC-75(TX-04,g3_staff_resolution-missing)-no-change-realized', v_before_cr::TEXT, v_after_cr::TEXT);
  PERFORM pg_temp.f4_record('D5', 'AC-75(TX-04,g3_staff_resolution-missing)-full-cbr-record-set-unchanged', v_before_cbr_set::TEXT, v_after_cbr_set::TEXT);
  PERFORM pg_temp.f4_record('D5', 'AC-75(TX-04,g3_staff_resolution-missing)-gate-row-restored', '1',
    (SELECT count(*)::TEXT FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_staff_resolution'));
END $$;

-- D6: TX-05, missing g3_staff_resolution. CORRECTED this round: the
-- fabricated, nonexistent decision_id is replaced with a REAL, valid
-- pending DECISION, built with the same corrected chronology as D4/D5
-- (window opened before the submission is created, submitted_at
-- verified within the window, every setup step hard-checked). Asserts
-- the full decision row remains unchanged and pending, canonical values
-- remain unchanged, processing state remains unchanged, and the
-- fixture's full canonical_beneficiary_records set (scoped to this
-- fixture's own client_id) is unchanged.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_o TEXT;
        v_toggle_o TEXT; v_submitted_at TIMESTAMPTZ; v_window_open_at TIMESTAMPTZ;
        v_before_dec JSONB; v_after_dec JSONB;
        v_before_pcs JSONB; v_after_pcs JSONB; v_canon_before TEXT; v_canon_after TEXT;
        v_before_cbr_set JSONB; v_after_cbr_set JSONB;
BEGIN
  v_admin := pg_temp.f4_make_profile('admin');
  v_client := pg_temp.f4_make_client();
  v_case := pg_temp.f4_make_case(v_client);
  v_inv := pg_temp.f4_make_invitation(v_case, v_client, 'f4-ac75-tx05@example.invalid', v_admin);

  SELECT outcome INTO v_toggle_o FROM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  IF v_toggle_o <> 'TOGGLED' THEN
    RAISE EXCEPTION 'D6 setup failed: cbr_toggle_gate(g3_observation,true) returned % (expected TOGGLED).', v_toggle_o;
  END IF;
  SELECT outcome INTO v_toggle_o FROM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  IF v_toggle_o <> 'TOGGLED' THEN
    RAISE EXCEPTION 'D6 setup failed: cbr_toggle_gate(g3_staff_resolution,true) returned % (expected TOGGLED).', v_toggle_o;
  END IF;
  PERFORM pg_temp.f4_record('D6', 'setup-g3-window-open', 'true',
    (SELECT EXISTS(SELECT 1 FROM cbr_internal.cbr_field_admission_window WHERE gate='g3_observation' AND closed_at IS NULL))::TEXT);

  v_sub := pg_temp.f4_make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', pg_temp.f4_sp_field('GateE')));
  SELECT submitted_at INTO v_submitted_at FROM public.intake_submissions WHERE id = v_sub;
  SELECT opened_at INTO v_window_open_at FROM cbr_internal.cbr_field_admission_window WHERE gate='g3_observation' AND closed_at IS NULL;
  IF NOT (v_window_open_at <= v_submitted_at) THEN
    RAISE EXCEPTION 'D6 setup failed: submission submitted_at (%) is not within the open g3_observation window (opened_at=%). Aborting.', v_submitted_at, v_window_open_at;
  END IF;
  PERFORM pg_temp.f4_record('D6', 'setup-submitted-at-within-window', 'true', 'true');

  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  IF v_o IS DISTINCT FROM 'OBSERVED' OR v_obs IS NULL THEN
    RAISE EXCEPTION 'D6 setup failed: cbr_tx02_observe_g3 returned outcome=% observation_id=% (expected OBSERVED, non-NULL id).', v_o, v_obs;
  END IF;
  PERFORM pg_temp.f4_record('D6', 'setup-observe', 'OBSERVED', v_o);

  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  IF v_o IS DISTINCT FROM 'OPENED' OR v_dec IS NULL THEN
    RAISE EXCEPTION 'D6 setup failed: cbr_tx03_open_g3_review returned outcome=% decision_id=% (expected OPENED, non-NULL id).', v_o, v_dec;
  END IF;
  PERFORM pg_temp.f4_record('D6', 'setup-open', 'OPENED', v_o);

  SELECT outcome INTO v_toggle_o FROM cbr_internal.cbr_toggle_gate('g3_observation', false, v_admin);
  IF v_toggle_o <> 'TOGGLED' THEN
    RAISE EXCEPTION 'D6 teardown failed: cbr_toggle_gate(g3_observation,false) returned % (expected TOGGLED).', v_toggle_o;
  END IF;
  SELECT outcome INTO v_toggle_o FROM cbr_internal.cbr_toggle_gate('g3_staff_resolution', false, v_admin);
  IF v_toggle_o <> 'TOGGLED' THEN
    RAISE EXCEPTION 'D6 teardown failed: cbr_toggle_gate(g3_staff_resolution,false) returned % (expected TOGGLED).', v_toggle_o;
  END IF;

  SELECT to_jsonb(cbr) INTO v_before_dec FROM public.canonical_beneficiary_records cbr WHERE cbr.id = v_dec;
  SELECT to_jsonb(pcs) INTO v_before_pcs FROM cbr_internal.cbr_field_processing_state pcs WHERE client_id = v_client AND field_key = 'middleName';
  SELECT middle_name INTO v_canon_before FROM public.clients WHERE id = v_client;
  SELECT COALESCE(jsonb_agg(to_jsonb(cbr) ORDER BY cbr.id), '[]'::jsonb) INTO v_before_cbr_set
    FROM public.canonical_beneficiary_records cbr WHERE cbr.client_id = v_client;

  DELETE FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_staff_resolution';
  SELECT outcome INTO v_o FROM public.cbr_tx05_reject_g3(v_dec, v_admin, 'f4 gate-missing regression');
  PERFORM pg_temp.f4_record('D6', 'AC-75(TX-05,g3_staff_resolution-missing)', 'GATE_NOT_INITIALIZED', v_o);
  INSERT INTO cbr_internal.cbr_field_gate_state (gate, enabled) VALUES ('g3_staff_resolution', false);

  SELECT to_jsonb(cbr) INTO v_after_dec FROM public.canonical_beneficiary_records cbr WHERE cbr.id = v_dec;
  SELECT to_jsonb(pcs) INTO v_after_pcs FROM cbr_internal.cbr_field_processing_state pcs WHERE client_id = v_client AND field_key = 'middleName';
  SELECT middle_name INTO v_canon_after FROM public.clients WHERE id = v_client;
  SELECT COALESCE(jsonb_agg(to_jsonb(cbr) ORDER BY cbr.id), '[]'::jsonb) INTO v_after_cbr_set
    FROM public.canonical_beneficiary_records cbr WHERE cbr.client_id = v_client;

  PERFORM pg_temp.f4_record('D6', 'AC-75(TX-05,g3_staff_resolution-missing)-decision-row-unchanged', v_before_dec::TEXT, v_after_dec::TEXT);
  PERFORM pg_temp.f4_record('D6', 'AC-75(TX-05,g3_staff_resolution-missing)-still-pending',
    'pending', (v_after_dec->>'decision_state'));
  PERFORM pg_temp.f4_record('D6', 'AC-75(TX-05,g3_staff_resolution-missing)-processing-state-unchanged', v_before_pcs::TEXT, v_after_pcs::TEXT);
  PERFORM pg_temp.f4_record('D6', 'AC-75(TX-05,g3_staff_resolution-missing)-canonical-unchanged', v_canon_before, v_canon_after);
  PERFORM pg_temp.f4_record('D6', 'AC-75(TX-05,g3_staff_resolution-missing)-full-cbr-record-set-unchanged', v_before_cbr_set::TEXT, v_after_cbr_set::TEXT);
  PERFORM pg_temp.f4_record('D6', 'AC-75(TX-05,g3_staff_resolution-missing)-gate-row-restored', '1',
    (SELECT count(*)::TEXT FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_staff_resolution'));

  -- Final, whole-table sanity check: exactly 3 gate rows remain, matching
  -- the Step 0c precondition, proving every delete/restore pair across
  -- Block D left no permanent trace even before this file's own ROLLBACK
  -- is reached.
  PERFORM pg_temp.f4_record('D6', 'final-gate-row-count', '3',
    (SELECT count(*)::TEXT FROM cbr_internal.cbr_field_gate_state));
END $$;

-- ============================================================
-- Results: readable result set, returned before the final hard-failure check.
-- ============================================================
SELECT seq, block, assertion, expected, actual, status FROM f4_results ORDER BY seq;

SELECT
  count(*) FILTER (WHERE status = 'PASS') AS pass_count,
  count(*) FILTER (WHERE status = 'FAIL') AS fail_count,
  count(*) AS total_count
FROM f4_results;

-- ── Final hard-failure check: raises if ANY assertion above recorded FAIL, ──
-- ── OR if the total assertion count does not match the exact count this  ──
-- ── file's own corrected execution paths are expected to produce -- a    ──
-- ── silently-skipped or silently-duplicated assertion is therefore also  ──
-- ── caught, not only an explicit FAIL.                                   ──
DO $$
DECLARE v_fail_count INT; v_total_count INT; v_detail TEXT; v_expected_total CONSTANT INT := 71;
BEGIN
  SELECT count(*) FILTER (WHERE status = 'FAIL'), count(*),
         string_agg(format('[%s] %s: expected=%s actual=%s', block, assertion, expected, actual), E'\n' ORDER BY seq) FILTER (WHERE status = 'FAIL')
    INTO v_fail_count, v_total_count, v_detail
    FROM f4_results;

  IF v_fail_count > 0 THEN
    RAISE EXCEPTION '% assertion(s) FAILED:%', v_fail_count, (E'\n' || v_detail);
  END IF;
  IF v_total_count <> v_expected_total THEN
    RAISE EXCEPTION 'ASSERTION COUNT MISMATCH: expected exactly % recorded assertions (derived from this file''s own corrected execution paths), found %. This indicates a branch ran a different number of times than expected (e.g. skipped, or unexpectedly repeated) -- investigate before trusting fail_count=0 alone.', v_expected_total, v_total_count;
  END IF;
  RAISE NOTICE '[OK] all % assertions PASSED, matching the expected count of %.', v_total_count, v_expected_total;
END $$;

-- Always ends here, pass or fail: nothing this file did is intended to persist.
ROLLBACK;
