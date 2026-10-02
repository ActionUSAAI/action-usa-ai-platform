#!/usr/bin/env bash
# mock_psql_session_for_tests.sh -- a mock stand-in for the real `psql`
# binary used specifically by lib_selftest.sh's close_session regression
# (item 4). Reads lines one at a time from stdin (exactly as open_session
# feeds psql via its FIFO), mimicking just enough of real psql's
# interactive `-A -q -t` behavior to exercise close_session's graceful-exit
# window against a genuinely slow, in-flight statement:
#
#   \q                       -> sleeps MOCK_QUIT_DELAY (default 0) seconds,
#                                then exits 0 -- mimics real psql's own
#                                (normally near-instant) shutdown time.
#   a line containing        -> sleeps MOCK_PROCESS_DELAY (default 0)
#   "BACKEND_PID:"              seconds, then prints "BACKEND_PID:<own pid>"
#                                -- answers open_session's own handshake
#                                query correctly and promptly (this must
#                                stay fast regardless of MOCK_PROCESS_DELAY,
#                                or open_session's own 5s handshake timeout
#                                could fire) using the mock's own pid,
#                                consistent with what a real backend would
#                                report about itself.
#   a line containing         -> sleeps MOCK_PROCESS_DELAY (default 0)
#   "$MOCK_SLOW_MARKER"          seconds, then echoes the content of the
#   (if MOCK_SLOW_MARKER set)    LAST single-quoted string literal on that
#                                line -- simulates a slow, in-flight query
#                                whose result has not yet been produced
#                                when a close request arrives.
#   anything else             -> no output (mimics real psql producing no
#                                output for BEGIN;/COMMIT; etc.)
#
# Never invoked by lib.sh itself -- only placed on PATH ahead of any real
# psql by lib_selftest.sh, for the duration of a single test case.
while IFS= read -r line; do
  case "$line" in
    '\q')
      sleep "${MOCK_QUIT_DELAY:-0}"
      exit 0
      ;;
    *"BACKEND_PID:"*)
      printf 'BACKEND_PID:%s\n' "$$"
      ;;
    *)
      if [ -n "${MOCK_SLOW_MARKER:-}" ]; then
        case "$line" in
          *"$MOCK_SLOW_MARKER"*)
            sleep "${MOCK_PROCESS_DELAY:-0}"
            content=$(printf '%s' "$line" | sed -n "s/.*'\([^']*\)'.*/\1/p")
            printf '%s\n' "$content"
            ;;
        esac
      fi
      ;;
  esac
done
