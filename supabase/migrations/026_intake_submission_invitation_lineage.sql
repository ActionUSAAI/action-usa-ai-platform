-- ============================================================
-- Migration 026: Intake Submission ↔ Invitation lineage (MTCS-02B Bridge)
-- ============================================================
-- Purpose: materializes the approved MTCS-02B Exact Bridge Design
-- (TD2B-01–TD2B-10, CB-01–CB-16). Gives the invited Intake flow an
-- authoritative, server-resolved path from intake_invitations to
-- intake_submissions, so /api/intake stops fabricating a replacement
-- Case/Client for every submission.
--
-- invitation_id is additive and nullable — existing intake_submissions
-- rows are never backfilled (TD2B/CB: no historical inference).
--
-- submit_intake_for_invitation() is the sole governed entry point that
-- resolves case_id/client_id from the invitation (never from
-- client-supplied invitationCaseId/invitationClientId) and durably
-- transitions the invitation to 'submitted' in the same transaction as
-- the Intake Submission insert. A single invitation row lock (FOR
-- UPDATE) is the concurrency mechanism — no UNIQUE(invitation_id) and
-- no application-level locking are introduced, per the frozen decision
-- that this is sufficient absent a proven contradiction.
--
-- This migration does not implement MTCS-03/05/07, does not touch
-- Evidence, does not create a canonical-registration recovery table
-- (the Recovery Decision established RECOVERY DATABASE DELTA: NONE).
-- ============================================================

BEGIN;

ALTER TABLE public.intake_submissions
  ADD COLUMN IF NOT EXISTS invitation_id UUID
  REFERENCES public.intake_invitations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_intake_submissions_invitation_id
  ON public.intake_submissions(invitation_id);

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
  -- Row lock serializes concurrent submit attempts for the same
  -- invitation: the loser sees status already transitioned below and
  -- fails the eligibility check instead of creating a second submission.
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
    module9, module10, module11, module12, module14, module15, module_progress
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
    COALESCE(p_modules->'module_progress', '{}'::jsonb)
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
