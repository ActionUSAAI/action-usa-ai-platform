#!/usr/bin/env bash
# AUSCIS MTCS-01 — TEST-ONLY tool. Fails closed if target is not the
# known AUSCIS-TEST project. Never touches production.
set -euo pipefail
TEST_REF="utpsqevarnxscdqzywkk"
PROD_REF="slasbfepqovdsezmadjh"
if [ -z "$TEST_REF" ] || [ "$TEST_REF" = "$PROD_REF" ]; then
  echo "ABORT: TEST ref invalid or equals PROD ref" >&2
  exit 1
fi
if [ "$#" -lt 1 ]; then
  echo "usage: run-sql.sh <file.sql>" >&2
  exit 1
fi
echo "[run-sql] target=$TEST_REF file=$1" >&2
supabase link --project-ref "$TEST_REF" >&2
supabase db query --linked --file "$1"
