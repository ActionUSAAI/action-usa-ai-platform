-- ============================================================
-- Migration 013: Add classification_used to agent_intake_analysis
-- ============================================================
-- Purpose: A1's system prompt is being corrected to branch its
-- criteria set by visa classification (O-1A: 9 data keys / EB-1A:
-- 11 data keys, both with the critical_role split into 4a/4b per
-- CriticalRoleEvidence; O-1B: 6 keys, no split). Previously the
-- prompt was static with a single fixed 8-key O-1A/EB-1A set.
--
-- classification_used persists which criteria set A1 actually
-- evaluated with for a given run — not the client-declared
-- Module1.visaType (which A1 receives but only as prompt context),
-- and not recommended_visa_type (A1's own output, whose values
-- include ambiguous/compound options like 'unclear' and
-- 'O-1A/EB-1A' that don't map to a single criteria set). This
-- lets a1-panel.tsx pick the correct CRITERIA_LABELS map without
-- depending on the case/intake data it doesn't currently receive.
--
-- Domain is limited to the three sets that map to an actual
-- criteria structure: O-1A, O-1B, EB-1A. EB-1B (present in
-- recommended_visa_type's existing CHECK, migration 002) is not
-- modeled as a distinct category yet — a declared EB-1B case
-- uses the EB-1A criteria set today, so classification_used is
-- persisted as 'EB-1A' for it. Modeling EB-1B's actual distinct
-- standard (outstanding researcher/professor, a different
-- regulatory test than extraordinary ability) is out of scope
-- here and left as a separate pending item.
--
-- NULL for the one pre-existing row (processed before this
-- correction, under the old static 8-key prompt) and for any run
-- where visaType was missing/unrecognized — a1-panel.tsx falls
-- back to the O-1A label set when classification_used is NULL,
-- same default resolveCriteriaSet() uses in the prompt builder.
--
-- Uses ADD COLUMN IF NOT EXISTS, matching migration 004's
-- idempotent pattern for this same table.
-- ============================================================

BEGIN;

ALTER TABLE public.agent_intake_analysis
  ADD COLUMN IF NOT EXISTS classification_used TEXT NULL
    CHECK (classification_used IN ('O-1A', 'O-1B', 'EB-1A'));

COMMIT;
