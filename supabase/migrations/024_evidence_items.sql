-- ============================================================
-- Migration 024: Create evidence_items (MTCS-01)
-- ============================================================
-- Purpose: materializes the approved AUSCIS Evidence Item Contract V2
-- (docs/AUCIS_EVIDENCE_ITEM_CONTRACT_V2.md), governed by ADR-011
-- (docs/ADR-011_EVIDENCE_LIFECYCLE_REASSESSMENT_AND_STRATEGIC_CONSUMPTION.md).
-- This is MTCS-01 — Typed Evidence Persistence — only. It does not
-- implement Supporting Document association (MTCS-03), A1/A5
-- Historical Reliance (MTCS-06), or provenance taxonomy (MTCS-05).
--
-- Each row is one immutable material Evidence composition/version.
-- `id` identifies the physical composition; `evidence_id` groups all
-- compositions belonging to the same logical Evidence Item and is
-- intentionally NOT a foreign key (mirrored by `superseded_by`, also
-- not a FK) — both are plain grouping values, generated independently
-- of `id` even at version 1, so identity and composition never
-- coincide. Integrity is guaranteed by routing every mutation through
-- the governed functions below (the approved Evidence Producer
-- boundary), not by FK constraints on these two columns.
--
-- Documentary Condition and Human Verification Condition are
-- independent, non-sequential dimensions (reported|partial|documented
-- and pending|verified|needs_attention, respectively) — matching the
-- Reported/Documented/Verified semantics already superseded from
-- Evidence Item Contract V1's linear lifecycle. Currentness
-- (current|superseded) follows the same TEXT+CHECK convention already
-- used for case_strategy/agent_intake_analysis (migrations 019/020/023)
-- rather than a native ENUM, for the same additive-evolution reason.
--
-- One-current enforcement is DB-level (partial unique index), not
-- application-only — unlike the existing agent_intake_analysis/
-- case_strategy pattern, which relies solely on non-atomic
-- application-level read/insert/update calls (confirmed, by direct
-- inspection, to carry a real concurrency gap). Atomic supersession
-- and human review are implemented as SECURITY INVOKER functions,
-- executable only by service_role — this is the first use of a
-- governed Postgres function / Supabase .rpc() in this codebase,
-- adopted specifically because Evidence's per-Case-many-Items
-- cardinality (vs. the existing patterns' one-current-per-case
-- cardinality) makes the existing insert-then-update pattern provably
-- unsafe for this entity.
--
-- Actor references follow the dominant public.profiles(id) convention
-- (matching documents.verified_by), not case_strategy.approved_by's
-- isolated auth.users(id) deviation.
--
-- No tenant_id (Case ownership via case_id is the sole, already-
-- authoritative scoping mechanism in this repository). No updated_at
-- (material compositions are intended to become historically immutable
-- after supersession, unlike freely-mutable CRUD tables). No DELETE
-- policy for any application role, matching the existing
-- agent_intake_analysis/case_strategy precedent exactly (neither has a
-- role-specific DELETE policy either).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.evidence_items (
  id                                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id                        UUID NOT NULL,
  case_id                            UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,

  fact                               TEXT NOT NULL,

  version                            INTEGER NOT NULL DEFAULT 1,
  currency_status                    TEXT NOT NULL DEFAULT 'current',
  superseded_by                      UUID,

  documentary_condition               TEXT NOT NULL DEFAULT 'reported',
  documentary_condition_updated_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  documentary_condition_updated_at    TIMESTAMPTZ,

  verification_condition             TEXT NOT NULL DEFAULT 'pending',
  reviewed_by                        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at                        TIMESTAMPTZ,
  verification_reason                TEXT,

  source_type                        TEXT,
  source_reference                   TEXT,

  created_by                         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT version_positive CHECK (version >= 1),
  CONSTRAINT documentary_condition_values CHECK (documentary_condition IN ('reported','partial','documented')),
  CONSTRAINT verification_condition_values CHECK (verification_condition IN ('pending','verified','needs_attention')),
  CONSTRAINT currency_status_values CHECK (currency_status IN ('current','superseded')),
  CONSTRAINT verified_requires_review CHECK (
    verification_condition <> 'verified' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT needs_attention_requires_reason CHECK (
    verification_condition <> 'needs_attention'
    OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
        AND verification_reason IS NOT NULL AND btrim(verification_reason) <> '')
  ),
  CONSTRAINT documentary_condition_update_pair_consistency CHECK (
    (documentary_condition_updated_by IS NULL) = (documentary_condition_updated_at IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS evidence_items_evidence_version
  ON public.evidence_items(evidence_id, version);

CREATE UNIQUE INDEX IF NOT EXISTS evidence_items_one_current_per_evidence
  ON public.evidence_items(evidence_id)
  WHERE currency_status = 'current';

CREATE INDEX IF NOT EXISTS idx_evidence_items_case_id
  ON public.evidence_items(case_id);

CREATE INDEX IF NOT EXISTS idx_evidence_items_case_current
  ON public.evidence_items(case_id, currency_status);

-- ── Superseded-composition immutability ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_superseded_evidence_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.currency_status = 'superseded' THEN
    RAISE EXCEPTION 'Evidence composition % is superseded and immutable', OLD.id USING ERRCODE = 'EV001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evidence_items_immutability ON public.evidence_items;
CREATE TRIGGER trg_evidence_items_immutability
  BEFORE UPDATE ON public.evidence_items
  FOR EACH ROW EXECUTE FUNCTION public.reject_superseded_evidence_mutation();

-- ── Atomic material supersession (create v1, or supersede vN -> vN+1) ───
CREATE OR REPLACE FUNCTION public.create_evidence_composition(
  p_evidence_id             UUID,
  p_expected_current_id     UUID,
  p_case_id                 UUID,
  p_fact                    TEXT,
  p_documentary_condition   TEXT,
  p_source_type             TEXT,
  p_source_reference        TEXT,
  p_created_by              UUID
) RETURNS public.evidence_items
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_current      public.evidence_items;
  v_new          public.evidence_items;
  v_evidence_id  UUID;
  v_new_id       UUID := gen_random_uuid();
  v_next_version INTEGER;
BEGIN
  IF p_evidence_id IS NULL AND p_expected_current_id IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_CREATE_MODE' USING ERRCODE = 'EV005';
  END IF;
  IF p_evidence_id IS NOT NULL AND p_expected_current_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_CREATE_MODE' USING ERRCODE = 'EV005';
  END IF;

  IF p_evidence_id IS NOT NULL THEN
    SELECT * INTO v_current
    FROM public.evidence_items
    WHERE id = p_expected_current_id AND currency_status = 'current'
    FOR UPDATE;

    IF v_current.id IS NULL THEN
      RAISE EXCEPTION 'CONFLICT_CURRENT_COMPOSITION' USING ERRCODE = 'EV001';
    END IF;
    IF v_current.case_id IS DISTINCT FROM p_case_id OR v_current.evidence_id IS DISTINCT FROM p_evidence_id THEN
      RAISE EXCEPTION 'CASE_MISMATCH' USING ERRCODE = 'EV004';
    END IF;

    v_evidence_id  := p_evidence_id;
    v_next_version := v_current.version + 1;

    UPDATE public.evidence_items
    SET currency_status = 'superseded', superseded_by = v_new_id
    WHERE id = v_current.id;
  ELSE
    v_evidence_id  := gen_random_uuid();
    v_next_version := 1;
  END IF;

  -- documentary_condition_updated_by/at and reviewed_by/at/reason are
  -- intentionally omitted below (default NULL) on every new composition,
  -- material or initial (Evidence Item Contract V2 §§6, 74; C-04).
  INSERT INTO public.evidence_items (
    id, evidence_id, case_id, version, currency_status,
    fact, documentary_condition, verification_condition,
    source_type, source_reference, created_by
  ) VALUES (
    v_new_id, v_evidence_id, p_case_id, v_next_version, 'current',
    p_fact, p_documentary_condition, 'pending',
    p_source_type, p_source_reference, p_created_by
  ) RETURNING * INTO v_new;

  RETURN v_new;
END;
$$;

-- ── Human Verification (Verified / Needs Attention only) ────────────────
CREATE OR REPLACE FUNCTION public.review_evidence_composition(
  p_composition_id          UUID,
  p_verification_condition  TEXT,
  p_verification_reason     TEXT,
  p_reviewed_by             UUID
) RETURNS public.evidence_items
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_row public.evidence_items;
BEGIN
  IF p_verification_condition NOT IN ('verified','needs_attention') THEN
    RAISE EXCEPTION 'INVALID_REVIEW_DECISION' USING ERRCODE = 'EV002';
  END IF;

  SELECT * INTO v_row
  FROM public.evidence_items
  WHERE id = p_composition_id AND currency_status = 'current'
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'CONFLICT_CURRENT_COMPOSITION' USING ERRCODE = 'EV001';
  END IF;

  UPDATE public.evidence_items
  SET verification_condition = p_verification_condition,
      verification_reason    = p_verification_reason,
      reviewed_by             = p_reviewed_by,
      reviewed_at             = now()
  WHERE id = p_composition_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ── Governed Non-Material Documentary Condition update (TD-07 / C-04) ───
CREATE OR REPLACE FUNCTION public.update_evidence_documentary_condition(
  p_composition_id        UUID,
  p_documentary_condition TEXT,
  p_actor_id              UUID
) RETURNS public.evidence_items
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_row public.evidence_items;
BEGIN
  IF p_documentary_condition NOT IN ('reported','partial','documented') THEN
    RAISE EXCEPTION 'INVALID_DOCUMENTARY_CONDITION' USING ERRCODE = 'EV003';
  END IF;

  SELECT * INTO v_row
  FROM public.evidence_items
  WHERE id = p_composition_id AND currency_status = 'current'
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'CONFLICT_CURRENT_COMPOSITION' USING ERRCODE = 'EV001';
  END IF;

  IF v_row.documentary_condition = p_documentary_condition THEN
    RETURN v_row;
  END IF;

  UPDATE public.evidence_items
  SET documentary_condition = p_documentary_condition,
      documentary_condition_updated_by = p_actor_id,
      documentary_condition_updated_at = now()
  WHERE id = p_composition_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ── RLS: authenticated SELECT only; no direct authenticated mutation ────
ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_evidence_items"
  ON public.evidence_items FOR SELECT TO authenticated
  USING (
    is_admin_or_supervisor()
    OR case_id IN (SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid())
  );

-- ── Mutation functions: service_role only, not exposed to clients ───────
REVOKE EXECUTE ON FUNCTION public.create_evidence_composition(uuid,uuid,uuid,text,text,text,text,uuid) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.create_evidence_composition(uuid,uuid,uuid,text,text,text,text,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.review_evidence_composition(uuid,text,text,uuid) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.review_evidence_composition(uuid,text,text,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_evidence_documentary_condition(uuid,text,uuid) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.update_evidence_documentary_condition(uuid,text,uuid) TO service_role;

COMMIT;
