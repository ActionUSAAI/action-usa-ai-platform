# QA Engine — FINAL EXACT DESIGN

## 1. Identification

```
MCS:                   QA Engine
Identifier:            NOT ESTABLISHED (no act-specific Project Owner
                        grant exists; see MTCS-06/07/08 precedent)
Materialized by:       QA Engine — MCS Materialization / Design-Entry
                        Gate, commit d06c007
Governing CPS:         docs/CANONICAL_PROJECT_STATE.md
Status of this document: FINAL EXACT DESIGN — TARGETED PROVENANCE
                        RECONCILIATION INCORPORATED (§9a)
Prior SHA256 (superseded): 6df478e9d19dbd621d333f11664fc6830c1fbdf72b210bba1e8c0ef39baf48df
Superseded by:          Targeted Provenance Reconciliation (CR-01, CR-02) —
                        commit 3f6ad03 was the prior frozen artifact;
                        this revision supersedes it in place, historical
                        SHA preserved above.
Implementation status: NOT AUTHORIZED
```

## 2. Governing Sources

FROZEN, in order of specificity:
- `docs/AUCIS_IMPLEMENTATION_ROADMAP_PHASE_2.md` (Congelado, aprobado 2026-07-29) — Capacidad 5: bounded MVP Definition of Done, explicit scope-creep guard. **Controlling for MVP scope.**
- `docs/governance/level-4-contracts/blueprint-contract.md` (level 4, Frozen) — read-only permission matrix; RFE-reads-only-after-QA.
- `docs/AUCIS_CRITERION_ASSESSMENT_CONTRACT_V1.md` (Frozen, Stage 0) — Blueprint↔Criterion-Assessment currency relationship.
- `docs/AUCIS_PLATFORM_ARCHITECTURE.md` (Congelado v1, 2026-07-28) — Validation Layer purpose, inputs, no-auto-correction, dependency boundary.
- `docs/AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md` (Congelado v1, 2026-07-28) — Generated Document consumer relationship.

CURRENT DESIGN (non-controlling for MVP, future-scope color only):
- `docs/AUCIS_V2_STRATEGY_LAYER.md` — six-check broader vision, sequencing.

Repository substrate inspected directly: `supabase/migrations/017_case_strategy.sql`, `019_case_strategy_versioning.sql`, `023_case_strategy_currency_status.sql`, `020_agent_intake_analysis_status.sql`, `002_aucis_agents.sql`, `010_extend_agent_recommendation_letters.sql`, `012_extend_agent_petition_drafts.sql`, `016_i129_form_drafts.sql`, `006_rls_agent_tables_staff_access.sql`, `src/lib/auth/authorize-case-staff.ts`.

## 3. Frozen MVP Scope — Revised From Materialization

Materialization (CR-CPS-13) identified three candidate MVP responsibilities. Deeper source and repository reading during this Final Exact Design narrows the true, bounded Definition of Done to **two**, per the Roadmap's own explicit language: *"Scope creep en QA Engine → Definition of Done estrictamente acotada al MVP de cobertura de criterios."*

```
DECISION: narrow QA-MVP-02 ("general Blueprint fidelity," from Platform
Architecture's broader purpose statement) OUT of this MVP.
CLASS: SD-02 (source-constrained design choice)
SOURCE: AUCIS_IMPLEMENTATION_ROADMAP_PHASE_2.md's Definition of Done is
  the more specific, later-dated, MVP-scoped source; its own explicit
  purpose is preventing exactly this kind of inclusion.
RATIONALE: Platform Architecture describes the Validation Layer's full
  future capability; the Roadmap describes what actually ships as MVP.
  Treating them as co-equal would violate the explicit scope-creep
  guard.
REJECTED ALTERNATIVE: include general narrative/argument-sequence
  fidelity checking now — would require model-assisted reasoning with
  no bounded acceptance test, directly contradicting "estrictamente
  acotada."
ARCHITECTURAL EFFECT: none — general Blueprint fidelity remains a real,
  sourced, FUTURE Validation Layer responsibility, explicitly deferred,
  not discarded.
```

**Final bounded MVP:**

```
QA-MVP-01 — Criterion Documentary Coverage
  For the case's CURRENT Case Blueprint (case_strategy.currency_status
  = 'current'), verify that every criterion key listed in
  dominant_criteria and supporting_criteria has coverage in the
  case's current Generated Documents.

QA-MVP-02 — Blueprint Currency Precondition
  Verify a current Case Blueprint exists for the case at all
  (case_strategy.currency_status = 'current'). Because migration 023's
  currency computation already guarantees that a row marked 'current'
  references a Criterion Assessment that is ALSO currency_status =
  'current' (see §6), this single read fully satisfies the Frozen
  Criterion Assessment Contract's QA responsibility — no independent
  comparison logic is required.
```

```
DQ-05 (Frozen MVP vs broader six-check vision): RESOLVED
CURRENT DESIGN SCOPE: FROZEN MVP ONLY (QA-MVP-01 + QA-MVP-02)
BROADER SIX-CHECK VISION: DEFERRED
GENERAL BLUEPRINT FIDELITY (beyond coverage): DEFERRED
SEPARATE FUTURE GOVERNED ACT REQUIRED: YES, for both deferred items
```

## 4. Non-Negotiable Frozen Boundary

```
QA Engine: READ → COMPARE → SIGNAL. Never modify Blueprint, Criterion
Assessment, Generated Documents, or Evidence Items. Never auto-correct.
Never trigger A1/A5/A3/A4/Blueprint regeneration. Never perform
external research, market benchmarking, or RFE prediction.
```
Source: `blueprint-contract.md` §permission matrix ("Modificar el Blueprint ni los documentos; corregir automáticamente" — forbidden), `AUCIS_PLATFORM_ARCHITECTURE.md` ("señales de inconsistencia, nunca correcciones automáticas").

## 5. Reusable Substrate — Direct Repository Finding

`agent_petition_drafts` (A4, migration 002) **already carries** `criteria_covered TEXT[]`, `criteria_missing TEXT[]`, and `criteria_sections JSONB` — A4's own self-reported coverage bookkeeping. `agent_recommendation_letters` (A3) carries a single `criterion_covered TEXT NOT NULL` per row (one letter = one criterion by construction).

```
DECISION: QA must NOT simply read A4's self-reported criteria_covered/
  criteria_missing as authoritative.
CLASS: SD-01 (source-mandated)
SOURCE: AUCIS_PLATFORM_ARCHITECTURE.md — QA is "la primera verificación
  real de que A3/A4 siguieron el Blueprint" (the FIRST REAL
  verification). A passthrough of A4's own self-assessment would not
  be a verification at all.
DESIGN: QA independently derives coverage from Blueprint.dominant_
  criteria/supporting_criteria against (a) the set of distinct
  criterion_covered values across the case's agent_recommendation_
  letters, and (b) the keys present with non-empty content in the
  case's agent_petition_drafts.criteria_sections. A4's own criteria_
  covered/criteria_missing fields are read only as a secondary
  cross-check — if they disagree with QA's independent computation,
  that disagreement is itself a QA finding.
REJECTED ALTERNATIVE: trust criteria_covered/criteria_missing directly
  — rejected per SD-01 above.
```

This is fully **deterministic** — a set-difference operation over existing structured columns. No model/LLM reasoning is required for QA-MVP-01.

## 6. Blueprint / Criterion Assessment Identity

```
case_strategy.criterion_assessment_id  → agent_intake_analysis.id  (migration 019)
case_strategy.currency_status          ∈ {generated, current, superseded}  (migration 023)
agent_intake_analysis.currency_status  ∈ {generated, current, superseded}  (migration 020)
```
Migration 023's backfill invariant: a `case_strategy` row is `currency_status = 'current'` **only if** it is the latest version for its case AND its referenced `agent_intake_analysis` row is itself `currency_status = 'current'`. This invariant is maintained going forward by A5's route (per prior project history: "fixed A5's unvalidated criterion_assessment_id"), not merely a one-time backfill.

```
DECISION: QA-MVP-02 requires no independent A1↔A5 comparison logic —
  reading case_strategy WHERE currency_status = 'current' is sufficient
  and correct by construction.
CLASS: SD-01 (source-mandated by the existing, already-enforced
  database invariant)
SOURCE: migration 023 (repository reality), satisfying the Frozen
  Criterion Assessment Contract's QA responsibility exactly.
```

## 7. Generated-Document ↔ Blueprint Provenance — Resolved Without New Columns

No `agent_recommendation_letters`, `agent_petition_drafts`, or `i129_form_drafts` row references `case_strategy` at all (confirmed: zero hits repository-wide).

```
DECISION: do NOT add a Blueprint-provenance FK to any Generated
  Document table for this MVP.
CLASS: SD-02 (source-constrained design choice)
SOURCE: the Frozen Roadmap's acceptance test is phrased at case level
  — "corrido contra un caso con un criterio... sin cobertura
  documental" (run against A CASE) — not at individual-document-version
  level.
RATIONALE: QA-MVP-01 compares the case's CURRENT Blueprint against the
  case's CURRENT set of Generated Documents (case-level snapshot), not
  historical per-document Blueprint-version pairing. This fully
  satisfies the sourced acceptance test without any schema change to
  A3/A4's existing tables.
REJECTED ALTERNATIVE: add a nullable case_strategy_id FK to each of the
  three Generated Document tables (MTCS-08-lineage-column pattern) —
  rejected as unnecessary schema surface for what the sourced
  acceptance test actually requires; would also need a small additive
  change to A3/A4's insert calls, out of proportion to the bounded MVP.
ARCHITECTURAL EFFECT: none on A1/A2/A3/A4/A5 — zero files in those
  layers are touched by this design.
```

## 8. QA Check Contract

```
CHECK: QA-MVP-01 — Criterion Documentary Coverage
INPUT: case_strategy row (currency_status='current') for the case;
  distinct criterion_covered values from agent_recommendation_letters;
  non-empty criteria_sections keys from agent_petition_drafts
ALGORITHM: DETERMINISTIC — set difference:
  missing = (dominant_criteria ∪ supporting_criteria) −
            (covered_by_letters ∪ covered_by_petition)
PASS CONDITION: missing = ∅
FINDING CONDITION: missing ≠ ∅ → one finding per missing criterion key
OUTPUT: see §9's evaluated-input manifest — missing_criteria is one
  field of that larger, complete-input-set record (Targeted Provenance
  Reconciliation, this section corrected accordingly)
MUTATION: NONE

CHECK: QA-MVP-02 — Blueprint Currency Precondition
INPUT: case_strategy rows for the case
ALGORITHM: DETERMINISTIC — existence check:
  current_blueprint = case_strategy WHERE case_id = ? AND
                       currency_status = 'current'
PASS CONDITION: exactly one current_blueprint row exists
FINDING CONDITION: zero current_blueprint rows exist → QA cannot
  produce a coverage result; returns a precondition-failure result
  (not a coverage finding) explaining that the case's Blueprint or its
  underlying Criterion Assessment is stale and requires human
  regeneration/re-approval — no QA-side correction.
OUTPUT: current_blueprint_found — see §9
MUTATION: NONE
```

## 9. DQ-01 — Persistence Model

```
OPTIONS EVALUATED: P-01 (run + child finding rows), P-02 (run row +
  structured JSONB), P-03 (document-local state), P-04 (case-level
  singleton), P-05 (no persistence)
SELECTED: P-02 (PRESERVED WITH TARGETED PROVENANCE EXTENSION) — one
  qa_runs row per execution, findings as a bounded structured JSONB
  field, now carrying the complete evaluated-input manifest (§9a),
  not only the missing-criteria finding.
RATIONALE: the manifest is still small and fully bounded — a case's
  letter/petition count is not large enough to justify a child table
  (P-01) — so GD-01 (JSONB manifest) satisfies CR-02 without
  restructuring the persistence model itself.
```

### 9a. Targeted Provenance Reconciliation (Class B correction)

Direct repository verification (not assumption) found two real gaps in
the originally frozen `findings` contract, both bounded and resolved
without touching `case_strategy`, A3, A4, or A5:

**CR-01 — Blueprint content, not just identity.** `case_strategy` rows
are never physically deleted anywhere in the repository (verified: zero
`.delete()` calls against `case_strategy` in any route) — supersession
always inserts a new row and flips `currency_status`/`superseded_by` on
the old one, which is why `ON DELETE SET NULL` is a dead-path default,
not a live risk (mirrors the MTCS-08 precedent for an unreachable
mutation). But `src/app/api/agents/a5-case-strategy/route.ts`'s PATCH
handler builds its update payload as `Object.assign({}, updates)` from
the raw request body, and only guards three Historical-Reliance fields
(`foundational_evidence`/`evidence_dependencies`/`evidence_dependencies_
reliance`) against post-`proposed`/`edited` mutation — `dominant_
criteria`/`supporting_criteria` themselves carry no such guard. Since
`status` and `currency_status` are independent dimensions (migration
023's own documented rationale), a row QA legitimately reads as
`currency_status='current'` can simultaneously be `status='proposed'`
or `'edited'` — i.e., still open to in-place editing of the exact
fields QA-MVP-01 evaluates. Row ID alone therefore does not guarantee
content immutability for `case_strategy`.

**CR-02 — Complete input set, not only findings.** The original
`findings` shape (`{ missing_criteria, current_blueprint_found }`)
recorded only criteria that failed coverage — it never recorded which
specific letters/petition drafts were actually read, including the
ones that passed. A later inspection of a historical QA run could not
distinguish "these documents were evaluated and compliant" from
"these documents didn't exist yet." `agent_recommendation_letters` and
`agent_petition_drafts` were separately verified content-immutable in
place (no update path anywhere touches `criterion_covered`,
`letter_draft`, or `criteria_sections`/`criteria_covered`/`criteria_
missing` after insert — case-letters' PATCH route only ever touches
`status`/`approved_by`/`approved_at`, and no route updates
`agent_petition_drafts` content at all), so their row IDs alone are
sufficient version identity — only the *set membership* was missing,
not per-document version integrity.

```
CORRECTION (Class B — bounded, additive, qa_runs-JSONB-only,
  no schema/table change beyond the shape already frozen in §16):

findings JSONB now contains:
{
  blueprint_snapshot: {
    case_strategy_id: uuid,
    dominant_criteria: string[],    // exact content read, not re-derived
    supporting_criteria: string[]   // exact content read, not re-derived
  },
  evaluated_letters: [ { id: uuid, criterion_covered: string } ],
  evaluated_petition_drafts: [ { id: uuid, criteria_covered: string[] } ],
  missing_criteria: string[],
  current_blueprint_found: boolean
}
```

`blueprint_snapshot.dominant_criteria`/`supporting_criteria` are the
literal values read at execution time, captured into the immutable
`qa_runs` row — solving CR-01 without adding any guard to `case_
strategy` itself (out of this act's authority) and without touching
A5's route. `evaluated_letters`/`evaluated_petition_drafts` record
every document actually read, whether or not it produced a finding,
solving CR-02. When `current_blueprint_found = false`, `blueprint_
snapshot`, `evaluated_letters`, and `evaluated_petition_drafts` are all
empty/absent — no evaluation occurred to snapshot.

REJECTED ALTERNATIVES: GD-02 (child relation table) — unnecessary
normalization for a bounded per-case document count; BP-01 (RESTRICT
delete on case_strategy) — solves a risk that repository verification
shows doesn't exist (no delete path), and would not have solved the
real in-place-mutation gap anyway; guarding dominant_criteria/
supporting_criteria in A5's own PATCH route — would fix the gap at its
root but modifies a file outside this act's authorized scope
(case_strategy/A5 redesign is explicitly out of bounds here); full
Blueprint JSON snapshot of the entire case_strategy row — rejected as
overcorrection, only the two fields QA-MVP-01 actually reads are
snapshotted.
CLASS: B (bounded compatibility/provenance correction within frozen
  architecture — no MVP scope change, no schema/table change beyond
  the JSONB shape already declared in §16, no touching of case_
  strategy/A3/A4/A5/Evidence/MTCS-08).
```

```
QA RUN IDENTITY:
  id                      UUID PRIMARY KEY
  case_id                 UUID NOT NULL REFERENCES cases(id)
  case_strategy_id        UUID REFERENCES case_strategy(id) ON DELETE SET NULL
                           (nullable — a precondition-failure run has none)
  executed_by             UUID NOT NULL REFERENCES profiles(id)
  executed_at             TIMESTAMPTZ NOT NULL DEFAULT now()
  status                  TEXT NOT NULL CHECK (status IN ('completed'))
  findings                JSONB NOT NULL

QA FINDING IDENTITY: not a separate entity — represented as JSONB keys
  within the run row's `findings` column (missing_criteria array,
  current_blueprint_found boolean). No separate finding_id, severity,
  or status field — none is required by the bounded MVP (§12/§13
  resolution below).

HISTORICAL IMMUTABILITY: qa_runs rows are never updated after insert —
  mirrors A1/A5/Evidence composition versioning precedent. A re-run
  creates a new row.
DQ-01: RESOLVED
```

## 10. Severity / Quality Score

```
QUALITY SCORE: NO — no source establishes one; every frozen source
  says "signals"/"discrepancies," never a score. Not designed.
SEVERITY: NO — the MVP's only finding type (missing criterion
  coverage) has no source-established severity gradation, and nothing
  in the bounded Definition of Done requires disposition-by-severity.
  Not designed.
```

## 11. DQ-02 — Trigger / Lifecycle Position

```
OPTIONS EVALUATED: T-01 (pre-Human-Review), T-02 (post-approval),
  T-03 (post-GWP-Re-entry), T-04 (explicit staff action, independent)
SELECTED: T-04
RATIONALE: Platform Architecture's only stated QA dependency is the
  Document Generation Layer (A3/A4) having run — it lists no
  dependency on Human Review Gate or MTCS-08 GWP Re-entry, both of
  which postdate every frozen QA source. No source authorizes an
  automatic trigger of any kind (§15). QA is available as an explicit,
  authorized staff action once at least one Generated Document exists
  for the case, independent of Human Review status (draft/in_review/
  approved/rejected) and independent of whether any letter has gone
  through MTCS-08 GWP Re-entry.
EXACT TRIGGER: staff-initiated API call; no automatic invocation from
  A3/A4 completion, Human Review approval, or GWP Re-entry.
HUMAN REVIEW RELATION: NOT gated by Human Review status — reading is
  the only interaction, and none occurs.
MTCS-08 RELATION: NOT REQUIRED for QA MVP — confirmed per §7 above;
  QA-MVP-01 consumes agent_recommendation_letters/agent_petition_drafts
  directly, never the canonical Case Document layer MTCS-08 governs.
CASE FILING RELATION: none — no Case Filing entity exists in current
  runtime to integrate with; recorded as a future integration seam
  only, not designed.
AUTOMATIC TRIGGER: NO
DQ-02: RESOLVED
```

## 12. DQ-03 — Advisory vs Blocking

```
MODEL: G-01 — ADVISORY
SOURCE BASIS: "señales de inconsistencia" / "señalar discrepancias" —
  every frozen source describes signals, never a gate. Blueprint
  Contract explicitly forbids QA from "ejecutar" (executing/triggering)
  anything.
DOWNSTREAM BLOCKING: NO — QA does not block A3/A4, Human Review
  transitions, GWP Re-entry, or any other existing mechanism.
AUTOMATIC CORRECTION: NO
DQ-03: RESOLVED
```

## 13. DQ-04 — Human Disposition

```
MODEL: HD-01 — no disposition lifecycle; findings are informational
  only, surfaced to authorized staff.
RATIONALE: minimal-MVP discipline (§26) — nothing in the bounded
  Definition of Done requires accept/dismiss/resolve workflow; findings
  are read-only output of an on-demand, re-runnable check. Adding a
  disposition lifecycle now would be scope creep by the same standard
  guarding the six-check vision.
QA SELF-RESOLUTION: NO — not applicable (no disposition state to self-resolve).
DQ-04: RESOLVED
```

## 14. Authorization / Security

```
AUTHENTICATE → BIND → RESOLVE AUTHORITATIVE INPUTS → AUTHORIZE →
EXECUTE QA → PERSIST / RETURN SIGNALS
```
Directly reuses `authorizeCaseStaff` (unmodified) — identical actor model to every closed MTCS (admin/supervisor unconditional, or the agent assigned to the Case).
```
NEW AUTHORIZATION ARCHITECTURE: NO
SERVER-DERIVED INPUTS: case_strategy row, agent_recommendation_letters,
  agent_petition_drafts — all resolved server-side from case_id; no
  client-supplied Blueprint/document identity is trusted.
CROSS-CASE SPOOFING: IMPOSSIBLE — every query is scoped by the
  server-authorized case_id; no cross-case composition is possible
  because case_strategy_id is recorded, never accepted from the client.
TENANT BOUNDARY: NOT MODIFIED — reuses the exact same case-scoped
  authorization boundary as the rest of AUSCIS; Organization/
  Multi-Tenant remains untouched and unsolved, consistent with every
  other closed MTCS.
```

## 15. Same-Case Invariant

Mirrors MTCS-08's resolved pattern (a composite-FK approach was rejected there for the same ON DELETE reasoning; a BEFORE trigger is reused here for consistency):
```sql
CREATE OR REPLACE FUNCTION public.enforce_qa_run_same_case()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_bp_case_id UUID;
BEGIN
  IF NEW.case_strategy_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT case_id INTO v_bp_case_id
  FROM public.case_strategy
  WHERE id = NEW.case_strategy_id;

  IF v_bp_case_id IS DISTINCT FROM NEW.case_id THEN
    RAISE EXCEPTION 'qa_runs.case_id (%) must match case_strategy case_id (%)', NEW.case_id, v_bp_case_id
      USING ERRCODE = 'QA001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_qa_runs_same_case
  BEFORE INSERT ON public.qa_runs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_qa_run_same_case();
```
`qa_runs` rows are never updated (§9 immutability), so `UPDATE OF` triggering (as MTCS-08 needed) is unnecessary here — `BEFORE INSERT` alone suffices.

## 16. Database Design

```
NEW TABLE: public.qa_runs
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
  case_id           UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE
  case_strategy_id  UUID REFERENCES public.case_strategy(id) ON DELETE SET NULL
  executed_by       UUID NOT NULL REFERENCES public.profiles(id)
  executed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  status            TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed'))
  findings          JSONB NOT NULL

INDEXES: idx_qa_runs_case_id ON qa_runs(case_id, executed_at DESC)
UNIQUE CONSTRAINTS: none — multiple runs per case are expected (§53/54)
CHECK CONSTRAINTS: status IN ('completed')
TRIGGERS: trg_qa_runs_same_case (§15)
FOREIGN KEYS: case_id → cases(id) ON DELETE CASCADE (matches every
  other Case-scoped table's convention); case_strategy_id → case_strategy(id)
  ON DELETE SET NULL (a QA run remains historically valid even if its
  Blueprint is later deleted — never happens in practice since
  case_strategy has no delete path, but SET NULL is the safe default,
  consistent with MTCS-08's ON DELETE reasoning)
RLS: real policies — case_strategy carries active RLS (unlike
  documents), so qa_runs follows that precedent, not the RLS-absent
  one:
    CREATE POLICY "staff_select_qa_runs" ON public.qa_runs
      FOR SELECT TO authenticated USING (
        is_admin_or_supervisor()
        OR case_id IN (SELECT id FROM public.cases WHERE assigned_agent_id = auth.uid())
      );
  (mirrors migration 017's staff_select_case_strategy exactly)
  Writes occur only via the service-role API route, as with every
  other agent-output table in this repository — no client-facing
  INSERT policy is required or added.
BACKFILL: none — new table, no pre-existing data.
DESTRUCTIVE CHANGE: NO
```

## 17. Migration

```
NEXT AVAILABLE MIGRATION: 034 (confirmed next after
  033_gwp_reentry_lineage.sql)
PROPOSED FILENAME: 034_qa_engine_runs.sql
Not created by this act.
```

## 18. Service / API / UI

```
SERVICE: src/lib/qa/run-qa-engine.ts (prospective)
  resolveCurrentBlueprint(case_id) → case_strategy row or null
  computeCriterionCoverage(blueprint, letters, petitionDrafts) → missing_criteria[]
  runQaEngine(db, { caseId, executedBy }) → persists qa_runs row, returns result

RUN API: POST /api/cases/[id]/qa-runs (prospective)
  AUTH: SSR session + authorizeCaseStaff(case_id)
  INPUT: none beyond the authenticated session — case_id is the path
    param, server-authoritative
  OUTPUT: { qa_run_id, current_blueprint_found, missing_criteria }

READ API: GET /api/cases/[id]/qa-runs (prospective)
  AUTH: same
  OUTPUT: list of prior qa_runs for the case, newest first

UI: a minimal panel/section on the existing Case page (adjacent to
  document-generation-section.tsx, not inside it — QA is a distinct
  capability, not a Generated-Document action) showing: a "Run QA"
  button (authorized roles only) and the most recent run's findings.
  Terminology: "cobertura de criterios," "hallazgo," "Blueprint
  vigente" — never "aprobado por USCIS," "evidencia verificada," or
  "listo para radicar."
```

## 19. Failure Model

```
TECHNICAL FAILURE: if the DB read/insert fails, no qa_runs row is
  persisted and the API returns a 5xx — no partial/ambiguous result.
PARTIAL RESULT: impossible — the whole check is one synchronous,
  deterministic read-then-insert; nothing to leave partial.
RETRY: explicit only — staff re-invokes the Run API.
QA FINDING ≠ SYSTEM ERROR: preserved — a "no current Blueprint" result
  is a valid, persisted qa_runs row (current_blueprint_found=false);
  a database connectivity failure is not persisted at all.
```

## 20. Acceptance Criteria

```
AC-QA-01  Authorized staff can explicitly initiate a QA run for an
          eligible Case.                                    — SERVICE TEST
AC-QA-02  Unauthorized staff cannot initiate/read QA for another Case.
                                                              — SERVICE TEST
AC-QA-03  QA resolves the governing Case Blueprint server-side
          (currency_status='current'), never from client input.
                                                              — SERVICE TEST
AC-QA-04  QA identifies whether a current Criterion Assessment relationship
          holds, via case_strategy.currency_status alone.    — CODE INSPECTION
                                                                 (migration 023 invariant)
AC-QA-05  QA detects a stale/superseded Blueprint↔Criterion-Assessment
          relationship by finding zero current_blueprint rows.
                                                              — SERVICE TEST
AC-QA-06  QA evaluates criterion documentary coverage for
          dominant_criteria/supporting_criteria.              — SERVICE TEST
AC-QA-07  A case deliberately missing documentary coverage for one
          criterion produces that criterion in missing_criteria.
          (Frozen Roadmap acceptance test)                    — SERVICE TEST
AC-QA-08  QA consumes only agent_recommendation_letters and
          agent_petition_drafts for the authorized case.       — CODE INSPECTION
AC-QA-09  QA records the complete exact input set — Blueprint identity
          plus its evaluated criteria content (blueprint_snapshot), and
          every letter/petition-draft ID actually read (evaluated_
          letters/evaluated_petition_drafts) — sufficient to reconstruct
          exactly what was evaluated, independent of later source
          changes (§9a).                                        — STRUCTURAL DB
AC-QA-10  QA does not modify Case Blueprint.                    — CODE INSPECTION
AC-QA-11  QA does not modify Criterion Assessment.               — CODE INSPECTION
AC-QA-12  QA does not modify Generated Documents.                — CODE INSPECTION
AC-QA-13  QA does not modify Evidence Items (no Evidence access at all).
                                                                 — CODE INSPECTION
AC-QA-14  QA does not automatically trigger A1.                  — CODE INSPECTION
AC-QA-15  QA does not automatically trigger A5.                  — CODE INSPECTION
AC-QA-16  QA does not automatically regenerate Blueprint.        — CODE INSPECTION
AC-QA-17  QA does not automatically trigger A3/A4.                — CODE INSPECTION
AC-QA-18  QA performs no external research.                      — CODE INSPECTION
AC-QA-19  QA performs no RFE prediction.                          — CODE INSPECTION
AC-QA-20  QA performs no automatic correction.                    — CODE INSPECTION
AC-QA-21  Cross-case qa_runs composition is rejected at the DB level.
                                                              — STRUCTURAL DB / SERVICE TEST
AC-QA-22  Historical QA execution remains attributable to the exact
          Blueprint content and exact document set evaluated, even if
          case_strategy is later edited in place while proposed/edited
          (blueprint_snapshot is a captured value, not a live
          re-derivation via the FK) (§9a).                       — STRUCTURAL DB
AC-QA-23  Subsequent Blueprint/Criterion-Assessment/document changes,
          including new documents created afterward, do not rewrite or
          bleed into prior qa_runs rows' recorded manifest.       — STRUCTURAL DB
AC-QA-24  A new QA execution requires the explicit Run API call, never
          an automatic side effect of any other mutation.        — CODE INSPECTION
AC-QA-25  QA result exposes missing_criteria/current_blueprint_found
          to authorized staff via the Read API/UI.               — SERVICE TEST

FROZEN ROADMAP ACCEPTANCE TEST: PRESERVED (AC-QA-07, verbatim)
```

## 21. Implementation Surface Map (prospective — not created)

```
supabase/migrations/034_qa_engine_runs.sql          CREATE
src/lib/qa/run-qa-engine.ts                          CREATE
src/app/api/cases/[id]/qa-runs/route.ts              CREATE
src/app/(dashboard)/cases/[id]/qa-panel.tsx           CREATE
src/app/(dashboard)/cases/[id]/page.tsx               MODIFY (mount qa-panel)
```
No file in `src/lib/agents/`, `src/app/api/agents/`, or any A1/A2/A3/A4/A5 path is created or modified. No AKAE, AEPE, Market Intelligence, or RFE Prediction file is touched.

## 22. Compatibility

```
MTCS-01–07: COMPATIBLE, untouched.
MTCS-08: COMPATIBLE, untouched — QA-MVP-01 does not consume MTCS-08's
  canonical Case Document/lineage layer at all (§7, §11).
Evidence Item Contract V2: COMPATIBLE — no Evidence access in MVP.
Blueprint Contract: COMPATIBLE — read-only, signal-only, matches the
  permission matrix exactly.
Criterion Assessment Contract: COMPATIBLE — currency check satisfied
  by existing invariant, no new comparison logic.
Platform Architecture: COMPATIBLE WITH BOUNDED EXTENSION — MVP is a
  proper subset of the stated Validation Layer purpose.
Domain Interaction Architecture: COMPATIBLE.
Implementation Roadmap Phase 2: COMPATIBLE — this IS its Capacidad 5.
CONFLICTS: 0
```

## 23. Explicit Out-of-Scope

Quality score; severity; human disposition workflow; automatic/scheduled triggers; general Blueprint narrative/argument-sequence fidelity beyond coverage; the broader six-check vision (date consistency, cross-letter contradiction, orphaned Evidence, redundancy, general document completeness); Evidence Item access of any kind; MTCS-08 canonical Case Document consumption; Case Filing integration; RFE Prediction; Market Intelligence; Agentic RAG; AKAE; AEPE; Organization/Multi-Tenant; any I-129/`i129_form_drafts`-specific coverage logic beyond what its existing columns support (its schema carries no `criteria_covered`-equivalent field — I-129 is excluded from the coverage computation for this MVP, recorded as a known limitation, not silently assumed).

## 24. Implementation Authorization State

```
FINAL EXACT DESIGN: APPROVED / FROZEN (pending independent Design MR)
IMPLEMENTATION: NOT AUTHORIZED — a separate governed act must authorize
  implementation against this frozen design.
```
