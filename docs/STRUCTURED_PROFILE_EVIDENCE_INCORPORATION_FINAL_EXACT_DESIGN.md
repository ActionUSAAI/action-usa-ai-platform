# Structured Profile → Evidence Incorporation — Final Exact Design

## 1. Identification

Working name: **Structured Profile → Evidence Incorporation**. Not an agent — no `A0.5`/`A1B`/`A6` numbering is created (no source establishes such naming). Represented as a **governed capability / Evidence Producer entry path**, using the existing `create_evidence_composition_with_documents()` Producer (migration 028, MTCS-04) — not a new agent, not a new parallel Evidence system.

## 2. Status

`CORRECTED — PENDING FINAL EXACT DESIGN REVIEW RE-RUN`. Originally frozen and canonically recorded as CR-CPS-46. An independent Final Exact Design Review found DDR-SEI-03 (Evidence Atomicity) inconsistent with Evidence Item Contract V2 §19's explicit anticipation of multi-fact sources, corrected as CR-CPS-47. A second-order review of the corrected human-resolution path found §18/§26 overclaiming a combined "no duplicate Evidence Item" guarantee that the existing runtime does not structurally provide at the request-retry level, corrected as CR-CPS-48 (distinguishing semantic duplicate avoidance — human-controlled, source-established — from request-level retry/replay idempotency — deferred to Implementation Reconciliation per §70). A subsequent Final Exact Design Review — Re-run passed, and a following Implementation Authorization Gate performed the deferred Implementation Reconciliation itself, finding that genuine retry/replay atomicity requires one small, additive, transactional database wrapper invoking the existing MTCS-04 Producer unmodified — which directly conflicted with the then-literal wording of **SEI-AC-09**. This document reflects the bounded correction of that conflict (§9/SEI-AC-09, §12, §26, §29, new DDR-SEI-06, and the affected Failure Modes row) — authorizing exactly one additive wrapper/migration, bounding it against scope expansion, and reconciling the human-path `source_reference` suffix as a **stable logical-action token** (not a server-assigned sequence number, which could not itself provide retry safety). DDR-SEI-01, DDR-SEI-02, DDR-SEI-03's fan-out decision, DDR-SEI-04, and DDR-SEI-05's human/implementation split are unchanged. This document does not itself authorize implementation. A new Final Exact Design Review — Re-run is required before Implementation Authorization may be re-attempted. Governed by the Project Owner's explicit direction to execute this Final Exact Design Gate, following the Next Governed Scope Selection Gate (post-CR-CPS-45) and the A1 Architectural Reconciliation Gate (which found no A1 amendment required and identified this exact gap).

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

A "candidate" is a `(field_key, value, source, confidence, structured_profile status)` tuple read directly from `structured_profile` — no transformation, no inference, no free-text parsing. `value` is the raw material presented for incorporation; it becomes `evidence_items.fact` verbatim only on the deterministic path (§9 Identity fields — see §11, where the field's own value is already one atomic fact by construction). On the human-resolution path, `value` is presented to staff as-is; staff supplies the actual `fact` text for each Evidence Item they choose to create (§13), which may reproduce, excerpt, or correct the candidate's text. One field → one candidate. One candidate → **0..N Evidence Items** (§11) — never fabricated, never algorithmically split by this capability itself.

## 11. Evidence Atomicity (DDR-SEI-03, CORRECTED per independent Final Exact Design Review)

**The canonical unit remains the Evidence Item as one controlled probative unit (§3: "a sufficiently identifiable probative fact," singular).** A Structured Profile field is an **acquisition/storage boundary**, not necessarily an Evidence atomicity boundary — `CRITERION_NARRATIVE_FIELDS` are free-text strings that may, in practice, contain more than one independently identifiable probative fact (e.g. two distinct awards described in one Coach-discovered paragraph). Evidence Item Contract V2 §19 explicitly anticipates this: a source "may reasonably correspond to multiple facts or Evidence Items," and its authorized human-resolution action set includes a repeatable **create Evidence** action.

Therefore:

- **One Structured Profile field = one incorporation candidate.**
- **One incorporation candidate may resolve into 0, 1, or multiple Evidence Items**, according to the number of independently identifiable probative facts a human determines it contains.
- **Deterministic path (`IDENTITY_FIELDS`, §9): always exactly 0 or 1 Evidence Item.** Identity fields (name, DOB, email, etc.) are already atomic by construction — a single value cannot contain multiple independent identity facts under Structured Profile's own schema (one `familyName` field holds one family name). This design does **not** introduce autonomous semantic fan-out into the deterministic path; §9's routing (identity → deterministic, narrative → human resolution) is unchanged, and fan-out is exclusively a property of the human-resolution path.
- **Human-resolution path (`CRITERION_NARRATIVE_FIELDS`, §9): 0..N Evidence Items, staff-determined.** Decomposition of a narrative candidate into distinct probative facts is itself the "material inference" §8/§19 require a human to perform — this design never algorithmically splits text. Each Evidence Item a staff member creates from one candidate is its own explicit, individually-attributed decision (§13), never a system-inferred split.
- **No fabrication**: every resulting Evidence Item's `fact` must be traceable to information actually present in the candidate (or a correction staff explicitly enters); this design authorizes no invention of facts not present in the source, and no autonomous determination of how many USCIS criteria are implicated by a candidate (§20 — criterion relationship remains exclusively A1's).

## 12. Evidence Producer Integration (DDR-SEI-04, RESOLVED — load-bearing)

**Invoke `create_evidence_composition_with_documents()` (migration 028) unmodified for all Evidence creation/supersession. Exactly one small, additive, transactional wrapper function and its one bounded migration are authorized to provide atomic retry/replay protection (§9/SEI-AC-09, §29, DDR-SEI-06) — no new table, no new Evidence identity model, no parallel Producer.**

Parameters:
- `p_evidence_id` / `p_expected_current_id`: `NULL`/`NULL` for first incorporation of a field (new Evidence family); on re-run with Material Change (§43), the existing Evidence Item's `evidence_id`/current `id` (supersession — reuses MTCS-01 versioning, no new dedup mechanism, per §71/EV-57).
- `p_case_id`: from `intake_submissions.case_id`.
- `p_fact`: per §10.
- `p_documentary_condition`: `'reported'` always at creation (§6, §26 — no document exists yet at incorporation time; a CV, if present, is a Case Document association, not proof — §20 below).
- `p_source_type`: `'structured_profile'` (new value; `source_type` is unconstrained free TEXT, confirmed via `migrations/024:78` — zero schema change).
- `p_source_reference`: `'{submission_id}:{field_key}:{structured_profile_source}'` on the deterministic path (e.g. `"a1b2...:familyName:cv_extraction"`) — used as the exact-match lookup key inside the transactional wrapper's (§29, DDR-SEI-06) create-vs-no-op-vs-supersede decision (§18); `source_reference` itself carries no database-level uniqueness constraint (confirmed: `source_type`/`source_reference` are unconstrained free TEXT, migration 024:78-79). On the human-resolution path, `'{submission_id}:{field_key}:{structured_profile_source}:{t}'` where `t` is a **client-generated, stable, per-action token** — generated once by the staff UI at the moment a specific "create Evidence" action for a specific fact is initiated, and reused unchanged if that exact same logical action is retried/replayed (network retry, double-submit). A genuinely new, separate "create Evidence" action (a different fact, or a deliberate second click after successful completion) receives a different token. `t` means only the identity of one logical incorporation action for retry/replay purposes (§29) — it does not mean Evidence identity, fact identity, semantic equivalence, criterion identity, or verification identity (§18/§20/§26). `source_reference` overall remains a **provenance and retry/replay discriminator**, never a database-enforced Evidence identity, semantic dedup key, or universal uniqueness key (§18/§26/SEI-AC-26).
- `p_created_by`: the authenticated Action USA staff actor's `profiles.id` performing the incorporation action (§12 resolves the actor question below — never a beneficiary or invented system profile).
- `p_document_ids`: `NULL`/empty at initial incorporation (§6/EV-10 — Evidence may exist with zero Documents); optionally the CV's canonical `documents.id` if/when the post-Intake canonical-document-convergence process (Section J, already implemented) has produced one, purely as documentary context, never as proof (§20).

**Actor-attribution resolution (the one genuinely load-bearing question this design had to resolve, not invent):** `evidence_items.created_by` and `documents.uploaded_by` both hard-FK to `profiles.id` (`auth.users`-backed). Beneficiaries interact via anonymous tokenized invitation links (confirmed throughout the CLOSED Intake lineage) and have no `profiles` row. The existing Intake CV upload (`src/app/api/intake/upload/route.ts`) already solves an identical problem by never writing a `documents` row during Intake at all — it writes to Storage only, deferring canonical `documents`/`uploaded_by` attribution to the later, staff-triggered "Post-Intake canonical document convergence" process (Section J, already implemented). **This design follows the identical, already-established pattern**: Evidence incorporation from Structured Profile is always triggered inside an authenticated Action USA staff request context (reusing the existing admin/supervisor/assigned-agent authorization pattern already established in `case-letters/route.ts` and reused by `intake-intelligence/complete/route.ts`, per Final Exact Design §5.7 verbatim), never a beneficiary-context or an invented service/system profile. This resolves the question by direct, cited precedent — not invention.

## 13. Human Resolution Boundary

Surfaced in the existing staff exception-resolution surface (`intake-intelligence-section.tsx` / `intake-intelligence/complete` route — already staff-authenticated, already reused-by-reference per §5.7). Two staff-facing actions:

- **Deterministic candidates** (§9 Identity path): presented as a reviewable list; a single staff "Incorporate" action creates Evidence Items for all currently-eligible candidates in one authenticated call. This is not staff *re-deriving* the fact (no material inference by the human) — it is the human authorizing the write, matching §12's actor-attribution resolution and EV-54 (automation must not silently substitute itself for consequential Evidence decisions — the write always requires this explicit staff action, deterministic-eligibility only controls whether staff review is per-field-content or per-batch).
- **Ambiguous candidates** (§9 Narrative path, §19 verbatim): staff may **accept** (creates one Evidence Item as proposed), **correct** (edits `fact` before creation), **reject** (no Evidence created for that fact), **associate** (link to an already-existing Evidence Item instead of creating a new one, per §18 dedup), or **unlink** — reusing §19's exact action set verbatim, including its repeatability. **Create Evidence is repeatable per candidate**: where a candidate contains more than one independently identifiable probative fact, staff invokes create/correct once per fact, each invocation producing its own Evidence Item with its own `source_reference` suffix (§12). A candidate is never forced into a single accept/reject decision when it legitimately contains multiple facts. No new workflow engine — every action reuses the existing, unmodified Producer functions (`create_evidence_composition_with_documents`, `attach_evidence_document`, `update_evidence_fact`); the UI need only expose them per-fact rather than per-candidate.

## 14. Documentary State Rules

Always `'reported'` at creation (§12). This capability never assigns `'partial'` or `'documented'` — those require actual document review, which is A2/staff's existing, unmodified authority (§15/§29 of the Evidence contract). If a CV is later canonically converged into `documents` and associated, Documentary Condition may subsequently be updated by the existing `update_evidence_documentary_condition()` function (migration 024) — outside this design's scope, unmodified.

## 15. Verification State Rules

Always `'pending'` at creation — `create_evidence_composition_with_documents()` hard-codes this (migration 024:189, unconditionally). This design cannot set `'verified'` under any circumstance (EV-19: only an authorized Action USA human, via the existing `review_evidence_composition_if_current()` function, confers `Verified`/`Needs Attention` — untouched, unreachable from this design).

## 16. Evidence ↔ Document Rules

Unmodified M:N (MTCS-03). This design creates Evidence Items with zero or one initial Document association (the canonical CV document, if convergence has already occurred) — never introduces a shortcut column, never assumes 1:1.

## 17. Provenance

`source_type = 'structured_profile'`, `source_reference` encodes submission/field/origin (§12) — reconstructable to the exact Structured Profile field, its original `source` (cv_extraction/coach_discovery/beneficiary_confirmed/staff_entered), and its `confirmed_by`/`confirmed_at` where applicable, satisfying §65/EV-26. Per §66/EV-27, this provenance confers no authority — it is descriptive only.

## 18. Duplicate / Identity / Versioning Rules (corrected for fan-out)

Deterministic and human-resolution paths use distinct, source-consistent mechanisms — fan-out changes neither's underlying identity/versioning machinery (MTCS-01, unmodified), only how `source_reference` is scoped per path (§12):

**Deterministic path (`IDENTITY_FIELDS`)** — the semantic decision is unchanged from the original design; its execution is now atomic (per DDR-SEI-06/§29's transactional wrapper): within one database transaction, the wrapper locks the canonical incorporation context (the `intake_submissions` row, an already-existing table — serializing all incorporation activity for that submission, closing the concurrent "both see no row, both create" race), then looks up an existing `currency_status = 'current'` row with the same `case_id` and exact `source_reference` (`{submission_id}:{field_key}:{source}`, no suffix — always 0 or 1 candidate-to-Evidence mapping, §11). If found and `fact` is unchanged: no-op (genuine, atomicity-backed idempotency). If `fact` differs: Material Change — supersede via `create_evidence_composition_with_documents()` with `p_evidence_id`/`p_expected_current_id` set to the existing row's identity (existing, unmodified `create_evidence_composition()` logic, invoked by the wrapper). If not found: create new (`p_evidence_id`/`p_expected_current_id` both `NULL`).

**Human-resolution path (`CRITERION_NARRATIVE_FIELDS`)** — two distinct concerns, precisely separated (identified by independent Final Exact Design Review; the corrected design does not collapse them):

- **Semantic duplicate avoidance — HUMAN-CONTROLLED, source-established.** The system never auto-creates Evidence without an individual, attributed staff action, and existing Evidence Item(s) already traceable to a candidate (via `source_reference` prefix) are shown to staff for context before they act (§13). Staff — not the system — determines whether a re-presented or newly-reviewed candidate represents an already-captured fact, a correction, a Material Change, an additional independent fact, or nothing actionable. The system never autonomously determines that two differently-worded facts are semantically equivalent (per EV-54/§68 — human authority for consequential Evidence decisions is not delegated to automation; no content-hash or text-equivalence rule is introduced, per EV-56/§70's prohibition on inventing new physical apparatus beyond what the contract requires). This is the intended, source-correct behavior — not a gap.
- **Request-level retry/replay idempotency — mechanism class RECONCILED per Implementation Authorization Gate finding (DDR-SEI-06); exact physical mechanics remain Implementation-determined.** No parameter of the existing, unmodified `create_evidence_composition_with_documents()`/`create_evidence_composition()` (migrations 024/028) provides an idempotency key, and no UNIQUE constraint exists on `source_reference` or any combination involving it — this remains true and unchanged; the existing Producer alone was never sufficient. Genuine atomicity requires the lock/lookup/create-or-supersede sequence to execute within one database transaction (separate application-layer round-trips cannot provide this guarantee). The reconciled mechanism class (§29, SEI-AC-09): one small, additive, transactional wrapper function that locks the canonical `intake_submissions` row, performs the exact-match `source_reference` lookup against the caller's client-generated stable token (§12), and invokes the existing Producer unmodified for create/no-op/supersede — never authorized to perform autonomous semantic deduplication (which remains the human-controlled concern in the bullet immediately above).

Neither concern weakens DDR-SEI-03: fan-out (§11) remains staff-driven and unrestricted; this section only corrects what guarantee level accompanies it.

**Re-run after a narrative candidate's value changes, when Evidence Items already exist from it**: the system never auto-decides whether this is a correction to an existing fact (supersession) or an additional distinct fact (fan-out) — that determination is itself the "material inference" §19 reserves for staff. The candidate is re-presented to staff alongside the Evidence Item(s) already created from it for context; staff then explicitly chooses, per fact: **correct** an existing Evidence Item (`update_evidence_fact()`, a pure text correction, no new version) or **supersede** it (`create_evidence_composition_with_documents()` with `p_evidence_id`/`p_expected_current_id` set, a Material Change new version) or **create** an additional, new Evidence Item (fan-out) alongside the unchanged existing one(s). No new identity scheme is introduced in either case — every write reuses MTCS-01's existing versioning mechanism (EV-57).

## 19. Existing Verified Evidence Protection

Per EV-21, if an existing current Evidence Item created by this capability is already `Verified` and Structured Profile now presents a differing value: **Material Change still applies** — a new version is created, `verification_condition` reverts to `Pending` on the new current version (existing, unmodified `create_evidence_composition()` behavior — verification fields are never copied forward). The historical `Verified` version is preserved unchanged (EV-40, no silent overwrite). On the deterministic path this supersession is system-triggered (§18, exact-match `source_reference`, no material inference required). On the human-resolution path it is always staff-triggered per §18's re-run handling — the system never auto-supersedes a `Verified` narrative Evidence Item; staff explicitly chooses to correct/supersede/fan-out. Neither path ever marks a composition `Needs Attention` itself — that remains exclusively an authorized-human action (§35/EV-19); the new `Pending` state is simply visible to staff through the existing verification queue.

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
| Replayed/retried logical create action (same stable token) | NO-OP — wrapper's atomic lookup recognizes the already-resolved action (§18/§26, DDR-SEI-06); zero duplicate Evidence Item |
| Concurrent incorporation attempts for the same submission | Serialized by the wrapper's lock on `intake_submissions` (§29, DDR-SEI-06); no double-create race |

## 26. Idempotency (reconciled — mechanism class established, DDR-SEI-06)

Both paths execute through the one authorized transactional wrapper (§9/SEI-AC-09, §29): the wrapper's lock on the canonical `intake_submissions` row serializes all incorporation activity for a given submission, closing the concurrent "both see no row, both create" race for either path within one atomic transaction.

**Deterministic path**: re-runs of the batch action against unchanged Structured Profile produce zero new rows, including under concurrent/retried execution (§18's exact `source_reference` lookup, now performed inside the atomic wrapper rather than as a separate application-level query); a changed value produces exactly one new version, never a duplicate.

**Human-resolution path**: two distinct guarantees, not one collapsed claim (§18):
- **Semantic duplicate avoidance is HUMAN-CONTROLLED and source-established** (EV-54/§68) — the system never auto-creates Evidence without an individually-attributed staff action, and existing related Evidence is surfaced to staff for context before they act. The wrapper never compares fact text for meaning.
- **Request-level retry/replay idempotency is provided by the wrapper**, keyed on the client-generated stable per-action token (§12) — the same logical "create Evidence" action, if replayed (network retry, double-submit), reaches the wrapper's atomic lock+lookup and is recognized as already-resolved, producing no second Evidence Item. A genuinely new, separate "create Evidence" action (different token) is unaffected and may still create its own Evidence Item, including fan-out siblings from the same candidate. Exact SQL mechanics of the wrapper remain Implementation-determined; only the mechanism class (one atomic wrapper, existing Producer invoked unmodified, no semantic-equivalence authority) is established here.

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
9. **SEI-AC-09 (reconciled per Implementation Authorization Gate finding, DDR-SEI-06)**: No new Evidence table, Evidence identity model, Evidence lifecycle, verification mechanism, or parallel Evidence Producer is introduced. Implementation may introduce **exactly one** small, additive, transactional database wrapper function — through **exactly one** bounded migration — solely to provide atomic Structured Profile → Evidence incorporation and retry/replay concurrency protection. The wrapper MUST invoke the existing MTCS-04 Evidence Producer (`create_evidence_composition_with_documents()`, `create_evidence_composition()`) unmodified for all Evidence creation/supersession — it may not reproduce or fork Producer logic. No additional database function, table, column, Evidence state, or parallel persistence mechanism beyond this one wrapper is authorized by this design.
10. **SEI-AC-10**: Every Evidence Item this capability creates or supersedes uses the existing Evidence↔Document M:N association mechanism, never a new shortcut.
11. **SEI-AC-11**: Human Verification is reachable only through the existing, unmodified `review_evidence_composition_if_current()` path.
12. **SEI-AC-12**: Re-runs of the deterministic-path batch action against unchanged Structured Profile create zero new rows, including under concurrent/retried execution (guaranteed by the atomic wrapper, SEI-AC-25); on the human-resolution path, no Evidence Item is ever created without an explicit, individually-attributed staff action, regardless of how many times a candidate is re-presented, and a replayed logical action creates zero additional Evidence Items (SEI-AC-25).
13. **SEI-AC-13**: An already-`Verified` Evidence Item is never silently overwritten; a differing Structured Profile value creates a new version and reverts only the current composition to `Pending` — system-triggered on the deterministic path, staff-triggered on the human-resolution path.
14. **SEI-AC-14**: No A1, A5, or Blueprint execution is triggered by this capability under any condition.
15. **SEI-AC-15**: A1 continues to function identically and requires zero code modification.
16. **SEI-AC-16**: A2 is not invoked or modified by this capability.
17. **SEI-AC-17**: The CLOSED Intake Intelligence Layer (Coach, A0, Structured Profile, Prefill Engine, Automated Readiness, Intake Complete, R-01, R-02) is not modified.
18. **SEI-AC-18**: AKAE, ALKA, AILA, AEPE are not referenced or modified.
19. **SEI-AC-19**: Every write executes inside an authenticated, case-authorized Action USA staff request; no write is attributable to a beneficiary or an invented system actor.
20. **SEI-AC-20**: Production is not touched by this design or its eventual implementation authorization.
21. **SEI-AC-21**: A human-resolution-path candidate containing multiple independently identifiable probative facts may yield multiple Evidence Items (0..N), each individually staff-created and staff-attributed; no candidate is forced into a single accept/reject decision that would fabricate a merged, non-atomic Evidence Item or silently drop a distinct fact.
22. **SEI-AC-22**: The deterministic path never fans out — an `IDENTITY_FIELDS` candidate always yields exactly 0 or 1 Evidence Item.
23. **SEI-AC-23**: Every Evidence Item produced by fan-out remains traceable, via `source_reference`, to the exact originating Structured Profile candidate, without implying it originated from a different source field.
24. **SEI-AC-24**: No component of this capability autonomously determines that two differently-worded facts are semantically equivalent; the system may surface existing related Evidence for staff context, but the decision to treat a candidate as a duplicate, correction, supersession, or new fact remains exclusively a staff action.
25. **SEI-AC-25 (reconciled per DDR-SEI-06)**: This design authorizes exactly one small, additive, transactional database wrapper — and no other new UNIQUE constraint, idempotency-key column, table, content hash, or resolution-log entity — as the sole physical mechanism for request-level retry/replay-idempotency; the wrapper invokes the existing, unmodified Evidence Producer for all Evidence creation/supersession (§29), consistent with Evidence Item Contract V2 §70's assignment of physical mechanism selection to Implementation Reconciliation.
26. **SEI-AC-26**: `source_reference` is documented and used strictly as a provenance/traceability field; no design section implies it functions as a database-enforced identity, dedup, or idempotency key.

## 29. Implementation Boundary

This document authorizes no code, schema, or Production change. Next required act: a new Final Exact Design Review — Re-run (this document changed materially since its last passing review), then, if that passes, Implementation Authorization Gate — Re-run.

**Implementation Reconciliation result (DDR-SEI-06, reconciled per the completed Implementation Authorization Gate):** genuine retry/replay atomicity requires the lock/lookup/create-or-supersede sequence (§18) to execute within one database transaction — separate application-layer round-trips cannot provide this guarantee, and the existing Producer alone provides no idempotency key or unique constraint (confirmed by direct schema inspection of migrations 024/028). The reconciled, bounded mechanism class:

- **Exactly one** small, additive, transactional PL/pgSQL wrapper function, through **exactly one** bounded migration (SEI-AC-09) — following the same established pattern already used once in this exact subsystem (`create_evidence_composition_with_documents()` itself wraps `create_evidence_composition()`; this wrapper follows an identical shape).
- The wrapper's bounded responsibility: (1) lock the canonical incorporation context — the existing `intake_submissions` row for the given submission, serializing all incorporation activity per submission without any new schema; (2) perform the exact-match `source_reference` lookup (§12, §18); (3) distinguish no-existing-Evidence / existing-unchanged / existing-materially-changed; (4) invoke the existing, unmodified Producer accordingly for create, no-op, or supersession; (5) guarantee atomicity against concurrent execution or replay of the same logical action.
- The wrapper MUST invoke the existing Producer unmodified — it may not reproduce or fork Producer logic (SEI-AC-09).
- The wrapper is never authorized to perform autonomous semantic-equivalence judgment between differently-worded facts (§18, §20) — that remains exclusively staff's decision.
- No new table, column, Evidence state, persistent Candidate/resolution-log entity, or additional database function beyond this one wrapper is authorized by this design (SEI-AC-09, SEI-AC-25).

Exact SQL mechanics (function name, parameter ordering, precise locking syntax, API route naming, UI placement) remain Implementation-determined, unless already source-established elsewhere in this document.

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

### DDR-SEI-03 — Evidence atomicity (CORRECTED — see independent Final Exact Design Review)
**Question**: Field-to-Evidence-Item cardinality?
**Source**: §3 (Evidence Item = one controlled probative unit — "a sufficiently identifiable probative fact," singular); §19 (a source "may reasonably correspond to multiple facts or Evidence Items"; repeatable "create Evidence" among the authorized human-resolution actions).
**Original decision (superseded)**: 1:1, no fan-out, no aggregation — found by independent review to contradict §19's explicit anticipation of multi-fact sources, and to fail the Implementation Determinism Test (two engineers could reasonably diverge on whether a rich narrative candidate's second fact is silently dropped or captured).
**Corrected decision**: One Structured Profile field = one incorporation candidate. One candidate resolves into **0..N Evidence Items**. The deterministic path (`IDENTITY_FIELDS`) never fans out (0 or 1 only, by construction — a single identity value cannot contain multiple independent identity facts). The human-resolution path (`CRITERION_NARRATIVE_FIELDS`) may fan out, exclusively through individually-attributed staff action (§13) — decomposition of free text into distinct probative facts is itself the "material inference" §8/§19 reserve for humans; this design never algorithmically splits text.
**Rationale**: Directly source-required, not a convenience simplification — §19's own text already resolves the question; the original 1:1 rule was an unjustified narrowing the review correctly caught.
**Effect**: §9 (Candidate Fact Extraction), §11 (Atomicity), §12 (`source_reference` per-Evidence suffix), §13 (repeatable create Evidence), §18 (dedup/versioning per path), §19 (Verified Evidence protection per path), §26 (idempotency per path), SEI-AC-12/13/21/22/23.
**STATUS**: RESOLVED (corrected).

### DDR-SEI-04 — Actor attribution for `created_by` (load-bearing)
**Question**: `evidence_items.created_by`/`documents.uploaded_by` hard-FK to `profiles.id` (`auth.users`-backed); beneficiaries have no `profiles` row. Who is attributed?
**Source**: `supabase/schema.sql` (profiles/documents FK), existing Post-Intake canonical document convergence pattern (Section J, already implemented), Final Exact Design §5.7 (existing admin/supervisor/assigned-agent staff-authorization pattern, reused by reference).
**Decision**: Every incorporation write executes inside an authenticated Action USA staff request; `created_by` is always that staff member's `profiles.id`. Never a beneficiary context, never an invented system/service profile.
**Rationale**: Direct precedent — the existing Intake CV-upload path already defers exactly this same `profiles.id` attribution problem to the identical staff-triggered convergence pattern; this design follows it rather than inventing a new actor model.
**Effect**: §12, §24.
**STATUS**: RESOLVED.

### DDR-SEI-05 — Human-path idempotency precision (added per independent second-order review)
**Question**: Does the corrected human-resolution path (DDR-SEI-03) actually guarantee "no duplicate Evidence Item," as originally worded in §18/§26?
**Source**: Direct schema inspection (migrations 024/028 — no idempotency-key parameter on either Producer function, no UNIQUE constraint on `source_reference` or any combination involving it); EV-54/§68 (human authority for consequential Evidence decisions); Evidence Item Contract V2 §70 (physical implementation mechanisms — constraints, idempotency tokens, locks — are explicitly not prescribed by the contract, deferred to "Implementation Reconciliation against the existing tested AUSCIS runtime").
**Decision**: The single combined claim is split into two: (1) **semantic duplicate avoidance is human-controlled and source-established** (staff sees existing related Evidence before acting; the system never autonomously judges two differently-worded facts equivalent) — not a gap; (2) **request-level retry/replay idempotency is not guaranteed by the existing Producer and is explicitly deferred to Implementation Reconciliation**, per §70 — this design selects no physical mechanism for it.
**Rationale**: The original combined wording overclaimed a guarantee the cited mechanism (`source_reference`) does not structurally provide; §70 directly and explicitly assigns this class of mechanism to Implementation, not to this Final Exact Design — so the fix is precision of language and an explicit Implementation Reconciliation requirement, not new architecture and not a Project Owner policy decision.
**Effect**: §2, §12, §18, §26, §29, SEI-AC-12/24/25/26.
**STATUS**: RESOLVED (precision correction).

### DDR-SEI-06 — Retry/replay physical mechanism class (added per Implementation Authorization Gate's Implementation Reconciliation)
**Question**: DDR-SEI-05 deferred physical retry/replay mechanism selection to Implementation Reconciliation, per Evidence Item Contract V2 §70. What mechanism class does that reconciliation require, and is it compatible with the frozen SEI-AC-09?
**Source**: Direct repository inspection of existing dedup/idempotency patterns before designing anything new (per EV-57/§71 reuse principle) — `documents_case_bucket_path_key` (migration 025, a genuine UNIQUE-index-based dedup guard), `evidence_item_documents`'s `INSERT ... ON CONFLICT (evidence_item_id, document_id) DO NOTHING` (migrations 027/028), and `FOR UPDATE` row-locking (established 10x across migrations 024/028 — but confirmed insufficient alone, since it only protects already-existing rows, not the "both see no row, both create" race).
**Finding**: genuine atomicity for the lock/lookup/create-or-supersede sequence (§18) requires execution within one database transaction; separate application-layer round-trips cannot provide it. The minimum, precedent-consistent mechanism is one small, additive, transactional wrapper function — following the identical shape already used once in this subsystem (`create_evidence_composition_with_documents()` wrapping `create_evidence_composition()`) — that locks the existing `intake_submissions` row (zero new schema for this step) and invokes the existing, unmodified Producer. This is a new database function and requires one migration, which directly conflicted with SEI-AC-09's prior absolute wording.
**Decision**: SEI-AC-09 corrected to authorize exactly one such wrapper through exactly one bounded migration, while continuing to prohibit any new table, Evidence identity model, Evidence lifecycle, verification mechanism, or parallel Producer. The human-path `source_reference` suffix (§12) is reconciled from a server-assigned sequence number (which could not itself provide retry safety) to a client-generated, stable, per-action token.
**Rationale**: SEI-AC-09's evident underlying intent — prevent a new parallel Evidence system — is fully preserved; only its literal "zero migration" sub-clause, written before this reconciliation occurred, needed updating to reflect the Implementation Reconciliation §70 itself anticipated. Not a Project Owner policy decision — source-determinable from existing repository precedent.
**Effect**: §2, §9/SEI-AC-09, §12, §18, §25 (Failure Modes), §26, §29, SEI-AC-12/25.
**STATUS**: RESOLVED.
