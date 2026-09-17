# AUSCIS Intake Intelligence Layer — Final Exact Design

**Status:** FROZEN. Governing authority: CR-CPS-33 (Post-Materialization Architectural Reconciliation, AUTHORIZED ARCHITECTURAL EVOLUTION) + CR-CPS-34 (this Final Exact Design, three live Project Owner decisions with clarifications). Registered 2026-09-17.

**Implementation status: NOT IMPLEMENTED.** This document is architecture only. A separate Implementation Authorization Gate is required before any code, schema, or Production change.

---

## 1. Identification

```
Domain:            AUSCIS
Act type:          FINAL EXACT DESIGN
Governing entry:   CR-CPS-33 — AUTHORIZED ARCHITECTURAL EVOLUTION
Reconciles:        CR-CPS-32 "A0 — CV Extractor & Intake Prefill" (preserved as
                    historical truth, not rewritten)
Refines:           CR-CPS-33's linear topology (Coach → CV → A0 → ...), per live
                    Project Owner clarification obtained in this act (§4) — CR-CPS-33
                    text itself preserved unchanged, not rewritten
Subject:           AUSCIS Intake Intelligence Layer
Components:        Coach, CV, A0, Structured Profile, Prefill Engine, Intake,
                    Human Confirmation, Intake Complete
Downstream:        A1 → A2 → A3 → A4 → A5 (UNCHANGED)
```

## 2. Authority

Frozen/authoritative sources consulted (highest tier first):

- `docs/CANONICAL_PROJECT_STATE.md` Section B (P-01–P-17, especially P-09, P-10, P-11–P-14), Section K (Client Experience State, corrected by CR-CPS-33).
- `docs/AUCIS_EVIDENCE_ITEM_CONTRACT_V2.md` — FROZEN. §7 (Authorized Origination), §8 (Automated Creation Boundary), §12/§20 (Documentary Entry Channels / Case Document classification), §18/§19 (Deterministic vs. Ambiguous Incorporation).
- `docs/AUCIS_CV_COACH_INTEGRATION.md` — CURRENT DESIGN, primary source for Coach/A0/mapping/confidence-tiering language and the four explicitly unresolved design questions.
- `docs/AUCIS_V2_STRATEGY_LAYER.md` — A0 naming/layer authority ("A1 mide — nunca decide estrategia").
- `supabase/migrations/001_aucis_intake.sql` (`intake_submissions` schema, `status` CHECK, `module_progress` three-state vocabulary), `007` (additive-column precedent), `026` (additive-column precedent).
- `src/app/api/agents/a1-intake-analyzer/route.ts` (confirmed unconditional `select("*")`, no status gate — direct evidence of zero A1 impact).
- `src/app/client/dashboard/page.tsx:114` (confirms `module_progress` values are exactly `"empty"` / `"partial"` / `"complete"`, existing production vocabulary).
- `src/app/api/case-letters/route.ts` (existing admin/supervisor-or-assigned-agent staff-authorization pattern, reused by reference for staff review authority).
- Project Owner, live in this act — DDR-CV-01, DDR-TRIGGER-01, DDR-CONFIRM-01 (each with explicit clarifying constraints, see §4, §6, §11).

**Correction to a citation used in an earlier, procedurally-invalid draft of this design (commit b045287, reverted as c0b2cca):** that draft cited Evidence Item Contract V2 §12/§20 as the basis for CV-document retention. Direct re-inspection confirms neither section states a retention/no-discard rule. The correct basis is the project's own top-level governing principle **P-10 — No Automatic Deletion** (Section B), which is general-purpose, not Evidence-specific. Used correctly in §6 below.

## 3. Mission

> Acquire, discover, structure, and complete beneficiary information to build a sufficiently complete and structured representation of the beneficiary before handing the case to the AUSCIS analytical pipeline.

Stage 1 never adjudicates, scores eligibility, verifies Evidence, or sets case strategy. A1 remains the sole criterion-assessment authority.

## 4. Topology

**Refinement of CR-CPS-33's topology, live Project Owner clarification (this act):** CR-CPS-33 stated a linear chain `Coach → CV → A0 → ...`. In this act, the Project Owner clarified that Module0's CV/résumé document gate and Coach's conversational discovery are **two decoupled mandatory tracks**, not a single linear dependency: an existing beneficiary CV satisfies the Module0 upload gate without requiring it to be Coach-generated, and Coach discovery must never be bypassed merely because a CV was uploaded. CR-CPS-33's own text is preserved unchanged as historical record (§1); this section states the current, refined topology.

```
Beneficiary
  ├──→ Coach (conversational discovery — MANDATORY, integrated Stage 1
  │      capability, never bypassed regardless of CV source)
  │        └──→ Coach-discovered facts ─────────────────┐
  │                                                       │
  └──→ Module0 — CV/résumé/professional-profile upload   │
         (MANDATORY gate; Coach-generated PDF OR an       │
          existing beneficiary CV both satisfy it)        │
           └──→ A0 (CV Extractor; runs AUTOMATICALLY       │
                  on upload, regardless of CV source)      │
                    └──→ A0-extracted facts ────────────┐  │
                                                          ▼  ▼
                                                   Structured Profile
                                                   (provenance-tagged)
                                                          │
                                                          ▼
                                                   Prefill Engine
                                                          │
                                                          ▼
                                              Intake (existing modules,
                                                  UNCHANGED shape)
                                                          │
                                                          ▼
                                          Human Confirmation — BENEFICIARY
                                          reviews/corrects/confirms FIRST
                                                          │
                                                          ▼
                                          Staff review (existing
                                          professional-review authority)
                                                          │
                                                          ▼
                                          Intake Complete
                                          (intake_submissions.status='complete')
                                                          │
                                                          ▼
                                A1 (UNCHANGED) → A2 → A3 → A4 → A5 (UNCHANGED)
```

## 5. Component contracts

### 5.1 Coach

Integrated AUSCIS Stage 1 capability performing intelligent, adaptive conversational discovery. Mandatory — never bypassed, including when the beneficiary satisfies the Module0 gate with an existing (non-Coach-generated) CV. Probes scope, impact, responsibility, complexity, corroboration; counters beneficiary minimization language; never invents, exaggerates, or coaches false answers. Authority: discovery only — no criterion adjudication, no Evidence Verification, no strategy authority (P-14 reinforced, unmodified). Coach's own discovered facts feed Structured Profile directly, in parallel with A0's CV-extracted facts, not exclusively through a CV artifact.

### 5.2 CV

A CV/résumé/professional-profile source document. Entry is **mandatory** before the beneficiary may proceed past Module0 (DDR-CV-01). **Two accepted sources, either satisfies the gate:** (a) the Coach-generated fixed-13-section PDF, or (b) an existing beneficiary CV/résumé/professional-profile document. Uploading (b) does **not** exempt the beneficiary from Coach's conversational discovery track (§5.1) — the two are decoupled, both mandatory. Exact accepted MIME types / format validation: IMPLEMENTATION-DETERMINED. The uploaded document is retained as a Case Document per **P-10 (No Automatic Deletion)** — a general project-wide governing principle, not an Evidence-specific one (see correction in §2).

### 5.3 A0 — CV Extractor

Input: whichever CV document was provided in Module0 (Coach-format or existing beneficiary CV). Extraction runs **automatically** on upload, regardless of source (DDR-TRIGGER-01). Output: Structured Profile entries. Performs extraction/structuring only — never criterion evaluation, eligibility scoring, or legal reasoning. A1 boundary unchanged ("A1 mide — nunca decide estrategia").

**Explicit firewall (Project Owner clarification, DDR-TRIGGER-01):** automatic extraction does not constitute beneficiary confirmation, factual verification, Evidence Verification, legal assessment, or criterion adjudication. Extracted information remains `acquired_unconfirmed` (§5.4) until the beneficiary reviews and confirms it (§5.7).

A0 is an explicitly **authorized Evidence origination channel** under the FROZEN Evidence Item Contract V2 §7, uniformly for both accepted CV sources (§7 does not qualify by document subtype). See §6.

Non-Coach-format extraction reliability is not guaranteed to match the fixed-structure Coach PDF; this is an accepted, flagged risk, not a blocking design gap — low-confidence/unmapped fields simply remain `acquired_unconfirmed` with low confidence (§5.4) and require beneficiary/staff attention like any other low-confidence extraction.

### 5.4 Structured Profile

**Persistence model:** new additive JSONB column `structured_profile` on the existing `intake_submissions` table (Model SP-B — architecture-determined by direct precedent: migration 007's additive `module14`/`module15` columns, migration 026's additive `invitation_id` column; no new table, no new RLS surface required).

**Shape (per field):**
```json
{
  "value": "... | null",
  "source": "cv_extraction | coach_discovery | beneficiary_confirmed | staff_entered",
  "confidence": "high | medium | low | null",
  "status": "not_yet_acquired | acquired_unconfirmed | beneficiary_confirmed | conflicting",
  "confirmed_by": null,
  "confirmed_at": null
}
```

`status` is derived directly from this design's own requirements, not invented independently of need: `not_yet_acquired` (default — neither Coach nor A0 has produced a value); `acquired_unconfirmed` (A0 extraction or Coach discovery produced a value, beneficiary has not yet reviewed it — satisfies the explicit DDR-TRIGGER-01 firewall that automatic extraction ≠ confirmation); `beneficiary_confirmed` (beneficiary reviewed and confirmed, per DDR-CONFIRM-01); `conflicting` (CV, Coach, and/or existing Intake values disagree — requires human resolution before it can become `beneficiary_confirmed`, §7). This satisfies the requirement to distinguish absence/uncertainty states rather than collapsing everything into `null` — the field-level `status` carries that distinction; `value` alone may still be `null` under `not_yet_acquired`.

Structured Profile ≠ Evidence Item. Structured Profile ≠ Criterion Assessment.

### 5.5 Prefill Engine

Consumes Structured Profile, maps into existing `intake_submissions` module columns (`module1` identity fields, `module5` formal education — see §9 correction, `module10` per-criterion evidence arrays, etc.).

**Conflict policy** (source-determined from `AUCIS_CV_COACH_INTEGRATION.md` §4, extended by analogy to the general value underlying Evidence Item Contract V2 §40 "No Silent Overwrite" — that principle is Evidence-specific in its literal text, applied here only as a design analogy, not as direct governance):
- Never silently overwrite an existing beneficiary- or staff-entered value.
- High-confidence identity-class fields (name, email, dates) auto-fill only into still-empty fields.
- Narrative/criterion-evidence fields populate flagged `"extraído automáticamente — revisar antes de continuar"`.
- Content the Coach itself marked `"[Pendiente de verificar]"` is **never** pre-filled as ready evidence.

Exact per-field JSON mapping (e.g. `judging[]` array precision) is IMPLEMENTATION-DETERMINED — deferred to Implementation, per the source document's own "punto de partida conceptual" caveat.

### 5.6 Intake

Existing `intake_submissions` table and Module1–Module12(+14+15) UI. **Unchanged in shape.** Prefill Engine writes into it; nothing about its existing contract changes.

### 5.7 Human Confirmation

**Beneficiary reviews first** (DDR-CONFIRM-01), then staff. Sequence:

1. Beneficiary reviews, corrects, supplements, and confirms Coach/A0-discovered and prefilled information.
2. **Explicit firewall (Project Owner clarification):** beneficiary confirmation establishes only that the information accurately reflects what the beneficiary is reporting about their own history. It does **not** constitute Evidence Verification, legal assessment, criterion satisfaction, eligibility determination, or staff approval.
3. Action USA staff review occurs afterward, under its **existing** professional-review authority (same admin/supervisor-or-assigned-agent pattern already established in `src/app/api/case-letters/route.ts` — reused by reference, not modified).

Beneficiary confirmation produces "beneficiary-confirmed case information" (`structured_profile[field].status = "beneficiary_confirmed"`) — never, by itself, a Verified Evidence Item.

### 5.8 Intake Complete

**Runtime representation:** `intake_submissions.status = 'complete'`. This value already exists in the live `CHECK` constraint (migration 001) and is confirmed, by direct inspection, to be set or read by **zero** current code paths — adopting it requires **no schema change** and creates no behavioral conflict.

Transition: `'submitted'`/`'processing'` → `'complete'`, set once governed completeness criteria are satisfied (required identity fields present; Coach discovery completed or intentionally waived; A0 extraction attempted on the mandatory CV; Prefill reviewed; beneficiary confirmation obtained; staff review completed). Form completeness (non-empty fields) ≠ acquisition completeness (sufficient discovery) — the latter governs this transition.

**A1 impact: none.** `src/app/api/agents/a1-intake-analyzer/route.ts:331` already reads `intake_submissions` via unconditional `select("*")` with no status gate — A1 requires zero modification.

## 6. Evidence boundary (DDR-EV-01 — source-determined)

The FROZEN `AUCIS_EVIDENCE_ITEM_CONTRACT_V2.md` already governs this exactly; nothing new is invented here:

- §7 explicitly names **"A0 CV extraction"** as an authorized Evidence-originating channel (applies uniformly to both accepted CV sources — §7 does not distinguish Coach-format from existing-CV format).
- §8: automation may formally create an Evidence Item only when (1) an authorized source exists, (2) the probative fact is sufficiently identifiable, (3) no material inference is required, (4) provenance is preserved — otherwise automation "must produce a proposal for human resolution."
- §12/§20: the uploaded CV enters via the Intake documentary channel as a Case Document; retained per P-10 (§2 correction — not an Evidence-Contract-specific retention rule).
- §18/§19: deterministic (non-interpretive) incorporation may auto-create; ambiguous/interpretive incorporation must route to human resolution.

**Applied:** A0's direct, non-interpretive CV extractions (e.g. name, dates, a directly-stated award title) MAY be incorporated as `Reported` / Human-Verification-`Pending` Evidence Items, with provenance preserved (`source=cv_extraction`). Coach-discovered, interpreted, or quantified narrative facts (which necessarily involve interpretation) instead surface as a proposal for human resolution — they become Evidence-eligible only after human (beneficiary/staff) confirmation, per §19.

Case Information ≠ Evidence (P-11). Document ≠ Evidence Item (P-12). Both reinforced, not modified.

## 7. Contradiction handling

Source-determined via Evidence Item Contract V2 §19's pattern, applied to Stage 1: **DETECT → PRESERVE ALL SOURCES → MARK `structured_profile[field].status = "conflicting"` → ASK FOR CLARIFICATION (Coach) OR SURFACE TO HUMAN → RECORD RESOLUTION (transitions to `beneficiary_confirmed`) OR EXPLICIT UNRESOLVED-CONFLICT STATE.** No silent harmonization between CV, Coach, and existing Intake values.

## 8. Failure modes

| Failure | Behavior |
|---|---|
| No CV uploaded | BLOCK — Module0 mandatory (either accepted source) |
| Invalid/unreadable CV | FLAG + require human review; Module0 gate not satisfied until resolved |
| CV extraction failure (either source) | Retry once, then flag for staff; manual Intake continuation allowed; Module0 gate already satisfied by upload itself, independent of extraction success |
| Low extraction confidence | Field stays `acquired_unconfirmed` with `confidence: "low"`, never auto-promoted to `beneficiary_confirmed` |
| Coach session interrupted | Resumable; no loss of already-confirmed facts |
| Beneficiary refuses a Coach follow-up | Allow manual continuation; area explicitly flagged, never silently marked complete |
| Conflicting information | `status = "conflicting"`; preserve all sources; require human resolution |
| Incomplete Structured Profile | Prefill maps only what exists; missing fields stay `not_yet_acquired` |
| Prefill mapping unavailable | Field left for manual entry, never silently dropped |
| Existing Intake value conflict | Never silently overwritten |
| Intake incomplete | `status` never auto-promoted to `'complete'` |
| System failure at any stage | Flagged; never fabricates completion |

## 9. Design corrections made during this act

- **Education destination (source correction, not a decision):** `AUCIS_CV_COACH_INTEGRATION.md` §3 states Education has "sin destino directo hoy en el modelo." Direct inspection of `supabase/migrations/001_aucis_intake.sql:33` confirms `module5` ("Formal education") has existed since before that document was written. Education maps to `module5`. This corrects a stale claim in the source document against current schema; it is not a new architectural decision.
- **Evidence Item Contract V2 §12/§20 retention citation (process correction):** see §2 — a procedurally-invalid earlier draft of this design over-cited these sections for CV retention; corrected to cite P-10 instead.

## 10. Non-interference

A1, A2, A3, A4, A5: **UNCHANGED.** No Stage 1 component modifies Criterion Assessment, Case Blueprint, A3 letters, A4 petition assembly, or A5 strategy. AKAE and AEPE: untouched. Stage 1 improves input quality; it does not gain downstream authority.

## 11. Acceptance criteria

1. Coach is integrated as an AUSCIS Stage 1 capability, not external; never bypassed regardless of CV source.
2. Coach performs adaptive discovery; does not adjudicate criteria, verify Evidence, or set strategy.
3. Module0/CV upload is mandatory before Module1; either a Coach-generated PDF or an existing beneficiary CV satisfies it.
4. A0 extraction triggers automatically on upload of either accepted CV source.
5. Automatic A0 extraction does not itself constitute beneficiary confirmation, factual verification, Evidence Verification, legal assessment, or criterion adjudication.
6. A0 produces Structured Profile (`intake_submissions.structured_profile`), not direct Module writes.
7. Structured Profile preserves per-field provenance (`source`, `confidence`, `status`, confirming actor/timestamp).
8. Prefill Engine never silently overwrites existing beneficiary/staff-entered Intake values.
9. Beneficiary reviews/confirms discovered and prefilled information before staff review.
10. Beneficiary confirmation does not itself constitute Evidence Verification, legal assessment, criterion satisfaction, eligibility determination, or staff approval.
11. Staff review occurs under its existing, unmodified professional-review authority.
12. Intake Complete is represented by `intake_submissions.status = 'complete'` (no new column).
13. A1 requires zero modification and continues to function identically.
14. A2, A3, A4, A5 require zero modification.
15. Acquired/discovered information is not automatically a Verified Evidence Item; only A0's non-interpretive extractions may be `Reported`/`Pending`; Coach-discovered facts require human confirmation first.
16. Failures never fabricate `Intake Complete`.
17. AKAE, AEPE, and Production remain untouched by this act.

## 12. Name canonization

`AUSCIS Intake Intelligence Layer` is CANONIZED as the name for this Stage 1 grouping. No conflicting or higher-authority term was found in source (Section K names components but not the aggregate; `AUCIS_PLATFORM_ARCHITECTURE.md`'s "Data Plane" layer taxonomy is a different, non-conflicting classification axis). It accurately reflects the Acquire/Discover/Structure/Complete mission.

## 13. Explicit non-goals

- No implementation of any kind.
- No MTCS number inferred or assigned.
- No modification to A1–A5, AKAE, or AEPE.
- No Production access.
- No granular Module10 per-field mapping precision (deferred to Implementation).
- No Coach question-generation mechanism specified (deferred to Implementation).
- No CV multi-version-handling policy (NOT ESTABLISHED from source; flagged, non-blocking, deferred to Implementation).
- No Coach session/conversation retention policy (NOT ESTABLISHED from source, per this project's own instruction not to invent one; flagged, non-blocking, deferred to Implementation).

## 14. Open items

**ZERO load-bearing open items.** All three genuine, source-flagged, no-default Project Owner decisions (DDR-CV-01, DDR-TRIGGER-01, DDR-CONFIRM-01) were resolved live in this act, each with an explicit Project Owner clarification incorporated verbatim into the relevant component contract (§5.1–§5.4, §5.7). Two non-blocking, explicitly-flagged NOT ESTABLISHED items remain (CV version handling, Coach session retention) — consistent with this act's own instruction not to invent policy where none is source-required.

## 15. Implementation boundary

Next required act: **Implementation Authorization Gate**, per this project's established MTCS/QA-Engine/Human-Review-Gate precedent. This document does not authorize any code, schema, or Production change.
