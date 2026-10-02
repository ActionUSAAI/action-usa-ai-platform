-- ============================================================
-- Migration 040: CBR Governed Confirmation & Promotion Flow
-- ============================================================
-- Implements the CBR Governed Confirmation & Promotion Flow consolidated
-- design (CBR_Consolidated_Design_2026-09-25.md, corrections through
-- "TX-04 Lock-Target Binding Correction II"), as authorized by the
-- CBR — Complete Code Implementation Instruction (25 September 2026).
--
-- THIS MIGRATION HAS NOT BEEN APPLIED TO ANY DATABASE. It was written
-- and statically reviewed only; no isolated/disposable Postgres instance
-- was available in the implementing environment (no Docker/Podman/local
-- postgres; the only reachable Supabase project was the shared,
-- out-of-bounds AUSCIS-TEST instance). See the accompanying test suite
-- and README under supabase/tests/cbr-governed-flow/ for the execution
-- plan required before this migration may be trusted.
--
-- Migration 039 (frozen) is not modified by this file.
--
-- ── MATERIAL SOURCE/DESIGN CONFLICTS FOUND DURING IMPLEMENTATION ──────
-- (1) FIELD SCOPE: cbr_internal.cbr_resolve_field and
--     cbr_apply_clients_mutation (migration 039) recognize and map all
--     14 CBR fields, including nationality, foreignStreet,
--     foreignProvince, foreignPostalCode, foreignCountry and
--     countryOfBirth. The approved design explicitly scopes only 8
--     fields (email, whatsapp, countryOfResidence, cityOfResidence,
--     middleName, dateOfBirth, firstName, lastName) and excludes the
--     other 6 with stated rationale (no confirmation-status mechanism /
--     unconstrained cardinality / no Structured-Profile tracking).
--     RESOLVED CONSERVATIVELY: TX-01/TX-02 apply an explicit
--     CBR-governed allow-list (the 8 approved fields) IN ADDITION TO,
--     and narrower than, cbr_resolve_field's own recognition — this
--     narrows behavior, never expands it, and does not alter migration
--     039. If the 6 excluded fields are ever intended to be in scope,
--     that requires a separate, explicit design decision.
-- (2) PROVENANCE DATA GAP: the approved design's origin-population
--     contract (§D) reads structured_profile -> <field> ->>
--     'confirmed_from_source' from the submitted JSONB. Direct
--     inspection of src/lib/intake/structured-profile.ts (this session)
--     confirms the real StructuredProfileField interface is exactly
--     {value, source, confidence, status, confirmed_by, confirmed_at}
--     — there is no confirmed_from_source key anywhere in real
--     submitted data. confirmField() instead unconditionally overwrites
--     `source` to the literal string "beneficiary_confirmed",
--     discarding the original acquisition source. This migration
--     implements the read EXACTLY as approved (a JSONB ->> lookup of a
--     currently-absent key, which safely evaluates to NULL, never
--     errors) — it does NOT substitute `source` or invent a mapping.
--     Practical consequence, RESOLVED in this continuation: `confirmed_from_source`
--     has been added to StructuredProfileField and implemented in
--     confirmField()/acquireField() (src/lib/intake/structured-profile.ts),
--     per the CBR — Complete Code Implementation Instruction's explicit
--     authorization of this minimum-compatible addition. New submissions
--     going forward will carry real provenance; historical submissions
--     predating this change will still read as NULL (no backfill performed
--     or authorized), which is the correct, honest "legacy" case.
-- (3) FIELD-KEY VOCABULARY MISMATCH: src/lib/intake/structured-profile.ts's
--     IDENTITY_FIELDS uses `givenName`/`familyName`, not the CBR field_key
--     vocabulary's `firstName`/`lastName`. Every other CBR field_key
--     (email, whatsapp, countryOfResidence, cityOfResidence, middleName,
--     dateOfBirth) matches the StructuredProfile JSON key directly.
--     RESOLVED: TX-02 translates firstName->givenName / lastName->familyName
--     when reading structured_profile (see its STEP 4); TX-01 is unaffected
--     since none of its four fields are renamed.
-- ========================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- A. Internal tables: gate state, admission windows, processing state
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cbr_internal.cbr_field_gate_state (
  gate    TEXT PRIMARY KEY CHECK (gate IN ('g1g2','g3_observation','g3_staff_resolution')),
  enabled BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS cbr_internal.cbr_field_admission_window (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gate       TEXT NOT NULL CHECK (gate IN ('g1g2','g3_observation')),
  opened_at  TIMESTAMPTZ NOT NULL,
  closed_at  TIMESTAMPTZ NULL,
  CONSTRAINT cbr_admission_window_interval CHECK (closed_at IS NULL OR closed_at > opened_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS cbr_admission_window_one_open
  ON cbr_internal.cbr_field_admission_window(gate) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS cbr_admission_window_gate_idx
  ON cbr_internal.cbr_field_admission_window(gate, opened_at);

CREATE TABLE IF NOT EXISTS cbr_internal.cbr_field_processing_state (
  client_id                UUID NOT NULL REFERENCES public.clients(id),
  field_key                TEXT NOT NULL,
  governing_submission_id  UUID NULL REFERENCES public.intake_submissions(id),
  governing_submitted_at   TIMESTAMPTZ NULL,
  last_processed_at        TIMESTAMPTZ NULL,
  PRIMARY KEY (client_id, field_key),
  CONSTRAINT cbr_processing_state_governing_pair CHECK (
    (governing_submission_id IS NULL) = (governing_submitted_at IS NULL)),
  CONSTRAINT cbr_processing_state_processed_pair CHECK (
    (governing_submission_id IS NULL) = (last_processed_at IS NULL))
);

REVOKE ALL ON cbr_internal.cbr_field_gate_state FROM PUBLIC, authenticated, anon;
REVOKE ALL ON cbr_internal.cbr_field_admission_window FROM PUBLIC, authenticated, anon;
REVOKE ALL ON cbr_internal.cbr_field_processing_state FROM PUBLIC, authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON cbr_internal.cbr_field_gate_state TO service_role;
GRANT SELECT, INSERT, UPDATE ON cbr_internal.cbr_field_admission_window TO service_role;
GRANT SELECT, INSERT, UPDATE ON cbr_internal.cbr_field_processing_state TO service_role;

-- ────────────────────────────────────────────────────────────────
-- B. Additive columns on canonical_beneficiary_records
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.canonical_beneficiary_records
  ADD COLUMN IF NOT EXISTS source_observation_id        UUID NULL REFERENCES public.canonical_beneficiary_records(id),
  ADD COLUMN IF NOT EXISTS related_candidate_id         UUID NULL REFERENCES public.canonical_beneficiary_records(id),
  ADD COLUMN IF NOT EXISTS superseded_by_submission_id  UUID NULL REFERENCES public.intake_submissions(id);

-- ────────────────────────────────────────────────────────────────
-- C. Row-local constraints
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.canonical_beneficiary_records
  DROP CONSTRAINT IF EXISTS cbr_source_observation_required,
  ADD CONSTRAINT cbr_source_observation_required CHECK (
    (record_type = 'DECISION' AND source_observation_id IS NOT NULL) OR
    (record_type != 'DECISION' AND source_observation_id IS NULL));

ALTER TABLE public.canonical_beneficiary_records
  DROP CONSTRAINT IF EXISTS cbr_related_candidate_required,
  ADD CONSTRAINT cbr_related_candidate_required CHECK (
    (record_type = 'CONFLICT_DETECTED' AND related_candidate_id IS NOT NULL) OR
    (record_type != 'CONFLICT_DETECTED' AND related_candidate_id IS NULL));

-- NULL-safe supersession pointer constraint (final corrected form —
-- Targeted Integration Correction II): boolean-equality, never NULL.
ALTER TABLE public.canonical_beneficiary_records
  DROP CONSTRAINT IF EXISTS cbr_superseded_by_required,
  ADD CONSTRAINT cbr_superseded_by_required CHECK (
    (decision_state IS NOT DISTINCT FROM 'superseded')
    = (superseded_by_submission_id IS NOT NULL));

-- Extend decision_state to include 'superseded' (was pending/approved/rejected only).
ALTER TABLE public.canonical_beneficiary_records
  DROP CONSTRAINT IF EXISTS cbr_decision_state_values,
  ADD CONSTRAINT cbr_decision_state_values CHECK (
    decision_state IS NULL OR decision_state IN ('pending','approved','rejected','superseded'));

-- Terminal states require reviewed_by/reviewed_at, EXCEPT 'superseded',
-- which requires reviewed_at (a real timestamp) but reviewed_by IS NULL
-- (no human reviewer for a system-driven supersession transition).
ALTER TABLE public.canonical_beneficiary_records
  DROP CONSTRAINT IF EXISTS cbr_decision_terminal_requires_review,
  ADD CONSTRAINT cbr_decision_terminal_requires_review CHECK (
    decision_state IS NULL OR decision_state = 'pending'
    OR (decision_state IN ('approved','rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    OR (decision_state = 'superseded' AND reviewed_by IS NULL AND reviewed_at IS NOT NULL));

CREATE UNIQUE INDEX IF NOT EXISTS cbr_change_realized_unique
  ON public.canonical_beneficiary_records (client_id, field_key, source_submission_id)
  WHERE record_type = 'CHANGE_REALIZED';

CREATE UNIQUE INDEX IF NOT EXISTS cbr_conflict_related_candidate_unique
  ON public.canonical_beneficiary_records (related_candidate_id)
  WHERE record_type = 'CONFLICT_DETECTED';

-- ────────────────────────────────────────────────────────────────
-- D. Relationship/immutability/transition-graph trigger
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cbr_internal.cbr_validate_relationship() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- (1) identity/relationship/snapshot columns: always immutable, on every record type.
    IF NEW.id                     IS DISTINCT FROM OLD.id
       OR NEW.client_id            IS DISTINCT FROM OLD.client_id
       OR NEW.record_type          IS DISTINCT FROM OLD.record_type
       OR NEW.field_key            IS DISTINCT FROM OLD.field_key
       OR NEW.source_case_id       IS DISTINCT FROM OLD.source_case_id
       OR NEW.source_submission_id IS DISTINCT FROM OLD.source_submission_id
       OR NEW.source_document_id   IS DISTINCT FROM OLD.source_document_id
       OR NEW.origin                IS DISTINCT FROM OLD.origin
       OR NEW.candidate_value       IS DISTINCT FROM OLD.candidate_value
       OR NEW.prior_value           IS DISTINCT FROM OLD.prior_value
       OR NEW.new_value             IS DISTINCT FROM OLD.new_value
       OR NEW.authority_basis       IS DISTINCT FROM OLD.authority_basis
       OR NEW.expected_prior_value  IS DISTINCT FROM OLD.expected_prior_value
       OR NEW.related_decision_id   IS DISTINCT FROM OLD.related_decision_id
       OR NEW.source_observation_id IS DISTINCT FROM OLD.source_observation_id
       OR NEW.related_candidate_id  IS DISTINCT FROM OLD.related_candidate_id
       OR NEW.created_at            IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'CBR_IMMUTABLE_FIELD_VIOLATION';
    END IF;

    -- (2) the five transition-related columns: gate on ANY of them differing.
    IF NEW.decision_state IS DISTINCT FROM OLD.decision_state
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.decision_reason IS DISTINCT FROM OLD.decision_reason
       OR NEW.superseded_by_submission_id IS DISTINCT FROM OLD.superseded_by_submission_id
    THEN
      IF OLD.decision_state IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'CBR_TERMINAL_REWRITE_VIOLATION';
      END IF;
      IF NEW.decision_state IS NOT DISTINCT FROM OLD.decision_state THEN
        RAISE EXCEPTION 'CBR_INVALID_TRANSITION';
      END IF;
      IF NEW.decision_state NOT IN ('approved','rejected','superseded') THEN
        RAISE EXCEPTION 'CBR_INVALID_TRANSITION';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- INSERT-time relationship, value-binding AND provenance-binding checks (IC Finding 2:
  -- DECISION.origin must equal its source observation's origin; CONFLICT_DETECTED.origin
  -- must equal its related candidate's origin -- enforced here, database-level, not left to
  -- TX-02/TX-03 discipline alone).
  IF NEW.record_type = 'DECISION' THEN
    PERFORM 1 FROM public.canonical_beneficiary_records co WHERE co.id = NEW.source_observation_id
      AND co.record_type = 'CANDIDATE_OBSERVED' AND co.client_id = NEW.client_id AND co.field_key = NEW.field_key
      AND co.candidate_value = NEW.candidate_value AND co.origin IS NOT DISTINCT FROM NEW.origin;
    IF NOT FOUND THEN RAISE EXCEPTION 'CBR_RELATIONSHIP_VIOLATION: source_observation_id/candidate_value/origin mismatch'; END IF;
  END IF;
  IF NEW.record_type = 'CONFLICT_DETECTED' THEN
    PERFORM 1 FROM public.canonical_beneficiary_records rc WHERE rc.id = NEW.related_candidate_id
      AND rc.record_type = 'CANDIDATE_OBSERVED' AND rc.client_id = NEW.client_id AND rc.field_key = NEW.field_key
      AND rc.source_submission_id = NEW.source_submission_id AND rc.candidate_value = NEW.candidate_value
      AND rc.origin IS NOT DISTINCT FROM NEW.origin;
    IF NOT FOUND THEN RAISE EXCEPTION 'CBR_RELATIONSHIP_VIOLATION: related_candidate_id/source_submission_id/candidate_value/origin mismatch'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cbr_validate_relationship_trg ON public.canonical_beneficiary_records;
CREATE TRIGGER cbr_validate_relationship_trg BEFORE INSERT OR UPDATE ON public.canonical_beneficiary_records
  FOR EACH ROW EXECUTE FUNCTION cbr_internal.cbr_validate_relationship();

REVOKE ALL ON FUNCTION cbr_internal.cbr_validate_relationship() FROM PUBLIC, authenticated, anon;

-- ────────────────────────────────────────────────────────────────
-- E. Gate initialization (idempotent; never resets an existing row)
-- ────────────────────────────────────────────────────────────────

INSERT INTO cbr_internal.cbr_field_gate_state (gate, enabled) VALUES
  ('g1g2', false),
  ('g3_observation', false),
  ('g3_staff_resolution', false)
ON CONFLICT (gate) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- F. cbr_toggle_gate — administrative gate/window control
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cbr_internal.cbr_toggle_gate(p_gate TEXT, p_enable BOOLEAN, p_actor_id UUID)
RETURNS TABLE(outcome TEXT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, cbr_internal, pg_temp AS $$
DECLARE
  v_role TEXT;
  v_gate_name TEXT;
  v_row_count INT := 0;
  v_g1g2_enabled BOOLEAN; v_obs_enabled BOOLEAN; v_staff_enabled BOOLEAN;
  v_was_enabled BOOLEAN;
  v_g1g2_window_open BOOLEAN; v_g3_window_open BOOLEAN;
  v_effective_after BOOLEAN;
  v_ts TIMESTAMPTZ;
BEGIN
  IF p_gate IS NULL THEN outcome := 'INVALID_GATE'; RETURN NEXT; RETURN; END IF;
  IF p_gate NOT IN ('g1g2','g3_observation','g3_staff_resolution') THEN
    outcome := 'INVALID_GATE'; RETURN NEXT; RETURN;
  END IF;
  IF p_enable IS NULL THEN outcome := 'INVALID_INPUT'; RETURN NEXT; RETURN; END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = p_actor_id;
  IF NOT FOUND THEN outcome := 'MISSING_REFERENCE'; RETURN NEXT; RETURN; END IF;
  IF v_role NOT IN ('admin','supervisor') THEN outcome := 'UNAUTHORIZED'; RETURN NEXT; RETURN; END IF;

  FOR v_gate_name IN
    SELECT gate FROM cbr_internal.cbr_field_gate_state
    WHERE gate IN ('g1g2','g3_observation','g3_staff_resolution')
    ORDER BY gate
    FOR UPDATE
  LOOP
    v_row_count := v_row_count + 1;
  END LOOP;

  IF v_row_count < 3 THEN
    outcome := 'GATE_NOT_INITIALIZED'; RETURN NEXT; RETURN;
  END IF;

  SELECT enabled INTO v_g1g2_enabled  FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g1g2';
  SELECT enabled INTO v_obs_enabled   FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_observation';
  SELECT enabled INTO v_staff_enabled FROM cbr_internal.cbr_field_gate_state WHERE gate = 'g3_staff_resolution';

  SELECT EXISTS(SELECT 1 FROM cbr_internal.cbr_field_admission_window WHERE gate='g1g2' AND closed_at IS NULL)
    INTO v_g1g2_window_open;
  IF v_g1g2_window_open IS DISTINCT FROM v_g1g2_enabled THEN
    RAISE EXCEPTION 'CBR_GATE_WINDOW_INCONSISTENT: g1g2';
  END IF;
  SELECT EXISTS(SELECT 1 FROM cbr_internal.cbr_field_admission_window WHERE gate='g3_observation' AND closed_at IS NULL)
    INTO v_g3_window_open;
  IF v_g3_window_open IS DISTINCT FROM (COALESCE(v_obs_enabled,false) AND COALESCE(v_staff_enabled,false)) THEN
    RAISE EXCEPTION 'CBR_GATE_WINDOW_INCONSISTENT: g3_observation';
  END IF;

  v_was_enabled := CASE p_gate WHEN 'g1g2' THEN v_g1g2_enabled WHEN 'g3_observation' THEN v_obs_enabled ELSE v_staff_enabled END;
  IF v_was_enabled = p_enable THEN outcome := 'NO_CHANGE'; RETURN NEXT; RETURN; END IF;

  UPDATE cbr_internal.cbr_field_gate_state SET enabled = p_enable WHERE gate = p_gate;
  v_ts := clock_timestamp();

  IF p_gate = 'g1g2' THEN
    IF p_enable THEN
      INSERT INTO cbr_internal.cbr_field_admission_window(gate, opened_at) VALUES ('g1g2', v_ts);
    ELSE
      UPDATE cbr_internal.cbr_field_admission_window SET closed_at = v_ts WHERE gate='g1g2' AND closed_at IS NULL;
    END IF;
  ELSE
    v_obs_enabled   := CASE WHEN p_gate='g3_observation' THEN p_enable ELSE v_obs_enabled END;
    v_staff_enabled := CASE WHEN p_gate='g3_staff_resolution' THEN p_enable ELSE v_staff_enabled END;
    v_effective_after := COALESCE(v_obs_enabled,false) AND COALESCE(v_staff_enabled,false);
    IF v_effective_after AND NOT v_g3_window_open THEN
      INSERT INTO cbr_internal.cbr_field_admission_window(gate, opened_at) VALUES ('g3_observation', v_ts);
    ELSIF NOT v_effective_after AND v_g3_window_open THEN
      UPDATE cbr_internal.cbr_field_admission_window SET closed_at = v_ts WHERE gate='g3_observation' AND closed_at IS NULL;
    END IF;
  END IF;
  outcome := 'TOGGLED'; RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION cbr_internal.cbr_toggle_gate(text, boolean, uuid) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION cbr_internal.cbr_toggle_gate(text, boolean, uuid) TO service_role;

-- ────────────────────────────────────────────────────────────────
-- G0. cbr_internal.cbr_values_equal — centralized, field-aware comparison
-- ────────────────────────────────────────────────────────────────
-- IC Finding 1: the approved equality rules (email case-insensitive;
-- whatsapp strip whitespace/hyphens; countryOfResidence trimmed
-- case-sensitive; cityOfResidence trimmed case-insensitive;
-- middleName/firstName/lastName trimmed exact; dateOfBirth typed DATE)
-- are implemented in exactly ONE place and called from every comparison
-- site in TX-01/TX-02/TX-04 (NO_OP, CONTACT_PROTECTED, REFERENCE_MISMATCH,
-- canonical-vs-candidate, prior-candidate-vs-incoming, equality-before-
-- mutation, STALE_PRIOR_VALUE). This function NEVER normalizes what gets
-- STORED — every INSERT/UPDATE in this migration continues to persist the
-- submitted/approved value exactly as received; only the comparison
-- itself is normalized. NULL-safe: both NULL -> equal; exactly one NULL
-- -> not equal (canonical-absence handling remains the CALLER's
-- responsibility via explicit IS NULL checks, unchanged).
CREATE OR REPLACE FUNCTION cbr_internal.cbr_values_equal(p_field_key TEXT, p_value_a TEXT, p_value_b TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF p_value_a IS NULL AND p_value_b IS NULL THEN RETURN TRUE; END IF;
  IF p_value_a IS NULL OR p_value_b IS NULL THEN RETURN FALSE; END IF;

  CASE p_field_key
    WHEN 'email' THEN
      RETURN lower(p_value_a) = lower(p_value_b);
    WHEN 'whatsapp' THEN
      RETURN regexp_replace(p_value_a, '[\s-]', '', 'g') = regexp_replace(p_value_b, '[\s-]', '', 'g');
    WHEN 'countryOfResidence' THEN
      RETURN btrim(p_value_a) = btrim(p_value_b); -- trimmed, case-SENSITIVE
    WHEN 'cityOfResidence' THEN
      RETURN lower(btrim(p_value_a)) = lower(btrim(p_value_b));
    WHEN 'middleName', 'firstName', 'lastName' THEN
      RETURN btrim(p_value_a) = btrim(p_value_b);
    WHEN 'dateOfBirth' THEN
      RETURN p_value_a::DATE = p_value_b::DATE; -- typed DATE equality; both sides are
        -- already format/calendar-validated TEXT representations by the time this is called
    ELSE
      RETURN p_value_a = p_value_b; -- defensive default; every CBR-governed field is covered above
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION cbr_internal.cbr_values_equal(text, text, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION cbr_internal.cbr_values_equal(text, text, text) TO service_role;

-- ────────────────────────────────────────────────────────────────
-- G0.1. cbr_internal.cbr_normalize_for_storage — centralized storage trim
-- ────────────────────────────────────────────────────────────────
-- Residual correction: comparison correctness (cbr_internal.cbr_values_equal
-- above) does not by itself establish storage-trimming compliance -- they
-- are two independent requirements against the approved design and must be
-- verified/satisfied separately. This is the single place that applies
-- storage-side trimming, for EXACTLY the fields whose approved comparison
-- rule is "trimmed" -- countryOfResidence, cityOfResidence, middleName,
-- firstName, lastName -- stripping only leading/trailing whitespace before
-- a value is written to public.clients or persisted as a
-- CANDIDATE_OBSERVED/CHANGE_REALIZED candidate_value/new_value. This is
-- NOT the same as comparison normalization: it never case-folds (cityOfResidence
-- keeps its submitted casing in storage even though its comparison is
-- case-insensitive), never strips internal whitespace/hyphens (whatsapp is
-- untouched -- its comparison rule strips formatting for EQUALITY testing
-- only, never for what gets stored), and never touches email or dateOfBirth
-- (dateOfBirth is cast to DATE, which has no textual whitespace to trim;
-- email's approved rule is case-insensitivity only, no trim). Applying
-- unapproved normalization (case-folding, hyphen/whitespace stripping) at
-- STORAGE time for any field is explicitly out of scope here.
CREATE OR REPLACE FUNCTION cbr_internal.cbr_normalize_for_storage(p_field_key TEXT, p_value TEXT)
RETURNS TEXT LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF p_value IS NULL THEN RETURN NULL; END IF;
  CASE p_field_key
    WHEN 'countryOfResidence', 'cityOfResidence', 'middleName', 'firstName', 'lastName' THEN
      RETURN btrim(p_value);
    ELSE
      RETURN p_value; -- email, whatsapp, dateOfBirth: unchanged, per the approved rules above
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION cbr_internal.cbr_normalize_for_storage(text, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION cbr_internal.cbr_normalize_for_storage(text, text) TO service_role;

-- ────────────────────────────────────────────────────────────────
-- G. TX-01 — cbr_tx01_realize_g1g2
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cbr_tx01_realize_g1g2(p_submission_id UUID, p_field_key TEXT)
RETURNS TABLE(outcome TEXT, realized_value TEXT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, cbr_internal, pg_temp AS $$
DECLARE
  v_g1g2_enabled BOOLEAN;
  v_client_id UUID;
  v_submitted_at TIMESTAMPTZ;
  v_recognized BOOLEAN; v_field_class TEXT;
  v_field_json JSONB; v_status TEXT; v_confirmed_by TEXT; v_confirmed_at TIMESTAMPTZ; v_value TEXT;
  v_stripped TEXT;
  v_invitation_email TEXT;
  v_current_text TEXT;
  v_governing_submission_id UUID; v_governing_submitted_at TIMESTAMPTZ;
  v_is_stale BOOLEAN; v_is_self_retry BOOLEAN;
  v_change_id UUID;
  v_stored_value TEXT; -- residual correction: storage-trimmed value, computed once, used ONLY at the storage sites below (v_value itself is left untouched everywhere else -- validation, reference-matching, comparison all continue to operate on the raw submitted value)
BEGIN
  -- STEP 1: gate, fail-closed.
  SELECT enabled INTO v_g1g2_enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g1g2' FOR SHARE;
  IF NOT FOUND THEN outcome := 'GATE_NOT_INITIALIZED'; RETURN NEXT; RETURN; END IF;
  IF NOT v_g1g2_enabled THEN outcome := 'DISABLED'; RETURN NEXT; RETURN; END IF;

  -- STEP 2: CBR-governed field scope (conservative, narrower than cbr_resolve_field — see header note).
  IF p_field_key NOT IN ('email','whatsapp','countryOfResidence','cityOfResidence') THEN
    outcome := 'INVALID_FIELD'; RETURN NEXT; RETURN;
  END IF;
  SELECT recognized, field_class INTO v_recognized, v_field_class FROM cbr_internal.cbr_resolve_field(p_field_key);
  IF NOT COALESCE(v_recognized,false) OR v_field_class NOT IN ('G1','G2') THEN
    outcome := 'INVALID_FIELD'; RETURN NEXT; RETURN;
  END IF;

  -- STEP 3: intake_submissions FOR SHARE (identity + event-time source).
  SELECT client_id, submitted_at INTO v_client_id, v_submitted_at
    FROM public.intake_submissions WHERE id = p_submission_id FOR SHARE;
  IF NOT FOUND OR v_client_id IS NULL THEN outcome := 'MISSING_REFERENCE'; RETURN NEXT; RETURN; END IF;

  -- STEP 4: eligibility (structured_profile confirmation).
  SELECT structured_profile -> p_field_key INTO v_field_json FROM public.intake_submissions WHERE id = p_submission_id;
  v_status := v_field_json ->> 'status';
  v_confirmed_by := v_field_json ->> 'confirmed_by';
  v_confirmed_at := NULLIF(v_field_json ->> 'confirmed_at','')::TIMESTAMPTZ;
  v_value := v_field_json ->> 'value';
  IF v_status IS DISTINCT FROM 'beneficiary_confirmed' OR v_confirmed_by IS NULL OR v_confirmed_at IS NULL
     OR v_confirmed_at > v_submitted_at THEN
    outcome := 'INELIGIBLE'; RETURN NEXT; RETURN;
  END IF;

  -- STEP 5: format validation.
  IF v_value IS NULL OR btrim(v_value) = '' THEN outcome := 'INVALID_VALUE'; RETURN NEXT; RETURN; END IF;
  IF p_field_key = 'email' THEN
    IF v_value !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN outcome := 'INVALID_VALUE'; RETURN NEXT; RETURN; END IF;
  ELSIF p_field_key = 'whatsapp' THEN
    v_stripped := regexp_replace(v_value, '[\s-]', '', 'g');
    IF v_stripped !~ '^\+[1-9]\d{6,14}$' THEN outcome := 'INVALID_VALUE'; RETURN NEXT; RETURN; END IF;
  END IF;

  -- STEP 6: clients FOR UPDATE.
  PERFORM 1 FROM public.clients WHERE id = v_client_id FOR UPDATE;

  -- STEP 7/8: email-specific reference gate.
  IF p_field_key = 'email' THEN
    SELECT ii.email INTO v_invitation_email
      FROM public.intake_submissions s2 JOIN public.intake_invitations ii ON ii.id = s2.invitation_id
      WHERE s2.id = p_submission_id AND s2.invitation_id IS NOT NULL;
    IF NOT FOUND THEN outcome := 'REFERENCE_MISSING'; RETURN NEXT; RETURN; END IF;
    IF NOT cbr_internal.cbr_values_equal('email', v_value, v_invitation_email) THEN
      outcome := 'REFERENCE_MISMATCH'; RETURN NEXT; RETURN;
    END IF;
  END IF;

  -- STEP 9: processing-state STEP A (placeholder) + STEP B (lock).
  INSERT INTO cbr_internal.cbr_field_processing_state (client_id, field_key, governing_submission_id, governing_submitted_at, last_processed_at)
    VALUES (v_client_id, p_field_key, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
  SELECT governing_submission_id, governing_submitted_at INTO v_governing_submission_id, v_governing_submitted_at
    FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client_id AND field_key = p_field_key FOR UPDATE;

  -- STEP 10: integrity check.
  IF v_governing_submission_id IS NULL THEN
    PERFORM 1 FROM public.canonical_beneficiary_records
      WHERE client_id = v_client_id AND field_key = p_field_key AND record_type IN ('CANDIDATE_OBSERVED','CONFLICT_DETECTED','DECISION','CHANGE_REALIZED');
    IF FOUND THEN
      RAISE EXCEPTION 'CBR_INTERNAL_INCONSISTENCY: CBR row exists with NULL-governing processing-state';
    END IF;
  END IF;

  -- STEP 11: replay lookup (CHANGE_REALIZED).
  SELECT id, new_value INTO v_change_id, v_current_text
    FROM public.canonical_beneficiary_records
    WHERE client_id = v_client_id AND field_key = p_field_key AND source_submission_id = p_submission_id
      AND record_type = 'CHANGE_REALIZED';
  IF FOUND THEN outcome := 'REALIZED'; realized_value := v_current_text; RETURN NEXT; RETURN; END IF;

  -- STEP 12: email CONTACT_PROTECTED (replay-miss branch).
  IF p_field_key = 'email' THEN
    SELECT email INTO v_current_text FROM public.clients WHERE id = v_client_id;
    IF v_current_text IS NOT NULL
       AND NOT cbr_internal.cbr_values_equal('email', v_current_text, v_value)
       AND NOT cbr_internal.cbr_values_equal('email', v_current_text, v_invitation_email) THEN
      outcome := 'CONTACT_PROTECTED'; RETURN NEXT; RETURN;
    END IF;
  END IF;

  -- STEP 13: admission window scan.
  IF NOT EXISTS (
    SELECT 1 FROM cbr_internal.cbr_field_admission_window
    WHERE gate = 'g1g2' AND opened_at <= v_submitted_at AND (closed_at IS NULL OR v_submitted_at < closed_at)
  ) THEN
    outcome := 'ADMISSION_BOUNDARY'; RETURN NEXT; RETURN;
  END IF;

  -- STEP 14: ordering / STALE (NULL-safe) + self-retry classification.
  v_is_stale := (v_governing_submission_id IS NOT NULL)
    AND ((v_submitted_at, p_submission_id) < (v_governing_submitted_at, v_governing_submission_id));
  IF v_is_stale THEN outcome := 'STALE'; RETURN NEXT; RETURN; END IF;
  v_is_self_retry := COALESCE(v_governing_submission_id = p_submission_id, FALSE);

  -- STEP 15: read current canonical.
  CASE p_field_key
    WHEN 'email' THEN SELECT email INTO v_current_text FROM public.clients WHERE id = v_client_id;
    WHEN 'whatsapp' THEN SELECT whatsapp INTO v_current_text FROM public.clients WHERE id = v_client_id;
    WHEN 'countryOfResidence' THEN SELECT country_of_residence INTO v_current_text FROM public.clients WHERE id = v_client_id;
    WHEN 'cityOfResidence' THEN SELECT current_city INTO v_current_text FROM public.clients WHERE id = v_client_id;
  END CASE;

  -- STEP 16: action selection. Comparison uses the centralized, field-aware
  -- equality rule (IC Finding 1) -- e.g. email is case-insensitive, whatsapp
  -- ignores whitespace/hyphens -- computed against the raw v_value. What
  -- gets STORED is v_stored_value (see below), trimmed via
  -- cbr_internal.cbr_normalize_for_storage for countryOfResidence/
  -- cityOfResidence specifically (residual correction) -- prior_value
  -- snapshots remain untouched (they copy an already-stored value, not a
  -- new write).
  IF cbr_internal.cbr_values_equal(p_field_key, v_current_text, v_value) THEN
    outcome := 'NO_OP';
  ELSIF v_is_self_retry THEN
    outcome := 'DIVERGED_NO_ACTION';
  ELSE
    -- Residual correction: storage trimming (countryOfResidence/cityOfResidence
    -- here) is applied ONCE, here, at the point of storage -- v_value itself
    -- stays raw for every other use in this function (validation at STEP 5,
    -- the email reference gate, etc.).
    v_stored_value := cbr_internal.cbr_normalize_for_storage(p_field_key, v_value);
    PERFORM cbr_internal.cbr_apply_clients_mutation(v_client_id, p_field_key, v_stored_value);
    INSERT INTO public.canonical_beneficiary_records (
      client_id, record_type, field_key, source_submission_id, origin, prior_value, new_value, authority_basis
    ) VALUES (
      v_client_id, 'CHANGE_REALIZED', p_field_key, p_submission_id,
      v_field_json ->> 'confirmed_from_source', v_current_text, v_stored_value, 'G1_G2_CONFIRMED'
    ) ON CONFLICT DO NOTHING RETURNING id INTO v_change_id;
    IF v_change_id IS NULL THEN
      RAISE EXCEPTION 'CBR_UNRECORDED_MUTATION_CONFLICT: field=%, submission=%', p_field_key, p_submission_id;
    END IF;
    outcome := 'REALIZED'; realized_value := v_stored_value;
  END IF;

  -- STEP F.
  UPDATE cbr_internal.cbr_field_processing_state
    SET governing_submission_id = p_submission_id, governing_submitted_at = v_submitted_at, last_processed_at = clock_timestamp()
    WHERE client_id = v_client_id AND field_key = p_field_key;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.cbr_tx01_realize_g1g2(uuid, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cbr_tx01_realize_g1g2(uuid, text) TO service_role;

-- ────────────────────────────────────────────────────────────────
-- H. TX-02 — cbr_tx02_observe_g3
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cbr_tx02_observe_g3(p_submission_id UUID, p_field_key TEXT)
RETURNS TABLE(outcome TEXT, observation_id UUID)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, cbr_internal, pg_temp AS $$
DECLARE
  v_obs_enabled BOOLEAN; v_staff_enabled BOOLEAN;
  v_client_id UUID; v_submitted_at TIMESTAMPTZ;
  v_recognized BOOLEAN; v_field_class TEXT;
  v_sp_key TEXT; -- structured_profile JSON key, may differ from p_field_key (see STEP 4)
  v_field_json JSONB; v_status TEXT; v_confirmed_by TEXT; v_confirmed_at TIMESTAMPTZ; v_value TEXT;
  v_governing_submission_id UUID; v_governing_submitted_at TIMESTAMPTZ;
  v_candidate_id UUID; v_conflict_count INT;
  v_is_stale BOOLEAN; v_is_self_retry BOOLEAN;
  v_current_text TEXT; v_current_date DATE; v_submitted_date DATE; v_current_value TEXT;
  v_current_count INT; v_prior_candidate_id UUID; v_prior_value TEXT; v_prior_matches BOOLEAN;
  v_new_candidate_id UUID; v_prior_origin TEXT;
  v_pending_decision_id UUID; v_origin_submitted_at TIMESTAMPTZ; v_origin_submission_id UUID;
  v_stored_value TEXT; -- residual correction: storage-trimmed value, used ONLY for the new CANDIDATE_OBSERVED/CONFLICT_DETECTED candidate_value written below -- v_value itself stays raw everywhere else (comparison, prior_value snapshots)
BEGIN
  -- STEP 1: compound gate, fail-closed.
  SELECT enabled INTO v_obs_enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g3_observation' FOR SHARE;
  IF NOT FOUND THEN outcome := 'GATE_NOT_INITIALIZED'; RETURN NEXT; RETURN; END IF;
  SELECT enabled INTO v_staff_enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g3_staff_resolution' FOR SHARE;
  IF NOT FOUND THEN outcome := 'GATE_NOT_INITIALIZED'; RETURN NEXT; RETURN; END IF;
  IF NOT (v_obs_enabled AND v_staff_enabled) THEN outcome := 'DISABLED'; RETURN NEXT; RETURN; END IF;

  -- STEP 2: CBR-governed field scope (conservative allow-list).
  IF p_field_key NOT IN ('middleName','dateOfBirth','firstName','lastName') THEN
    outcome := 'INVALID_FIELD'; RETURN NEXT; RETURN;
  END IF;
  SELECT recognized, field_class INTO v_recognized, v_field_class FROM cbr_internal.cbr_resolve_field(p_field_key);
  IF NOT COALESCE(v_recognized,false) OR v_field_class IS DISTINCT FROM 'G3' THEN
    outcome := 'INVALID_FIELD'; RETURN NEXT; RETURN;
  END IF;

  -- STEP 3: intake_submissions FOR SHARE.
  SELECT client_id, submitted_at INTO v_client_id, v_submitted_at
    FROM public.intake_submissions WHERE id = p_submission_id FOR SHARE;
  IF NOT FOUND OR v_client_id IS NULL THEN outcome := 'MISSING_REFERENCE'; RETURN NEXT; RETURN; END IF;

  -- STEP 4: eligibility.
  -- src/lib/intake/structured-profile.ts IDENTITY_FIELDS uses `givenName`/`familyName`,
  -- not `firstName`/`lastName` — CBR's field_key vocabulary renamed these two (established
  -- design lineage); every other CBR field_key matches the StructuredProfile JSON key
  -- directly. Confirmed by direct inspection of structured-profile.ts this session.
  v_sp_key := CASE p_field_key WHEN 'firstName' THEN 'givenName' WHEN 'lastName' THEN 'familyName' ELSE p_field_key END;
  SELECT structured_profile -> v_sp_key INTO v_field_json FROM public.intake_submissions WHERE id = p_submission_id;
  v_status := v_field_json ->> 'status';
  v_confirmed_by := v_field_json ->> 'confirmed_by';
  v_confirmed_at := NULLIF(v_field_json ->> 'confirmed_at','')::TIMESTAMPTZ;
  v_value := v_field_json ->> 'value';
  IF v_status IS DISTINCT FROM 'beneficiary_confirmed' OR v_confirmed_by IS NULL OR v_confirmed_at IS NULL
     OR v_confirmed_at > v_submitted_at THEN
    outcome := 'INELIGIBLE'; RETURN NEXT; RETURN;
  END IF;

  -- STEP 5: format/calendar validation.
  IF v_value IS NULL OR btrim(v_value) = '' THEN outcome := 'INVALID_VALUE'; RETURN NEXT; RETURN; END IF;
  IF p_field_key = 'dateOfBirth' THEN
    IF v_value !~ '^\d{4}-\d{2}-\d{2}$' THEN outcome := 'INVALID_VALUE'; RETURN NEXT; RETURN; END IF;
    BEGIN
      v_submitted_date := v_value::DATE;
    EXCEPTION
      WHEN datetime_field_overflow THEN outcome := 'INVALID_VALUE'; RETURN NEXT; RETURN;
      WHEN invalid_datetime_format THEN outcome := 'INVALID_VALUE'; RETURN NEXT; RETURN;
    END;
  END IF;

  -- STEP 6: clients FOR UPDATE.
  PERFORM 1 FROM public.clients WHERE id = v_client_id FOR UPDATE;

  -- STEP 7: processing-state STEP A + STEP B.
  INSERT INTO cbr_internal.cbr_field_processing_state (client_id, field_key, governing_submission_id, governing_submitted_at, last_processed_at)
    VALUES (v_client_id, p_field_key, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
  SELECT governing_submission_id, governing_submitted_at INTO v_governing_submission_id, v_governing_submitted_at
    FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client_id AND field_key = p_field_key FOR UPDATE;

  -- STEP 8: integrity check.
  IF v_governing_submission_id IS NULL THEN
    PERFORM 1 FROM public.canonical_beneficiary_records
      WHERE client_id = v_client_id AND field_key = p_field_key AND record_type IN ('CANDIDATE_OBSERVED','CONFLICT_DETECTED','DECISION','CHANGE_REALIZED');
    IF FOUND THEN
      RAISE EXCEPTION 'CBR_INTERNAL_INCONSISTENCY: CBR row exists with NULL-governing processing-state';
    END IF;
  END IF;

  -- STEP 9: replay lookup (CANDIDATE_OBSERVED, submission-keyed).
  SELECT id INTO v_candidate_id FROM public.canonical_beneficiary_records
    WHERE client_id = v_client_id AND field_key = p_field_key AND source_submission_id = p_submission_id
      AND record_type = 'CANDIDATE_OBSERVED';
  IF FOUND THEN
    SELECT count(*) INTO v_conflict_count FROM public.canonical_beneficiary_records
      WHERE record_type = 'CONFLICT_DETECTED' AND related_candidate_id = v_candidate_id;
    IF v_conflict_count = 0 THEN
      outcome := 'OBSERVED'; observation_id := v_candidate_id;
    ELSIF v_conflict_count = 1 THEN
      outcome := 'CONFLICT'; observation_id := v_candidate_id;
    ELSE
      RAISE EXCEPTION 'CBR_INTERNAL_INCONSISTENCY: multiple CONFLICT_DETECTED rows for one candidate';
    END IF;
    RETURN NEXT; RETURN;
  END IF;

  -- STEP 10: admission window scan.
  IF NOT EXISTS (
    SELECT 1 FROM cbr_internal.cbr_field_admission_window
    WHERE gate = 'g3_observation' AND opened_at <= v_submitted_at AND (closed_at IS NULL OR v_submitted_at < closed_at)
  ) THEN
    outcome := 'ADMISSION_BOUNDARY'; RETURN NEXT; RETURN;
  END IF;

  -- STEP 11: ordering/STALE + self-retry.
  v_is_stale := (v_governing_submission_id IS NOT NULL)
    AND ((v_submitted_at, p_submission_id) < (v_governing_submitted_at, v_governing_submission_id));
  IF v_is_stale THEN outcome := 'STALE'; RETURN NEXT; RETURN; END IF;
  v_is_self_retry := COALESCE(v_governing_submission_id = p_submission_id, FALSE);

  -- STEP 12: read canonical (normalized to ONE v_current_value TEXT regardless of field
  -- type -- IC Finding 1) + pre-existing CURRENT candidates.
  IF p_field_key = 'dateOfBirth' THEN
    SELECT date_of_birth INTO v_current_date FROM public.clients WHERE id = v_client_id;
    v_current_value := v_current_date::TEXT;
  ELSIF p_field_key = 'middleName' THEN
    SELECT middle_name INTO v_current_text FROM public.clients WHERE id = v_client_id; v_current_value := v_current_text;
  ELSIF p_field_key = 'firstName' THEN
    SELECT first_name INTO v_current_text FROM public.clients WHERE id = v_client_id; v_current_value := v_current_text;
  ELSIF p_field_key = 'lastName' THEN
    SELECT last_name INTO v_current_text FROM public.clients WHERE id = v_client_id; v_current_value := v_current_text;
  END IF;

  SELECT count(*) INTO v_current_count
    FROM public.canonical_beneficiary_records co
    JOIN public.intake_submissions s2 ON s2.id = co.source_submission_id
    WHERE co.client_id = v_client_id AND co.field_key = p_field_key AND co.record_type = 'CANDIDATE_OBSERVED'
      AND (s2.submitted_at, s2.id) >= (v_governing_submitted_at, v_governing_submission_id);
  IF v_current_count > 1 THEN
    RAISE EXCEPTION 'CBR_MULTIPLE_CURRENT_CANDIDATES';
  END IF;
  IF v_current_count = 1 THEN
    SELECT co.id, co.candidate_value, co.origin INTO v_prior_candidate_id, v_prior_value, v_prior_origin
      FROM public.canonical_beneficiary_records co
      JOIN public.intake_submissions s2 ON s2.id = co.source_submission_id
      WHERE co.client_id = v_client_id AND co.field_key = p_field_key AND co.record_type = 'CANDIDATE_OBSERVED'
        AND (s2.submitted_at, s2.id) >= (v_governing_submitted_at, v_governing_submission_id);
  END IF;

  -- STEP 13: action table (§G, 5 branches). All equality tests use the centralized,
  -- field-aware comparison (IC Finding 1) against the raw v_value. Residual
  -- correction: what gets WRITTEN as a new candidate_value below is
  -- v_stored_value (storage-trimmed via cbr_internal.cbr_normalize_for_storage),
  -- computed once here -- prior_value snapshots (v_current_value/v_prior_value)
  -- are copies of already-stored values, not new writes, so they are left as-is.
  v_prior_matches := cbr_internal.cbr_values_equal(p_field_key, v_prior_value, v_value);
  v_stored_value := cbr_internal.cbr_normalize_for_storage(p_field_key, v_value);

  IF v_current_value IS NOT NULL AND cbr_internal.cbr_values_equal(p_field_key, v_current_value, v_value) THEN
    outcome := 'NO_OP';
  ELSIF v_current_value IS NOT NULL THEN
    -- canonical present, differs (branch 2). CONFLICT_DETECTED.origin = the new candidate's
    -- own origin (IC Finding 2) -- the conflict describes THIS observation's provenance,
    -- paired against canonical (which is not itself a CBR row and carries no origin of
    -- its own to copy).
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, origin, candidate_value)
      VALUES (v_client_id, 'CANDIDATE_OBSERVED', p_field_key, p_submission_id, v_field_json ->> 'confirmed_from_source', v_stored_value)
      RETURNING id INTO v_new_candidate_id;
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, origin, candidate_value, prior_value, related_candidate_id)
      VALUES (v_client_id, 'CONFLICT_DETECTED', p_field_key, p_submission_id, v_field_json ->> 'confirmed_from_source',
        v_stored_value, v_current_value, v_new_candidate_id);
    outcome := 'CONFLICT'; observation_id := v_new_candidate_id;
  ELSIF v_current_count = 0 THEN
    -- canonical absent, no prior CURRENT candidate (branch 3)
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, origin, candidate_value)
      VALUES (v_client_id, 'CANDIDATE_OBSERVED', p_field_key, p_submission_id, v_field_json ->> 'confirmed_from_source', v_stored_value)
      RETURNING id INTO v_new_candidate_id;
    outcome := 'OBSERVED'; observation_id := v_new_candidate_id;
  ELSIF v_prior_matches THEN
    -- canonical absent, prior CURRENT candidate equal (branch 4)
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, origin, candidate_value)
      VALUES (v_client_id, 'CANDIDATE_OBSERVED', p_field_key, p_submission_id, v_field_json ->> 'confirmed_from_source', v_stored_value)
      RETURNING id INTO v_new_candidate_id;
    outcome := 'OBSERVED'; observation_id := v_new_candidate_id;
  ELSE
    -- canonical absent, prior CURRENT candidate differs (branch 5). CONFLICT_DETECTED.origin
    -- = the NEW candidate's own origin (IC Finding 2), consistent with branch 2 -- always the
    -- provenance of the observation being recorded, never re-derived from the differing prior.
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, origin, candidate_value)
      VALUES (v_client_id, 'CANDIDATE_OBSERVED', p_field_key, p_submission_id, v_field_json ->> 'confirmed_from_source', v_stored_value)
      RETURNING id INTO v_new_candidate_id;
    INSERT INTO public.canonical_beneficiary_records (client_id, record_type, field_key, source_submission_id, origin, candidate_value, prior_value, related_candidate_id)
      VALUES (v_client_id, 'CONFLICT_DETECTED', p_field_key, p_submission_id, v_field_json ->> 'confirmed_from_source',
        v_stored_value, v_prior_value, v_new_candidate_id);
    outcome := 'CONFLICT'; observation_id := v_new_candidate_id;
  END IF;

  -- STEP 14: strictly-newer supersession, conditional.
  SELECT d.id, s3.submitted_at, s3.id INTO v_pending_decision_id, v_origin_submitted_at, v_origin_submission_id
    FROM public.canonical_beneficiary_records d
    JOIN public.canonical_beneficiary_records co ON co.id = d.source_observation_id
    JOIN public.intake_submissions s3 ON s3.id = co.source_submission_id
    WHERE d.client_id = v_client_id AND d.field_key = p_field_key AND d.decision_state = 'pending'
    FOR UPDATE OF d;
  IF FOUND THEN
    IF (v_origin_submitted_at, v_origin_submission_id) < (v_submitted_at, p_submission_id) THEN
      UPDATE public.canonical_beneficiary_records
        SET decision_state = 'superseded', reviewed_at = now(), superseded_by_submission_id = p_submission_id,
            decision_reason = 'SUPERSEDED_BY_NEWER_SUBMISSION'
        WHERE id = v_pending_decision_id;
    ELSE
      RAISE EXCEPTION 'CBR_INTERNAL_INCONSISTENCY: pending decision origin not strictly older than incoming event';
    END IF;
  END IF;

  -- STEP 15: tracking advance.
  UPDATE cbr_internal.cbr_field_processing_state
    SET governing_submission_id = p_submission_id, governing_submitted_at = v_submitted_at, last_processed_at = clock_timestamp()
    WHERE client_id = v_client_id AND field_key = p_field_key;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.cbr_tx02_observe_g3(uuid, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cbr_tx02_observe_g3(uuid, text) TO service_role;

-- ────────────────────────────────────────────────────────────────
-- I. TX-03 — cbr_tx03_open_g3_review
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cbr_tx03_open_g3_review(p_observation_id UUID, p_actor_id UUID)
RETURNS TABLE(outcome TEXT, decision_id UUID)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, cbr_internal, pg_temp AS $$
DECLARE
  v_staff_enabled BOOLEAN;
  v_client_id UUID; v_field_key TEXT; v_record_type TEXT; v_candidate_value TEXT; v_source_submission_id UUID;
  v_observation_origin TEXT;
  v_role TEXT; v_assigned_agent_id UUID;
  v_governing_submission_id UUID; v_governing_submitted_at TIMESTAMPTZ;
  v_current BOOLEAN;
  v_current_canonical TEXT;
  v_new_decision_id UUID;
BEGIN
  SELECT enabled INTO v_staff_enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g3_staff_resolution' FOR SHARE;
  IF NOT FOUND THEN outcome := 'GATE_NOT_INITIALIZED'; RETURN NEXT; RETURN; END IF;
  IF NOT v_staff_enabled THEN outcome := 'DISABLED'; RETURN NEXT; RETURN; END IF;

  -- IC Finding 2: origin is read here and copied verbatim onto the DECISION below --
  -- never independently re-derived from the submission.
  SELECT client_id, field_key, record_type, candidate_value, source_submission_id, origin
    INTO v_client_id, v_field_key, v_record_type, v_candidate_value, v_source_submission_id, v_observation_origin
    FROM public.canonical_beneficiary_records WHERE id = p_observation_id;
  IF NOT FOUND OR v_record_type IS DISTINCT FROM 'CANDIDATE_OBSERVED' THEN
    outcome := 'MISSING_REFERENCE'; RETURN NEXT; RETURN;
  END IF;

  PERFORM 1 FROM public.clients WHERE id = v_client_id FOR UPDATE;
  SELECT role INTO v_role FROM public.profiles WHERE id = p_actor_id FOR SHARE;
  SELECT assigned_agent_id INTO v_assigned_agent_id FROM public.clients WHERE id = v_client_id;
  IF v_role IS NULL OR (v_role NOT IN ('admin','supervisor') AND p_actor_id IS DISTINCT FROM v_assigned_agent_id) THEN
    outcome := 'UNAUTHORIZED'; RETURN NEXT; RETURN;
  END IF;

  SELECT governing_submission_id, governing_submitted_at INTO v_governing_submission_id, v_governing_submitted_at
    FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client_id AND field_key = v_field_key FOR SHARE;

  PERFORM 1 FROM public.intake_submissions WHERE id = v_source_submission_id;
  SELECT (s.submitted_at, s.id) >= (v_governing_submitted_at, v_governing_submission_id) INTO v_current
    FROM public.intake_submissions s WHERE s.id = v_source_submission_id;

  IF NOT COALESCE(v_current, false) THEN outcome := 'NOT_OPENABLE'; RETURN NEXT; RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.canonical_beneficiary_records
             WHERE client_id = v_client_id AND field_key = v_field_key AND record_type = 'DECISION' AND decision_state = 'pending') THEN
    outcome := 'ALREADY_PENDING'; RETURN NEXT; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.canonical_beneficiary_records
             WHERE record_type = 'DECISION' AND source_observation_id = p_observation_id AND decision_state IN ('approved','rejected')) THEN
    outcome := 'NOT_OPENABLE'; RETURN NEXT; RETURN;
  END IF;

  -- STEP 8: read (already-copied) candidate value + current canonical snapshot.
  IF v_field_key = 'dateOfBirth' THEN
    SELECT date_of_birth::TEXT INTO v_current_canonical FROM public.clients WHERE id = v_client_id;
  ELSIF v_field_key = 'middleName' THEN
    SELECT middle_name INTO v_current_canonical FROM public.clients WHERE id = v_client_id;
  ELSIF v_field_key = 'firstName' THEN
    SELECT first_name INTO v_current_canonical FROM public.clients WHERE id = v_client_id;
  ELSIF v_field_key = 'lastName' THEN
    SELECT last_name INTO v_current_canonical FROM public.clients WHERE id = v_client_id;
  END IF;

  INSERT INTO public.canonical_beneficiary_records (
    client_id, record_type, field_key, source_observation_id, origin, candidate_value, decision_state, expected_prior_value
  ) VALUES (
    v_client_id, 'DECISION', v_field_key, p_observation_id, v_observation_origin, v_candidate_value, 'pending', v_current_canonical
  ) RETURNING id INTO v_new_decision_id;

  outcome := 'OPENED'; decision_id := v_new_decision_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.cbr_tx03_open_g3_review(uuid, uuid) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cbr_tx03_open_g3_review(uuid, uuid) TO service_role;

-- ────────────────────────────────────────────────────────────────
-- J. TX-04 — cbr_tx04_approve_g3
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cbr_tx04_approve_g3(p_decision_id UUID, p_actor_id UUID, p_expected_prior_value TEXT)
RETURNS TABLE(outcome TEXT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, cbr_internal, pg_temp AS $$
DECLARE
  v_staff_enabled BOOLEAN;
  v_client_id_lookup UUID; v_field_key_lookup TEXT;
  v_client_id UUID; v_field_key TEXT;
  v_role TEXT; v_assigned_agent_id UUID;
  v_decision_state TEXT; v_candidate_value TEXT; v_source_observation_id UUID;
  v_current BOOLEAN;
  v_recognized BOOLEAN; v_field_class TEXT;
  v_current_value TEXT; -- unified TEXT representation of current canonical, any field type (IC Finding 1)
  v_observation_value TEXT;
  v_new_change_id UUID;
  v_governing_submission_id UUID; v_governing_submitted_at TIMESTAMPTZ;
BEGIN
  -- STEP 1: gate.
  SELECT enabled INTO v_staff_enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g3_staff_resolution' FOR SHARE;
  IF NOT FOUND THEN outcome := 'GATE_NOT_INITIALIZED'; RETURN NEXT; RETURN; END IF;
  IF NOT v_staff_enabled THEN outcome := 'DISABLED'; RETURN NEXT; RETURN; END IF;

  -- STEP 2: discovery-only unlocked lookup.
  SELECT client_id, field_key INTO v_client_id_lookup, v_field_key_lookup
    FROM public.canonical_beneficiary_records WHERE id = p_decision_id AND record_type = 'DECISION';
  IF NOT FOUND THEN outcome := 'MISSING_REFERENCE'; RETURN NEXT; RETURN; END IF;

  -- STEP 3(a-d): established lock order.
  PERFORM 1 FROM public.clients WHERE id = v_client_id_lookup FOR UPDATE;
  PERFORM 1 FROM public.profiles WHERE id = p_actor_id FOR SHARE;
  PERFORM 1 FROM cbr_internal.cbr_field_processing_state
    WHERE client_id = v_client_id_lookup AND field_key = v_field_key_lookup FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CBR_INTERNAL_INCONSISTENCY: processing-state row missing for an existing DECISION''s (client_id, field_key)';
  END IF;
  SELECT client_id, field_key INTO v_client_id, v_field_key
    FROM public.canonical_beneficiary_records WHERE id = p_decision_id AND record_type = 'DECISION' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CBR_INTERNAL_INCONSISTENCY: DECISION row not found under lock despite passing the earlier unlocked lookup';
  END IF;

  -- STEP 4: lock-target consistency check.
  IF v_client_id IS DISTINCT FROM v_client_id_lookup OR v_field_key IS DISTINCT FROM v_field_key_lookup THEN
    RAISE EXCEPTION 'CBR_INTERNAL_INCONSISTENCY: DECISION lock-target mismatch';
  END IF;

  -- STEP 5: Layer-2 authority.
  SELECT role INTO v_role FROM public.profiles WHERE id = p_actor_id;
  SELECT assigned_agent_id INTO v_assigned_agent_id FROM public.clients WHERE id = v_client_id;
  IF v_role IS NULL OR (v_role NOT IN ('admin','supervisor') AND p_actor_id IS DISTINCT FROM v_assigned_agent_id) THEN
    outcome := 'UNAUTHORIZED'; RETURN NEXT; RETURN;
  END IF;

  -- STEP 6: pending check.
  SELECT decision_state, candidate_value, source_observation_id INTO v_decision_state, v_candidate_value, v_source_observation_id
    FROM public.canonical_beneficiary_records WHERE id = p_decision_id;
  IF v_decision_state IS DISTINCT FROM 'pending' THEN outcome := 'ALREADY_RESOLVED'; RETURN NEXT; RETURN; END IF;

  -- STEP 7: RESOLVABLE.
  SELECT governing_submission_id, governing_submitted_at INTO v_governing_submission_id, v_governing_submitted_at
    FROM cbr_internal.cbr_field_processing_state WHERE client_id = v_client_id AND field_key = v_field_key;
  SELECT (s.submitted_at, s.id) >= (v_governing_submitted_at, v_governing_submission_id) INTO v_current
    FROM public.canonical_beneficiary_records co JOIN public.intake_submissions s ON s.id = co.source_submission_id
    WHERE co.id = v_source_observation_id;
  IF NOT COALESCE(v_current, false) THEN outcome := 'STALE_REVIEW'; RETURN NEXT; RETURN; END IF;

  -- STEP 8a: field recognition.
  SELECT recognized, field_class INTO v_recognized, v_field_class FROM cbr_internal.cbr_resolve_field(v_field_key);
  IF NOT COALESCE(v_recognized, false) OR v_field_class IS DISTINCT FROM 'G3'
     OR v_field_key NOT IN ('middleName','dateOfBirth','firstName','lastName') THEN
    RAISE EXCEPTION 'CBR_INTERNAL_INCONSISTENCY: DECISION references a non-G3 or unrecognized field_key';
  END IF;

  -- STEP 8b: validate the FORMAT of the expected value (dateOfBirth only -- unchanged
  -- validation logic: the supplied string must match exactly YYYY-MM-DD, zero-padded,
  -- no time component -- see the regex immediately below), then read current canonical
  -- into ONE unified v_current_value TEXT.
  -- IC Targeted Correction 2 (§H.2): the STALE_PRIOR_VALUE comparison below is field-specific,
  -- NOT the centralized cbr_values_equal() rule -- that rule's TRIMMING for name fields
  -- (middleName/firstName/lastName: trimmed, case-SENSITIVE -- it never case-folds these;
  -- case-folding is applied only to email and cityOfResidence, neither of which reaches this
  -- function) is approved for comparison sites that decide whether two ACQUIRED values agree
  -- (STEP 10 below; TX-01/TX-02), but applying it HERE would silently tolerate a
  -- whitespace difference between the canonical value most recently displayed to the
  -- reviewer (p_expected_prior_value -- not necessarily captured at the moment the review
  -- was originally opened; the caller may re-display and resupply a refreshed value) and
  -- what is canonical NOW, weakening the approved stale-value protection. The reviewer's
  -- expectation is NEVER replaced with a fresh server read here -- p_expected_prior_value
  -- is compared as supplied, never substituted. DECISION.expected_prior_value is a
  -- SEPARATE, distinct value: the immutable snapshot captured once, specifically at
  -- TX-03's own open-time, and it is never read as this comparison's operand either.
  IF v_field_key = 'dateOfBirth' AND p_expected_prior_value IS NOT NULL THEN
    IF p_expected_prior_value !~ '^\d{4}-\d{2}-\d{2}$' THEN -- exactly YYYY-MM-DD
      outcome := 'INVALID_EXPECTED_VALUE'; RETURN NEXT; RETURN;
    END IF;
    BEGIN
      PERFORM p_expected_prior_value::DATE; -- format/calendar validation only; result discarded,
        -- the actual comparison below goes through cbr_values_equal for a single source of truth
    EXCEPTION
      WHEN datetime_field_overflow THEN outcome := 'INVALID_EXPECTED_VALUE'; RETURN NEXT; RETURN;
      WHEN invalid_datetime_format THEN outcome := 'INVALID_EXPECTED_VALUE'; RETURN NEXT; RETURN;
    END;
  END IF;

  IF v_field_key = 'dateOfBirth' THEN
    SELECT date_of_birth::TEXT INTO v_current_value FROM public.clients WHERE id = v_client_id;
  ELSIF v_field_key = 'middleName' THEN
    SELECT middle_name INTO v_current_value FROM public.clients WHERE id = v_client_id;
  ELSIF v_field_key = 'firstName' THEN
    SELECT first_name INTO v_current_value FROM public.clients WHERE id = v_client_id;
  ELSIF v_field_key = 'lastName' THEN
    SELECT last_name INTO v_current_value FROM public.clients WHERE id = v_client_id;
  END IF;

  IF v_field_key = 'dateOfBirth' THEN
    -- Typed DATE comparison, NULL-safe (both NULL -> equal, exactly one NULL -> not equal),
    -- via the centralized rule -- unchanged from before this correction.
    IF NOT cbr_internal.cbr_values_equal(v_field_key, p_expected_prior_value, v_current_value) THEN
      outcome := 'STALE_PRIOR_VALUE'; RETURN NEXT; RETURN;
    END IF;
  ELSE
    -- middleName/firstName/lastName: exact TEXT comparison against the locked canonical
    -- value, via IS DISTINCT FROM -- NO trimming, NO case-folding, NO other normalization.
    -- A whitespace-only or casing-only mismatch between what the reviewer saw and what is
    -- canonical now MUST surface as STALE_PRIOR_VALUE, restoring the approved distinction
    -- this comparison lost when it was folded into cbr_values_equal().
    IF p_expected_prior_value IS DISTINCT FROM v_current_value THEN
      outcome := 'STALE_PRIOR_VALUE'; RETURN NEXT; RETURN;
    END IF;
  END IF;

  -- STEP 9: defensive value-binding re-check.
  SELECT candidate_value INTO v_observation_value FROM public.canonical_beneficiary_records WHERE id = v_source_observation_id;
  IF v_observation_value IS DISTINCT FROM v_candidate_value THEN
    RAISE EXCEPTION 'CBR_DECISION_VALUE_MISMATCH';
  END IF;

  -- STEP 10: equality-before-mutation, via the same centralized comparison (IC Finding 1).
  -- The CHANGE_REALIZED audit row's prior_value/new_value continue to store the exact,
  -- non-normalized canonical/candidate text -- only the EQUALITY TEST is centralized.
  IF cbr_internal.cbr_values_equal(v_field_key, v_current_value, v_candidate_value) THEN
    NULL; -- equal, skip mutation
  ELSE
    PERFORM cbr_internal.cbr_apply_clients_mutation(v_client_id, v_field_key, v_candidate_value);
    INSERT INTO public.canonical_beneficiary_records (
      client_id, record_type, field_key, source_submission_id, origin, prior_value, new_value, authority_basis, related_decision_id
    )
    SELECT v_client_id, 'CHANGE_REALIZED', v_field_key, co.source_submission_id, co.origin,
           v_current_value, v_candidate_value, 'G3_STAFF_APPROVED', p_decision_id
    FROM public.canonical_beneficiary_records co WHERE co.id = v_source_observation_id
    ON CONFLICT DO NOTHING RETURNING id INTO v_new_change_id;
    IF v_new_change_id IS NULL THEN
      RAISE EXCEPTION 'CBR_UNRECORDED_MUTATION_CONFLICT: decision=%', p_decision_id;
    END IF;
  END IF;

  -- STEP 11: terminal transition.
  UPDATE public.canonical_beneficiary_records SET decision_state = 'approved', reviewed_by = p_actor_id, reviewed_at = now()
    WHERE id = p_decision_id;

  -- STEP 12: processing-state advance (from source_observation_id's own submission).
  UPDATE cbr_internal.cbr_field_processing_state pcs
    SET governing_submission_id = co.source_submission_id, governing_submitted_at = s.submitted_at, last_processed_at = clock_timestamp()
    FROM public.canonical_beneficiary_records co JOIN public.intake_submissions s ON s.id = co.source_submission_id
    WHERE co.id = v_source_observation_id AND pcs.client_id = v_client_id AND pcs.field_key = v_field_key;

  outcome := 'APPROVED';
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.cbr_tx04_approve_g3(uuid, uuid, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cbr_tx04_approve_g3(uuid, uuid, text) TO service_role;

-- ────────────────────────────────────────────────────────────────
-- K. TX-05 — cbr_tx05_reject_g3
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cbr_tx05_reject_g3(p_decision_id UUID, p_actor_id UUID, p_reason TEXT)
RETURNS TABLE(outcome TEXT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, cbr_internal, pg_temp AS $$
DECLARE
  v_staff_enabled BOOLEAN;
  v_client_id UUID; v_decision_state TEXT;
  v_role TEXT; v_assigned_agent_id UUID;
BEGIN
  SELECT enabled INTO v_staff_enabled FROM cbr_internal.cbr_field_gate_state WHERE gate='g3_staff_resolution' FOR SHARE;
  IF NOT FOUND THEN outcome := 'GATE_NOT_INITIALIZED'; RETURN NEXT; RETURN; END IF;
  IF NOT v_staff_enabled THEN outcome := 'DISABLED'; RETURN NEXT; RETURN; END IF;

  SELECT client_id INTO v_client_id FROM public.canonical_beneficiary_records WHERE id = p_decision_id AND record_type = 'DECISION';
  IF NOT FOUND THEN outcome := 'MISSING_REFERENCE'; RETURN NEXT; RETURN; END IF;

  PERFORM 1 FROM public.clients WHERE id = v_client_id FOR UPDATE;
  SELECT role INTO v_role FROM public.profiles WHERE id = p_actor_id FOR SHARE;
  PERFORM 1 FROM public.canonical_beneficiary_records WHERE id = p_decision_id FOR UPDATE;

  SELECT assigned_agent_id INTO v_assigned_agent_id FROM public.clients WHERE id = v_client_id;
  IF v_role IS NULL OR (v_role NOT IN ('admin','supervisor') AND p_actor_id IS DISTINCT FROM v_assigned_agent_id) THEN
    outcome := 'UNAUTHORIZED'; RETURN NEXT; RETURN;
  END IF;

  SELECT decision_state INTO v_decision_state FROM public.canonical_beneficiary_records WHERE id = p_decision_id;
  IF v_decision_state IS DISTINCT FROM 'pending' THEN outcome := 'ALREADY_RESOLVED'; RETURN NEXT; RETURN; END IF;

  UPDATE public.canonical_beneficiary_records
    SET decision_state = 'rejected', reviewed_by = p_actor_id, reviewed_at = now(), decision_reason = p_reason
    WHERE id = p_decision_id;

  outcome := 'REJECTED';
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.cbr_tx05_reject_g3(uuid, uuid, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cbr_tx05_reject_g3(uuid, uuid, text) TO service_role;

-- ────────────────────────────────────────────────────────────────
-- L. cbr_review_surface_governing_state — read-only §J support
-- ────────────────────────────────────────────────────────────────
-- IC Finding 4: the staff review surface (application/api/cbr/pending-reviews)
-- must reproduce CURRENT correctly, which requires cbr_internal.cbr_field_processing_state
-- -- a schema never exposed via PostgREST (by design, unchanged). This is the
-- one, narrowly-scoped, read-only public function that exposes exactly the
-- governing-tuple data the review surface needs (per client, all CBR-governed
-- fields at once) -- it performs no mutation, no authorization decision, and
-- exposes nothing beyond what §J's own display requirements call for. It
-- does not replace TX-03's own authoritative OPENABLE re-check at open time.
CREATE OR REPLACE FUNCTION public.cbr_review_surface_governing_state(p_client_id UUID)
RETURNS TABLE(field_key TEXT, governing_submission_id UUID, governing_submitted_at TIMESTAMPTZ)
LANGUAGE sql SECURITY INVOKER SET search_path = public, cbr_internal, pg_temp AS $$
  SELECT pcs.field_key, pcs.governing_submission_id, pcs.governing_submitted_at
  FROM cbr_internal.cbr_field_processing_state pcs
  WHERE pcs.client_id = p_client_id;
$$;

REVOKE ALL ON FUNCTION public.cbr_review_surface_governing_state(uuid) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cbr_review_surface_governing_state(uuid) TO service_role;

COMMIT;
