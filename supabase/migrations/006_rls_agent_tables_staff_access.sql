-- ══════════════════════════════════════════════════════════════════════════
-- Migration 006: RLS staff-access policies for all agent tables
-- ══════════════════════════════════════════════════════════════════════════
--
-- Adds FOR SELECT staff policies (admin + supervisor see all; agent sees
-- only cases where assigned_agent_id = auth.uid()) to every agent_* table
-- from migration 002, plus full-access and staff policies for
-- document_translations from migration 005.
--
-- Pattern: three-level, matching case_status_history in schema.sql
--   USING (
--     is_admin_or_supervisor() OR
--     case_id IN (SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid())
--   )
--
-- EXISTING POLICIES PRESERVED (no DROP / no ALTER):
--   - client_view_own_case_events   ON public.agent_case_events
--   - client_view_own_deadlines     ON public.agent_case_deadlines
--
-- All new policies are PERMISSIVE and stack with OR alongside existing ones.
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. agent_runs ──────────────────────────────────────────────────────────
CREATE POLICY "staff_select_agent_runs"
  ON public.agent_runs
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

-- ── 2. agent_logs (no direct case_id — join through agent_runs) ───────────
CREATE POLICY "staff_select_agent_logs"
  ON public.agent_logs
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR run_id IN (
      SELECT id FROM public.agent_runs
      WHERE case_id IN (
        SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
      )
    )
  );

-- ── 3. agent_intake_analysis ───────────────────────────────────────────────
-- Note: the staff policy suggested in migration 004 was intentionally
-- commented out and never applied; this policy closes that gap.
CREATE POLICY "staff_select_agent_intake_analysis"
  ON public.agent_intake_analysis
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

-- ── 4. agent_processed_documents ──────────────────────────────────────────
CREATE POLICY "staff_select_agent_processed_documents"
  ON public.agent_processed_documents
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

-- ── 5. agent_recommendation_letters ──────────────────────────────────────
CREATE POLICY "staff_select_agent_recommendation_letters"
  ON public.agent_recommendation_letters
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

-- ── 6. agent_petition_drafts ──────────────────────────────────────────────
CREATE POLICY "staff_select_agent_petition_drafts"
  ON public.agent_petition_drafts
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

-- ── 7. agent_rfe_analyses ─────────────────────────────────────────────────
CREATE POLICY "staff_select_agent_rfe_analyses"
  ON public.agent_rfe_analyses
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

-- ── 8. agent_salary_analyses ──────────────────────────────────────────────
CREATE POLICY "staff_select_agent_salary_analyses"
  ON public.agent_salary_analyses
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

-- ── 9. agent_case_events ──────────────────────────────────────────────────
-- PRESERVED (not touched): client_view_own_case_events
CREATE POLICY "staff_select_agent_case_events"
  ON public.agent_case_events
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

-- ── 10. agent_case_deadlines ──────────────────────────────────────────────
-- PRESERVED (not touched): client_view_own_deadlines
CREATE POLICY "staff_select_agent_case_deadlines"
  ON public.agent_case_deadlines
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

-- ── 11. agent_notifications ───────────────────────────────────────────────
CREATE POLICY "staff_select_agent_notifications"
  ON public.agent_notifications
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

-- ── 12. agent_concierge_messages ──────────────────────────────────────────
CREATE POLICY "staff_select_agent_concierge_messages"
  ON public.agent_concierge_messages
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════════
-- 13. document_translations (migration 005)
-- Previously had RLS enabled but ZERO policies — even admin returned 0 rows.
-- Write access is intentionally restricted to the service role only (A2
-- backend). No authenticated session role — including admin — can INSERT,
-- UPDATE, or DELETE rows via the dashboard client.
-- ══════════════════════════════════════════════════════════════════════════

-- Service role: unrestricted read/write (used by all agent API routes)
CREATE POLICY "service_role_document_translations_all"
  ON public.document_translations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Staff select: three-level pattern (admin+supervisor all; agent own cases)
CREATE POLICY "staff_select_document_translations"
  ON public.document_translations
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );
