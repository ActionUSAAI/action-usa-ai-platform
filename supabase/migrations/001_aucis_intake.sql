-- ============================================================
-- AUCIS — ACTION USA Case Intelligence System
-- Intake expansion: replaces flat columns with JSONB modules
-- Run in Supabase SQL Editor
-- ============================================================

-- Add talento_extraordinario to case_type enum if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'talento_extraordinario'
      AND enumtypid = 'case_type'::regtype
  ) THEN
    ALTER TYPE case_type ADD VALUE 'talento_extraordinario';
  END IF;
END$$;

-- ── intake_submissions (new schema, replaces manual table) ──────────────────
DROP TABLE IF EXISTS public.intake_submissions CASCADE;

CREATE TABLE public.intake_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  case_id         UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('draft','submitted','processing','complete')),
  -- AUCIS modules (JSONB)
  module1         JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Identity
  module2         JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Personal documents
  module3         JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Family group
  module4         JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Immigration history
  module5         JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Formal education
  module6         JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Certifications
  module7         JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Work experience
  module8         JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Own businesses
  module9         JSONB NOT NULL DEFAULT '{}'::jsonb,  -- References
  module10        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Evidence
  module11        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Strategic info
  module12        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Optional services
  module_progress JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {1:"complete",2:"partial",...}
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── case_expedition_docs (Module 14 — admin only) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.case_expedition_docs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  doc_type      TEXT NOT NULL,
  doc_label     TEXT,
  file_path     TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_size     INTEGER,
  mime_type     TEXT,
  uploaded_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── updated_at trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_intake_updated_at ON public.intake_submissions;
CREATE TRIGGER trg_intake_updated_at
  BEFORE UPDATE ON public.intake_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.intake_submissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_expedition_docs  ENABLE ROW LEVEL SECURITY;

-- Service role: full access (used by /api/intake)
CREATE POLICY "service_role_intake_all"
  ON public.intake_submissions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Staff can view all
CREATE POLICY "staff_view_intakes"
  ON public.intake_submissions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin','supervisor','agent')
  ));

-- Clients can view their own
CREATE POLICY "client_view_own_intake"
  ON public.intake_submissions FOR SELECT TO authenticated
  USING (client_id IN (
    SELECT id FROM public.clients WHERE profile_id = auth.uid()
  ));

-- case_expedition_docs: staff only
CREATE POLICY "service_role_expedition_all"
  ON public.case_expedition_docs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "staff_manage_expedition_docs"
  ON public.case_expedition_docs FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin','supervisor','agent')
  ));
