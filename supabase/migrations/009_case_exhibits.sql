-- ============================================================
-- Migration 009: Create case_exhibits table
-- ============================================================
-- Purpose: implements the Exhibit assembly design documented in
-- docs/A4_EXHIBIT_ASSEMBLY.md v1.2. Stores the deterministic
-- mapping of letterId/document -> exhibit_number for a case,
-- following the Rodríguez/Neira convention (one Exhibit per
-- satisfied criterion, grouping all supporting documents). Also
-- stores the merge-suggestion state (suggested_merge_refs,
-- auto_recomputed_at) used by the discrepancy banner when a
-- lawyer has manually reordered an Exhibit's documents.
--
-- Access pattern: staff-only (no client policy), following the
-- three-level RLS convention already used across the schema
-- (is_admin_or_supervisor() OR case ownership via
-- cases.assigned_agent_id). Writes are performed directly from
-- the browser with the lawyer's session, matching the precedent
-- set by cases/nueva and clientes/nuevo (staff UI actions), not
-- the service_role pattern used by background agents.
-- ============================================================

BEGIN;

CREATE TABLE public.case_exhibits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  exhibit_number INTEGER NOT NULL,
  criterion_citation TEXT NOT NULL,
  criterion_label TEXT NOT NULL,
  document_refs JSONB NOT NULL DEFAULT '[]',
  manually_reordered BOOLEAN NOT NULL DEFAULT false,
  suggested_merge_refs JSONB NULL,
  auto_recomputed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, exhibit_number)
);

CREATE INDEX idx_case_exhibits_case_id ON public.case_exhibits(case_id);

ALTER TABLE public.case_exhibits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_case_exhibits"
  ON public.case_exhibits
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

CREATE POLICY "staff_update_case_exhibits"
  ON public.case_exhibits
  FOR UPDATE TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

CREATE TRIGGER set_case_exhibits_updated_at
  BEFORE UPDATE ON public.case_exhibits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
