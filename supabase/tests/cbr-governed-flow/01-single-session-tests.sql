-- ============================================================
-- CBR Governed Confirmation & Promotion Flow — single-session acceptance tests
-- ============================================================
-- Covers AC-01 through AC-75 (functional/outcome correctness, sequential
-- calls). Cases whose point is specifically to prove WAITING / lock order
-- / race resolution (AC-58, AC-61, AC-62, AC-63, AC-65, AC-66, and the
-- true-concurrency half of AC-64) are exercised here only for their
-- deterministic outcome logic — the actual two-session blocking behavior
-- is NOT proven by this file. See concurrency/ for that.
--
-- UNEXECUTED: written and statically reviewed only, never run against a
-- database. Requires 00-helpers.sql loaded first, in a disposable local
-- Supabase/Postgres instance. Every DO block is independent (its own
-- fixtures); running the whole file top to bottom is the intended mode.
-- All PASS/FAIL output is via RAISE NOTICE/RAISE EXCEPTION from
-- cbr_test.assert_eq — nothing here has actually executed.
-- ============================================================

\set ON_ERROR_STOP on

-- ── AC-01..AC-04: terminal-decision immutability ──────────────────────
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_outcome TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac01@example.invalid', v_admin);
  -- Residual correction (fixture timing): the gate must be toggled ON
  -- (opening its admission window at clock_timestamp()) BEFORE the
  -- submission is created, not after -- make_submission's default
  -- (clock_timestamp()) only produces an ADMITTED submitted_at if the
  -- window is already open at that point; a submission created first
  -- always precedes any window opened afterward, in real call order,
  -- and would incorrectly resolve ADMISSION_BOUNDARY.
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('Alejandro')));
  SELECT outcome, observation_id INTO v_outcome, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  PERFORM cbr_test.assert_eq('AC-45-setup', 'OBSERVED', v_outcome);
  SELECT outcome, decision_id INTO v_outcome, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM cbr_test.assert_eq('AC-31-setup', 'OPENED', v_outcome);
  SELECT outcome INTO v_outcome FROM public.cbr_tx04_approve_g3(v_dec, v_admin, NULL);
  PERFORM cbr_test.assert_eq('AC-53-setup(approve)', 'APPROVED', v_outcome);

  -- AC-01: same-state metadata rewrite on a terminal DECISION.
  BEGIN
    UPDATE public.canonical_beneficiary_records SET decision_reason = 'tampered' WHERE id = v_dec;
    RAISE EXCEPTION '[FAIL] AC-01: expected CBR_TERMINAL_REWRITE_VIOLATION, no exception raised';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'CBR_TERMINAL_REWRITE_VIOLATION%' THEN RAISE NOTICE '[PASS] AC-01'; ELSE RAISE; END IF;
  END;

  -- AC-03: terminal state-change rewrite attempt.
  BEGIN
    UPDATE public.canonical_beneficiary_records SET decision_state = 'rejected' WHERE id = v_dec;
    RAISE EXCEPTION '[FAIL] AC-03: expected CBR_TERMINAL_REWRITE_VIOLATION, no exception raised';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'CBR_TERMINAL_REWRITE_VIOLATION%' THEN RAISE NOTICE '[PASS] AC-03'; ELSE RAISE; END IF;
  END;

  -- AC-04: identical no-op update permitted.
  UPDATE public.canonical_beneficiary_records SET decision_state = decision_state WHERE id = v_dec;
  RAISE NOTICE '[PASS] AC-04 (no exception on identical update)';

  ROLLBACK; -- discard fixture; savepoint semantics handled by wrapping caller transaction
END $$;

-- AC-02: pending metadata-only edit (separate fixture, decision left pending).
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_outcome TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac02@example.invalid', v_admin);
  -- Residual correction (fixture timing): toggle before submission (see AC-01 comment above).
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('Alejandro')));
  SELECT observation_id INTO v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  SELECT decision_id INTO v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  BEGIN
    UPDATE public.canonical_beneficiary_records SET decision_reason = 'premature' WHERE id = v_dec;
    RAISE EXCEPTION '[FAIL] AC-02: expected CBR_INVALID_TRANSITION, no exception raised';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'CBR_INVALID_TRANSITION%' THEN RAISE NOTICE '[PASS] AC-02'; ELSE RAISE; END IF;
  END;
END $$;

-- AC-05: attempt to change candidate_value/origin/expected_prior_value.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac05@example.invalid', v_admin);
  -- Residual correction (fixture timing): toggle before submission (see AC-01 comment above).
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('Alejandro')));
  SELECT observation_id INTO v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  BEGIN
    UPDATE public.canonical_beneficiary_records SET candidate_value = 'Tampered' WHERE id = v_obs;
    RAISE EXCEPTION '[FAIL] AC-05: expected CBR_IMMUTABLE_FIELD_VIOLATION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'CBR_IMMUTABLE_FIELD_VIOLATION%' THEN RAISE NOTICE '[PASS] AC-05'; ELSE RAISE; END IF;
  END;
END $$;

-- AC-06: privileged direct INSERT with mismatched candidate_value is blocked by the trigger.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac06@example.invalid', v_admin);
  -- Residual correction (fixture timing): toggle before submission (see AC-01 comment above).
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('Alejandro')));
  SELECT observation_id INTO v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  BEGIN
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_observation_id, candidate_value, decision_state, expected_prior_value)
      VALUES (v_client, 'DECISION', 'middleName', v_obs, 'WRONG_VALUE', 'pending', NULL);
    RAISE EXCEPTION '[FAIL] AC-06: expected CBR_RELATIONSHIP_VIOLATION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'CBR_RELATIONSHIP_VIOLATION%' THEN RAISE NOTICE '[PASS] AC-06'; ELSE RAISE; END IF;
  END;
END $$;

-- AC-07: direct INSERT while gate disabled SUCCEEDS (procedural gap, by design).
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac07@example.invalid', v_admin);
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('Alejandro')));
  -- gate left disabled (fresh fixture defaults) intentionally.
  INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, candidate_value)
    VALUES (v_client, 'CANDIDATE_OBSERVED', 'middleName', v_sub, 'Alejandro');
  RAISE NOTICE '[PASS] AC-07 (direct insert succeeded despite disabled gate, as expected — see AC-52 for the resulting integrity check)';
END $$;

-- AC-08/AC-09/AC-10: gate/window consistency, all variants, using direct table
-- corruption to force an inconsistent state, then calling cbr_toggle_gate.
DO $$
DECLARE v_admin UUID;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  -- AC-08(a): g1g2 enabled=true, no window. Force inconsistency directly.
  UPDATE cbr_internal.cbr_field_gate_state SET enabled = true WHERE gate = 'g1g2';
  BEGIN
    PERFORM cbr_internal.cbr_toggle_gate('g1g2', true, v_admin); -- (a) matches
    RAISE EXCEPTION '[FAIL] AC-08(a)';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'CBR_GATE_WINDOW_INCONSISTENT%' THEN RAISE NOTICE '[PASS] AC-08(a)'; ELSE RAISE; END IF; END;
  BEGIN
    PERFORM cbr_internal.cbr_toggle_gate('g1g2', false, v_admin); -- (b) differs
    RAISE EXCEPTION '[FAIL] AC-08(b)';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'CBR_GATE_WINDOW_INCONSISTENT%' THEN RAISE NOTICE '[PASS] AC-08(b)'; ELSE RAISE; END IF; END;
  UPDATE cbr_internal.cbr_field_gate_state SET enabled = false WHERE gate = 'g1g2'; -- reset

  -- AC-09: g1g2 disabled=false, window open.
  INSERT INTO cbr_internal.cbr_field_admission_window (gate, opened_at) VALUES ('g1g2', now());
  BEGIN
    PERFORM cbr_internal.cbr_toggle_gate('g1g2', false, v_admin);
    RAISE EXCEPTION '[FAIL] AC-09(a)';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'CBR_GATE_WINDOW_INCONSISTENT%' THEN RAISE NOTICE '[PASS] AC-09(a)'; ELSE RAISE; END IF; END;
  BEGIN
    PERFORM cbr_internal.cbr_toggle_gate('g1g2', true, v_admin);
    RAISE EXCEPTION '[FAIL] AC-09(b)';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'CBR_GATE_WINDOW_INCONSISTENT%' THEN RAISE NOTICE '[PASS] AC-09(b)'; ELSE RAISE; END IF; END;
  DELETE FROM cbr_internal.cbr_field_admission_window WHERE gate = 'g1g2';

  -- AC-10: compound mismatch, direction 1 (effective true, no window), both selectable gates, both p_enable.
  UPDATE cbr_internal.cbr_field_gate_state SET enabled = true WHERE gate IN ('g3_observation','g3_staff_resolution');
  BEGIN PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin); RAISE EXCEPTION '[FAIL] AC-10(dir1,obs,match)';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'CBR_GATE_WINDOW_INCONSISTENT%' THEN RAISE NOTICE '[PASS] AC-10(dir1,obs,match)'; ELSE RAISE; END IF; END;
  BEGIN PERFORM cbr_internal.cbr_toggle_gate('g3_observation', false, v_admin); RAISE EXCEPTION '[FAIL] AC-10(dir1,obs,differ)';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'CBR_GATE_WINDOW_INCONSISTENT%' THEN RAISE NOTICE '[PASS] AC-10(dir1,obs,differ)'; ELSE RAISE; END IF; END;
  BEGIN PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin); RAISE EXCEPTION '[FAIL] AC-10(dir1,staff,match)';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'CBR_GATE_WINDOW_INCONSISTENT%' THEN RAISE NOTICE '[PASS] AC-10(dir1,staff,match)'; ELSE RAISE; END IF; END;
  BEGIN PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', false, v_admin); RAISE EXCEPTION '[FAIL] AC-10(dir1,staff,differ)';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'CBR_GATE_WINDOW_INCONSISTENT%' THEN RAISE NOTICE '[PASS] AC-10(dir1,staff,differ)'; ELSE RAISE; END IF; END;
  UPDATE cbr_internal.cbr_field_gate_state SET enabled = false WHERE gate IN ('g3_observation','g3_staff_resolution');

  -- AC-10 direction 2: effective false, window open.
  INSERT INTO cbr_internal.cbr_field_admission_window (gate, opened_at) VALUES ('g3_observation', now());
  BEGIN PERFORM cbr_internal.cbr_toggle_gate('g3_observation', false, v_admin); RAISE EXCEPTION '[FAIL] AC-10(dir2,obs,match)';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'CBR_GATE_WINDOW_INCONSISTENT%' THEN RAISE NOTICE '[PASS] AC-10(dir2,obs,match)'; ELSE RAISE; END IF; END;
  DELETE FROM cbr_internal.cbr_field_admission_window WHERE gate = 'g3_observation';
END $$;

-- AC-11..AC-17: toggle input validation and initialization.
DO $$
DECLARE v_admin UUID; v_outcome TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  SELECT outcome INTO v_outcome FROM cbr_internal.cbr_toggle_gate(NULL, true, v_admin);
  PERFORM cbr_test.assert_eq('AC-11', 'INVALID_GATE', v_outcome);
  SELECT outcome INTO v_outcome FROM cbr_internal.cbr_toggle_gate('foo', true, v_admin);
  PERFORM cbr_test.assert_eq('AC-12', 'INVALID_GATE', v_outcome);
  SELECT outcome INTO v_outcome FROM cbr_internal.cbr_toggle_gate('g1g2', NULL, v_admin);
  PERFORM cbr_test.assert_eq('AC-13', 'INVALID_INPUT', v_outcome);
  SELECT outcome INTO v_outcome FROM cbr_internal.cbr_toggle_gate('g1g2', true, NULL);
  PERFORM cbr_test.assert_eq('AC-14', 'MISSING_REFERENCE', v_outcome);
  DECLARE v_agent UUID := cbr_test.make_profile('agent');
  BEGIN
    SELECT outcome INTO v_outcome FROM cbr_internal.cbr_toggle_gate('g1g2', true, v_agent);
    PERFORM cbr_test.assert_eq('AC-15', 'UNAUTHORIZED', v_outcome);
  END;
  SELECT outcome INTO v_outcome FROM cbr_internal.cbr_toggle_gate('g1g2', true, v_admin);
  PERFORM cbr_test.assert_eq('AC-16', 'TOGGLED', v_outcome); -- all 3 rows present (migration-time init)
  -- AC-17: simulate incomplete initialization by removing one row.
  DELETE FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_staff_resolution';
  SELECT outcome INTO v_outcome FROM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_test.assert_eq('AC-17', 'GATE_NOT_INITIALIZED', v_outcome);
  INSERT INTO cbr_internal.cbr_field_gate_state (gate, enabled) VALUES ('g3_staff_resolution', false); -- restore
  UPDATE cbr_internal.cbr_field_gate_state SET enabled = false, updated_at = now() WHERE gate = 'g1g2'; -- reset (no-op if column absent)
EXCEPTION WHEN undefined_column THEN
  UPDATE cbr_internal.cbr_field_gate_state SET enabled = false WHERE gate = 'g1g2';
END $$;

-- AC-18/AC-19: NO_CHANGE / TOGGLED.
DO $$
DECLARE v_admin UUID; v_outcome TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  SELECT outcome INTO v_outcome FROM cbr_internal.cbr_toggle_gate('g1g2', false, v_admin);
  PERFORM cbr_test.assert_eq('AC-18', 'NO_CHANGE', v_outcome); -- already false
  SELECT outcome INTO v_outcome FROM cbr_internal.cbr_toggle_gate('g1g2', true, v_admin);
  PERFORM cbr_test.assert_eq('AC-19', 'TOGGLED', v_outcome);
  PERFORM cbr_internal.cbr_toggle_gate('g1g2', false, v_admin); -- reset
END $$;

-- AC-20: compound window closes when staff disabled, observation flag unchanged.
DO $$
DECLARE v_admin UUID; v_open BOOLEAN;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  SELECT EXISTS(SELECT 1 FROM cbr_internal.cbr_field_admission_window WHERE gate='g3_observation' AND closed_at IS NULL) INTO v_open;
  PERFORM cbr_test.assert_eq('AC-20-setup', 'true', v_open::TEXT);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', false, v_admin);
  SELECT EXISTS(SELECT 1 FROM cbr_internal.cbr_field_admission_window WHERE gate='g3_observation' AND closed_at IS NULL) INTO v_open;
  PERFORM cbr_test.assert_eq('AC-20', 'false', v_open::TEXT);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', false, v_admin); -- reset
END $$;

-- AC-21/AC-22: event-time ordering, S1/S2, tie-breaker.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_s2 UUID;
        v_o1 TEXT; v_o2 TEXT; v_gov UUID; v_gov_ts TIMESTAMPTZ; v_t0 TIMESTAMPTZ;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac21@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  -- IC Finding 5.1: submitted_at values must be anchored to clock_timestamp()
  -- (captured AFTER the gate toggles above), never to a hardcoded past date --
  -- otherwise, whenever this suite runs on a real wall-clock date later than
  -- the hardcoded date, submitted_at < window.opened_at and every submission
  -- below would incorrectly resolve to ADMISSION_BOUNDARY instead of the
  -- intended outcome. Relative offsets from v_t0 preserve the same intended
  -- S1-before-S2 ordering while staying safely after the window's opened_at.
  v_t0 := clock_timestamp();
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('Value1')), v_t0 + interval '1 minute');
  v_s2 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('Value2')), v_t0 + interval '6 minutes');
  -- process S1 "late" (simulated by simply calling it first; governing_submitted_at is snapshotted
  -- from S1's own submitted_at, not execution time, so processing order vs submitted_at are independent).
  SELECT outcome INTO v_o1 FROM public.cbr_tx02_observe_g3(v_s1, 'middleName');
  PERFORM cbr_test.assert_eq('AC-21-S1', 'OBSERVED', v_o1);
  SELECT outcome INTO v_o2 FROM public.cbr_tx02_observe_g3(v_s2, 'middleName');
  PERFORM cbr_test.assert_eq('AC-21', 'CONFLICT', v_o2); -- S2 newer, differing value vs S1's CURRENT candidate -> CONFLICT, not STALE
  SELECT governing_submission_id, governing_submitted_at INTO v_gov, v_gov_ts
    FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client AND field_key = 'middleName';
  PERFORM cbr_test.assert_eq('AC-21-governing', v_s2::TEXT, v_gov::TEXT);
  PERFORM cbr_test.assert_eq('AC-21-governing-ts', (v_t0 + interval '6 minutes')::TEXT, v_gov_ts::TEXT);

  -- AC-22 (Finding 6: previously claimed by this block's header comment but
  -- never actually asserted -- AC-21's own S1/S2 have DISTINCT submitted_at
  -- values, so no case here exercised the tie-breaker at all). Two
  -- submissions with the EXACT SAME submitted_at, distinct submission_id ->
  -- tuple comparison falls through to comparing submission_id (§G's tuple
  -- comparison, mirrored exactly from TX-02's own
  -- `(s.submitted_at, s.id) >= (governing_submitted_at, governing_submission_id)`).
  --
  -- Finding 6 v2 targeted correction: the first version of this case always
  -- processed the LEXICOGRAPHICALLY SMALLER submission_id first and the
  -- LARGER one second, then asserted "whichever was processed second wins"
  -- -- which an INCORRECT implementation that simply lets the
  -- last-processed submission win (e.g. ordering by real processing time
  -- rather than the true (submitted_at, submission_id) tuple) would ALSO
  -- satisfy, since in that single order the two predictions coincide. Fixed
  -- with two INDEPENDENT fixtures/clients, each explicitly forcing a
  -- DIFFERENT relative processing order regardless of which UUID
  -- gen_random_uuid() happens to produce for that pair:
  --   Case 1: smaller-UUID processed FIRST, larger-UUID processed SECOND.
  --   Case 2: larger-UUID processed FIRST, smaller-UUID processed SECOND --
  --     the discriminating case. The correct rule (compare by UUID value,
  --     not by processing order) requires the SECOND call here (the
  --     smaller/older tuple) to be classified STALE (never OBSERVED/
  --     CONFLICT -- no replay row exists for this never-before-processed
  --     submission, so per §I.2's NULL-safe staleness check, a tuple that
  --     is not >= the current governing tuple is STALE) and governing to
  --     REMAIN the FIRST-processed (larger-UUID) submission, unchanged. A
  --     naive "last write wins" implementation would instead let the
  --     second (smaller, older-tuple) submission become governing and
  --     would likely also return a non-STALE outcome -- exactly what this
  --     case is designed to catch.
  DECLARE
    v_tie_ts TIMESTAMPTZ := v_t0 + interval '16 minutes';
    v_client22a UUID := cbr_test.make_client(); v_case22a UUID; v_inv22a UUID;
    v_client22b UUID := cbr_test.make_client(); v_case22b UUID; v_inv22b UUID;
    v_sA UUID; v_sB UUID; v_smaller UUID; v_larger UUID;
    v_o TEXT; v_actual_winner UUID; v_gov_ts TIMESTAMPTZ; v_gov_ts_before_stale_call TIMESTAMPTZ;
  BEGIN
    -- Case 1: smaller-UUID first, larger-UUID second -- establishes the
    -- baseline correct behavior (both a correct and a naive-last-write-wins
    -- implementation agree here; this case alone would NOT catch the bug).
    v_case22a := cbr_test.make_case(v_client22a);
    v_inv22a := cbr_test.make_invitation(v_case22a, v_client22a, 'ac22a@example.invalid', v_admin);
    v_sA := cbr_test.make_submission(v_client22a, v_case22a, v_inv22a, jsonb_build_object('middleName', cbr_test.sp_field('TieA1')), v_tie_ts);
    v_sB := cbr_test.make_submission(v_client22a, v_case22a, v_inv22a, jsonb_build_object('middleName', cbr_test.sp_field('TieA2')), v_tie_ts);
    PERFORM cbr_test.assert_eq('AC-22-case1-precondition-distinct-ids', 'true', (v_sA IS DISTINCT FROM v_sB)::TEXT);
    IF v_sA::TEXT < v_sB::TEXT THEN v_smaller := v_sA; v_larger := v_sB; ELSE v_smaller := v_sB; v_larger := v_sA; END IF;
    SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_smaller, 'middleName');
    PERFORM cbr_test.assert_eq('AC-22-case1-first-call(smaller)', 'OBSERVED', v_o); -- first-ever event for this client/field
    SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_larger, 'middleName');
    PERFORM cbr_test.assert_eq('AC-22-case1-second-call(larger)', 'CONFLICT', v_o); -- differing value, canonical absent, prior CURRENT candidate exists
    SELECT governing_submission_id, governing_submitted_at INTO v_actual_winner, v_gov_ts
      FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client22a AND field_key = 'middleName';
    PERFORM cbr_test.assert_eq('AC-22-case1-governing-is-larger', v_larger::TEXT, v_actual_winner::TEXT);
    -- Finding 6 v3: both submissions in this pair share the EXACT SAME submitted_at (v_tie_ts) --
    -- the tie-break is decided entirely by submission_id, never by timestamp, so
    -- governing_submitted_at must equal that shared source timestamp regardless of which
    -- submission_id won the tie-break above.
    PERFORM cbr_test.assert_eq('AC-22-case1-governing-submitted-at-equals-shared-source-timestamp', v_tie_ts::TEXT, v_gov_ts::TEXT);

    -- Case 2: larger-UUID first, smaller-UUID second -- the discriminating
    -- case. A fresh, independent client/pair, so this pair's own
    -- smaller/larger assignment is re-determined at runtime and is
    -- independent of case 1's.
    v_case22b := cbr_test.make_case(v_client22b);
    v_inv22b := cbr_test.make_invitation(v_case22b, v_client22b, 'ac22b@example.invalid', v_admin);
    v_sA := cbr_test.make_submission(v_client22b, v_case22b, v_inv22b, jsonb_build_object('middleName', cbr_test.sp_field('TieB1')), v_tie_ts);
    v_sB := cbr_test.make_submission(v_client22b, v_case22b, v_inv22b, jsonb_build_object('middleName', cbr_test.sp_field('TieB2')), v_tie_ts);
    PERFORM cbr_test.assert_eq('AC-22-case2-precondition-distinct-ids', 'true', (v_sA IS DISTINCT FROM v_sB)::TEXT);
    IF v_sA::TEXT < v_sB::TEXT THEN v_smaller := v_sA; v_larger := v_sB; ELSE v_smaller := v_sB; v_larger := v_sA; END IF;
    SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_larger, 'middleName'); -- processed FIRST this time
    PERFORM cbr_test.assert_eq('AC-22-case2-first-call(larger)', 'OBSERVED', v_o); -- first-ever event for this client/field
    -- Finding 6 v3: capture governing_submitted_at BEFORE the STALE call below, so the
    -- "unchanged after the STALE call" assertion that follows is measured against a real
    -- pre-call snapshot, not merely re-asserted from whatever the post-call value happens to be.
    SELECT governing_submitted_at INTO v_gov_ts_before_stale_call
      FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client22b AND field_key = 'middleName';
    PERFORM cbr_test.assert_eq('AC-22-case2-governing-submitted-at-before-stale-call', v_tie_ts::TEXT, v_gov_ts_before_stale_call::TEXT);
    SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_smaller, 'middleName'); -- processed SECOND, but its own tuple is OLDER (smaller id, same timestamp)
    PERFORM cbr_test.assert_eq('AC-22-case2-second-call(smaller)-must-be-stale', 'STALE', v_o); -- the exact assertion a naive last-write-wins bug fails
    SELECT governing_submission_id, governing_submitted_at INTO v_actual_winner, v_gov_ts
      FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client22b AND field_key = 'middleName';
    PERFORM cbr_test.assert_eq('AC-22-case2-governing-still-larger-not-displaced', v_larger::TEXT, v_actual_winner::TEXT);
    -- Finding 6 v3: the governing TIMESTAMP, not only the governing submission_id, must remain
    -- exactly unchanged after the STALE call -- both against the shared source timestamp AND,
    -- directly, against the pre-call snapshot captured above (the same assertion proven two
    -- independent ways: "still equals what it should be" and "did not move at all").
    PERFORM cbr_test.assert_eq('AC-22-case2-governing-submitted-at-equals-shared-source-timestamp', v_tie_ts::TEXT, v_gov_ts::TEXT);
    PERFORM cbr_test.assert_eq('AC-22-case2-governing-submitted-at-unchanged-after-stale-call', v_gov_ts_before_stale_call::TEXT, v_gov_ts::TEXT);
    -- The older (smaller-UUID) tuple's STALE classification must produce NO record at all --
    -- confirming it did not "create unintended records" despite being processed second.
    PERFORM cbr_test.assert_eq('AC-22-case2-no-record-for-stale-submission', '0',
      (SELECT count(*)::TEXT FROM public.canonical_beneficiary_records WHERE client_id = v_client22b AND source_submission_id = v_smaller));
  END;
END $$;

-- AC-33..AC-40: replay vs STALE, TX-01 base retry contract.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_s2 UUID; v_s3 UUID; v_o TEXT; v_rv TEXT; v_t0 TIMESTAMPTZ;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac33@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g1g2', true, v_admin);
  -- IC Finding 5.1: anchor to clock_timestamp(), not a hardcoded past date (see AC-21 comment above).
  v_t0 := clock_timestamp();
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('countryOfResidence', cbr_test.sp_field('Colombia')), v_t0 + interval '1 minute');
  SELECT outcome, realized_value INTO v_o, v_rv FROM public.cbr_tx01_realize_g1g2(v_s1, 'countryOfResidence');
  PERFORM cbr_test.assert_eq('AC-37(first)', 'REALIZED', v_o);
  -- AC-37: retry, canonical unchanged -> replay.
  SELECT outcome, realized_value INTO v_o, v_rv FROM public.cbr_tx01_realize_g1g2(v_s1, 'countryOfResidence');
  PERFORM cbr_test.assert_eq('AC-37', 'REALIZED', v_o);
  PERFORM cbr_test.assert_eq('AC-37-value', 'Colombia', v_rv);
  -- AC-38: independently diverge canonical, retry again -> replay returns ORIGINAL value, unchanged canonical.
  UPDATE public.clients SET country_of_residence = 'Peru' WHERE id = v_client;
  SELECT outcome, realized_value INTO v_o, v_rv FROM public.cbr_tx01_realize_g1g2(v_s1, 'countryOfResidence');
  PERFORM cbr_test.assert_eq('AC-38', 'REALIZED', v_o);
  PERFORM cbr_test.assert_eq('AC-38-value', 'Colombia', v_rv);
  PERFORM cbr_test.assert_eq('AC-38-canonical-untouched', 'Peru', (SELECT country_of_residence FROM public.clients WHERE id=v_client));

  -- AC-39/AC-40: NO_OP-origin retry, unchanged then diverged.
  UPDATE public.clients SET whatsapp = '+15551234567' WHERE id = v_client;
  v_s2 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('whatsapp', cbr_test.sp_field('+1 555 123 4567')), v_t0 + interval '11 minutes');
  SELECT outcome INTO v_o FROM public.cbr_tx01_realize_g1g2(v_s2, 'whatsapp');
  PERFORM cbr_test.assert_eq('AC-39(first NO_OP)', 'NO_OP', v_o);
  SELECT outcome INTO v_o FROM public.cbr_tx01_realize_g1g2(v_s2, 'whatsapp'); -- retry, unchanged
  PERFORM cbr_test.assert_eq('AC-39', 'NO_OP', v_o);
  UPDATE public.clients SET whatsapp = '+19998887777' WHERE id = v_client; -- independent divergence
  SELECT outcome INTO v_o FROM public.cbr_tx01_realize_g1g2(v_s2, 'whatsapp'); -- retry, diverged
  PERFORM cbr_test.assert_eq('AC-40', 'DIVERGED_NO_ACTION', v_o);
  PERFORM cbr_test.assert_eq('AC-40-canonical-untouched', '+19998887777', (SELECT whatsapp FROM public.clients WHERE id=v_client));

  -- AC-35/AC-36: STALE (NO_OP-origin retried after newer event; first-time stale arrival).
  v_s3 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('whatsapp', cbr_test.sp_field('+12223334444')), v_t0 + interval '21 minutes');
  PERFORM public.cbr_tx01_realize_g1g2(v_s3, 'whatsapp'); -- advances governing to s3
  SELECT outcome INTO v_o FROM public.cbr_tx01_realize_g1g2(v_s2, 'whatsapp'); -- s2 (NO_OP-origin, older) retried
  PERFORM cbr_test.assert_eq('AC-35', 'STALE', v_o);
  -- v_s0 intentionally predates v_s2/v_s3 (still safely after v_t0/window-open) to exercise
  -- "never processed, arrives late" (AC-36) without crossing the admission boundary itself.
  DECLARE v_s0 UUID := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('whatsapp', cbr_test.sp_field('+10000000000')), v_t0 + interval '30 seconds');
  BEGIN
    SELECT outcome INTO v_o FROM public.cbr_tx01_realize_g1g2(v_s0, 'whatsapp'); -- never processed, arrives late
    PERFORM cbr_test.assert_eq('AC-36', 'STALE', v_o);
  END;

  -- AC-33 (Finding 6: previously claimed by this block's own header comment
  -- "AC-33..AC-40" but never actually asserted anywhere in this file -- every
  -- existing case here retries either with canonical merely UNCHANGED/
  -- DIVERGED (AC-37/38) or a NO_OP-origin submission that genuinely has no
  -- replay row (AC-35/36); none retried a REALIZED-origin (CHANGE_REALIZED)
  -- submission AFTER a strictly newer submission had already become
  -- governing -- the exact precondition AC-33 requires). Proves the replay
  -- lookup (keyed on submission_id) is checked BEFORE the ordering/STALE
  -- check, so a genuinely-replayable submission is never misclassified
  -- STALE merely because a newer submission has since taken over governance.
  DECLARE
    v_client33 UUID := cbr_test.make_client(); v_case33 UUID; v_inv33 UUID;
    v_s33a UUID; v_s33b UUID; v_o33 TEXT; v_rv33 TEXT;
  BEGIN
    v_case33 := cbr_test.make_case(v_client33);
    v_inv33 := cbr_test.make_invitation(v_case33, v_client33, 'ac33@example.invalid', v_admin);
    v_s33a := cbr_test.make_submission(v_client33, v_case33, v_inv33, jsonb_build_object('countryOfResidence', cbr_test.sp_field('Bolivia')), v_t0 + interval '41 minutes');
    SELECT outcome, realized_value INTO v_o33, v_rv33 FROM public.cbr_tx01_realize_g1g2(v_s33a, 'countryOfResidence');
    PERFORM cbr_test.assert_eq('AC-33-setup', 'REALIZED', v_o33);
    v_s33b := cbr_test.make_submission(v_client33, v_case33, v_inv33, jsonb_build_object('countryOfResidence', cbr_test.sp_field('Uruguay')), v_t0 + interval '42 minutes');
    SELECT outcome INTO v_o33 FROM public.cbr_tx01_realize_g1g2(v_s33b, 'countryOfResidence'); -- strictly newer -> becomes governing
    PERFORM cbr_test.assert_eq('AC-33-setup-newer-governs', 'REALIZED', v_o33);
    -- retry the now strictly-OLDER v_s33a: replay lookup (keyed on submission_id) must find its
    -- CHANGE_REALIZED row and return it, never reaching (or being misclassified by) the
    -- ordering/STALE check that would otherwise apply given a newer submission now governs.
    SELECT outcome, realized_value INTO v_o33, v_rv33 FROM public.cbr_tx01_realize_g1g2(v_s33a, 'countryOfResidence');
    PERFORM cbr_test.assert_eq('AC-33', 'REALIZED', v_o33);
    PERFORM cbr_test.assert_eq('AC-33-value', 'Bolivia', v_rv33);
  END;

  -- AC-34 (Finding 6: same previously-claimed-but-unasserted gap as AC-33,
  -- for TX-02's CANDIDATE_OBSERVED/CONFLICT_DETECTED-origin replay instead
  -- of TX-01's CHANGE_REALIZED-origin replay).
  DECLARE
    v_client34 UUID := cbr_test.make_client(); v_case34 UUID; v_inv34 UUID;
    v_s34a UUID; v_s34b UUID; v_o34 TEXT; v_obs34 UUID;
  BEGIN
    v_case34 := cbr_test.make_case(v_client34);
    v_inv34 := cbr_test.make_invitation(v_case34, v_client34, 'ac34@example.invalid', v_admin);
    PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
    PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
    v_s34a := cbr_test.make_submission(v_client34, v_case34, v_inv34, jsonb_build_object('middleName', cbr_test.sp_field('Diego')), v_t0 + interval '51 minutes');
    SELECT outcome, observation_id INTO v_o34, v_obs34 FROM public.cbr_tx02_observe_g3(v_s34a, 'middleName');
    PERFORM cbr_test.assert_eq('AC-34-setup', 'OBSERVED', v_o34);
    PERFORM cbr_test.assert_not_null('AC-34-setup-observation_id', v_obs34);
    v_s34b := cbr_test.make_submission(v_client34, v_case34, v_inv34, jsonb_build_object('middleName', cbr_test.sp_field('Esteban')), v_t0 + interval '52 minutes');
    SELECT outcome INTO v_o34 FROM public.cbr_tx02_observe_g3(v_s34b, 'middleName'); -- strictly newer -> becomes governing
    PERFORM cbr_test.assert_eq('AC-34-setup-newer-governs', 'CONFLICT', v_o34); -- canonical absent, prior CURRENT candidate (Diego) differs
    -- retry the now strictly-OLDER v_s34a: replay lookup finds its own CANDIDATE_OBSERVED row
    -- and returns it, never reaching the ordering/STALE check.
    SELECT outcome INTO v_o34 FROM public.cbr_tx02_observe_g3(v_s34a, 'middleName');
    PERFORM cbr_test.assert_eq('AC-34', 'OBSERVED', v_o34);
  END;
END $$;

-- AC-41..AC-44: email gate.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'invited@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g1g2', true, v_admin);

  -- AC-41: mismatch.
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('email', cbr_test.sp_field('different@example.invalid')));
  SELECT outcome INTO v_o FROM public.cbr_tx01_realize_g1g2(v_sub, 'email');
  PERFORM cbr_test.assert_eq('AC-41', 'REFERENCE_MISMATCH', v_o);

  -- AC-42: missing invitation_id.
  INSERT INTO public.intake_submissions (client_id, case_id, invitation_id, structured_profile, submitted_at)
    VALUES (v_client, v_case, NULL, jsonb_build_object('email', cbr_test.sp_field('invited@example.invalid')), now())
    RETURNING id INTO v_sub;
  SELECT outcome INTO v_o FROM public.cbr_tx01_realize_g1g2(v_sub, 'email');
  PERFORM cbr_test.assert_eq('AC-42', 'REFERENCE_MISSING', v_o);

  -- AC-43: CONTACT_PROTECTED (canonical independently diverged from both submitted and invitation values).
  UPDATE public.clients SET email = 'staff-corrected@example.invalid' WHERE id = v_client;
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('email', cbr_test.sp_field('invited@example.invalid')));
  SELECT outcome INTO v_o FROM public.cbr_tx01_realize_g1g2(v_sub, 'email');
  PERFORM cbr_test.assert_eq('AC-43', 'CONTACT_PROTECTED', v_o);

  -- AC-44: replay pre-empts a fresh CONTACT_PROTECTED evaluation.
  UPDATE public.clients SET email = NULL WHERE id = v_client;
  DECLARE v_sub2 UUID := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('email', cbr_test.sp_field('invited@example.invalid')));
  BEGIN
    PERFORM public.cbr_tx01_realize_g1g2(v_sub2, 'email'); -- REALIZED (first time, canonical was NULL)
    UPDATE public.clients SET email = 'someone-else@example.invalid' WHERE id = v_client; -- independent divergence
    SELECT outcome INTO v_o FROM public.cbr_tx01_realize_g1g2(v_sub2, 'email'); -- retry -> replay, not a fresh CONTACT_PROTECTED eval
    PERFORM cbr_test.assert_eq('AC-44', 'REALIZED', v_o);
  END;
END $$;

-- AC-45..AC-52: TX-02 action table, integrity, conflict-replay association, supersession.
--
-- IC Targeted Correction 3 (canonical-value assumption): this whole block was
-- written against 'firstName'/'givenName', but clients.first_name is NOT NULL
-- (schema.sql) -- cbr_test.make_client() always sets it to the fixed,
-- non-NULL value 'CBRTest'. Every AC below whose design intent is
-- "canonical ABSENT, first-ever event -> OBSERVED" (AC-45, AC-46's setup,
-- AC-49's setup) would therefore actually reach the CONFLICT branch, not
-- OBSERVED, against the previously-reviewed fixture. Corrected by moving
-- the whole block to 'middleName'/'middleName' -- the matching
-- StructuredProfile JSON key IS 'middleName' (unlike firstName/lastName,
-- which rename to givenName/familyName; see TX-02 STEP 4) -- middle_name IS
-- nullable and genuinely absent by default, which is exactly what these
-- acceptance cases require and correctly preserves their approved meaning
-- (multi-candidate fault injection, supersession, and the NULL-governing
-- integrity check are all generic G3-field behaviors, not specific to
-- firstName). AC-52's own sub-scenario (lastName) is UNCHANGED below: its
-- integrity check fires on the mere EXISTENCE of a CBR row despite
-- NULL-governing processing-state, never reads or compares against the
-- canonical value at all, so it was never actually affected by this defect.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_s2 UUID; v_s3 UUID; v_o TEXT; v_obs UUID; v_dec UUID; v_t0 TIMESTAMPTZ;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac45@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  -- IC Finding 5.1: anchor to clock_timestamp(), not a hardcoded past date (see AC-21 comment above).
  v_t0 := clock_timestamp();
  PERFORM cbr_test.assert_null('AC-45-canonical-precondition-absent', (SELECT middle_name FROM public.clients WHERE id = v_client));

  -- AC-45: first-ever event, canonical absent, no prior candidate -> OBSERVED.
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('Alejandro')), v_t0 + interval '1 minute');
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_s1, 'middleName');
  PERFORM cbr_test.assert_eq('AC-45', 'OBSERVED', v_o);
  PERFORM cbr_test.assert_not_null('AC-45-observation_id', v_obs);
  PERFORM cbr_test.assert_record_type('AC-45-observation_type', v_obs, 'CANDIDATE_OBSERVED');

  -- AC-47: replay of a candidate with zero associated conflicts.
  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_s1, 'middleName');
  PERFORM cbr_test.assert_eq('AC-47', 'OBSERVED', v_o);

  -- AC-50: newer event, pending decision, strictly-older origin -> supersession.
  SELECT decision_id INTO v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM cbr_test.assert_not_null('AC-50-setup-decision_id', v_dec);
  v_s2 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('Alexander')), v_t0 + interval '11 minutes');
  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_s2, 'middleName');
  PERFORM cbr_test.assert_eq('AC-50', 'CONFLICT', v_o);
  PERFORM cbr_test.assert_eq('AC-50-superseded', 'superseded', (SELECT decision_state FROM public.canonical_beneficiary_records WHERE id = v_dec));

  -- AC-48: replay of a candidate with exactly one associated conflict.
  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_s2, 'middleName');
  PERFORM cbr_test.assert_eq('AC-48', 'CONFLICT', v_o);

  -- AC-46: >1 CURRENT candidate, via direct fault injection (no trigger bypass needed —
  -- "at most one CURRENT candidate" is an ALGORITHMIC invariant TX-02 itself maintains, not a
  -- database constraint, so a direct INSERT of a second, independently-CURRENT
  -- CANDIDATE_OBSERVED row is sufficient and does not require disabling any trigger).
  DECLARE v_client3 UUID := cbr_test.make_client(); v_case3 UUID; v_inv3 UUID; v_s5 UUID; v_s6 UUID; v_obs3 UUID;
  BEGIN
    v_case3 := cbr_test.make_case(v_client3);
    v_inv3 := cbr_test.make_invitation(v_case3, v_client3, 'ac46@example.invalid', v_admin);
    v_s5 := cbr_test.make_submission(v_client3, v_case3, v_inv3, jsonb_build_object('middleName', cbr_test.sp_field('First46')), v_t0 + interval '21 minutes');
    SELECT outcome, observation_id INTO v_o, v_obs3 FROM public.cbr_tx02_observe_g3(v_s5, 'middleName'); -- legitimate first candidate, becomes governing
    PERFORM cbr_test.assert_eq('AC-46-setup', 'OBSERVED', v_o);
    PERFORM cbr_test.assert_not_null('AC-46-setup-observation_id', v_obs3);
    -- direct fault injection: a SECOND CANDIDATE_OBSERVED for a DIFFERENT, also-current submission
    DECLARE v_s5b UUID := cbr_test.make_submission(v_client3, v_case3, v_inv3, jsonb_build_object('middleName', cbr_test.sp_field('AlsoCurrent46')), v_t0 + interval '21 minutes 30 seconds');
    BEGIN
      INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, candidate_value)
        VALUES (v_client3, 'CANDIDATE_OBSERVED', 'middleName', v_s5b, 'AlsoCurrent46'); -- bypasses only the ALGORITHM's uniqueness discipline, not any trigger/constraint
    END;
    v_s6 := cbr_test.make_submission(v_client3, v_case3, v_inv3, jsonb_build_object('middleName', cbr_test.sp_field('Newer46')), v_t0 + interval '22 minutes');
    BEGIN
      PERFORM public.cbr_tx02_observe_g3(v_s6, 'middleName');
      RAISE EXCEPTION '[FAIL] AC-46: expected CBR_MULTIPLE_CURRENT_CANDIDATES, none raised';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'CBR_MULTIPLE_CURRENT_CANDIDATES%' THEN RAISE NOTICE '[PASS] AC-46 — genuinely raised by the real, unmodified TX-02 function against a directly-injected, algorithm-bypassing multi-current state';
      ELSE RAISE; END IF;
    END;
  END;

  -- AC-49: >1 CONFLICT_DETECTED for one candidate. UNLIKE AC-46, this state cannot be safely
  -- fault-injected without dropping/disabling cbr_conflict_related_candidate_unique itself (a
  -- unique INDEX, not a disableable trigger) — doing so would be a materially more invasive,
  -- harder-to-deterministically-restore bypass than AC-32b/AC-46's trigger-disable technique,
  -- and risks leaving the index state ambiguous if the test fails partway. NOT WRITTEN as a
  -- fault-injection test of TX-02's internal RAISE INTERNAL_INCONSISTENCY line. Instead, the
  -- test below proves the POSITIVE claim that actually matters operationally: the unique index
  -- makes this state unreachable by ANY writer, which is what makes the internal RAISE
  -- provably dead code rather than an untested risk. This is a genuine, safe, real test — of
  -- the constraint, not of the unreachable branch. Disposition proposed for review: accept
  -- AC-49 as PARTIAL on this basis, or explicitly authorize a scoped ALTER INDEX .. bypass in a
  -- disposable environment if branch-level coverage is required regardless.
  DECLARE v_client4 UUID := cbr_test.make_client(); v_case4 UUID; v_inv4 UUID; v_s7 UUID; v_obs4 UUID;
  BEGIN
    v_case4 := cbr_test.make_case(v_client4);
    v_inv4 := cbr_test.make_invitation(v_case4, v_client4, 'ac49@example.invalid', v_admin);
    v_s7 := cbr_test.make_submission(v_client4, v_case4, v_inv4, jsonb_build_object('middleName', cbr_test.sp_field('First49')), v_t0 + interval '31 minutes');
    SELECT observation_id INTO v_obs4 FROM public.cbr_tx02_observe_g3(v_s7, 'middleName');
    PERFORM cbr_test.assert_not_null('AC-49-setup-observation_id', v_obs4);
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, candidate_value, prior_value, related_candidate_id)
      VALUES (v_client4, 'CONFLICT_DETECTED', 'middleName', v_s7, 'First49', 'SomePrior', v_obs4); -- first conflict: legitimate
    BEGIN
      INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, candidate_value, prior_value, related_candidate_id)
        VALUES (v_client4, 'CONFLICT_DETECTED', 'middleName', v_s7, 'First49', 'AnotherPrior', v_obs4); -- second: must be rejected
      RAISE EXCEPTION '[FAIL] AC-49(constraint-proof): expected a unique-violation, none raised';
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE '[PASS] AC-49(constraint-proof) — cbr_conflict_related_candidate_unique makes the >1-conflict state unreachable by any writer; TX-02''s own internal RAISE for this case remains untested as a branch, disclosed honestly, not claimed as covered';
    END;
  END;

  -- AC-52: existing CBR row, NULL-governing processing-state -> integrity failure on next call.
  DECLARE v_client2 UUID := cbr_test.make_client(); v_case2 UUID; v_inv2 UUID; v_s4 UUID;
  BEGIN
    v_case2 := cbr_test.make_case(v_client2);
    v_inv2 := cbr_test.make_invitation(v_case2, v_client2, 'ac52@example.invalid', v_admin);
    v_s4 := cbr_test.make_submission(v_client2, v_case2, v_inv2, jsonb_build_object('familyName', cbr_test.sp_field('Ghost')));
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, candidate_value)
      VALUES (v_client2, 'CANDIDATE_OBSERVED', 'lastName', v_s4, 'Ghost'); -- direct write, no processing-state advance (AC-07 pattern)
    BEGIN
      PERFORM public.cbr_tx02_observe_g3(v_s4, 'lastName');
      RAISE EXCEPTION '[FAIL] AC-52: expected CBR_INTERNAL_INCONSISTENCY';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'CBR_INTERNAL_INCONSISTENCY%' THEN RAISE NOTICE '[PASS] AC-52'; ELSE RAISE; END IF;
    END;
  END;
END $$;

-- AC-53..AC-55: TX-04 equality, staleness; TX-03 adjudicated-reopen prevention.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_obs UUID; v_dec UUID; v_o TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac53@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  UPDATE public.clients SET last_name = 'SameName' WHERE id = v_client;
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('familyName', cbr_test.sp_field('SameName')));
  -- canonical present & equal -> NO_OP at TX-02, so open a CONFLICT case instead to get a DECISION:
  UPDATE public.clients SET last_name = 'OldName' WHERE id = v_client;
  SELECT observation_id INTO v_obs FROM public.cbr_tx02_observe_g3(v_s1, 'lastName'); -- CONFLICT (canonical present, differs)
  SELECT decision_id INTO v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  UPDATE public.clients SET last_name = 'SameName' WHERE id = v_client; -- make canonical now equal decision.candidate_value
  -- IC Targeted Correction 3 (AC-32-class TX-04 prerequisite): TX-04 compares
  -- p_expected_prior_value against the LIVE canonical value (see Finding 2),
  -- never against DECISION.expected_prior_value's immutable open-time
  -- snapshot ('OldName', captured above at TX-03-open time, which the
  -- canonical has since moved past). Supplying that stale snapshot here
  -- would now correctly return STALE_PRIOR_VALUE, not APPROVED -- the
  -- reviewer's most-recently-displayed value is 'SameName' (the live
  -- canonical at the moment of this call), which is what must be supplied.
  PERFORM cbr_test.assert_eq('AC-53-canonical-precondition', 'SameName', (SELECT last_name FROM public.clients WHERE id = v_client));
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'SameName');
  PERFORM cbr_test.assert_eq('AC-53', 'APPROVED', v_o);
  PERFORM cbr_test.assert_eq('AC-53-no-change-row', '0', (SELECT count(*)::TEXT FROM public.canonical_beneficiary_records WHERE record_type='CHANGE_REALIZED' AND related_decision_id=v_dec));

  -- AC-54: STALE_PRIOR_VALUE (reviewer's stale expectation).
  DECLARE v_obs2 UUID; v_dec2 UUID;
  BEGIN
    UPDATE public.clients SET last_name = 'CanonA' WHERE id = v_client;
    DECLARE v_s2 UUID := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('familyName', cbr_test.sp_field('CanonB')));
    BEGIN
      SELECT observation_id INTO v_obs2 FROM public.cbr_tx02_observe_g3(v_s2, 'lastName');
      SELECT decision_id INTO v_dec2 FROM public.cbr_tx03_open_g3_review(v_obs2, v_admin);
      UPDATE public.clients SET last_name = 'CanonC' WHERE id = v_client; -- canonical changes again after review opened
      SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec2, v_admin, 'CanonA'); -- stale expectation
      PERFORM cbr_test.assert_eq('AC-54', 'STALE_PRIOR_VALUE', v_o);
      SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec2, v_admin, 'CanonC'); -- refreshed, matches
      PERFORM cbr_test.assert_eq('AC-54-recover/AC-72', 'APPROVED', v_o);
    END;
  END;

  -- AC-55: previously approved/rejected observation cannot be reopened.
  BEGIN
    PERFORM public.cbr_tx03_open_g3_review(v_obs, v_admin);
    RAISE EXCEPTION '[FAIL] AC-55: expected NOT_OPENABLE outcome row';
  EXCEPTION WHEN OTHERS THEN
    -- outcome row path, not exception; re-run correctly via SELECT:
    NULL;
  END;
  SELECT outcome INTO v_o FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM cbr_test.assert_eq('AC-55', 'NOT_OPENABLE', v_o);
END $$;

-- AC-54/AC-72 full variant matrix: DATE match/mismatch/NULL combinations,
-- invalid format, invalid calendar date, and the non-DATE-field TEXT path.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_obs UUID; v_dec UUID; v_o TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);

  -- AC-72(NULL,NULL): expected NULL, canonical NULL -> proceeds (APPROVED).
  v_client := cbr_test.make_client(); v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac72a@example.invalid', v_admin);
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('dateOfBirth', cbr_test.sp_field('1985-05-05')));
  SELECT observation_id INTO v_obs FROM public.cbr_tx02_observe_g3(v_s1, 'dateOfBirth'); -- canonical NULL -> OBSERVED
  SELECT decision_id INTO v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, NULL);
  PERFORM cbr_test.assert_eq('AC-72(NULL,NULL)', 'APPROVED', v_o);

  -- AC-54(NULL vs non-NULL): expected NULL, canonical now non-NULL (set by the approval above) -> STALE_PRIOR_VALUE.
  DECLARE v_s2 UUID := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('dateOfBirth', cbr_test.sp_field('1990-09-09')));
  BEGIN
    SELECT observation_id INTO v_obs FROM public.cbr_tx02_observe_g3(v_s2, 'dateOfBirth'); -- canonical present, differs -> CONFLICT
    SELECT decision_id INTO v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
    SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, NULL); -- stale: reviewer expected NULL, canonical is 1985-05-05
    PERFORM cbr_test.assert_eq('AC-54(NULL,non-NULL)', 'STALE_PRIOR_VALUE', v_o);
  END;

  -- AC-54(invalid format): malformed expected-date string.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'not-a-date');
  PERFORM cbr_test.assert_eq('AC-54(invalid-format)', 'INVALID_EXPECTED_VALUE', v_o);

  -- AC-54(invalid calendar date): shape-valid but calendar-invalid (Feb 30).
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, '2024-02-30');
  PERFORM cbr_test.assert_eq('AC-54(invalid-calendar)', 'INVALID_EXPECTED_VALUE', v_o);

  -- AC-72(matching non-NULL DATE): correct expectation -> proceeds.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, '1985-05-05');
  PERFORM cbr_test.assert_eq('AC-72(match-DATE)', 'APPROVED', v_o);

  -- AC-72(non-DATE G3 field, TEXT match) and AC-54(non-DATE G3 field, TEXT mismatch).
  DECLARE v_client2 UUID := cbr_test.make_client(); v_case2 UUID; v_inv2 UUID; v_s3 UUID; v_obs2 UUID; v_dec2 UUID;
  BEGIN
    v_case2 := cbr_test.make_case(v_client2);
    v_inv2 := cbr_test.make_invitation(v_case2, v_client2, 'ac72b@example.invalid', v_admin);
    UPDATE public.clients SET middle_name = 'Xavier' WHERE id = v_client2;
    v_s3 := cbr_test.make_submission(v_client2, v_case2, v_inv2, jsonb_build_object('middleName', cbr_test.sp_field('Yolanda')));
    SELECT observation_id INTO v_obs2 FROM public.cbr_tx02_observe_g3(v_s3, 'middleName'); -- CONFLICT (present, differs)
    SELECT decision_id INTO v_dec2 FROM public.cbr_tx03_open_g3_review(v_obs2, v_admin);
    SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec2, v_admin, 'Wrong');
    PERFORM cbr_test.assert_eq('AC-54(text-field-mismatch)', 'STALE_PRIOR_VALUE', v_o);
    SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec2, v_admin, 'Xavier');
    PERFORM cbr_test.assert_eq('AC-72(text-field-match)', 'APPROVED', v_o);
  END;
END $$;

-- AC-56/AC-57: authorization timing.
DO $$
DECLARE v_admin UUID; v_agent1 UUID; v_agent2 UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_obs UUID; v_dec UUID; v_o TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_agent1 := cbr_test.make_profile('agent');
  v_agent2 := cbr_test.make_profile('agent');
  v_client := cbr_test.make_client(v_agent1);
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac56@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  -- IC Targeted Correction 3: canonical first_name is 'CBRTest' (NOT NULL,
  -- cbr_test.make_client()'s fixed value), never absent -- explicitly
  -- initialized/asserted here, and the outcome below derived accordingly
  -- (CONFLICT, not OBSERVED: canonical present, differs from 'Name').
  PERFORM cbr_test.assert_eq('AC-56-canonical-precondition', 'CBRTest', (SELECT first_name FROM public.clients WHERE id = v_client));
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('givenName', cbr_test.sp_field('Name')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_s1, 'firstName');
  PERFORM cbr_test.assert_eq('AC-56-setup-observe', 'CONFLICT', v_o);
  SELECT decision_id INTO v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  -- AC-56: revoke agent1's assignment (reassign to agent2) BEFORE agent1's Layer-2 check.
  -- STEP 5 (authority) fires before STEP 8b (stale-value check), so the NULL
  -- p_expected_prior_value below never reaches the canonical comparison here.
  UPDATE public.clients SET assigned_agent_id = v_agent2 WHERE id = v_client;
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_agent1, NULL);
  PERFORM cbr_test.assert_eq('AC-56', 'UNAUTHORIZED', v_o);
  -- AC-57 (outcome-logic only; true lock-wait proof is in concurrency/): agent2
  -- IS authorized and reaches STEP 8b, where NULL vs the non-NULL canonical
  -- 'CBRTest' would be STALE_PRIOR_VALUE -- the exact value most recently
  -- displayed to the reviewer ('CBRTest', unchanged since AC-56's precondition
  -- above) must be supplied instead.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_agent2, 'CBRTest');
  PERFORM cbr_test.assert_eq('AC-57-sequential-note', 'APPROVED', v_o);
  RAISE NOTICE '[NOTE] AC-57''s lock-wait/no-retroactive-invalidation claim requires concurrency/ac57.sh (two sessions), not proven here.';
END $$;

-- AC-59/AC-60: admission windows, S admitted/fails/disable/re-enable/retry; compound DISABLED.
--
-- IC Targeted Correction 3 (canonical-value assumption): moved to
-- 'middleName'/'middleName' -- the block's design intent (AC-59: "s1's
-- original window still covers it" -> OBSERVED) requires an ABSENT
-- canonical; first_name is NOT NULL ('CBRTest', cbr_test.make_client()'s
-- fixed value) and would have produced CONFLICT instead.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_o TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac59@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM cbr_test.assert_null('AC-59-canonical-precondition-absent', (SELECT middle_name FROM public.clients WHERE id = v_client));
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('Retry')));
  -- Simulate "processing fails" by disabling staff (breaks the compound gate) before the call.
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', false, v_admin);
  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_s1, 'middleName');
  PERFORM cbr_test.assert_eq('AC-60', 'DISABLED', v_o);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin); -- re-enable: new window opens
  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_s1, 'middleName'); -- s1's original window still covers it
  PERFORM cbr_test.assert_eq('AC-59', 'OBSERVED', v_o);
END $$;

-- AC-67: the CBR_UNRECORDED_MUTATION_CONFLICT branch itself.
--
-- HONEST COVERAGE DISCLOSURE (per explicit instruction: do not claim an
-- adjacent test covers this): the branch (INSERT ... ON CONFLICT DO
-- NOTHING RETURNING id; IF v_new_id IS NULL THEN RAISE ...) inside
-- cbr_tx01_realize_g1g2/cbr_tx04_approve_g3 fires only when a colliding
-- cbr_change_realized_unique row already exists at INSERT time despite the
-- function's OWN prior replay lookup (same transaction, same key) having
-- found nothing. Reaching that requires a second writer to insert the
-- colliding row *after* this transaction's replay check but *before* its
-- own INSERT — which is structurally impossible from a single SQL session,
-- and impossible even from a second session, because every writer of this
-- table is required to hold the SAME cbr_field_processing_state row FOR
-- UPDATE before reaching either the replay check or the INSERT, and that
-- lock is held for the whole transaction. There is no external stimulus
-- that reaches this branch through the real function without disabling
-- the function's own locking, which this test suite will not do (fault
-- injection is confined to disposable fixtures, but weakening the
-- function's actual locking would not be testing the real function).
--
-- What IS tested below, honestly labeled as a mechanism-level test, not a
-- branch-coverage claim: the identical SQL pattern (INSERT ... ON CONFLICT
-- DO NOTHING RETURNING id INTO x; IF x IS NULL THEN RAISE) reproduced
-- against the SAME unique index, confirming the pattern itself correctly
-- detects a genuine collision and raises deterministically. This validates
-- the mechanism the real function relies on; it does not exercise the
-- specific unreachable line inside cbr_tx01_realize_g1g2 itself.
DO $$
DECLARE v_client UUID; v_case UUID; v_admin UUID; v_inv UUID; v_s1 UUID; v_new_id UUID;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac67@example.invalid', v_admin);
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('countryOfResidence', cbr_test.sp_field('Chile')));
  INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, prior_value, new_value, authority_basis)
    VALUES (v_client, 'CHANGE_REALIZED', 'countryOfResidence', v_s1, NULL, 'Chile', 'G1_G2_CONFIRMED');
  -- Reproduce the exact pattern against the pre-existing colliding row.
  INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, prior_value, new_value, authority_basis)
    VALUES (v_client, 'CHANGE_REALIZED', 'countryOfResidence', v_s1, NULL, 'ChileDuplicate', 'G1_G2_CONFIRMED')
    ON CONFLICT DO NOTHING RETURNING id INTO v_new_id;
  IF v_new_id IS NOT NULL THEN
    RAISE EXCEPTION '[FAIL] AC-67(mechanism): expected NULL (conflict), got a real id — cbr_change_realized_unique did not fire as expected';
  END IF;
  RAISE NOTICE '[PASS] AC-67(mechanism) — ON CONFLICT DO NOTHING RETURNING id correctly yields NULL on collision, confirming the RAISE-on-NULL pattern used inside TX-01/TX-04 is sound. The specific unreachable branch inside those functions remains UNTESTED, by design, per the disclosure above.';
END $$;

-- AC-68: PostgREST API isolation — NOT executable from SQL; requires a live HTTP call.
-- See concurrency/ac68-api-isolation.sh.
SELECT '[NOTE] AC-68 requires a live PostgREST HTTP call against a running local Supabase API (supabase start); not expressible as a plain SQL assertion. See concurrency/ac68-api-isolation.sh.' AS note;

-- AC-69: intake success survives CBR failure — requires the Next.js /api/intake route and a live
-- HTTP server; out of scope for a SQL-only test file. See ../README.md "Not covered by this suite".

-- AC-70: post-implementation grep — a repository search, not a database test.
SELECT '[NOTE] AC-70 is a repository grep, not a SQL test — see the implementation report.' AS note;

-- AC-71: NULL-safe supersession constraint, ALL TEN state/reference
-- combinations from §E.6's truth table, each independently asserted via a
-- direct low-level INSERT against canonical_beneficiary_records (bypassing
-- TX-0x deliberately, to test the constraint itself in isolation from any
-- function logic that might coincidentally avoid the bad states).
DO $$
DECLARE v_client UUID; v_case UUID; v_admin UUID; v_inv UUID; v_s1 UUID; v_obs UUID; v_dec UUID;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac71@example.invalid', v_admin);
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('givenName', cbr_test.sp_field('X')));
  INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, candidate_value)
    VALUES (v_client, 'CANDIDATE_OBSERVED', 'firstName', v_s1, 'X') RETURNING id INTO v_obs;

  -- The critical negative case, via the CANDIDATE_OBSERVED row itself (decision_state NULL by
  -- cbr_decision_state_scope) — the specific case the constraint was originally found broken on.
  BEGIN
    UPDATE public.canonical_beneficiary_records SET superseded_by_submission_id = v_s1 WHERE id = v_obs;
    RAISE EXCEPTION '[FAIL] AC-71(NULL,non-NULL): expected a constraint violation, none raised';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE '[PASS] AC-71(NULL,non-NULL)';
  END;

  -- Remaining nine combinations, via DECISION rows (decision_state may be pending/approved/
  -- rejected/superseded; NULL is covered above via the non-DECISION row, since
  -- cbr_decision_state_scope forbids decision_state=NULL on a DECISION row itself).
  CALL cbr_test.expect_superseded_by_pass('AC-71(pending,NULL)', v_client, v_obs, v_admin, 'pending', NULL);
  CALL cbr_test.expect_superseded_by_reject('AC-71(pending,non-NULL)', v_client, v_obs, v_admin, 'pending', v_s1);
  CALL cbr_test.expect_superseded_by_pass('AC-71(approved,NULL)', v_client, v_obs, v_admin, 'approved', NULL);
  CALL cbr_test.expect_superseded_by_reject('AC-71(approved,non-NULL)', v_client, v_obs, v_admin, 'approved', v_s1);
  CALL cbr_test.expect_superseded_by_pass('AC-71(rejected,NULL)', v_client, v_obs, v_admin, 'rejected', NULL);
  CALL cbr_test.expect_superseded_by_reject('AC-71(rejected,non-NULL)', v_client, v_obs, v_admin, 'rejected', v_s1);
  CALL cbr_test.expect_superseded_by_reject('AC-71(superseded,NULL)', v_client, v_obs, v_admin, 'superseded', NULL);
  CALL cbr_test.expect_superseded_by_pass('AC-71(superseded,non-NULL)', v_client, v_obs, v_admin, 'superseded', v_s1);
END $$;

-- AC-73: gate initialization is idempotent and does not reset an existing enabled flag.
DO $$
DECLARE v_before BOOLEAN;
BEGIN
  UPDATE cbr_internal.cbr_field_gate_state SET enabled = true WHERE gate = 'g1g2';
  INSERT INTO cbr_internal.cbr_field_gate_state (gate, enabled) VALUES
    ('g1g2', false), ('g3_observation', false), ('g3_staff_resolution', false)
    ON CONFLICT (gate) DO NOTHING;
  SELECT enabled INTO v_before FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g1g2';
  PERFORM cbr_test.assert_eq('AC-73', 'true', v_before::TEXT);
  UPDATE cbr_internal.cbr_field_gate_state SET enabled = false WHERE gate = 'g1g2';
END $$;

-- AC-74/AC-75: fail-closed missing gate rows for TX-01/TX-02 and TX-03/04/05.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac74@example.invalid', v_admin);
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('email', cbr_test.sp_field('ac74@example.invalid')));
  DELETE FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g1g2';
  SELECT outcome INTO v_o FROM public.cbr_tx01_realize_g1g2(v_sub, 'email');
  PERFORM cbr_test.assert_eq('AC-74', 'GATE_NOT_INITIALIZED', v_o);
  INSERT INTO cbr_internal.cbr_field_gate_state (gate, enabled) VALUES ('g1g2', false);

  DELETE FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_staff_resolution';
  SELECT outcome INTO v_o FROM public.cbr_tx05_reject_g3(gen_random_uuid(), v_admin, NULL);
  PERFORM cbr_test.assert_eq('AC-75', 'GATE_NOT_INITIALIZED', v_o);
  INSERT INTO cbr_internal.cbr_field_gate_state (gate, enabled) VALUES ('g3_staff_resolution', false);
END $$;

-- AC-24..AC-30: provenance/origin propagation. Now resolved (see structured-
-- profile.ts's confirmField()/confirmed_from_source state machine, added
-- this continuation) — these are no longer purely mechanism tests: they
-- exercise the SAME confirmed_from_source values real confirmField() calls
-- will now actually produce. The DB layer (migration 040) still only
-- copies whatever key is present in structured_profile — it has no
-- knowledge of the TypeScript state machine that produces that key; these
-- assertions validate the DB-layer copy mechanism using each of the 7
-- distinct confirmed_from_source values confirmField() can now emit.
DO $$
DECLARE v_admin UUID; v_origin TEXT;
        v_client UUID; v_case UUID; v_inv UUID; v_sub UUID;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  PERFORM cbr_internal.cbr_toggle_gate('g1g2', true, v_admin);

  -- AC-24: first confirmation, no correction -> preserves the acquisition source (cv_extraction).
  v_client := cbr_test.make_client(); v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac24@example.invalid', v_admin);
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv,
    jsonb_build_object('countryOfResidence', cbr_test.sp_field('Mexico', 'beneficiary_confirmed', 'test-actor', now(), 'beneficiary_confirmed', 'cv_extraction')));
  PERFORM public.cbr_tx01_realize_g1g2(v_sub, 'countryOfResidence');
  SELECT origin INTO v_origin FROM public.canonical_beneficiary_records WHERE source_submission_id = v_sub AND record_type='CHANGE_REALIZED';
  PERFORM cbr_test.assert_eq('AC-24', 'cv_extraction', v_origin);

  -- AC-25: first confirmation, with correction -> "beneficiary_provided" (this is what
  -- confirmField() itself computes and would serialize as confirmed_from_source).
  v_client := cbr_test.make_client(); v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac25@example.invalid', v_admin);
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv,
    jsonb_build_object('countryOfResidence', cbr_test.sp_field('Guatemala', 'beneficiary_confirmed', 'test-actor', now(), 'beneficiary_confirmed', 'beneficiary_provided')));
  PERFORM public.cbr_tx01_realize_g1g2(v_sub, 'countryOfResidence');
  SELECT origin INTO v_origin FROM public.canonical_beneficiary_records WHERE source_submission_id = v_sub AND record_type='CHANGE_REALIZED';
  PERFORM cbr_test.assert_eq('AC-25', 'beneficiary_provided', v_origin);

  -- AC-26: unchanged reconfirmation -> preserves established provenance (still cv_extraction).
  v_client := cbr_test.make_client(); v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac26@example.invalid', v_admin);
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv,
    jsonb_build_object('countryOfResidence', cbr_test.sp_field('Honduras', 'beneficiary_confirmed', 'test-actor', now(), 'beneficiary_confirmed', 'cv_extraction')));
  PERFORM public.cbr_tx01_realize_g1g2(v_sub, 'countryOfResidence');
  SELECT origin INTO v_origin FROM public.canonical_beneficiary_records WHERE source_submission_id = v_sub AND record_type='CHANGE_REALIZED';
  PERFORM cbr_test.assert_eq('AC-26', 'cv_extraction', v_origin);

  -- AC-27: changed reconfirmation -> "beneficiary_provided".
  v_client := cbr_test.make_client(); v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac27@example.invalid', v_admin);
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv,
    jsonb_build_object('countryOfResidence', cbr_test.sp_field('Panama', 'beneficiary_confirmed', 'test-actor', now(), 'beneficiary_confirmed', 'beneficiary_provided')));
  PERFORM public.cbr_tx01_realize_g1g2(v_sub, 'countryOfResidence');
  SELECT origin INTO v_origin FROM public.canonical_beneficiary_records WHERE source_submission_id = v_sub AND record_type='CHANGE_REALIZED';
  PERFORM cbr_test.assert_eq('AC-27', 'beneficiary_provided', v_origin);

  -- AC-28: direct beneficiary entry (no prior acquisition) -> "beneficiary_provided".
  v_client := cbr_test.make_client(); v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac28@example.invalid', v_admin);
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv,
    jsonb_build_object('whatsapp', cbr_test.sp_field('+15551112222', 'beneficiary_confirmed', 'test-actor', now(), 'beneficiary_confirmed', 'beneficiary_provided')));
  PERFORM public.cbr_tx01_realize_g1g2(v_sub, 'whatsapp');
  SELECT origin INTO v_origin FROM public.canonical_beneficiary_records WHERE source_submission_id = v_sub AND record_type='CHANGE_REALIZED';
  PERFORM cbr_test.assert_eq('AC-28', 'beneficiary_provided', v_origin);

  -- AC-29: A0-derived confirmation without correction -> preserves acquisition source.
  v_client := cbr_test.make_client(); v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac29@example.invalid', v_admin);
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv,
    jsonb_build_object('whatsapp', cbr_test.sp_field('+15553334444', 'beneficiary_confirmed', 'test-actor', now(), 'beneficiary_confirmed', 'cv_extraction')));
  PERFORM public.cbr_tx01_realize_g1g2(v_sub, 'whatsapp');
  SELECT origin INTO v_origin FROM public.canonical_beneficiary_records WHERE source_submission_id = v_sub AND record_type='CHANGE_REALIZED';
  PERFORM cbr_test.assert_eq('AC-29', 'cv_extraction', v_origin);

  -- AC-30: historical/legacy data without recoverable provenance -> NULL. This is the
  -- REAL shape of every submission made before confirmed_from_source existed (and, until
  -- deployed application code actually starts populating it end-to-end, of every real
  -- submission today) — confirmed_from_source absent from the JSON entirely.
  v_client := cbr_test.make_client(); v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac30@example.invalid', v_admin);
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv,
    jsonb_build_object('countryOfResidence', cbr_test.sp_field('Ecuador'))); -- p_confirmed_from_source defaults NULL
  PERFORM public.cbr_tx01_realize_g1g2(v_sub, 'countryOfResidence');
  SELECT origin INTO v_origin FROM public.canonical_beneficiary_records WHERE source_submission_id = v_sub AND record_type='CHANGE_REALIZED';
  IF v_origin IS NOT NULL THEN RAISE EXCEPTION '[FAIL] AC-30: expected NULL origin, got %', v_origin; END IF;
  RAISE NOTICE '[PASS] AC-30';
END $$;

-- AC-31: value-binding at TX-03 creation. Explicit outcome/existence/type
-- checks BEFORE downstream use, per the strengthened fixture discipline —
-- a broken setup now fails loudly at the point of failure, not silently
-- three statements later.
--
-- IC Targeted Correction 3 (canonical-value assumption): moved to
-- 'middleName'/'middleName' -- first_name is NOT NULL ('CBRTest') and
-- would have produced CONFLICT, not the OBSERVED this test's setup asserts;
-- middleName's genuinely-absent canonical preserves the intended, simpler
-- first-ever-observation path this test actually exercises (value-binding
-- is identical regardless of which action-table branch produced the row).
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID;
        v_outcome TEXT; v_bound_value TEXT; v_stored_value TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac31@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM cbr_test.assert_null('AC-31-canonical-precondition-absent', (SELECT middle_name FROM public.clients WHERE id = v_client));
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('Value31')));

  SELECT outcome, observation_id INTO v_outcome, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  PERFORM cbr_test.assert_eq('AC-31-setup-outcome', 'OBSERVED', v_outcome);
  PERFORM cbr_test.assert_not_null('AC-31-setup-observation_id', v_obs);
  PERFORM cbr_test.assert_record_type('AC-31-setup-observation_type', v_obs, 'CANDIDATE_OBSERVED');
  SELECT candidate_value INTO v_bound_value FROM public.canonical_beneficiary_records WHERE id = v_obs;
  PERFORM cbr_test.assert_eq('AC-31-fixture-value-reached-observation', 'Value31', v_bound_value);

  SELECT outcome, decision_id INTO v_outcome, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM cbr_test.assert_eq('AC-31-open-outcome', 'OPENED', v_outcome);
  PERFORM cbr_test.assert_not_null('AC-31-decision_id', v_dec);
  PERFORM cbr_test.assert_record_type('AC-31-decision_type', v_dec, 'DECISION');
  SELECT candidate_value INTO v_stored_value FROM public.canonical_beneficiary_records WHERE id = v_dec;
  PERFORM cbr_test.assert_eq('AC-31', v_bound_value, v_stored_value);
END $$;

-- AC-32(a) — positive variant: TX-04's step-9 defensive re-check reads the
-- SAME observation value and finds it consistent on the ordinary,
-- non-tampered path. This is retained but is EXPLICITLY NOT claimed as
-- complete AC-32 coverage — AC-32 requires the MISMATCH branch, which
-- AC-06's INSERT-time rejection does not substitute for (different check,
-- different function, different trigger clause). See AC-32(b) below for
-- the actual negative-branch coverage via disclosed fault injection.
--
-- IC Targeted Correction 3 (AC-32 TX-04 prerequisite): the reviewed version
-- supplied NULL as p_expected_prior_value despite canonical first_name being
-- NOT NULL ('CBRTest', cbr_test.make_client()'s fixed value) -- STEP 8b's
-- IS DISTINCT FROM check (Finding 2) would reach STALE_PRIOR_VALUE before
-- ever reaching STEP 9's defensive value-binding re-check, which is the
-- branch this acceptance case actually intends to exercise. Fixed by
-- explicitly initializing/asserting the canonical precondition and
-- supplying that EXACT value -- the live canonical, never
-- DECISION.expected_prior_value's immutable open-time snapshot (Finding 2's
-- distinction), which happens to be identical here only because nothing
-- changes canonical between open and approval in this specific case.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_outcome TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac32a@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM cbr_test.assert_eq('AC-32a-canonical-precondition', 'CBRTest', (SELECT first_name FROM public.clients WHERE id = v_client));
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('givenName', cbr_test.sp_field('Value32a')));
  SELECT outcome, observation_id INTO v_outcome, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'firstName');
  PERFORM cbr_test.assert_eq('AC-32a-setup-observe', 'CONFLICT', v_outcome); -- canonical present ('CBRTest'), differs from 'Value32a'
  PERFORM cbr_test.assert_not_null('AC-32a-observation_id', v_obs);
  SELECT outcome, decision_id INTO v_outcome, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM cbr_test.assert_not_null('AC-32a-decision_id', v_dec);
  SELECT outcome INTO v_outcome FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'CBRTest');
  PERFORM cbr_test.assert_eq('AC-32a', 'APPROVED', v_outcome);
END $$;

-- AC-32(b) — the actual negative branch, via disclosed, disposable-only
-- fault injection.
--
-- BLOCKED FOR THE AUSCIS-TEST MANUAL ARTIFACT (IC Targeted Correction 3
-- §2): this case requires ALTER TABLE ... DISABLE TRIGGER to construct an
-- inconsistent prior-value state that no ordinary, protected write path can
-- produce. The manual AUSCIS-TEST artifact prepared for this round does not
-- disable triggers, weaken constraints, or modify production functions, so
-- this specific negative branch is NOT included there and remains BLOCKED
-- for that environment, with this exact reason. It is NOT substituted with
-- an equivalent-coverage claim. It remains here, in this
-- disposable-local-database-only file, unchanged in mechanism from its
-- prior review, with the same AC-32-class prerequisite fix applied below
-- (a non-NULL p_expected_prior_value matching the non-NULL canonical) so it
-- can still reach the branch it targets once a disposable local database is
-- available.
--
-- INVARIANT TEMPORARILY BYPASSED: candidate_value's immutability (trigger
-- clause (1), cbr_validate_relationship_trg) is disabled for exactly one
-- UPDATE statement, on the CANDIDATE_OBSERVED row only, so its
-- candidate_value can be forced to diverge from the already-created
-- DECISION's own (immutable) candidate_value. This is the ONLY way to
-- reach TX-04's step-9 defensive check's TRUE branch, because at every
-- legitimate write path candidate_value is bound by construction and the
-- trigger keeps it immutable afterward (§ implementation report). Trigger
-- is re-enabled immediately after, deterministically, in the same
-- transaction, before TX-04 is ever called — TX-04 itself runs with the
-- trigger fully active, exercising the REAL, unmodified function against
-- a genuinely inconsistent (test-only, disposable-database-only) prior
-- state. This never touches migration 039, never alters any grant, and
-- never ships as part of the migration — it exists only in this test file.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_dec UUID; v_outcome TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac32b@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM cbr_test.assert_eq('AC-32b-canonical-precondition', 'CBRTest', (SELECT first_name FROM public.clients WHERE id = v_client));
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('givenName', cbr_test.sp_field('Original32b')));
  SELECT outcome, observation_id INTO v_outcome, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'firstName');
  PERFORM cbr_test.assert_eq('AC-32b-setup-observe', 'CONFLICT', v_outcome); -- canonical present ('CBRTest'), differs from 'Original32b'
  PERFORM cbr_test.assert_not_null('AC-32b-observation_id', v_obs);
  SELECT decision_id INTO v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM cbr_test.assert_not_null('AC-32b-decision_id', v_dec);
  PERFORM cbr_test.assert_eq('AC-32b-precondition-bound', 'Original32b', (SELECT candidate_value FROM public.canonical_beneficiary_records WHERE id = v_dec));

  -- Bypass, precisely scoped: disable trigger, corrupt the OBSERVATION
  -- (not the DECISION, which stays untouched and still says 'Original32b'),
  -- re-enable trigger immediately.
  ALTER TABLE public.canonical_beneficiary_records DISABLE TRIGGER cbr_validate_relationship_trg;
  UPDATE public.canonical_beneficiary_records SET candidate_value = 'Tampered32b' WHERE id = v_obs;
  ALTER TABLE public.canonical_beneficiary_records ENABLE TRIGGER cbr_validate_relationship_trg;
  PERFORM cbr_test.assert_eq('AC-32b-bypass-confirmed', 'Tampered32b', (SELECT candidate_value FROM public.canonical_beneficiary_records WHERE id = v_obs));

  -- TX-04 itself runs fully unmodified, trigger fully active. p_expected_prior_value
  -- must be the exact live canonical ('CBRTest', unchanged throughout this fixture)
  -- so STEP 8b passes and execution actually reaches STEP 9's defensive check --
  -- supplying NULL here would incorrectly return STALE_PRIOR_VALUE first (IC
  -- Targeted Correction 3 §2), never reaching the branch this case targets.
  BEGIN
    SELECT outcome INTO v_outcome FROM public.cbr_tx04_approve_g3(v_dec, v_admin, 'CBRTest');
    RAISE EXCEPTION '[FAIL] AC-32b: expected RAISE CBR_DECISION_VALUE_MISMATCH, got a normal outcome (%)', v_outcome;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'CBR_DECISION_VALUE_MISMATCH%' THEN
      RAISE NOTICE '[PASS] AC-32b — CBR_DECISION_VALUE_MISMATCH genuinely raised by the real, unmodified TX-04 function';
    ELSE RAISE; END IF;
  END;

  -- Full rollback / no approval / no canonical mutation confirmed explicitly.
  PERFORM cbr_test.assert_eq('AC-32b-no-approval', 'pending', (SELECT decision_state FROM public.canonical_beneficiary_records WHERE id = v_dec));
  -- clients.first_name is NOT NULL (schema.sql) -- make_client() always sets it to the fixed
  -- fixture value 'CBRTest'; this asserts it is UNCHANGED by the mismatch attempt, never that
  -- it is NULL (impossible for this column, and a real bug in an earlier draft of this test).
  PERFORM cbr_test.assert_eq('AC-32b-no-canonical-mutation', 'CBRTest', (SELECT first_name FROM public.clients WHERE id = v_client));
  PERFORM cbr_test.assert_eq('AC-32b-no-change-realized-row', '0', (SELECT count(*)::TEXT FROM public.canonical_beneficiary_records WHERE record_type='CHANGE_REALIZED' AND related_decision_id = v_dec));
END $$;

-- ============================================================
-- IC §8: comparison-semantics regression matrix (Finding 1).
-- Exercises cbr_internal.cbr_values_equal() DIRECTLY, for every field
-- class it defines, rather than only inferring correctness from
-- downstream TX-0x outcomes (those are still exercised throughout the
-- rest of this file, unchanged).
-- ============================================================
DO $$
BEGIN
  -- email: case-insensitive.
  PERFORM cbr_test.assert_eq('CMP-email-case', 'true', cbr_internal.cbr_values_equal('email', 'Foo@Example.COM', 'foo@example.com')::TEXT);
  PERFORM cbr_test.assert_eq('CMP-email-diff', 'false', cbr_internal.cbr_values_equal('email', 'foo@example.com', 'bar@example.com')::TEXT);

  -- whatsapp: strip whitespace/hyphens.
  PERFORM cbr_test.assert_eq('CMP-whatsapp-formatting', 'true', cbr_internal.cbr_values_equal('whatsapp', '+1 555-123-4567', '+15551234567')::TEXT);
  PERFORM cbr_test.assert_eq('CMP-whatsapp-diff', 'false', cbr_internal.cbr_values_equal('whatsapp', '+15551234567', '+15559999999')::TEXT);

  -- countryOfResidence: trimmed, CASE-SENSITIVE.
  PERFORM cbr_test.assert_eq('CMP-country-trim', 'true', cbr_internal.cbr_values_equal('countryOfResidence', '  Colombia  ', 'Colombia')::TEXT);
  PERFORM cbr_test.assert_eq('CMP-country-case-sensitive', 'false', cbr_internal.cbr_values_equal('countryOfResidence', 'colombia', 'Colombia')::TEXT);

  -- cityOfResidence: trimmed, case-INSENSITIVE.
  PERFORM cbr_test.assert_eq('CMP-city-trim-and-case', 'true', cbr_internal.cbr_values_equal('cityOfResidence', '  bogota  ', 'Bogota')::TEXT);
  PERFORM cbr_test.assert_eq('CMP-city-diff', 'false', cbr_internal.cbr_values_equal('cityOfResidence', 'Bogota', 'Medellin')::TEXT);

  -- middleName/firstName/lastName: trimmed, exact (case-sensitive).
  PERFORM cbr_test.assert_eq('CMP-middleName-trim', 'true', cbr_internal.cbr_values_equal('middleName', '  Juan  ', 'Juan')::TEXT);
  PERFORM cbr_test.assert_eq('CMP-middleName-case-sensitive', 'false', cbr_internal.cbr_values_equal('middleName', 'juan', 'Juan')::TEXT);
  PERFORM cbr_test.assert_eq('CMP-firstName-trim', 'true', cbr_internal.cbr_values_equal('firstName', ' Alejandro ', 'Alejandro')::TEXT);
  PERFORM cbr_test.assert_eq('CMP-firstName-case-sensitive', 'false', cbr_internal.cbr_values_equal('firstName', 'alejandro', 'Alejandro')::TEXT);
  PERFORM cbr_test.assert_eq('CMP-lastName-trim', 'true', cbr_internal.cbr_values_equal('lastName', ' Clavijo ', 'Clavijo')::TEXT);
  PERFORM cbr_test.assert_eq('CMP-lastName-case-sensitive', 'false', cbr_internal.cbr_values_equal('lastName', 'clavijo', 'Clavijo')::TEXT);

  -- dateOfBirth: typed DATE comparison (format-tolerant, value-exact).
  PERFORM cbr_test.assert_eq('CMP-dob-format-tolerant', 'true', cbr_internal.cbr_values_equal('dateOfBirth', '1990-01-01', '1990-1-1')::TEXT);
  PERFORM cbr_test.assert_eq('CMP-dob-diff', 'false', cbr_internal.cbr_values_equal('dateOfBirth', '1990-01-01', '1990-01-02')::TEXT);

  -- NULL handling (documented in cbr_values_equal itself: both-NULL is
  -- equal, exactly-one-NULL is never equal, for every field).
  PERFORM cbr_test.assert_eq('CMP-both-null', 'true', cbr_internal.cbr_values_equal('email', NULL, NULL)::TEXT);
  PERFORM cbr_test.assert_eq('CMP-one-null', 'false', cbr_internal.cbr_values_equal('email', 'foo@example.com', NULL)::TEXT);

  RAISE NOTICE '[PASS] IC §8 comparison regression matrix (cbr_internal.cbr_values_equal, all fields)';
END $$;

-- ============================================================
-- IC §9: DECISION/CONFLICT_DETECTED provenance regression (Finding 2).
-- CHANGE_REALIZED's origin-copy behavior is already covered by AC-24..30
-- above; this block covers the two record types Finding 2 specifically
-- found missing origin: DECISION (TX-03) and CONFLICT_DETECTED (TX-02).
--
-- IC Targeted Correction 3 (canonical-value assumption): both sub-scenarios
-- moved to 'middleName'/'middleName' -- first_name is NOT NULL ('CBRTest')
-- and would have produced CONFLICT at IC9-DECISION's/IC9-CONFLICT's OWN
-- setup step, not the OBSERVED those setups assert. Origin propagation is
-- identical regardless of which action-table branch produced the row, so
-- this preserves the acceptance case's meaning exactly.
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_s2 UUID;
        v_obs UUID; v_dec UUID; v_new_cand UUID; v_o TEXT; v_origin TEXT; v_obs_origin TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);

  -- IC9-DECISION: TX-03's DECISION.origin must equal source_observation.origin, COPIED not re-derived.
  v_client := cbr_test.make_client(); v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ic9dec@example.invalid', v_admin);
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv,
    jsonb_build_object('middleName', cbr_test.sp_field('IC9Dec', 'beneficiary_confirmed', 'test-actor', now(), 'beneficiary_confirmed', 'cv_extraction')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_s1, 'middleName');
  PERFORM cbr_test.assert_eq('IC9-DECISION-setup', 'OBSERVED', v_o);
  SELECT origin INTO v_obs_origin FROM public.canonical_beneficiary_records WHERE id = v_obs;
  PERFORM cbr_test.assert_eq('IC9-DECISION-observation-origin', 'cv_extraction', v_obs_origin);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM cbr_test.assert_eq('IC9-DECISION-open', 'OPENED', v_o);
  SELECT origin INTO v_origin FROM public.canonical_beneficiary_records WHERE id = v_dec;
  PERFORM cbr_test.assert_eq('IC9-DECISION-origin-copied', v_obs_origin, v_origin);

  -- IC9-CONFLICT: TX-02's CONFLICT_DETECTED.origin must equal the incoming
  -- (new) candidate's own origin -- the conflict describes THIS
  -- observation's provenance, paired against whatever it conflicts with.
  v_client := cbr_test.make_client(); v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ic9con@example.invalid', v_admin);
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv,
    jsonb_build_object('middleName', cbr_test.sp_field('IC9ConA', 'beneficiary_confirmed', 'test-actor', now(), 'beneficiary_confirmed', 'cv_extraction')));
  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_s1, 'middleName');
  PERFORM cbr_test.assert_eq('IC9-CONFLICT-setup', 'OBSERVED', v_o);
  v_s2 := cbr_test.make_submission(v_client, v_case, v_inv,
    jsonb_build_object('middleName', cbr_test.sp_field('IC9ConB', 'beneficiary_confirmed', 'test-actor', now(), 'beneficiary_confirmed', 'beneficiary_provided')));
  SELECT outcome, observation_id INTO v_o, v_new_cand FROM public.cbr_tx02_observe_g3(v_s2, 'middleName');
  PERFORM cbr_test.assert_eq('IC9-CONFLICT-outcome', 'CONFLICT', v_o);
  PERFORM cbr_test.assert_not_null('IC9-CONFLICT-new_candidate_id', v_new_cand);
  SELECT origin INTO v_origin FROM public.canonical_beneficiary_records
    WHERE record_type = 'CONFLICT_DETECTED' AND related_candidate_id = v_new_cand;
  PERFORM cbr_test.assert_eq('IC9-CONFLICT-origin', 'beneficiary_provided', v_origin);
END $$;

-- ============================================================
-- IC §10: database relationship-trigger origin-binding negative tests
-- (Finding 2's strengthened cbr_validate_relationship() checks). Mirrors
-- AC-06's existing candidate_value-mismatch pattern, but isolates the
-- ORIGIN check specifically: every OTHER binding column deliberately
-- matches, so a raised CBR_RELATIONSHIP_VIOLATION here can only be
-- attributed to the origin mismatch, not some other check firing first.
--
-- IC Targeted Correction 3: moved to 'middleName'/'middleName' for the same
-- reason as IC §9 above -- the relationship-trigger check exercised here is
-- independent of which action-table branch produced the source row.
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_obs UUID; v_o TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ic10@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv,
    jsonb_build_object('middleName', cbr_test.sp_field('IC10', 'beneficiary_confirmed', 'test-actor', now(), 'beneficiary_confirmed', 'cv_extraction')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  PERFORM cbr_test.assert_eq('IC10-setup-observe', 'OBSERVED', v_o);
  PERFORM cbr_test.assert_not_null('IC10-setup-observation_id', v_obs);

  -- IC10-DECISION: candidate_value matches, origin deliberately does not.
  BEGIN
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_observation_id, candidate_value, origin, decision_state, expected_prior_value)
      VALUES (v_client, 'DECISION', 'middleName', v_obs, 'IC10', 'beneficiary_provided', 'pending', NULL);
    RAISE EXCEPTION '[FAIL] IC10-DECISION: expected CBR_RELATIONSHIP_VIOLATION (origin mismatch), none raised';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'CBR_RELATIONSHIP_VIOLATION%' THEN RAISE NOTICE '[PASS] IC10-DECISION (origin mismatch correctly rejected)'; ELSE RAISE; END IF;
  END;

  -- IC10-CONFLICT: source_submission_id/candidate_value/related_candidate_id all match, origin deliberately does not.
  BEGIN
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, candidate_value, origin, prior_value, related_candidate_id)
      VALUES (v_client, 'CONFLICT_DETECTED', 'middleName', v_sub, 'IC10', 'beneficiary_provided', 'SomePrior', v_obs);
    RAISE EXCEPTION '[FAIL] IC10-CONFLICT: expected CBR_RELATIONSHIP_VIOLATION (origin mismatch), none raised';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'CBR_RELATIONSHIP_VIOLATION%' THEN RAISE NOTICE '[PASS] IC10-CONFLICT (origin mismatch correctly rejected)'; ELSE RAISE; END IF;
  END;
END $$;

-- ============================================================
-- Residual correction: explicit ADMISSION_BOUNDARY regression
-- (retrospective admission rejection), single-session variant of
-- concurrency/ac-lockorder-and-concurrency.sh's AC-63 proof. No existing
-- block in this file asserted this outcome directly. A submission created
-- BEFORE the relevant gate/window is ever opened must be rejected as
-- ADMISSION_BOUNDARY when later processed, even though nothing else is
-- wrong with it -- and this is intentionally NOT "fixed" to the
-- toggle-before-submission order used everywhere else in this file: the
-- whole point here is to prove the boundary itself.
--
-- IC Targeted Correction 3 (§3, gate-toggle no-op risk): cbr_toggle_gate
-- returns NO_CHANGE, and leaves any existing window's opened_at untouched,
-- when called with the gate's CURRENT value -- it does not assume a fresh
-- window opens. By this point in the file the gate is very likely already
-- enabled (left on by an earlier block, e.g. AC-24..30/AC-33..40 for g1g2,
-- AC-56/57 for g3), so the toggle-to-true call below, on its own, could be
-- a no-op against an ALREADY-open window with an opened_at that predates
-- v_sub -- silently defeating the whole point of this test. Each block now
-- explicitly toggles the gate OFF first (a genuine state change if it was
-- on, a harmless no-op if it was already off) before creating the
-- submission, so the later toggle-to-true is GUARANTEED to be a real state
-- change that opens a window strictly after v_sub's submitted_at, not an
-- assumption.
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  PERFORM cbr_internal.cbr_toggle_gate('g1g2', false, v_admin); -- force a known-disabled starting state
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'admbound1@example.invalid', v_admin);
  -- Submission created BEFORE g1g2 is ever toggled on for this fixture --
  -- deliberately NOT reordered, unlike every admission-sensitive fixture
  -- above.
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('countryOfResidence', cbr_test.sp_field('Chile')));
  PERFORM cbr_internal.cbr_toggle_gate('g1g2', true, v_admin); -- REAL enable (guaranteed by the disable above): window opens strictly AFTER v_sub's submitted_at
  SELECT outcome INTO v_o FROM public.cbr_tx01_realize_g1g2(v_sub, 'countryOfResidence');
  PERFORM cbr_test.assert_eq('IC-ADMISSION-BOUNDARY-g1g2', 'ADMISSION_BOUNDARY', v_o);
END $$;

DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  -- Force a known-disabled starting state for BOTH compound-gate flags, same
  -- reasoning as g1g2 above -- do not assume the toggles below open fresh windows.
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', false, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', false, v_admin);
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'admbound2@example.invalid', v_admin);
  -- Same shape, G3 side: submission predates BOTH gate toggles.
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('Boundary')));
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  SELECT outcome INTO v_o FROM public.cbr_tx02_observe_g3(v_sub, 'middleName');
  PERFORM cbr_test.assert_eq('IC-ADMISSION-BOUNDARY-g3', 'ADMISSION_BOUNDARY', v_o);
END $$;

-- ============================================================
-- Residual correction: storage-trimming regression, independent of the
-- §8 comparison-regression matrix above. CMP-* proves cbr_values_equal's
-- COMPARISON behavior only; it says nothing about what is actually
-- WRITTEN to public.clients / canonical_beneficiary_records.candidate_value.
-- These tests submit values with deliberate leading/trailing whitespace
-- through the REAL TX-01/TX-02 storage paths and read back the ACTUALLY
-- STORED value (not the input) to confirm: (a) countryOfResidence,
-- middleName/firstName/lastName are stored TRIMMED but with their
-- original casing intact (no case-folding at storage); (b) email and
-- whatsapp are stored EXACTLY as submitted, whitespace included, proving
-- normalization was not over-applied beyond the approved fields.
-- ============================================================
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT; v_rv TEXT; v_stored TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'icstore1@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g1g2', true, v_admin);

  -- countryOfResidence: submitted with padding, must be stored TRIMMED, casing untouched.
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('countryOfResidence', cbr_test.sp_field('  Costa Rica  ')));
  SELECT outcome, realized_value INTO v_o, v_rv FROM public.cbr_tx01_realize_g1g2(v_sub, 'countryOfResidence');
  PERFORM cbr_test.assert_eq('IC-STORAGE-country-realized', 'Costa Rica', v_rv);
  SELECT country_of_residence INTO v_stored FROM public.clients WHERE id = v_client;
  PERFORM cbr_test.assert_eq('IC-STORAGE-country-canonical', 'Costa Rica', v_stored);

  -- email: STEP 5's own format regex (^[^\s@]+@[^\s@]+\.[^\s@]+$) already
  -- rejects ANY whitespace anywhere in a valid email, so "email storage
  -- isn't trimmed" cannot be tested via padding -- no valid submission can
  -- ever contain it. The real over-normalization risk for email is
  -- CASE-FOLDING (its approved comparison rule IS case-insensitive), so
  -- this proves storage preserves the submitted casing instead of
  -- lower-casing it. Reference gate compares case-insensitively, so a
  -- differently-cased invitation email still matches without REFERENCE_MISMATCH.
  DECLARE v_inv2 UUID := cbr_test.make_invitation(v_case, v_client, 'Mixed.Case@Example.Invalid', v_admin);
  DECLARE v_sub2 UUID := cbr_test.make_submission(v_client, v_case, v_inv2, jsonb_build_object('email', cbr_test.sp_field('Mixed.Case@Example.Invalid')));
  BEGIN
    SELECT outcome, realized_value INTO v_o, v_rv FROM public.cbr_tx01_realize_g1g2(v_sub2, 'email');
    PERFORM cbr_test.assert_eq('IC-STORAGE-email-realized-case-preserved', 'Mixed.Case@Example.Invalid', v_rv);
  END;

  -- whatsapp: submitted with internal spaces/hyphens (which STEP 5 validates only after
  -- stripping a COPY, not the stored value itself) -- must be stored EXACTLY as submitted,
  -- formatting intact, since whatsapp's comparison-time hyphen/whitespace-stripping is
  -- explicitly a COMPARISON-only rule, never applied to storage.
  DECLARE v_inv3 UUID := cbr_test.make_invitation(v_case, v_client, 'icstore1-wa@example.invalid', v_admin);
  DECLARE v_sub3 UUID := cbr_test.make_submission(v_client, v_case, v_inv3, jsonb_build_object('whatsapp', cbr_test.sp_field('+1 555-123-4567')));
  BEGIN
    SELECT outcome, realized_value INTO v_o, v_rv FROM public.cbr_tx01_realize_g1g2(v_sub3, 'whatsapp');
    PERFORM cbr_test.assert_eq('IC-STORAGE-whatsapp-realized-formatting-preserved', '+1 555-123-4567', v_rv);
  END;
END $$;

DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sub UUID; v_o TEXT; v_obs UUID; v_stored TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'icstore2@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);

  -- firstName: submitted with padding, must be stored TRIMMED in the CANDIDATE_OBSERVED row.
  -- IC Targeted Correction 3 (canonical-value assumption): first_name is NOT
  -- NULL ('CBRTest', cbr_test.make_client()'s fixed value) -- explicitly
  -- initialized/asserted here, so the outcome below is derived correctly
  -- (CONFLICT, not OBSERVED). Storage trimming (the actual point of this
  -- test) is computed identically in every action-table branch -- v_stored_value
  -- is set once, before the branch IF/ELSIF, and used in all four candidate
  -- INSERTs (migration 040) -- so CONFLICT exercises the exact same
  -- trimming code path as OBSERVED would have.
  PERFORM cbr_test.assert_eq('IC-STORAGE-firstName-canonical-precondition', 'CBRTest', (SELECT first_name FROM public.clients WHERE id = v_client));
  v_sub := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('givenName', cbr_test.sp_field('  Mariana  ')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_sub, 'firstName');
  PERFORM cbr_test.assert_eq('IC-STORAGE-firstName-outcome', 'CONFLICT', v_o);
  SELECT candidate_value INTO v_stored FROM public.canonical_beneficiary_records WHERE id = v_obs;
  PERFORM cbr_test.assert_eq('IC-STORAGE-firstName-candidate', 'Mariana', v_stored);

  -- whatsapp is not a G3 field (out of TX-02's scope) -- its storage-untouched claim is
  -- proven above via TX-01's email case; whatsapp itself is G1, same TX-01 path, same
  -- cbr_normalize_for_storage ELSE branch (unchanged from submitted value).
END $$;

-- ============================================================
-- Gap closure (Functional Acceptance — Test Coverage Closure round):
-- deterministic single-session coverage for outcome branches the prior
-- inventory found untested: TX-03 ALREADY_PENDING, TX-03 NOT_OPENABLE
-- (staleness reason, distinct from AC-55's already-resolved reason),
-- TX-04 STALE_REVIEW (investigated — see the comment-only block below),
-- TX-04 ALREADY_RESOLVED (deterministic, not concurrency-only), TX-05
-- direct functional + replay coverage, and TX-04-created
-- CHANGE_REALIZED.origin provenance. Every DO block below calls the real,
-- unmodified TX-0x production function — none reproduces its logic in a
-- helper as a substitute. All use 'middleName' (nullable canonical),
-- consistent with this file's own established IC Targeted Correction 3
-- convention, to reach the intended OBSERVED/action-table branch without
-- an unrelated firstName-NOT-NULL complication.
-- ============================================================

-- ── Gap closure: TX-03 ALREADY_PENDING ─────────────────────────────────
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_obs UUID; v_dec UUID; v_o TEXT; v_dec2 UUID;
        v_before_dec_snapshot JSONB; v_after_dec_snapshot JSONB;
        v_before_pcs_snapshot JSONB; v_after_pcs_snapshot JSONB;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'gap-tx03-pending@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM cbr_test.assert_null('GAP-TX03-PENDING-canonical-precondition-absent', (SELECT middle_name FROM public.clients WHERE id = v_client));

  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('Pendiente')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_s1, 'middleName');
  PERFORM cbr_test.assert_eq('GAP-TX03-PENDING-setup-observe', 'OBSERVED', v_o);
  PERFORM cbr_test.assert_not_null('GAP-TX03-PENDING-setup-observation_id', v_obs);

  -- First open: real TX-03 call, must succeed.
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM cbr_test.assert_eq('GAP-TX03-PENDING-first-open', 'OPENED', v_o);
  PERFORM cbr_test.assert_not_null('GAP-TX03-PENDING-decision_id', v_dec);
  PERFORM cbr_test.assert_record_type('GAP-TX03-PENDING-decision_type', v_dec, 'DECISION');
  PERFORM cbr_test.assert_eq('GAP-TX03-PENDING-decision-state-pending', 'pending',
    (SELECT decision_state FROM public.canonical_beneficiary_records WHERE id = v_dec));

  v_before_dec_snapshot := (SELECT to_jsonb(cbr) FROM public.canonical_beneficiary_records cbr WHERE cbr.id = v_dec);
  v_before_pcs_snapshot := (SELECT to_jsonb(pcs) FROM cbr_internal.cbr_field_processing_state pcs WHERE pcs.client_id = v_client AND pcs.field_key = 'middleName');

  -- Second open attempt: SAME observation, still CURRENT (nothing has
  -- advanced governing state since the first call) -- the real TX-03
  -- branch under test: a pending DECISION already exists for this
  -- (client, field) pair.
  SELECT outcome, decision_id INTO v_o, v_dec2 FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM cbr_test.assert_eq('GAP-TX03-PENDING-second-open', 'ALREADY_PENDING', v_o);
  PERFORM cbr_test.assert_null('GAP-TX03-PENDING-no-decision-id-on-rejection', v_dec2);

  -- No second pending DECISION was created.
  PERFORM cbr_test.assert_eq('GAP-TX03-PENDING-exactly-one-pending-decision', '1',
    (SELECT count(*)::TEXT FROM public.canonical_beneficiary_records
     WHERE client_id = v_client AND field_key = 'middleName' AND record_type = 'DECISION' AND decision_state = 'pending'));

  -- Original DECISION row is untouched (full-row snapshot, not merely one column).
  v_after_dec_snapshot := (SELECT to_jsonb(cbr) FROM public.canonical_beneficiary_records cbr WHERE cbr.id = v_dec);
  PERFORM cbr_test.assert_eq('GAP-TX03-PENDING-decision-row-unchanged', v_before_dec_snapshot::TEXT, v_after_dec_snapshot::TEXT);

  -- Canonical client value unchanged (rejected open performs no client mutation).
  PERFORM cbr_test.assert_null('GAP-TX03-PENDING-canonical-still-absent', (SELECT middle_name FROM public.clients WHERE id = v_client));

  -- Processing-state unchanged by the rejected second open (TX-03 never writes it).
  v_after_pcs_snapshot := (SELECT to_jsonb(pcs) FROM cbr_internal.cbr_field_processing_state pcs WHERE pcs.client_id = v_client AND pcs.field_key = 'middleName');
  PERFORM cbr_test.assert_eq('GAP-TX03-PENDING-processing-state-unchanged', v_before_pcs_snapshot::TEXT, v_after_pcs_snapshot::TEXT);
END $$;

-- ── Gap closure: TX-03 NOT_OPENABLE (staleness reason) ─────────────────
-- Distinguished from AC-55's already-resolved NOT_OPENABLE branch: here
-- TX-03 is called on observation A for the FIRST time ever, but A's own
-- source submission is no longer the governing one by the time it is
-- called -- reached via ordinary TX-02 supersession, no fault injection.
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_sA UUID; v_sB UUID; v_obsA UUID; v_obsB UUID; v_o TEXT;
        v_gov_sub UUID; v_dec_scratch UUID;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'gap-tx03-stale@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM cbr_test.assert_null('GAP-TX03-STALE-canonical-precondition-absent', (SELECT middle_name FROM public.clients WHERE id = v_client));

  -- Observation A: first-ever event, becomes governing.
  v_sA := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('ObservacionA')));
  SELECT outcome, observation_id INTO v_o, v_obsA FROM public.cbr_tx02_observe_g3(v_sA, 'middleName');
  PERFORM cbr_test.assert_eq('GAP-TX03-STALE-setup-A', 'OBSERVED', v_o);
  PERFORM cbr_test.assert_not_null('GAP-TX03-STALE-setup-A-observation_id', v_obsA);

  -- Observation B: strictly newer, differing value, canonical still
  -- absent -> the ordinary CONFLICT/supersession branch (no pending
  -- decision exists yet on A, so TX-02's own STEP-14 supersession check
  -- finds nothing to supersede) -- B becomes governing.
  v_sB := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('ObservacionB')));
  SELECT outcome, observation_id INTO v_o, v_obsB FROM public.cbr_tx02_observe_g3(v_sB, 'middleName');
  PERFORM cbr_test.assert_eq('GAP-TX03-STALE-setup-B', 'CONFLICT', v_o);
  PERFORM cbr_test.assert_not_null('GAP-TX03-STALE-setup-B-observation_id', v_obsB);

  SELECT governing_submission_id INTO v_gov_sub FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client AND field_key = 'middleName';
  PERFORM cbr_test.assert_eq('GAP-TX03-STALE-governing-is-B', v_sB::TEXT, v_gov_sub::TEXT);

  -- Now attempt TX-03 against A, for the FIRST time -- A's own source
  -- submission's (submitted_at, id) tuple is strictly older than the
  -- governing (B) tuple.
  SELECT outcome, decision_id INTO v_o, v_dec_scratch FROM public.cbr_tx03_open_g3_review(v_obsA, v_admin);
  PERFORM cbr_test.assert_eq('GAP-TX03-STALE-not-openable', 'NOT_OPENABLE', v_o);
  PERFORM cbr_test.assert_null('GAP-TX03-STALE-no-decision-id-on-rejection', v_dec_scratch);

  -- No DECISION was created for A.
  PERFORM cbr_test.assert_eq('GAP-TX03-STALE-no-decision-for-A', '0',
    (SELECT count(*)::TEXT FROM public.canonical_beneficiary_records WHERE record_type = 'DECISION' AND source_observation_id = v_obsA));

  -- Canonical unchanged.
  PERFORM cbr_test.assert_null('GAP-TX03-STALE-canonical-still-absent', (SELECT middle_name FROM public.clients WHERE id = v_client));

  -- Governing processing state still points to B.
  SELECT governing_submission_id INTO v_gov_sub FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client AND field_key = 'middleName';
  PERFORM cbr_test.assert_eq('GAP-TX03-STALE-governing-still-B', v_sB::TEXT, v_gov_sub::TEXT);
END $$;

-- ============================================================
-- AC-51 (Final Test-Coverage Integrity Correction round) — TX-02's own
-- STEP 14 ELSE branch: "a pending DECISION exists whose origin
-- observation's submission is NOT strictly older than the incoming
-- event" -> RAISE CBR_INTERNAL_INCONSISTENCY -> full rollback.
--
-- AUTHORITATIVE DEFINITION (as supplied): TX-02 finds a pending DECISION,
-- but that decision's origin observation submission is NOT strictly
-- older than the incoming event (should be unreachable given
-- replay-before-ordering sequencing) -> RAISE INTERNAL_INCONSISTENCY ->
-- full rollback.
--
-- INVESTIGATED AGAINST THE ACTUAL MIGRATION 040 SOURCE. Classified
-- STRUCTURALLY UNREACHABLE through the normal production path (TX-01..05
-- called only as designed; no trigger disabled; no direct table write).
-- No test forces this branch. No PASS is claimed for it. The proof:
--
-- Let D be a pending DECISION for (client_id, field_key), with origin
-- observation O (D.source_observation_id = O.id), and let T_origin be
-- O's own source submission's (submitted_at, id) tuple.
--
-- (1) T_origin is exactly the governing tuple at the moment D was opened.
--     The TX-02 call that created O is the SAME call whose own STEP 15
--     set cbr_field_processing_state.(governing_submission_id,
--     governing_submitted_at) := T_origin (STEP 15 runs, unconditionally,
--     at the end of every successful TX-02 call, using THAT call's own
--     incoming tuple). TX-03 (which turns O into pending D) never writes
--     processing_state at all. So immediately after D is opened,
--     governing_tuple == T_origin exactly.
--
-- (2) While D remains pending, governing_tuple can never move past
--     T_origin without D being superseded in the SAME transaction. Any
--     TX-02 call that reaches STEP 14 while D is pending necessarily has
--     governing_tuple == T_origin at that moment (by (1), and because no
--     OTHER mechanism advances G3 governing state -- TX-04's own STEP 12
--     advance is tied to the specific decision being approved, so it
--     cannot leave a DIFFERENT decision's governing pointer stale).
--     STEP 14 itself, on finding D pending, either supersedes it
--     (advancing governing to the new call's own tuple, ending D's
--     pending status) or RAISEs (aborting the whole call, so STEP 15
--     never runs and governing does not move). Either way, governing
--     cannot advance past T_origin while D is still pending.
--
-- (3) STEP 11 (ordering/STALE), which runs BEFORE STEP 13/14 in the SAME
--     call, requires the incoming event's own tuple to be
--     >= governing_tuple, or the call returns STALE and never reaches
--     STEP 14 at all. Combined with (2) (governing_tuple == T_origin
--     whenever STEP 14 finds D pending), this forces: incoming_tuple >=
--     T_origin, for every call that ever reaches STEP 14 with D pending.
--
-- (4) incoming_tuple can never EQUAL T_origin at STEP 14. Tuple equality
--     requires equal submission_id (the second component), which means
--     the incoming event IS the exact same submission that produced O.
--     STEP 9 (replay lookup, submission-id-keyed) runs BEFORE STEP 14 and
--     would have already found O's own CANDIDATE_OBSERVED row for that
--     exact submission_id and returned early (replay) -- this is exactly
--     the "replay-before-ordering sequencing" the authoritative
--     definition itself names as the reason this should be unreachable,
--     confirmed here by tracing the actual STEP 9 -> STEP 11 -> STEP 14
--     order in the real function body, not merely asserted.
--
-- (5) From (3) and (4): incoming_tuple is ALWAYS strictly greater than
--     T_origin whenever STEP 14 finds D pending -- which is exactly
--     STEP 14's IF condition (supersede), never its ELSE (AC-51's RAISE).
--
-- CONCLUSION: the ELSE branch is structurally unreachable through the
-- normal production path, for the same class of reason STALE_REVIEW is
-- (see the adjacent analysis below) -- the ordering/replay/locking
-- discipline TX-02 itself enforces makes the precondition this branch
-- requires impossible to construct without direct, out-of-band state
-- corruption, which is exactly what this delivery is instructed not to
-- do. Positive, existing, reviewed evidence for the mechanism this proof
-- relies on: AC-50 (above) demonstrates the IF/supersede branch firing in
-- exactly the scenario this proof traces; AC-33/AC-34 (above) demonstrate
-- STEP 9's replay lookup firing before any ordering check is reached, for
-- the same submission_id. This delivery does not modify migration 040 to
-- make the branch reachable or unreachable -- if this conclusion is later
-- found wrong, that is a migration-040 design/implementation question,
-- not a test-artifact gap.
-- ============================================================

-- ============================================================
-- Gap closure: TX-04 STALE_REVIEW — INVESTIGATED, found STRUCTURALLY
-- UNREACHABLE through the normal production path. Not tested with a
-- forced/corrupted state; classified honestly instead, per instruction.
--
-- STEP 7 of cbr_tx04_approve_g3 (migration 040) returns STALE_REVIEW when
-- a decision is still 'pending' (STEP 6 already passed) AND its source
-- observation's (submitted_at, submission_id) tuple is no longer >= the
-- field's governing tuple.
--
-- For that state to exist, some OTHER event must have advanced governing
-- state past this decision's source observation WHILE the decision was
-- still pending. The only function that ever advances governing state for
-- a G3 field is cbr_tx02_observe_g3 -- and its own STEP 14 unconditionally
-- checks, BEFORE ever reaching STEP 15's governing advance, for an
-- existing pending DECISION on the same (client_id, field_key) and, if one
-- is found, either supersedes it (decision_state := 'superseded') or
-- raises CBR_INTERNAL_INCONSISTENCY -- there is no path through TX-02
-- that advances governing state while leaving a pending decision's source
-- observation behind it. TX-03's own ALREADY_PENDING check (see the
-- gap-closure block above) further guarantees at most one pending
-- DECISION can ever exist per (client, field) at a time, so there is no
-- second, independently-stale-able decision to construct this state from
-- either. TX-04's own STEP 12 (its governing-state advance on approval)
-- only ever advances governing to the value tied to the SAME decision
-- being approved, so it cannot leave a DIFFERENT decision stale.
--
-- This is not merely a source-reading claim: AC-50 (above, and
-- finding-03's Block A) is the existing, reviewed, positive proof of the
-- exact mechanism that closes this branch off -- it demonstrates a newer
-- event arriving while a decision is pending supersedes it, every time.
-- The concurrency harness's AC-58a (concurrency/ac58.sh) is corroborating
-- evidence from a different angle: when TX-02 and TX-04 race for the same
-- pending decision, TX-04 observes ALREADY_RESOLVED (decision_state
-- already flipped to 'superseded' by TX-02's STEP 14), never
-- STALE_REVIEW -- because STEP 6 (ALREADY_RESOLVED) is checked before
-- STEP 7 (STALE_REVIEW) ever would be, and by the time TX-04 could reach
-- STEP 7 the decision is no longer 'pending' in every schedule traced.
--
-- CONCLUSION: cbr_tx04_approve_g3's STALE_REVIEW outcome is STRUCTURALLY
-- UNREACHABLE through the normal, approved production flow (TX-01..05
-- called only as designed, no trigger disabled, no direct table write).
-- No test forces this branch. No PASS is claimed for it. This delivery
-- does not modify migration 040 to make the branch reachable or
-- unreachable -- if this conclusion is later found wrong, that is a
-- migration-040 design/implementation question, not a test-artifact gap.
-- ============================================================

-- ── Gap closure: TX-04 ALREADY_RESOLVED (deterministic, single-session) ─
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_obs UUID; v_dec UUID; v_o TEXT;
        v_before_snapshot JSONB; v_after_snapshot JSONB;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'gap-tx04-resolved@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM cbr_test.assert_null('GAP-TX04-RESOLVED-canonical-precondition-absent', (SELECT middle_name FROM public.clients WHERE id = v_client));

  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('Resuelto')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_s1, 'middleName');
  PERFORM cbr_test.assert_eq('GAP-TX04-RESOLVED-setup-observe', 'OBSERVED', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM cbr_test.assert_eq('GAP-TX04-RESOLVED-setup-open', 'OPENED', v_o);

  -- First call: canonical absent, matching NULL expectation -> APPROVED.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, NULL);
  PERFORM cbr_test.assert_eq('GAP-TX04-RESOLVED-first-approve', 'APPROVED', v_o);
  PERFORM cbr_test.assert_eq('GAP-TX04-RESOLVED-exactly-one-change-realized', '1',
    (SELECT count(*)::TEXT FROM public.canonical_beneficiary_records WHERE record_type='CHANGE_REALIZED' AND related_decision_id = v_dec));
  PERFORM cbr_test.assert_eq('GAP-TX04-RESOLVED-canonical-realized', 'Resuelto', (SELECT middle_name FROM public.clients WHERE id = v_client));

  v_before_snapshot := (SELECT to_jsonb(cbr) FROM public.canonical_beneficiary_records cbr WHERE cbr.id = v_dec);

  -- Second call, same decision: decision_state is no longer 'pending' ->
  -- the real ALREADY_RESOLVED branch (STEP 6), proven deterministically,
  -- not via the concurrency race (AC-58a) alone.
  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, NULL);
  PERFORM cbr_test.assert_eq('GAP-TX04-RESOLVED-second-approve', 'ALREADY_RESOLVED', v_o);

  -- Exactly one CHANGE_REALIZED still exists (no second one created).
  PERFORM cbr_test.assert_eq('GAP-TX04-RESOLVED-still-exactly-one-change-realized', '1',
    (SELECT count(*)::TEXT FROM public.canonical_beneficiary_records WHERE record_type='CHANGE_REALIZED' AND related_decision_id = v_dec));

  -- Canonical value not mutated a second time.
  PERFORM cbr_test.assert_eq('GAP-TX04-RESOLVED-canonical-unchanged-by-second-call', 'Resuelto', (SELECT middle_name FROM public.clients WHERE id = v_client));

  -- Decision remains in its original terminal state (full-row snapshot).
  v_after_snapshot := (SELECT to_jsonb(cbr) FROM public.canonical_beneficiary_records cbr WHERE cbr.id = v_dec);
  PERFORM cbr_test.assert_eq('GAP-TX04-RESOLVED-decision-row-unchanged', v_before_snapshot::TEXT, v_after_snapshot::TEXT);
END $$;

-- ── Gap closure: TX-05 (public.cbr_tx05_reject_g3) direct functional
-- coverage — normal rejection and replay/already-resolved. ─────────────
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_obs UUID; v_dec UUID; v_o TEXT;
        v_before_snapshot JSONB; v_after_snapshot JSONB;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'gap-tx05@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM cbr_test.assert_null('GAP-TX05-canonical-precondition-absent', (SELECT middle_name FROM public.clients WHERE id = v_client));

  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('Rechazado')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_s1, 'middleName');
  PERFORM cbr_test.assert_eq('GAP-TX05-setup-observe', 'OBSERVED', v_o);
  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM cbr_test.assert_eq('GAP-TX05-setup-open', 'OPENED', v_o);

  -- A. Normal rejection: real TX-05 call.
  SELECT outcome INTO v_o FROM public.cbr_tx05_reject_g3(v_dec, v_admin, 'no coincide con el documento fuente');
  PERFORM cbr_test.assert_eq('GAP-TX05-reject', 'REJECTED', v_o);
  PERFORM cbr_test.assert_eq('GAP-TX05-decision-state-rejected', 'rejected', (SELECT decision_state FROM public.canonical_beneficiary_records WHERE id = v_dec));
  PERFORM cbr_test.assert_eq('GAP-TX05-reviewed-by', v_admin::TEXT, (SELECT reviewed_by::TEXT FROM public.canonical_beneficiary_records WHERE id = v_dec));
  PERFORM cbr_test.assert_not_null('GAP-TX05-reviewed-at', (SELECT reviewed_at FROM public.canonical_beneficiary_records WHERE id = v_dec));
  PERFORM cbr_test.assert_eq('GAP-TX05-decision-reason', 'no coincide con el documento fuente', (SELECT decision_reason FROM public.canonical_beneficiary_records WHERE id = v_dec));

  -- Canonical unchanged (rejection never mutates canonical).
  PERFORM cbr_test.assert_null('GAP-TX05-canonical-unchanged', (SELECT middle_name FROM public.clients WHERE id = v_client));

  -- Zero CHANGE_REALIZED rows for this decision.
  PERFORM cbr_test.assert_eq('GAP-TX05-zero-change-realized', '0',
    (SELECT count(*)::TEXT FROM public.canonical_beneficiary_records WHERE record_type='CHANGE_REALIZED' AND related_decision_id = v_dec));

  v_before_snapshot := (SELECT to_jsonb(cbr) FROM public.canonical_beneficiary_records cbr WHERE cbr.id = v_dec);

  -- B. Replay/already-resolved: real second TX-05 call, same decision.
  SELECT outcome INTO v_o FROM public.cbr_tx05_reject_g3(v_dec, v_admin, 'segundo intento');
  PERFORM cbr_test.assert_eq('GAP-TX05-second-reject', 'ALREADY_RESOLVED', v_o);

  -- Terminal decision row unchanged (full-row snapshot -- the FIRST
  -- call's decision_reason is retained, not overwritten by the second
  -- call's differing reason text).
  v_after_snapshot := (SELECT to_jsonb(cbr) FROM public.canonical_beneficiary_records cbr WHERE cbr.id = v_dec);
  PERFORM cbr_test.assert_eq('GAP-TX05-decision-row-unchanged-after-replay', v_before_snapshot::TEXT, v_after_snapshot::TEXT);

  -- Canonical unchanged.
  PERFORM cbr_test.assert_null('GAP-TX05-canonical-unchanged-after-replay', (SELECT middle_name FROM public.clients WHERE id = v_client));
END $$;

-- ── Gap closure: TX-04-created CHANGE_REALIZED.origin follows the source
-- observation chain (migration 040 STEP 10 copies co.origin FROM the
-- source observation, not from the DECISION row's own origin column,
-- though those are also cross-checked equal here). ─────────────────────
DO $$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_obs UUID; v_dec UUID; v_o TEXT;
        v_obs_origin TEXT; v_dec_origin TEXT; v_change_origin TEXT;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'gap-tx04-origin@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  PERFORM cbr_test.assert_null('GAP-TX04-ORIGIN-canonical-precondition-absent', (SELECT middle_name FROM public.clients WHERE id = v_client));

  -- Distinctive origin value ('coach_discovery'), not reused by any other
  -- block in this file for this same purpose.
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv,
    jsonb_build_object('middleName', cbr_test.sp_field('Procedencia', 'beneficiary_confirmed', 'test-actor', now(), 'beneficiary_confirmed', 'coach_discovery')));
  SELECT outcome, observation_id INTO v_o, v_obs FROM public.cbr_tx02_observe_g3(v_s1, 'middleName');
  PERFORM cbr_test.assert_eq('GAP-TX04-ORIGIN-setup-observe', 'OBSERVED', v_o);
  SELECT origin INTO v_obs_origin FROM public.canonical_beneficiary_records WHERE id = v_obs;
  PERFORM cbr_test.assert_eq('GAP-TX04-ORIGIN-observation-origin', 'coach_discovery', v_obs_origin);

  SELECT outcome, decision_id INTO v_o, v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  PERFORM cbr_test.assert_eq('GAP-TX04-ORIGIN-setup-open', 'OPENED', v_o);
  SELECT origin INTO v_dec_origin FROM public.canonical_beneficiary_records WHERE id = v_dec;
  PERFORM cbr_test.assert_eq('GAP-TX04-ORIGIN-decision-origin', v_obs_origin, v_dec_origin);

  SELECT outcome INTO v_o FROM public.cbr_tx04_approve_g3(v_dec, v_admin, NULL);
  PERFORM cbr_test.assert_eq('GAP-TX04-ORIGIN-approve', 'APPROVED', v_o);

  SELECT origin INTO v_change_origin FROM public.canonical_beneficiary_records WHERE record_type='CHANGE_REALIZED' AND related_decision_id = v_dec;
  PERFORM cbr_test.assert_not_null('GAP-TX04-ORIGIN-change-realized-found', v_change_origin);
  -- The source observation chain (v_obs_origin, read directly from the
  -- CANDIDATE_OBSERVED row) is authoritative for this assertion -- not an
  -- independently re-derived expectation from the Intake submission.
  PERFORM cbr_test.assert_eq('GAP-TX04-ORIGIN-change-realized-origin-matches-source-observation', v_obs_origin, v_change_origin);
  PERFORM cbr_test.assert_eq('GAP-TX04-ORIGIN-decision-origin-matches-source-observation', v_obs_origin, v_dec_origin);
END $$;

SELECT '[DONE] 01-single-session-tests.sql — see NOTICE output above for individual PASS/FAIL results (UNEXECUTED in this environment).' AS summary;
