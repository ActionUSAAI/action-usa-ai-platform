-- ============================================================
-- Migration 017: Create case_strategy
-- ============================================================
-- Purpose: almacena el Case Blueprint producido por A5 (Case
-- Strategy Engine) — la teoría jurídica del caso, priorización de
-- criterios, mapa de dependencias de evidencia, y estructura
-- narrativa sugerida. Ver docs/A5_CASE_STRATEGY_ENGINE_DESIGN.md.
--
-- A5 mide "A1 mide, A5 decide" — este registro consume
-- agent_intake_analysis.criteria_met/criteria_scores como señal de
-- entrada, nunca los recalcula.
--
-- Lleva run_id (a diferencia de i129_form_drafts) porque construir
-- el Blueprint sí involucra una llamada real a Claude — mismo
-- patrón que agent_intake_analysis/agent_recommendation_letters.
--
-- Flujo de status: 'proposed' (recién generado por A5) →
-- 'approved' (el abogado lo aprobó tal cual, o después de editar)
-- — el campo edited_at distingue si hubo edición humana antes de
-- aprobar. Los botones de generación de cartas en el panel deben
-- quedar deshabilitados hasta status = 'approved'.
-- ============================================================

BEGIN;

CREATE TABLE public.case_strategy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.agent_runs(id),

  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved')),

  theory_of_case TEXT NOT NULL,
  primary_narrative TEXT NOT NULL,
  secondary_narrative TEXT,

  dominant_criteria JSONB NOT NULL DEFAULT '[]',
  supporting_criteria JSONB NOT NULL DEFAULT '[]',
  corroborative_criteria JSONB NOT NULL DEFAULT '[]',

  evidence_dependencies JSONB NOT NULL DEFAULT '{}',
  suggested_reinforcements JSONB NOT NULL DEFAULT '[]',

  recommended_document_order JSONB NOT NULL DEFAULT '[]',
  attorney_letter_outline JSONB NOT NULL DEFAULT '[]',
  recommended_exhibit_order JSONB NOT NULL DEFAULT '[]',
  criteria_cross_references JSONB NOT NULL DEFAULT '[]',

  edited_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_strategy_case_id ON public.case_strategy(case_id);

ALTER TABLE public.case_strategy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_case_strategy"
  ON public.case_strategy
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

CREATE POLICY "staff_update_case_strategy"
  ON public.case_strategy
  FOR UPDATE TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

COMMIT;
