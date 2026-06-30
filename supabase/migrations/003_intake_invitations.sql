-- ============================================================
-- AUCIS — ACTION USA Case Intelligence System
-- Intake invitations: token-gated links sent to prospective clients
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE public.intake_invitations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token          TEXT        NOT NULL UNIQUE,
  case_id        UUID        NOT NULL REFERENCES public.cases(id)   ON DELETE CASCADE,
  client_id      UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email          TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','opened','submitted','expired','revoked')),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  opened_at      TIMESTAMPTZ,
  submitted_at   TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ,
  revoked_by     UUID        REFERENCES public.profiles(id),
  superseded_by  UUID        REFERENCES public.intake_invitations(id),
  created_by     UUID        REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX idx_invitations_case_id ON public.intake_invitations (case_id);

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.intake_invitations ENABLE ROW LEVEL SECURITY;

-- Service role: full access (used by token-validation API route)
CREATE POLICY "service_role_invitations_all"
  ON public.intake_invitations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Staff (admin / supervisor / agent): read + write
CREATE POLICY "staff_select_invitations"
  ON public.intake_invitations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin','supervisor','agent')
  ));

CREATE POLICY "staff_insert_invitations"
  ON public.intake_invitations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin','supervisor','agent')
  ));

CREATE POLICY "staff_update_invitations"
  ON public.intake_invitations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin','supervisor','agent')
  ));
