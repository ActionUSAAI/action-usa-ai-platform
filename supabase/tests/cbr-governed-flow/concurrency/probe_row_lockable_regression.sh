#!/usr/bin/env bash
# probe_row_lockable_regression.sh -- focused PostgreSQL regression cases
# for lib.sh's probe_row_lockable (Finding 5, V5: enforced unique-key
# contract). Verifies the exact-one-row NOWAIT probe correctly
# distinguishes FREE, LOCKED, a missing row, a key column that is NOT an
# enforced unique/primary key, and a genuine SQL/permission failure --
# never silently reporting FREE or LOCKED for anything but a clean,
# single, structurally-guaranteed-unique row match.
#
# CHANGED THIS ROUND (item 2): the prior round's fix (count-then-lock, one
# statement, INTO STRICT as sole backstop) was independently shown to
# still be race-prone: `lock_not_available` can fire INSIDE the
# `SELECT ... FOR UPDATE NOWAIT INTO STRICT` statement itself, while it is
# still scanning, before that same statement's own cardinality check runs
# -- an INTO STRICT backstop cannot close a race that happens inside the
# very statement performing the backstop, regardless of whether a prior,
# separate COUNT(*) statement also ran. This round replaces counting
# entirely with a SCHEMA-ENFORCED unique-key contract: probe_row_lockable
# first verifies, via pg_constraint/pg_attribute, that the caller's
# <key_column> is actually the sole column of a PRIMARY KEY or UNIQUE
# constraint on <table>. Once that is confirmed, ">1 row matches this
# exact value" is a structural impossibility guaranteed by Postgres
# itself -- not a probabilistic property of the fixtures, and not
# something a second counting query could make more true. There is
# therefore no "multiple rows, without contention" / "multiple rows, with
# contention" pair of cases anymore -- both are replaced by a single
# up-front NOT_UNIQUE_KEY rejection case (case 4 below), which fires
# BEFORE any lock is ever attempted, for probes against a column that is
# not enforced-unique regardless of how many rows it happens to match at
# any given moment.
#
# INTERFACE CHANGE: probe_row_lockable/assert_row_locked/assert_row_free
# now take <table> <key_column> <quoted_key_value> [label] instead of a
# single <where_clause> string. Every call in this file has been updated
# to match; see lib.sh for the full rationale.
#
# UNEXECUTED: written and statically reviewed only; never run against a
# live database in this environment (no local Docker/Podman/psql
# available). Requires the same prerequisites as every other script in
# this directory -- see ../README.md and this round's delivery README.
set -euo pipefail
cd "$(dirname "$0")"
source lib.sh

run_sql "
CREATE TABLE IF NOT EXISTS cbr_test.probe_regression (k TEXT PRIMARY KEY, label TEXT);
DELETE FROM cbr_test.probe_regression;
INSERT INTO cbr_test.probe_regression VALUES
  ('row_a', 'first'), ('row_b', 'second'), ('row_c', 'third'),
  ('dup1', 'dup'), ('dup2', 'dup'), ('dup3', 'dup');
"

echo "=== Case 1: one existing, unlocked row, probed via the enforced unique key -> FREE ==="
RESULT1=$(probe_row_lockable "cbr_test.probe_regression" "k" "'row_a'")
[ "$RESULT1" = "FREE" ] || { echo "FAIL: case 1: expected FREE, actual '$RESULT1'" >&2; exit 1; }
echo "[PASS] case 1 (FREE)"

echo "=== Case 2: one existing, genuinely LOCKED row (held by a separate real session) -> LOCKED ==="
open_session HOLDER
send HOLDER "BEGIN; SELECT 1 FROM cbr_test.probe_regression WHERE k='row_b' FOR UPDATE; SELECT 'HOLDER_LOCKS_ROW_B';"
wait_for HOLDER HOLDER_LOCKS_ROW_B
RESULT2=$(probe_row_lockable "cbr_test.probe_regression" "k" "'row_b'")
[ "$RESULT2" = "LOCKED" ] || { echo "FAIL: case 2: expected LOCKED, actual '$RESULT2'" >&2; exit 1; }
echo "[PASS] case 2 (LOCKED, via SQLSTATE 55P03/lock_not_available, against a schema-verified unique-key match)"
send HOLDER "COMMIT;"
# No other session was waiting on HOLDER's commit to prove it completed
# (unlike every COMMIT in the ac*.sh scenario scripts, each followed by a
# wait_for on the session it unblocks) -- so this uses the explicit
# completion-confirmation helper instead (preserved from v4, item 3).
assert_commit_complete HOLDER
close_session HOLDER

echo "=== Case 3: missing row (zero matches on the enforced unique key) -> the SPECIFIC 'no matching row' category, NEVER FREE ==="
RESULT3=$(probe_row_lockable "cbr_test.probe_regression" "k" "'does_not_exist'")
case "$RESULT3" in
  "ERROR:no matching row"*) echo "[PASS] case 3 ($RESULT3)" ;;
  *) echo "FAIL: case 3: expected the specific 'ERROR:no matching row' category (zero matching rows must never report FREE, and must be distinguishable from every other ERROR: case), actual '$RESULT3'" >&2; exit 1 ;;
esac

echo "=== Case 4: probing a column that is NOT an enforced unique/primary key -> the SPECIFIC NOT_UNIQUE_KEY rejection, checked BEFORE any lock attempt, regardless of actual row count or contention ==="
# 'label' matches 3 rows for value 'dup' (dup1/dup2/dup3) -- but the point
# of this case is that probe_row_lockable must reject it on the
# constraint check alone, without ever depending on how many rows it
# actually matches at the moment of the call. To make that structural
# claim concrete, this case also holds a real lock on one of the matching
# rows (dup1) while probing -- proving the rejection fires from the
# constraint check itself, not from incidentally reaching a "too many
# rows" branch during the lock attempt (the exact ambiguity this round's
# fix is required to close: see lib.sh's probe_row_lockable comment).
open_session HOLDER2
send HOLDER2 "BEGIN; SELECT 1 FROM cbr_test.probe_regression WHERE k='dup1' FOR UPDATE; SELECT 'HOLDER2_LOCKS_DUP1';"
wait_for HOLDER2 HOLDER2_LOCKS_DUP1
RESULT4=$(probe_row_lockable "cbr_test.probe_regression" "label" "'dup'")
case "$RESULT4" in
  "ERROR:key column 'label' is not an enforced unique/primary key"*) echo "[PASS] case 4 ($RESULT4) -- rejected on the constraint check alone, never reaching LOCKED or a row-count branch, despite one of label='dup''s 3 matching rows being genuinely locked" ;;
  LOCKED) echo "FAIL: case 4: reported LOCKED for a probe against a non-unique column with one matching row locked -- this is exactly the ambiguous-attribution defect this round's fix is required to close" >&2; exit 1 ;;
  *) echo "FAIL: case 4: expected the specific NOT_UNIQUE_KEY rejection category, actual '$RESULT4'" >&2; exit 1 ;;
esac
send HOLDER2 "COMMIT;"
assert_commit_complete HOLDER2
close_session HOLDER2

echo "=== Case 5: genuine SQL failure (nonexistent column as the key column) -> the SPECIFIC constraint-check-driven NOT_UNIQUE_KEY category (a nonexistent column cannot be a unique key), NEVER FREE or LOCKED ==="
# A nonexistent column has no pg_attribute row at all, so the
# pg_constraint/pg_attribute EXISTS check simply evaluates to false (no
# matching attnum), correctly falling through to NOT_UNIQUE_KEY rather
# than raising a raw SQL error -- this is a deliberate, checked outcome of
# the constraint-verification design, not an accidental crash.
RESULT5=$(probe_row_lockable "cbr_test.probe_regression" "nonexistent_column" "'x'")
case "$RESULT5" in
  "ERROR:key column 'nonexistent_column' is not an enforced unique/primary key"*) echo "[PASS] case 5 ($RESULT5)" ;;
  *) echo "FAIL: case 5: expected the specific NOT_UNIQUE_KEY rejection category for a nonexistent key column, actual '$RESULT5'" >&2; exit 1 ;;
esac

echo "=== Case 6: genuine SQL failure unrelated to the key-column check (nonexistent table) -> the SPECIFIC 'psql exited' category, NEVER FREE or LOCKED ==="
RESULT6=$(probe_row_lockable "cbr_test.does_not_exist_table" "k" "'row_a'")
case "$RESULT6" in
  "ERROR:psql exited"*) echo "[PASS] case 6 ($RESULT6)" ;;
  *) echo "FAIL: case 6: expected the specific 'ERROR:psql exited' category (a genuine SQL failure must never report FREE, LOCKED, or NOT_UNIQUE_KEY), actual '$RESULT6'" >&2; exit 1 ;;
esac

echo "=== Case 7: assert_row_locked/assert_row_free wrapper sanity against the new 4-argument signature ==="
assert_row_free "cbr_test.probe_regression" "k" "'row_c'" "case-7-row_c-free"
open_session HOLDER3
send HOLDER3 "BEGIN; SELECT 1 FROM cbr_test.probe_regression WHERE k='row_c' FOR UPDATE; SELECT 'HOLDER3_LOCKS_ROW_C';"
wait_for HOLDER3 HOLDER3_LOCKS_ROW_C
assert_row_locked "cbr_test.probe_regression" "k" "'row_c'" "case-7-row_c-locked"
send HOLDER3 "COMMIT;"
assert_commit_complete HOLDER3
close_session HOLDER3

run_sql "DROP TABLE IF EXISTS cbr_test.probe_regression;"
echo "All probe_row_lockable regression cases PASSED (if actually executed)."
