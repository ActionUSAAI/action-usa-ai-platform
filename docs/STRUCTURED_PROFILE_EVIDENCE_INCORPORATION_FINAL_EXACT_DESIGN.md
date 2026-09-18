# Structured Profile → Evidence Incorporation — Final Exact Design

## 1. Identification

Working name: **Structured Profile → Evidence Incorporation**. Not an agent — no `A0.5`/`A1B`/`A6` numbering is created (no source establishes such naming). Represented as a **governed capability / Evidence Producer entry path**, using the existing `create_evidence_composition_with_documents()` Producer (migration 028, MTCS-04) — not a new agent, not a new parallel Evidence system.

## 2. Status

`DRAFT — PENDING PROJECT OWNER FREEZE`. This document does not itself authorize implementation. Governed by the Project Owner's explicit direction to execute this Final Exact Design Gate, following the Next Governed Scope Selection Gate (post-CR-CPS-45) and the A1 Architectural Reconciliation Gate (which found no A1 amendment required and identified this exact gap).

## 3. Scope

**In scope:** the governed bridge from `intake_submissions.structured_profile` (CLOSED, CR-CPS-45) into `evidence_items` (MTCS-01/03/04), reusing the existing Evidence Producer.

**Out of scope:** any change to A1, A2, A5, Coach, A0, Structured Profile, Prefill Engine, Automated Readiness, R-01/R-02, AKAE, ALKA, AILA, AEPE, Organization/Multi-Tenant, Production. No Evidence-selection/Governed-Knowledge-Selection (TC-08/TC-09) work. No eligibility, criterion-satisfaction, or strategic determination of any kind.

## 4. Governing Sources

- `docs/AUCIS_EVIDENCE_ITEM_CONTRACT_V2.md` — FROZEN, read in full (78 sections, §73 Core Contract Invariants EV-01..EV-57).
- `docs/AUSCIS_INTAKE_INTELLIGENCE_LAYER_FINAL_EXACT_DESIGN.md` — FROZEN, CLOSED (CR-CPS-45), §5.4/§5.5/§6.
- `docs/AUCIS_CRITERION_ASSESSMENT_CONTRACT_V1.md` — FROZEN (A1's Input Contract; confirms Evidence Item is an authorized A1 input; Structured Profile is not).
- `supabase/migrations/024_evidence_items.sql` (MTCS-01), `027_evidence_item_documents.sql` (MTCS-03), `028_evidence_producer_and_verification.sql` (MTCS-04) — actual implementation, read in full.
- `src/lib/intake/structured-profile.ts`, `src/lib/intake/prefill-engine.ts` — actual closed implementation.
- `src/app/api/agents/a1-intake-analyzer/route.ts` — actual A1 implementation (confirms existing, unmodified `evidence_items` consumption).
- `supabase/schema.sql` — `profiles`/`documents` actor-attribution precedent.

## 5. Problem Statement

The CLOSED Intake Intelligence Layer produces `structured_profile` case information. A1 already, unconditionally, reads `evidence_items` (verified live in `a1-intake-analyzer/route.ts:396-417`) and needs zero modification to consume more Evidence. But **no code anywhere converts `structured_profile` data into `evidence_items`** (confirmed: zero matches for `evidence_items` under `src/lib/intake/` or `src/app/api/intake/`). Structured Profile's `IDENTITY_FIELDS` already reach A1 indirectly via Prefill → Module1 (a separate, already-complete pathway, untouched by this design). Structured Profile's `CRITERION_NARRATIVE_FIELDS` — the fields most relevant to actual criterion assessment — reach no downstream consumer at all today. This design closes that gap through the Evidence lifecycle, exactly as Evidence Item Contract V2 §7 and Final Exact Design §6 already anticipate.

## 6. Architectural Position

```
CV(optional) / Coach → A0 / Intake Intelligence → Structured Profile (CLOSED)
        ↓
[ Structured Profile → Evidence Incorporation ]  (this design)
        ↓  (reuses existing MTCS-04 Producer)
Evidence Item (existing lifecycle, MTCS-01/03/04)
        ↓  (existing, unmodified)
A1 Intake Analyzer (Path A / Path B, EV-53)
```

This capability sits **between** the CLOSED Intake Layer and the existing Evidence lifecycle. It reads Structured Profile (read-only w.r.t. Intake) and writes Evidence Items (via the existing Producer, read-only w.r.t. new schema). It does not touch A1.

## 7. Inputs

- `intake_submissions.structured_profile` (per-field: `value`, `source`, `confidence`, `status`, `confirmed_by`, `confirmed_at`) — read-only.
- `intake_submissions.case_id` — resolves the target Case (Evidence is Case-scoped, EV-52).
- The authenticated Action USA staff actor performing the incorporation action (see §12).

Not an input: `coach_conversation` transcript, `module1-15` raw Intake fields (Prefill's concern, unrelated to this design), Evidence Item internals beyond dedup lookup (§18).

## 8. Eligibility Rules (DDR-SEI-01, RESOLVED)

Structured Profile field states, per field:

| Status | Eligible? | Path |
|---|---|---|
| `not_yet_acquired` | NO | No value exists; produces no incorporation candidate (EV-05 requires a fact to exist). |
| `conflicting` | NO | EV-09 (material ambiguity requires human resolution) and Final Exact Design §7 (no silent harmonization) — conflicting fields never produce an incorporation candidate until resolved back to `beneficiary_confirmed` inside Structured Profile itself (out of this design's scope — that resolution happens in the CLOSED Intake capability). |
| `acquired_unconfirmed` | **Conditional** — see below | — |
| `beneficiary_confirmed` | YES | Eligible; routes per field-type (§9). |

`acquired_unconfirmed` eligibility: **only** `IDENTITY_FIELDS` with `source = cv_extraction`, per Final Exact Design §6's frozen, verbatim resolution ("A0's direct, non-interpretive CV extractions... MAY be incorporated as Reported/Pending Evidence Items... with provenance preserved"). `source = coach_discovery` is, by the same frozen clause, always treated as interpreted and never eligible while `acquired_unconfirmed`. `CRITERION_NARRATIVE_FIELDS` are never eligible while `acquired_unconfirmed`, regardless of source (§9).

## 9. Structured Profile Field-State Handling (DDR-SEI-02, RESOLVED)

Two field categories (`structured-profile.ts` `IDENTITY_FIELDS` / `CRITERION_NARRATIVE_FIELDS`), two incorporation paths:

**`IDENTITY_FIELDS`** (12 fields: name/DOB/nationality/residence/contact/profession fields):
- `source = cv_extraction`, `status ∈ {acquired_unconfirmed, beneficiary_confirmed}` → **Deterministic path (§18)**.
- `source ∈ {coach_discovery, beneficiary_confirmed, staff_entered}`, `status = beneficiary_confirmed` → **Deterministic path (§18)** (a confirmed identity fact is not interpretive regardless of who supplied it).
- Any `IDENTITY_FIELDS` still `acquired_unconfirmed` with `source ≠ cv_extraction` → not yet eligible.

**`CRITERION_NARRATIVE_FIELDS`** (9 fields: awards/judging/critical_role/etc.):
- **Always routes to the Ambiguous / human-resolution path (§19), regardless of source, confidence, or status — except `not_yet_acquired`/`conflicting`, which are never eligible (§8).**
- Rationale (not invented — direct precedent): `structured-profile.ts` lines 35-43 already establish, for the CLOSED Prefill capability, that narrative fields are "surfaced for human review" and never auto-written anywhere, "out of this MVP's safe scope." This design mirrors that identical, already-closed caution rather than introducing a new, less conservative rule for the same fields. This keeps the design implementation-deterministic (§52 test): there is no confidence-based or source-based branch within narrative fields for two engineers to diverge on.

## 10. Candidate Fact Extraction

A "candidate" is a `(field_key, value, source, confidence, structured_profile status)` tuple read directly from `structured_profile` — no transformation, no inference, no free-text parsing. `value` becomes `evidence_items.fact` verbatim (a plain-text probative-fact statement; e.g. `familyName: "Doe"` → `fact = "Family name: Doe"` using a fixed, field-key-to-label mapping, analogous to A1's existing `buildUserPrompt` label mapping — no new NLP/extraction logic). One field → one candidate → at most one Evidence Item (§11, no fan-out).

## 11. Evidence Atomicity (DDR-SEI-03, RESOLVED)

**One Structured Profile field = one Evidence Item.** No field is split into multiple Evidence Items; no Evidence Item aggregates multiple fields. This is the simplest atomicity rule consistent with EV-05 ("a sufficiently identifiable probative fact") — each Structured Profile field already represents one discrete fact by the CLOSED capability's own schema design. A future narrower atomicity (e.g., splitting a multi-award narrative into per-award Evidence Items) would require human interpretation (§19) and is explicitly the kind of "material inference" this design routes to staff, not something this capability performs automatically.

## 12. Evidence Producer Integration (DDR-SEI-04, RESOLVED — load-bearing)

**Reuse `create_evidence_composition_with_documents()` (migration 028) unchanged. No new migration, no new function, no new table.**

Parameters:
- `p_evidence_id` / `p_expected_current_id`: `NULL`/`NULL` for first incorporation of a field (new Evidence family); on re-run with Material Change (§43), the existing Evidence Item's `evidence_id`/current `id` (supersession — reuses MTCS-01 versioning, no new dedup mechanism, per §71/EV-57).
- `p_case_id`: from `intake_submissions.case_id`.
- `p_fact`: per §10.
- `p_documentary_condition`: `'reported'` always at creation (§6, §26 — no document exists yet at incorporation time; a CV, if present, is a Case Document association, not proof — §20 below).
- `p_source_type`: `'structured_profile'` (new value; `source_type` is unconstrained free TEXT, confirmed via `migrations/024:78` — zero schema change).
- `p_source_reference`: `'{submission_id}:{field_key}:{structured_profile_source}'` (e.g. `"a1b2...:familyName:cv_extraction"`) — stable, deterministic, doubles as the dedup/idempotency key (§24).
- `p_created_by`: the authenticated Action USA staff actor's `profiles.id` performing the incorporation action (§12 resolves the actor question below — never a beneficiary or invented system profile).
- `p_document_ids`: `NULL`/empty at initial incorporation (§6/EV-10 — Evidence may exist with zero Documents); optionally the CV's canonical `documents.id` if/when the post-Intake canonical-document-convergence process (Section J, already implemented) has produced one, purely as documentary context, never as proof (§20).

**Actor-attribution resolution (the one genuinely load-bearing question this design had to resolve, not invent):** `evidence_items.created_by` and `documents.uploaded_by` both hard-FK to `profiles.id` (`auth.users`-backed). Beneficiaries interact via anonymous tokenized invitation links (confirmed throughout the CLOSED Intake lineage) and have no `profiles` row. The existing Intake CV upload (`src/app/api/intake/upload/route.ts`) already solves an identical problem by never writing a `documents` row during Intake at all — it writes to Storage only, deferring canonical `documents`/`uploaded_by` attribution to the later, staff-triggered "Post-Intake canonical document convergence" process (Section J, already implemented). **This design follows the identical, already-established pattern**: Evidence incorporation from Structured Profile is always triggered inside an authenticated Action USA staff request context (reusing the existing admin/supervisor/assigned-agent authorization pattern already established in `case-letters/route.ts` and reused by `intake-intelligence/complete/route.ts`, per Final Exact Design §5.7 verbatim), never a beneficiary-context or an invented service/system profile. This resolves the question by direct, cited precedent — not invention.

## 13. Human Resolution Boundary

Surfaced in the existing staff exception-resolution surface (`intake-intelligence-section.tsx` / `intake-intelligence/complete` route — already staff-authenticated, already reused-by-reference per §5.7). Two staff-facing actions:

- **Deterministic candidates** (§9 Identity path): presented as a reviewable list; a single staff "Incorporate" action creates Evidence Items for all currently-eligible candidates in one authenticated call. This is not staff *re-deriving* the fact (no material inference by the human) — it is the human authorizing the write, matching §12's actor-attribution resolution and EV-54 (automation must not silently substitute itself for consequential Evidence decisions — the write always requires this explicit staff action, deterministic-eligibility only controls whether staff review is per-field-content or per-batch).
- **Ambiguous candidates** (§9 Narrative path, §19 verbatim): staff may **accept** (creates Evidence as proposed), **correct** (edits `fact` before creation), **reject** (no Evidence created, candidate dismissed), or **associate** (link to an already-existing Evidence Item instead of creating a new one, per §31 dedup). No new workflow engine — this is the same four-action set §19 already specifies; the UI need only expose them.

## 14. Documentary State Rules

Always `'reported'` at creation (§12). This capability never assigns `'partial'` or `'documented'` — those require actual document review, which is A2/staff's existing, unmodified authority (§15/§29 of the Evidence contract). If a CV is later canonically converged into `documents` and associated, Documentary Condition may subsequently be updated by the existing `update_evidence_documentary_condition()` function (migration 024) — outside this design's scope, unmodified.

## 15. Verification State Rules

Always `'pending'` at creation — `create_evidence_composition_with_documents()` hard-codes this (migration 024:189, unconditionally). This design cannot set `'verified'` under any circumstance (EV-19: only an authorized Action USA human, via the existing `review_evidence_composition_if_current()` function, confers `Verified`/`Needs Attention` — untouched, unreachable from this design).

## 16. Evidence ↔ Document Rules

Unmodified M:N (MTCS-03). This design creates Evidence Items with zero or one initial Document association (the canonical CV document, if convergence has already occurred) — never introduces a shortcut column, never assumes 1:1.

## 17. Provenance

`source_type = 'structured_profile'`, `source_reference` encodes submission/field/origin (§12) — reconstructable to the exact Structured Profile field, its original `source` (cv_extraction/coach_discovery/beneficiary_confirmed/staff_entered), and its `confirmed_by`/`confirmed_at` where applicable, satisfying §65/EV-26. Per §66/EV-27, this provenance confers no authority — it is descriptive only.

## 18. Duplicate / Identity / Versioning Rules

Before creating new Evidence for a candidate, the incorporation action queries `evidence_items` for an existing `currency_status = 'current'` row with the same `case_id` and `source_reference` prefix (`{submission_id}:{field_key}:`). If found: **not a duplicate** — a re-run against updated Structured Profile data. If the `fact` differs from the existing row, this is a Material Change (§37 of the Evidence contract) — create a new version via `create_evidence_composition_with_documents()` with `p_evidence_id`/`p_expected_current_id` set to the existing row's identity, which automatically supersedes the prior version per the existing, unmodified `create_evidence_composition()` logic (migration 024). If identical, no-op (idempotent, §24). This reuses MTCS-01's existing versioning mechanism entirely — no new dedup table, no new identity scheme (EV-57).

## 19. Existing Verified Evidence Protection

Per EV-21, if the existing current Evidence Item (matched by `source_reference`, §18) is already `Verified` and Structured Profile now presents a differing value: **Material Change still applies** — a new version is created, `verification_condition` reverts to `Pending` on the new current version (existing, unmodified `create_evidence_composition()` behavior — verification fields are never copied forward). The historical `Verified` version is preserved unchanged (EV-40, no silent overwrite). This capability never marks the changed composition `Needs Attention` itself — that remains exclusively an authorized-human action (§35/EV-19); the new `Pending` state is simply visible to staff through the existing verification queue.

## 20. Criterion Relationship

**This capability never assigns a `criterion`/`criterion_id` relationship.** Structured Profile's `CRITERION_NARRATIVE_FIELDS` bucket names (`awards`, `judging`, `critical_role`, etc.) are acquisition-organization labels, not adjudicated criterion satisfaction (§45 of this gate's prompt, correctly anticipated — no source establishes that a narrative bucket equals a proven criterion). `source_reference`'s `field_key` component preserves which bucket a fact came from for human/A1 traceability, but no `evidence_items` column or relationship encodes "this Evidence satisfies criterion X" — that determination remains exclusively A1's (per `CA-CONTRACT-V1`).

## 21. Persistence / Auditability

No new persistent artifact beyond the Evidence Item itself. `created_by`/`created_at` (existing columns) plus `source_type`/`source_reference` (existing, reused columns) already answer every auditability question in §39 of the governing prompt ("why does this exist, what caused it, automatic or human, what source, who verified, what documents") without any new table — satisfying EV-56 (this contract does not authorize a new generic entity merely because a conceptual distinction exists) and the "reuse before invent" principle (EV-57, §71).

## 22. A1 Handoff

None required. A1's existing, unmodified `evidence_items` query (`currency_status = 'current'`) already includes any Evidence Item this capability creates, the next time A1 runs. Re-analysis remains exactly as established (EV-39/EV-53): explicit, authorized human action only — this design never triggers A1.

## 23. No-Automatic-Reanalysis Rule

Preserved absolutely (EV-53, EV-45). Evidence incorporation is Path A (EV-54) by default: "New/Changed Evidence → Evidence Inventory → Human Verification where applicable → existing Criterion Assessment remains unchanged" until a human explicitly requests reassessment through the existing, unmodified mechanism.

## 24. Security / Case Boundary

Every write (§12) executes inside an authenticated staff request already authorized for the target Case (reusing the existing admin/supervisor/assigned-agent authorization pattern, per §5.7). `create_evidence_composition_with_documents` itself is `service_role`-only (migration 028:291-292, unmodified) — callable only from a server-side route holding that authenticated, case-authorized context, identical to every other governed write in this codebase. `case_id` is always server-resolved from the submission, never client-supplied, mirroring the invitation-namespace-binding pattern established in the CLOSED Intake lineage (CR-CPS-41/43/44). No Organization/Multi-Tenant design introduced (explicitly out of scope, §41 of the governing prompt).

## 25. Failure Modes

| Failure | Behavior |
|---|---|
| Structured Profile missing/empty | NO-OP — no candidates |
| Field `not_yet_acquired` | NO-OP (§8) |
| Field `conflicting` | NO-OP, remains in Structured Profile only (§8) |
| Field `acquired_unconfirmed`, ineligible per §8/§9 | NO-OP — awaits confirmation |
| Duplicate/unchanged re-run | NO-OP (idempotent, §18/§24) |
| Changed value on existing Evidence | New version created (Material Change, §18/§19) |
| Existing Evidence `Verified`, value changed | New version created, reverts to `Pending` (§19), historical version preserved |
| Malformed candidate (empty value after status says acquired) | FAIL CLOSED — skipped, logged, not incorporated |
| Producer RPC failure (DB error) | FAIL CLOSED — no partial Evidence Item; transaction-scoped per existing `create_evidence_composition_with_documents` |
| Staff authorization failure | FAIL CLOSED — 403, identical to existing `intake-intelligence/complete` pattern |
| Case mismatch (defensive) | FAIL CLOSED — `CASE_MISMATCH`/`EV004`, existing Producer behavior, unmodified |

## 26. Idempotency

Guaranteed by §18's `source_reference`-keyed lookup: re-running incorporation against unchanged Structured Profile produces zero new Evidence Items (identical `fact` → no-op). Re-running after a Structured Profile change produces exactly one new version (never a duplicate row), reusing MTCS-01's existing supersession mechanism.

## 27. Explicit Non-Goals

- No new agent, no MTCS number.
- No modification to A1, A2, A5, Coach, A0, Structured Profile, Prefill Engine, Intake Complete, R-01, R-02.
- No Evidence Verification by this capability, ever.
- No criterion/eligibility/strategic determination.
- No new schema, table, or migration.
- No Organization/Multi-Tenant design.
- No AKAE/ALKA/AILA/AEPE interaction.
- No automatic A1/A5/Blueprint trigger.
- No Governed Knowledge Selection / Return-Scope Determination (TC-08/TC-09) work.

## 28. Acceptance Criteria

1. **SEI-AC-01**: No Structured Profile field is ever read directly by A1; A1's input contract is unmodified.
2. **SEI-AC-02**: No Evidence Item created by this capability is ever created with `verification_condition = 'verified'`.
3. **SEI-AC-03**: `not_yet_acquired` fields never produce an Evidence Item.
4. **SEI-AC-04**: `acquired_unconfirmed` fields produce Evidence only for `IDENTITY_FIELDS` with `source = cv_extraction`.
5. **SEI-AC-05**: `conflicting` fields never produce an Evidence Item.
6. **SEI-AC-06**: `beneficiary_confirmed` fields are eligible per §9's path split; none skip the staff-triggered write.
7. **SEI-AC-07**: The capability functions identically whether or not a CV was ever uploaded (R-01 CV-optional preserved — no code path requires CV presence).
8. **SEI-AC-08**: Coach-discovered facts are never incorporated via the deterministic path.
9. **SEI-AC-09**: Zero new database function, table, column, or migration is introduced; `create_evidence_composition_with_documents()` is called unmodified.
10. **SEI-AC-10**: Every Evidence Item this capability creates or supersedes uses the existing Evidence↔Document M:N association mechanism, never a new shortcut.
11. **SEI-AC-11**: Human Verification is reachable only through the existing, unmodified `review_evidence_composition_if_current()` path.
12. **SEI-AC-12**: Re-running incorporation against unchanged Structured Profile creates zero new rows.
13. **SEI-AC-13**: An already-`Verified` Evidence Item is never silently overwritten; a differing Structured Profile value creates a new version and reverts only the current composition to `Pending`.
14. **SEI-AC-14**: No A1, A5, or Blueprint execution is triggered by this capability under any condition.
15. **SEI-AC-15**: A1 continues to function identically and requires zero code modification.
16. **SEI-AC-16**: A2 is not invoked or modified by this capability.
17. **SEI-AC-17**: The CLOSED Intake Intelligence Layer (Coach, A0, Structured Profile, Prefill Engine, Automated Readiness, Intake Complete, R-01, R-02) is not modified.
18. **SEI-AC-18**: AKAE, ALKA, AILA, AEPE are not referenced or modified.
19. **SEI-AC-19**: Every write executes inside an authenticated, case-authorized Action USA staff request; no write is attributable to a beneficiary or an invented system actor.
20. **SEI-AC-20**: Production is not touched by this design or its eventual implementation authorization.

## 29. Implementation Boundary

This document authorizes no code, schema, or Production change. Next required act, per this project's established MTCS/QA-Engine/Human-Review-Gate/Intake-Intelligence-Layer precedent: **Implementation Authorization Gate**.

## 30. Production Boundary

Untouched. `PRODUCTION: HARD-DENIED` throughout design, any future implementation, and any future Implementation MR, unless separately and explicitly authorized.

## 31. Open Decisions / NOT ESTABLISHED Items

None load-bearing remain unresolved. Two non-blocking, explicitly-flagged items, consistent with this project's own precedent of not inventing policy where none is source-required:

- **NOT ESTABLISHED (non-blocking)**: exact UI placement/copy for the staff batch-accept and individual-review actions (§13) — IMPLEMENTATION-DETERMINED, deferred to Implementation, mirroring the CLOSED Intake Layer's own precedent for equivalent UI-copy deferrals (Final Exact Design §5.5).
- **NOT ESTABLISHED (non-blocking)**: whether a canonical `documents.id` for the CV (post-convergence) should be automatically associated with Identity-path Evidence Items or left for explicit staff association — either is compatible with §16/§25's failure-mode table (zero-Document Evidence is always valid); deferred to Implementation as a minor UX choice with no lifecycle-semantic consequence.

---

# Design Decision Register

### DDR-SEI-01 — Structured Profile status eligibility for incorporation
**Question**: Which `structured_profile` field states may produce an Evidence Item?
**Source**: Evidence Item Contract V2 EV-05/EV-09, Final Exact Design §6/§7.
**Decision**: `beneficiary_confirmed` always eligible; `acquired_unconfirmed` eligible only for `IDENTITY_FIELDS` with `source=cv_extraction`; `conflicting`/`not_yet_acquired` never eligible.
**Rationale**: Final Exact Design §6 is frozen, verbatim, and already resolves exactly this question.
**Effect**: §8.
**STATUS**: RESOLVED.

### DDR-SEI-02 — Identity vs. narrative field routing
**Question**: Do `CRITERION_NARRATIVE_FIELDS` ever qualify for the deterministic (§18) path?
**Source**: `structured-profile.ts:35-43` (frozen, closed implementation comment).
**Decision**: No — always routed to the Ambiguous/human-resolution path (§19), regardless of source/confidence/status (subject to §8's baseline eligibility).
**Rationale**: Mirrors the CLOSED Prefill capability's own identical, already-implemented caution for the same fields; keeps the design implementation-deterministic (passes §52 test — no confidence-based branch for two engineers to diverge on).
**Effect**: §9.
**STATUS**: RESOLVED.

### DDR-SEI-03 — Evidence atomicity
**Question**: Field-to-Evidence-Item cardinality?
**Source**: EV-05 (sufficiently identifiable probative fact); Structured Profile's own one-fact-per-field schema.
**Decision**: 1:1, no fan-out, no aggregation.
**Rationale**: Simplest rule consistent with source; any finer split requires human interpretation, correctly routed to §19 instead.
**Effect**: §11.
**STATUS**: RESOLVED.

### DDR-SEI-04 — Actor attribution for `created_by` (load-bearing)
**Question**: `evidence_items.created_by`/`documents.uploaded_by` hard-FK to `profiles.id` (`auth.users`-backed); beneficiaries have no `profiles` row. Who is attributed?
**Source**: `supabase/schema.sql` (profiles/documents FK), existing Post-Intake canonical document convergence pattern (Section J, already implemented), Final Exact Design §5.7 (existing admin/supervisor/assigned-agent staff-authorization pattern, reused by reference).
**Decision**: Every incorporation write executes inside an authenticated Action USA staff request; `created_by` is always that staff member's `profiles.id`. Never a beneficiary context, never an invented system/service profile.
**Rationale**: Direct precedent — the existing Intake CV-upload path already defers exactly this same `profiles.id` attribution problem to the identical staff-triggered convergence pattern; this design follows it rather than inventing a new actor model.
**Effect**: §12, §24.
**STATUS**: RESOLVED.
