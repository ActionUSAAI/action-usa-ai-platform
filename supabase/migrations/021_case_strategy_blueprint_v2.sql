-- ============================================================
-- Migration 021: Align case_strategy with Blueprint Specification v2
-- ============================================================
-- Purpose: implementa el esquema exigido por
-- A5_CASE_BLUEPRINT_SPECIFICATION_V2.md y AUCIS_BLUEPRINT_CONTRACT_V2.md,
-- resultado del Blueprint Field Audit (2026-08-02).
--
-- Agrega los campos de Sección C/D/E aprobados en v2 que todavía no
-- existían en el esquema: foundational_evidence, argument_sequence,
-- missing_evidence_links, y los tres campos Deferred (evidence_priority,
-- strategic_priorities, review_notes) — estos últimos permanecen en el
-- esquema exactamente como el propio contrato exige ("no se eliminan,
-- no se confirman definitivamente").
--
-- Agrega reasoning_provenance como JSONB único (estructura paralela,
-- no columna por campo) conforme al diseño ya aprobado en la sesión
-- de discovery del Blueprint.
--
-- Elimina las tres columnas que Blueprint Contract v2 prohíbe
-- explícitamente (ADR-008): recommended_document_order,
-- attorney_letter_outline, recommended_exhibit_order. Antes de
-- ejecutar el DROP, esta migración las copia a
-- deprecated_v1_fields_archive por fila, para no perder el historial
-- de casos ya generados bajo el contrato v1 sin necesidad de
-- reconstruirlo desde agent_runs.input_snapshot.
--
-- criteria_cross_references se mantiene sin renombrar — su
-- contenido (array de strings) diverge del tipo aprobado en v2
-- (array de {criteria: [key,key], connection: string}), pero ese
-- es un cambio de TIPO, no de eliminación; se resuelve en el
-- código de la ruta, no en esta migración de esquema aditiva.
-- ============================================================

BEGIN;

-- Archivo histórico de los tres campos que se eliminan, antes de dropearlos.
ALTER TABLE public.case_strategy
  ADD COLUMN IF NOT EXISTS deprecated_v1_fields_archive JSONB;

UPDATE public.case_strategy
SET deprecated_v1_fields_archive = jsonb_build_object(
  'recommended_document_order', recommended_document_order,
  'attorney_letter_outline', attorney_letter_outline,
  'recommended_exhibit_order', recommended_exhibit_order
)
WHERE deprecated_v1_fields_archive IS NULL;

-- Campos nuevos exigidos por Blueprint Specification v2 (Sección C/D).
ALTER TABLE public.case_strategy
  ADD COLUMN IF NOT EXISTS foundational_evidence JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS argument_sequence JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS missing_evidence_links JSONB NOT NULL DEFAULT '[]';

-- Campos Deferred — Pending Empirical Validation (Blueprint Field Audit).
-- Se agregan porque ya estaban definidos en v1 y el propio audit exige
-- que permanezcan sin modificación, no que se descarten.
ALTER TABLE public.case_strategy
  ADD COLUMN IF NOT EXISTS evidence_priority JSONB,
  ADD COLUMN IF NOT EXISTS strategic_priorities JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Reasoning Provenance — estructura paralela única, no columna por campo.
ALTER TABLE public.case_strategy
  ADD COLUMN IF NOT EXISTS reasoning_provenance JSONB NOT NULL DEFAULT '{}';

-- Elimina los tres campos prohibidos por ADR-008 / Blueprint Contract v2.
ALTER TABLE public.case_strategy
  DROP COLUMN IF EXISTS recommended_document_order,
  DROP COLUMN IF EXISTS attorney_letter_outline,
  DROP COLUMN IF EXISTS recommended_exhibit_order;

COMMIT;
