# AUSCIS Intake Intelligence Layer — Post-Implementation Architectural Reconciliation (R-01 + R-02)

**Status:** CANONIZED — PROSPECTIVE ARCHITECTURAL EVOLUTION. Governing authority: CR-CPS-37. Registered 2026-09-18.

**Relationship to CR-CPS-34:** this document does NOT rewrite, invalidate, or retroactively reinterpret `docs/AUSCIS_INTAKE_INTELLIGENCE_LAYER_FINAL_EXACT_DESIGN.md` (SHA256 `51928f1d53a6249a8a5117ac8d8b58dac037645314ee658ff83fbfc7d1eef981`, unchanged, unmodified by this act). That document remains the historically accurate record of what was frozen on 2026-09-17 and what CR-CPS-35/36 authorized and implemented against. This document records two subsequent, explicit Project Owner decisions (R-01, R-02) that prospectively supersede specific provisions of that design, identified precisely in §4 below.

**Implementation status: NOT IMPLEMENTED.** Commit `7342c10` (CR-CPS-36) implements the *original* CR-CPS-34 model faithfully — mandatory CV, mandatory universal staff review. The delta required to realize R-01/R-02 is catalogued in §7 but not built. No application code, schema, or migration is authorized or changed by this document.

---

## 1. Project Owner Decisions (verbatim authority)

### R-01 — CV Acquisition Path

```
CV / résumé / professional profile = OPTIONAL ACQUISITION ACCELERATOR.
CV is optional. Information completeness is not optional.
```

A beneficiary must not be prevented from completing Stage 1 solely for lack of a CV. Coach remains mandatory on both paths. Absence of a CV does not lower the information standard — it shifts more acquisition burden onto Coach + intelligent Intake. No fabrication, no inference, no assumption to manufacture completeness.

### R-02 — Human Review Gate

```
MODEL C: AUTOMATED READINESS + EXCEPTION-BASED HUMAN REVIEW (current default)
        + FUTURE TENANT-OPTIONAL MANDATORY-REVIEW POLICY (architectural
          extension point only, NOT ESTABLISHED, not implemented now)
```

Current AUSCIS default: a deterministic, automated readiness check runs at beneficiary submission. Clean intakes proceed to A1 without a mandatory staff action. Intakes with a detected informational exception route to human review (`Needs Attention`, reusing the existing Evidence Item Contract V2 §34 vocabulary). Universal per-case staff approval is no longer the default.

Both decisions were made directly, live, by the Project Owner in this governed act, reversing (R-01) and elaborating (R-02) specific CR-CPS-34 provisions identified in §4.

## 2. Two AUSCIS Stage 1 principles (canonized, AUSCIS-only)

**Minimum Friction Acquisition Principle:** AUSCIS acquires Stage 1 information through the lowest-friction authorized combination of available sources; information already acquired through one authorized channel is never re-requested merely because another channel was unused. Does not authorize fabrication, unsupported inference, silent conflict resolution, reduced completeness, or Evidence Verification bypass.

**Exception-Based Human Intervention Principle:** human intervention in Stage 1 occurs to resolve an informational exception, or where a separately authorized tenant policy expressly requires review — never merely to repeat a deterministic check AUSCIS can already perform.

Both are AUSCIS-scoped only. Not promoted to AEPE or AKAE — no generalization claim is made or implied.

## 3. Reconciled Stage 1 topology

```
BENEFICIARY ENTERS AUSCIS
        ↓
OPTIONAL CV?
     ↙       ↘
   YES        NO
    ↓          │
UPLOAD         │
    ↓          │
   A0          │
    ↓          │
STRUCTURED     │
PROFILE ←──────┘
    ↑
  COACH (MANDATORY, both paths)
    ↑
BENEFICIARY
    ↓
INTELLIGENT / ADAPTIVE INTAKE
    ↓
BENEFICIARY REVIEW
    ↓
CONFIRM + SUBMIT  (submission act = the auditable beneficiary-confirmation event)
    ↓
AUTOMATED READINESS
    ↓
 ┌──────────────┴───────────────┐
 │                              │
READY                     NEEDS ATTENTION
 │                              │
 ↓                              ↓
A1                       HUMAN / BENEFICIARY
(UNCHANGED)              CLARIFICATION
                                │
                                ↓
                         READINESS RECHECK
```

## 4. Source reconciliation — per-provision classification

| CR-CPS-34 provision | Classification | Disposition |
|---|---|---|
| §3 Mission (Acquire/Discover/Structure/Complete) | UNCHANGED | Mission text stands exactly as frozen |
| §4 Topology | SUPERSEDED IN PART | CV branch becomes conditional (§3 above supersedes the linear CV-mandatory drawing; historical drawing in the frozen doc preserved as-is, not edited) |
| §5.1 Coach | UNCHANGED in authority and firewalls; AMENDMENT REQUIRED in operational emphasis — Coach becomes the sole acquisition path when no CV exists, per the Minimum Friction principle's "more discovery through other authorized channels" — not a new mission, an operating-mode note |
| §5.2 CV (DDR-CV-01) | SUPERSEDED — mandatory → optional accelerator. Both accepted-source rules (existing CV or Coach-generated) carry forward unchanged |
| §5.3 A0 | UNCHANGED — trigger condition ("automatic on upload") was already implicitly conditional on a file existing; commit `7342c10`'s code already only invokes A0 when a file is present (`Module0.tsx`'s `handleUpload` → `runA0`) |
| §5.4 Structured Profile | UNCHANGED — schema, per-field state machine, provenance model all unaffected by either decision |
| §5.5 Prefill Engine | UNCHANGED — no-silent-overwrite rule already source-agnostic (already field-value-based, not source-based) |
| §5.7 Human Confirmation (DDR-CONFIRM-01) | AMENDMENT REQUIRED — beneficiary-reviews-first sequencing PRESERVED exactly; "staff review, always" becomes "automated readiness, staff on exception" |
| §5.8 Intake Complete | AMENDMENT REQUIRED — prerequisite list gains an automated-readiness classification step; CV-present and staff-approved both removed as blocking prerequisites; identity-completeness/Coach-engagement/no-unresolved-conflict prerequisites carry forward |
| §6 Evidence boundary | UNCHANGED |
| §7 Contradiction handling | UNCHANGED in mechanism (DETECT → PRESERVE → conflicting state); becomes the primary trigger feeding `Needs Attention` classification |
| §11 Acceptance criteria items 3, 4, 9, 11 | AMENDMENT REQUIRED (see §7 below for exact target language) |
| §12 Name canonization | UNCHANGED |
| §13 Non-goals | UNCHANGED, extended by this document's own explicit non-goals (§8 below) |

**CR-CPS-34 (the record):** HISTORICAL — PRESERVE AS ORIGINALLY RECORDED. Continues to accurately state what was frozen 2026-09-17.
**CR-CPS-35 (the record):** HISTORICAL — PRESERVE AS ORIGINALLY RECORDED. Continues to accurately state what was authorized (TEST-only implementation of the *original* CR-CPS-34 model).
**CR-CPS-36 (the record):** HISTORICAL — PRESERVE AS ORIGINALLY RECORDED. Continues to accurately state that commit `7342c10` faithfully implemented the design as it existed at authorization time. The gap between that implementation and this reconciliation is **POST-IMPLEMENTATION ARCHITECTURAL EVOLUTION**, not an implementation defect.

## 5. Readiness logic reconciliation

The deterministic check already implemented in `src/app/api/intake-intelligence/complete/route.ts:76-91` (required identity fields present; `coach_conversation.length > 0`; no `structured_profile` field with `status === "conflicting"`) is **substantively correct and reusable as the core of Automated Readiness** — it already evaluates exactly the class of conditions R-02 authorizes (§19 of the governing prompt: information acquired, Coach requirement satisfied, no blocking conflict) and already refuses to evaluate anything adjudicative.

Two things about it are **inconsistent with the reconciled model** and require future change (cataloged as delta, not fixed here):
1. It is manually staff-triggered (an HTTP action a human must take), not run automatically at beneficiary submission.
2. Nothing currently reads it as a CV-mandatory or staff-mandatory gate — that gating lived in `IntakeForm.tsx:370` (client-side CV block) and in the *absence* of any automatic path to `complete` (i.e., mandatory-staff-review was previously an implicit consequence of "only a human can call this route," not an explicit rule inside the route itself). Under the reconciled model, this same route's logic becomes the automated check; the delta is *who/what calls it and when*, not the eligibility logic itself.

No new "legal readiness" condition is introduced. `READY` continues to mean only "Stage 1 acquired and structured enough information," never eligibility, evidence verification, or approval — this document changes nothing about that firewall.

## 6. Security carry-forward

R-01 does not touch, weaken, or resolve the upload-authorization hardening delivered in commit `7342c10` (`src/app/api/intake/upload/route.ts`'s invitation-token check). Any beneficiary who does upload a CV remains subject to that exact existing requirement, unchanged. That work is already implemented and already governed by CR-CPS-36; it carries forward as-is and is not reopened by this reconciliation.

## 7. Implementation delta (not built — catalogued for the future Implementation MR/amendment cycle)

| File / component | Current behavior (commit `7342c10`) | Reconciled required behavior | Classification | Why |
|---|---|---|---|---|
| `src/app/intake/IntakeForm.tsx:370` | `if (!data.module0.cvFilePath) e.cv = "..."` blocks step-0 advance | Remove this line; Coach-completion check (`:371`) remains the sole Module0 gate | MODIFY | R-01 |
| `src/app/intake/modules/Module0.tsx` | UI presents CV as mandatory upload | Reframe as "¿Tienes un CV?" optional accelerator copy | MODIFY | R-01 |
| `src/lib/intake/a0-extract.ts`, `/api/intake/a0-extract/route.ts` | Invoked only on upload | No change — already conditional | KEEP | R-01 (no-op) |
| `src/lib/intake/coach.ts`, `/api/intake/coach/route.ts` | Fixed adaptive-discovery prompt | No change — already gap-driven by construction | KEEP | R-01 (no-op) |
| `src/app/api/intake-intelligence/complete/route.ts` | Manually staff-triggered; identity/coach/conflict checks already correct | Same eligibility logic, invoked automatically at beneficiary submission; add `Needs Attention` classification output | MODIFY | R-02 |
| `src/app/(dashboard)/cases/[id]/intake-intelligence-section.tsx` | Manual "Marcar Intake como completo" button shown for every case | Becomes an exception surface — only renders an actionable state for `Needs Attention` cases; `READY` cases show a passive status, no staff action required | MODIFY | R-02 |
| `src/app/intake/IntakeForm.tsx` submit flow | `submit()` POSTs once; no explicit "confirm" step distinct from "submit" | Source-First finding: the existing submission act (beneficiary clicks "Enviar" after review) already satisfies "explicit and auditable confirmation" — `structured_profile` entries beneficiary-confirmed via Module0's existing confirm buttons before submission already produce a durable, timestamped, actor-attributed record (`confirmed_by`/`confirmed_at`). **No redundant second review step is required.** | KEEP (mechanism), CONFIRM (interpretation) | R-02 §11 |
| `supabase/tests/intake-intelligence-layer-validate.ts` | IC-01..05 assume CV present, staff-triggered completion | ADD no-CV-path assertions; ADD automated-trigger-at-submission assertions; ADD `Needs Attention` classification assertions | ADD | R-01 + R-02 |
| Future tenant review-policy hook | Does not exist | NOT ESTABLISHED — explicitly deferred, no schema/table/column authorized by this document | N/A | R-02 §9 (explicit non-goal) |

No migration is anticipated for R-01/R-02 themselves (both are business-logic/gating changes over the existing `structured_profile`/`coach_conversation`/`status` columns already delivered in migrations 036/037). This is a Source-First observation, not an authorization to implement.

## 8. Explicit non-goals (this reconciliation)

- No application code, schema, or migration change (none performed; none authorized).
- No tenant review-policy table, column, settings UI, or policy engine.
- No MTCS number inferred or assigned.
- No change to A1–A5, AKAE, or AEPE.
- No change to Evidence Verification governance.
- No Implementation MR performed — remains PAUSED.
- No re-freezing of `AUSCIS_INTAKE_INTELLIGENCE_LAYER_FINAL_EXACT_DESIGN.md` — its SHA256 is unchanged and it remains the historical freeze record.

## 9. Next governed act

The implementation delta in §7 is not yet authorized for construction. Per this project's own established gate sequence (Materialization → Final Exact Design → Implementation Authorization Gate → Implementation → Implementation MR, applied identically to QA Engine, Human Review Gate, and this capability's own CR-CPS-34→35→36 chain), a reconciliation that changes the authorized implementation scope requires its own Implementation Authorization Gate re-run before any code change — the same pattern already used once in this session (Human Review Gate's D-REC-01 reconciliation → CR-CPS-26 → a fresh Implementation Authorization Gate re-run, CR-CPS-27). Source does not establish an exception to that precedent here.

**Next governed act:** `AUSCIS Intake Intelligence Layer — Implementation Authorization Gate — Re-run (R-01/R-02 delta)`.

Implementation MR for the original CR-CPS-36 scope remains PAUSED until that re-run grants (or blocks) the reconciled delta.
