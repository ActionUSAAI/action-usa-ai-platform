#!/usr/bin/env bash
# Shared two-session coordination helpers for CBR concurrency acceptance
# tests. Requires `psql` on PATH and a running LOCAL Postgres instance
# (`supabase start`, which requires Docker/Podman). NEVER point this at
# TEST or Production — DB_URL must resolve to 127.0.0.1/localhost only.
#
# UNEXECUTED (the PostgreSQL-dependent functions below): written and
# statically reviewed only; never run against a live database. The pure
# shell-level session-lifecycle mechanics (descriptor closure, session-name
# reuse, premature child-exit detection, timeout/termination behavior,
# failure cleanup) ARE actually exercised, locally, by lib_selftest.sh in
# this same directory, against mocked background processes and a mock
# `psql` executable -- no PostgreSQL involved. See that file.
set -euo pipefail

# `exec {${name}_FD}> ...` (open_session, below) relies on bash's
# `{varname}` automatic file-descriptor allocation, added in bash 4.1 --
# silently ABSENT on bash 3.2 (macOS's stock default `/bin/bash`, frozen
# there since 2007 for GPLv3-licensing reasons). Under bash 3.2, even the
# OPEN side fails immediately ("exec: {NAME}: not found"). This is never
# caught by `bash -n` -- bash 3.2's PARSER accepts the token sequence
# without a syntax error; only actually RUNNING it fails. Fail fast, here,
# with a clear, actionable message instead of that confusing error
# surfacing deep inside open_session on first use.
if ((BASH_VERSINFO[0] < 4)) || { ((BASH_VERSINFO[0] == 4)) && ((BASH_VERSINFO[1] < 1)); }; then
  echo "ABORT: this file requires bash >= 4.1 (uses \`exec {var}>...\` automatic file-descriptor allocation). Running bash ${BASH_VERSION}. On macOS, the stock /bin/bash is 3.2 and will not work -- install a newer bash (e.g. via Homebrew) and invoke these scripts with it explicitly." >&2
  exit 1
fi

# Redacts the password portion of a postgresql:// URL before it is ever
# printed -- no diagnostic message in this file should leak a credential,
# even the well-known local default.
redact_db_url() {
  printf '%s' "$1" | sed -E 's#(postgresql://[^:/@]+):[^@]*@#\1:REDACTED@#'
}

DB_URL="${CBR_TEST_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

case "$DB_URL" in
  *127.0.0.1*|*localhost*) : ;;
  *) echo "ABORT: CBR_TEST_DB_URL must be a localhost/127.0.0.1 target. Refusing $(redact_db_url "$DB_URL")" >&2; exit 1 ;;
esac

WORKDIR="$(mktemp -d)"

# Every backgrounded psql client PID opened by open_session is tracked
# HERE, keyed by pid, VALUED by that client's own process-group id, so it
# can be individually removed once genuinely retired (close_session)
# instead of accumulating stale entries in a plain list -- signaling a
# stale, already-reaped historical PID risks hitting an unrelated process
# if the OS has since recycled that PID number. Only pids still present as
# KEYS of this array are ever signaled.
#
# The VALUE (pgid, not merely `1`) matters: empirically confirmed that a
# plain `cmd &` backgrounded from a shell WITHOUT job control active
# (which includes ac-lockorder-and-concurrency.sh's own ordinary,
# non-monitor-mode top-level execution) gets the CALLING SCRIPT's own
# pgid, NOT a new pgid equal to its own pid -- so assuming pgid == pid, as
# an earlier version of this fix did, silently targets a process group
# that was never populated, producing a false-positive "already clean"
# result while the client keeps running. open_session now forces `set -m`
# around the fork specifically to get it a genuine, distinct pgid, and
# records that VERIFIED (not assumed) pgid here.
declare -A ACTIVE_SESSION_PIDS=()

# In-flight run_bounded background commands are tracked via MARKER FILES
# inside $WORKDIR (bounded.<pgid>.pid), NOT an in-memory associative array.
# This is a correction from the prior round: `assert_pg_waiting` and
# `probe_row_lockable` both call run_bounded via `row=$(run_bounded ...)` /
# `out=$(run_bounded ...)` -- and bash's `$(...)` command substitution
# ALWAYS forks a SUBSHELL to run its contents. Any modification a function
# running INSIDE that substitution makes to a shell variable or array
# (including `ACTIVE_BOUNDED_PIDS[$cpid]=1`) happens in the SUBSHELL's own
# copy and is DISCARDED the instant the substitution completes -- it never
# propagates back to the parent shell whose EXIT trap actually runs. The
# prior round's in-memory tracking therefore never actually reflected an
# in-flight bounded call made through either of its two real callers,
# making its "track for interruption cleanup" claim false for the ordinary
# case. A FILE write, by contrast, is a real filesystem operation visible
# to every process regardless of which subshell performed it -- so marker
# files, not shell state, are what cleanup_all_sessions below relies on.

# terminate_and_verify_group <pgid>
# Bounded TERM -> verify -> KILL -> verify escalation against an ENTIRE
# process GROUP (not a single pid, and not a parent-child tree
# re-discovered via pgrep -P after each signal). This is a correction from
# the prior round: re-discovering descendants via `pgrep -P <pid>` AFTER
# already having sent a signal to <pid> is unreliable -- once a process
# exits (or is killed), any child it had is RE-PARENTED (to init/launchd),
# which changes that child's ppid, severing the exact parent-child chain
# `pgrep -P` depends on to find it on a subsequent lookup (e.g. the KILL
# escalation, if TERM alone did not work). A POSIX process GROUP does not
# have this problem: run_bounded below places the wrapped command's
# background job into its OWN new process group at the moment it is
# started (via a narrowly-scoped `set -m`); any child THAT job forks
# inherits the SAME group (verified empirically: forking does not change
# process group unless a process explicitly calls setpgid()). Signaling
# the whole group (`kill -TERM -- "-$pgid"`) reaches every member --
# parent and children alike -- in ONE atomic operation, correct regardless
# of what has already exited or been re-parented.
terminate_and_verify_group() {
  local pgid="$1"
  kill -TERM -- "-$pgid" 2>/dev/null || true
  local w=0
  while process_group_has_running_member "$pgid" && [ "$w" -lt 10 ]; do
    sleep 0.1; w=$((w+1))
  done
  if process_group_has_running_member "$pgid"; then
    kill -KILL -- "-$pgid" 2>/dev/null || true
    w=0
    while process_group_has_running_member "$pgid" && [ "$w" -lt 20 ]; do
      sleep 0.1; w=$((w+1))
    done
  fi
  if process_group_has_running_member "$pgid"; then
    echo "WARNING: process group $pgid still has a running member after TERM+KILL escalation" >&2
    return 1
  fi
  return 0
}

# process_group_has_running_member <pgid>: true (0) if ANY process in
# group <pgid> is GENUINELY RUNNING. This is a correction from the prior
# round: `kill -0 <pid>` alone cannot distinguish a running process from a
# ZOMBIE (a process that has already exited but not yet been reaped by its
# own direct parent, which may not be this shell for a grandchild) --
# kill -0 succeeds against a zombie's pid too, since it still occupies a
# process-table slot. `pgrep -g` (process-group matching -- supported
# identically by macOS/BSD pgrep and Linux procps pgrep, unlike `ps -g`,
# whose flag semantics differ across those two `ps` implementations) finds
# every pid in the group; `ps -o stat= -p <pid>` (single-pid selection,
# portable) is then checked for a leading 'Z' to exclude zombies from
# counting as "running". A zombie whose own direct parent has also exited
# will be reaped by init/launchd on its own schedule, outside this
# function's control -- it is correctly reported as NOT running here
# either way, since a zombie cannot do any further work regardless of when
# it is finally reaped.
process_group_has_running_member() {
  local pgid="$1" pid state
  for pid in $(pgrep -g "$pgid" 2>/dev/null); do
    state=$(ps -o stat= -p "$pid" 2>/dev/null)
    case "$state" in
      Z*|"") : ;;
      *) return 0 ;;
    esac
  done
  return 1
}

# terminate_and_reap <pid> <pgid> <label>
# Bounded, FORCED shutdown of a session's client process AND its process
# group (no grace period -- see close_session below for the cooperative-
# close path that gives a client a chance to exit on its own first). Only
# claims the CLIENT PROCESS (and any descendants it spawned) is confirmed
# gone -- never that any database-side rollback has been verified.
#
# Takes <pid> and <pgid> SEPARATELY (not assumed equal) -- `wait` requires
# the actual child pid, while group termination/liveness must target the
# VERIFIED pgid (see the ACTIVE_SESSION_PIDS comment above for why these
# can differ).
terminate_and_reap() {
  local pid="$1" pgid="$2" label="${3:-pid=$1}"
  if ! process_group_has_running_member "$pgid"; then
    wait "$pid" 2>/dev/null || true
    return 0
  fi
  if ! terminate_and_verify_group "$pgid"; then
    echo "WARNING: $label (pid=$pid, pgid=$pgid) could not be verified terminated after TERM+KILL escalation" >&2
    wait "$pid" 2>/dev/null || true
    return 1
  fi
  wait "$pid" 2>/dev/null || true
  return 0
}

# cleanup_all_sessions: the EXIT trap. Terminates and reaps every still-
# tracked session process AND every still-in-flight bounded diagnostic
# process (discovered via the marker FILES described above -- not the
# in-memory array a subshell-scoped caller could never actually populate
# in this shell), dumps sanitized diagnostics (session logs -- SQL output/
# NOTICEs only, never DB_URL/credentials, which are never written to these
# logs in the first place) to stderr BEFORE deleting them if this run is
# exiting with a failure, then removes the working directory (which also
# contains every run_bounded out_file and marker file, swept up here too
# on any exit path, including an interruption mid-call -- this does NOT
# wait for a bounded call's own deadline to elapse first: the marker file
# lets cleanup_all_sessions find and terminate it immediately, regardless
# of how long its deadline still has left to run).
#
# Captures $? as the VERY FIRST statement and explicitly re-exits with it
# at the end. This is a defensive measure, not a workaround for a
# guaranteed failure mode: bash's post-trap exit status reflects whatever
# $? holds when the trap finishes, and running further commands (like
# `rm -rf`) inside the trap updates $? the same as anywhere else -- if the
# trap never re-establishes the original value before it ends, the
# script's final exit status can end up reflecting the trap's own last
# command instead of the failure that actually triggered it. Capturing and
# explicitly re-exiting with the original status removes that ambiguity
# entirely, regardless of what else runs inside the trap. Verified
# directly in lib_selftest.sh's "exit-trap preserves original failure
# status" test -- a real regression against a deliberate exit 42 and a
# deliberate exit 0, not merely a comment asserting the mechanism.
cleanup_all_sessions() {
  local exit_status=$?
  local f pgid
  for f in "$WORKDIR"/bounded.*.pid; do
    [ -e "$f" ] || continue
    pgid=$(cat "$f" 2>/dev/null)
    [ -n "$pgid" ] && terminate_and_verify_group "$pgid"
    rm -f "$f"
  done
  local pid
  for pid in "${!ACTIVE_SESSION_PIDS[@]}"; do
    terminate_and_reap "$pid" "${ACTIVE_SESSION_PIDS[$pid]}" "tracked session pid=$pid" || true
  done
  if [ "$exit_status" -ne 0 ]; then
    local out
    for out in "$WORKDIR"/*.out; do
      [ -e "$out" ] || continue
      echo "--- diagnostic (sanitized: SQL output/NOTICEs only): tail of $out, preserved before cleanup (exit status ${exit_status}) ---" >&2
      tail -n 40 "$out" >&2
    done
  fi
  rm -rf "$WORKDIR"
  exit "$exit_status"
}
trap cleanup_all_sessions EXIT
# INT/TERM: convert to a plain `exit`, which itself then triggers the EXIT
# trap above (bash always runs the EXIT trap on a subsequent explicit
# exit) -- so INT/TERM get the exact same bounded cleanup as any other
# termination path, not a separate, unhardened code path, and do NOT wait
# for any in-flight bounded call's own deadline to expire first (the
# marker-file-based discovery above finds and terminates it immediately).
trap 'exit 130' INT
trap 'exit 143' TERM

# run_bounded <deadline_seconds> <command...>
# Runs <command...> with a REAL wall-clock deadline, portably (does NOT
# depend on GNU `timeout`/`gtimeout` being installed, which is not a
# default macOS tool): launches the command in the background IN ITS OWN
# PROCESS GROUP (see terminate_and_verify_group's own comment above for
# why), polls its liveness against bash's own SECONDS builtin (genuine
# elapsed time, not a sleep-tick count that a stalled command could
# silently inflate), and on deadline expiry escalates TERM then KILL
# against that WHOLE GROUP, reaps it, and returns 124 (matching the
# conventional `timeout` command's own exit code).
#
# `( exec "$@" > "$out_file" 2>&1 ) &` -- the `exec` is what makes $cpid
# below the ACTUAL command's own pid, not a wrapper's (independent
# reproduction: a mock psql that recorded its own pid then executed sleep
# demonstrated terminating an unexec'd wrapper does not reliably terminate
# the wrapped command). `set -m`, narrowly scoped to just this backgrounding
# statement (restored immediately after), is what gives this job its OWN
# process group -- confirmed empirically that a child the job later forks
# (e.g. a wrapped command that does not use `exec` itself) INHERITS that
# same group, so `terminate_and_verify_group` reaches it too, in one
# signal, with no separate discovery step.
#
# Corrected this round: the prior version only called `set -m` when `$-`
# did NOT already report monitor mode active, on the assumption that an
# inherited `m` flag meant job control was genuinely functional for
# backgrounding here. Empirically DISPROVEN: when run_bounded is called
# from within a subshell that was ITSELF started as an async job (exactly
# the caller shape used throughout this suite -- e.g. `open_session`'s
# background readers, or any script backgrounding a whole scenario under
# a supervising launcher), `$-` reports `m` inherited from the parent, but
# the actual per-fork new-process-group assignment does NOT engage for
# that subshell's OWN children -- `( exec ... ) &` silently stays in the
# CURRENT group instead of getting its own, and terminate_and_verify_group
# then targets a group that was never populated, a false-positive "already
# clean" result that leaves the real process running. Reproduced directly:
# a probe that skipped the redundant `set -m` call (matching the old
# conditional) got the wrong (inherited) pgid; the same probe forcing
# `set -m` unconditionally, even with `$-` already showing `m`, got the
# correct, distinct pgid. The fix: ALWAYS call `set -m` immediately before
# backgrounding and ALWAYS `set +m` immediately after capturing $cpid,
# regardless of the current flags -- this is what actually (re-)engages
# per-fork process-group assignment in every calling context this suite
# uses, not merely when monitor mode was never nominally on. As
# defense-in-depth against any further such surprises, the marker file
# also records the ACTUAL pgid read back via `ps`, not an assumed
# `pgid == cpid`, so a mismatch (however it arose) is still handled
# correctly rather than silently producing a false "already clean" result.
#
# The out_file AND the marker file recording this call's pgid both live
# INSIDE $WORKDIR specifically so an interruption (INT/TERM, or the
# calling script aborting for an unrelated reason) still gets them cleaned
# up by cleanup_all_sessions's own marker-file scan and `rm -rf
# "$WORKDIR"` -- not only the success and explicit-timeout paths, which
# each also remove them directly.
run_bounded() {
  local deadline="$1"; shift
  local out_file marker_file
  out_file="$WORKDIR/bounded.$$.$RANDOM.out"
  set -m
  ( exec "$@" > "$out_file" 2>&1 ) &
  local cpid=$!
  set +m
  local cpgid
  cpgid=$(ps -o pgid= -p "$cpid" 2>/dev/null | tr -d ' ')
  [ -n "$cpgid" ] || cpgid="$cpid"
  marker_file="$WORKDIR/bounded.$cpid.pid"
  echo "$cpgid" > "$marker_file"
  local start=$SECONDS
  while kill -0 "$cpid" 2>/dev/null; do
    if [ $((SECONDS - start)) -ge "$deadline" ]; then
      terminate_and_verify_group "$cpgid" || true
      wait "$cpid" 2>/dev/null || true
      rm -f "$marker_file"
      cat "$out_file" 2>/dev/null
      rm -f "$out_file"
      return 124
    fi
    sleep 0.05
  done
  # `if wait "$cpid"; then status=0; else status=$?; fi`, not a bare
  # `wait "$cpid"; local status=$?` -- if the wrapped command exited
  # nonzero, a bare `wait` as its own statement itself has nonzero exit
  # status, and under this file's own `set -e`, a bare failing simple
  # command aborts the function (and, by extension, unwinds to whatever
  # caller does not itself catch it) BEFORE `local status=$?` ever runs --
  # silently skipping every bit of status-dependent handling below and in
  # every caller. Capturing via an `if` condition is exempt from -e
  # regardless of the command's exit status.
  local status
  if wait "$cpid"; then
    status=0
  else
    status=$?
  fi
  rm -f "$marker_file"
  cat "$out_file" 2>/dev/null
  rm -f "$out_file"
  return "$status"
}

# run_sql <query>: UNBOUNDED one-shot query helper for ordinary fixture
# setup and state assertions throughout the calling scripts (not a polling
# primitive, so an unbounded connection/query is the existing, accepted
# behavior for this general-purpose helper -- if the DB is unreachable,
# every caller fails immediately and loudly regardless).
# -t (tuples only) strips headers/footers so single-column results are
# directly comparable/parseable without positional guesswork.
run_sql() { echo "$1" | psql "$DB_URL" -v ON_ERROR_STOP=1 -A -q -t; }

# run_sql_bounded <query> [deadline_seconds=5]: like run_sql, but wrapped
# in run_bounded -- used specifically by the polling/diagnostic paths below
# (assert_pg_waiting's per-tick probe and its relation diagnostic) where an
# unbounded stall would otherwise silently prevent the CALLER's own overall
# deadline from ever being reached.
#
# Corrected this round (item 2): calls psql DIRECTLY with `-c "$query"` --
# no `bash -c` wrapper, no `echo ... | psql` pipeline. The reviewed
# baseline's `run_bounded "$deadline" bash -c 'echo "$1" | psql ...' _
# "$query" "$DB_URL"` was itself the unnecessary wrapper/pipeline layer
# independent review identified: terminating run_bounded's tracked pid
# terminated the OUTER bash -c process, not the actual psql process
# running inside its own pipeline -- exactly the scenario the mock-psql
# reproduction demonstrated. A direct `psql ... -c "$query"` call is a
# single process, correctly and fully terminable by run_bounded's `exec`
# fix above with no remaining indirection.
run_sql_bounded() {
  local query="$1" deadline="${2:-5}"
  run_bounded "$deadline" psql "$DB_URL" -v ON_ERROR_STOP=1 -A -q -t -c "$query"
}

# open_session <name>: starts a long-lived psql process reading commands
# from a FIFO and writing output to a log file. Use `send` to feed SQL,
# `wait_for` to block until a marker string appears in the log.
#
# Explicitly clears any stale ${name}_BPID left over from a PRIOR use of
# this session name before attempting to resolve a new one -- so a partial
# failure can never be mistaken for a valid, reusable backend identity.
# The log file is truncated fresh on every call (both by `: >` here and by
# the `>` redirect below), so reopening a session name never mixes output
# from a prior use of that name into a subsequent one.
#
# Immediately after opening, captures the session's REAL Postgres backend
# PID (pg_backend_pid(), server-side) into ${name}_BPID -- NOT the
# client-side psql process PID captured in ${name}_PID (a different,
# unrelated PID space that pg_stat_activity/pg_locks cannot be filtered
# by). assert_pg_waiting() below uses ${name}_BPID exclusively.
open_session() {
  local name="$1"
  unset "${name}_BPID" 2>/dev/null || true
  mkfifo "$WORKDIR/$name.in"
  : > "$WORKDIR/$name.out"
  set -m
  psql "$DB_URL" -v ON_ERROR_STOP=1 -A -q -t < "$WORKDIR/$name.in" > "$WORKDIR/$name.out" 2>&1 &
  local pid=$!
  set +m
  local pgid
  pgid=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')
  [ -n "$pgid" ] || pgid="$pid"
  eval "${name}_PID=$pid"
  eval "${name}_IN=\"$WORKDIR/$name.in\""
  ACTIVE_SESSION_PIDS[$pid]="$pgid"
  # keep the FIFO writable across multiple `send` calls
  eval "exec {${name}_FD}> \"\$${name}_IN\""
  send "$name" "SELECT 'BACKEND_PID:' || pg_backend_pid();"
  wait_for "$name" "BACKEND_PID:" 5
  local bpid
  bpid=$(grep -o 'BACKEND_PID:[0-9]*' "$WORKDIR/$name.out" | tail -1 | cut -d: -f2)
  if [ -z "$bpid" ]; then
    echo "FAIL: could not resolve backend pid for session $name (psql client pid=$pid) -- check $WORKDIR/$name.out for the reason (e.g. connection refused, authentication failure)" >&2
    return 1
  fi
  eval "${name}_BPID=$bpid"
}

send() {
  local name="$1"; shift
  local fd_var="${name}_FD"
  echo "$*" >&"${!fd_var}"
}

# wait_for <name> <marker> [timeout_seconds]
#
# In addition to the marker-in-log poll, separately checks the session's
# CLIENT psql process (${name}_PID) is still alive on every tick -- a
# premature crash/disconnect (bad SQL, connection loss, authentication
# failure mid-session) now fails clearly and immediately, distinguishable
# in the message from an ordinary deadline-expiry TIMEOUT, instead of
# silently waiting out the full timeout for a marker that can now never
# arrive.
wait_for() {
  local name="$1" marker="$2" timeout="${3:-10}"
  local out="$WORKDIR/$name.out"
  local pid_var="${name}_PID"
  local pid="${!pid_var:-}"
  local waited=0
  while ! grep -q "$marker" "$out" 2>/dev/null; do
    if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
      echo "FAIL: session $name's psql client process (pid=$pid) terminated prematurely before marker '$marker' appeared -- check $out for the reason" >&2
      cat "$out" >&2
      return 1
    fi
    sleep 0.2; waited=$((waited+1))
    if [ "$waited" -gt $((timeout*5)) ]; then
      echo "TIMEOUT ($timeout s) waiting for '$marker' in session $name (psql client pid=${pid:-<unknown>} still alive)" >&2
      cat "$out" >&2
      return 1
    fi
  done
}

# assert_commit_complete <name> [timeout_seconds]
# Sending "COMMIT;" into a session's FIFO only proves the bytes were
# written to the pipe -- it does not by itself prove the server actually
# processed and completed the commit. This sends a self-labeled follow-up
# query immediately after the caller's own COMMIT and waits for its
# result, so the caller has explicit, positive evidence the commit
# round-tripped through the server before treating the transaction as
# committed (e.g. before relying on its effects becoming visible to
# another session, or before closing the session). Callers send COMMIT
# themselves (so it remains visible/traceable at the call site); this
# helper appends the confirmation step.
assert_commit_complete() {
  local name="$1" timeout="${2:-10}"
  send "$name" "SELECT 'COMMIT_COMPLETE:' || 1; SELECT 'COMMIT_COMPLETE_MARKER';"
  wait_for "$name" "COMMIT_COMPLETE_MARKER" "$timeout"
  assert_marker_result "$name" "COMMIT_COMPLETE_MARKER" COMMIT_COMPLETE 1 "$name commit completed"
}

# assert_pg_waiting <session_name> <expected_blocker_bpid> [timeout_seconds]
#
# Bounded polling proof that <session_name>'s REAL backend (via
# ${name}_BPID) is BOTH:
#   (a) wait_event_type = 'Lock' SPECIFICALLY -- not merely "non-NULL".
#       wait_event_type is non-NULL for an ordinary IDLE backend awaiting
#       its next command too (wait_event_type='Client'). Only 'Lock' means
#       blocked on a heavyweight lock.
#   (b) <expected_blocker_bpid> (the caller-supplied, explicitly identified
#       expected blocking backend pid) is present in
#       pg_blocking_pids(<session's own bpid>) -- Postgres's own, built-in,
#       lock-type-agnostic blocking-chain resolver, correct uniformly
#       across relation-level and row/transactionid-level contention.
# Both conditions are read from ONE query per poll tick, so the sample is
# coherent.
#
# DEADLINE: the overall <timeout_seconds> (default 10) is a REAL wall-clock
# deadline tracked via bash's SECONDS builtin, not a sleep-tick count -- a
# single stalled per-tick probe can no longer silently consume the entire
# budget without the elapsed-time check ever firing. Each per-tick probe
# is itself run via run_sql_bounded with its own short (3s) deadline; a
# probe that exceeds ITS deadline is logged distinctly and counted against
# the overall wall-clock budget, never silently retried forever and never
# treated as a pass.
#
# Corrected this round (item 3): the per-tick capture is now
# `if row=$(run_sql_bounded ...); then status=0; else status=$?; fi` --
# NOT a bare `row=$(...); status=$?`. Independent reproduction (a mock
# run_sql_bounded forced to return 124) showed the bare form aborts this
# function (and unwinds through whatever calls it) via `set -e` on the
# FIRST statement, before `status=$?` -- and therefore before ANY of the
# distinct diagnostic branches below -- ever runs, producing none of the
# intended timeout/failure messages. The `if`-guarded form is exempt from
# -e regardless of the command's exit status, so every branch below now
# actually executes for the scenario it exists to report.
#
# Failure modes, each reported distinctly:
#   - no ${name}_BPID recorded (open_session never ran / failed)
#   - no expected-blocker bpid supplied by the caller
#   - a single probe query exceeded its own per-tick deadline (stalled
#     connection/query) -- logged, counted against the overall deadline
#   - a SQL error while polling (connection lost, permission error, etc.)
#   - the waiting session's backend is no longer present in
#     pg_stat_activity at all (terminated / disconnected)
#   - overall deadline expiry (TIMEOUT), with the last observed sample
#
# Exact-row attribution is NOT claimed by this function alone -- see the
# row-specific NOWAIT probes below for that.
assert_pg_waiting() {
  local name="$1" expected_blocker_bpid="$2" timeout="${3:-10}"
  local per_probe_deadline=3
  local bpid_var="${name}_BPID"
  local bpid="${!bpid_var:-}"
  if [ -z "$bpid" ]; then
    echo "FAIL: assert_pg_waiting: no backend pid recorded for session $name (open_session did not run or failed)" >&2
    return 1
  fi
  if [ -z "$expected_blocker_bpid" ]; then
    echo "FAIL: assert_pg_waiting: no expected blocking backend pid supplied for session $name -- every call site must identify its expected blocker explicitly" >&2
    return 1
  fi
  local start=$SECONDS wait_type="" blocked_by="" row status
  while :; do
    if row=$(run_sql_bounded "SELECT wait_event_type, (SELECT bool_or(p = ${expected_blocker_bpid}) FROM unnest(pg_blocking_pids(${bpid})) AS p) FROM pg_stat_activity WHERE pid = ${bpid};" "$per_probe_deadline"); then
      status=0
    else
      status=$?
    fi
    if [ "$status" -eq 124 ]; then
      echo "NOTE: assert_pg_waiting: probe query for session $name (backend pid=$bpid) exceeded its own ${per_probe_deadline}s per-tick deadline (stalled connection/query) -- retrying within the overall ${timeout}s deadline" >&2
    elif [ "$status" -ne 0 ]; then
      echo "FAIL: assert_pg_waiting: SQL error probing session $name (backend pid=$bpid): $row" >&2
      return 1
    elif [ -z "$row" ]; then
      echo "FAIL: assert_pg_waiting: session $name (backend pid=$bpid) not found in pg_stat_activity -- the backend has terminated or was never valid" >&2
      return 1
    else
      wait_type="${row%%|*}"; wait_type="${wait_type// /}"
      blocked_by="${row#*|}"; blocked_by="${blocked_by// /}"
      if [ "$wait_type" = "Lock" ] && [ "$blocked_by" = "t" ]; then
        break
      fi
    fi
    if [ $((SECONDS - start)) -ge "$timeout" ]; then
      echo "FAIL: assert_pg_waiting: TIMEOUT (${timeout}s wall-clock) waiting for session $name (backend pid=$bpid) to be Lock-waiting on backend pid ${expected_blocker_bpid}; last observed wait_event_type='${wait_type:-<none>}', expected-blocker-present='${blocked_by:-<none>}'" >&2
      return 1
    fi
    sleep 0.2
  done
  local relname
  relname=$(run_sql_bounded "SELECT c.relname FROM pg_locks l JOIN pg_class c ON c.oid = l.relation WHERE l.pid = ${bpid} AND NOT l.granted LIMIT 1;" "$per_probe_deadline") || relname=""
  relname="${relname// /}"
  if [ -n "$relname" ]; then
    echo "CONFIRMED: session $name (backend pid=$bpid) is genuinely Lock-waiting (wait_event_type='Lock') with backend pid ${expected_blocker_bpid} present in pg_blocking_pids(${bpid}); diagnostic relation='${relname}'"
  else
    echo "CONFIRMED: session $name (backend pid=$bpid) is genuinely Lock-waiting (wait_event_type='Lock') with backend pid ${expected_blocker_bpid} present in pg_blocking_pids(${bpid}); no relation-level ungranted lock row found (expected for row/transactionid-level contention, or the diagnostic lookup itself timed out -- its absence does not invalidate this result)"
  fi
}

# probe_row_lockable <table> <key_column> <quoted_key_value> [deadline_seconds=5]
#
# Corrected this round (item 2, second pass): the prior round's
# count-then-lock design (a `SELECT count(*)` before the `FOR UPDATE
# NOWAIT` attempt) was independently shown to still be unsound -- the
# INNER `SELECT ... INTO STRICT ... FOR UPDATE NOWAIT` statement is ITSELF
# a single statement that both scans and locks, so `lock_not_available`
# can still fire while scanning, before that statement's OWN `INTO STRICT`
# cardinality check ever runs, for the identical structural reason as the
# original bug -- an `INTO STRICT` backstop does not close a race that can
# occur INSIDE the very statement performing the backstop.
#
# Replaced entirely with an ENFORCED unique-key contract instead of
# counting: the caller identifies a row by <key_column> = <quoted_key_value>
# and this function first verifies, via `pg_constraint`, that <key_column>
# is ACTUALLY the sole column of a PRIMARY KEY or UNIQUE constraint on
# <table> -- not merely assumed to be. A schema-ENFORCED unique
# constraint makes "more than one row matches this exact value" a
# structural IMPOSSIBILITY, guaranteed by Postgres itself, with no
# timing window at all -- unlike an application-level count, which only
# ever describes a moment already in the past by the time the next
# statement runs. This is why the fix is a constraint-verification query
# followed by a SINGLE NOWAIT lock attempt, not a second counting query:
# once uniqueness is confirmed, there is nothing further for a count to
# protect against.
#
# `INTO STRICT` is retained on the lock attempt purely as a defensive
# assertion of that guarantee (`too_many_rows` should be provably
# unreachable for a genuine unique key -- if it ever fired, that would
# indicate the constraint verification itself was subverted, e.g. a
# concurrent DDL race dropping the constraint, not an ordinary row-level
# concurrency scenario), never as the primary defense.
#
# Lock contention is distinguished by catching the named condition
# `lock_not_available` -- Postgres's own condition name for SQLSTATE
# 55P03 -- never English error-message text.
#
# Prints exactly one of: FREE, LOCKED, ERROR:no matching row, ERROR:key
# column is not an enforced unique/primary key, ERROR:multiple matching
# rows (see above -- should be unreachable), ERROR:probe exceeded <n>s
# deadline, or ERROR:<other detail>. NONE of the ERROR: outcomes are ever
# treated as either successful locking evidence or a free row by
# assert_row_locked/assert_row_free below.
#
# INTERFACE CHANGE from the prior round: takes <key_column> and
# <quoted_key_value> as SEPARATE arguments instead of a single, arbitrary
# <where_clause> string -- every caller (assert_row_locked/assert_row_free
# and every ac-lockorder-and-concurrency.sh call site) has been updated to
# match. <quoted_key_value> must already be SQL-literal-quoted by the
# caller (e.g. `'g1g2'` for a text column), consistent with how every
# other raw-SQL-building helper in this suite already expects its callers
# to supply correctly quoted literals.
probe_row_lockable() {
  local table="$1" key_column="$2" key_value="$3" deadline="${4:-5}"
  local out status
  if out=$(run_bounded "$deadline" psql "$DB_URL" -v ON_ERROR_STOP=1 -A -q -t -c "
DO \$PROBE\$
DECLARE v_is_unique_key BOOLEAN; v_dummy INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = '${table}'::regclass
      AND c.contype IN ('p','u')
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute
                             WHERE attrelid = '${table}'::regclass
                               AND attname = '${key_column}')]
  ) INTO v_is_unique_key;
  IF NOT v_is_unique_key THEN
    RAISE NOTICE 'PROBE_RESULT:NOT_UNIQUE_KEY';
    RETURN;
  END IF;
  BEGIN
    SELECT 1 INTO STRICT v_dummy FROM ${table} WHERE ${key_column} = ${key_value} FOR UPDATE NOWAIT;
    RAISE NOTICE 'PROBE_RESULT:FREE';
  EXCEPTION
    WHEN lock_not_available THEN
      RAISE NOTICE 'PROBE_RESULT:LOCKED';
    WHEN no_data_found THEN
      RAISE NOTICE 'PROBE_RESULT:MISSING_ROW';
    WHEN too_many_rows THEN
      RAISE NOTICE 'PROBE_RESULT:MULTIPLE_ROWS';
  END;
END;
\$PROBE\$;
"); then
    status=0
  else
    status=$?
  fi
  if [ "$status" -eq 124 ]; then
    echo "ERROR:probe exceeded ${deadline}s deadline (stalled connection/query)"
    return 0
  fi
  if [ "$status" -ne 0 ]; then
    echo "ERROR:psql exited ${status}: ${out}"
    return 0
  fi
  if echo "$out" | grep -q 'PROBE_RESULT:LOCKED'; then
    echo "LOCKED"
  elif echo "$out" | grep -q 'PROBE_RESULT:FREE'; then
    echo "FREE"
  elif echo "$out" | grep -q 'PROBE_RESULT:NOT_UNIQUE_KEY'; then
    echo "ERROR:key column '${key_column}' is not an enforced unique/primary key on ${table} (this probe requires a schema-enforced single-column PRIMARY KEY or UNIQUE constraint, not merely an assumed-unique WHERE predicate)"
  elif echo "$out" | grep -q 'PROBE_RESULT:MISSING_ROW'; then
    echo "ERROR:no matching row (expected exactly one row for this exact-row probe: $table WHERE $key_column = $key_value)"
  elif echo "$out" | grep -q 'PROBE_RESULT:MULTIPLE_ROWS'; then
    echo "ERROR:multiple matching rows (should be unreachable for a verified unique key -- this indicates the constraint itself was subverted, e.g. a concurrent DDL race): $table WHERE $key_column = $key_value"
  else
    echo "ERROR:unrecognized probe output: ${out}"
  fi
}

# assert_row_locked/assert_row_free <table> <key_column> <quoted_key_value> <label>
# Hard-fail wrappers around probe_row_lockable. These establish that SOME
# session holds (or does not hold) a conflicting lock on EXACTLY the named
# row -- they do NOT, by themselves, attribute that lock to any PARTICULAR
# session. Attribution to a specific session requires the caller's own
# controlled schedule together with assert_pg_waiting's backend-to-backend
# blocking evidence -- callers must not claim row ownership from a NOWAIT
# probe result alone. Any ERROR: result (not-a-unique-key, missing row,
# multiple rows, deadline exceeded, or any other failure) is treated as
# neither LOCKED nor FREE and fails the assertion with the specific reason
# surfaced.
assert_row_locked() {
  local table="$1" key_column="$2" key_value="$3" label="$4"
  local result
  result=$(probe_row_lockable "$table" "$key_column" "$key_value")
  if [ "$result" != "LOCKED" ]; then
    echo "FAIL: $label: expected row ($table WHERE $key_column = $key_value) to be lock-held by another session (NOWAIT probe should fail to acquire with SQLSTATE 55P03, against a verified unique-key match), actual probe result: $result" >&2
    return 1
  fi
  echo "[PASS] $label (row genuinely lock-held: $key_column verified as an enforced unique/primary key, and a fresh NOWAIT probe against its exact match failed to acquire with SQLSTATE 55P03/lock_not_available)"
}

assert_row_free() {
  local table="$1" key_column="$2" key_value="$3" label="$4"
  local result
  result=$(probe_row_lockable "$table" "$key_column" "$key_value")
  if [ "$result" != "FREE" ]; then
    echo "FAIL: $label: expected row ($table WHERE $key_column = $key_value) to be FREE of any conflicting lock, actual probe result: $result" >&2
    return 1
  fi
  echo "[PASS] $label (row genuinely free: $key_column verified as an enforced unique/primary key, and a fresh NOWAIT probe against its exact match acquired and released it immediately)"
}

# result_before_marker <name> <marker>: returns the line immediately
# preceding the first occurrence of <marker> in session <name>'s log.
# Callers must send results as a self-labeled "TAG:value" string (see
# assert_marker_result) rather than a bare column value, so this remains
# correct even if a server NOTICE line is interleaved.
result_before_marker() {
  local name="$1" marker="$2"
  grep -B1 "^${marker}\$" "$WORKDIR/$name.out" | head -1
}

# assert_marker_result <name> <marker> <tag> <expected> [label]
# The session must have been sent a statement of the form
#   SELECT '<tag>:' || <expr>; SELECT '<marker>';
# This extracts the "<tag>:<value>" line and hard-fails if <value> !=
# <expected>. A completion marker alone never establishes a successful
# business outcome -- every material assertion in this suite must parse
# and check the actual returned value this way, not merely confirm a
# marker appeared.
assert_marker_result() {
  local name="$1" marker="$2" tag="$3" expected="$4" label="${5:-$marker}"
  local line actual
  line=$(result_before_marker "$name" "$marker")
  actual="${line#${tag}:}"
  if [ "$line" = "$actual" ] || [ -z "$actual" ]; then
    echo "FAIL: $label: no '${tag}:' line found immediately before marker '$marker' in session $name (found: '$line')" >&2
    return 1
  fi
  if [ "$actual" != "$expected" ]; then
    echo "FAIL: $label: expected '$expected', actual '$actual'" >&2
    return 1
  fi
  echo "[PASS] $label (outcome=$actual)"
}

# close_session <name>
# Descriptor closure (repaired in a prior round): `exec ${!fd_var}>&-` --
# no braces. `${name}_FD` (set by open_session's own `exec {${name}_FD}>
# ...` bash auto-fd-allocation) already holds a PLAIN NUMBER; the
# `{...}` brace syntax is ONLY valid for bash's auto-allocation form on
# OPEN. No `|| true` follows the closing line -- a failure to close an
# owned descriptor is a genuine programming error and is not silently
# absorbed.
#
# Corrected this round (item 4): the reviewed baseline sent `\q`, closed
# the descriptor, and called terminate_and_reap -- which sends TERM
# IMMEDIATELY, giving the client's own cooperative `\q` handling zero
# window to actually take effect before being signaled. Fixed: a bounded
# GRACEFUL interval (~1.5s) now polls for the client to exit ON ITS OWN
# after `\q` first; terminate_and_reap (still the correct TERM->KILL
# escalation, and itself a no-op beyond a clean reap if the process
# already exited during the grace window) is only reached as a fallback
# if that window expires. Verified directly (not merely asserted) in
# lib_selftest.sh's mock-session regression, which shows a mock session
# with QUEUED, not-yet-processed work is not cut off by an immediate
# signal -- it is given the chance to finish and only then closed.
#
# The pid is removed from ACTIVE_SESSION_PIDS once retired, so the
# EXIT-trap cleanup and any later session-name reuse can never re-signal
# it.
close_session() {
  local name="$1"
  local fd_var="${name}_FD"
  local pid_var="${name}_PID"
  local pid="${!pid_var:-}"
  send "$name" '\q' 2>/dev/null || true
  if [ -n "${!fd_var:-}" ]; then
    eval "exec ${!fd_var}>&-"
  fi
  if [ -n "$pid" ]; then
    local waited=0
    while kill -0 "$pid" 2>/dev/null && [ "$waited" -lt 15 ]; do
      sleep 0.1; waited=$((waited+1))
    done
    terminate_and_reap "$pid" "${ACTIVE_SESSION_PIDS[$pid]:-$pid}" "session $name's psql client process"
    unset "ACTIVE_SESSION_PIDS[$pid]" 2>/dev/null || true
  fi
  rm -f "$WORKDIR/$name.in"
}
