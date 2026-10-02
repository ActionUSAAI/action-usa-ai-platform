#!/usr/bin/env bash
# AC-58a / AC-58b — genuine two-session overlap: TX-02 (newer submission)
# racing TX-04 (approval) for the same pending DECISION, in both orders.
# Proves actual blocking at the clients row via assert_pg_waiting (IC
# Finding 5.1: wait_event_type='Lock' + expected blocker backend pid
# present in pg_blocking_pids() -- not a relation-name pg_locks join, which
# cannot see this row's actual ungranted-transactionid wait shape), not
# merely sequential outcomes, and parses+asserts the real outcomes (IC
# Finding 6.7) rather than only printing them for a human to eyeball.
#
# UNEXECUTED: written and statically reviewed only; never run. Requires
# Docker/Podman + `supabase start` + `psql` on PATH. See ../README.md.
set -euo pipefail
cd "$(dirname "$0")"
source lib.sh

run_sql "
\i ../00-helpers.sql
DO \$\$
DECLARE v_admin UUID; v_client UUID; v_case UUID; v_inv UUID; v_s1 UUID; v_s2 UUID; v_obs UUID; v_dec UUID; v_t0 TIMESTAMPTZ;
BEGIN
  v_admin := cbr_test.make_profile('admin');
  v_client := cbr_test.make_client();
  v_case := cbr_test.make_case(v_client);
  v_inv := cbr_test.make_invitation(v_case, v_client, 'ac58@example.invalid', v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_observation', true, v_admin);
  PERFORM cbr_internal.cbr_toggle_gate('g3_staff_resolution', true, v_admin);
  -- IC Finding 5.1: anchor to clock_timestamp() (captured after the gate toggles
  -- above), not a hardcoded past date -- otherwise submitted_at < window.opened_at
  -- whenever this script runs after the hardcoded date, forcing ADMISSION_BOUNDARY
  -- instead of the OBSERVED outcome this scenario intends to test.
  v_t0 := clock_timestamp();
  v_s1 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('dateOfBirth', cbr_test.sp_field('1990-01-01')), v_t0 + interval '1 minute');
  PERFORM public.cbr_tx02_observe_g3(v_s1, 'dateOfBirth'); -- OBSERVED -> O1
  SELECT id INTO v_obs FROM public.canonical_beneficiary_records WHERE source_submission_id = v_s1 AND record_type='CANDIDATE_OBSERVED';
  SELECT decision_id INTO v_dec FROM public.cbr_tx03_open_g3_review(v_obs, v_admin); -- D1 pending
  v_s2 := cbr_test.make_submission(v_client, v_case, v_inv, jsonb_build_object('dateOfBirth', cbr_test.sp_field('1990-01-02')), v_t0 + interval '31 minutes');
  -- Persist identifiers for the two racing sessions to pick up.
  CREATE TABLE IF NOT EXISTS cbr_test.ac58_fixture (k TEXT PRIMARY KEY, v TEXT);
  INSERT INTO cbr_test.ac58_fixture VALUES ('s2', v_s2::TEXT), ('dec', v_dec::TEXT)
    ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
END \$\$;
SELECT 'FIXTURE_READY';
"

echo "=== AC-58a: TX-02 acquires clients first; TX-04 waits, then resumes to ALREADY_RESOLVED ==="
# IC Finding 4.1 (corrected this round): v_s2 is a NEWER submission with a
# DIFFERING dateOfBirth value than v_s1's candidate, submitted WHILE D1
# (v_dec, opened against v_obs/v_s1's candidate) is still pending. Tracing
# TX-02's action table: this is the supersession branch (the same branch
# proven by AC-50 in finding-03-single-session-fixture-corrections.sql's
# Block A) -- a differing, newer candidate arriving while a pending
# decision references the current candidate produces CONFLICT (not
# first-ever OBSERVED) and marks the referenced decision 'superseded'. The
# reviewed baseline asserted OBSERVED here; that was wrong regardless of
# canonical dateOfBirth being absent, because the actual branch selector is
# "a pending decision already references the CURRENT candidate", not
# canonical presence.
open_session A
open_session B
send A "BEGIN;"
send A "SELECT 'RESULT:' || outcome FROM public.cbr_tx02_observe_g3((SELECT v::UUID FROM cbr_test.ac58_fixture WHERE k='s2'), 'dateOfBirth'); SELECT 'A_TX02_DONE_HOLDING';"
wait_for A A_TX02_DONE_HOLDING
send B "SELECT 'RESULT:' || outcome FROM public.cbr_tx04_approve_g3((SELECT v::UUID FROM cbr_test.ac58_fixture WHERE k='dec'), (SELECT id FROM public.profiles WHERE role='admin' LIMIT 1), NULL); SELECT 'B_TX04_ATTEMPTED';"
# IC Finding 5.1: replaces the invalid "wait_event_type IS NOT NULL +
# relation-name pg_locks join" detector (which would have falsely passed
# on an idle 'Client'-wait, and would have found no row at all for this
# genuine row-lock case, since clients-row contention is represented as an
# ungranted 'transactionid' wait, not a relation-level lock) with bounded
# polling that proves wait_event_type='Lock' AND A's real backend pid is
# present in pg_blocking_pids(B's backend pid) -- B is waiting, name A
# explicitly as B's expected blocker: A holds the clients row via TX-02's
# STEP 6 lock, inside its still-open transaction.
assert_pg_waiting B "$A_BPID"
send A "COMMIT;"
wait_for B B_TX04_ATTEMPTED
assert_marker_result A A_TX02_DONE_HOLDING RESULT CONFLICT "AC-58a (A/TX-02 outcome -- v_s2 differs from the CURRENT candidate while D1 is pending on it: supersession branch, corrected from the reviewed baseline's incorrect OBSERVED expectation)"
assert_marker_result B B_TX04_ATTEMPTED RESULT ALREADY_RESOLVED "AC-58a (B/TX-04 outcome after A commits -- D1 is no longer 'pending' once A's supersession lands, regardless of A's specific outcome)"
close_session A; close_session B

# Final database invariant (item 4: check resulting state, not only the
# returned outcome): A's supersession must actually have transitioned D1
# to 'superseded' -- this is the state fact that explains WHY B's TX-04
# reaches ALREADY_RESOLVED rather than the specific outcome value alone.
DEC_STATE=$(run_sql "SELECT decision_state FROM public.canonical_beneficiary_records WHERE id = (SELECT v::UUID FROM cbr_test.ac58_fixture WHERE k='dec');")
[ "${DEC_STATE// /}" = "superseded" ] || { echo "FAIL: AC-58a: expected D1 (original decision) to have transitioned to 'superseded' once A's differing, newer candidate was observed while D1 was pending, actual '${DEC_STATE}'" >&2; exit 1; }
echo "[PASS] AC-58a-decision-superseded (decision_state=superseded)"

echo "AC-58b is the mirror order (TX-04 first, TX-02 second) — see"
echo "ac-lockorder-and-concurrency.sh's own 'AC-58b' scenario, which scripts"
echo "and asserts that order directly; not duplicated here."
