-- ============================================================
-- AC-69 v4.1.1 — readiness + fixture-safety inspection (READ-ONLY)
-- PostgreSQL type-safety correction over v4.1 -- see EXECUTION HISTORY.
-- ============================================================
-- Governing authority: approved CBR Consolidated Design, §M AC-69.
--
-- EXECUTION HISTORY (preserved, not erased):
--   Execution Attempt #1
--   Environment:    AUSCIS-TEST / Supabase SQL Editor
--   Artifact:       C v4.1 (ac69-readiness-inspection-v4.1-READ-ONLY.sql)
--   Result:         FAILED BEFORE INSPECTION COMPLETION
--   SQLSTATE:       42725
--   Observed error: operator is not unique: text || "char"
--                   LINE 147: con.conname || ' [' || con.contype || ']' ...
--   Known location: constraint diagnostic expression using
--                   pg_constraint.contype (PostgreSQL internal type "char")
--   Database modification: NONE (read-only artifact; the error occurred
--                   during query analysis, before any data was touched)
--   Inspection conclusions: NOT ESTABLISHED -- the inspection did not
--                   complete. This failure is a SQL-authoring/type-
--                   compatibility defect in the artifact itself, NOT a
--                   CBR runtime failure and NOT an AC-69 acceptance
--                   failure. Nothing about deployed state may be inferred
--                   from it.
--
-- v4.1.1 CORRECTIONS (type-safety only -- see CHANGELOG-C-v4.1.1.md for
-- the full source-first validation table):
--   1. con.contype::text (line ~155) -- the reported defect. pg_constraint
--      .contype is PostgreSQL's internal "char" type; concatenating it
--      directly with text is ambiguous (SQLSTATE 42725) because "char"
--      has more than one candidate || operator. Explicit ::text removes
--      the ambiguity. No change to which constraints are selected or to
--      the diagnostic meaning -- only to how the type is resolved.
--   2. c.relname::text, t.tgname::text (Part C, trigger inventory) --
--      both are PostgreSQL's internal "name" type. These are NOT
--      ambiguous in isolation or in the UNION ALL below (name has a
--      genuine implicit cast to text, unlike "char"), but per a full
--      artifact-wide type-safety audit, they are the only two bare
--      catalog-typed values flowing directly into a UNION ALL result
--      column that is textual in every other branch -- explicit ::text
--      makes that resolution explicit rather than implicit, with no
--      value change (name->text is a lossless widening conversion).
--   Reviewed and intentionally NOT changed (would alter output
--   formatting, not just type resolution -- see changelog):
--   con.convalidated / con.condeferrable / con.condeferred, concatenated
--   via || in Part E. These match PostgreSQL's unambiguous, documented
--   `text || anynonarray` operator (unlike "char", which has competing
--   candidates) -- no SQLSTATE 42725-class risk exists here. Casting them
--   would silently change their displayed form from Postgres's native
--   boolean output ('t'/'f') to the ::text cast form ('true'/'false') --
--   a real, if minor, semantic/formatting difference, so it was not made
--   without separate, explicit approval.
--
-- LABEL, PER INSTRUCTION: Parts A, B, C, D, E below are DEPLOYED-STATE
-- verification (run directly against AUSCIS-TEST). This is NOT a
-- substitute for, and does not re-confirm, the separate REPOSITORY
-- source-code reading documented in A/B of the v4.1 package (application
-- route behavior, migration file contents as committed) -- those remain
-- source inspection, not deployed verification, until independently
-- checked against the running application itself (still outstanding,
-- listed in the README's "remaining deployment facts").
--
-- TARGET: AUSCIS-TEST. ACTIONUSA AI must NEVER be targeted.
--
-- WHAT THIS FILE DOES: reads ONLY pg_proc/information_schema/pg_trigger/
-- pg_constraint metadata, the 3 rows of cbr_internal.cbr_field_gate_state,
-- all open rows of cbr_internal.cbr_field_admission_window, and a narrow,
-- correlation-ID-scoped existence check against clients/intake_
-- invitations/auth.users. It does NOT read any other business data.
-- Inspection scope is UNCHANGED from v4.1 -- no checks added or removed.
--
-- WHAT THIS FILE DOES NOT DO: no writes, no DDL, no gate toggle, no
-- trigger/constraint change, no function invocation that modifies state.
-- Ends in ROLLBACK.
--
-- OWNER WORKFLOW: Alex runs this manually in AUSCIS-TEST's SQL Editor
-- and returns the full result grid (or exact error) for review before
-- any modifying step. Code does not execute this.
--
-- SUBSTITUTION REQUIRED before running Part D below: replace every
-- occurrence of {{CORRELATION_ID}} with the exact correlation ID chosen
-- for this test run (e.g. AC69-7f3a91c2) -- see D-AC69-SETUP-EXECUTABLE.md
-- for how this ID is generated. Parts A, B, C, E require no substitution.
-- ============================================================

BEGIN TRANSACTION READ ONLY;

-- ── Part A: function presence ───────────────────────────────────────────
WITH expected_functions(display_name, signature) AS (
  VALUES
    ('public.submit_intake_for_invitation', 'public.submit_intake_for_invitation(text,jsonb)'),
    ('public.cbr_tx01_realize_g1g2',        'public.cbr_tx01_realize_g1g2(uuid,text)'),
    ('public.cbr_tx02_observe_g3',          'public.cbr_tx02_observe_g3(uuid,text)'),
    ('cbr_internal.cbr_toggle_gate',        'cbr_internal.cbr_toggle_gate(text,boolean,uuid)'),
    ('cbr_internal.cbr_resolve_field',      'cbr_internal.cbr_resolve_field(text)'),
    ('cbr_internal.cbr_values_equal',       'cbr_internal.cbr_values_equal(text,text,text)')
),
function_check AS (
  SELECT 'A_FUNCTION_PRESENT' AS kind, display_name AS object_name,
         (to_regprocedure(signature) IS NOT NULL)::TEXT AS detail_1,
         signature AS detail_2
  FROM expected_functions
),

-- ── Part B: gate/window baseline, ALL THREE gates ──────────────────────
gate_state AS (
  SELECT 'B_GATE_STATE' AS kind, gate AS object_name, enabled::TEXT AS detail_1, NULL::TEXT AS detail_2
  FROM cbr_internal.cbr_field_gate_state
),
window_state AS (
  SELECT 'B_OPEN_ADMISSION_WINDOW' AS kind, gate AS object_name, opened_at::TEXT AS detail_1, NULL::TEXT AS detail_2
  FROM cbr_internal.cbr_field_admission_window
  WHERE closed_at IS NULL
),

-- ── Part C: deployed trigger inventory for every table the proposed ────
-- ── fixture/cleanup touches -- confirms what is ACTUALLY installed. ────
-- v4.1.1: c.relname/t.tgname explicitly cast ::text (both are PostgreSQL
-- "name" type) -- see header note #2. No ambiguity existed here; this is
-- a defensive explicit-normalization for UNION column-type clarity only.
relevant_triggers AS (
  SELECT 'C_DEPLOYED_TRIGGER' AS kind,
         c.relname::text AS object_name,
         t.tgname::text AS detail_1,
         pg_get_triggerdef(t.oid) AS detail_2
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal
    AND n.nspname = 'public'
    AND c.relname IN ('clients','cases','intake_invitations','intake_submissions',
                       'canonical_beneficiary_records','agent_intake_analysis')
),

-- ── Part D: pre-existence check for THIS specific correlation ID ───────
-- ── (substitute {{CORRELATION_ID}} before running) ──────────────────────
preexisting_client AS (
  SELECT 'D_PREEXISTING_CLIENT' AS kind, id::TEXT AS object_name, first_name AS detail_1, created_at::TEXT AS detail_2
  FROM public.clients WHERE first_name = '{{CORRELATION_ID}}'
),
preexisting_invitation AS (
  SELECT 'D_PREEXISTING_INVITATION_EMAIL' AS kind, id::TEXT AS object_name, email AS detail_1, created_at::TEXT AS detail_2
  FROM public.intake_invitations WHERE lower(email) = lower('{{CORRELATION_ID}}@example.invalid')
),
preexisting_auth_user AS (
  SELECT 'D_PREEXISTING_AUTH_USER' AS kind, id::TEXT AS object_name, email AS detail_1, created_at::TEXT AS detail_2
  FROM auth.users WHERE lower(email) = lower('{{CORRELATION_ID}}@example.invalid')
),

-- ── Part E (v4.1): deployed FK constraint topology ──────────────────────
-- pg_get_constraintdef() returns the complete, human-readable constraint
-- definition (columns, referenced table/columns, ON DELETE/UPDATE
-- action, MATCH type) -- the deployed source of truth, not the migration
-- file. Included both directions: constraints defined ON these tables,
-- and constraints defined on OTHER tables that reference these tables
-- (e.g. a hypothetical or actual FK from an unrelated table into
-- clients/cases would show up here even if this file's author did not
-- anticipate it).
relevant_tables(schema_name, table_name) AS (
  VALUES ('public','clients'), ('public','cases'), ('public','intake_invitations'),
         ('public','intake_submissions'), ('public','canonical_beneficiary_records'),
         ('cbr_internal','cbr_field_processing_state'), ('public','agent_intake_analysis'),
         ('public','profiles'), ('auth','users')
),
fk_constraints AS (
  -- v4.1.1: con.convalidated/condeferrable/condeferred reviewed and left
  -- unchanged -- text || anynonarray is unambiguous for boolean (unlike
  -- "char"); casting would silently change 't'/'f' to 'true'/'false'.
  -- See header note. sn.nspname/sc.relname/rn.nspname/rc.relname are
  -- already forced to text by the || operator itself -- no separate cast
  -- needed (distinct from Part C's bare, un-concatenated name columns).
  SELECT 'E_FK_CONSTRAINT' AS kind,
         sn.nspname || '.' || sc.relname AS object_name,
         con.conname || ' -> ' || COALESCE(rn.nspname || '.' || rc.relname, '(referenced table not visible)') AS detail_1,
         pg_get_constraintdef(con.oid)
           || ' [validated=' || con.convalidated
           || ', deferrable=' || con.condeferrable
           || ', deferred=' || con.condeferred || ']' AS detail_2
  FROM pg_constraint con
  JOIN pg_class sc ON sc.oid = con.conrelid
  JOIN pg_namespace sn ON sn.oid = sc.relnamespace
  LEFT JOIN pg_class rc ON rc.oid = con.confrelid
  LEFT JOIN pg_namespace rn ON rn.oid = rc.relnamespace
  WHERE con.contype = 'f'
    AND (
      (sn.nspname, sc.relname) IN (SELECT schema_name, table_name FROM relevant_tables)
      OR
      (rn.nspname, rc.relname) IN (SELECT schema_name, table_name FROM relevant_tables)
    )
),
check_unique_constraints AS (
  -- v4.1.1 PRIMARY FIX: con.contype::text -- see header note #1 and
  -- EXECUTION HISTORY above. con.contype = 'f' / IN ('c','u','p') in the
  -- WHERE clauses of this file were reviewed and are NOT affected --
  -- equality/IN comparison of "char" against single-character literals
  -- is unambiguous, unlike || concatenation of "char".
  SELECT 'E_CHECK_OR_UNIQUE_CONSTRAINT' AS kind,
         sn.nspname || '.' || sc.relname AS object_name,
         con.conname || ' [' || con.contype::text || ']' AS detail_1,
         pg_get_constraintdef(con.oid) AS detail_2
  FROM pg_constraint con
  JOIN pg_class sc ON sc.oid = con.conrelid
  JOIN pg_namespace sn ON sn.oid = sc.relnamespace
  WHERE con.contype IN ('c','u','p')
    AND (sn.nspname, sc.relname) IN (SELECT schema_name, table_name FROM relevant_tables)
)

SELECT * FROM function_check
UNION ALL SELECT * FROM gate_state
UNION ALL SELECT * FROM window_state
UNION ALL SELECT * FROM relevant_triggers
UNION ALL SELECT * FROM preexisting_client
UNION ALL SELECT * FROM preexisting_invitation
UNION ALL SELECT * FROM preexisting_auth_user
UNION ALL SELECT * FROM fk_constraints
UNION ALL SELECT * FROM check_unique_constraints
ORDER BY 1, 2;

ROLLBACK;
