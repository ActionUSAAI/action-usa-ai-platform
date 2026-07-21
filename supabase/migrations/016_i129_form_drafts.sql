-- ============================================================
-- Migration 016: Create i129_form_drafts
-- ============================================================
-- Purpose: registra cada PDF del Formulario I-129 generado por
-- la ruta a4-i129-form (src/app/api/agents/a4-i129-form/route.ts).
--
-- A diferencia de agent_recommendation_letters/agent_petition_
-- drafts, esta tabla no requiere run_id — la ruta no invoca
-- ningún motor de IA (Claude), es puro mapeo de datos del caso
-- + relleno de PDF vía la función Python (api/i129_fill.py).
-- Confirmado con Alex antes de esta migración.
--
-- is_complete distingue PDFs generados con el mapeo parcial
-- actual (solo Part 1 + nombre del beneficiario + checkboxes,
-- ver docs/i129-form-mapping/README.md) de futuros PDFs
-- generados cuando el mapeo del formulario completo esté
-- terminado. Hoy siempre false.
-- ============================================================

BEGIN;

CREATE TABLE public.i129_form_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  docx_path TEXT NOT NULL,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.i129_form_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_i129_form_drafts"
  ON public.i129_form_drafts
  FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

CREATE POLICY "staff_update_i129_form_drafts"
  ON public.i129_form_drafts
  FOR UPDATE TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (
      SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid()
    )
  );

COMMIT;
