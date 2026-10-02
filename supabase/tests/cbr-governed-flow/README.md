# CBR Governed Confirmation & Promotion Flow — test suite

**Status: database-dependent tests below are written and statically reviewed only — never executed.**
The two non-database test files (`provenance-unit-tests.ts`) ARE executed and passing — see below.

## Why database tests have not been executed yet

No isolated/disposable database is reachable from the IMPLEMENTING environment (no `docker`,
`podman`, `colima`, or `lima` required by `supabase start`; no local `psql`/`postgres`/`pg_ctl`).
This blocks THIS environment's own database execution only — it does not block writing/running
non-database tests, which this suite now includes and has run.

**Corrected (Finding 6 v2): AUSCIS-TEST is not "out of bounds"** — the owner has explicitly
authorized Alex to manually run reviewed, modifying tests there. Two artifacts in this directory
(`finding-02-tx04-expected-prior-value-regression.sql`, `finding-03-single-session-fixture-corrections.sql`)
were purpose-built for exactly that: self-contained, single-transaction-with-ROLLBACK, no schema
creation, each with its own migration-040 existence check. What genuinely remains disposable-local-only
is `01-single-session-tests.sql`/`00-helpers.sql` (which `DROP SCHEMA ... CASCADE`s a persistent
`cbr_test` schema — not appropriate for a shared project) and the `concurrency/*.sh` scripts (which
require two independently-held raw sessions, and whose own `lib.sh` already fails closed against
anything but `127.0.0.1`/`localhost` by design, unrelated to any "out of bounds" policy). See the
Finding 6 v3 delivery's `MANUAL-VERIFICATION-CHECKLIST.md` for the complete, categorized breakdown,
including the exact block-to-AC coverage mapping for `finding-03-single-session-fixture-corrections.sql`
(11 of the 70 top-level ACs, not "most of AC-01–70").

## Three distinct URLs — do not conflate them

| Purpose | Variable | Example (local `supabase start` defaults) |
|---|---|---|
| Raw PostgreSQL connection (psql, two-session concurrency scripts) | `CBR_TEST_DB_URL` | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Supabase HTTP/PostgREST API (AC-68's curl calls) | `CBR_TEST_API_URL` | `http://127.0.0.1:54321` |
| Next.js application server (AC-69's fetch calls to `/api/intake`) | `CBR_TEST_LOCAL_APP_URL` | `http://127.0.0.1:3000` |

These are three different processes on three different ports. Setting one does not configure
another.

## Critical: pointing the Next.js server itself at the local database

AC-69 calls the REAL `/api/intake` route, which runs inside the `npm run dev` process — that
process reads `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from **its own environment
at the time it starts**, not from whatever the test script exports. Setting
`CBR_TEST_LOCAL_SUPABASE_URL` in the terminal running `ac69-intake-failure-isolation.ts` has **no
effect on the dev server** unless the dev server is *also* started with the local stack's
`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` set. Concretely:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<local service_role key, from `supabase status`> \
npm run dev
```
Localhost alone in a URL is **not** proof the app server is using the isolated database — a dev
server started without these two variables set will fall back to this repo's hardcoded
`https://slasbfepqovdsezmadjh.supabase.co` default (see `src/app/api/intake/route.ts`'s own
`SUPABASE_URL` fallback), which is Production. **Always explicitly export both variables for the
dev server process itself before running AC-69.**

## Full prerequisites, in order

1. Install Docker Desktop or Podman, on PATH.
2. Install `psql` (`brew install libpq` on macOS, add to PATH) — required for the concurrency
   scripts' raw two-session transaction control (Supabase JS/PostgREST cannot hold an open,
   externally-controlled transaction across two coordinated sessions).
3. `supabase start` — local Postgres on `127.0.0.1:54322`, local API gateway on
   `127.0.0.1:54321`.
4. `supabase db reset` — applies migrations 001–040 to the fresh local instance only.
5. Note the local `service_role` key: `supabase status` (needed by several scripts below).

## Running every test, in dependency order

```bash
# 1. Non-database provenance unit tests — ALREADY RUN, see "Executed results" below.
npx tsx supabase/tests/cbr-governed-flow/provenance-unit-tests.ts

# 2. Single-session SQL suite (AC-01–75 functional/outcome logic, all variants)
psql "$CBR_TEST_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/cbr-governed-flow/00-helpers.sql \
  -f supabase/tests/cbr-governed-flow/01-single-session-tests.sql
# Inspect NOTICE/WARNING/ERROR output for [PASS]/[FAIL]/[SUSPECT-PASS] per case.

# 3. Concurrency scripts (require step 2's fixtures? No — each script is self-contained and
#    re-runs 00-helpers.sql itself; run in any order, though ac58.sh first is conventional)
cd supabase/tests/cbr-governed-flow/concurrency
CBR_TEST_DB_URL="$CBR_TEST_DB_URL" ./ac58.sh
CBR_TEST_DB_URL="$CBR_TEST_DB_URL" ./ac-lockorder-and-concurrency.sh

# 4. API isolation (requires supabase start's API gateway; independent of steps 2-3)
CBR_TEST_API_URL=http://127.0.0.1:54321 \
CBR_TEST_LOCAL_SERVICE_KEY=<local service_role key> \
./ac68-api-isolation.sh

# 5. Intake failure isolation (requires the dev server started per the section above, in a
#    SEPARATE terminal, AND the local DB)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local key> npm run dev  # separate terminal
CBR_TEST_LOCAL_SUPABASE_URL=http://127.0.0.1:54321 \
CBR_TEST_LOCAL_SERVICE_KEY=<local service_role key> \
CBR_TEST_LOCAL_APP_URL=http://127.0.0.1:3000 \
npx tsx ../supabase/tests/cbr-governed-flow/ac69-intake-failure-isolation.ts

# 6. Cleanup: `supabase stop` tears down the entire disposable local stack, discarding all data
#    created by every script above. No script in this suite is destructive to anything outside
#    that disposable instance.
```

## Executed results (non-database)

```
$ npx tsx supabase/tests/cbr-governed-flow/provenance-unit-tests.ts
27 assertions, all [PASS]. Exercises the REAL production exports of
src/lib/intake/structured-profile.ts (acquireField, confirmField, emptyField) by import, not a
reimplementation. See the implementation report for full output.
```

## Coverage map (all files)

```
provenance-unit-tests.ts          — AC-24–30's TypeScript-layer claim (confirmField() PRODUCES the right value) — RUN, PASSING. Distinct from the SQL suite's claim that the DB layer COPIES whatever key is present.
review-surface-unit-tests.ts       — Finding 6: confirmation-timestamp source (structured_profile key translation, honest null handling) and OPENABLE/RESOLVABLE pure-function logic (src/lib/cbr/review-surface.ts) — RUN, PASSING.
00-helpers.sql                     — fixtures + assertion helpers (assert_eq, assert_not_null, assert_record_type, expect_superseded_by_pass/reject)
01-single-session-tests.sql        — AC-01–57 (sequential logic), AC-59/60, AC-67 (mechanism-only, disclosed), AC-71 (all 10 combinations), AC-72–75, AC-24–32 (DB-copy layer), AC-45–52 including real fault-injection for AC-46 and a constraint-only proof for AC-49
concurrency/ac58.sh                 — AC-58a
concurrency/ac-lockorder-and-concurrency.sh — AC-58b, AC-57(wait proof), AC-61, AC-62, AC-63, AC-64a, AC-64b, AC-64c, AC-65, AC-66(a/b/c, pg_locks-based)
concurrency/ac68-api-isolation.sh   — AC-68 (+ a public-function control call)
ac69-intake-failure-isolation.ts    — AC-69
```
AC-70 is a repository grep, not a script — see the implementation report for the exact commands
and results (it distinguishes column-name text matches from functional coupling).

AC-49 and AC-67 are honestly disclosed as PARTIAL / mechanism-only — see inline comments in
`01-single-session-tests.sql` and the implementation report for exactly what is and is not
exercised, and why (structural unreachability without an invasive, harder-to-restore bypass such
as dropping a unique index).

**Finding 6 (this round)**: a systematic header-vs-body audit of `01-single-session-tests.sql`
found that AC-22, AC-33, and AC-34 were claimed by a block's own comment header but never actually
asserted anywhere in the file's body — genuine, previously-undisclosed gaps, now closed (new
assertions added; see the delivery package's `AC-MATRIX.md` for exact line citations and the audit
method). AC-51 was found with no coverage claim and no assertion anywhere — disclosed as a
genuine, still-open gap, not attempted this round (judged too risky to fault-inject correctly
without live-database execution feedback). AC-23 (TX-04 sets `governing_submitted_at` from the
source observation's own originating submission, distinct from approval execution time) is proven
by `finding-03-single-session-fixture-corrections.sql`'s Block D, not by this file — see the
delivery package's individual AC matrix for the precise cross-reference. **A complete,
individually-traceable AC-01–AC-70 matrix (replacing this file's grouped-range coverage map for
review purposes) is maintained in the Finding 6 delivery package (`AC-MATRIX.md`), not duplicated
here — this map remains a quick-reference index only.**

## Correcting a prior claim about RPC calls before migration 040 exists

Do **not** assume any `db.rpc("cbr_tx0N_...")` call automatically returns `DISABLED` in an
environment where migration 040 has never been applied. Two distinct situations:
- **Functions installed, relevant gate disabled**: the function exists and runs its own logic,
  which returns `DISABLED` as a normal outcome (no error). This is what happens on a freshly
  `supabase db reset`-ed local instance before any `cbr_toggle_gate` call.
- **Functions not yet installed at all** (e.g., migration 040 was never applied, as in shared
  AUSCIS-TEST or Production today): PostgREST/Supabase-js returns an **RPC error**
  (`PGRST202`-shaped, function not found), not a `{outcome:"DISABLED"}` row. `/api/intake/route.ts`'s
  best-effort integration handles this correctly today — `const { error: cbrErr } = await
  db.rpc(...)` catches this as `cbrErr` (logged, non-fatal) exactly like any other CBR failure —
  but it is a genuinely different code path from the normal `DISABLED` outcome, and this
  distinction matters when interpreting logs from an environment where migration 040 is not yet
  applied.

## Safety

- `concurrency/lib.sh` fails closed if `CBR_TEST_DB_URL` does not resolve to
  `127.0.0.1`/`localhost`.
- `ac68-api-isolation.sh` fails closed the same way on `CBR_TEST_API_URL`.
- `ac69-intake-failure-isolation.ts` fails closed on `CBR_TEST_LOCAL_SUPABASE_URL`; it cannot,
  however, verify that a separately-started `npm run dev` process is actually using that same
  database — that is a manual prerequisite (see the section above), stated honestly as a limit of
  what this script can enforce from outside the app server's own process.
- This repo's other `supabase/tests/*` scripts (`run-sql.sh` and friends) deliberately target the
  shared AUSCIS-TEST project — none of that pattern is reused here.
