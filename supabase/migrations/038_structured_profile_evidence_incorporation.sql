-- ============================================================
-- Migration 038: Structured Profile -> Evidence Incorporation (CR-CPS-53)
-- ============================================================
-- Purpose: materializes the sole physical addition authorized by the
-- Structured Profile -> Evidence Incorporation Final Exact Design
-- (SEI-AC-09, DDR-SEI-06, CR-CPS-46..53) -- one small, additive,
-- transactional wrapper providing atomic retry/replay protection for
-- incorporating CLOSED Intake Layer Structured Profile fields into the
-- existing Evidence lifecycle. Zero new table, column, Evidence state,
-- or parallel Producer. The wrapper invokes the existing, unmodified
-- create_evidence_composition_with_documents() (migration 028) for all
-- Evidence creation/supersession -- it never reproduces Producer logic.
--
-- Atomicity: within one function execution (one transaction), the
-- wrapper locks the canonical intake_submissions row (already-existing
-- table, zero new schema for this step), serializing all incorporation
-- activity for that submission, then performs the exact-match
-- source_reference lookup and create/no-op/supersede decision. case_id
-- is never a parameter -- it is derived server-side from the locked
-- submission row, structurally eliminating cross-case injection.
--
-- source_reference construction (server-side only, client never
-- supplies the assembled string): deterministic path (p_action_token
-- NULL) -> '{submission_id}:{field_key}:{source}'; human-resolution
-- path (p_action_token supplied) -> same prefix plus ':{token}', where
-- token is a client-generated, stable, per-logical-action identifier
-- (retry/replay discriminator only -- never Evidence/fact/criterion/
-- verification identity, per DDR-SEI-05/DDR-SEI-06).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.incorporate_structured_profile_evidence(
  p_submission_id  UUID,
  p_field_key      TEXT,
  p_source         TEXT,
  p_action_token   TEXT,
  p_fact           TEXT,
  p_created_by     UUID,
  p_document_ids   UUID[] DEFAULT NULL
) RETURNS public.evidence_items
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_submission  public.intake_submissions;
  v_case_id     UUID;
  v_source_ref  TEXT;
  v_existing    public.evidence_items;
  v_result      public.evidence_items;
BEGIN
  IF p_submission_id IS NULL OR p_field_key IS NULL OR btrim(p_field_key) = ''
     OR p_source IS NULL OR btrim(p_source) = ''
     OR p_fact IS NULL OR btrim(p_fact) = ''
     OR p_created_by IS NULL THEN
    RAISE EXCEPTION 'INVALID_INCORPORATION_INPUT' USING ERRCODE = 'EV009';
  END IF;

  -- Step 1: lock the canonical incorporation context. Serializes all
  -- incorporation activity for this submission (deterministic and
  -- human-resolution paths alike) without any new schema -- closes the
  -- "both see no row, both create" race (DDR-SEI-06).
  SELECT * INTO v_submission
  FROM public.intake_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF v_submission.id IS NULL THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_FOUND' USING ERRCODE = 'EV009';
  END IF;

  v_case_id := v_submission.case_id;
  IF v_case_id IS NULL THEN
    RAISE EXCEPTION 'SUBMISSION_HAS_NO_CASE' USING ERRCODE = 'EV009';
  END IF;

  -- Step 2: construct source_reference server-side only.
  IF p_action_token IS NULL THEN
    v_source_ref := p_submission_id::text || ':' || p_field_key || ':' || p_source;
  ELSE
    IF btrim(p_action_token) = '' THEN
      RAISE EXCEPTION 'INVALID_ACTION_TOKEN' USING ERRCODE = 'EV009';
    END IF;
    v_source_ref := p_submission_id::text || ':' || p_field_key || ':' || p_source || ':' || p_action_token;
  END IF;

  -- Step 3: exact-match lookup for existing current Evidence under this
  -- exact operational discriminator (no semantic comparison).
  SELECT * INTO v_existing
  FROM public.evidence_items
  WHERE case_id = v_case_id
    AND source_type = 'structured_profile'
    AND source_reference = v_source_ref
    AND currency_status = 'current';

  -- Step 4: distinguish create / no-op / supersede; invoke the
  -- existing, unmodified Producer for every actual Evidence mutation.
  IF v_existing.id IS NULL THEN
    v_result := public.create_evidence_composition_with_documents(
      NULL, NULL, v_case_id, p_fact, 'reported',
      'structured_profile', v_source_ref, p_created_by, p_document_ids
    );
  ELSIF v_existing.fact IS NOT DISTINCT FROM p_fact THEN
    v_result := v_existing;
  ELSE
    v_result := public.create_evidence_composition_with_documents(
      v_existing.evidence_id, v_existing.id, v_case_id, p_fact, 'reported',
      'structured_profile', v_source_ref, p_created_by, p_document_ids
    );
  END IF;

  RETURN v_result;
END;
$$;

-- ── Grants: service_role only, matching the exact MTCS-04 precedent ────────────────
REVOKE EXECUTE ON FUNCTION public.incorporate_structured_profile_evidence(uuid,text,text,text,text,uuid,uuid[]) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.incorporate_structured_profile_evidence(uuid,text,text,text,text,uuid,uuid[]) TO service_role;

COMMIT;
