-- ============================================================
-- AC-68 — anon-role deployed-grants inspection (READ-ONLY)
-- ============================================================
-- Governing authority: approved CBR Consolidated Design, §M AC-68.
--
-- WHY THIS FILE EXISTS: the OpenAPI root document
-- (`GET /rest/v1/`) has now been confirmed, by real AUSCIS-TEST
-- execution, to require service_role specifically --
-- {"message":"Invalid API key","hint":"Only the `service_role` API key
-- can be used for this endpoint."} -- so it cannot serve as AC-68's
-- required anon-role positive control. A repository-source search (this
-- round) found no explicit `GRANT ... TO anon` anywhere in
-- supabase/schema.sql or supabase/migrations/*.sql, no RLS policy
-- naming `anon` or `public` as an allowed role on any table, and no
-- client-side application code that makes a direct anon-role
-- `.from()`/`.rpc()` PostgREST call at all (the public /intake flow
-- submits through the server-side `/api/intake` route using
-- service_role, not directly from the browser as anon). Source alone is
-- therefore NOT sufficient to establish a safe anon-role positive
-- control -- the actual DEPLOYED grants on AUSCIS-TEST (which can
-- include Supabase's own default auto-exposure behavior, configured on
-- the hosted dashboard, not visible in any migration file) must be
-- inspected directly before one can be chosen.
--
-- TARGET: AUSCIS-TEST. ACTIONUSA AI must NEVER be targeted.
--
-- WHAT THIS FILE DOES: reads ONLY `information_schema`/`pg_catalog`
-- metadata (grants, RLS policy definitions, RLS enabled/forced flags,
-- schema-usage privileges). It does NOT read a single row of any
-- business table (clients, cases, canonical_beneficiary_records,
-- intake_submissions, profiles, etc.) -- only catalog descriptions of
-- what is GRANTED, never actual row content.
--
-- WHAT THIS FILE DOES NOT DO: no writes, no DDL, no GRANT/REVOKE, no
-- schema/config change, no gate toggle, no trigger disable. Ends in
-- ROLLBACK (nothing above it could write anything regardless).
--
-- OWNER WORKFLOW: Alex runs this manually in AUSCIS-TEST's SQL Editor
-- and returns the result grid for review. Code does not execute this.
-- ============================================================

BEGIN TRANSACTION READ ONLY;

WITH schema_usage AS (
  SELECT 'SCHEMA_USAGE' AS kind, s.nspname AS schema_name, NULL::TEXT AS object_name,
         has_schema_privilege('anon', s.nspname, 'USAGE')::TEXT AS detail_1,
         NULL::TEXT AS detail_2
  FROM (VALUES ('public'), ('graphql_public'), ('cbr_internal')) AS s(nspname)
),
anon_table_grants AS (
  SELECT 'TABLE_GRANT' AS kind, table_schema AS schema_name, table_name AS object_name,
         privilege_type AS detail_1, is_grantable AS detail_2
  FROM information_schema.role_table_grants
  WHERE grantee = 'anon' AND table_schema IN ('public', 'graphql_public')
),
anon_function_grants AS (
  SELECT 'FUNCTION_GRANT' AS kind, routine_schema AS schema_name, routine_name AS object_name,
         privilege_type AS detail_1, is_grantable AS detail_2
  FROM information_schema.routine_privileges
  WHERE grantee = 'anon' AND routine_schema IN ('public', 'graphql_public')
),
rls_state AS (
  SELECT 'RLS_STATE' AS kind, n.nspname AS schema_name, c.relname AS object_name,
         c.relrowsecurity::TEXT AS detail_1, c.relforcerowsecurity::TEXT AS detail_2
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND c.relname IN (SELECT object_name FROM anon_table_grants)
),
anon_policies AS (
  SELECT 'ANON_OR_PUBLIC_POLICY' AS kind, schemaname AS schema_name, tablename AS object_name,
         policyname AS detail_1, cmd AS detail_2
  FROM pg_policies
  WHERE schemaname = 'public' AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['public']::name[])
)
SELECT * FROM schema_usage
UNION ALL
SELECT * FROM anon_table_grants
UNION ALL
SELECT * FROM anon_function_grants
UNION ALL
SELECT * FROM rls_state
UNION ALL
SELECT * FROM anon_policies
ORDER BY 1, 2, 3;

ROLLBACK;
