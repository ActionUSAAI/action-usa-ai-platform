#!/usr/bin/env bash
# Complete multi-session concurrency scripts: AC-58b, AC-57 (lock-wait
# half), AC-61, AC-62, AC-63, AC-64a (true-concurrency same-submission
# replay), AC-64b (true-concurrency distinct-submission corroboration),
# AC-64c (true-concurrency NO_OP), AC-65, AC-66(a/b/c — all three approved
# holder scenarios, with row-specific NOWAIT-probe proof of partial lock
# acquisition, not inference). Each scenario: sets up its own fixture,
# opens two-or-three real psql sessions, establishes and asserts the
# actual blocking relationship (IC Finding 5.1: assert_pg_waiting polls
# wait_event_type='Lock' AND confirms an explicitly-identified expected
# blocker's real backend pid is present in pg_blocking_pids() -- covering
# both relation-level lock contention and row-level/transactionid
# contention uniformly; never a relation-name pg_locks join, elapsed time,
# or query-text matching), releases in a defined, evidence-backed order
# (never a launch-order timing assumption -- see AC-63/AC-61/AC-62's
# explicit schedules), then parses and asserts outcomes (via
# assert_marker_result — IC Finding 6.7), persisted records, canonical
# effects, and final governing submission. Synthetic lock holders (raw
# FOR SHARE/FOR UPDATE SELECTs used to mimic a lock shape) are labeled as
# such and distinguished from actual TX-01/TX-02/TX-04 executions
# throughout (IC Finding 5.3). Every material assertion below is fatal (no
# `|| true`/`|| echo NOTE` swallowing a failure — IC Finding 6.1): a
# failed assertion aborts this script under `set -euo pipefail`, it does
# not print and continue.
#
# UNEXECUTED: written and statically reviewed only; never run.
set -euo pipefail
cd "$(dirname "$0")"
source lib.sh

echo "############################################"
echo "# AC-58b — TX-04 acquires clients first; TX-02 waits, then resumes"
echo "############################################"
run_sql "
\i ../00-helpers.sql
DO \$\$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_s2 UUID; v_obs UUID; v_dec UUID; v_t0 TIMESTAMPTZ;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac58b@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  -- IC Finding 5.1: anchor to clock_timestamp() (captured after the gate toggles
  -- above), not a hardcoded past date -- otherwise submitted_at < window.opened_at
  -- whenever this script runs after the hardcoded date, forcing ADMISSION_BOUNDARY
  -- instead of the outcome this scenario actually intends to test.
  v_t0 := clock_timestamp();
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('dateOfBirth', cbr_test.sp_field('1990-01-01')), v_t0 + interval '1 minute');
  PERFORM public.cbr_tx02_observe_g3(v_s1, 'dateOfBirth');
  SELECT id INTO v_obs FROM public.canonical_beneficiary_records WHERE source_submission_id = v_s1 AND record_type='CANDIDATE_OBSERVED';
  SELECT decision_id INTO v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  v_s2 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('dateOfBirth', cbr_test.sp_field('1990-01-02')), v_t0 + interval '31 minutes');
  CREATE TABLE IF NOT EXISTS cbr_test.fixture (k TEXT PRIMARY KEY, v TEXT);
  INSERT INTO cbr_test.fixture VALUES ('ac58b_s2', v_s2::TEXT), ('ac58b_dec', v_dec::TEXT), ('admin', v_admin::TEXT)
    ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
END \$\$;
SELECT 'FIXTURE_READY';
"
open_session A; open_session B
send A "BEGIN;"
send A "SELECT outcome FROM public.cbr_tx04_approve_g3((SELECT v::UUID FROM cbr_test.fixture WHERE k='ac58b_dec'), (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin'), NULL); SELECT 'A_TX04_DONE_HOLDING';"
wait_for A A_TX04_DONE_HOLDING
send B "SELECT 'RESULT:' || outcome FROM public.cbr_tx02_observe_g3((SELECT v::UUID FROM cbr_test.fixture WHERE k='ac58b_s2'), 'dateOfBirth'); SELECT 'B_TX02_ATTEMPTED';"
# IC Finding 5.1: A is B's explicitly identified expected blocker -- A
# holds the clients row via TX-04's STEP 3 lock acquisition, inside its
# still-open transaction.
assert_pg_waiting B "$A_BPID"
send A "COMMIT;"
wait_for B B_TX02_ATTEMPTED
assert_marker_result B B_TX02_ATTEMPTED RESULT CONFLICT "AC-58b (B/TX-02 outcome after A commits)"
DEC_STATE=$(run_sql "SELECT decision_state FROM public.canonical_beneficiary_records WHERE id = (SELECT v::UUID FROM cbr_test.fixture WHERE k='ac58b_dec');")
[ "${DEC_STATE// /}" = "approved" ] || { echo "FAIL: AC-58b: expected D1 to remain 'approved' (untouched by TX-02), actual '${DEC_STATE}'" >&2; exit 1; }
echo "[PASS] AC-58b-decision-untouched (decision_state=approved)"
close_session A; close_session B

echo ""
echo "############################################"
echo "# AC-57 — lock-wait half: authorization-change attempt blocks on a held Layer-2 lock"
echo "############################################"
run_sql "
DO \$\$
DECLARE v_admin UUID; v_agent1 UUID; v_agent2 UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_obs UUID; v_dec UUID;
BEGIN
  v_admin := (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin');
  v_agent1 := cbr_test.make_profile('agent');
  -- Corrected this round: a real, persisted second agent profile, not
  -- gen_random_uuid() -- the reviewed baseline's reassignment target did
  -- not reference any actual profiles row, which is not the reassignment
  -- this scenario claims to model.
  v_agent2 := cbr_test.make_profile('agent');
  v_client := cbr_test.make_client(v_agent1);
  -- Assert the fixture's own canonical precondition (item 1) rather than
  -- assuming it: make_client() fixes first_name='CBRTest' (NOT NULL).
  IF (SELECT first_name FROM public.clients WHERE id = v_client) IS DISTINCT FROM 'CBRTest' THEN
    RAISE EXCEPTION 'AC-57 precondition failed: expected canonical first_name = CBRTest for a fresh make_client() fixture';
  END IF;
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac57@example.invalid', v_admin);
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('givenName', cbr_test.sp_field('AC57Name')));
  SELECT observation_id INTO v_obs FROM public.cbr_tx02_observe_g3(v_s1, 'firstName');
  SELECT decision_id INTO v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin);
  INSERT INTO cbr_test.fixture VALUES ('ac57_client', v_client::TEXT), ('ac57_dec', v_dec::TEXT), ('ac57_agent1', v_agent1::TEXT), ('ac57_agent2', v_agent2::TEXT)
    ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
END \$\$;
SELECT 'FIXTURE_READY';
"
open_session A; open_session B
send A "BEGIN;"
# Corrected this round (item 5): the prior comment here claimed that
# reaching STEP 8b's STALE_PRIOR_VALUE meant "A never actually held the
# Layer-2 lock" -- that claim was WRONG and is withdrawn. TX-04's own step
# order acquires locks at STEP 3 (lock order), strictly BEFORE STEP 8b's
# stale-value check; a rejection at STEP 8b just RETURNs from the
# function without releasing anything -- the surrounding explicit
# transaction (A's own BEGIN) keeps holding whatever STEP 3 acquired,
# including the clients row, regardless of the function's return value,
# until A explicitly COMMITs or ROLLBACKs. So B would have blocked on A's
# held lock even under the reviewed baseline's NULL/STALE_PRIOR_VALUE call.
# canonical first_name is make_client()'s fixed non-NULL 'CBRTest'
# (assert the precondition below); 'CBRTest' is supplied as
# p_expected_prior_value not because it is required for B to block at
# all, but because it is required to establish the SCENARIO this test
# actually claims: a genuinely SUCCESSFUL approval whose lock B blocks on
# (the decision_state='approved' check below requires a real approval to
# have happened, which STALE_PRIOR_VALUE would not produce).
send A "SELECT 'RESULT:' || outcome FROM public.cbr_tx04_approve_g3((SELECT v::UUID FROM cbr_test.fixture WHERE k='ac57_dec'), (SELECT v::UUID FROM cbr_test.fixture WHERE k='ac57_agent1'), 'CBRTest'); SELECT 'A_LOCKS_HELD';"
wait_for A A_LOCKS_HELD
# Captured and asserted via the established result-marker mechanism, BEFORE
# A's transaction is released -- confirms the specific scenario under test
# (a genuinely-approved transaction, not merely any lock-holding one).
assert_marker_result A A_LOCKS_HELD RESULT APPROVED "AC-57 (A/TX-04 outcome, asserted before A's transaction is released)"
send B "UPDATE public.clients SET assigned_agent_id = (SELECT v::UUID FROM cbr_test.fixture WHERE k='ac57_agent2') WHERE id = (SELECT v::UUID FROM cbr_test.fixture WHERE k='ac57_client'); SELECT 'B_REASSIGN_ATTEMPTED';"
# IC Finding 5.1: A is B's explicitly identified expected blocker.
assert_pg_waiting B "$A_BPID"
send A "COMMIT;"
wait_for B B_REASSIGN_ATTEMPTED
# Corrected this round: do not rely only on B_REASSIGN_ATTEMPTED having
# appeared -- that marker only proves B's statement returned, not that the
# UPDATE actually took effect. Check the resulting column value directly.
ASSIGNED_AGENT=$(run_sql "SELECT assigned_agent_id FROM public.clients WHERE id = (SELECT v::UUID FROM cbr_test.fixture WHERE k='ac57_client');")
AGENT2_ID=$(run_sql "SELECT v FROM cbr_test.fixture WHERE k='ac57_agent2';")
[ "${ASSIGNED_AGENT// /}" = "${AGENT2_ID// /}" ] || { echo "FAIL: AC-57: expected assigned_agent_id to actually be reassigned to agent2 after B's UPDATE, actual '${ASSIGNED_AGENT}' vs agent2='${AGENT2_ID}'" >&2; exit 1; }
echo "[PASS] AC-57-reassignment-persisted (assigned_agent_id=agent2, a real second profile)"
DEC_STATE=$(run_sql "SELECT decision_state FROM public.canonical_beneficiary_records WHERE id = (SELECT v::UUID FROM cbr_test.fixture WHERE k='ac57_dec');")
[ "${DEC_STATE// /}" = "approved" ] || { echo "FAIL: AC-57: A's approval must not be retroactively invalidated, expected decision_state='approved', actual '${DEC_STATE}'" >&2; exit 1; }
echo "[PASS] AC-57 (A's approval survives B's later, unrelated reassignment; decision_state=approved)"
close_session A; close_session B

echo ""
echo "############################################"
echo "# AC-61/AC-62/AC-63/AC-65/AC-66 — toggle vs. processing / toggle vs. toggle lock order"
echo "############################################"
run_sql "
DO \$\$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_client2 UUID; v_case2 UUID; v_inv2 UUID; v_s2 UUID;
BEGIN
  v_admin := (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin');
  v_client := cbr_test.make_client(); v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac61@example.invalid', v_admin);
  -- Corrected this round: switched 'firstName'/'givenName' to 'middleName'.
  -- canonical firstName is make_client()'s fixed non-NULL 'CBRTest' -- a
  -- differing candidate against it reaches CONFLICT, not this scenario's
  -- intended OBSERVED (AC-61's own point is lock ordering, not a specific
  -- action-table branch, so the nullable field preserves that meaning
  -- exactly while making OBSERVED actually correct).
  IF (SELECT middle_name FROM public.clients WHERE id = v_client) IS NOT NULL THEN
    RAISE EXCEPTION 'AC-61 precondition failed: expected canonical middle_name to be absent (NULL) for a fresh make_client() fixture';
  END IF;
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('AC61A')));
  v_client2 := cbr_test.make_client(); v_case2 := cbr_test.make_case(v_client2); -- different client, AC-62
  v_inv2 := cbr_test.make_invitation(v_case2, v_client2, 'ac62@example.invalid', v_admin);
  IF (SELECT middle_name FROM public.clients WHERE id = v_client2) IS NOT NULL THEN
    RAISE EXCEPTION 'AC-62 precondition failed: expected canonical middle_name to be absent (NULL) for a fresh make_client() fixture';
  END IF;
  v_s2 := cbr_test.make_submission(v_client2, v_case2, v_inv2, jsonb_build_object('middleName', cbr_test.sp_field('AC62A')));
  INSERT INTO cbr_test.fixture VALUES ('ac61_s1', v_s1::TEXT), ('ac62_s2', v_s2::TEXT)
    ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
END \$\$;
SELECT 'FIXTURE_READY';
"

echo "--- AC-61: TX-02 holds gate_state FOR SHARE + is separately waiting on clients (held by a third writer); a toggle for the same gate must still block on gate_state regardless of whether that toggle proves to be a real transition or a NO_CHANGE call ---"
# Explicit prerequisite (item 2): g3_observation and g3_staff_resolution
# must already be enabled here, or A's TX-02 call below short-circuits at
# STEP 1 (fail-closed gate check) instead of ever reaching the clients lock
# this scenario depends on. Asserted, not assumed -- both were left enabled
# by AC-58b's fixture above and nothing between there and here disables
# either.
G3_OBS_ENABLED=$(run_sql "SELECT enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g3_observation';")
G3_STAFF_ENABLED=$(run_sql "SELECT enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g3_staff_resolution';")
[ "${G3_OBS_ENABLED// /}" = "t" ] || { echo "FAIL: AC-61 precondition: g3_observation must already be enabled, actual '${G3_OBS_ENABLED}'" >&2; exit 1; }
[ "${G3_STAFF_ENABLED// /}" = "t" ] || { echo "FAIL: AC-61 precondition: g3_staff_resolution must already be enabled, actual '${G3_STAFF_ENABLED}'" >&2; exit 1; }
echo "[PASS] AC-61-precondition (g3_observation=true, g3_staff_resolution=true -- both already enabled; B's toggle-to-true below is therefore necessarily a NO_CHANGE call, not a fresh TOGGLED transition -- see the corrected expectation below)"
open_session C  # holds clients, independent of the gate question, to make TX-02 wait on clients too
send C "BEGIN; SELECT 1 FROM public.clients WHERE id = (SELECT client_id FROM public.intake_submissions WHERE id=(SELECT v::UUID FROM cbr_test.fixture WHERE k='ac61_s1')) FOR UPDATE; SELECT 'C_HOLDS_CLIENTS';"
wait_for C C_HOLDS_CLIENTS
open_session A  # TX-02: will acquire gate_state FOR SHARE, then block on clients (held by C)
send A "BEGIN;"
send A "SELECT 'RESULT:' || outcome FROM public.cbr_tx02_observe_g3((SELECT v::UUID FROM cbr_test.fixture WHERE k='ac61_s1'), 'middleName'); SELECT 'A_TX02_ATTEMPTED';"
# IC Finding 5.1/5.3: C is A's explicitly identified expected blocker (C
# holds the clients row via its own FOR UPDATE). Additionally (item 3):
# proves A already holds the RELEVANT GATE LOCK (g3_observation's
# gate_state row) WHILE blocked on clients -- confirming A reached STEP 1's
# gate acquisition before ever reaching STEP 6's clients wait, not merely
# that *some* session is stuck somewhere. Per the controlled schedule so
# far (only A has touched gate_state at this point), this row-lock is
# attributable to A specifically.
assert_pg_waiting A "$C_BPID"
assert_row_locked cbr_internal.cbr_field_gate_state gate "'g3_observation'" "AC-61-A-holds-gate-state-while-blocked-on-clients"
open_session B  # toggle attempt for the SAME gate TX-02 already holds FOR SHARE -- opened only after A's blocked-by-C state above is confirmed
send B "SELECT 'RESULT:' || outcome FROM cbr_internal.cbr_toggle_gate('g3_observation', true, (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin')); SELECT 'B_TOGGLE_ATTEMPTED';"
# IC Finding 5.1/5.3: A is B's explicitly identified expected blocker (A
# holds gate_state FOR SHARE from STEP 1, and is the only session that has
# touched it, per the schedule above) -- proven BEFORE C is released below.
assert_pg_waiting B "$A_BPID"
echo "[PASS] AC-61: B (toggle) is blocked by A specifically, while A is separately, simultaneously blocked by C on clients -- confirms the toggle's wait is governed by gate_state contention specifically, independent of whatever else A is waiting on."
send C "COMMIT;"
wait_for A A_TX02_ATTEMPTED
assert_marker_result A A_TX02_ATTEMPTED RESULT OBSERVED "AC-61 (A/TX-02 outcome after C releases clients)"
# Residual correction: A's TX-02 ran inside an explicit BEGIN; and is
# NEVER committed by the code above it -- TX-02 itself does not commit its
# caller's transaction. Until A commits, A continues to hold gate_state
# FOR SHARE (acquired inside the still-open transaction), so B's toggle
# (which needs to acquire that same gate_state row exclusively) can NEVER
# unblock. A must be committed explicitly here, AFTER its TX-02 result is
# captured/asserted and AFTER C has already released clients, and BEFORE
# waiting on B.
send A "COMMIT;"
wait_for B B_TOGGLE_ATTEMPTED
# Corrected in the prior round: g3_observation is already enabled (per the
# precondition asserted above), so this toggle-to-true call is necessarily
# a NO_CHANGE, not a TOGGLED transition. B's call still has to lock/read
# gate_state to determine NO_CHANGE-vs-TOGGLED, so it still genuinely
# blocks behind A's held FOR SHARE lock either way -- now proven via the
# explicit backend-to-backend evidence above, not a relation-name match.
assert_marker_result B B_TOGGLE_ATTEMPTED RESULT NO_CHANGE "AC-61 (B/toggle outcome after A releases gate_state -- NO_CHANGE, since g3_observation was already enabled)"
close_session A; close_session B; close_session C

echo "--- AC-62: two TX-0x calls, DIFFERENT clients, same gate — B must complete successfully WHILE A's transaction (and its locks) are still held open, proving genuine non-blocking compatibility under real overlap, not merely sequential completion within a timeout ---"
# Corrected this round (item 3): the reviewed baseline sent both A and B as
# separate AUTOCOMMIT statements and only checked both finished within a
# timeout -- that does not prove they ever actually overlapped while
# holding locks; they could have run one after another, never contending
# at all, and the assertion would still pass. Fixed: A is now wrapped in
# an explicit BEGIN and deliberately kept open (its gate_state FOR SHARE
# and its own clients-row lock for client1 remain held) while B runs and
# is REQUIRED to reach its own success marker BEFORE A is ever committed
# below -- this is what actually proves the two calls are lock-compatible
# under genuine, real overlap.
#
# Also traced explicitly (unchanged from the prior round): A here reuses
# 'ac61_s1' -- the SAME submission AC-61's own session A already ran
# cbr_tx02_observe_g3 on and committed, above -- so this call is a REPLAY
# of AC-61's actual recorded result (OBSERVED), not an independent
# first-ever event. A zero-conflict replay preserves OBSERVED (same class
# as AC-47's traced replay branch). B ('ac62_s2') is a genuinely distinct,
# first-ever submission for a different client and is expected OBSERVED
# independently.
CANDIDATE_EXISTS=$(run_sql "SELECT EXISTS(SELECT 1 FROM public.canonical_beneficiary_records WHERE source_submission_id=(SELECT v::UUID FROM cbr_test.fixture WHERE k='ac61_s1') AND record_type='CANDIDATE_OBSERVED');")
[ "${CANDIDATE_EXISTS// /}" = "t" ] || { echo "FAIL: AC-62 precondition: expected ac61_s1 to already have a CANDIDATE_OBSERVED row from AC-61's own scenario above, so that A's call below is a genuine replay, actual exists='${CANDIDATE_EXISTS}'" >&2; exit 1; }
open_session A; open_session B
send A "BEGIN;"
send A "SELECT 'RESULT:' || outcome FROM public.cbr_tx02_observe_g3((SELECT v::UUID FROM cbr_test.fixture WHERE k='ac61_s1'), 'middleName'); SELECT 'A_HOLDING';"
wait_for A A_HOLDING
assert_marker_result A A_HOLDING RESULT OBSERVED "AC-62 (A outcome, captured while A's transaction is still open -- replay of AC-61's own ac61_s1, matching its recorded OBSERVED result)"
send B "SELECT 'RESULT:' || outcome FROM public.cbr_tx02_observe_g3((SELECT v::UUID FROM cbr_test.fixture WHERE k='ac62_s2'), 'middleName'); SELECT 'B_DONE';"
wait_for B B_DONE 5
assert_marker_result B B_DONE RESULT OBSERVED "AC-62 (B outcome, completed successfully WHILE A's transaction -- and its locks -- are still held open; distinct, first-ever submission)"
echo "[PASS] AC-62: B completed successfully while A's transaction remained open -- gate_state FOR SHARE is mutually compatible across different clients under genuine overlap, not merely sequential non-interference."
send A "COMMIT;"
# Corrected this round (item 4): unlike every other COMMIT in this file,
# nothing here was blocked waiting on A specifically, so there was no
# OTHER session's own unblocking to serve as indirect proof the COMMIT
# actually completed server-side before A is closed -- writing "COMMIT;"
# into A's FIFO only proves the bytes were sent. assert_commit_complete
# sends an explicit follow-up query and waits for its result, giving
# positive evidence of server-side completion before A is closed.
assert_commit_complete A
close_session A; close_session B

echo "--- AC-63: a real toggle, held open in an explicit, uncommitted transaction, is the DIRECT blocker of a real TX-02 call -- no synthetic holder, no FIFO-ordering claim (simplified, item 3 follow-up) ---"
run_sql "
DO \$\$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID;
BEGIN
  v_admin := (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin');
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', false, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  v_client := cbr_test.make_client(); v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac63@example.invalid', v_admin);
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('givenName', cbr_test.sp_field('AC63')));
  INSERT INTO cbr_test.fixture VALUES ('ac63_s1', v_s1::TEXT) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
END \$\$;
SELECT 'FIXTURE_READY';
" # fixture preserved unchanged: submission created while g3_observation admission is disabled
# Corrected this round, second pass (item 3): the prior FIFO-queue-based
# redesign (a synthetic HOLDER session, with A's and B's queue position on
# the SAME contended row confirmed before HOLDER released) assumed
# Postgres's per-row wait queue guarantees a specific service order across
# the whole contention shape -- a stronger claim than this scenario
# actually needs to establish, and more fragile to reason about than
# necessary. Removed entirely, per instruction: no synthetic HOLDER, no
# FIFO-ordering claim.
#
# Simplified to a direct, explicit transaction schedule: A itself -- a
# REAL toggle call, not a synthetic lock-holder -- is the direct blocker.
# A's toggle runs and is asserted TOGGLED while A's own transaction
# remains open and uncommitted (still holding whatever locks the toggle
# acquired). B's real TX-02 call is then proven Lock-waiting with A's OWN
# backend pid directly in pg_blocking_pids(B) -- a direct, two-party
# relationship, nothing routed through a third session -- BEFORE A is
# ever committed. This is genuine transaction overlap: B attempts its
# operation before A commits, and only observes the post-toggle admission
# window once A actually has.
open_session A
send A "BEGIN;"
send A "SELECT 'RESULT:' || outcome FROM cbr_internal.cbr_toggle_gate('g3_observation', true, (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin')); SELECT 'A_TOGGLE_DONE_HOLDING';"
wait_for A A_TOGGLE_DONE_HOLDING
assert_marker_result A A_TOGGLE_DONE_HOLDING RESULT TOGGLED "AC-63 (A/toggle outcome, asserted while A's transaction remains open and uncommitted)"
open_session B
send B "SELECT 'RESULT:' || outcome FROM public.cbr_tx02_observe_g3((SELECT v::UUID FROM cbr_test.fixture WHERE k='ac63_s1'), 'firstName'); SELECT 'B_TX02_ATTEMPTED';"
assert_pg_waiting B "$A_BPID"
send A "COMMIT;"
wait_for B B_TX02_ATTEMPTED
assert_marker_result B B_TX02_ATTEMPTED RESULT ADMISSION_BOUNDARY "AC-63 (B/TX-02 outcome after A commits -- the newly-opened g3_observation window's opened_at postdates s1.submitted_at, correctly rejecting retrospective admission)"
close_session A; close_session B

echo "--- AC-65: two toggle calls for the SAME gate ---"
open_session A; open_session B
send A "BEGIN;"
send A "SELECT outcome FROM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin')); SELECT 'A_TOGGLE_HOLDING';"
wait_for A A_TOGGLE_HOLDING
send B "SELECT 'RESULT:' || outcome FROM cbr_internal.cbr_toggle_gate('g3_staff_resolution', false, (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin')); SELECT 'B_TOGGLE_ATTEMPTED';"
# IC Finding 5.1: A is B's explicitly identified expected blocker.
assert_pg_waiting B "$A_BPID"
send A "COMMIT;"
wait_for B B_TOGGLE_ATTEMPTED
assert_marker_result B B_TOGGLE_ATTEMPTED RESULT TOGGLED "AC-65 (B outcome after A commits g3_staff_resolution=true; B legitimately flips it to false)"
close_session A; close_session B

echo "--- AC-66 scenario (a): a SYNTHETIC lock holder (HOLDER1: a raw FOR SHARE SELECT against the g1g2 gate_state row, NOT an actual TX-01 execution -- distinguished explicitly per item 3) mimics the lock shape TX-01 would leave; a toggle for g1g2 waits at its FIRST required row — confirms zero prior gate rows acquired ---"
# Explicit prerequisite (item 2): nothing earlier in this script touches
# g1g2, so its state here is otherwise whatever the database's initial
# state left it in -- not asserted, only assumed, in the reviewed baseline.
# Force it to a known-disabled state so the toggle-to-true below is
# guaranteed a genuine transition (TOGGLED), not merely presumed to be one.
run_sql "SELECT outcome FROM cbr_internal.cbr_toggle_gate('g1g2', false, (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin'));" > /dev/null
G1G2_STATE=$(run_sql "SELECT enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g1g2';")
[ "${G1G2_STATE// /}" = "f" ] || { echo "FAIL: AC-66(a) precondition: expected g1g2 forced to a known-disabled state, actual enabled='${G1G2_STATE}'" >&2; exit 1; }
echo "[PASS] AC-66(a)-precondition (g1g2 forced to a known-disabled state; the toggle-to-true below is therefore guaranteed a genuine transition)"
open_session HOLDER1
send HOLDER1 "BEGIN; SELECT enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g1g2' FOR SHARE; SELECT 'H1_HOLDS_G1G2';"
wait_for HOLDER1 H1_HOLDS_G1G2
open_session A
send A "SELECT 'RESULT:' || outcome FROM cbr_internal.cbr_toggle_gate('g1g2', true, (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin')); SELECT 'A_TOGGLE_ATTEMPTED';"
# IC Finding 5.1: HOLDER1 is A's explicitly identified expected blocker.
assert_pg_waiting A "$HOLDER1_BPID"
# Residual correction (AC-66): row-specific proof via a fresh, separate
# NOWAIT probe connection against EXACTLY the g1g2 row (which HOLDER1
# holds FOR SHARE -- conflicts with the probe's FOR UPDATE, so it must
# fail to acquire) and EXACTLY the other two gate rows (which nobody
# holds, so the probe must succeed) -- not a relation-level pg_locks
# COUNT, which cannot distinguish "holds row R" from "holds some other
# row of the same relation".
assert_row_locked cbr_internal.cbr_field_gate_state gate "'g1g2'" "AC-66(a)-g1g2-held-by-holder1"
assert_row_free cbr_internal.cbr_field_gate_state gate "'g3_observation'" "AC-66(a)-g3_observation-free"
assert_row_free cbr_internal.cbr_field_gate_state gate "'g3_staff_resolution'" "AC-66(a)-g3_staff_resolution-free"
echo "[PASS] AC-66(a) (A is blocked at its first and only required row, g1g2; the other two gate rows are provably untouched by anyone, confirming A holds zero rows)"
send HOLDER1 "COMMIT;"
wait_for A A_TOGGLE_ATTEMPTED
assert_marker_result A A_TOGGLE_ATTEMPTED RESULT TOGGLED "AC-66(a) (A's final outcome after HOLDER1 releases)"
close_session A; close_session HOLDER1

echo "--- AC-66 scenario (b): a toggle has already locked g1g2 (first in its own loop) and is now blocked at g3_observation, held by a SYNTHETIC lock holder (HOLDER2: a raw FOR UPDATE SELECT against the g3_observation gate_state row, NOT an actual TX-02 execution -- distinguished explicitly per item 3) — partial lock acquisition proven row-specifically, zero business mutation confirmed ---"
# Explicit prerequisite (item 2): AC-66(a) above left g1g2 ENABLED (its
# toggle-to-true succeeded as a genuine transition). This scenario's own
# assertion below hardcodes an expectation that g1g2.enabled reads 'false'
# while A is blocked at g3_observation -- that expectation is only valid if
# g1g2 is reset to a known-disabled state first, independent of AC-66(a)'s
# ending state. The reviewed baseline relied on AC-66(a) never having run,
# or coincidentally leaving g1g2 disabled, rather than establishing this
# explicitly.
run_sql "SELECT outcome FROM cbr_internal.cbr_toggle_gate('g1g2', false, (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin'));" > /dev/null
G1G2_STATE=$(run_sql "SELECT enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g1g2';")
[ "${G1G2_STATE// /}" = "f" ] || { echo "FAIL: AC-66(b) precondition: expected g1g2 reset to a known-disabled state, actual enabled='${G1G2_STATE}'" >&2; exit 1; }
echo "[PASS] AC-66(b)-precondition (g1g2 explicitly reset to disabled, independent of AC-66(a)'s ending state)"
# Corrected this round: resetting g1g2 above does not reset g3_observation
# -- g3_observation has been TRUE since AC-63's resolution, and nothing
# between there and here disables it. A's toggle-to-true request below
# would therefore be a NO_CHANGE against the reviewed baseline's fixture,
# not the genuine TOGGLED transition this scenario asserts. Chosen: a
# genuine transition (preserves the original TOGGLED assertion and the
# partial-lock-acquisition scenario as designed) -- forced and verified
# explicitly, not assumed.
run_sql "SELECT outcome FROM cbr_internal.cbr_toggle_gate('g3_observation', false, (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin'));" > /dev/null
G3_OBS_STATE=$(run_sql "SELECT enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g3_observation';")
[ "${G3_OBS_STATE// /}" = "f" ] || { echo "FAIL: AC-66(b) precondition: expected g3_observation forced to a known-disabled state, actual enabled='${G3_OBS_STATE}'" >&2; exit 1; }
echo "[PASS] AC-66(b)-precondition-g3_observation (g3_observation forced to a known-disabled state; A's toggle-to-true below is therefore guaranteed a genuine TOGGLED transition, not NO_CHANGE)"
open_session HOLDER2
send HOLDER2 "BEGIN; SELECT enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g3_observation' FOR UPDATE; SELECT 'H2_LOCKS_OBS';"
wait_for HOLDER2 H2_LOCKS_OBS
open_session A
send A "SELECT 'RESULT:' || outcome FROM cbr_internal.cbr_toggle_gate('g3_observation', true, (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin')); SELECT 'A_TOGGLE_ATTEMPTED';"
# Corrected this round (item 3): explicitly proves A is waiting BEHIND
# HOLDER2 -- backend pid + pg_blocking_pids, not merely inferred from the
# row-specific probes below -- BEFORE HOLDER2 is ever released.
assert_pg_waiting A "$HOLDER2_BPID"
# IC Finding 6.6 / residual correction (AC-66): every claim below is a
# hard, row-specific assertion, not a relation-level count and not merely
# printed -- proving (i) A itself holds a GRANTED lock on g1g2's row
# specifically (probed from a THIRD, independent connection -- if A did
# not hold it, the probe would succeed immediately instead of failing),
# (ii) A is simultaneously genuinely waiting on g3_observation specifically
# (that row is independently known to be held by HOLDER2, confirmed above),
# and (iii) g1g2.enabled has NOT mutated while A is blocked.
assert_row_locked cbr_internal.cbr_field_gate_state gate "'g1g2'" "AC-66(b)-g1g2-held-by-A"
assert_row_locked cbr_internal.cbr_field_gate_state gate "'g3_observation'" "AC-66(b)-g3_observation-held-by-holder2"
assert_row_free cbr_internal.cbr_field_gate_state gate "'g3_staff_resolution'" "AC-66(b)-g3_staff_resolution-free"
G1G2_ENABLED_BEFORE=$(run_sql "SELECT enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g1g2';")
G1G2_ENABLED_BEFORE="${G1G2_ENABLED_BEFORE// /}"
[ "$G1G2_ENABLED_BEFORE" = "f" ] || { echo "FAIL: AC-66(b): expected g1g2.enabled to remain unchanged (false) while A is blocked at g3_observation, actual '$G1G2_ENABLED_BEFORE'" >&2; exit 1; }
echo "[PASS] AC-66(b) (g1g2 row-locked -- by A, since HOLDER2 never touches it; g3_observation row-locked -- by HOLDER2; g3_staff_resolution free; g1g2.enabled unchanged=$G1G2_ENABLED_BEFORE)"
send HOLDER2 "COMMIT;"
wait_for A A_TOGGLE_ATTEMPTED
assert_marker_result A A_TOGGLE_ATTEMPTED RESULT TOGGLED "AC-66(b) (A's final outcome after HOLDER2 releases)"
close_session A; close_session HOLDER2

echo "--- AC-66 scenario (c): a competing toggle transaction holds the SAME fixed-order locks; the requesting toggle queues behind it at the first contended row and resumes only after the holder ends ---"
# Corrected this round (item 3): the reviewed baseline sent
# "... \; SELECT 1 WHERE outcome='NO_CHANGE'; ..." as one escaped string --
# `\\;` in the bash double-quoted string becomes the literal bytes `\;`,
# which psql (reading interactively from the FIFO) rejects as an unknown
# meta-command, and the following bare `SELECT 1 WHERE outcome='NO_CHANGE'`
# references `outcome` with no FROM source in scope at all (it is not a
# session variable) -- both would error before HOLDER3 ever reaches its own
# BEGIN. Replaced with the same TAG:/marker pattern used everywhere else in
# this suite, split across two `wait_for` points so the toggle's own result
# is actually captured and asserted, not merely referenced.
#
# g1g2 is guaranteed already disabled entering this scenario (AC-66(b)'s
# precondition reset it to false, and AC-66(b) itself never mutates g1g2 --
# A there only reads/locks it en route to g3_observation), so this
# toggle-to-false call is itself necessarily NO_CHANGE, asserted explicitly
# below rather than assumed.
open_session HOLDER3
send HOLDER3 "SELECT 'TAG:' || outcome FROM cbr_internal.cbr_toggle_gate('g1g2', false, (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin')); SELECT 'H3_TOGGLE_ATTEMPTED';"
wait_for HOLDER3 H3_TOGGLE_ATTEMPTED
assert_marker_result HOLDER3 H3_TOGGLE_ATTEMPTED TAG NO_CHANGE "AC-66(c) (HOLDER3's own g1g2 prerequisite toggle -- NO_CHANGE, since g1g2 is guaranteed already disabled per AC-66(b)'s precondition)"
send HOLDER3 "BEGIN; SELECT gate FROM cbr_internal.cbr_field_gate_state WHERE gate IN ('g1g2','g3_observation','g3_staff_resolution') ORDER BY gate FOR UPDATE; SELECT 'H3_HOLDS_ALL';"
wait_for HOLDER3 H3_HOLDS_ALL
# Row-specific confirmation that HOLDER3 genuinely holds ALL THREE gate
# rows (not merely "some lock on the relation") before A ever starts.
assert_row_locked cbr_internal.cbr_field_gate_state gate "'g1g2'" "AC-66(c)-g1g2-held-by-holder3"
assert_row_locked cbr_internal.cbr_field_gate_state gate "'g3_observation'" "AC-66(c)-g3_observation-held-by-holder3"
assert_row_locked cbr_internal.cbr_field_gate_state gate "'g3_staff_resolution'" "AC-66(c)-g3_staff_resolution-held-by-holder3"
open_session A
send A "SELECT 'RESULT:' || outcome FROM cbr_internal.cbr_toggle_gate('g1g2', true, (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin')); SELECT 'A_TOGGLE_ATTEMPTED';"
# IC Finding 5.1: HOLDER3 is A's explicitly identified expected blocker.
assert_pg_waiting A "$HOLDER3_BPID"
send HOLDER3 "COMMIT;"
wait_for A A_TOGGLE_ATTEMPTED
assert_marker_result A A_TOGGLE_ATTEMPTED RESULT TOGGLED "AC-66(c) (A's outcome after HOLDER3 releases)"
close_session A; close_session HOLDER3

echo ""
echo "############################################"
echo "# AC-64 prerequisite — re-establish compound G3 admission"
echo "############################################"
# Explicit prerequisite (item 2): AC-65 above legitimately leaves
# g3_staff_resolution DISABLED (that is the actual, intended point of AC-65
# -- B's toggle-to-false is a genuine transition). AC-64a/b/c below all
# call cbr_tx02_observe_g3, which requires BOTH g3_observation AND
# g3_staff_resolution enabled to pass STEP 1's compound gate check at all;
# left as the reviewed baseline had it, every AC-64 TX-02 call below would
# short-circuit to DISABLED instead of reaching the outcomes these
# scenarios exist to prove. Re-toggled and the RESULTING state verified
# here -- not assumed -- regardless of whether either call is itself
# TOGGLED or NO_CHANGE.
run_sql "SELECT outcome FROM cbr_internal.cbr_toggle_gate('g3_observation', true, (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin'));" > /dev/null
run_sql "SELECT outcome FROM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin'));" > /dev/null
G3_OBS=$(run_sql "SELECT enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g3_observation';")
G3_STAFF=$(run_sql "SELECT enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g3_staff_resolution';")
[ "${G3_OBS// /}" = "t" ] || { echo "FAIL: AC-64 prerequisite: g3_observation must be enabled, actual '${G3_OBS}'" >&2; exit 1; }
[ "${G3_STAFF// /}" = "t" ] || { echo "FAIL: AC-64 prerequisite: g3_staff_resolution must be enabled (AC-65 above left it disabled), actual '${G3_STAFF}'" >&2; exit 1; }
echo "[PASS] AC-64-prerequisite (g3_observation=true, g3_staff_resolution=true -- explicitly re-established and verified, not assumed, regardless of AC-65's ending state)"

echo ""
echo "############################################"
echo "# AC-64a — TRUE two-session concurrency: same-submission replay"
echo "############################################"
run_sql "
DO \$\$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID;
BEGIN
  v_admin := (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin');
  v_client := cbr_test.make_client(); v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac64a@example.invalid', v_admin);
  -- Corrected this round: the reviewed baseline used 'firstName'/'givenName',
  -- but cbr_test.make_client() supplies NOT NULL first_name/last_name
  -- ('CBRTest'/'Client') -- canonical firstName is never absent, so a
  -- fresh, differing candidate against it would actually reach CONFLICT,
  -- not this scenario's intended first-ever OBSERVED. Switched to
  -- middleName (nullable, absent by default) -- the fixture now matches
  -- its own intended acceptance case instead of the outcome being adjusted
  -- to fit the wrong fixture.
  IF (SELECT middle_name FROM public.clients WHERE id = v_client) IS NOT NULL THEN
    RAISE EXCEPTION 'AC-64a precondition failed: expected canonical middle_name to be absent (NULL) for a fresh make_client() fixture';
  END IF;
  -- IC Finding 5.1: anchor to now(), not a hardcoded past date -- the g3_observation
  -- window was opened earlier in this script at real clock_timestamp(); a hardcoded
  -- historical submitted_at would force ADMISSION_BOUNDARY instead of OBSERVED.
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('AC64aName')), now());
  INSERT INTO cbr_test.fixture VALUES ('ac64a_s1', v_s1::TEXT), ('ac64a_client', v_client::TEXT) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
END \$\$;
SELECT 'FIXTURE_READY';
"
open_session A; open_session B
send A "BEGIN;"
send A "SELECT 'RESULT:' || outcome || ':' || observation_id FROM public.cbr_tx02_observe_g3((SELECT v::UUID FROM cbr_test.fixture WHERE k='ac64a_s1'), 'middleName'); SELECT 'A_HOLDING';"
wait_for A A_HOLDING
send B "SELECT 'RESULT:' || outcome || ':' || observation_id FROM public.cbr_tx02_observe_g3((SELECT v::UUID FROM cbr_test.fixture WHERE k='ac64a_s1'), 'middleName'); SELECT 'B_ATTEMPTED';"
# IC Finding 5.1: A is B's explicitly identified expected blocker -- the
# required waiting relationship: B queues on the shared serialization
# point (clients), after the compatible gate/submission locks.
assert_pg_waiting B "$A_BPID"
echo "--- transaction order: A commits FIRST (real writer), B resumes SECOND (replay) ---"
send A "COMMIT;"
wait_for B B_ATTEMPTED
A_RESULT=$(result_before_marker A A_HOLDING); A_RESULT="${A_RESULT#RESULT:}"
B_RESULT=$(result_before_marker B B_ATTEMPTED); B_RESULT="${B_RESULT#RESULT:}"
[ "${A_RESULT%%:*}" = "OBSERVED" ] || { echo "FAIL: AC-64a: A expected OBSERVED (fresh write), actual '$A_RESULT'" >&2; exit 1; }
[ "${B_RESULT%%:*}" = "OBSERVED" ] || { echo "FAIL: AC-64a: B expected OBSERVED (replay), actual '$B_RESULT'" >&2; exit 1; }
[ "${A_RESULT#*:}" = "${B_RESULT#*:}" ] || { echo "FAIL: AC-64a: B's replay must return the SAME observation_id as A's fresh write; A='${A_RESULT#*:}' B='${B_RESULT#*:}'" >&2; exit 1; }
echo "[PASS] AC-64a (A=OBSERVED fresh write, B=OBSERVED replay, same observation_id=${A_RESULT#*:})"
CANDIDATE_ROWS=$(run_sql "SELECT count(*) FROM public.canonical_beneficiary_records WHERE source_submission_id=(SELECT v::UUID FROM cbr_test.fixture WHERE k='ac64a_s1');")
[ "${CANDIDATE_ROWS// /}" = "1" ] || { echo "FAIL: AC-64a: expected exactly 1 persisted CANDIDATE_OBSERVED row, actual '${CANDIDATE_ROWS// /}'" >&2; exit 1; }
GOV_SUB=$(run_sql "SELECT governing_submission_id FROM cbr_internal.cbr_field_processing_state WHERE client_id=(SELECT v::UUID FROM cbr_test.fixture WHERE k='ac64a_client') AND field_key='middleName';")
S1_ID=$(run_sql "SELECT v FROM cbr_test.fixture WHERE k='ac64a_s1';")
[ "${GOV_SUB// /}" = "${S1_ID// /}" ] || { echo "FAIL: AC-64a: expected governing_submission_id=s1, actual '${GOV_SUB// /}' vs s1='${S1_ID// /}'" >&2; exit 1; }
echo "[PASS] AC-64a-persistence (exactly 1 candidate row; governing submission = s1)"
close_session A; close_session B

echo ""
echo "############################################"
echo "# AC-64b — TRUE two-session concurrency: distinct submissions, equal values (corroborating OBSERVED, not replay/STALE)"
echo "############################################"
run_sql "
DO \$\$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_s2 UUID; v_t0 TIMESTAMPTZ;
BEGIN
  v_admin := (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin');
  v_client := cbr_test.make_client(); v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac64b@example.invalid', v_admin);
  -- Corrected this round: switched 'firstName'/'givenName' to 'middleName',
  -- same reason as AC-64a above -- canonical firstName is never absent
  -- against make_client()'s fixed 'CBRTest' value, so a differing candidate
  -- there would actually reach CONFLICT, not this scenario's intended
  -- first-ever-then-corroborating OBSERVED/OBSERVED.
  IF (SELECT middle_name FROM public.clients WHERE id = v_client) IS NOT NULL THEN
    RAISE EXCEPTION 'AC-64b precondition failed: expected canonical middle_name to be absent (NULL) for a fresh make_client() fixture';
  END IF;
  -- IC Finding 5.1: anchor to now(), not a hardcoded past date (see AC-64a comment above).
  v_t0 := now();
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('AC64bSame')), v_t0);
  v_s2 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('AC64bSame')), v_t0 + interval '5 seconds');
  INSERT INTO cbr_test.fixture VALUES ('ac64b_s1', v_s1::TEXT), ('ac64b_s2', v_s2::TEXT), ('ac64b_client', v_client::TEXT) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
END \$\$;
SELECT 'FIXTURE_READY';
"
open_session A; open_session B
send A "BEGIN;"
send A "SELECT 'RESULT:' || outcome || ':' || observation_id FROM public.cbr_tx02_observe_g3((SELECT v::UUID FROM cbr_test.fixture WHERE k='ac64b_s1'), 'middleName'); SELECT 'A_HOLDING';"
wait_for A A_HOLDING
send B "SELECT 'RESULT:' || outcome || ':' || observation_id FROM public.cbr_tx02_observe_g3((SELECT v::UUID FROM cbr_test.fixture WHERE k='ac64b_s2'), 'middleName'); SELECT 'B_ATTEMPTED';"
# IC Finding 5.1: A is B's explicitly identified expected blocker.
assert_pg_waiting B "$A_BPID"
echo "--- transaction order: A (S1, first-ever) commits first; B (S2, distinct submission, newer, equal value) resumes second ---"
send A "COMMIT;"
wait_for B B_ATTEMPTED
A_RESULT=$(result_before_marker A A_HOLDING); A_RESULT="${A_RESULT#RESULT:}"
B_RESULT=$(result_before_marker B B_ATTEMPTED); B_RESULT="${B_RESULT#RESULT:}"
[ "${A_RESULT%%:*}" = "OBSERVED" ] || { echo "FAIL: AC-64b: A expected OBSERVED, actual '$A_RESULT'" >&2; exit 1; }
[ "${B_RESULT%%:*}" = "OBSERVED" ] || { echo "FAIL: AC-64b: B expected OBSERVED, actual '$B_RESULT'" >&2; exit 1; }
[ "${A_RESULT#*:}" != "${B_RESULT#*:}" ] || { echo "FAIL: AC-64b: A and B must produce DISTINCT observation_ids (distinct submissions, not a replay), both were '${A_RESULT#*:}'" >&2; exit 1; }
echo "[PASS] AC-64b (A=OBSERVED id=${A_RESULT#*:}, B=OBSERVED id=${B_RESULT#*:}, distinct)"
COUNTS=$(run_sql "SELECT count(*) || '|' || count(DISTINCT id) FROM public.canonical_beneficiary_records WHERE client_id=(SELECT v::UUID FROM cbr_test.fixture WHERE k='ac64b_client') AND field_key='middleName';")
COUNTS="${COUNTS// /}"
[ "$COUNTS" = "2|2" ] || { echo "FAIL: AC-64b: expected 2 rows / 2 distinct ids, actual '$COUNTS'" >&2; exit 1; }
MIDDLE_NAME=$(run_sql "SELECT middle_name FROM public.clients WHERE id=(SELECT v::UUID FROM cbr_test.fixture WHERE k='ac64b_client');")
[ -z "${MIDDLE_NAME// /}" ] || { echo "FAIL: AC-64b: expected canonical middle_name to remain NULL/absent (G3 never auto-realizes canonical, even after two OBSERVED calls), actual '${MIDDLE_NAME}'" >&2; exit 1; }
GOV_SUB=$(run_sql "SELECT governing_submission_id FROM cbr_internal.cbr_field_processing_state WHERE client_id=(SELECT v::UUID FROM cbr_test.fixture WHERE k='ac64b_client') AND field_key='middleName';")
S2_ID=$(run_sql "SELECT v FROM cbr_test.fixture WHERE k='ac64b_s2';")
[ "${GOV_SUB// /}" = "${S2_ID// /}" ] || { echo "FAIL: AC-64b: expected governing_submission_id=s2 (the newer of the two), actual '${GOV_SUB// /}' vs s2='${S2_ID// /}'" >&2; exit 1; }
echo "[PASS] AC-64b-persistence (2 candidate rows, 2 distinct ids; canonical middle_name unchanged (absent); governing submission = s2)"
close_session A; close_session B

echo ""
echo "############################################"
echo "# AC-64c true-concurrency NO_OP variant"
echo "############################################"
run_sql "
DO \$\$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID;
BEGIN
  v_admin := (SELECT v::UUID FROM cbr_test.fixture WHERE k='admin');
  v_client := cbr_test.make_client();
  UPDATE public.clients SET middle_name = 'AC64Same' WHERE id = v_client;
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac64@example.invalid', v_admin);
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('middleName', cbr_test.sp_field('AC64Same')));
  INSERT INTO cbr_test.fixture VALUES ('ac64_s1', v_s1::TEXT), ('ac64_client', v_client::TEXT) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
END \$\$;
SELECT 'FIXTURE_READY';
"
open_session A; open_session B
send A "BEGIN;"
send A "SELECT outcome FROM public.cbr_tx02_observe_g3((SELECT v::UUID FROM cbr_test.fixture WHERE k='ac64_s1'), 'middleName'); SELECT 'A_NOOP_HOLDING';"
wait_for A A_NOOP_HOLDING
send B "SELECT 'RESULT:' || outcome FROM public.cbr_tx02_observe_g3((SELECT v::UUID FROM cbr_test.fixture WHERE k='ac64_s1'), 'middleName'); SELECT 'B_ATTEMPTED';"
# IC Finding 5.1: A is B's explicitly identified expected blocker.
assert_pg_waiting B "$A_BPID"
send A "COMMIT;"
wait_for B B_ATTEMPTED
assert_marker_result B B_ATTEMPTED RESULT NO_OP "AC-64c (B's outcome, via forced re-evaluation, not replay)"
CANDIDATE_ROWS=$(run_sql "SELECT count(*) FROM public.canonical_beneficiary_records WHERE source_submission_id = (SELECT v::UUID FROM cbr_test.fixture WHERE k='ac64_s1');")
[ "${CANDIDATE_ROWS// /}" = "0" ] || { echo "FAIL: AC-64c: expected 0 CANDIDATE_OBSERVED rows (NO_OP, no candidate persisted), actual '${CANDIDATE_ROWS// /}'" >&2; exit 1; }
MIDDLE_NAME=$(run_sql "SELECT middle_name FROM public.clients WHERE id = (SELECT v::UUID FROM cbr_test.fixture WHERE k='ac64_client');")
[ "${MIDDLE_NAME// /}" = "AC64Same" ] || { echo "FAIL: AC-64c: expected canonical middle_name unchanged ('AC64Same'), actual '${MIDDLE_NAME}'" >&2; exit 1; }
echo "[PASS] AC-64c-persistence (0 candidate rows; canonical middle_name unchanged)"
close_session A; close_session B

echo ""
echo "All concurrency scripts completed their SCRIPTED assertions above. Restated: NONE of this has been executed in the implementing environment — no isolated database exists there. Every 'pass'/'fail' path shown is what the script WOULD report, contingent on a real run. Every assertion above is fatal under 'set -euo pipefail': reaching this line means every one of them actually held, or the script would have already aborted with a FAIL line on stderr."
