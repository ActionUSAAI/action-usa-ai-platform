# AUSCIS Intake Intelligence Layer — Final Exact Design

**Status:** FROZEN. Governing authority: CR-CPS-33 (Post-Materialization Architectural Reconciliation, AUTHORIZED ARCHITECTURAL EVOLUTION) + CR-CPS-34 (this Final Exact Design, three live Project Owner decisions). Registered 2026-09-17.

**Implementation status: NOT IMPLEMENTED.** This document is architecture only. A separate Implementation Authorization Gate is required before any code, schema, or Production change.

---

## 1. Identification

```
Domain:            AUSCIS
Act type:          FINAL EXACT DESIGN
Governing entry:   CR-CPS-33 — AUTHORIZED ARCHITECTURAL EVOLUTION
Reconciles:        CR-CPS-32 "A0 — CV Extractor & Intake Prefill" (preserved as
                    historical truth, not rewritten)
Subject:           AUSCIS Intake Intelligence Layer
Components:        Coach, CV, A0, Structured Profile, Prefill Engine, Intake,
                    Intake Complete
Downstream:        A1 → A2 → A3 → A4 → A5 (UNCHANGED)
```

## 2. Authority

Frozen/authoritative sources consulted (highest tier first):

- `docs/AUCIS_EVIDENCE_ITEM_CONTRACT_V2.md` — FROZEN. §7 (Authorized Origination), §8 (Automated Creation Boundary), §18/§19 (Deterministic vs. Ambiguous Incorporation) directly govern the Evidence-relationship question resolved in §13 below.
- `docs/CANONICAL_PROJECT_STATE.md` Section B (P-11–P-14), Section K (Client Experience State, corrected by CR-CPS-33).
- `docs/AUCIS_CV_COACH_INTEGRATION.md` — CURRENT DESIGN, primary source for Coach/A0/mapping/confidence-tiering language.
- `docs/AUCIS_V2_STRATEGY_LAYER.md` — A0 naming/layer authority ("A1 mide — nunca decide estrategia").
- `supabase/migrations/001_aucis_intake.sql`, `007`, `026` — IMPLEMENTATION RECORD, `intake_submissions` schema.
- Project Owner, live in this act — DDR-CV-01, DDR-TRIGGER-01, DDR-CONFIRM-01.

## 3. Mission

> Acquire, discover, structure, and complete beneficiary information to build a sufficiently complete and structured representation of the beneficiary before handing the case to the AUSCIS analytical pipeline.

Stage 1 never adjudicates, scores eligibility, verifies Evidence, or sets case strategy. A1 remains the sole criterion-assessment authority.

## 4. Topology

```
Beneficiary
  → Coach (conversational discovery — integrated AUSCIS Stage 1 capability)
  → CV (Coach-generated PDF; MANDATORY entry gate — DDR-CV-01)
      → A0 (CV Extractor; extraction triggered AUTOMATICALLY on upload — DDR-TRIGGER-01)
        → Structured Profile (new, provenance-tagged intermediate representation)
          → Prefill Engine (conflict-safe mapping into existing Intake modules)
            → Intake (existing intake_submissions modules — UNCHANGED shape)
              → Human Confirmation (BENEFICIARY reviews first — DDR-CONFIRM-01;
                 staff retains override authority at any point)
                → Intake Complete (intake_submissions.status = 'complete')
                  → A1 (UNCHANGED) → A2 (UNCHANGED) → A3 (UNCHANGED)
                    → A4 (UNCHANGED) → A5 (UNCHANGED)
```

## 5. Component contracts

### 5.1 Coach

Integrated AUSCIS Stage 1 capability performing intelligent, adaptive conversational discovery. Probes scope, impact, responsibility, complexity, corroboration; counters beneficiary minimization language; never invents, exaggerates, or coaches false answers. Authority: discovery only — no criterion adjudication, no Evidence Verification, no strategy authority (P-14 reinforced, unmodified).

### 5.2 CV

Coach-generated PDF (13 fixed sections). Entry is **mandatory** before the beneficiary may proceed past Module0 (DDR-CV-01). A non-Coach-format (free-form) upload is accepted as a Case Document but produces **no automated prefill** in this design's scope — it is out of MVP scope, not a supported extraction path (scope-narrowing consistent with Evidence Item Contract V2 §19's ambiguous-incorporation rule and P-09 Material Necessity). The uploaded PDF is retained as a Case Document (consistent with Evidence Item Contract V2 §12/§20 — this system never discards originating source documents).

### 5.3 A0 — CV Extractor

Input: CV (Coach-format PDF). Extraction runs automatically on upload (DDR-TRIGGER-01). Output: Structured Profile. Performs extraction/structuring only — never criterion evaluation, eligibility scoring, or legal reasoning. A1 boundary unchanged ("A1 mide — nunca decide estrategia").

A0 is an explicitly **authorized Evidence origination channel** under the FROZEN Evidence Item Contract V2 §7. See §13.

### 5.4 Structured Profile

**Persistence model:** new additive JSONB column `structured_profile` on the existing `intake_submissions` table (Model SP-B). No new table, no new RLS surface — directly consistent with this repository's own precedent (migration 007's additive `module14`/`module15` columns; migration 026's additive `invitation_id` column).

**Shape (per field):**
```json
{
  "value": "...",
  "source": "cv_extraction | coach_discovery | beneficiary_confirmed | staff_entered",
  "confidence": "high | medium | low",
  "confirmed": false,
  "confirmed_by": null,
  "confirmed_at": null
}
```
Synthesized from `AUCIS_CV_COACH_INTEGRATION.md` §4's confidence-tiering language and Module10's existing per-item `source` field idiom — not invented independently of source.

Structured Profile ≠ Evidence Item. Structured Profile ≠ Criterion Assessment.

### 5.5 Prefill Engine

Consumes Structured Profile, maps into existing `intake_submissions` module columns (`module1` identity fields, `module5` formal education — see §14 correction, `module10` per-criterion evidence arrays, etc.).

**Conflict policy** (source-determined from `AUCIS_CV_COACH_INTEGRATION.md` §4):
- Never silently overwrite an existing beneficiary- or staff-entered value.
- High-confidence identity-class fields (name, email, dates) auto-fill only into still-empty fields.
- Narrative/criterion-evidence fields populate flagged `"extraído automáticamente — revisar antes de continuar"`.
- Content the Coach itself marked `"[Pendiente de verificar]"` is **never** pre-filled as ready evidence.

Exact per-field JSON mapping (e.g. `judging[]` array precision) is IMPLEMENTATION-DETERMINED — deferred to Implementation, per the source document's own "punto de partida conceptual" caveat.

### 5.6 Intake

Existing `intake_submissions` table and Module1–Module15 UI. **Unchanged in shape.** Prefill Engine writes into it; nothing about its existing contract changes.

### 5.7 Human Confirmation

Beneficiary reviews and confirms pre-filled/discovered information first (DDR-CONFIRM-01). Staff retains override/correction authority at any point, using the same authorization pattern already established in `src/app/api/case-letters/route.ts` (`admin`/`supervisor` role, OR the case's assigned agent). Beneficiary confirmation produces "beneficiary-confirmed case information" — never, by itself, a Verified Evidence Item.

### 5.8 Intake Complete

**Runtime representation:** `intake_submissions.status = 'complete'`. This value already exists in the live `CHECK` constraint (migration 001) and is confirmed, by direct inspection, to be set or read by **zero** current code paths — adopting it requires **no schema change** and creates no behavioral conflict.

Transition: `'submitted'`/`'processing'` → `'complete'`, set once governed completeness criteria are satisfied (required identity fields present; Coach discovery completed or intentionally waived; Prefill reviewed; beneficiary confirmation obtained). Form completeness (non-empty fields) ≠ acquisition completeness (sufficient discovery) — the latter governs this transition.

**A1 impact: none.** `src/app/api/agents/a1-intake-analyzer/route.ts` already reads `intake_submissions` via unconditional `select("*")` with no status gate — A1 requires zero modification.

## 6. Evidence boundary (DDR-EV-01 — source-determined)

The FROZEN `AUCIS_EVIDENCE_ITEM_CONTRACT_V2.md` already governs this exactly; nothing new is invented here:

- §7 explicitly names **"A0 CV extraction"** as an authorized Evidence-originating channel.
- §8: automation may formally create an Evidence Item only when (1) an authorized source exists, (2) the probative fact is sufficiently identifiable, (3) no material inference is required, (4) provenance is preserved — otherwise automation "must produce a proposal for human resolution."
- §18/§19: deterministic (non-interpretive) incorporation may auto-create; ambiguous/interpretive incorporation must route to human resolution.

**Applied:** A0's direct, non-interpretive CV extractions (e.g. name, dates, a directly-stated award title) MAY be incorporated as `Reported` / Human-Verification-`Pending` Evidence Items, with provenance preserved (`source=cv_extraction`). Coach-discovered, interpreted, or quantified narrative facts (which necessarily involve interpretation) instead surface as a proposal for human resolution — they become Evidence-eligible only after human (beneficiary/staff) confirmation, per §19.

Case Information ≠ Evidence (P-11). Document ≠ Evidence Item (P-12). Both reinforced, not modified.

## 7. Contradiction handling

Source-determined via Evidence Item Contract V2 §19's pattern, applied to Stage 1: **DETECT → PRESERVE ALL SOURCES → ASK FOR CLARIFICATION (Coach) OR SURFACE TO HUMAN → RECORD RESOLUTION OR EXPLICIT UNRESOLVED-CONFLICT STATE.** No silent harmonization between CV, Coach, and existing Intake values.

## 8. Failure modes

| Failure | Behavior |
|---|---|
| No CV uploaded | BLOCK — Module0 mandatory |
| Invalid/unreadable CV | FLAG + require human review |
| Non-Coach-format CV | Accept as Case Document; zero automated prefill |
| CV extraction failure | Retry once, then flag for staff; manual Intake continuation allowed |
| Low extraction confidence | Field flagged for review, never auto-confirmed |
| Coach session interrupted | Resumable; no loss of already-confirmed facts |
| Beneficiary refuses a Coach follow-up | Allow manual continuation; area explicitly flagged, never silently marked complete |
| Conflicting information | Preserve all sources, require human resolution |
| Incomplete Structured Profile | Prefill maps only what exists; missing fields stay explicitly unfilled |
| Prefill mapping unavailable | Field left for manual entry, never silently dropped |
| Existing Intake value conflict | Never silently overwritten |
| Intake incomplete | `status` never auto-promoted to `'complete'` |
| System failure at any stage | Flagged; never fabricates completion |

## 9. Non-interference

A1, A2, A3, A4, A5: **UNCHANGED.** No Stage 1 component modifies Criterion Assessment, Case Blueprint, A3 letters, A4 petition assembly, or A5 strategy. AKAE and AEPE: untouched. Stage 1 improves input quality; it does not gain downstream authority.

## 10. Design corrections made during this act

- **Education destination (source correction, not a decision):** `AUCIS_CV_COACH_INTEGRATION.md` §3 states Education has "sin destino directo hoy en el modelo." Direct inspection of `supabase/migrations/001_aucis_intake.sql` confirms `module5` ("Formal education") has existed since before that document was written. Education maps to `module5`. This corrects a stale claim in the source document against current schema; it is not a new architectural decision.

## 11. Acceptance criteria

1. Coach is integrated as an AUSCIS Stage 1 capability, not external.
2. Coach performs adaptive discovery; does not adjudicate criteria, verify Evidence, or set strategy.
3. Module0/CV upload is mandatory before Module1.
4. A0 extraction triggers automatically on CV upload.
5. A0 produces Structured Profile (`intake_submissions.structured_profile`), not direct Module writes.
6. Structured Profile preserves per-field provenance (source, confidence, confirmed state).
7. Prefill Engine never silently overwrites existing beneficiary/staff-entered Intake values.
8. Beneficiary reviews/confirms discovered and prefilled information before staff.
9. Intake Complete is represented by `intake_submissions.status = 'complete'` (no new column).
10. A1 requires zero modification and continues to function identically.
11. A2, A3, A4, A5 require zero modification.
12. Acquired/discovered information is not automatically a Verified Evidence Item; only A0's non-interpretive extractions may be `Reported`/`Pending`; Coach-discovered facts require human confirmation first.
13. Failures never fabricate `Intake Complete`.
14. AKAE, AEPE, and Production remain untouched by this act.

## 12. Name canonization

`AUSCIS Intake Intelligence Layer` is CANONIZED as the name for this Stage 1 grouping. No conflicting or higher-authority term was found in source (Section K names components but not the aggregate; `AUCIS_PLATFORM_ARCHITECTURE.md`'s "Data Plane" layer taxonomy is a different, non-conflicting classification axis). It accurately reflects the Acquire/Discover/Structure/Complete mission.

## 13. Explicit non-goals

- No implementation of any kind.
- No MTCS number inferred or assigned.
- No modification to A1–A5, AKAE, or AEPE.
- No Production access.
- No granular Module10 per-field mapping precision (deferred to Implementation).
- No Coach question-generation mechanism specified (deferred to Implementation).

## 14. Open items

**ZERO** load-bearing open items remain. All Project Owner decisions (DDR-CV-01, DDR-TRIGGER-01, DDR-CONFIRM-01) were resolved live in this act.

## 15. Implementation boundary

Next required act: **Implementation Authorization Gate**, per this project's established MTCS/QA-Engine/Human-Review-Gate precedent. This document does not authorize any code, schema, or Production change.
