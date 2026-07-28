-- ============================================================
-- Migration 018: Add 'case_strategy' to agent_name_enum
-- ============================================================
-- Purpose: A5 (Case Strategy Engine) inserta agent_runs con
-- agent_name = 'case_strategy', pero ese valor nunca se agregó al
-- enum original (002_aucis_agents.sql) — causaba que el primer
-- insert de cada ejecución de A5 fallara inmediatamente con
-- "invalid input value for enum agent_name_enum", confirmado en
-- los logs reales de Vercel el 2026-07-28.
--
-- NO se envuelve en BEGIN/COMMIT: ALTER TYPE ... ADD VALUE debe
-- confirmarse antes de que el nuevo valor pueda usarse en la misma
-- sesión/transacción — ejecutarlo suelto evita ese problema.
-- ============================================================

ALTER TYPE agent_name_enum ADD VALUE IF NOT EXISTS 'case_strategy';
