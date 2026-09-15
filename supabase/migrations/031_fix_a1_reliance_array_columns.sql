-- ============================================================
-- Migration 031: Fix create_a1_assessment_with_reliance() array columns
-- ============================================================
-- Purpose: migration 029's create_a1_assessment_with_reliance() inserted
-- p_strengths/p_weaknesses/p_recommended_actions (JSONB parameters)
-- directly into agent_intake_analysis.strengths/weaknesses/
-- recommended_actions, which are native TEXT[] (migrations 002/004), not
-- JSONB — caught during MTCS-06 TEST-environment validation (AC-01/
-- AC-11 script), which is the first real invocation of this function
-- against a live database. Every other MTCS-06.1/06.2/06.3/06.4 behavior
-- is unaffected — this is a narrow, single-function correction, same
-- pattern already established by this table's own migration history
-- (004/008/013 each correct/extend an earlier agent_intake_analysis
-- migration in place, forward-only).
--
-- Fix: CREATE OR REPLACE with the identical external signature (no
-- caller-visible change — src/app/api/agents/a1-intake-analyzer/route.ts
-- passes JS arrays either way) and, inside the function body, convert
-- each JSONB array to TEXT[] via jsonb_array_elements_text() before the
-- INSERT, exactly matching the definition already recorded in migration
-- 029's file (kept in sync so any future fresh-database apply is correct
-- on the first try, and never reproduces this defect).
-- ============================================================

BEGIN;

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

-- REVOKE/GRANT unchanged from migration 029 (same signature) — reissued
-- for safety, harmless if already in this exact state.
REVOKE EXECUTE ON FUNCTION public.create_a1_assessment_with_reliance(
  uuid,uuid,uuid,integer,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb,text,jsonb
) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.create_a1_assessment_with_reliance(
  uuid,uuid,uuid,integer,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb,text,jsonb
) TO service_role;

COMMIT;
