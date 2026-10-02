// AC-69 — Intake success survives a thrown/returned CBR error. Executable
// against a LOCAL stack only: `supabase start` (local Postgres) must already
// be running. Next.js is started and owned by this script itself (Local
// Harness Safety Correction round) — the operator must NOT start `npm run
// dev` manually, and must NOT edit .env.local. This script's own safety does
// not depend on repository env-file contents: see "ENVIRONMENT CONTAINMENT"
// below.
//
// Local Harness Precondition Remediation round: this script no longer
// requires a host `psql` on PATH, and no longer requires a pre-existing
// admin profile to be manually seeded. (1) All direct SQL now routes through
// `docker exec` into an explicitly supplied local DB container (see "Local
// Harness Owner-Approved DB Target round" below) instead of a bare host
// `psql` binary — a prior run on a host where `psql` was installed but not
// on PATH (Homebrew's libpq keg, unlinked by design) failed closed with
// `spawnSync psql ENOENT` before dispatching any request (see
// CBR040-AC69-EXEC-G). (2) The script now creates and owns its own gate
// actor (Step 0c) via direct SQL (auth.users + profiles, same id, role
// admin — no auto-profile trigger exists in this preserved database) instead
// of looking up and requiring a pre-existing admin profile ("seed one
// first"), which was previously an undocumented, out-of-harness manual
// precondition.
//
// Local Harness Owner-Approved DB Target round (CBR040-AC69-HARNESS-V3-
// PARAM-A): the local DB container name is no longer a hardcoded literal
// derived from this repository's own project_id — it is now a mandatory,
// fail-closed runtime input, `CBR_TEST_LOCAL_DB_CONTAINER`, read and
// validated exactly once, inside `assertLocalDbContainerRunning()` (the
// sole resolution point; `runDirectSql()` consumes its returned value and
// never reads the environment variable itself). This exists because a
// future AC-69 run must target a fresh, isolated, Baseline-V3-derived local
// Supabase project — never the historical, protected
// `supabase_db_ACTION-USA-AI` volume this repository's own project_id would
// otherwise deterministically resolve to (see CBR040-AC69-V3-ENV-B for the
// full "split-brain" rationale). There is no default and no fallback to
// that historical name: an unset, empty, malformed, or explicitly-protected
// value fails closed before any actor/fixture/gate/HTTP action.
//
// Never targets AUSCIS-TEST or Production — every local target (Supabase
// HTTP URL, Postgres URL, app URL) is strictly parsed and validated before
// any mutation or child-process start; see validateLocalHttpUrl /
// validateLocalPostgresUrl / validateLocalAppUrl. Fails closed on any
// malformed URL, any non-loopback hostname, or any URL containing a known
// AUSCIS-TEST or Production project ref. CBR_TEST_LOCAL_APP_URL specifically
// requires hostname EXACTLY 127.0.0.1 (Local Harness P2 Correction round,
// P2-03) — stricter than the Supabase/Postgres validators, which still
// accept 'localhost' — because this harness always spawns its own Next.js
// child bound to literal 127.0.0.1 (see startLocalNextApp), and keeping
// APP_URL identical to that by construction removes the possibility that
// 'localhost' resolves to a different loopback address (e.g. IPv6 '::1')
// than the child actually bound to.
//
// ENVIRONMENT CONTAINMENT (Local Harness Safety Correction round): a bare
// `npm run dev` would load `.env.local` via Next.js's own `@next/env`
// loader, which — verified directly against the installed package
// (node_modules/@next/env/dist/index.js's `processEnv`/`populate` logic) —
// only fills a variable from a `.env*` file if that variable is NOT already
// an own-key of `process.env` at the moment Next.js starts processing
// (`typeof p[t] === "undefined"`, not a truthiness check). This script
// exploits that exact, source-verified precedence rule: it starts its own
// Next.js child process with an explicitly constructed environment that
// already contains `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
// set to the validated LOCAL values, and `RESEND_API_KEY` set to an empty
// string (present, but falsy — route.ts's own `if (process.env.RESEND_API_KEY)`
// gate evaluates false). Because these three keys are already defined
// before Next.js's loader ever runs, whatever `.env.local` contains for
// them — including a real Production Supabase URL/key or a real Resend
// key, both confirmed present in this repository's `.env.local` at the
// time this correction was written — can never take effect in the child.
// `.env.local` itself is never read, written, or modified by this script.
//
// AUTH/PROFILE CLEANUP (Local Harness P2 Correction round, P2-01/P2-02):
// cleanup no longer depends on this script's own main-path code having
// reached the point where it captured the Auth user's id (route.ts's own
// inviteUserByEmail call is unconditional and may already have created the
// row even if a later assertion in this script throws first) — cleanup
// independently resolves the exact auth.users id by the known, per-run-
// unique fixture email if it wasn't already captured, proving cardinality
// (0/1/>1 rows) rather than assuming or arbitrarily picking one. Cleanup
// also no longer assumes `public.profiles.id REFERENCES auth.users(id) ON
// DELETE CASCADE` actually exists on the target local database — that
// relationship is visible in supabase/schema.sql but is NOT established as
// authoritative for whatever a fresh `supabase start`/`db reset` actually
// produces from the numbered migration chain (no migration creates
// public.profiles at all). Instead, cleanup checks for the table's
// existence via `to_regclass` before touching it, and if present, deletes
// the exact attributable profile row (by the same resolved id, since
// profiles.id is the well-known 1:1 extension of auth.users.id regardless
// of whether a formal FK/cascade is actually in force) explicitly, BEFORE
// deleting auth.users — children-before-parents, correct whether or not a
// cascade constraint exists.
//
// Self-cleanup: every row this script creates (client, case, invitation,
// the orphan fixture submission, the real submission /api/intake itself
// persists, and the auth.users/profiles rows inviteUserByEmail creates) is
// tracked/resolved and deleted at the end, in FK-safe order (children
// before parents), via a `finally` block that runs whether the functional
// assertions passed or failed. Cleanup deletes ONLY specifically-identified
// rows — never a broad/unscoped predicate. The harness-owned Next.js child
// is also always terminated in the same `finally` block, regardless of
// pass/fail. A cleanup or child-termination failure is reported distinctly
// from a functional-assertion failure (never silently merged or hidden)
// and, if it is the ONLY thing that failed, still fails the overall run.
//
// Gate/state restoration: this test enables g1g2 as part of its own
// fixture. A REQUIRED precondition, checked before any row is created, is
// that g1g2 already starts disabled with zero open admission windows — this
// is a disposable-local-only test and there is no single well-defined
// "prior state" to restore to otherwise, so it aborts rather than adapting
// silently if that is not already true. Cleanup then restores g1g2 to
// disabled and proves, by direct query (not by trusting the toggle call's
// return value alone), that the full final-state contract holds: g1g2
// disabled, zero open g1g2 admission windows, zero processing-state rows,
// zero canonical_beneficiary_records rows, zero intake_submissions, zero
// intake_invitations, zero cases, zero clients, zero auth.users for the
// exact fixture email, and (when public.profiles exists) zero attributable
// profiles rows for this execution's test fixtures.
//
// Invocation (once local Supabase is running — `supabase start`):
//   CBR_TEST_LOCAL_SERVICE_KEY=<local service_role key, from `supabase status`> \
//   npx tsx supabase/tests/cbr-governed-flow/ac69-intake-failure-isolation.ts
// (matches this repo's existing convention for supabase/tests/*.ts scripts
// — none of which are wired to an npm "test" script; all are run directly.)
// Do NOT start `npm run dev` yourself first — this script owns that process
// now and will refuse to run if its target port is already occupied.
//
// V1 (this file's prior revision, SHA-256 21294582dcd549926daa43476b5bb2052cc976999c0bbc7f5077edd215269a1e)
// was attempted once (CBR040-AC69-EXEC-G) and failed closed before dispatching any request, on
// the psql-PATH precondition above. V2 (this revision): statically reviewed only, UNEXECUTED —
// never run. AC-69 attempts remains 0; the first dispatched request will be AC-69 ATTEMPT #1.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync, spawn, type ChildProcessByStdio } from "child_process";
import type { Readable } from "stream";
import * as net from "net";
import * as path from "path";

// Known forbidden project refs — no validated URL may contain either,
// under any circumstance, anywhere in this script.
const AUSCIS_TEST_REF = "utpsqevarnxscdqzywkk";
const PRODUCTION_REF = "slasbfepqovdsezmadjh";
const FORBIDDEN_REFS = [AUSCIS_TEST_REF, PRODUCTION_REF] as const;

function assertNoForbiddenRef(raw: string, label: string): void {
  for (const ref of FORBIDDEN_REFS) {
    if (raw.includes(ref)) {
      throw new Error(`${label}: contains a forbidden project ref ('${ref}') — refusing.`);
    }
  }
}

// Strict, structurally-parsed (never substring-matched) local-only HTTP URL
// validation. Only exactly '127.0.0.1' or 'localhost' hostnames are
// accepted; IPv6 '::1', '*.localhost', DNS aliases that merely resolve to
// loopback, and any HTTPS/remote URL are all rejected. Performed before any
// mutation, request, or child-process start. Used for the Supabase HTTP
// target, which is never bound by this harness itself (only connected to),
// so 'localhost' vs '127.0.0.1' resolution differences don't create the
// same consistency risk App_URL has — see validateLocalAppUrl.
function validateLocalHttpUrl(raw: string, label: string): URL {
  assertNoForbiddenRef(raw, label);
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`${label}: malformed URL '${raw}'`);
  }
  if (u.protocol !== "http:") {
    throw new Error(`${label}: protocol must be exactly 'http:', got '${u.protocol}'`);
  }
  if (u.hostname !== "127.0.0.1" && u.hostname !== "localhost") {
    throw new Error(
      `${label}: hostname must be exactly '127.0.0.1' or 'localhost' (IPv6 '::1' and DNS aliases are deliberately not accepted), got '${u.hostname}'`
    );
  }
  return u;
}

function validateLocalPostgresUrl(raw: string, label: string): URL {
  assertNoForbiddenRef(raw, label);
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`${label}: malformed URL '${raw}'`);
  }
  if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") {
    throw new Error(`${label}: protocol must be 'postgresql:' or 'postgres:', got '${u.protocol}'`);
  }
  if (u.hostname !== "127.0.0.1" && u.hostname !== "localhost") {
    throw new Error(`${label}: hostname must be exactly '127.0.0.1' or 'localhost', got '${u.hostname}'`);
  }
  return u;
}

// Intentionally STRICTER than validateLocalHttpUrl (Local Harness P2
// Correction round, P2-03): only the exact hostname '127.0.0.1' is
// accepted — not 'localhost', not '::1', not '0.0.0.0', not any alias.
// This harness's own Next.js child is always spawned bound to literal
// 127.0.0.1 (see startLocalNextApp), so making APP_URL identical to that by
// construction removes the possibility of a resolution mismatch entirely,
// rather than relying on 'localhost' resolving the same way on every
// operator's machine.
function validateLocalAppUrl(raw: string, label: string): URL {
  assertNoForbiddenRef(raw, label);
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`${label}: malformed URL '${raw}'`);
  }
  if (u.protocol !== "http:") {
    throw new Error(`${label}: protocol must be exactly 'http:', got '${u.protocol}'`);
  }
  if (u.hostname !== "127.0.0.1") {
    throw new Error(
      `${label}: hostname must be exactly '127.0.0.1' (this harness always spawns its Next.js child bound to 127.0.0.1; 'localhost', '::1', '0.0.0.0', and any other value are rejected to remove any resolution-mismatch risk), got '${u.hostname}'`
    );
  }
  return u;
}

const RAW_SUPABASE_URL = process.env.CBR_TEST_LOCAL_SUPABASE_URL || "http://127.0.0.1:54321";
const RAW_DB_URL = process.env.CBR_TEST_DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const RAW_APP_URL = process.env.CBR_TEST_LOCAL_APP_URL || "http://127.0.0.1:3000";
// Read directly from this script's own required env var — never from
// .env.local, never with any fallback. This test's safety must not depend
// on repository env-file contents.
const SERVICE_KEY = process.env.CBR_TEST_LOCAL_SERVICE_KEY;

// All target validation happens before any mutation, request, or child
// process start — see the calls below, at module load time.
const SUPABASE_URL_PARSED = validateLocalHttpUrl(RAW_SUPABASE_URL, "CBR_TEST_LOCAL_SUPABASE_URL");
const DB_URL_PARSED = validateLocalPostgresUrl(RAW_DB_URL, "CBR_TEST_DB_URL");
const APP_URL_PARSED = validateLocalAppUrl(RAW_APP_URL, "CBR_TEST_LOCAL_APP_URL");

const SUPABASE_URL = RAW_SUPABASE_URL;
const DB_URL = RAW_DB_URL;
const APP_URL = RAW_APP_URL;
const APP_HOST = APP_URL_PARSED.hostname; // guaranteed exactly "127.0.0.1" by validateLocalAppUrl
const APP_PORT = APP_URL_PARSED.port ? Number(APP_URL_PARSED.port) : 3000;

if (!SERVICE_KEY) {
  console.error("ABORT: set CBR_TEST_LOCAL_SERVICE_KEY (from `supabase status` on the LOCAL stack). Never read from .env.local.");
  process.exit(1);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertUuid(value: string, label: string): string {
  if (!UUID_RE.test(value)) throw new Error(`assertUuid: ${label} is not a well-formed UUID: '${value}'`);
  return value;
}

// Narrow SQL-literal string escaper (single-quote doubling) — used
// wherever a harness-controlled value is interpolated into a direct-SQL
// string (Local Harness P2 Correction round, defense-in-depth on top of
// the already-safe base36 runId alphabet). Not a general query
// abstraction — only this one narrow purpose.
function sqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

// Owner-approved (CBR040-AC69-HARNESS-V3-PARAM-A) mandatory local DB-target input. No default,
// no fallback -- read once, here, as a bare declaration; all resolution/validation happens inside
// assertLocalDbContainerRunning() (the sole authoritative point), never here and never in
// runDirectSql(). PROTECTED_HISTORICAL_DB_CONTAINER names the historical, protected
// Baseline-V2-derived volume this harness must never target, even though its literal text would
// otherwise satisfy LOCAL_DB_CONTAINER_RE's own positive allowlist -- it is checked by explicit
// equality, not by the regex, exactly because the regex alone cannot exclude it.
const RAW_LOCAL_DB_CONTAINER = process.env.CBR_TEST_LOCAL_DB_CONTAINER;
const PROTECTED_HISTORICAL_DB_CONTAINER = "supabase_db_ACTION-USA-AI";
// Positive allowlist only: the exact local Supabase CLI container-naming form
// (`supabase_db_<project_id>`), restricted to Docker's own permitted container-name character
// set after that fixed prefix. Matches both every project_id this engagement has ever used
// (e.g. "ACTION-USA-AI", "cbr040-v3-smoke") and Docker's own documented naming rule -- not
// independently invented. Structurally rejects whitespace, slashes, quotes, shell metacharacters,
// URL schemes, and control characters, since none of those are members of the allowed class.
const LOCAL_DB_CONTAINER_RE = /^supabase_db_[A-Za-z0-9_.-]+$/;

// Local Harness Precondition Remediation round: runDirectSql previously invoked a bare host
// "psql" via execFileSync, which failed with ENOENT on a host where psql is installed but not on
// PATH (Homebrew's libpq keg is install-location/architecture-dependent and unlinked by design).
// Routing through `docker exec` into an explicitly supplied local Supabase Postgres container
// removes that host-PATH dependency entirely and is MORE local-contained than a host binary:
// docker exec cannot reach anything outside the named container's own network namespace,
// regardless of any inherited PG*/DATABASE_URL environment variable. DB_URL is still validated
// above (validateLocalPostgresUrl) as a second, independent local-only safety check, even though
// it is no longer passed as a connection string here.
//
// Local Harness Owner-Approved DB Target round: this function is now the sole authoritative point
// that resolves and validates CBR_TEST_LOCAL_DB_CONTAINER (mandatory, fail-closed, no fallback to
// the historical protected container) before returning the validated target to its one caller,
// runDirectSql() -- which never reads the environment variable itself, so SQL execution against
// an unvalidated or historical target is structurally impossible.
function assertLocalDbContainerRunning(): string {
  const raw = RAW_LOCAL_DB_CONTAINER;
  if (raw === undefined || raw.trim() === "" || raw !== raw.trim()) {
    throw new Error(
      `PRECONDITION_SQL_EXECUTOR_FAILURE: CBR_TEST_LOCAL_DB_CONTAINER must be set to the exact local Docker container name of the target Baseline-V3-derived Supabase project's PostgreSQL service (no default, no fallback) -- got ${raw === undefined ? "undefined" : `'${raw}'`}.`
    );
  }
  if (!LOCAL_DB_CONTAINER_RE.test(raw)) {
    throw new Error(
      `PRECONDITION_SQL_EXECUTOR_FAILURE: CBR_TEST_LOCAL_DB_CONTAINER '${raw}' does not match the required local Supabase DB container naming form (must start with 'supabase_db_' and contain only letters, digits, '_', '.', '-' after that prefix).`
    );
  }
  if (raw === PROTECTED_HISTORICAL_DB_CONTAINER) {
    throw new Error(
      `PRECONDITION_SQL_EXECUTOR_FAILURE: CBR_TEST_LOCAL_DB_CONTAINER must not be the protected historical container '${PROTECTED_HISTORICAL_DB_CONTAINER}' -- this harness must never target that database.`
    );
  }
  let state: string;
  try {
    state = execFileSync("docker", ["inspect", raw, "--format", "{{.State.Running}}"], {
      encoding: "utf8",
    }).trim();
  } catch (e) {
    throw new Error(
      `PRECONDITION_SQL_EXECUTOR_FAILURE: could not inspect local DB container '${raw}' (is \`supabase start\` running?): ${e instanceof Error ? e.message : String(e)}`
    );
  }
  if (state !== "true") {
    throw new Error(
      `PRECONDITION_SQL_EXECUTOR_FAILURE: local DB container '${raw}' is not running (state='${state}') — run \`supabase start\` first.`
    );
  }
  return raw;
}

// Direct SQL connection to the isolated disposable database — the ONLY
// route to cbr_internal (and, here, to auth.users), which
// supabase-js/PostgREST cannot reach for cbr_internal (see header comment)
// and which is more precise than the Admin REST API for a single scoped
// lookup. Fails immediately (throws) on any psql/SQL error; no silent
// no-op.
function runDirectSql(sql: string): string {
  const container = assertLocalDbContainerRunning();
  try {
    return execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-q", "-t", "-c", sql],
      { encoding: "utf8" }
    ).trim();
  } catch (e) {
    throw new Error(`PRECONDITION_SQL_EXECUTOR_FAILURE: docker exec psql failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Safe, read-only local-metadata existence check (Local Harness P2
// Correction round, P2-02) — never assumes a table exists merely because
// supabase/schema.sql describes it; the numbered migration chain does not
// itself create public.profiles, so this is checked explicitly before any
// profile-specific operation.
function localTableExists(qualifiedName: string): boolean {
  const result = runDirectSql(`SELECT to_regclass('${qualifiedName}');`);
  return result !== "";
}

// Resolves the exact auth.users id for a given fixture email, proving
// cardinality rather than assuming or arbitrarily choosing one (Local
// Harness P2 Correction round, P2-01). Returns null for zero matches,
// throws for more than one (never silently picks one, never broad-
// deletes). Shared by both the main-path Auth-user identification (Step 7)
// and cleanup's partial-failure fallback — a single mechanism, not two
// divergent ones.
function resolveAuthUserIdByEmail(email: string): string | null {
  const raw = runDirectSql(`SELECT id FROM auth.users WHERE email='${sqlLiteral(email)}';`);
  if (raw === "") return null;
  const rows = raw.split("\n").filter((l) => l.length > 0);
  if (rows.length > 1) {
    throw new Error(`resolveAuthUserIdByEmail: ${rows.length} auth.users rows matched fixture email '${email}' (expected 0 or 1) — refusing to choose one arbitrarily.`);
  }
  return assertUuid(rows[0], "authUserId (resolved by email)");
}

// ---------------------------------------------------------------------
// Harness-owned Next.js child process
// ---------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

function isPortFree(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, host);
  });
}

interface ManagedApp {
  // stdio: ["ignore","pipe","pipe"] below matches the `spawn()` overload
  // returning ChildProcessByStdio<null, Readable, Readable> (@types/node's
  // child_process.d.ts, SpawnOptionsWithStdioTuple<StdioNull, StdioPipe,
  // StdioPipe> overload) — verified against the installed type
  // declarations, not ChildProcessWithoutNullStreams (which requires a
  // non-null stdin).
  child: ChildProcessByStdio<null, Readable, Readable>;
  chunks: string[];
  logOffset(): number;
  readSince(offset: number): string;
}

// Starts `npm run dev` (the repository's existing, unmodified dev script)
// as its own child, forwarding an explicit -p/-H so it binds to exactly the
// validated local target this script will call — never package.json
// itself. Refuses to start (FAIL CLOSED) if the target port is already in
// use, rather than silently reusing whatever is listening there. `-H`
// always uses the same APP_HOST constant APP_URL itself was parsed from
// (guaranteed "127.0.0.1" by validateLocalAppUrl) — never a separately
// hard-coded literal — so the child's bind target and the URL this script
// calls can never drift apart.
async function startLocalNextApp(env: NodeJS.ProcessEnv): Promise<ManagedApp> {
  const free = await isPortFree(APP_PORT, APP_HOST);
  if (!free) {
    throw new Error(
      `ABORT: ${APP_HOST}:${APP_PORT} is already in use by another process. Refusing to reuse an existing listener — stop it first or choose a different CBR_TEST_LOCAL_APP_URL port.`
    );
  }
  const child = spawn("npm", ["run", "dev", "--", "-p", String(APP_PORT), "-H", APP_HOST], {
    cwd: REPO_ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    // New process group (setsid): lets cleanup terminate the whole tree
    // `npm run dev` spawns (npm -> next dev -> workers), never an arbitrary
    // unrelated process, via a single negative-pid signal to this exact
    // group.
    detached: true,
  });
  const chunks: string[] = [];
  child.stdout.on("data", (d: Buffer) => chunks.push(d.toString("utf8")));
  child.stderr.on("data", (d: Buffer) => chunks.push(d.toString("utf8")));
  return {
    child,
    chunks,
    logOffset: () => chunks.join("").length,
    readSince: (offset: number) => chunks.join("").slice(offset),
  };
}

// Bounded readiness wait. Polls the root path only (never /api/intake,
// never creates business state) — any HTTP response at all (regardless of
// status code) proves the server is accepting connections. Aborts early if
// the child exits before becoming ready.
async function waitForReady(app: ManagedApp, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (app.child.exitCode !== null || app.child.signalCode !== null) {
      throw new Error(
        `ABORT: the harness-owned Next.js child exited before becoming ready (code=${app.child.exitCode}, signal=${app.child.signalCode}). Captured output:\n${app.chunks.join("")}`
      );
    }
    try {
      const res = await fetch(APP_URL, { method: "GET" });
      if (res.status > 0) return;
    } catch {
      // not ready yet (e.g. connection refused) — keep polling
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`ABORT: the harness-owned Next.js child did not become ready within ${timeoutMs}ms.`);
}

// Bounded, scoped shutdown: SIGTERM the exact process group this harness
// created, wait, escalate to SIGKILL only against that same group if
// needed. Never touches any other process.
async function stopLocalNextApp(app: ManagedApp): Promise<{ ok: boolean; detail: string }> {
  if (app.child.exitCode !== null || app.child.signalCode !== null) {
    return { ok: true, detail: "child already exited" };
  }
  const pid = app.child.pid;
  if (!pid) return { ok: false, detail: "no pid recorded for the harness-owned child — cannot terminate" };

  const waitForExit = (ms: number): Promise<boolean> =>
    new Promise((resolve) => {
      const t = setTimeout(() => resolve(false), ms);
      app.child.once("exit", () => {
        clearTimeout(t);
        resolve(true);
      });
    });

  try {
    process.kill(-pid, "SIGTERM");
  } catch (e) {
    return { ok: false, detail: `SIGTERM to process group -${pid} failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (await waitForExit(5000)) {
    return { ok: true, detail: "child process group terminated via SIGTERM" };
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch (e) {
    return { ok: false, detail: `child did not exit after SIGTERM, and SIGKILL to process group -${pid} failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  return (await waitForExit(5000))
    ? { ok: true, detail: "child process group did not exit after SIGTERM; SIGKILL succeeded" }
    : { ok: false, detail: "child process group did not exit even after SIGKILL — manual cleanup required" };
}

// ---------------------------------------------------------------------
// Fixture bookkeeping and cleanup
// ---------------------------------------------------------------------

// Every id this execution creates, tracked as soon as each insert
// succeeds — never a name pattern, timestamp range, or other broad
// predicate. `realSubIds` is an array (not a single id) so the cleanup
// path also covers the anomalous 0-or->1-row case the length assertion
// below guards against, without needing to guess which row is "the" one.
// `adminId`/`gateToggledOn` track whether this execution actually
// mutated CBR operational state, so cleanup can restore it precisely and
// only when it actually needs to. `invitationEmail` (set early, before the
// HTTP call) is the durable identity cleanup falls back to for Auth/profile
// resolution even when `authUserId` (only ever set at Step 7, after several
// assertions that could throw first) was never captured — see
// resolveAuthUserIdByEmail and cleanupTestState.
interface CreatedIds {
  clientId?: string;
  caseId?: string;
  invitationId?: string;
  orphanSubId?: string;
  realSubIds: string[];
  adminId?: string; // Local Harness Precondition Remediation round: now always the harness-OWNED, harness-CREATED gate actor (Step 0c) -- never a pre-existing looked-up profile.
  gateActorEmail?: string;
  gateToggledOn: boolean;
  invitationEmail?: string;
  authUserId?: string;
}

// cleanupTestState: deletes exactly the rows this execution created, in
// FK-safe order (children before parents): the exact attributable
// auth.users/public.profiles rows (resolved below, independent of whether
// this execution's own code ever captured an id — see P2-01/P2-02 in the
// header comment) -> canonical_beneficiary_records (references
// client_id/source_submission_id) -> intake_submissions (orphan + real;
// reference invitation_id/client_id/case_id) -> intake_invitations
// (references case_id/client_id) -> cases (references client_id) ->
// clients last. Every delete is scoped by an exact id — never a broad
// predicate (e.g. never a bare `.delete()` with no `.eq(...)`, never a
// LIKE/date-range match). Then restores g1g2 to disabled (only if this
// execution actually toggled it on), and finally PROVES the complete
// final-state contract by direct queries — not by trusting that the
// deletes/restore calls above merely returned without error. Collects
// every individual error rather than stopping at the first one, so a
// single failure does not prevent attempting everything else.
async function cleanupTestState(db: SupabaseClient, created: CreatedIds): Promise<{ ok: boolean; detail: string }> {
  const errors: string[] = [];

  // Auth/profile cleanup (Local Harness P2 Correction round). Resolve the
  // definitive auth.users id from whichever source is available: the id
  // captured at Step 7 if execution got that far, or a fresh, cardinality-
  // proven lookup by the known fixture email otherwise (covers the
  // partial-failure case — route.ts's own inviteUserByEmail call is
  // unconditional and may have already created the row even though this
  // script's own later code never reached the point of recording it).
  let resolvedAuthId: string | null = created.authUserId ?? null;
  if (!resolvedAuthId && created.invitationEmail) {
    try {
      resolvedAuthId = resolveAuthUserIdByEmail(created.invitationEmail);
    } catch (e) {
      errors.push(`auth.users cardinality resolution (fallback) failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (resolvedAuthId) {
    // profiles.id is the well-known 1:1 extension of auth.users.id
    // (supabase/schema.sql), used here directly WITHOUT assuming its
    // ON DELETE CASCADE is actually in force on the target database —
    // deleted explicitly, by the same resolved id, before auth.users
    // (children before parents), which is correct whether or not that
    // cascade constraint exists. The table's existence itself is never
    // assumed: the numbered migration chain does not create
    // public.profiles, so schema.sql is not established authority for a
    // freshly-built local stack.
    let profilesExists = false;
    try {
      profilesExists = localTableExists("public.profiles");
    } catch (e) {
      errors.push(`public.profiles existence check failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (profilesExists) {
      const { error: profileErr } = await db.from("profiles").delete().eq("id", resolvedAuthId);
      if (profileErr) errors.push(`profiles delete (id=${resolvedAuthId}): ${profileErr.message}`);
    }
    const { error: authErr } = await db.auth.admin.deleteUser(resolvedAuthId);
    if (authErr) errors.push(`auth.users delete (id=${resolvedAuthId}): ${authErr.message}`);
  }

  if (created.clientId) {
    const { error } = await db.from("canonical_beneficiary_records").delete().eq("client_id", created.clientId);
    if (error) errors.push(`canonical_beneficiary_records (client_id=${created.clientId}): ${error.message}`);
  }
  for (const subId of created.realSubIds) {
    const { error } = await db.from("intake_submissions").delete().eq("id", subId);
    if (error) errors.push(`intake_submissions (id=${subId}, real): ${error.message}`);
  }
  if (created.orphanSubId) {
    const { error } = await db.from("intake_submissions").delete().eq("id", created.orphanSubId);
    if (error) errors.push(`intake_submissions (id=${created.orphanSubId}, orphan fixture): ${error.message}`);
  }
  if (created.invitationId) {
    const { error } = await db.from("intake_invitations").delete().eq("id", created.invitationId);
    if (error) errors.push(`intake_invitations (id=${created.invitationId}): ${error.message}`);
  }
  if (created.caseId) {
    const { error } = await db.from("cases").delete().eq("id", created.caseId);
    if (error) errors.push(`cases (id=${created.caseId}): ${error.message}`);
  }
  if (created.clientId) {
    const { error } = await db.from("clients").delete().eq("id", created.clientId);
    if (error) errors.push(`clients (id=${created.clientId}): ${error.message}`);
  }

  // Gate/window restoration: only if THIS execution actually toggled
  // g1g2 on. If it never got as far as toggling (e.g. the pre-test
  // precondition itself failed), there is nothing to restore.
  if (created.gateToggledOn) {
    if (!created.adminId) {
      errors.push("g1g2 was toggled on but no adminId was recorded to restore it with -- this should be structurally impossible (adminId is captured before the toggle) and indicates a bug in this script itself");
    } else {
      try {
        const toggleOff = runDirectSql(`SELECT outcome FROM cbr_internal.cbr_toggle_gate('g1g2', false, '${created.adminId}'::uuid);`);
        if (toggleOff !== "TOGGLED" && toggleOff !== "NO_CHANGE") {
          errors.push(`g1g2 restore-to-disabled returned unexpected outcome '${toggleOff}'`);
        }
      } catch (e) {
        errors.push(`g1g2 restore-to-disabled threw: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // Gate-actor cleanup (Local Harness Precondition Remediation round): the harness-owned gate
  // actor (Step 0c) is deleted only AFTER the gate-restore call above, since that call's own
  // authorization check (migration 040's cbr_toggle_gate) requires the actor's profile to still
  // exist. Explicit, children-before-parents (profiles before auth.users) -- same defensive
  // philosophy already used for the application identity above, regardless of whether Baseline
  // V2's ON DELETE CASCADE would otherwise handle it. Tolerates a partially-created actor (e.g.
  // the auth.users row exists but the profiles insert never completed) -- each DELETE is a safe
  // no-op if its target row does not exist.
  if (created.adminId) {
    try {
      runDirectSql(`DELETE FROM public.profiles WHERE id='${created.adminId}'::uuid;`);
      runDirectSql(`DELETE FROM auth.users WHERE id='${created.adminId}'::uuid;`);
    } catch (e) {
      errors.push(`gate actor cleanup (id=${created.adminId}) failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      const finalGateActorAuth = runDirectSql(`SELECT count(*) FROM auth.users WHERE id='${created.adminId}'::uuid;`);
      if (finalGateActorAuth !== "0") errors.push(`final auth.users count for gate actor id=${created.adminId}='${finalGateActorAuth}', expected '0'`);
      const finalGateActorProfile = runDirectSql(`SELECT count(*) FROM public.profiles WHERE id='${created.adminId}'::uuid;`);
      if (finalGateActorProfile !== "0") errors.push(`final profiles count for gate actor id=${created.adminId}='${finalGateActorProfile}', expected '0'`);
    } catch (e) {
      errors.push(`gate actor final-state verification failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Final-state proof: every condition the test contract requires,
  // verified directly -- not merely inferred from "the delete/restore
  // calls above did not error".
  try {
    const finalEnabled = runDirectSql(`SELECT enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g1g2';`);
    if (finalEnabled !== "f") errors.push(`final g1g2.enabled='${finalEnabled}', expected 'f'`);
    const finalOpenWindows = runDirectSql(`SELECT count(*) FROM cbr_internal.cbr_field_admission_window WHERE gate='g1g2' AND closed_at IS NULL;`);
    if (finalOpenWindows !== "0") errors.push(`final open g1g2 admission windows='${finalOpenWindows}', expected '0'`);
    if (created.clientId) {
      const finalPcs = runDirectSql(`SELECT count(*) FROM cbr_internal.cbr_field_processing_state WHERE client_id='${created.clientId}'::uuid;`);
      if (finalPcs !== "0") errors.push(`final processing-state rows for test client='${finalPcs}', expected '0'`);
    }
  } catch (e) {
    errors.push(`gate/processing-state final-state verification failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (created.clientId) {
    const checks: Array<[string, string, string]> = [
      ["canonical_beneficiary_records", "client_id", created.clientId],
      ["intake_submissions", "client_id", created.clientId],
      ["intake_invitations", "client_id", created.clientId],
      ["cases", "client_id", created.clientId],
      ["clients", "id", created.clientId],
    ];
    for (const [table, column, value] of checks) {
      const { count, error } = await db.from(table).select("id", { count: "exact", head: true }).eq(column, value);
      if (error) errors.push(`final ${table} count check failed: ${error.message}`);
      else if ((count ?? 0) !== 0) errors.push(`final ${table} rows for test client=${count}, expected 0`);
    }
  }

  // Auth/profile final-state proof (Local Harness P2 Correction round): no
  // auth.users row may remain for the exact, per-run-unique fixture email,
  // regardless of whether an id was ever captured above. profiles is only
  // checked if it actually exists on this database; if it does not,
  // profile cleanup is NOT APPLICABLE for this run rather than an error.
  if (created.invitationEmail) {
    try {
      const remainingUsers = runDirectSql(`SELECT count(*) FROM auth.users WHERE email='${sqlLiteral(created.invitationEmail)}';`);
      if (remainingUsers !== "0") errors.push(`final auth.users count for fixture email='${remainingUsers}', expected '0'`);
    } catch (e) {
      errors.push(`auth.users final-state verification failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (resolvedAuthId) {
    try {
      if (localTableExists("public.profiles")) {
        const remainingProfiles = runDirectSql(`SELECT count(*) FROM public.profiles WHERE id='${resolvedAuthId}'::uuid;`);
        if (remainingProfiles !== "0") errors.push(`final profiles count for id=${resolvedAuthId}='${remainingProfiles}', expected '0'`);
      }
      // else: public.profiles does not exist on this database -- profile
      // cleanup is NOT APPLICABLE for this run, not an error.
    } catch (e) {
      errors.push(`profiles final-state verification failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, detail: errors.join(" | ") };
  }
  return { ok: true, detail: "all test-created rows removed (including any attributable auth.users/profiles rows); g1g2 restored to disabled with zero open windows; full final-state contract verified" };
}

async function main() {
  const db = createClient(SUPABASE_URL, SERVICE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const created: CreatedIds = { realSubIds: [], gateToggledOn: false };
  let testFailure: string | null = null;
  let app: ManagedApp | null = null;

  try {
    // 0. Pre-test safety precondition (Final Test-Coverage Integrity
    //    Correction round): g1g2 must already be disabled with zero open
    //    admission windows before this test creates or mutates anything.
    //    This test enables g1g2 as part of its own fixture and must
    //    restore this exact state at the end -- if the environment is not
    //    already in it, "restore to what it was" is not well-defined, so
    //    the correct, safe behavior for a disposable-local-only test is to
    //    require this precondition and abort before creating any row if it
    //    does not hold, rather than silently adapting to whatever state is
    //    found.
    const g1g2EnabledBefore = runDirectSql(`SELECT enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g1g2';`);
    const g1g2OpenWindowsBefore = runDirectSql(`SELECT count(*) FROM cbr_internal.cbr_field_admission_window WHERE gate='g1g2' AND closed_at IS NULL;`);
    if (g1g2EnabledBefore !== "f" || g1g2OpenWindowsBefore !== "0") {
      throw new Error(`PRECONDITION FAILED: g1g2 must start disabled with zero open admission windows for this disposable-local-only test. Found enabled='${g1g2EnabledBefore}', open_windows='${g1g2OpenWindowsBefore}'. Reset the local stack (supabase db reset) before running AC-69.`);
    }
    console.log("[SETUP] pre-test precondition verified: g1g2 disabled, zero open admission windows.");

    // 0c. Harness-owned gate actor (Local Harness Precondition Remediation round): previously
    //     this script LOOKED UP a pre-existing admin profile and threw "seed one first" if none
    //     existed -- an undocumented, out-of-harness manual precondition (see EXEC-G). The
    //     harness now creates and owns this actor's full lifecycle itself. No auto-profile
    //     trigger exists in this preserved database (handle_new_user/on_auth_user_created are
    //     confirmed absent from Baseline V2 + migrations 001-040) -- so the two-INSERT pattern
    //     (auth.users, then profiles, same id) is required, not a trigger-dependent one.
    //     Committed via direct SQL (not transaction-local), since this actor must remain valid
    //     for the governed gate-toggle call and the whole subsequent HTTP-triggered experiment.
    //     Deliberately a SEPARATE identity from the application/beneficiary auth user
    //     inviteUserByEmail creates later (Step 7) -- gate-actor lifecycle and application/
    //     invitation lifecycle are kept distinct, not merged.
    const gateActorId = crypto.randomUUID();
    const gateActorEmail = `ac69-gateactor-${gateActorId}@example.invalid`;
    created.gateActorEmail = gateActorEmail;
    runDirectSql(
      `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role) VALUES ('${gateActorId}', '${sqlLiteral(gateActorEmail)}', '', now(), now(), now(), 'authenticated', 'authenticated');`
    );
    created.adminId = gateActorId; // set immediately after the auth.users insert succeeds, so cleanup can resolve a partially-created actor even if the profiles insert below throws
    runDirectSql(
      `INSERT INTO public.profiles (id, email, full_name, role) VALUES ('${gateActorId}', '${sqlLiteral(gateActorEmail)}', 'AC69 Gate Actor', 'admin'::public.user_role);`
    );
    const gateActorRole = runDirectSql(`SELECT role::TEXT FROM public.profiles WHERE id='${gateActorId}'::uuid;`);
    if (gateActorRole !== "admin") {
      throw new Error(`ACTOR_FIXTURE_FAILURE: expected harness-owned gate actor role='admin', found '${gateActorRole}' for id=${gateActorId}`);
    }
    console.log(`[SETUP] harness-owned gate actor created and verified: id=${gateActorId} email=${gateActorEmail} role=admin.`);

    // 0b. Start and own the Next.js dev process (Local Harness Safety
    //     Correction round). The explicit environment constructed here is
    //     what makes AC-69 safe to run even though .env.local, on this
    //     machine, currently contains a real Production Supabase binding
    //     and a real Resend key — see the header comment's "ENVIRONMENT
    //     CONTAINMENT" section for the exact, source-verified mechanism.
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      // Present (not omitted) and empty: already an own-key of the child's
      // process.env before Next.js's @next/env loader ever runs, which
      // — per the installed package's own `processEnv`/`populate` logic —
      // only fills a variable from .env.local when it is NOT already
      // defined (`typeof p[t] === "undefined"`), not merely falsy. An
      // empty string blocks that fill AND makes route.ts's own
      // `if (process.env.RESEND_API_KEY)` gate evaluate false.
      RESEND_API_KEY: "",
    };
    console.log(`[SETUP] starting harness-owned Next.js dev server on http://${APP_HOST}:${APP_PORT} (explicit local-only environment; RESEND_API_KEY forced empty)...`);
    app = await startLocalNextApp(childEnv);
    await waitForReady(app);
    console.log("[SETUP] harness-owned Next.js child is ready.");

    // 1. Create a client/case/invitation via direct service-role inserts —
    //    same minimal shape as the SQL suite's helpers, since this script
    //    exercises the real HTTP intake endpoint, not the SQL functions
    //    directly. Invitation email is per-run-unique (Local Harness Safety
    //    Correction round) to remove any collision risk with a prior,
    //    interrupted run's stale fixture.
    const { data: client, error: clientErr } = await db.from("clients").insert({ first_name: "AC69", last_name: "Test" }).select("id, email").single();
    if (clientErr || !client) throw new Error(`client insert failed: ${clientErr?.message}`);
    created.clientId = client.id;
    const emailBefore = client.email;

    const { data: caseRow, error: caseErr } = await db.from("cases").insert({ client_id: client.id, case_type: "otro", title: "AC-69 test case" }).select("id").single();
    if (caseErr || !caseRow) throw new Error(`case insert failed: ${caseErr?.message}`);
    created.caseId = caseRow.id;

    const runId = Math.random().toString(36).slice(2);
    const token = "ac69-" + runId;
    const invitationEmail = `ac69-${runId}@example.invalid`;
    // Recorded immediately, before the HTTP call, so cleanup can resolve
    // and remove any Auth user this run's /api/intake call creates even if
    // a later assertion throws before Step 7 ever runs (P2-01).
    created.invitationEmail = invitationEmail;
    const { data: invitation, error: invErr } = await db
      .from("intake_invitations")
      .insert({ token, case_id: caseRow.id, client_id: client.id, email: invitationEmail })
      .select("id")
      .single();
    if (invErr || !invitation) throw new Error(`invitation insert failed: ${invErr?.message}`);
    created.invitationId = invitation.id;

    // 2. Enable g1g2 (opens its admission window at real clock_timestamp()),
    //    then induce a GENUINE CBR_INTERNAL_INCONSISTENCY precondition for
    //    THIS client's 'email' field: a canonical_beneficiary_records row
    //    exists for (client_id, 'email') while NO processing-state row does
    //    -- exactly the state cbr_tx01_realize_g1g2's own STEP 9/10
    //    integrity check treats as corruption (migration 040, ~line 463-468:
    //    "governing_submission_id IS NULL" + a CBR row already present for
    //    that client/field). Deliberately no matching processing-state row.
    // Residual correction: cbr_toggle_gate lives in cbr_internal, which is
    // deliberately NOT exposed via PostgREST (migration 039's header) --
    // calling it through supabase-js's db.rpc() 404s exactly like AC-68
    // proves for every cbr_internal function, meaning the prior
    // `await db.rpc("cbr_toggle_gate", ...)` here was an unchecked no-op:
    // the gate was never actually toggled, so the admission window this
    // whole fixture depends on never actually opened. Fixed: direct SQL via
    // psql, output checked immediately, then the resulting DB state is
    // independently re-verified (not just trusted from the outcome string).
    const toggleOutcome = runDirectSql(`SELECT outcome FROM cbr_internal.cbr_toggle_gate('g1g2', true, '${gateActorId}'::uuid);`);
    if (toggleOutcome !== "TOGGLED" && toggleOutcome !== "NO_CHANGE") {
      throw new Error(`cbr_toggle_gate('g1g2', true, ...) returned unexpected outcome '${toggleOutcome}' (expected TOGGLED or NO_CHANGE) -- aborting rather than proceeding on an unverified gate state.`);
    }
    const g1g2Enabled = runDirectSql(`SELECT enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g1g2';`);
    if (g1g2Enabled !== "t") {
      throw new Error(`Setup verification failed: cbr_field_gate_state.enabled for g1g2 is '${g1g2Enabled}', expected 't'.`);
    }
    const g1g2OpenedAt = runDirectSql(`SELECT opened_at FROM cbr_internal.cbr_field_admission_window WHERE gate='g1g2' AND closed_at IS NULL ORDER BY opened_at DESC LIMIT 1;`);
    if (!g1g2OpenedAt) {
      throw new Error("Setup verification failed: no open g1g2 admission window found (expected exactly one row with closed_at IS NULL).");
    }
    // Recorded only now, after both the toggle call AND its independent
    // re-verification succeeded -- so cleanup's gate-restore step never
    // fires for a toggle attempt that did not actually leave the gate
    // enabled.
    created.gateToggledOn = true;
    console.log(`[SETUP] g1g2 gate enabled=true, admission window open since ${g1g2OpenedAt} (verified via direct SQL against the real state, not inferred from the toggle call's return value alone).`);

    const { data: orphanSub, error: orphanSubErr } = await db.from("intake_submissions").insert({
      client_id: client.id, case_id: caseRow.id, invitation_id: invitation.id, structured_profile: {},
    }).select("id").single();
    if (orphanSubErr || !orphanSub) throw new Error(`orphan submission insert failed: ${orphanSubErr?.message}`);
    created.orphanSubId = orphanSub.id;

    const { error: orphanRowErr } = await db.from("canonical_beneficiary_records").insert({
      client_id: client.id, record_type: "CANDIDATE_OBSERVED", field_key: "email",
      source_submission_id: orphanSub.id, candidate_value: "orphan@example.invalid",
    });
    if (orphanRowErr) throw new Error(`orphan CANDIDATE_OBSERVED insert failed: ${orphanRowErr.message}`);

    // Verify the corruption precondition directly, before sending the
    // intake request: no processing-state row may exist yet for
    // (client, email), or STEP 9/10's integrity check has nothing to fire
    // on. cbr_field_processing_state is cbr_internal-schema too, so this
    // also goes through the direct SQL connection.
    assertUuid(client.id, "client.id");
    const processingStateCount = runDirectSql(`SELECT count(*) FROM cbr_internal.cbr_field_processing_state WHERE client_id='${client.id}'::uuid AND field_key='email';`);
    if (processingStateCount !== "0") {
      throw new Error(`Setup verification failed: expected 0 cbr_field_processing_state rows for (client, email) precondition, found ${processingStateCount}.`);
    }
    console.log("[SETUP] corruption precondition verified via direct SQL: 1 orphan CANDIDATE_OBSERVED row exists for (client, email), 0 processing-state rows exist for the same pair.");

    // 3. Call the REAL /api/intake endpoint (served by this script's own,
    //    environment-controlled Next.js child) with a fresh invitation
    //    token, sending a structuredProfile.email that is GENUINELY
    //    eligible for TX-01 (IC Finding 7(B)): status=beneficiary_confirmed,
    //    confirmed_by/confirmed_at both set, confirmed_at safely BEFORE the
    //    submission's own submitted_at (set server-side to ~now()), and a
    //    valid email value matching the invitation's email exactly (STEP
    //    7/8's reference gate).
    const confirmedAt = new Date(Date.now() - 60_000).toISOString(); // 1 minute before this call
    const logOffsetBefore = app.logOffset();
    const res = await fetch(`${APP_URL}/api/intake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invitationToken: token,
        module1: { fullName: "AC69 Test", email: invitationEmail, whatsapp: "" },
        structuredProfile: {
          email: {
            value: invitationEmail, source: "beneficiary_confirmed", confidence: 1,
            status: "beneficiary_confirmed", confirmed_by: "ac69-test-actor", confirmed_at: confirmedAt,
            confirmed_from_source: null,
          },
        },
      }),
    });
    const body = await res.json();
    console.log("HTTP status:", res.status);
    console.log("Body:", JSON.stringify(body, null, 2));

    // 4. (A)/(C): inspect ONLY the log bytes appended during this call
    //    (isolates evidence to this run — avoids a false PASS from stale
    //    prior log content) for proof that TX-01 was invoked for 'email'
    //    AND that it surfaced CBR_INTERNAL_INCONSISTENCY. supabase-js's
    //    .rpc() resolves a Postgres RAISE EXCEPTION as a returned {error}
    //    object, not a thrown JS exception (route.ts's `if (cbrErr)` branch,
    //    the "failed:" line) -- a genuine JS `throw` (the "threw:" line)
    //    would only occur for an actual network-layer failure, not a
    //    database-level RAISE. This regex accepts either, but "failed:" is
    //    the realistically expected match; matching only "threw:" here
    //    would indicate something is different from the documented
    //    supabase-js error-shape contract and should be investigated.
    const newLog = app.readSince(logOffsetBefore);
    const evidenceMatch = newLog.match(/\[intake\]\[cbr\] tx01 email (failed|threw):.*CBR_INTERNAL_INCONSISTENCY/);
    console.log("--- new Next.js server log bytes captured during this call ---");
    console.log(newLog.trim() || "(none)");
    console.log("--- end captured log ---");
    if (!evidenceMatch) {
      throw new Error("no '[intake][cbr] tx01 email failed|threw: ... CBR_INTERNAL_INCONSISTENCY' line found in the server log captured during this call. Cannot distinguish CBR-threw-and-caught from CBR-never-called or CBR-returned-normally.");
    }
    console.log(`[EVIDENCE] AC-69 — server log confirms CBR_INTERNAL_INCONSISTENCY via the '${evidenceMatch[1]}:' path (matches supabase-js's normal {error} return shape for a Postgres RAISE EXCEPTION).`);

    // 5. (D): Intake must survive -- HTTP success, success===true, AND the
    //    submission actually persisted (queried back, not inferred from the
    //    HTTP response alone), with the canonical email column proven
    //    UNCHANGED (TX-01's integrity RAISE fires before any client mutation
    //    -- STEP 9/10, well before the realization step -- so no partial
    //    write should have occurred).
    if (!(res.ok && body.success === true)) {
      throw new Error("expected HTTP 2xx with success:true despite CBR's per-field isolation catching the induced failure.");
    }
    const { data: persistedSubs, error: persistedErr } = await db
      .from("intake_submissions").select("id, status").eq("invitation_id", invitation.id).neq("id", orphanSub.id);
    if (persistedErr) throw new Error(`post-call submission lookup failed: ${persistedErr.message}`);
    // Track every matching id for cleanup regardless of how many were
    // found — the length assertion below is a functional check, not a
    // precondition for knowing what to clean up.
    created.realSubIds = (persistedSubs ?? []).map((s) => s.id);
    if (!persistedSubs || persistedSubs.length !== 1) {
      throw new Error(`expected exactly 1 real submission persisted for this invitation post-call (excluding the fixture's orphan submission), found ${persistedSubs?.length ?? 0}.`);
    }
    const { data: clientAfter, error: clientAfterErr } = await db.from("clients").select("email").eq("id", client.id).single();
    if (clientAfterErr || !clientAfter) throw new Error(`post-call client lookup failed: ${clientAfterErr?.message}`);
    if (clientAfter.email !== emailBefore) {
      throw new Error(`clients.email must remain UNCHANGED by the failed TX-01 call (no partial mutation); before='${emailBefore}' after='${clientAfter.email}'`);
    }

    // 6. Atomicity proof (Final Test-Coverage Integrity Correction round):
    //    TX-01's own STEP 9 inserts a placeholder processing-state row
    //    BEFORE STEP 10's integrity check ever raises -- if the RAISE
    //    genuinely rolled back the whole function call (as the per-field
    //    isolation contract requires), that placeholder must NOT survive.
    //    This is a positive check on the actual transactional behavior,
    //    not an assumption that it worked merely because nothing else
    //    failed.
    const processingStateAfter = runDirectSql(`SELECT count(*) FROM cbr_internal.cbr_field_processing_state WHERE client_id='${client.id}'::uuid AND field_key='email';`);
    if (processingStateAfter !== "0") {
      throw new Error(`processing-state rows for (client, email) after the call = ${processingStateAfter}, expected 0 -- TX-01's STEP 9 placeholder insert must not survive a STEP 10 RAISE (the whole function call must roll back atomically).`);
    }
    console.log("[EVIDENCE] AC-69 — zero cbr_field_processing_state rows for (client, email) after the call, confirming TX-01's STEP 9 placeholder insert did not survive the STEP 10 RAISE (genuine atomic rollback, not merely 'nothing else failed').");

    // 7. Auth-user identification (Local Harness Safety Correction round;
    //    now shares resolveAuthUserIdByEmail with cleanup's fallback path,
    //    P2 Correction round): route.ts's own inviteUserByEmail call
    //    (unconditional, per-earlier-round source analysis) runs after the
    //    CBR block regardless of its outcome, against the exact per-run-
    //    unique invitationEmail above. This step records the id for
    //    logging/tracking; cleanup below does not depend on this step
    //    having run.
    const resolvedAtStep7 = resolveAuthUserIdByEmail(invitationEmail);
    if (resolvedAtStep7) {
      created.authUserId = resolvedAtStep7;
      console.log(`[EVIDENCE] AC-69 — inviteUserByEmail created auth.users id=${resolvedAtStep7} for the exact fixture email (tracked for scoped cleanup; its attributable profiles row, if any, is deleted explicitly by cleanup, not assumed to cascade).`);
    } else {
      console.log("[INFO] no auth.users row found for the fixture email — nothing to identify for Auth cleanup (not itself an AC-69 functional failure).");
    }

    console.log("[PASS] AC-69 — (A) CBR genuinely threw CBR_INTERNAL_INCONSISTENCY inside cbr_tx01_realize_g1g2 for a real, TX-01-eligible email field, exercised through the real production /api/intake path (served by this harness's own environment-controlled Next.js child); (B) the field was genuinely eligible (beneficiary_confirmed, confirmed_by/confirmed_at set, confirmed_at<=submitted_at, valid+matching email); (C) captured server-side log evidence (not HTTP 200 alone, not an inaccessible internal RPC) distinguishes threw-and-caught from never-called/returned-normally; (D) Intake survived: HTTP 2xx, success:true, submission persisted exactly once, canonical email column unchanged; (E) TX-01's own placeholder processing-state insert did not survive the rollback.");
  } catch (e) {
    testFailure = e instanceof Error ? e.message : String(e);
    console.error("[FAIL] AC-69 —", testFailure);
  } finally {
    // Cleanup runs on BOTH the pass and fail paths — this is a `finally`
    // block, not a success-only step. It is attempted exactly once,
    // regardless of what happened above, and does not require every prior
    // step to have succeeded (P2 Correction round: cleanup resolves Auth
    // identity independently of whether Step 7 ever ran).
    console.log("[CLEANUP] removing test-created rows (including any attributable auth.users/profiles rows) and restoring CBR operational state (scoped to exactly what this execution created/changed)...");
    const cleanup = await cleanupTestState(db, created);
    if (cleanup.ok) {
      console.log(`[CLEANUP OK] ${cleanup.detail}`);
    } else {
      console.error(`[CLEANUP FAIL] ${cleanup.detail}`);
    }

    let childStop: { ok: boolean; detail: string } | null = null;
    if (app) {
      console.log("[CLEANUP] terminating the harness-owned Next.js child process group...");
      childStop = await stopLocalNextApp(app);
      if (childStop.ok) console.log(`[CHILD-TERMINATION OK] ${childStop.detail}`);
      else console.error(`[CHILD-TERMINATION FAIL] ${childStop.detail}`);
    }

    if (testFailure) {
      // The original functional failure is the primary, first-reported
      // reason for the nonzero exit -- a cleanup or child-termination
      // failure is reported additionally, never in place of it.
      console.error(`[RESULT] AC-69 FAILED: ${testFailure}`);
      if (!cleanup.ok) {
        console.error(`[RESULT] additionally, cleanup FAILED and did not run to completion: ${cleanup.detail}`);
      }
      if (childStop && !childStop.ok) {
        console.error(`[RESULT] additionally, child termination FAILED: ${childStop.detail}`);
      }
      process.exit(1);
    }
    if (!cleanup.ok || (childStop && !childStop.ok)) {
      // All functional assertions passed, but cleanup and/or child
      // termination did not -- per the test's contract (cleanup, state
      // restoration, and not leaving a dev server running are all part of
      // what "passing" means), this is still an overall failure, reported
      // as its own distinct reason, not silently converted into a PASS.
      console.error(`[RESULT] AC-69 functional assertions PASSED, but cleanup and/or child termination FAILED — treating the overall run as FAILED per the test contract.${!cleanup.ok ? ` cleanup: ${cleanup.detail}` : ""}${childStop && !childStop.ok ? ` child-termination: ${childStop.detail}` : ""}`);
      process.exit(1);
    }
    console.log("[RESULT] AC-69 PASSED, all test-created rows (including any attributable auth.users/profiles rows) were removed, g1g2/admission-window/processing-state were restored and verified, and the harness-owned Next.js child was terminated.");
  }
}

main().catch((e) => { console.error("[ERROR]", e); process.exit(1); });
