#!/usr/bin/env bash
# AC-68 — cbr_internal.* is unreachable via the PostgREST API — AUSCIS-TEST
# hosted-project variant (v4, corrected).
#
# THIS IS A NEW, SEPARATE FILE. It does not modify, and is not a substitute
# for, ac68-api-isolation.sh, which remains exactly as reviewed and stays
# scoped to a LOCAL disposable stack (its own 127.0.0.1/localhost-only
# check is intentionally left untouched). That script's restriction is not
# bypassed here — this file targets a *different*, real, hosted project
# instead, with its own, separately-reasoned safety checks below.
#
# CORRECTIONS IN AN EARLIER ROUND (v2), each verified against official
# PostgREST documentation (postgrest.org) or migration 040's actual source
# before being fixed — see the accompanying change report for the full
# explanation of each (v3's own corrections are in their own section below):
#
#   1. The v1 script's ONLY case (POST /rest/v1/rpc/cbr_toggle_gate, no
#      Content-Profile header) never actually asked PostgREST for
#      cbr_internal at all. Per PostgREST's own docs: "If you don't
#      specify a Profile header, the first schema in the list is selected
#      as the default schema" — here, `public`. cbr_toggle_gate does not
#      exist in `public` either way, so that request 404s with PGRST202
#      REGARDLESS of whether cbr_internal is actually excluded — it is not
#      decisive evidence of schema exclusion. It is RETAINED below, but
#      demoted to explicitly-labeled SUPPLEMENTARY evidence only, and does
#      not gate this script's pass/fail determination.
#   2. Two new, REQUIRED checks were added that actually target
#      cbr_internal explicitly: a POST with `Content-Profile: cbr_internal`
#      (the header PostgREST docs specify for POST/PATCH/PUT/DELETE schema
#      selection) against cbr_toggle_gate, and a GET with
#      `Accept-Profile: cbr_internal` (the header for GET/HEAD) against
#      cbr_internal.cbr_field_gate_state filtered with
#      `?gate=eq.__ac68_never_matches__` (standard, documented PostgREST
#      horizontal-filtering syntax; `gate` has CHECK (gate IN ('g1g2',
#      'g3_observation','g3_staff_resolution')), so this value can never
#      match a real row) -- so even if unexpectedly reachable, zero rows
#      of actual data are ever returned. `limit=0` was deliberately NOT
#      used: its exact edge-case behavior is not documented by PostgREST's
#      own pagination reference, and this script does not rely on
#      unconfirmed behavior for a safety property.
#   3. DISCREPANCY, DOCUMENTED, NOT SILENTLY RESOLVED: AC-68's approved
#      canonical text specifies PGRST202. Official PostgREST documentation
#      (postgrest.org/en/stable/references/errors.html) states PGRST106 —
#      "The schema specified when switching schemas is not present in the
#      db-schemas configuration variable" — is HTTP 406, and is the code
#      actually returned for an EXPLICITLY-requested, non-exposed schema
#      (postgrest.org/en/stable/references/api/schemas.html, confirmed
#      quote: `{"code":"PGRST106",...,"message":"The schema must be one of
#      the following: ..."}`), which is a DIFFERENT code and a DIFFERENT
#      HTTP status than PGRST202 (404, "Caused by a stale function
#      signature, otherwise the function may not exist in the database" —
#      per the same official reference). This script therefore reports TWO
#      SEPARATE outcomes for the explicit checks: TECHNICAL SCHEMA
#      EXCLUSION EVIDENCE (does the explicit request get rejected at all,
#      per official schema-selection semantics) and AC-68 LITERAL
#      CONFORMANCE (does the response match the approved design's exact
#      stated code). These are never merged, and this script never prints
#      an unqualified "AC-68 PASS" — see the final summary section and the
#      separately-delivered clarification proposal.
#   4. AC-68's own approved text specifies the anon or authenticated role.
#      Every acceptance-determining request in this script now uses
#      CBR_AUSCIS_TEST_ANON_KEY, not service_role. A service_role key is
#      accepted ONLY as a separate, clearly-labeled, OPTIONAL diagnostic
#      section that never affects this script's pass/fail determination.
#      No new privilege or schema exposure is requested or granted to make
#      any control succeed.
#   5. The old positive control (POST cbr_tx01_realize_g1g2 with an
#      all-zero submission_id, under service_role) is REMOVED. Two
#      problems, both source/spec-confirmed rather than assumed: (a)
#      migration 040 REVOKEs EXECUTE on cbr_tx01_realize_g1g2 from PUBLIC,
#      authenticated, AND anon, granting it only to service_role — so an
#      anon-role call to it would never succeed regardless of schema
#      exposure, making it useless as an anon-role positive control; (b)
#      it relied on an all-zero submission_id being absent from
#      intake_submissions without independently verifying that
#      precondition first. Replaced with a GET to PostgREST's OWN OpenAPI
#      root document under the SAME anon key used for the decisive checks
#      — this touches zero application tables, requires no table-level
#      grant of any kind, and its sole purpose is proving the supplied
#      URL/key combination is genuinely valid and reaches PostgREST as the
#      anon role — never a request "harmless because we hope so." The
#      EXACT endpoint for this was itself corrected in a later round — see
#      item 9 below.
#   6. p_gate=NULL (never p_gate='g1g2'/p_enable=true) is used for the
#      internal RPC probe's body. Traced directly against
#      cbr_internal.cbr_toggle_gate's actual source (migration 040, the
#      literal FIRST executable statement in the function body):
#      `IF p_gate IS NULL THEN outcome := 'INVALID_GATE'; RETURN NEXT;
#      RETURN; END IF;` — this returns before ANY table is read, not only
#      before any write. If the explicit-Content-Profile request is
#      unexpectedly reachable at all (i.e. does NOT come back 406/
#      PGRST106), that alone is treated as a FAIL below — regardless of
#      what outcome value the function itself would return — per
#      instruction: an unexpectedly reachable function is a failure even
#      when its own input-validation guard would have prevented a write.
#   7. Independent project-identity validation, not merely a visual
#      confirmation prompt: CBR_AUSCIS_TEST_PROJECT_REF (a NON-secret
#      project reference slug) is required, and CBR_AUSCIS_TEST_API_URL is
#      checked to be the EXACT `https://<ref>.supabase.co` URL derived
#      from it — before any key is used, before the interactive CONFIRM
#      step. The known ACTIONUSA AI (Production) host
#      (slasbfepqovdsezmadjh.supabase.co — confirmed this engagement
#      directly from src/app/api/intake/route.ts's own hardcoded fallback)
#      is unconditionally rejected regardless of what the supplied
#      variables claim. No http:// scheme, no redirect-following (-L is
#      never passed to curl), no insecure-TLS flag (-k is never passed).
#   8. Every curl call now has explicit --connect-timeout/--max-time, and
#      its own exit code is checked explicitly (network/TLS/timeout
#      failures produce a clear ABORT message, never a silent pass-through
#      into the JSON-parsing logic). Malformed/unparseable JSON response
#      bodies are treated as an explicit STOP condition, never silently
#      read as an empty string that happens to mismatch every expected
#      code. A prerequisite check for curl/python3 on PATH runs first.
#      No credential value is ever echoed to output or written to a saved
#      file — only URLs, HTTP statuses, and response BODIES (server
#      output, never client-supplied secrets) are printed/saved.
#      This script never prints an overall PASS banner unless every
#      REQUIRED check (the two explicit cbr_internal probes plus the
#      anon-role positive control) has independently succeeded.
#
# CORRECTIONS IN THIS ROUND (v3), verified against Supabase's and
# PostgREST's official documentation before being fixed:
#   9. The positive control's endpoint was WRONG. CBR_AUSCIS_TEST_API_URL
#      is the project ORIGIN (`https://<project-ref>.supabase.co`) —
#      Supabase's own Kong gateway root, not PostgREST's own root. Per
#      Supabase's official API docs ("It exposes everything you need from
#      a CRUD API at the URL https://<project_ref>.supabase.co/rest/v1/"),
#      the auto-generated REST API — and therefore PostgREST's own OpenAPI
#      root document describing it — is mounted specifically at
#      `/rest/v1/`. The v2 script's `GET $API_URL/` tested Kong's root,
#      never PostgREST. Fixed: `GET $API_URL/rest/v1/`, same anon key.
#      This control now also validates OpenAPI STRUCTURE, not merely
#      parseable JSON — per PostgREST's own OpenAPI reference, the root
#      document has top-level `swagger` and `paths` keys; both are now
#      required, in addition to HTTP 200, for this control to PASS.
#   10. If this hosted project's actual configuration does not expose that
#      document at `/rest/v1/` (HTTP 404), this is now reported as an
#      explicit BLOCKED outcome for this one control — distinct from FAIL
#      — and this script does not attempt to change schema exposure,
#      permissions, or any server configuration to force it to pass.
#      BLOCKED still does not count toward REQUIRED_PASS_COUNT.
#   11. FIXED: a real exit-code gap. The final summary block previously
#      printed "[INCOMPLETE: ...]" when not all required controls passed,
#      but then fell through to the end of the script without exiting
#      nonzero — meaning an ambiguous outcome (e.g. check 1 returning
#      404/PGRST202 on an explicit Content-Profile request, a real,
#      possible response this script does not treat as PASS) could reach
#      end-of-script with exit status 0. The final block now explicitly
#      `exit 1`s whenever REQUIRED_PASS_COUNT != REQUIRED_TOTAL, so any
#      FAIL, BLOCKED, or otherwise-incomplete required-control outcome
#      always produces a nonzero exit status, with no silent gap.
#
# CORRECTIONS IN THIS ROUND (v4) — REAL AUSCIS-TEST EXECUTION FINDINGS:
#   12. The v3 positive control (GET $API_URL/rest/v1/, PostgREST's own
#      OpenAPI root) was actually EXECUTED against AUSCIS-TEST and
#      returned HTTP 401: {"message":"Invalid API key","hint":"Only the
#      `service_role` API key can be used for this endpoint."} — the
#      SAME anon key that produced valid 406/PGRST106 responses on checks
#      1 and 2 in that same run. This is NOT evidence the anon key is
#      invalid (checks 1/2 prove it authenticates and reaches PostgREST
#      correctly) — it is this specific hosted project's own, explicit
#      configuration choice to restrict the OpenAPI root document to
#      service_role only. The OpenAPI root is therefore REMOVED as the
#      positive control and replaced (see item 13).
#   13. REPLACEMENT CONTROL, selected from REAL deployed evidence, not
#      guessed: a read-only, owner-executed inspection query
#      (ac68-anon-grants-inspection-READ-ONLY.sql, information_schema/
#      pg_catalog metadata only, no business-table row ever read) found:
#      (a) anon has schema USAGE on `public` (true) — confirmed;
#      (b) anon has table-level SELECT on public.canonical_beneficiary_
#          records (confirmed via information_schema.role_table_grants);
#      (c) RLS is ENABLED on that table (relrowsecurity=true), and its
#          ONLY SELECT policy, `staff_select_canonical_beneficiary_
#          records` (migration 039, lines 161-166), is scoped `TO
#          authenticated` — NOT `anon`. The inspection's own
#          ANON_OR_PUBLIC_POLICY results confirm NO policy on this table
#          names `anon` or `public` at all.
#      Consequence, confirmed against Postgres RLS semantics: when the
#      current role is `anon`, ZERO policies apply to this table for
#      SELECT (the table's single policy requires `authenticated`) — RLS
#      is fail-closed/default-deny per role, so an anon SELECT against
#      this table returns a SUCCESSFUL, EMPTY result set (HTTP 200,
#      `[]`), never a permission error (the base GRANT SELECT anon
#      already has is what keeps this a clean 200 rather than 403) and
#      never any business row.
#      SECOND, INDEPENDENT guarantee, not reliant on RLS alone: the new
#      control additionally filters `id=is.null`. `canonical_beneficiary_
#      records.id` is `UUID PRIMARY KEY` (migration 039, line 102) —
#      NOT NULL by definition of PRIMARY KEY — so this filter can NEVER
#      match a real row, structurally, regardless of RLS state, present
#      or future. This is NOT reliant on a fabricated UUID happening to
#      be absent (the prior round's exact, disclosed defect class) — it
#      is reliant on a column-level constraint that makes a match
#      logically impossible.
#      Request: `GET $API_URL/rest/v1/canonical_beneficiary_records
#      ?select=id&id=is.null`, `Accept-Profile: public` (explicit,
#      though `public` is already the first-listed/default schema),
#      same anon key. Required: HTTP 200 AND a parsed JSON array of
#      length 0. A successful empty response proves ONLY that this
#      specific, structurally-empty request works as anon — it does NOT
#      prove, and this script does not claim, that anon can read actual
#      canonical_beneficiary_records business data; the RLS policy scope
#      confirmed above is what prevents that, independent of this probe.
#   14. SEPARATE OBSERVATION FROM THE SAME INSPECTION, NOT ACTED ON: the
#      inspection also found public.document_translations has RLS
#      DISABLED (relrowsecurity=false) AND full anon table grants
#      (SELECT/INSERT/UPDATE/DELETE/...). This script does NOT probe that
#      table's business data, does NOT change its permissions, and does
#      NOT attempt any remediation — that is explicitly out of this
#      task's scope. This is recorded here only so the observation is not
#      lost; it is not verified beyond what the metadata inspection
#      itself already showed, and no data exposure is claimed as
#      confirmed by this script.
#
# WHAT THIS SCRIPT DOES NOT DO:
#   - It does not toggle any gate, does not create any fixture, and does
#     not touch cbr_field_gate_state's row CONTENT or cbr_field_admission_
#     window at all (only a zero-row, schema-level reachability probe
#     against cbr_field_gate_state). It DOES issue one read-only SELECT
#     against canonical_beneficiary_records (the positive control) --
#     filtered so it structurally can never match a row (id=is.null, and
#     independently RLS-scoped to authenticated only) -- see item 13.
#   - It does not target ACTIONUSA AI (Production) under any input.
#   - It does not probe, read, or change public.document_translations
#     (RLS-disabled, anon-granted per the same inspection) -- see item 14.
#
# UNEXECUTED: written and statically reviewed only. Alex runs this
# manually against AUSCIS-TEST and reports the output for review — Code
# does not execute this.
set -euo pipefail

# ── Prerequisite tool check ─────────────────────────────────────────────
command -v curl   >/dev/null 2>&1 || { echo "ABORT: curl not found on PATH." >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ABORT: python3 not found on PATH." >&2; exit 1; }

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

CONNECT_TIMEOUT=10
MAX_TIME=30

# ── Required, non-secret project identity ───────────────────────────────
: "${CBR_AUSCIS_TEST_PROJECT_REF:?Set CBR_AUSCIS_TEST_PROJECT_REF to the AUSCIS-TEST project reference slug (Supabase dashboard -> AUSCIS-TEST project -> Settings -> General -> Reference ID). This is NOT a secret -- it is the subdomain segment of the project own public URL. No default, no fallback.}"
: "${CBR_AUSCIS_TEST_API_URL:?Set CBR_AUSCIS_TEST_API_URL to the AUSCIS-TEST project API URL (Settings -> API -> Project URL). No default, no fallback.}"
: "${CBR_AUSCIS_TEST_ANON_KEY:?Set CBR_AUSCIS_TEST_ANON_KEY to the AUSCIS-TEST project anon/public key (Settings -> API). AC-68 specifies the anon or authenticated role, never service_role, for the acceptance-determining checks.}"
# service_role is OPTIONAL and used ONLY for the separate, clearly-labeled
# diagnostic section near the end -- never for a required, pass/fail check.
CBR_AUSCIS_TEST_SERVICE_KEY="${CBR_AUSCIS_TEST_SERVICE_KEY:-}"

KNOWN_PRODUCTION_HOST="slasbfepqovdsezmadjh.supabase.co"
EXPECTED_URL="https://${CBR_AUSCIS_TEST_PROJECT_REF}.supabase.co"
NORMALIZED_URL="${CBR_AUSCIS_TEST_API_URL%/}"

case "$NORMALIZED_URL" in
  https://*) : ;;
  *) echo "ABORT: CBR_AUSCIS_TEST_API_URL must use https://. Refusing '$NORMALIZED_URL'." >&2; exit 1 ;;
esac

ACTUAL_HOST=$(python3 -c "from urllib.parse import urlparse; print(urlparse('$NORMALIZED_URL').hostname or '')")
if [ -z "$ACTUAL_HOST" ]; then
  echo "ABORT: could not parse a hostname out of CBR_AUSCIS_TEST_API_URL ('$NORMALIZED_URL')." >&2
  exit 1
fi
if [ "$ACTUAL_HOST" = "$KNOWN_PRODUCTION_HOST" ]; then
  echo "ABORT: CBR_AUSCIS_TEST_API_URL resolves to the known ACTIONUSA AI (Production) host ($KNOWN_PRODUCTION_HOST). Refusing unconditionally, regardless of any other input." >&2
  exit 1
fi
if [ "$NORMALIZED_URL" != "$EXPECTED_URL" ]; then
  echo "ABORT: CBR_AUSCIS_TEST_API_URL ('$CBR_AUSCIS_TEST_API_URL') does not exactly match the URL derived from CBR_AUSCIS_TEST_PROJECT_REF ('$EXPECTED_URL'). This script requires the two to agree, independently, before proceeding -- refusing an unverified or arbitrary target." >&2
  exit 1
fi

API_URL="$NORMALIZED_URL"

echo "=================================================================="
echo " TARGET PROJECT REFERENCE (as supplied): $CBR_AUSCIS_TEST_PROJECT_REF"
echo " TARGET URL (verified to match the reference above): $API_URL"
echo " Verified NOT the known ACTIONUSA AI / Production host."
echo " This MUST still be AUSCIS-TEST. Re-check the reference above against"
echo " the Supabase dashboard's AUSCIS-TEST project page before typing"
echo " CONFIRM below."
echo "=================================================================="
read -r -p "Type CONFIRM (exactly) to proceed against the URL printed above: " CONFIRMATION
if [ "$CONFIRMATION" != "CONFIRM" ]; then
  echo "ABORT: confirmation not given. No request was sent." >&2
  exit 1
fi

# ── Small helper: run curl, fail loudly (never silently) on a non-zero ──
# ── curl exit code (DNS/TLS/timeout/connection-refused, not HTTP status). ─
# Writes the response BODY to $2, prints the HTTP status via stdout.
# Never passes -L (no redirect following) or -k (no insecure TLS).
run_request() {
  local desc="$1" out_file="$2"; shift 2
  local http_code
  set +e
  http_code=$(curl -sS --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" \
    -o "$out_file" -w "%{http_code}" "$@")
  local curl_exit=$?
  set -e
  if [ "$curl_exit" -ne 0 ]; then
    echo "ABORT: network/TLS/timeout error running '$desc' (curl exit code $curl_exit). Not treated as any form of PASS." >&2
    exit 1
  fi
  echo "$http_code"
}

# Parses a JSON object's top-level "code" field from a file. On ANY parse
# failure (empty body, non-JSON body, non-object body), prints the literal
# marker string UNPARSEABLE -- never a silently-empty string that could
# coincidentally fail to match every expected code without saying why.
parse_code() {
  python3 -c "
import json,sys
try:
    with open('$1') as f:
        d = json.load(f)
    print(d.get('code','') if isinstance(d, dict) else 'UNPARSEABLE')
except Exception:
    print('UNPARSEABLE')
"
}

REQUIRED_PASS_COUNT=0
REQUIRED_TOTAL=3

echo ""
echo "=== [SUPPLEMENTARY, NOT DECISIVE] Default-schema RPC lookup: POST $API_URL/rest/v1/rpc/cbr_toggle_gate, NO Content-Profile header ==="
echo "This request never asks PostgREST for cbr_internal at all (no profile"
echo "header means the default/first-listed schema, public, is used) -- a"
echo "404/PGRST202 here is EXPECTED REGARDLESS of whether cbr_internal is"
echo "actually excluded, because cbr_toggle_gate simply is not in public"
echo "either way. Retained for context only; does not affect the result"
echo "below."
HTTP0=$(run_request "default-schema RPC lookup" "$WORKDIR/check0.json" \
  -X POST "$API_URL/rest/v1/rpc/cbr_toggle_gate" \
  -H "apikey: $CBR_AUSCIS_TEST_ANON_KEY" -H "Authorization: Bearer $CBR_AUSCIS_TEST_ANON_KEY" \
  -H "Content-Type: application/json" -d '{"p_gate":null,"p_enable":null,"p_actor_id":null}')
CODE0=$(parse_code "$WORKDIR/check0.json")
echo "HTTP status: $HTTP0 | code: $CODE0 (supplementary only)"

echo ""
echo "=== [REQUIRED 1/3] Explicit cbr_internal RPC request: POST $API_URL/rest/v1/rpc/cbr_toggle_gate, Content-Profile: cbr_internal ==="
echo "Role: anon. Body deliberately uses p_gate=null -- traced against"
echo "migration 040's actual source: this is the function's literal FIRST"
echo "statement, returning before any table is read. If this request is"
echo "unexpectedly reachable at all (any status other than 406/PGRST106),"
echo "that alone is a FAIL, regardless of the harmless outcome value the"
echo "function itself would report."
HTTP1=$(run_request "explicit cbr_internal RPC probe" "$WORKDIR/check1.json" \
  -X POST "$API_URL/rest/v1/rpc/cbr_toggle_gate" \
  -H "Content-Profile: cbr_internal" \
  -H "apikey: $CBR_AUSCIS_TEST_ANON_KEY" -H "Authorization: Bearer $CBR_AUSCIS_TEST_ANON_KEY" \
  -H "Content-Type: application/json" -d '{"p_gate":null,"p_enable":null,"p_actor_id":null}')
CODE1=$(parse_code "$WORKDIR/check1.json")
echo "HTTP status: $HTTP1 | code: $CODE1"
echo "Body:"; cat "$WORKDIR/check1.json"; echo
if [ "$HTTP1" = "406" ] && [ "$CODE1" = "PGRST106" ]; then
  echo "[PASS, technical schema exclusion] cbr_internal rejected as a schema selection target (PGRST106, per official PostgREST schema-selection semantics)."
  REQUIRED_PASS_COUNT=$((REQUIRED_PASS_COUNT + 1))
elif [ "$HTTP1" = "404" ] && [ "$CODE1" = "PGRST202" ]; then
  echo "[UNEXPECTED, BUT SCHEMA-CONSISTENT] Got 404/PGRST202 on an EXPLICIT Content-Profile: cbr_internal request. Official docs describe this exact shape of request producing PGRST106/406 when the schema is excluded, not PGRST202/404 -- PGRST202 here would mean the schema WAS accepted for selection but the function specifically wasn't found in it (a different, more permissive server behavior than expected). Treat as requiring investigation, not as this script's REQUIRED-check pass condition -- not counted toward REQUIRED_PASS_COUNT."
else
  echo "[FAIL] Expected HTTP 406/PGRST106 (schema exclusion, per official docs) for an explicit, unauthorized schema selection. Got HTTP $HTTP1 / code=$CODE1. cbr_internal may be reachable via AUSCIS-TEST's API as anon. STOP and report before doing anything else." >&2
  exit 1
fi

echo ""
echo "=== [REQUIRED 2/3] Explicit cbr_internal table request: GET $API_URL/rest/v1/cbr_field_gate_state?gate=eq.__ac68_never_matches__, Accept-Profile: cbr_internal ==="
echo "Role: anon. The filter value can never match a real row (gate has its"
echo "own CHECK constraint limiting it to 3 known values), so zero rows of"
echo "actual data are ever returned in the body, even if this table is"
echo "unexpectedly reachable."
HTTP2=$(run_request "explicit cbr_internal table probe" "$WORKDIR/check2.json" \
  -X GET "$API_URL/rest/v1/cbr_field_gate_state?gate=eq.__ac68_never_matches__" \
  -H "Accept-Profile: cbr_internal" \
  -H "apikey: $CBR_AUSCIS_TEST_ANON_KEY" -H "Authorization: Bearer $CBR_AUSCIS_TEST_ANON_KEY")
CODE2=$(parse_code "$WORKDIR/check2.json")
echo "HTTP status: $HTTP2 | code: $CODE2"
echo "Body:"; cat "$WORKDIR/check2.json"; echo
if [ "$HTTP2" = "406" ] && [ "$CODE2" = "PGRST106" ]; then
  echo "[PASS, technical schema exclusion] cbr_internal rejected as a schema selection target for table access too (PGRST106)."
  REQUIRED_PASS_COUNT=$((REQUIRED_PASS_COUNT + 1))
else
  echo "[FAIL] Expected HTTP 406/PGRST106. Got HTTP $HTTP2 / code=$CODE2. cbr_internal's table(s) may be reachable via AUSCIS-TEST's API as anon. STOP and report before doing anything else. (Even an empty-array body here would ALSO be a FAIL -- it would mean the schema selection itself was accepted, regardless of how many rows matched the filter.)" >&2
  exit 1
fi

echo ""
echo "=== [REQUIRED 3/3, positive control] Anon-role reachability: GET \$API_URL/rest/v1/canonical_beneficiary_records?select=id&id=is.null, Accept-Profile: public ==="
echo "REPLACED this round -- the OpenAPI root (v3) was actually executed"
echo "against AUSCIS-TEST and returned HTTP 401, 'Only the service_role API"
echo "key can be used for this endpoint' -- this hosted project restricts it"
echo "to service_role, confirmed by the server's own error, not by"
echo "assumption. This new control was selected from a REAL, owner-executed"
echo "read-only inspection of information_schema/pg_catalog (see"
echo "ac68-anon-grants-inspection-READ-ONLY.sql), not guessed:"
echo "  - anon has table-level SELECT on canonical_beneficiary_records."
echo "  - RLS is ENABLED on it, and its ONLY SELECT policy is scoped TO"
echo "    authenticated -- no policy anywhere names anon or public."
echo "  - Consequence, per Postgres RLS semantics: an anon SELECT against"
echo "    this table matches zero policies -> HTTP 200, empty result set"
echo "    -- never a permission error, never a business row."
echo "  - SEPARATELY, id=is.null can never match any row: id is UUID"
echo "    PRIMARY KEY (migration 039 line 102), NOT NULL by definition --"
echo "    this does not rely on a fabricated UUID's absence."
echo "id=is.null is documented PostgREST filter syntax (the 'is' operator,"
echo "value 'null'). Accept-Profile: public is sent explicitly even though"
echo "public is already the first-listed/default schema. Requires HTTP 200"
echo "AND a parsed JSON array of length 0 -- proves only that this exact,"
echo "structurally-empty request works as anon, nothing about reading real"
echo "canonical_beneficiary_records data."
HTTP3=$(run_request "anon canonical_beneficiary_records positive control" "$WORKDIR/check3.json" \
  -X GET "$API_URL/rest/v1/canonical_beneficiary_records?select=id&id=is.null" \
  -H "Accept-Profile: public" \
  -H "apikey: $CBR_AUSCIS_TEST_ANON_KEY" -H "Authorization: Bearer $CBR_AUSCIS_TEST_ANON_KEY")
echo "HTTP status: $HTTP3"
echo "Body:"; cat "$WORKDIR/check3.json"; echo
EMPTY_ARRAY=$(python3 -c "
import json
try:
    with open('$WORKDIR/check3.json') as f:
        d = json.load(f)
    print('yes' if isinstance(d, list) and len(d) == 0 else 'no')
except Exception:
    print('no')
")
if [ "$HTTP3" = "200" ] && [ "$EMPTY_ARRAY" = "yes" ]; then
  echo "[PASS, positive control] Reachable as anon; empty result set, as required by both RLS scope (authenticated-only policy) and the id=is.null structural guarantee."
  REQUIRED_PASS_COUNT=$((REQUIRED_PASS_COUNT + 1))
else
  echo "[FAIL] Expected HTTP 200 with a parsed JSON array of length 0. Got HTTP $HTTP3, empty-array=$EMPTY_ARRAY. Either the anon key/URL combination could not be confirmed working, or (if any row was actually returned) the RLS/grant state has changed since the inspection this control was built from -- STOP and report before doing anything else, do not treat this as any form of PASS." >&2
  exit 1
fi

echo ""
echo "=================================================================="
if [ "$REQUIRED_PASS_COUNT" -eq "$REQUIRED_TOTAL" ]; then
  echo "[REQUIRED CONTROLS: ALL $REQUIRED_TOTAL PASSED]"
  echo "TECHNICAL SCHEMA EXCLUSION EVIDENCE: CONFIRMED (cbr_internal rejected"
  echo "  via PGRST106/406 for both explicit RPC and table selection, as anon)."
  echo "AC-68 LITERAL CRITERION (\"...PGRST202...\"): NOT CONFORMED AS WRITTEN --"
  echo "  see the separately-delivered clarification proposal. This script"
  echo "  does NOT declare AC-68 fully, canonically closed."
  echo "=================================================================="
else
  echo "[INCOMPLETE: $REQUIRED_PASS_COUNT of $REQUIRED_TOTAL required controls passed -- see FAIL/BLOCKED/ABORT output above]"
  echo "=================================================================="
  echo "STOP: not all required controls passed (or one is BLOCKED). This run" >&2
  echo "must not be read as AC-68 evidence of any kind. Exiting nonzero." >&2
  exit 1
fi

# ── OPTIONAL, separate, non-decisive service_role diagnostic ───────────
if [ -n "$CBR_AUSCIS_TEST_SERVICE_KEY" ]; then
  echo ""
  echo "=== [OPTIONAL DIAGNOSTIC, service_role, NOT part of the AC-68 determination above] ==="
  HTTPS=$(run_request "service_role diagnostic RPC probe" "$WORKDIR/checks.json" \
    -X POST "$API_URL/rest/v1/rpc/cbr_toggle_gate" \
    -H "Content-Profile: cbr_internal" \
    -H "apikey: $CBR_AUSCIS_TEST_SERVICE_KEY" -H "Authorization: Bearer $CBR_AUSCIS_TEST_SERVICE_KEY" \
    -H "Content-Type: application/json" -d '{"p_gate":null,"p_enable":null,"p_actor_id":null}')
  CODES=$(parse_code "$WORKDIR/checks.json")
  echo "HTTP status: $HTTPS | code: $CODES (service_role; informational only, never gates AC-68's own result)"
else
  echo ""
  echo "(CBR_AUSCIS_TEST_SERVICE_KEY not set -- optional service_role diagnostic skipped, as intended.)"
fi

echo ""
echo "No cleanup required: every request above either never reached a table (PGRST106 cases) or filtered on a value that can never match a real row (both cbr_internal's gate=eq.__ac68_never_matches__ and canonical_beneficiary_records' id=is.null). No fixture was created, no row was ever returned."
