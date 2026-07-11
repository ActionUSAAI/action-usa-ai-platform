-- ============================================================
-- Migration 011: Make relationship_type conditional on motor
-- ============================================================
-- Purpose: migration 010 made relationship_type NOT NULL
-- unconditionally, correct only for the Testimonial motor
-- (signers always have a personal relationship to the
-- beneficiary — supervisor, colleague, mentor, etc.). The
-- Institutional motor has no such concept: its signers are
-- organizations (an association, a school), and in Subtype A
-- there may be no individual signer at all. The unconditional
-- NOT NULL would reject every institutional letter insert.
--
-- Corrects this with a motor-conditional CHECK instead of a
-- blanket NOT NULL: relationship_type is required when
-- motor = 'testimonial', and must be NULL when
-- motor = 'institutional'. The existing value-list CHECK from
-- migration 010 (agent_recommendation_letters_relationship_type_check)
-- is left untouched — a CHECK constraint in Postgres already
-- passes when the value is NULL, so it doesn't need to change to
-- permit institutional rows.
--
-- recommender_name (NOT NULL since migration 002) is reused for
-- institutional letters to hold the organization's name (e.g.
-- "American Quarter Horse Association") rather than adding a
-- separate organization_name column — "who is recommending"
-- is valid for both an individual and an organization.
-- ============================================================

BEGIN;

ALTER TABLE public.agent_recommendation_letters
  ALTER COLUMN relationship_type DROP NOT NULL;

ALTER TABLE public.agent_recommendation_letters
  ADD CONSTRAINT agent_recommendation_letters_relationship_type_by_motor
  CHECK (
    (motor = 'testimonial' AND relationship_type IS NOT NULL)
    OR (motor = 'institutional' AND relationship_type IS NULL)
    OR motor IS NULL
  );

COMMIT;
