-- ============================================================
-- Migration 029: A1 Historical Reliance (MTCS-06.1/06.2)
-- ============================================================
-- Purpose: materializes the A1 side of the frozen
-- docs/MTCS-06_FINAL_EXACT_DESIGN.md (DD-06-01 through DD-06-07,
-- Design MR: PASS). Gives agent_intake_analysis a governed,
-- DB-authoritative, immutable record of exactly which Evidence
-- compositions (and which exact canonical Documents) A1 relied
-- upon, at what probative_revision/Documentary Condition/
-- Verification Condition/fact text — without conferring
-- Verification, without gating on Documentary/Verification
-- Condition (DD-06-01/DD-06-02), and without any change to
-- Evidence V2's own lifecycle (migrations 024/027/028 untouched).
--
-- Additive/evolutionary only. Two new tables + one additive
-- composite-FK-support constraint on the pre-existing
-- agent_intake_analysis table (migration 002) + one new governed
-- function. Reuses the exact composite-FK idiom migration 027
-- already established twice (evidence_items/documents), and the
-- exact SECURITY INVOKER / REVOKE-GRANT idiom migration
-- 024/027/028 already established for every Evidence V2 governed
-- function.
--
-- a1_historical_reliance — one row per (Criterion Assessment,
-- Evidence composition) actually relied upon. Insert-only: no
-- UPDATE/DELETE grant is issued to any role beyond what CASCADE
-- delete from Case teardown performs. probative_revision_at_
-- reliance/documentary_condition_at_reliance/verification_
-- condition_at_reliance/fact_at_reliance are captured once, at the
-- Reliance Input Snapshot Moment (the same read used to build the
-- A1 prompt), by application code, and passed into the governed
-- function below — this migration does not and cannot enforce the
-- capture-once rule itself; that is an application-layer
-- discipline required by the frozen design (Part VI/XII).
--
-- a1_historical_reliance_documents — one row per canonical
-- Document (documents.id) associated with that Evidence
-- composition at the same snapshot moment. Composite FK to
-- documents(id, case_id) (already exists — migration 027) gives
-- DB-authoritative same-Case integrity, exactly mirroring
-- evidence_item_documents' own idiom. Never versions or redesigns
-- evidence_item_documents itself — historical membership is
-- captured directly, since evidence_item_documents is a live
-- association table with no history of its own.
--
-- create_a1_assessment_with_reliance() — the atomic Producer
-- primitive for this migration. Performs the agent_intake_analysis
-- INSERT and all A1 Historical Reliance + Document-membership
-- INSERTs within one function invocation (Postgres functions are
-- atomic by default absent an exception-swallowing block — none
-- exists here), directly extending the
-- create_evidence_composition_with_documents() precedent
-- (migration 028) one level deeper. Does NOT perform the
-- pre-existing supersession step (marking a prior 'current' row
-- 'superseded') — that remains the existing, already-accepted
-- best-effort, non-blocking follow-up call in
-- a1-intake-analyzer/route.ts, unchanged by this migration.
-- ============================================================

BEGIN;

-- ── Composite-FK support on the pre-existing agent_intake_analysis table ───────────
-- Mirrors migration 027's identical additive treatment of evidence_items/documents:
-- Postgres requires the FK's referenced side to expose a matching UNIQUE/PK — this is
-- not a new business rule, only what a1_historical_reliance's composite FK requires.
ALTER TABLE public.agent_intake_analysis
  ADD CONSTRAINT agent_intake_analysis_id_case_id_key UNIQUE (id, case_id);

-- ── A1 Historical Reliance: Evidence-level identity + state-at-reliance provenance ─
CREATE TABLE public.a1_historical_reliance (
  criterion_assessment_id           UUID NOT NULL,
  evidence_item_id                  UUID NOT NULL,
  case_id                            UUID NOT NULL,

  probative_revision_at_reliance     INTEGER NOT NULL,
  fact_at_reliance                   TEXT NOT NULL,
  documentary_condition_at_reliance  TEXT NOT NULL
    CHECK (documentary_condition_at_reliance IN ('reported', 'partial', 'documented')),
  verification_condition_at_reliance TEXT NOT NULL
    CHECK (verification_condition_at_reliance IN ('pending', 'verified', 'needs_attention')),

  created_at                         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (criterion_assessment_id, evidence_item_id),

  FOREIGN KEY (criterion_assessment_id, case_id)
    REFERENCES public.agent_intake_analysis(id, case_id) ON DELETE CASCADE,

  FOREIGN KEY (evidence_item_id, case_id)
    REFERENCES public.evidence_items(id, case_id) ON DELETE CASCADE
);

CREATE INDEX idx_a1_historical_reliance_assessment
  ON public.a1_historical_reliance(criterion_assessment_id);

-- ── A1 Historical Reliance Document: exact canonical Document membership at reliance ─
CREATE TABLE public.a1_historical_reliance_documents (
  criterion_assessment_id UUID NOT NULL,
  evidence_item_id        UUID NOT NULL,
  document_id             UUID NOT NULL,
  case_id                 UUID NOT NULL,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (criterion_assessment_id, evidence_item_id, document_id),

  FOREIGN KEY (criterion_assessment_id, evidence_item_id)
    REFERENCES public.a1_historical_reliance(criterion_assessment_id, evidence_item_id)
    ON DELETE CASCADE,

  FOREIGN KEY (document_id, case_id)
    REFERENCES public.documents(id, case_id) ON DELETE CASCADE
);

CREATE INDEX idx_a1_historical_reliance_documents_reliance
  ON public.a1_historical_reliance_documents(criterion_assessment_id, evidence_item_id);

-- ── Atomic Producer: agent_intake_analysis insert + Historical Reliance rows,
-- one transaction ────────────────────────────────────────────────────────────────
-- p_reliance shape (JSONB array), one element per Evidence composition relied upon:
--   {
--     "evidence_item_id": uuid,
--     "probative_revision_at_reliance": bigint,
--     "fact_at_reliance": text,
--     "documentary_condition_at_reliance": text,
--     "verification_condition_at_reliance": text,
--     "document_ids_at_reliance": [uuid, ...]
--   }
-- Same-Case integrity for both evidence_item_id and every document_id is
-- DB-authoritative via the composite FKs above — a cross-Case reference raises a
-- foreign_key_violation, not an application-level check.
CREATE OR REPLACE FUNCTION public.create_a1_assessment_with_reliance(
  p_case_id               UUID,
  p_submission_id         UUID,
  p_run_id                UUID,
  p_version               INTEGER,
  p_recommended_visa_type TEXT,
  p_classification_used   TEXT,
  p_visa_confidence       TEXT,
  p_overall_strength      TEXT,
  p_criteria_scores       JSONB,
  p_criteria_met          JSONB,
  p_criteria_gaps         JSONB,
  p_strengths             JSONB,
  p_weaknesses            JSONB,
  p_strategy_notes        TEXT,
  p_recommended_actions   JSONB,
  p_raw_response          TEXT,
  p_reliance              JSONB
) RETURNS public.agent_intake_analysis
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_assessment public.agent_intake_analysis;
  v_item       JSONB;
  v_doc        UUID;
  -- agent_intake_analysis.strengths/weaknesses/recommended_actions are
  -- native TEXT[] (migrations 002/004), not JSONB — the RPC boundary
  -- accepts JSONB arrays (matching every other array-shaped parameter
  -- here and the Supabase JS client's natural JSON encoding of a JS
  -- array) and converts to TEXT[] here, at the single INSERT, rather
  -- than widening the column types.
  v_strengths           TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_strengths, '[]'::jsonb)));
  v_weaknesses          TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_weaknesses, '[]'::jsonb)));
  v_recommended_actions TEXT[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_recommended_actions, '[]'::jsonb)));
BEGIN
  INSERT INTO public.agent_intake_analysis (
    case_id, submission_id, run_id, status, currency_status, version,
    recommended_visa_type, classification_used, visa_confidence, overall_strength,
    criteria_scores, criteria_met, criteria_gaps, strengths, weaknesses,
    strategy_notes, recommended_actions, raw_response
  ) VALUES (
    p_case_id, p_submission_id, p_run_id, 'completed', 'current', p_version,
    p_recommended_visa_type, p_classification_used, p_visa_confidence, p_overall_strength,
    p_criteria_scores, p_criteria_met, p_criteria_gaps, v_strengths, v_weaknesses,
    p_strategy_notes, v_recommended_actions, p_raw_response
  )
  RETURNING * INTO v_assessment;

  IF p_reliance IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_reliance) LOOP
      BEGIN
        INSERT INTO public.a1_historical_reliance (
          criterion_assessment_id, evidence_item_id, case_id,
          probative_revision_at_reliance, fact_at_reliance,
          documentary_condition_at_reliance, verification_condition_at_reliance
        ) VALUES (
          v_assessment.id,
          (v_item->>'evidence_item_id')::UUID,
          p_case_id,
          (v_item->>'probative_revision_at_reliance')::INTEGER,
          v_item->>'fact_at_reliance',
          v_item->>'documentary_condition_at_reliance',
          v_item->>'verification_condition_at_reliance'
        );
      EXCEPTION
        WHEN foreign_key_violation THEN
          RAISE EXCEPTION 'RELIANCE_CASE_MISMATCH' USING ERRCODE = 'EV004';
      END;

      IF v_item ? 'document_ids_at_reliance' THEN
        FOR v_doc IN SELECT (jsonb_array_elements_text(v_item->'document_ids_at_reliance'))::UUID LOOP
          BEGIN
            INSERT INTO public.a1_historical_reliance_documents (
              criterion_assessment_id, evidence_item_id, document_id, case_id
            ) VALUES (
              v_assessment.id,
              (v_item->>'evidence_item_id')::UUID,
              v_doc,
              p_case_id
            );
          EXCEPTION
            WHEN foreign_key_violation THEN
              RAISE EXCEPTION 'RELIANCE_DOCUMENT_CASE_MISMATCH' USING ERRCODE = 'EV004';
          END;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  RETURN v_assessment;
END;
$$;

-- ── RLS: authenticated SELECT only; no direct authenticated mutation ────────────────
ALTER TABLE public.a1_historical_reliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_a1_historical_reliance"
  ON public.a1_historical_reliance FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid())
  );

ALTER TABLE public.a1_historical_reliance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_a1_historical_reliance_documents"
  ON public.a1_historical_reliance_documents FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid())
  );

-- ── Mutation: service_role only, not exposed to clients ─────────────────────────────
REVOKE EXECUTE ON FUNCTION public.create_a1_assessment_with_reliance(
  uuid,uuid,uuid,integer,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb,text,jsonb
) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.create_a1_assessment_with_reliance(
  uuid,uuid,uuid,integer,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb,text,jsonb
) TO service_role;

COMMIT;
