-- ============================================================
-- Migration 030: case_strategy.evidence_dependencies_reliance (MTCS-06.3)
-- ============================================================
-- Purpose: materializes the sibling-field resolution of the
-- evidence_dependencies shape conflict found while implementing MTCS-06.3
-- (docs/MTCS-06_FINAL_EXACT_DESIGN.md Part X). Part X's "FINAL PROPOSED
-- SHAPE" assumed evidence_dependencies was already
-- `Map criterion_key -> array of {evidence_item_id | description}` — but
-- the actual runtime shape (a5-case-strategy/route.ts, both the Claude
-- JSON schema and the A5Response type) is
-- `Record<criterion_key, string[]>`: plain narrative strings, directly
-- interpolated into real legal-letter text by three live consumers
-- (a3-testimonial-letters/route.ts, a3-institutional-letters/route.ts,
-- a4-attorney-letters/route.ts) and rendered as-is by
-- blueprint-lifecycle-section.tsx. Converting each string to an object,
-- as Part X's literal shape would require, breaks all four.
--
-- Resolution (explicit user decision, not a unilateral implementation
-- choice): evidence_dependencies itself is left completely untouched —
-- still Record<criterion_key, string[]>, zero consumer impact. A new,
-- purely additive sibling column carries the Historical Reliance
-- information instead, index-aligned to the existing string array per
-- criterion_key: entry i of evidence_dependencies_reliance[key]
-- describes entry i of evidence_dependencies[key], or is null when that
-- entry is free narrative text with no specific typed Evidence
-- composition identified by A5.
--
-- Shape (JSONB): Record<criterion_key, Array<null | {
--   evidence_item_id, probative_revision_at_reliance, fact_at_reliance,
--   documentary_condition_at_reliance, verification_condition_at_reliance,
--   document_ids_at_reliance
-- }>>
--
-- Same-case integrity: APP-VALIDATED (Part IX), not DB-authoritative —
-- consistent with A5's existing foundational_evidence/evidence_dependencies
-- treatment and DD-06-05 (no parallel A5 subsystem, no new relational FK
-- surface for A5). Populated by the route handler from the same
-- Reliance Input Snapshot Moment capture used for foundational_evidence,
-- in the same INSERT as the case_strategy row itself (Part IX atomic
-- persistence) — no separate persistence mechanism.
-- ============================================================

BEGIN;

ALTER TABLE public.case_strategy
  ADD COLUMN IF NOT EXISTS evidence_dependencies_reliance JSONB NOT NULL DEFAULT '{}';

COMMIT;
