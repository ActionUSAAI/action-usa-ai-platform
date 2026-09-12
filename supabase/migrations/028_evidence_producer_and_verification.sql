-- ============================================================
-- Migration 028: Single Governed Evidence Producer + Human Verification (MTCS-04)
-- ============================================================
-- Purpose: materializes the approved MTCS-04 Exact Design (CR-04-01A/B) — the first
-- runtime-callable Producer for evidence_items (MTCS-01, migration 024) and
-- evidence_item_documents (MTCS-03, migration 027). Zero runtime caller existed for
-- either before this migration.
--
-- Additive/evolutionary only. Does not modify migrations 024/025/026/027 — this file
-- adds two columns to evidence_items, adds three new functions, and evolves two
-- existing MTCS-03 functions via CREATE OR REPLACE (identical external signature and
-- behavior for any non-racing caller; the only change is internal locking plus gated
-- probative_revision advancement).
--
-- probative_revision (RV-A, frozen) — optimistic-concurrency token scoped to the
-- specific Evidence composition (evidence_items.id), NOT the stable evidence_id.
-- Advances by exactly 1 only on a REAL change to the probative composition (fact +
-- associated Document set). It is NOT a complete audit trail, NOT a verification
-- revision, and NOT durable detach attribution (CR-04-01B) — Documentary Condition and
-- Human Verification are independent dimensions and never advance it.
--
-- fact_updated_by/fact_updated_at — closes the previously-open attribution gap for
-- update_evidence_fact() (FC-A), mirroring documentary_condition_updated_by/at's
-- existing pair-consistency CHECK pattern exactly.
--
-- create_evidence_composition_with_documents() — the atomic Producer primitive
-- (Model C preserved: create_evidence_composition() itself is untouched). Initial
-- Document population is a raw insert relying on evidence_item_documents' own
-- composite FKs for same-Case/existence validation — never calls
-- attach_evidence_document() for the initial set, so a freshly-created composition's
-- probative_revision is always exactly 1 regardless of 0 or N initial documents
-- (no incidental loop-count leakage).
--
-- attach_evidence_document()/detach_evidence_document() evolution — adds the
-- previously-missing FOR UPDATE lock on evidence_items (closing a verified
-- review-vs-attach/detach race — MTCS-03's original functions used a plain SELECT) and
-- gated probative_revision advancement (only on a real, non-idempotent change).
--
-- review_evidence_composition_if_current() — new wrapper enforcing RV-04-01 (stale
-- probative snapshot, EV007) and RV-04-02 (stale Human Verification decision context,
-- EV008 — via reviewed_at, IS NOT DISTINCT FROM, no new verification-revision column)
-- before delegating unchanged to review_evidence_composition() (migration 024, not
-- modified). Precedence: EV007 checked before EV008.
-- ============================================================

BEGIN;

-- ── Probative-composition concurrency token + fact-correction attribution ──────────
ALTER TABLE public.evidence_items
  ADD COLUMN IF NOT EXISTS probative_revision BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fact_updated_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fact_updated_at     TIMESTAMPTZ;

ALTER TABLE public.evidence_items
  ADD CONSTRAINT probative_revision_positive CHECK (probative_revision >= 1);

ALTER TABLE public.evidence_items
  ADD CONSTRAINT fact_update_pair_consistency CHECK (
    (fact_updated_by IS NULL) = (fact_updated_at IS NULL)
  );

-- ── Fact correction (FC-A): governed in-place correction, current+unreviewed only ──
CREATE OR REPLACE FUNCTION public.update_evidence_fact(
  p_composition_id UUID,
  p_fact           TEXT,
  p_actor_id       UUID
) RETURNS public.evidence_items
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_row public.evidence_items;
BEGIN
  SELECT * INTO v_row
  FROM public.evidence_items
  WHERE id = p_composition_id AND currency_status = 'current'
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'CONFLICT_CURRENT_COMPOSITION' USING ERRCODE = 'EV001';
  END IF;

  IF v_row.reviewed_at IS NOT NULL THEN
    RAISE EXCEPTION 'HISTORICAL_COMPOSITION_IMMUTABLE' USING ERRCODE = 'EV001';
  END IF;

  IF p_fact IS NOT DISTINCT FROM v_row.fact THEN
    RETURN v_row;
  END IF;

  UPDATE public.evidence_items
  SET fact = p_fact,
      fact_updated_by = p_actor_id,
      fact_updated_at = now(),
      probative_revision = probative_revision + 1
  WHERE id = p_composition_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ── Attach: evolved with FOR UPDATE + gated probative_revision advance ─────────────
CREATE OR REPLACE FUNCTION public.attach_evidence_document(
  p_evidence_item_id UUID,
  p_document_id      UUID,
  p_created_by       UUID DEFAULT NULL
) RETURNS public.evidence_item_documents
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_evidence  public.evidence_items;
  v_document  public.documents;
  v_row       public.evidence_item_documents;
  v_inserted  UUID;
BEGIN
  SELECT * INTO v_evidence
  FROM public.evidence_items
  WHERE id = p_evidence_item_id AND currency_status = 'current'
  FOR UPDATE;

  IF v_evidence.id IS NULL THEN
    RAISE EXCEPTION 'CONFLICT_CURRENT_COMPOSITION' USING ERRCODE = 'EV001';
  END IF;

  IF v_evidence.reviewed_at IS NOT NULL THEN
    RAISE EXCEPTION 'HISTORICAL_COMPOSITION_IMMUTABLE' USING ERRCODE = 'EV001';
  END IF;

  SELECT * INTO v_document
  FROM public.documents
  WHERE id = p_document_id;

  IF v_document.id IS NULL THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'EV006';
  END IF;

  IF v_evidence.case_id IS DISTINCT FROM v_document.case_id THEN
    RAISE EXCEPTION 'CASE_MISMATCH' USING ERRCODE = 'EV004';
  END IF;

  INSERT INTO public.evidence_item_documents (evidence_item_id, document_id, case_id, created_by)
  VALUES (p_evidence_item_id, p_document_id, v_evidence.case_id, p_created_by)
  ON CONFLICT (evidence_item_id, document_id) DO NOTHING
  RETURNING evidence_item_id INTO v_inserted;

  IF v_inserted IS NOT NULL THEN
    UPDATE public.evidence_items
    SET probative_revision = probative_revision + 1
    WHERE id = p_evidence_item_id;
  END IF;

  SELECT * INTO v_row
  FROM public.evidence_item_documents
  WHERE evidence_item_id = p_evidence_item_id AND document_id = p_document_id;

  RETURN v_row;
END;
$$;

-- ── Detach: evolved with FOR UPDATE + gated probative_revision advance ─────────────
CREATE OR REPLACE FUNCTION public.detach_evidence_document(
  p_evidence_item_id UUID,
  p_document_id      UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_evidence public.evidence_items;
  v_deleted  INTEGER;
BEGIN
  SELECT * INTO v_evidence
  FROM public.evidence_items
  WHERE id = p_evidence_item_id AND currency_status = 'current'
  FOR UPDATE;

  IF v_evidence.id IS NULL THEN
    RAISE EXCEPTION 'CONFLICT_CURRENT_COMPOSITION' USING ERRCODE = 'EV001';
  END IF;

  IF v_evidence.reviewed_at IS NOT NULL THEN
    RAISE EXCEPTION 'HISTORICAL_COMPOSITION_IMMUTABLE' USING ERRCODE = 'EV001';
  END IF;

  DELETE FROM public.evidence_item_documents
  WHERE evidence_item_id = p_evidence_item_id AND document_id = p_document_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    UPDATE public.evidence_items
    SET probative_revision = probative_revision + 1
    WHERE id = p_evidence_item_id;
  END IF;

  RETURN v_deleted > 0;
END;
$$;

-- ── Atomic Producer primitive: composition + initial Document set, one transaction ─
CREATE OR REPLACE FUNCTION public.create_evidence_composition_with_documents(
  p_evidence_id           UUID,
  p_expected_current_id   UUID,
  p_case_id               UUID,
  p_fact                  TEXT,
  p_documentary_condition TEXT,
  p_source_type           TEXT,
  p_source_reference      TEXT,
  p_created_by            UUID,
  p_document_ids          UUID[]
) RETURNS public.evidence_items
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_new public.evidence_items;
  v_doc UUID;
BEGIN
  v_new := public.create_evidence_composition(
    p_evidence_id, p_expected_current_id, p_case_id, p_fact, p_documentary_condition,
    p_source_type, p_source_reference, p_created_by
  );

  IF p_document_ids IS NOT NULL THEN
    FOREACH v_doc IN ARRAY p_document_ids LOOP
      -- Initial-construction population: a raw insert relying on the composite FKs
      -- (evidence_item_id,case_id)/(document_id,case_id) for same-Case + existence
      -- validation — deliberately NOT a call to attach_evidence_document(), so
      -- probative_revision is never touched during atomic construction and remains
      -- at its DEFAULT of 1 regardless of how many initial documents are supplied.
      BEGIN
        INSERT INTO public.evidence_item_documents (evidence_item_id, document_id, case_id, created_by)
        VALUES (v_new.id, v_doc, v_new.case_id, p_created_by)
        ON CONFLICT (evidence_item_id, document_id) DO NOTHING;
      EXCEPTION
        WHEN foreign_key_violation THEN
          IF NOT EXISTS (SELECT 1 FROM public.documents WHERE id = v_doc) THEN
            RAISE EXCEPTION 'DOCUMENT_NOT_FOUND' USING ERRCODE = 'EV006';
          ELSE
            RAISE EXCEPTION 'CASE_MISMATCH' USING ERRCODE = 'EV004';
          END IF;
      END;
    END LOOP;
  END IF;

  RETURN v_new;
END;
$$;

-- ── Human Verification wrapper: RV-04-01 (EV007) + RV-04-02 (EV008), precedence
-- EV007 before EV008 — delegates unchanged to review_evidence_composition() ─────────
CREATE OR REPLACE FUNCTION public.review_evidence_composition_if_current(
  p_composition_id              UUID,
  p_expected_probative_revision BIGINT,
  p_expected_reviewed_at        TIMESTAMPTZ,
  p_verification_condition      TEXT,
  p_verification_reason         TEXT,
  p_reviewed_by                 UUID
) RETURNS public.evidence_items
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_row public.evidence_items;
BEGIN
  SELECT * INTO v_row
  FROM public.evidence_items
  WHERE id = p_composition_id AND currency_status = 'current'
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'CONFLICT_CURRENT_COMPOSITION' USING ERRCODE = 'EV001';
  END IF;

  IF v_row.probative_revision IS DISTINCT FROM p_expected_probative_revision THEN
    RAISE EXCEPTION 'STALE_PROBATIVE_SNAPSHOT' USING ERRCODE = 'EV007';
  END IF;

  IF v_row.reviewed_at IS DISTINCT FROM p_expected_reviewed_at THEN
    RAISE EXCEPTION 'STALE_VERIFICATION_STATE' USING ERRCODE = 'EV008';
  END IF;

  RETURN public.review_evidence_composition(
    p_composition_id, p_verification_condition, p_verification_reason, p_reviewed_by
  );
END;
$$;

-- ── Grants: service_role only, matching the exact MTCS-01/03 precedent ─────────────
REVOKE EXECUTE ON FUNCTION public.update_evidence_fact(uuid,text,uuid) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.update_evidence_fact(uuid,text,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.attach_evidence_document(uuid,uuid,uuid) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.attach_evidence_document(uuid,uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.detach_evidence_document(uuid,uuid) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.detach_evidence_document(uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_evidence_composition_with_documents(uuid,uuid,uuid,text,text,text,text,uuid,uuid[]) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.create_evidence_composition_with_documents(uuid,uuid,uuid,text,text,text,text,uuid,uuid[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.review_evidence_composition_if_current(uuid,bigint,timestamptz,text,text,uuid) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.review_evidence_composition_if_current(uuid,bigint,timestamptz,text,text,uuid) TO service_role;

COMMIT;
