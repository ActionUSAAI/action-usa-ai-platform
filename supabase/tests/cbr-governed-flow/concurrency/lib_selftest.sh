#!/usr/bin/env bash
# lib_selftest.sh -- MOCKED PROCESS TESTS ONLY. No PostgreSQL connection is
# made, attempted, or required anywhere in this file. It verifies the pure
# shell-level session-lifecycle mechanics added/repaired in lib.sh this
# round (descriptor closure, session-name reuse, premature child-exit
# detection, failure-triggered cleanup, and exit-status preservation
# through the EXIT trap) against plain mock background processes (`sleep`),
# NOT real psql/database sessions.
#
# THIS FILE IS ACTUALLY EXECUTED as part of this delivery's validation --
# unlike every ac*.sh script in this directory, which requires a live
# Postgres instance this environment does not have. Its PASS/FAIL/SKIP
# lines are real, local, just-produced results, not a static trace. It
# proves nothing about pg_blocking_pids(), wait_event_type, NOWAIT-probe
# behavior against a real lock, or any database outcome -- those remain
# PostgreSQL-execution-dependent and are separately, explicitly marked NOT
# EXECUTED in this delivery's README.
#
# lib.sh itself requires bash >= 4.1 (`exec {var}>...` auto-fd allocation,
# `declare -A` associative arrays). This script's OWN mechanics (tests 1-3
# below) are written to run under bash >= 3.2 so they can execute
# regardless of which bash is on PATH in a given environment; tests 4-6,
# which exercise lib.sh's own sourced functions directly (including a mock
# `psql` session for the close_session graceful-window regression, item 4
# -- see mock_psql_session_for_tests.sh), SKIP (clearly reported, not
# silently, and not counted as a failure) if the running bash does not
# meet lib.sh's own minimum version.
set -uo pipefail
cd "$(dirname "$0")"

PASS=0
FAIL=0
SKIP=0

check() {
  local label="$1" cond="$2"
  if eval "$cond"; then
    echo "[PASS] $label"
    PASS=$((PASS+1))
  else
    echo "[FAIL] $label" >&2
    FAIL=$((FAIL+1))
  fi
}

skip() {
  echo "[SKIP] $1"
  SKIP=$((SKIP+1))
}

TESTDIR="$(mktemp -d)"
trap 'rm -rf "$TESTDIR"' EXIT

echo "=== 1. Descriptor closure: reproduce the reported bug, then verify the fix ==="
echo "(uses an explicit, plain-numbered fd -- not bash 4.1's {name} auto-allocation --"
echo " so this test runs under any bash >= 3.2, independent of lib.sh's own minimum version)"

# Reproduce the ORIGINAL reported bug entirely inside its OWN, fully
# isolated subshell -- discovered empirically while writing this test: the
# failed `exec {N}>&-` attempt has a side effect on bash 3.2 that corrupts
# the CURRENT shell's own file-descriptor table beyond just the descriptor
# being closed (bash tries to interpret the malformed redirection target
# and, failing, appears to disturb unrelated descriptor state) -- so the
# reproduction must never share a shell with the later "verify the fix"
# steps, or it would falsify them. A subshell contains that side effect
# completely.
BUG_ERR=$( (
  exec 9> "$TESTDIR/bug.out"
  eval "exec {9}>&-"
) 2>&1 1>/dev/null )
BUG_STATUS=$?
check "reproduces the reported bug (non-zero exit / 'not found'-style error on {N}>&-)" '[ $BUG_STATUS -ne 0 ] && [ -n "$BUG_ERR" ]'
echo "  (reproduction stderr: $BUG_ERR)"

# Verify the FIX: plain numeric close, no braces -- exactly what
# close_session now does (`exec ${!fd_var}>&-`). Run DIRECTLY in this
# shell, not inside a command substitution -- `$( ... )` itself forks a
# subshell, and a close performed there would not persist back into this
# shell, which would make the write-after-close check below meaningless
# (it would still succeed, having never actually observed a real close).
exec 8> "$TESTDIR/fix.out"
FIX_ERR_FILE="$TESTDIR/fix_err.txt"
eval "exec 8>&-" 2>"$FIX_ERR_FILE"
FIX_STATUS=$?
FIX_ERR="$(cat "$FIX_ERR_FILE" 2>/dev/null)"
check "fixed form (no braces) closes with exit 0 and no stderr" '[ $FIX_STATUS -eq 0 ] && [ -z "$FIX_ERR" ]'
# Confirm it is GENUINELY closed: a further write to the same descriptor
# number must now fail. This IS run in a subshell -- deliberately, so a
# failed write attempt cannot itself disturb this shell's own fd table --
# but that is safe here because the CLOSE itself (above) already happened
# in this shell, not inside this subshell.
WRITE_AFTER_CLOSE_FAILED=0
( eval "echo test >&8" ) 2>/dev/null || WRITE_AFTER_CLOSE_FAILED=1
check "descriptor is genuinely closed (a write after closing fails)" '[ "$WRITE_AFTER_CLOSE_FAILED" -eq 1 ]'

echo ""
echo "=== 2. Session-name reuse (mkfifo must not fail 'File exists' on reopen) ==="
FIFO="$TESTDIR/reuse.fifo"
mkfifo "$FIFO"
FIRST_MKFIFO_OK=$?
rm -f "$FIFO"
mkfifo "$FIFO" 2>/dev/null
SECOND_MKFIFO_OK=$?
check "FIFO can be removed and recreated under the same name (open_session's own remove-then-mkfifo pattern)" '[ "$FIRST_MKFIFO_OK" -eq 0 ] && [ "$SECOND_MKFIFO_OK" -eq 0 ]'
rm -f "$FIFO"

echo ""
echo "=== 3. Premature child-exit detection (mocked process, no psql) ==="
( sleep 0.1 ) &
MOCK_PID=$!
sleep 0.4
STILL_ALIVE=1
kill -0 "$MOCK_PID" 2>/dev/null || STILL_ALIVE=0
check "mock process has exited on its own (precondition for the next check)" '[ "$STILL_ALIVE" -eq 0 ]'
# This is precisely the check wait_for's poll loop now performs on every
# tick (kill -0 "$pid") to distinguish premature termination from an
# ordinary still-waiting-for-the-marker state.
DETECTED=0
kill -0 "$MOCK_PID" 2>/dev/null || DETECTED=1
check "premature-exit detection (kill -0) correctly identifies the dead process" '[ "$DETECTED" -eq 1 ]'
wait "$MOCK_PID" 2>/dev/null || true

echo ""
echo "=== 4-6. lib.sh's own functions: terminate_and_reap, exit-status preservation, close_session graceful window ==="
BASH_MAJOR="${BASH_VERSINFO[0]}"
BASH_MINOR="${BASH_VERSINFO[1]}"
LIBSH_COMPATIBLE=1
if [ "$BASH_MAJOR" -lt 4 ] || { [ "$BASH_MAJOR" -eq 4 ] && [ "$BASH_MINOR" -lt 1 ]; }; then
  LIBSH_COMPATIBLE=0
fi

if [ "$LIBSH_COMPATIBLE" -eq 0 ]; then
  skip "terminate_and_reap actually terminates a live mock process -- this shell is bash ${BASH_VERSION}, lib.sh requires >= 4.1 and refuses to load (verified: lib.sh's own new version guard is what makes this SKIP, not a silent failure -- see the sourcing attempt below)"
  skip "EXIT trap preserves the ORIGINAL failure status through cleanup -- same reason"
  skip "close_session allows in-flight queued work to complete before closing (mock session, item 4) -- same reason"
  # Prove the SKIP reason itself is real, not asserted: attempt the source
  # in a subshell (so a failure/exit there cannot terminate THIS script)
  # and show lib.sh's own guard is what rejects it.
  SOURCE_ATTEMPT_OUTPUT=$( ( source ./lib.sh ) 2>&1 )
  SOURCE_ATTEMPT_STATUS=$?
  echo "  (verified: sourcing lib.sh in this shell exits ${SOURCE_ATTEMPT_STATUS} with: ${SOURCE_ATTEMPT_OUTPUT})"
  check "lib.sh's own bash-version guard is what rejects this shell (not an unrelated error)" '[ "$SOURCE_ATTEMPT_STATUS" -eq 1 ] && [[ "$SOURCE_ATTEMPT_OUTPUT" == *"requires bash >= 4.1"* ]]'
else
  # Corrected this round: `terminate_and_reap` now takes <pid> <pgid>
  # <label> (see lib.sh) because a plain `cmd &`/`( cmd ) &` backgrounded
  # from a shell WITHOUT job control active does NOT get its own pgid --
  # it inherits the CALLING shell's pgid instead (confirmed empirically).
  # `set -m`/`set +m`, narrowly scoped to just this one backgrounding
  # statement, is required here for the SAME reason it is now required in
  # lib.sh's own run_bounded/open_session -- without it, this mock would
  # not have a genuine, distinct pgid, and the termination check below
  # would silently degrade into `wait`-ing out the mock's own natural
  # duration instead of proving prompt, forced termination (reproduced
  # directly: without this fix, this exact test still reported [PASS],
  # but only because `wait` blocked for the mock's FULL 100s lifetime
  # first -- a coincidental pass that verified nothing about promptness).
  set -m
  ( sleep 100 ) &
  LIVE_PID=$!
  set +m
  LIVE_PGID=$(ps -o pgid= -p "$LIVE_PID" 2>/dev/null | tr -d ' ')
  [ -n "$LIVE_PGID" ] || LIVE_PGID="$LIVE_PID"
  LIVE_BEFORE=1
  kill -0 "$LIVE_PID" 2>/dev/null || LIVE_BEFORE=0
  check "mock long-lived process is alive before cleanup" '[ "$LIVE_BEFORE" -eq 1 ]'
  # Source lib.sh in THIS shell so terminate_and_reap is defined here.
  # lib.sh itself sets `set -euo pipefail`, which would break this script's
  # own continue-past-failures check() test-runner loop below -- restored
  # immediately after sourcing. Sourcing ALSO installs lib.sh's own EXIT
  # trap (cleanup_all_sessions), replacing (bash traps do not stack) this
  # script's earlier `trap ... EXIT` for $TESTDIR -- replaced here with a
  # combined handler that does both, using the identical
  # capture-$?-first/re-exit-with-it pattern test 5 below verifies.
  # shellcheck disable=SC1091
  source ./lib.sh
  set +e
  combined_selftest_cleanup() {
    local exit_status=$?
    local pid
    for pid in "${!ACTIVE_SESSION_PIDS[@]}"; do
      terminate_and_reap "$pid" "${ACTIVE_SESSION_PIDS[$pid]}" "tracked session pid=$pid" || true
    done
    rm -rf "$WORKDIR" "$TESTDIR"
    exit "$exit_status"
  }
  trap combined_selftest_cleanup EXIT

  TERMINATE_START=$SECONDS
  terminate_and_reap "$LIVE_PID" "$LIVE_PGID" "mock long-lived process" >/dev/null 2>&1
  TERMINATE_ELAPSED=$((SECONDS - TERMINATE_START))
  LIVE_AFTER=1
  kill -0 "$LIVE_PID" 2>/dev/null || LIVE_AFTER=0
  check "terminate_and_reap actually terminates the mock process (verified via kill -0, not merely 'TERM was sent')" '[ "$LIVE_AFTER" -eq 0 ]'
  check "termination was PROMPT (well under the mock's own 100s natural lifetime, not a coincidental wait-it-out pass); actual elapsed ${TERMINATE_ELAPSED}s" '[ "$TERMINATE_ELAPSED" -le 5 ]'

  # Sources lib.sh in a SEPARATE subshell (its own EXIT trap fires
  # independently) and deliberately exits 42. Without the fix (capturing
  # $? as the trap's first statement and re-exiting with it), the trap's
  # own final command (rm -rf, which normally succeeds) would make the
  # subshell exit 0 instead -- silently turning a failed assertion into an
  # apparent success. Real regression test of that exact defect.
  ( source ./lib.sh; exit 42 )
  PRESERVED_STATUS=$?
  check "deliberate exit 42 survives the EXIT trap's own cleanup work" '[ "$PRESERVED_STATUS" -eq 42 ]'
  ( source ./lib.sh; exit 0 )
  PRESERVED_ZERO=$?
  check "deliberate exit 0 also survives unchanged (not a fluke of always re-exiting nonzero)" '[ "$PRESERVED_ZERO" -eq 0 ]'

  echo ""
  echo "=== 6. close_session allows in-flight queued work to complete before closing (mock session, item 4) ==="
  echo "(exercises the REAL open_session/send/wait_for/close_session path against a mock psql"
  echo " that simulates a slow, in-flight query -- not isolated shell primitives)"
  MOCKSESHDIR="$(mktemp -d)"
  cp ./mock_psql_session_for_tests.sh "$MOCKSESHDIR/psql"
  chmod +x "$MOCKSESHDIR/psql"
  OLDPATH="$PATH"
  export PATH="$MOCKSESHDIR:$PATH"
  export MOCK_SLOW_MARKER="SLOW_WORK_DONE" MOCK_PROCESS_DELAY=1 MOCK_QUIT_DELAY=0

  open_session MOCKSESH
  check "mock session opened and resolved a (mock) backend pid via the real open_session handshake" '[ -n "${MOCKSESH_BPID:-}" ]'

  send MOCKSESH "SELECT 'SLOW_WORK_DONE:1';"
  # Request close IMMEDIATELY -- without waiting for the marker ourselves
  # first. The reviewed baseline sent \q, closed the descriptor, and
  # signaled TERM with zero grace period: the mock's 1s-delayed response
  # would never be produced before being killed. If close_session's new
  # bounded graceful window works, it absorbs that 1s and the queued
  # response is written to the log before the process is ever signaled.
  close_session MOCKSESH

  check "the queued, slow (1s-delayed) response was actually written to the session log before the process was terminated -- proves close_session's graceful window gave it the chance, not that it was cut off immediately" 'grep -q "SLOW_WORK_DONE:1" "$WORKDIR/MOCKSESH.out" 2>/dev/null'

  unset MOCK_SLOW_MARKER MOCK_PROCESS_DELAY MOCK_QUIT_DELAY
  export PATH="$OLDPATH"
  rm -rf "$MOCKSESHDIR"
fi

echo ""
echo "================================================================"
echo "MOCKED PROCESS TESTS ONLY -- no PostgreSQL connection was made or"
echo "required, and none of psql/pg_blocking_pids()/wait_event_type/the"
echo "NOWAIT-probe SQLSTATE path was exercised. These results verify"
echo "lib.sh's shell-level session-lifecycle mechanics only, against"
echo "plain background processes standing in for a session's client"
echo "process. Database-execution-dependent behavior remains NOT"
echo "EXECUTED -- see this delivery's README for the full list. SKIPped"
echo "checks (if any) mean THIS environment's bash is older than lib.sh"
echo "requires -- not that the underlying mechanic is unverified in a"
echo "bash >= 4.1 environment (tests 1-3 above are independent of that"
echo "requirement and always run)."
echo "================================================================"
echo "TOTAL: $PASS passed, $FAIL failed, $SKIP skipped (running bash ${BASH_VERSION})"
[ "$FAIL" -eq 0 ]
