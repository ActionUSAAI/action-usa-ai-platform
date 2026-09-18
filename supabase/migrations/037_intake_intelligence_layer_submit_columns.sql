-- ============================================================
-- Migration 037: submit_intake_for_invitation -- accept Stage 1 columns
-- ============================================================
-- Additive extension of the existing MTCS-02B function (migration 026).
-- structured_profile/coach_conversation follow the exact same
-- client-held-draft-until-final-submit pattern already used by every
-- other module (module1-15): accumulated entirely client-side during
-- Stage 1 (Module0/Coach/A0 round-trips are stateless per-call; no
-- Stage 1 persistence exists before the beneficiary submits), then
-- written once, atomically, in the same INSERT as everything else.
--
-- Backward compatible: COALESCE defaults to '{}'/'[]' identically to
-- every other module key, so any caller omitting these keys behaves
-- exactly as before this migration.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.submit_intake_for_invitation(
  p_token TEXT,
  p_modules JSONB
)
RETURNS TABLE (
  submission_id UUID,
  case_id UUID,
  client_id UUID
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.intake_invitations%ROWTYPE;
  v_submission_id UUID;
BEGIN
  SELECT *
  INTO v_invitation
  FROM public.intake_invitations
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_invitation: no invitation found for token' USING ERRCODE = 'P0001';
  END IF;

  IF v_invitation.status NOT IN ('pending', 'opened') THEN
    RAISE EXCEPTION 'invitation_not_eligible: status=%', v_invitation.status USING ERRCODE = 'P0001';
  END IF;

  IF v_invitation.expires_at <= NOW() THEN
    RAISE EXCEPTION 'invitation_expired' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.intake_submissions (
    client_id, case_id, invitation_id, status,
    module1, module2, module3, module4, module5, module6, module7, module8,
    module9, module10, module11, module12, module14, module15, module_progress,
    structured_profile, coach_conversation
  ) VALUES (
    v_invitation.client_id, v_invitation.case_id, v_invitation.id, 'submitted',
    COALESCE(p_modules->'module1',  '{}'::jsonb),
    COALESCE(p_modules->'module2',  '{}'::jsonb),
    COALESCE(p_modules->'module3',  '{}'::jsonb),
    COALESCE(p_modules->'module4',  '{}'::jsonb),
    COALESCE(p_modules->'module5',  '{}'::jsonb),
    COALESCE(p_modules->'module6',  '{}'::jsonb),
    COALESCE(p_modules->'module7',  '{}'::jsonb),
    COALESCE(p_modules->'module8',  '{}'::jsonb),
    COALESCE(p_modules->'module9',  '{}'::jsonb),
    COALESCE(p_modules->'module10', '{}'::jsonb),
    COALESCE(p_modules->'module11', '{}'::jsonb),
    COALESCE(p_modules->'module12', '{}'::jsonb),
    COALESCE(p_modules->'module14', '{}'::jsonb),
    COALESCE(p_modules->'module15', '{}'::jsonb),
    COALESCE(p_modules->'module_progress', '{}'::jsonb),
    COALESCE(p_modules->'structured_profile', '{}'::jsonb),
    COALESCE(p_modules->'coach_conversation', '[]'::jsonb)
  )
  RETURNING id INTO v_submission_id;

  UPDATE public.intake_invitations
  SET status = 'submitted', submitted_at = NOW()
  WHERE id = v_invitation.id;

  RETURN QUERY SELECT v_submission_id, v_invitation.case_id, v_invitation.client_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_intake_for_invitation(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_intake_for_invitation(TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.submit_intake_for_invitation(TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_intake_for_invitation(TEXT, JSONB) TO service_role;

COMMIT;
