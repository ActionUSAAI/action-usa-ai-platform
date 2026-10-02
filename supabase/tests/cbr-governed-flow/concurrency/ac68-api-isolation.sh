#!/usr/bin/env bash
# AC-68 — cbr_internal.* is unreachable via the PostgREST API. Executable
# against a running local stack (`supabase start`); asserts the ACTUAL
# HTTP response, not merely "access was denied" by some other means.
#
# UNEXECUTED: written and statically reviewed only; never run.
set -euo pipefail

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

API_URL="${CBR_TEST_API_URL:-http://127.0.0.1:54321}"
case "$API_URL" in
  *127.0.0.1*|*localhost*) : ;;
  *) echo "ABORT: CBR_TEST_API_URL must be localhost/127.0.0.1. Refusing $API_URL" >&2; exit 1 ;;
esac

# service_role key for the LOCAL stack only (printed by `supabase status`),
# never a TEST/Production key. Required so the call at least passes
# PostgREST's own auth layer and reaches schema resolution.
SERVICE_KEY="${CBR_TEST_LOCAL_SERVICE_KEY:?Set CBR_TEST_LOCAL_SERVICE_KEY to the local stack service_role key, see: supabase status}"

echo "=== AC-68: POST $API_URL/rest/v1/rpc/cbr_toggle_gate (cbr_internal function, schema-excluded) ==="
HTTP_CODE=$(curl -s -o "$WORKDIR/ac68-response.json" -w "%{http_code}" \
  -X POST "$API_URL/rest/v1/rpc/cbr_toggle_gate" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: application/json" \
  -d '{"p_gate":"g1g2","p_enable":true,"p_actor_id":"00000000-0000-0000-0000-000000000000"}')

echo "HTTP status: $HTTP_CODE"
echo "Body:"; cat "$WORKDIR/ac68-response.json"; echo

CODE=$(python3 -c "import json;print(json.load(open('$WORKDIR/ac68-response.json')).get('code',''))" 2>/dev/null || echo "")
if [ "$HTTP_CODE" = "404" ] && [ "$CODE" = "PGRST202" ]; then
  echo "[PASS] AC-68 — HTTP 404, PGRST202, function not found in exposed schema (cbr_internal correctly excluded)"
elif [ "$HTTP_CODE" = "404" ]; then
  echo "[PARTIAL] AC-68 — HTTP 404 as expected but response body did not contain PGRST202 (code='$CODE') — report this discrepancy verbatim rather than treating 404 alone as sufficient (per instruction: distinguish the exact expectation from a coincidentally-similar result)."
else
  echo "[FAIL] AC-68 — expected HTTP 404/PGRST202, got HTTP $HTTP_CODE"
  exit 1
fi

echo ""
echo "=== AC-68 control: the SAME call against a public-schema function (cbr_tx01_realize_g1g2) should NOT 404 the same way (confirms the 404 above is schema-exclusion, not a general RPC misconfiguration) ==="
HTTP_CODE2=$(curl -s -o "$WORKDIR/ac68-control.json" -w "%{http_code}" \
  -X POST "$API_URL/rest/v1/rpc/cbr_tx01_realize_g1g2" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: application/json" \
  -d '{"p_submission_id":"00000000-0000-0000-0000-000000000000","p_field_key":"email"}')
echo "HTTP status: $HTTP_CODE2"; cat "$WORKDIR/ac68-control.json"; echo
if [ "$HTTP_CODE2" != "404" ]; then
  echo "[PASS] AC-68-control — public-schema function is reachable (not schema-excluded), confirming the AC-68 404 above is specific to cbr_internal"
else
  # IC Finding 6.1: a "control" that silently fails to control for anything
  # is exactly the "printed FAIL but the script kept going" defect this IC
  # targets — if the control itself 404s, AC-68's 404 no longer isolates
  # schema exclusion specifically, so this must abort, not merely print.
  echo "[FAIL] AC-68-control — public function unexpectedly also 404'd; the AC-68 result above does not isolate schema exclusion specifically" >&2
  exit 1
fi
