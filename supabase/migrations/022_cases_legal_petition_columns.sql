-- ============================================================
-- Migration 022: Add Initial Legal Petition / Active Legal Petition to cases
-- ============================================================
-- Purpose: implementa la Fase 1 (Modelo de Datos) del diseño ya
-- congelado para Initial Legal Petition / Active Legal Petition.
--
-- Initial Legal Petition: la primera decisión jurídica formal
-- tomada por el abogado para iniciar el caso. Histórica,
-- inmutable, nunca cambia. El mecanismo técnico de garantía de
-- inmutabilidad queda diferido explícitamente a una fase posterior
-- de implementación — no se resuelve en esta migración.
--
-- Active Legal Petition: la petición jurídica vigente sobre la
-- cual la firma trabaja actualmente. Mutable, única Fuente Activa
-- que el Core Legal Engine (A1, A5) deberá consumir en fases
-- posteriores. Reemplaza a intake_submissions.module1.visaType
-- como fuente jurídica — ese campo deja de tratarse como
-- autoritativo, pero no se modifica ni se elimina, sigue existiendo
-- como expectativa informativa del cliente.
--
-- classification_used (agent_intake_analysis, migración 013)
-- permanece sin cambio — ya cumplía correctamente el rol de
-- Snapshot Histórico que este modelo formaliza.
--
-- Sin backfill: ningún valor existente de module1.visaType se
-- copia a estas columnas. Todo caso, nuevo o existente, requiere
-- confirmación jurídica explícita del abogado antes de que ambas
-- columnas queden pobladas — decisión de dominio ya aprobada,
-- ver AUCIS_ARCHITECTURE_DECISIONS.md.
--
-- Alcance estrictamente limitado al esquema: esta migración no
-- introduce tipos compartidos, no modifica A1/A5/A3/A4, no
-- implementa el Legal Decision Cycle, no resuelve el mecanismo de
-- inmutabilidad. Cada uno de esos puntos pertenece a una fase
-- posterior, ya definida y aprobada por separado.
-- ============================================================

BEGIN;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS initial_legal_petition TEXT NULL,
  ADD COLUMN IF NOT EXISTS active_legal_petition TEXT NULL;

COMMIT;
