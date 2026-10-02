#!/usr/bin/env bash
# mock_psql_for_tests.sh -- a mock stand-in for the real `psql` binary,
# used ONLY by this directory's shell-only regression tests (lib_selftest.sh,
# run_bounded_regression.sh) to exercise run_bounded/run_sql_bounded/
# probe_row_lockable/assert_pg_waiting's actual timeout, termination, and
# error-handling code paths WITHOUT any real PostgreSQL connection. Ignores
# every real psql argument (-v, -A, -q, -t, -c, the DB_URL positional,
# etc.) and instead behaves according to environment variables:
#
#   MOCK_PID_FILE      if set, this script's own PID is written there
#                       immediately, before anything else -- lets a test
#                       observe exactly which process was actually running,
#                       to verify it was later genuinely terminated.
#   MOCK_MODE          sleep | sleep_fork | sleep_fork_ignore_term | fail |
#                       success  (default: success)
#     sleep      -> `exec sleep "$MOCK_SLEEP_SECONDS"` -- becomes, via exec,
#                   the sleep process itself (same pid) -- faithfully
#                   mimics a real, single-process psql call that hangs,
#                   exactly as independently reproduced ("recorded its PID
#                   and then executed sleep").
#     sleep_fork -> spawns sleep as its OWN CHILD (not via exec) and writes
#                   the CHILD's pid to MOCK_CHILD_PID_FILE, then waits on
#                   it -- mimics a wrapped command that itself forks a
#                   descendant, for testing process-group-based
#                   termination against a genuine descendant (not just the
#                   single-process exec-replacement case above).
#     sleep_fork_ignore_term -> same as sleep_fork, except the CHILD traps
#                   and ignores TERM (`trap '' TERM`) before sleeping --
#                   mimics a descendant that does not die on the first
#                   signal, requiring the caller's TERM-then-KILL
#                   escalation to actually reach and use KILL, not merely
#                   attempt TERM once and assume success.
#     fail       -> exit "$MOCK_EXIT_CODE" (default 1) immediately, no
#                   output -- mimics a genuine psql/SQL failure (bad
#                   connection, syntax error, etc.)
#     success    -> print "$MOCK_OUTPUT" (default: a literal test value)
#                   and exit 0 -- mimics an ordinary successful query
#                   result.
#
# This file is NEVER invoked by lib.sh itself, only placed on PATH ahead of
# any real psql by the regression tests below, for the duration of a single
# test case.
if [ -n "${MOCK_PID_FILE:-}" ]; then
  echo "$$" > "$MOCK_PID_FILE"
fi

case "${MOCK_MODE:-success}" in
  sleep)
    exec sleep "${MOCK_SLEEP_SECONDS:-30}"
    ;;
  sleep_fork)
    sleep "${MOCK_SLEEP_SECONDS:-30}" &
    child=$!
    if [ -n "${MOCK_CHILD_PID_FILE:-}" ]; then
      echo "$child" > "$MOCK_CHILD_PID_FILE"
    fi
    wait "$child"
    ;;
  sleep_fork_ignore_term)
    ( trap '' TERM; exec sleep "${MOCK_SLEEP_SECONDS:-30}" ) &
    child=$!
    if [ -n "${MOCK_CHILD_PID_FILE:-}" ]; then
      echo "$child" > "$MOCK_CHILD_PID_FILE"
    fi
    wait "$child"
    ;;
  fail)
    exit "${MOCK_EXIT_CODE:-1}"
    ;;
  success|*)
    printf '%s\n' "${MOCK_OUTPUT:-mockvalue}"
    exit 0
    ;;
esac
