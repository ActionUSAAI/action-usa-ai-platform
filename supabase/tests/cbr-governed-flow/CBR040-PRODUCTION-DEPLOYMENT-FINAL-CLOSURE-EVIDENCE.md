# CBR-040 — Production Deployment Final Closure Evidence

MODE: DOCUMENTARY CLOSURE ONLY. **No Production mutation performed in
the production of this artifact.** This is the final immutable
documentary record of the CBR-040 Production deployment and its
post-deployment verification, including the V1 verifier failure and
its V2 correction.

## 1. Target / Source Identity

```
PRODUCTION_PROJECT: ActionUSA AI
PRODUCTION_PROJECT_REF: slasbfepqovdsezmadjh
AUSCIS_TEST_PROJECT_REF: utpsqevarnxscdqzywkk (distinct; never the deployment target)

Repository state used for deployment:
  BRANCH: main
  HEAD: 62da194a2a7cbddab9633d6890312b3d93b09a72
  ORIGIN_MAIN: 62da194a2a7cbddab9633d6890312b3d93b09a72 (HEAD == origin/main)
  WORKING_TREE: clean (tracked); only the three historically-protected
    untracked AC-69 inspection files present, untouched

Canonical Migration 040:
  FILE: supabase/migrations/040_cbr_governed_confirmation_flow.sql
  SHA256: fa166b36154bfdecfe561fed77e6c9ad68daef233a95e02aa6b6053f70abb5b4
  LINES: 1140
```

## 2. Pre-Deployment Gate (governing, carried forward)

```
CBR040_PRODUCTION_PREDEPLOYMENT_GATE: PASS
MIGRATION_039: APPLIED
MIGRATION_040_PREDEPLOYMENT: NOT_APPLIED
ONLY_MIGRATION_040_WOULD_APPLY: YES (proven via `supabase db push
  --project-ref slasbfepqovdsezmadjh --dry-run` -> migrations=
  ["040_cbr_governed_confirmation_flow.sql"], seeds=[], roles=[])
PRODUCTION_040_PARTIAL_INSTALL: NO
STRUCTURAL_BASELINE: PASS
DATA_COMPATIBILITY: PASS
CANONICAL_BENEFICIARY_RECORDS_ROW_COUNT: 0
RECOVERY_CHECKPOINT: PASS (daily physical backup, walg_enabled=true,
  pitr_enabled=false, most recent COMPLETED 2026-10-03T10:37:05Z)
BLOCKER_COUNT: 0
```

## 3. Authorized Production Execution

```
AUTHORIZATION: Owner-issued, exactly one controlled execution of
  canonical Migration 040 against slasbfepqovdsezmadjh.
COMMAND: supabase db push --project-ref slasbfepqovdsezmadjh
START (UTC): 2026-10-03T19:41:08Z
END (UTC):   2026-10-03T19:41:29Z
EXIT_STATUS: 0

STDOUT:
Initialising login role...
Connecting to remote database...
Applying migration 040_cbr_governed_confirmation_flow.sql...
{"upToDate":false,"dryRun":false,"migrations":["040_cbr_governed_confirmation_flow.sql"],"seeds":[],"roles":[],"message":"Finished supabase db push."}

MIGRATIONS_REPORTED_APPLIED: exactly 1 ("040_cbr_governed_confirmation_flow.sql")
UNEXPECTED_MIGRATIONS: 0
SEEDS: 0
ROLES: 0
```
`[OWNER-AUTHORIZED / CODE-EXECUTED, single invocation]`

### Independent migration-history confirmation

```
$ supabase migration list --project-ref slasbfepqovdsezmadjh (post-execution)
040: local="040", remote="040"

MIGRATION_040_PRODUCTION_STATUS: APPLIED (confirmed independently from
  the migration-history table, not inferred from db push's own exit
  status alone)
```

### Internal exposure boundary (post-execution, this deployment)

```
$ POST https://slasbfepqovdsezmadjh.supabase.co/rest/v1/rpc/cbr_resolve_field
HTTP 404
CBR_INTERNAL_EXPOSURE_BOUNDARY: PASS / PRESERVED
```

```
CBR040_PRODUCTION_MIGRATION_EXECUTION: PASS
MIGRATION_EXECUTION_COUNT: 1
MIGRATION_040_REEXECUTION_AUTHORIZED: NO
```

## 4. Production Execution Boundary (preserved)

```
DATABASE_MUTATION: YES — AUTHORIZED MIGRATION 040 ONLY
SOURCE_MUTATION_DURING_DEPLOYMENT: NO
GIT_MUTATION_DURING_DEPLOYMENT: NO
APPLICATION_DEPLOYMENT: NO
GATES_ENABLED: NO
PRODUCTION_SYNTHETIC_FIXTURE: NO
PRODUCTION_FUNCTIONAL_TX_VALIDATION: NOT_PERFORMED
```
Not authorized or performed by the deployment: gate activation,
admission-window creation, synthetic/real beneficiary processing,
TX01–TX05 business execution, application redeployment, Migration 041,
Migration 040 modification, migration-history repair.

## 5. Post-Deployment Verify V1 — Historical, Preserved, Failed-Closed

```
V1 ARTIFACT: CBR040-PRODUCTION-POSTDEPLOYMENT-VERIFY-READ-ONLY.sql
V1 SHA256 (approved, unchanged): 027edd4c7d1f34616c6f4bdca811781b3b4f5bab9bcb009c37ba30ce142f33bf
V1 LINES (approved, unchanged): 125
```

### Exact observed failure (Owner-executed, once, in Production)

```
SQLSTATE: 25006
ERROR: cannot execute SELECT FOR SHARE in a read-only transaction
CONTEXT:
  SELECT enabled
  FROM cbr_internal.cbr_field_gate_state
  WHERE gate='g3_staff_resolution'
  FOR SHARE
PL/pgSQL function: cbr_tx03_open_g3_review(uuid,uuid)
LINE: 12 at SQL statement
```
`[OWNER-EXECUTED / OWNER-SUPPLIED ERROR EVIDENCE]`

### Canonical classification

```
CBR040_PRODUCTION_POSTDEPLOYMENT_VERIFY_V1: CLOSED — FAILED_CLOSED
V1_FAILURE_SQLSTATE: 25006
V1_DATABASE_MUTATION: NO
MIGRATION_040_FAILURE: NO
MIGRATION_040_REEXECUTION_AUTHORIZED: NO
V1_REEXECUTION_AUTHORIZED: NO
```
**This was a defect in the verification artifact's reasoning about
PostgreSQL locking-clause/transaction-mode interaction, not a failure
of Migration 040 itself.** Migration 040's own deployment (Section 3)
completed successfully before V1 was ever run. V1 is preserved
unmodified as part of the audit trail — not deleted, not rewritten.

### V1 root cause (source-first, re-confirmed)

```
cbr_tx03_open_g3_review, cbr_tx04_approve_g3, cbr_tx05_reject_g3 each
begin unconditionally with:
  SELECT enabled INTO v_staff_enabled FROM cbr_internal.cbr_field_gate_state
  WHERE gate='g3_staff_resolution' FOR SHARE;
(migration 040, lines 835 / 919 / 1087 respectively -- identical pattern)

PostgreSQL categorically rejects explicit row-locking SELECTs (FOR SHARE /
FOR UPDATE) inside a READ ONLY transaction (SQLSTATE 25006). This holds
true:
  - independent of gate state (true even though all three gates were
    freshly seeded DISABLED by the migration itself);
  - independent of whether the supplied UUID is real or nonexistent
    (the locking read executes before any UUID-based lookup).

TX03_READ_ONLY_COMPATIBLE: NO
TX04_READ_ONLY_COMPATIBLE: NO
TX05_READ_ONLY_COMPATIBLE: NO
GOVERNING_STATE_READ_ONLY_COMPATIBLE: YES (public.cbr_review_surface_
  governing_state is a plain `LANGUAGE sql` SELECT with no FOR SHARE/
  FOR UPDATE anywhere in its body -- migration 040 lines 1129-1135)
```

### V1 no-mutation containment (source/transaction-semantics proof)

```
Every statement that executed before the failure (migration-history
checks; all to_regclass/to_regprocedure/pg_trigger/information_schema
structural probes; the three gate-state reads; the two admission-
window-count reads) is a plain, non-locking SELECT -- none could
mutate regardless of transaction mode. The transaction never reached
COMMIT; it aborted on the FOR SHARE error. The READ ONLY declaration
itself blocks all writes at the statement level for the entire script,
independent of where it errored.

V1_DATABASE_MUTATION: NO (established, not merely asserted)
```

## 6. V2 — Canonical Corrected Post-Deployment Verifier

```
V2 ARTIFACT: CBR040-PRODUCTION-POSTDEPLOYMENT-VERIFY-V2-READ-ONLY.sql
V2 SHA256 (verified fresh from disk, this gate): ed33116a95f2ffbbad29bf272e580e6945c2515d3e6a8682ded1cc1d0d9eab18
V2 LINES (verified fresh from disk, this gate): 134
MATCH TO APPROVED IDENTITY: YES
```

### V2 correction boundary (diff-verified, minimum)

```
Changed from V1:
  - explanatory header correction (documents the SQLSTATE 25006 root cause)
  - removal of the TX03 live-call probe branch
  - removal of the TX04 live-call probe branch
  - removal of the TX05 live-call probe branch
  - explanatory footer correction

Unchanged from V1 (byte-identical, diff-confirmed):
  - migration-history verification (Section A)
  - complete migration-040 structural footprint (Section B): internal
    tables, internal functions, public functions, trigger, 3 new
    columns, decision-state constraint (incl. 'superseded'), both new
    unique indexes
  - safe-baseline governed-gate state (3 gates)
  - open admission-window counts (2 gates)
  - governing-state live-call probe
  - canonical_beneficiary_records row-count recheck

GOVERNING_STATE_READ_ONLY_COMPATIBLE: YES (retained, unchanged)
```

## 7. V2 Production Execution Result (Owner-executed, once)

```
migration_039_applied:                           true
migration_040_applied:                            true
latest_applied_migration_version:                  040
unexpected_migrations_after_040_count:              0

cbr_field_gate_state_exists:                         true
cbr_field_admission_window_exists:                    true
cbr_field_processing_state_exists:                     true
cbr_toggle_gate_exists:                                 true
cbr_validate_relationship_exists:                        true
cbr_values_equal_exists:                                  true
cbr_normalize_for_storage_exists:                          true
cbr_tx01_realize_g1g2_exists:                               true
cbr_tx02_observe_g3_exists:                                  true
cbr_tx03_open_g3_review_exists:                               true
cbr_tx04_approve_g3_exists:                                    true
cbr_tx05_reject_g3_exists:                                      true
cbr_review_surface_governing_state_exists:                       true
cbr_validate_relationship_trg_exists:                             true
canonical_beneficiary_records_has_source_observation_id:           true
canonical_beneficiary_records_has_related_candidate_id:             true
canonical_beneficiary_records_has_superseded_by_submission_id:       true
decision_state_check_includes_superseded:                             1
cbr_change_realized_unique_index_exists:                               true
cbr_conflict_related_candidate_unique_index_exists:                     true

g1g2_enabled:                                                           false
g3_observation_enabled:                                                  false
g3_staff_resolution_enabled:                                             false
open_g1g2_windows:                                                        0
open_g3_observation_windows:                                               0

governing_state_probe_row_count:                                            0

canonical_beneficiary_records_row_count:                                     0
```
`[OWNER-EXECUTED / OWNER-SUPPLIED READ-ONLY DATABASE EVIDENCE]`

```
CBR040_PRODUCTION_POSTDEPLOYMENT_VERIFY_V2: PASS
CBR040_STRUCTURAL_MATCH: PASS (every migration-040 object present, every
  value exactly as expected -- 20/20 structural checks true)
SAFE_BASELINE_GATE_STATE: PASS (all 3 gates DISABLED, 0/0 open windows)
DATA_INTEGRITY_BASELINE: PASS (0 rows, consistent with no CBR activity
  before or during deployment)
```

## 8. Application ↔ Database Compatibility

```
APPLICATION_DATABASE_COMPATIBILITY_EVIDENCE: STRUCTURAL
```
Evidence: the deployed application routes
(`/api/cbr/pending-reviews`, `/api/cbr/review/{open,approve,reject}`)
call `.rpc("cbr_review_surface_governing_state", {p_client_id})` /
`.rpc("cbr_tx03_open_g3_review", {p_observation_id, p_actor_id})` /
`.rpc("cbr_tx04_approve_g3", {...})` / `.rpc("cbr_tx05_reject_g3",
{...})` with argument names/order matching migration 040's installed
function signatures exactly. Combined with Section 7's `to_regprocedure`
existence confirmation for every one of those exact signatures, this is
structural, source-and-catalog-grounded compatibility evidence.

```
PRODUCTION_FUNCTIONAL_TX_VALIDATION: NOT_PERFORMED (not upgraded to
  FUNCTIONAL; no live TX call was made; no Production fixture was
  created to strengthen this evidence)
PRODUCTION_SYNTHETIC_FIXTURE: NO
```

## 9. Governance Preservation

```
BROADER_PHASE_B_AUTHORIZED: NO
P7: BLOCKED
CR_CPS: UNCHANGED
PRODUCTION_CBR_ACTIVATION: NO
```
This closure does not authorize: enabling any gate, creating admission
windows, beginning CBR business processing in Production, Production
fixtures, functional Production TX validation, CBR policy changes,
broadening Phase B, unblocking P7, modifying CR-CPS, modifying
Migration 040, creating Migration 041, or application deployment. Any
future Production activation requires a separate, explicitly
authorized governed act.

## 10. No-Reexecution State

```
MIGRATION_040_REEXECUTION_AUTHORIZED: NO
V1_REEXECUTION_AUTHORIZED: NO
V2_REEXECUTION_AUTHORIZED: NO
```

See the companion report
(`CBR040-PRODUCTION-DEPLOYMENT-FINAL-CLOSURE-REPORT.md`) for the
concise formal closure determination.
