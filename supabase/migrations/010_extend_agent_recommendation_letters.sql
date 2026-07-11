-- ============================================================
-- Migration 010: Extend agent_recommendation_letters for A3
-- ============================================================
-- Purpose: agent_recommendation_letters existed in the schema
-- since migration 002 but was never wired to any code (0 rows in
-- production, no reads/writes anywhere in src/). This migration
-- extends it to serve as the persistence layer for both A3
-- motors (Testimonial, Institutional), instead of creating a new
-- table — the existing name, RLS policy, and versioning columns
-- (letter_version, previous_version_id) already fit the concept
-- and there is no data debt to migrate.
--
-- New columns:
--   motor                 - which A3 engine produced this letter
--   letter_type           - Institutional-only discriminator
--                           (subtypeA_advisory | subtypeB_judge |
--                           subtypeB_criticalRole4a |
--                           subtypeB_criticalRole4b |
--                           subtypeB_awards); NULL for testimonial
--   presentation_format   - Testimonial-only (narrative | headed |
--                           numbered); NULL for institutional
--   blocks                - JSONB, preserves the exact block
--                           shape of each motor's output contract
--                           (A3_ENGINE_TESTIMONIAL_PERSONAL.md
--                           v1.3, A3_ENGINE_INSTITUCIONAL.md v1.4)
--                           rather than flattening into columns
--   docx_path             - Storage path of the generated .docx,
--                           same pattern as
--                           document_translations.translation_docx_path
--
-- letter_draft (TEXT NOT NULL, pre-existing) is left untouched:
-- new inserts from A3 populate it with a plain-text summary
-- derived from `blocks`, rather than altering the constraint.
--
-- Also corrects relationship_type's CHECK constraint: the
-- original values (direct_supervisor, peer_expert, industry_leader,
-- academic, client) never matched the real Module9 intake select
-- (src/app/intake/modules/Module9.tsx), which persists one of:
-- supervisor | colega | cliente | mentor | colaborador |
-- subordinado | otro. Corrected to match, and made mandatory
-- (empty string not allowed) since the letter's Block 3 has no
-- content without it.
-- ============================================================

BEGIN;

ALTER TABLE public.agent_recommendation_letters
  ADD COLUMN motor TEXT CHECK (motor IN ('testimonial', 'institutional')),
  ADD COLUMN letter_type TEXT NULL,
  ADD COLUMN presentation_format TEXT NULL,
  ADD COLUMN blocks JSONB NULL,
  ADD COLUMN docx_path TEXT NULL;

ALTER TABLE public.agent_recommendation_letters
  DROP CONSTRAINT IF EXISTS agent_recommendation_letters_relationship_type_check;

ALTER TABLE public.agent_recommendation_letters
  ADD CONSTRAINT agent_recommendation_letters_relationship_type_check
  CHECK (relationship_type IN (
    'supervisor', 'colega', 'cliente', 'mentor',
    'colaborador', 'subordinado', 'otro'
  ));

ALTER TABLE public.agent_recommendation_letters
  ALTER COLUMN relationship_type SET NOT NULL;

COMMIT;
