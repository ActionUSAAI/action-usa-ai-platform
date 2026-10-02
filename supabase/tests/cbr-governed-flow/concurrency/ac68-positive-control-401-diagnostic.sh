#!/usr/bin/env bash
# AC-68 — narrowly-scoped, READ-ONLY diagnostic for the positive-control
# HTTP 401 observed in the owner's real AUSCIS-TEST run.
#
# THIS IS NOT A REWRITE of ac68-api-isolation-AUSCIS-TEST.sh and does not
# replace it. It does not touch the two explicit schema-selection probes
# that already produced valid, preserved evidence (406/PGRST106, both
# probes, "Only the following schemas are exposed: public, graphql_public"
# / "Invalid schema: cbr_internal") -- that evidence stands as-is and is
# not reproduced or re-judged here.
#
# WHAT THIS SCRIPT DOES: exactly two GET/POST requests, both read-only in
# effect (the second reuses the SAME harmless p_gate=null body already
# reviewed and already observed to reach only PostgREST's schema-selection
# check, never any table), to gather NEW, currently-missing evidence about
# the 401 -- full response body, and specific response HEADERS (never
# request headers, never the key itself) -- and to re-confirm, in THIS
# session, that the same anon key still authenticates successfully at all
# (by repeating the already-passing explicit RPC probe once more,
# immediately before/after the 401 request, for direct comparison).
#
# WHAT THIS SCRIPT DELIBERATELY DOES NOT DO, per instruction:
#   - It does not guess or assert a cause. Section "HOW TO READ THIS"
#     below is a decision tree over the evidence this script actually
#     captures -- it names which combinations of observations are
#     consistent with which hypotheses, and explicitly marks anything
#     this script cannot itself distinguish.
#   - It does not use service_role in place of the anon positive control.
#   - It does not change schema exposure, privileges, gates, migrations,
#     or any server configuration.
#   - It does not touch ACTIONUSA AI (Production) under any input.
#
# UNEXECUTED: written and statically reviewed only. Alex runs this
# manually against AUSCIS-TEST and reports the exact output for review —
# Code does not execute this.
set -euo pipefail

command -v curl    >/dev/null 2>&1 || { echo "ABORT: curl not found on PATH." >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ABORT: python3 not found on PATH." >&2; exit 1; }

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
CONNECT_TIMEOUT=10
MAX_TIME=30

# ── This diagnostic is scoped to the ONE project confirmed this round ────
KNOWN_PRODUCTION_HOST="slasbfepqovdsezmadjh.supabase.co"
EXPECTED_URL="https://utpsqevarnxscdqzywkk.supabase.co"

: "${CBR_AUSCIS_TEST_API_URL:?Set CBR_AUSCIS_TEST_API_URL to https://utpsqevarnxscdqzywkk.supabase.co -- this diagnostic is scoped to that one, already-confirmed AUSCIS-TEST project only. No default, no fallback.}"
: "${CBR_AUSCIS_TEST_ANON_KEY:?Set CBR_AUSCIS_TEST_ANON_KEY to the SAME AUSCIS-TEST anon key already used in the run that produced the 401. Never service_role.}"

NORMALIZED_URL="${CBR_AUSCIS_TEST_API_URL%/}"
ACTUAL_HOST=$(python3 -c "from urllib.parse import urlparse; print(urlparse('$NORMALIZED_URL').hostname or '')")

if [ "$ACTUAL_HOST" = "$KNOWN_PRODUCTION_HOST" ]; then
  echo "ABORT: CBR_AUSCIS_TEST_API_URL resolves to the known ACTIONUSA AI (Production) host. Refusing unconditionally." >&2
  exit 1
fi
if [ "$NORMALIZED_URL" != "$EXPECTED_URL" ]; then
  echo "ABORT: this diagnostic is scoped to $EXPECTED_URL only (the project confirmed this round). Got '$CBR_AUSCIS_TEST_API_URL'. Refusing an unverified or different target." >&2
  exit 1
fi
API_URL="$NORMALIZED_URL"

echo "=================================================================="
echo " TARGET (fixed, scoped to this diagnostic): $API_URL"
echo " Verified NOT the known ACTIONUSA AI / Production host."
echo "=================================================================="
read -r -p "Type CONFIRM (exactly) to proceed against the URL printed above: " CONFIRMATION
if [ "$CONFIRMATION" != "CONFIRM" ]; then
  echo "ABORT: confirmation not given. No request was sent." >&2
  exit 1
fi

run_request() {
  local desc="$1" out_body="$2" out_headers="$3"; shift 3
  local http_code
  set +e
  http_code=$(curl -sS --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" \
    -D "$out_headers" -o "$out_body" -w "%{http_code}" "$@")
  local curl_exit=$?
  set -e
  if [ "$curl_exit" -ne 0 ]; then
    echo "ABORT: network/TLS/timeout error running '$desc' (curl exit code $curl_exit)." >&2
    exit 1
  fi
  echo "$http_code"
}

# Prints only SERVER RESPONSE headers (never request headers, never the
# apikey/Authorization we sent) -- safe to display and save.
print_diagnostic_headers() {
  local headers_file="$1"
  grep -iE '^(server|via|www-authenticate|x-kong|x-ratelimit|date|content-type):' "$headers_file" || echo "  (none of the tracked header names were present)"
}

echo ""
echo "=== [A] Re-confirmation: repeat the ALREADY-PASSING explicit cbr_internal RPC probe (same request the owner's run already got 406/PGRST106 on), using the SAME anon key, right now ==="
echo "Purpose: rule out 'the key itself has since become invalid/expired'"
echo "as an explanation for [B] below, by checking the SAME key still"
echo "authenticates successfully for a DIFFERENT request in this SAME"
echo "session. Body is the same harmless p_gate=null already reviewed."
HTTP_A=$(run_request "re-confirmation RPC probe" "$WORKDIR/a-body.json" "$WORKDIR/a-headers.txt" \
  -X POST "$API_URL/rest/v1/rpc/cbr_toggle_gate" \
  -H "Content-Profile: cbr_internal" \
  -H "apikey: $CBR_AUSCIS_TEST_ANON_KEY" -H "Authorization: Bearer $CBR_AUSCIS_TEST_ANON_KEY" \
  -H "Content-Type: application/json" -d '{"p_gate":null,"p_enable":null,"p_actor_id":null}')
CODE_A=$(python3 -c "
import json
try:
    d = json.load(open('$WORKDIR/a-body.json'))
    print(d.get('code','') if isinstance(d, dict) else 'UNPARSEABLE')
except Exception:
    print('UNPARSEABLE')
")
echo "HTTP status: $HTTP_A | code: $CODE_A"
echo "Body:"; cat "$WORKDIR/a-body.json"; echo
echo "Response headers of interest:"
print_diagnostic_headers "$WORKDIR/a-headers.txt"

echo ""
echo "=== [B] The positive-control request itself, repeated with the OpenAPI media type requested explicitly ==="
echo "GET $API_URL/rest/v1/ , Accept: application/openapi+json, application/json"
echo "Note: official PostgREST documentation (postgrest.org/en/stable/"
echo "references/api/openapi.html), fetched and reviewed this round, does"
echo "NOT itself mandate a specific Accept value for this document -- it"
echo "states the OpenAPI description is served automatically at the root"
echo "path via a plain GET. 'application/openapi+json' is included here as"
echo "the general, standard OpenAPI media type, sent explicitly per"
echo "instruction -- not asserted as a PostgREST-specific requirement."
HTTP_B=$(run_request "positive control, explicit OpenAPI Accept" "$WORKDIR/b-body.json" "$WORKDIR/b-headers.txt" \
  -X GET "$API_URL/rest/v1/" \
  -H "Accept: application/openapi+json, application/json" \
  -H "apikey: $CBR_AUSCIS_TEST_ANON_KEY" -H "Authorization: Bearer $CBR_AUSCIS_TEST_ANON_KEY")
CODE_B=$(python3 -c "
import json
try:
    d = json.load(open('$WORKDIR/b-body.json'))
    print(d.get('code','') if isinstance(d, dict) else 'UNPARSEABLE-OR-NOT-AN-OBJECT')
except Exception:
    print('UNPARSEABLE')
")
MESSAGE_B=$(python3 -c "
import json
try:
    d = json.load(open('$WORKDIR/b-body.json'))
    print(d.get('message','') if isinstance(d, dict) else '')
except Exception:
    print('')
")
echo "HTTP status: $HTTP_B | code: $CODE_B | message: $MESSAGE_B"
echo "Full body:"; cat "$WORKDIR/b-body.json"; echo
echo "Response headers of interest:"
print_diagnostic_headers "$WORKDIR/b-headers.txt"

echo ""
echo "=================================================================="
echo "RAW RESULTS ONLY ABOVE. No cause is assigned by this script."
echo "=================================================================="
echo ""
echo "HOW TO READ THIS (decision tree over the evidence just captured --"
echo "report [A] and [B]'s exact status/code/message/headers verbatim so"
echo "this can actually be resolved, rather than guessed):"
echo ""
echo "1. If [A] is NOT 406/PGRST106 this time (i.e. the already-working"
echo "   probe now ALSO fails): the anon key itself has likely changed"
echo "   state since the original run (rotated, expired, or the env var"
echo "   was not exported correctly for THIS session) -- investigate the"
echo "   key/environment before looking at [B] any further."
echo ""
echo "2. If [A] is still 406/PGRST106 (key confirmed still working for a"
echo "   DIFFERENT request) AND [B] is still 401: the problem is specific"
echo "   to the bare /rest/v1/ root request, not to the key's validity in"
echo "   general. Within that:"
echo "   a. If [B]'s body has PostgREST's own error shape (top-level"
echo "      'code' starting with 'PGRST', plus 'details'/'hint' keys, the"
echo "      same envelope shape [A] and the earlier explicit-schema probes"
echo "      showed): the 401 was produced BY POSTGREST ITSELF (e.g. a"
echo "      role/JWT-claim check specific to generating the OpenAPI"
echo "      description), not by the gateway in front of it."
echo "   b. If [B]'s body has NO 'code' field at all -- just a bare"
echo "      {\"message\": \"...\"} or similar, especially if the message text"
echo "      mentions 'API key' / 'JWT' / 'Unauthorized' generically -- this"
echo "      is consistent with the GATEWAY in front of PostgREST (Kong, in"
echo "      a standard Supabase deployment) rejecting the request before"
echo "      it ever reaches PostgREST, specifically for this route/path,"
echo "      even though the SAME key reached PostgREST successfully for"
echo "      [A]'s different path."
echo "   c. The response headers captured above (Server / Via / X-Kong-*)"
echo "      can further indicate which layer answered: headers naming Kong"
echo "      (or absent entirely) point at the gateway; a plain PostgREST-"
echo "      style response with no gateway-specific headers points at"
echo "      PostgREST itself."
echo "3. If [B] succeeds now (200 + OpenAPI-shaped body) where it 401'd"
echo "   before: the condition was transient (e.g. a momentary gateway/"
echo "   config hiccup) -- report this explicitly rather than assuming it"
echo "   is now permanently resolved."
echo ""
echo "This script does not decide between 2a/2b/2c on its own -- report"
echo "the exact captured evidence for a follow-up determination."
echo ""
echo "No cleanup required: [A] never reaches any table (rejected at"
echo "PostgREST's schema-selection step, as already established); [B] is a"
echo "read-only GET against a description endpoint, not a business table."
