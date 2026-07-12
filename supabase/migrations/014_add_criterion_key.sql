-- ============================================================
-- Migration 014: Add criterion_key to agent_recommendation_letters
-- ============================================================
-- Purpose: the Exhibit assembly step (docs/A4_EXHIBIT_ASSEMBLY.md
-- v1.2) groups documents by regulatory criterion, but no column
-- in agent_recommendation_letters holds a stable, canonical
-- criterion key. criterion_covered is free text ("${citation} —
-- ${label}"), and letter_type (migration 010) only applies to
-- institutional letters and encodes the Subtype B sub-criterion
-- discriminator (subtypeB_criticalRole4a, etc.), not the same
-- value space as A1's scored criteria keys — and is NULL for all
-- testimonial letters, which have no criterion key at all today.
--
-- criterion_key uses the same canonical keys A1 scores in
-- criteria_met/criteria_scores/criteria_gaps
-- (a1-intake-analyzer/route.ts, CRITERIA_O1A/EB1A/O1B), so the
-- assembly step can group by exact key match instead of parsing
-- free text. Domain is the union of all three classification sets
-- (16 distinct keys) restricted via CHECK, following the same
-- integrity approach already used for motor, petition_strategy,
-- and relationship_type in this same table — accepting that a
-- follow-up migration will be needed if criteria sets change,
-- in exchange for catching a builder typo at insert time instead
-- of silently breaking Exhibit grouping in production.
--
-- NULL is valid and expected for institutional Subtype A letters
-- (advisory opinion / no-objection), which A3_ENGINE_INSTITUCIONAL.md
-- documents as not corresponding to any numbered criterion.
-- ============================================================

BEGIN;

ALTER TABLE public.agent_recommendation_letters
  ADD COLUMN criterion_key TEXT NULL
    CHECK (criterion_key IN (
      'awards', 'memberships', 'media_coverage', 'judging',
      'original_contributions', 'scholarly_articles',
      'critical_role_4a', 'critical_role_4b', 'high_salary',
      'artistic_exhibitions', 'performing_arts_commercial_success',
      'lead_starring_role', 'national_recognition', 'critical_role_org',
      'commercial_success', 'significant_recognition'
    ));

COMMIT;
