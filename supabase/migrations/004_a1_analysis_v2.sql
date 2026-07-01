-- Migration 004: Extend agent_intake_analysis for A1 Intake Analyzer v1
-- Run this in the Supabase SQL Editor before using the A1 agent route.

-- 1. Drop the old restrictive CHECK on recommended_visa_type (doesn't allow O-1A/EB-1A or 'unclear')
ALTER TABLE public.agent_intake_analysis
  DROP CONSTRAINT IF EXISTS agent_intake_analysis_recommended_visa_type_check;

-- 2. Drop the numeric confidence_score column (replaced by text visa_confidence)
--    Only drop if you haven't stored real data there yet.
-- ALTER TABLE public.agent_intake_analysis DROP COLUMN IF EXISTS confidence_score;

-- 3. Add new columns required by the A1 Intake Analyzer
ALTER TABLE public.agent_intake_analysis
  ADD COLUMN IF NOT EXISTS submission_id   UUID REFERENCES public.intake_submissions(id),
  ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS visa_confidence TEXT CHECK (visa_confidence IN ('high','medium','low')),
  ADD COLUMN IF NOT EXISTS overall_strength TEXT CHECK (overall_strength IN ('strong','moderate','weak')),
  ADD COLUMN IF NOT EXISTS criteria_met    JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS criteria_gaps   JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recommended_actions TEXT[],
  ADD COLUMN IF NOT EXISTS raw_response    TEXT,
  ADD COLUMN IF NOT EXISTS error_detail    TEXT;

-- 4. Index for fast lookup of completed analyses per case (most recent first)
CREATE INDEX IF NOT EXISTS idx_intake_analysis_case_status
  ON public.agent_intake_analysis(case_id, status, created_at DESC);

-- 5. RLS: allow authenticated admin/supervisor/agent roles to SELECT
--    (service role already has full access via the existing policy)
-- If you don't already have a policy, uncomment the block below:
/*
ALTER TABLE public.agent_intake_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_intake_analysis"
  ON public.agent_intake_analysis
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','supervisor','agent')
    )
  );

CREATE POLICY "service_role_all_intake_analysis"
  ON public.agent_intake_analysis
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
*/
