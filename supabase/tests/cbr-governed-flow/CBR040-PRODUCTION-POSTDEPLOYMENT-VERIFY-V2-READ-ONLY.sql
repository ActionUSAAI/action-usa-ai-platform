-- CBR-040 — PRODUCTION (slasbfepqovdsezmadjh) POST-DEPLOYMENT VERIFY
-- Read-only. Run once, immediately after a future "supabase db push
-- --project-ref slasbfepqovdsezmadjh" execution of migration 040 has
-- reported success. Independently re-verifies structure, migration
-- history, and safe-baseline gate state from a fresh transaction --
-- never inferred from the push command's own exit status alone.
--
-- V2 CORRECTION (minimum, from V1's observed SQLSTATE 25006 failure):
-- cbr_tx03_open_g3_review / cbr_tx04_approve_g3 / cbr_tx05_reject_g3 each
-- begin with "SELECT enabled FROM cbr_internal.cbr_field_gate_state ...
-- FOR SHARE" as their unconditional first statement (the gate check
-- itself, migration 040 source). PostgreSQL categorically refuses any
-- explicit row-locking SELECT (FOR SHARE/FOR UPDATE/etc.) inside a READ
-- ONLY transaction -- this is independent of gate state and independent
-- of whether the supplied UUID is real or nonexistent; V1's "the gate
-- check returns DISABLED before any write" reasoning was correct about
-- writes but did not account for this locking-clause restriction, which
-- applies before gate logic is even reached. These three calls are
-- therefore removed from the read-only verification boundary entirely
-- (not merely re-wrapped) -- no genuinely non-mutating mechanism exists
-- to invoke them from inside a READ ONLY transaction. Their existence
-- and exact argument signature remain independently verified below via
-- to_regprocedure (Section B), which is standard catalog metadata and
-- carries no locking semantics.
-- cbr_review_surface_governing_state is a plain `LANGUAGE sql` SELECT
-- (migration 040) with no FOR SHARE/FOR UPDATE anywhere in its body --
-- confirmed READ ONLY-transaction-compatible and retained below as the
-- one live-call compatibility probe.

BEGIN TRANSACTION READ ONLY;

-- A. Migration-history verification (independent of structural presence)
SELECT 'migration_039_applied' AS check,
  (EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '039'))::text AS result
UNION ALL
SELECT 'migration_040_applied',
  (EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '040'))::text
UNION ALL
SELECT 'latest_applied_migration_version',
  (SELECT max(version) FROM supabase_migrations.schema_migrations)
UNION ALL
SELECT 'unexpected_migrations_after_040_count',
  (SELECT count(*)::text FROM supabase_migrations.schema_migrations WHERE version > '040')

-- B. Structural verification (every migration-040 object, independently reconfirmed)
UNION ALL
SELECT 'cbr_field_gate_state_exists', (to_regclass('cbr_internal.cbr_field_gate_state') IS NOT NULL)::text
UNION ALL
SELECT 'cbr_field_admission_window_exists', (to_regclass('cbr_internal.cbr_field_admission_window') IS NOT NULL)::text
UNION ALL
SELECT 'cbr_field_processing_state_exists', (to_regclass('cbr_internal.cbr_field_processing_state') IS NOT NULL)::text
UNION ALL
SELECT 'cbr_toggle_gate_exists', (to_regprocedure('cbr_internal.cbr_toggle_gate(text,boolean,uuid)') IS NOT NULL)::text
UNION ALL
SELECT 'cbr_validate_relationship_exists', (to_regprocedure('cbr_internal.cbr_validate_relationship()') IS NOT NULL)::text
UNION ALL
SELECT 'cbr_values_equal_exists', (to_regprocedure('cbr_internal.cbr_values_equal(text,text,text)') IS NOT NULL)::text
UNION ALL
SELECT 'cbr_normalize_for_storage_exists', (to_regprocedure('cbr_internal.cbr_normalize_for_storage(text,text)') IS NOT NULL)::text
UNION ALL
SELECT 'cbr_tx01_realize_g1g2_exists', (to_regprocedure('public.cbr_tx01_realize_g1g2(uuid,text)') IS NOT NULL)::text
UNION ALL
SELECT 'cbr_tx02_observe_g3_exists', (to_regprocedure('public.cbr_tx02_observe_g3(uuid,text)') IS NOT NULL)::text
UNION ALL
SELECT 'cbr_tx03_open_g3_review_exists', (to_regprocedure('public.cbr_tx03_open_g3_review(uuid,uuid)') IS NOT NULL)::text
UNION ALL
SELECT 'cbr_tx04_approve_g3_exists', (to_regprocedure('public.cbr_tx04_approve_g3(uuid,uuid,text)') IS NOT NULL)::text
UNION ALL
SELECT 'cbr_tx05_reject_g3_exists', (to_regprocedure('public.cbr_tx05_reject_g3(uuid,uuid,text)') IS NOT NULL)::text
UNION ALL
SELECT 'cbr_review_surface_governing_state_exists', (to_regprocedure('public.cbr_review_surface_governing_state(uuid)') IS NOT NULL)::text
UNION ALL
SELECT 'cbr_validate_relationship_trg_exists',
  (EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cbr_validate_relationship_trg'))::text
UNION ALL
SELECT 'canonical_beneficiary_records_has_source_observation_id',
  (EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='canonical_beneficiary_records'
    AND column_name='source_observation_id'))::text
UNION ALL
SELECT 'canonical_beneficiary_records_has_related_candidate_id',
  (EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='canonical_beneficiary_records'
    AND column_name='related_candidate_id'))::text
UNION ALL
SELECT 'canonical_beneficiary_records_has_superseded_by_submission_id',
  (EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='canonical_beneficiary_records'
    AND column_name='superseded_by_submission_id'))::text
UNION ALL
SELECT 'decision_state_check_includes_superseded',
  (SELECT count(*)::text FROM pg_constraint WHERE conname = 'cbr_decision_state_values'
    AND pg_get_constraintdef(oid) LIKE '%superseded%')
UNION ALL
SELECT 'cbr_change_realized_unique_index_exists',
  (EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'cbr_change_realized_unique'))::text
UNION ALL
SELECT 'cbr_conflict_related_candidate_unique_index_exists',
  (EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'cbr_conflict_related_candidate_unique'))::text

-- Safe-baseline governed-gate state (source-defined expectation: all DISABLED, zero windows)
UNION ALL
SELECT 'g1g2_enabled', (SELECT enabled::text FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g1g2')
UNION ALL
SELECT 'g3_observation_enabled', (SELECT enabled::text FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_observation')
UNION ALL
SELECT 'g3_staff_resolution_enabled', (SELECT enabled::text FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_staff_resolution')
UNION ALL
SELECT 'open_g1g2_windows', (SELECT count(*)::text FROM cbr_internal.cbr_field_admission_window WHERE gate='g1g2' AND closed_at IS NULL)
UNION ALL
SELECT 'open_g3_observation_windows', (SELECT count(*)::text FROM cbr_internal.cbr_field_admission_window WHERE gate='g3_observation' AND closed_at IS NULL)

-- C. Non-mutating application-compatibility probe (TX03/TX04/TX05 live-call
--    probes REMOVED in V2 -- see header note; each is FOR-SHARE-incompatible
--    with READ ONLY regardless of gate state or UUID validity. Their
--    existence/signature is independently verified in Section B above via
--    to_regprocedure, which is the strongest non-mutating evidence available
--    for them, per the governing remediation design.)
UNION ALL
SELECT 'governing_state_probe_row_count', (SELECT count(*)::text FROM public.cbr_review_surface_governing_state(
  '00000000-0000-0000-0000-000000000000'::uuid))

-- Data integrity re-check (no CBR data should have been written by this migration)
UNION ALL
SELECT 'canonical_beneficiary_records_row_count', (SELECT count(*)::text FROM public.canonical_beneficiary_records);

ROLLBACK;

-- Expected for governing_state_probe_row_count: 0 (no processing-state row
-- exists for the nonexistent probe client_id). TX03/TX04/TX05 existence and
-- exact argument signature are established by Section B's to_regprocedure
-- checks (cbr_tx03_open_g3_review_exists / cbr_tx04_approve_g3_exists /
-- cbr_tx05_reject_g3_exists), not by a live call -- this is the maximum
-- authorized, genuinely non-mutating Production acceptance boundary.
