# P7-R4 — Deterministic Draft Persistence Correction Design

STATUS: APPROVED FOR BOUNDED IMPLEMENTATION (CR-CPS-60)
GOVERNING SOURCE: P7-R4-SF1 (Deterministic Draft Persistence Source-First Trace) — SOURCE DEFINITION COMPLETE
CURRENT APPLICATION CODE: `cad9591ed3cb92e83ebfde992c3363e0ccea8f35`
SCOPE: `src/app/intake/IntakeForm.tsx`, `src/app/intake/modules/Module0.tsx` only.

---

## 1. Identification

Design correction closing P7-R4 (deterministic draft persistence + resume-position persistence). Design only — no implementation.

## 2. Problem Statement

Three post-mutation boundaries carry non-trivial loss consequence (repeated billable AI work, or lost human decision) but rely solely on the 30-second autosave interval: A0/CV extraction completion (E02), beneficiary Confirmar (E03), and completed Coach turn (E06). Separately, the current draft snapshot never persists navigation position (`step`), so Retomar always resumes at Module 0 regardless of how far the beneficiary progressed.

## 3. Governing Source Findings (preserved, not re-derived)

A–L, N per P7-R4-SF1: localStorage-only draft; existing snapshot = full `IntakeFormData`; hydration/resume functional; 30s stable autosave adequate as a mechanism; existing `save()` primitive reusable; saved/dirty semantics already adequate; no DB/schema/RPC/migration/new subsystem required; Siguiente already deterministically checkpoints `data` (not `step`); minimum data checkpoints = {E02, E03, E06}.
M: `step` is not currently persisted at all.

## 4. Approved Functional Requirement

Retomar MUST restore the last deterministically persisted Intake step, using the same snapshot boundary as the restored data. `step` is navigation/resume metadata — never beneficiary fact, never Evidence, never part of the final submission payload.

## 5. Existing Mechanism Preserved

- localStorage as the sole draft store, single `storageKey`.
- 30-second stable autosave interval (unchanged scheduling).
- Existing hydration effect, existing draft banner / Retomar / Empezar de nuevo UI.
- Existing `confirmField()`, `acquireCoachFields()`, `parseCoachResponse()`, A0 extraction — untouched.

## 6. Draft Envelope / Backward Compatibility

**New envelope (single JSON object, single key, single `localStorage.setItem` call):**

```
{ data: IntakeFormData, step: number, savedAt: string }
```

`savedAt` in this envelope is informational metadata only, written alongside the snapshot for record-keeping (F-05) — it is NOT read back into React `savedAt` state during hydration; the live saved/dirty UI indicator remains governed entirely by current runtime semantics (§10), exactly as today, where hydration never sets `savedAt`. No second saved-state model is introduced.

**Detection at hydration:**
`"data" in parsed && "step" in parsed` → NEW envelope: hydrate `parsed.data` as today, validate `parsed.step` (§7).
Otherwise → LEGACY draft: the entire parsed object IS the `IntakeFormData` (today's shape) — hydrate exactly as today, resume step defaults to `0` (this is byte-for-byte identical to current behavior, since no step is persisted today and `step` state already initializes to 0). No migration script, no forced reset, no invalidation. The very next successful checkpoint/autosave naturally rewrites the draft in the new envelope shape.

SNAPSHOT ATOMICITY: **SINGLE ENVELOPE** — data and step are written together, in one `JSON.stringify`, under the one existing key. No separate-key interruption risk is introduced.

## 7. Step Validation

Persisted `step` is validated on hydration: must be an integer, `0 <= step <= TOTAL` (14). Missing, non-integer, non-finite, or out-of-range → fallback to `0`. Validation is purely a navigation-convenience decision; it never bypasses `validate()`, submission rules, token/session gating, or module completeness — the user already legitimately passed `validate()` to reach that step in a prior session, and moving forward from a restored step is still gated by the unmodified `validate()`/`next()` path.

## 8–10. Checkpoint Semantics (CP-01 / CP-02 / CP-03)

One canonical serialization primitive replaces the current `save()`:

```
save(explicitData?: IntakeFormData, explicitStep?: number): boolean
  → attempts to write { data: explicitData ?? dataRef.current, step: explicitStep ?? stepRef.current, savedAt: now }
  → on successful localStorage.setItem: setSavedAt(new Date()); return true
  → on failed localStorage.setItem: do NOT update savedAt; return false (current silent-failure behavior — the try/catch that already swallows the error — is otherwise preserved; no exception needs to escape)
```

`save()` returns a boolean success signal so its callers can react to persistence failure — this is the minimum change needed to close the residual F-01 gap (§8-10a below), not a new abstraction: no result object, error class, retry/toast/logging subsystem, queue, or server fallback is introduced.

`save()` itself is responsible ONLY for serializing the requested coherent snapshot, reporting success/failure, and updating `savedAt` after a successful write — for ANY caller (interval, manual "Guardar borrador", Siguiente, Anterior, or a CP-01/02/03 checkpoint alike). It never touches `justCheckpointedRef`, regardless of its own return value (see F-01 correction below). Callers that don't need the signal (autosave, manual button, Siguiente, Anterior) may simply ignore the returned boolean — no change to their existing behavior is authorized or required by this correction.

`stepRef` mirrors the existing `dataRef` pattern (`useRef(step)` synced via `useEffect(() => { stepRef.current = step }, [step])`) — required so the stable-interval autosave always serializes the *current* step without recreating the interval.

- **CP-01 (A0 completion):** Module0's `runA0()` computes the post-merge `profile` and the full next `Module0Data`; the resulting next `IntakeFormData` is passed up via a new `onCheckpoint(nextData)` prop (parallel to the existing `onChange`, not a replacement for it), which IntakeForm wires to `save(nextData)` followed by `onChange(nextData)`. Ordering: merge → checkpoint the post-merge object → then lift state. Never checkpoints pre-A0 state; does not alter upload/extraction semantics. **Scope caveat (F-02):** "exact post-merge nextData" means exactly the state `runA0()`'s existing execution semantics compute — see §8-10a below.
- **CP-02 (Confirmar):** `confirmProfileField()` computes the post-`confirmField()` object identically, calls the same `onCheckpoint(nextData)` immediately before `onChange`. Confirmation semantics (`confirmField()` itself) unchanged. This call site is fully synchronous (no `await`), so no closure-staleness concern applies here.
- **CP-03 (Coach turn):** `sendCoachMessage()`'s success branch (after `acquireCoachFields()` merge) builds the complete post-turn object (conversation + merged profile) and calls `onCheckpoint(nextData)` before `onChange`. A failed/errored turn (network/API failure) preserves existing error-turn behavior — no checkpoint is attempted for an incomplete turn, and no new Coach recovery semantics are introduced. `parseCoachResponse`, FACTS handling, and `acquireCoachFields`'s Class A1 firewall are untouched. **Scope caveat (F-02):** same as CP-01 — see §8-10a below.

All three reuse the identical `save(nextData)` primitive — no separate save implementation per event.

### 8-10a. Pre-Existing Async Data Closure — Out of Scope (F-02)

`runA0()` and `sendCoachMessage()` (Module0.tsx) both close over the Module0 `data` prop across an internal `await fetch(...)`. This is current, deployed (`cad9591`) execution behavior, unrelated to this design: if another Module0 mutation (e.g., a Confirmar click) occurs while an A0 extraction or Coach turn is in flight, the existing post-response merge in `runA0()`/`sendCoachMessage()` spreads the pre-await `data`, and the concurrent mutation can be overwritten. This condition:

- PRE-EXISTS P7-R4 and is present in production today, independent of any checkpoint mechanism;
- is NOT introduced or worsened by deterministic checkpointing — CP-01/CP-03 checkpoint exactly the state the existing merge computes, whatever that is, and the same state already becomes the new React/localStorage source of truth today via the existing (autosave-only) path regardless of whether an immediate checkpoint exists;
- is NOT corrected by P7-R4 and MUST NOT be silently broadened into this correction.

**PRE-EXISTING CONCURRENCY CONDITION — OUT OF P7-R4 SCOPE.** No change to Coach/A0 merge semantics is proposed here.

**Ordering hazard and fix (F-01):** because `onCheckpoint` and `onChange` both fire synchronously in the same event for CP-01/02/03, the existing dirty-invalidation effect (which nulls `savedAt` on any `data` change) would otherwise immediately clobber the just-set `savedAt` back to null. Fix: `justCheckpointedRef`, consumed once by the dirty-invalidation effect (skip the null, mirroring the existing `justHydratedRef` hydration guard) — but, critically, **armed only by the CP-01/02/03 onCheckpoint wiring itself, and only when `save()` reports success** (in IntakeForm, immediately before the accompanying `onChange` call), never by the generalized `save()` primitive itself and never unconditionally. `save()`'s other callers — the autosave interval, the manual "Guardar borrador" button, and Siguiente/Anterior's step-only checkpoints — have no accompanying `data` mutation, so there is no dirty-invalidation effect run for them to guard, and arming the flag on their behalf would leave it incorrectly armed for a later, unrelated, genuinely-unsaved edit; they may freely ignore `save()`'s boolean return.

Concretely:
```
onCheckpoint = (nextData) => {
  const persisted = save(nextData);
  if (persisted) { justCheckpointedRef.current = true; }
  onChange(nextData);
};
```
This lives at the IntakeForm→Module0 wiring boundary, not inside `save()`.

**Success path:** `save(nextData)` writes successfully → returns `true` → `savedAt` updated → `justCheckpointedRef` armed → `onChange(nextData)` → dirty-invalidation effect sees the armed flag, consumes it once, skips the null → indicator reads SAVED.

**Failure path:** `save(nextData)`'s `localStorage.setItem` throws → `save()`'s existing try/catch swallows it exactly as today, does NOT call `setSavedAt`, and returns `false` → `justCheckpointedRef` is never armed → `onChange(nextData)` still occurs unconditionally (a failed local checkpoint must never block the beneficiary's successful A0/Confirmar/Coach action from reaching React state) → the dirty-invalidation effect runs normally (flag unarmed) and nulls `savedAt` → indicator correctly reads DIRTY. The prior `savedAt` (from some earlier successful save) is not treated as evidence the new state was persisted. No new status is introduced — existing SAVED/DIRTY semantics are sufficient; a later successful save (autosave tick, another checkpoint, or manual button) returns the draft to SAVED normally.

No new generalized suppression mechanism is introduced — this is the same single-purpose, single-consumption guard pattern already established by `justHydratedRef`, scoped correctly to exactly the three call sites that need it, now correctly gated on the outcome of the write it is meant to represent.

## 11. Resume Position Semantics — Forward (CP-04)

**DESTINATION STEP**, per the explicit normative requirement. Explicit implementation ordering (F-06 — current source's `next()` textually computes `save()`'s call before `nextStep`; this must be reordered):

```
FORWARD (next()):
validate()
→ compute clamped nextStep (Math.min(step===10 && !show12 ? 12 : step+1, TOTAL))
→ save(undefined, nextStep)   // data unchanged → dataRef fallback; step explicit
→ setStep(nextStep)
```

The exact same clamped value used for `save()`'s `explicitStep` argument MUST be the value passed to `setStep` — never the pre-clamp raw value. Never checkpoints a destination before validation succeeds.

## 12. Backward Navigation

**BACKWARD STEP CHECKPOINT: REQUIRED.** Applying the same "last module the user intentionally reached" principle symmetrically: if the persisted step is not updated on Anterior, a subsequent Retomar could resume at a *later* step than the one the user deliberately stepped back to, contradicting the approved semantic. Explicit implementation ordering (F-06):

```
BACKWARD (back()):
compute clamped prevStep (Math.max(step===12 && !show12 ? 10 : step-1, 0))
→ save(undefined, prevStep)   // data unchanged → dataRef fallback; step explicit
→ setStep(prevStep)
```

`back()` does not mutate `data`, so this is a step-only checkpoint; it is a new call, not an extension of an existing one (`back()` today calls no save at all). The persisted step must never be the pre-navigation source step after a successful navigation action — always the clamped destination.

## 9. Autosave Interaction

No scheduling change. The interval continues calling `save()` with no arguments — now falling back to both `dataRef.current` and `stepRef.current`. This dependence on ref-update timing is explicit, not claimed to be impossible to violate (F-04): `dataRef`/`stepRef` synchronization relies on React flushing each render's passive effects (`useEffect(() => { dataRef.current = data }, [data])` / the equivalent for `stepRef`) before the next macrotask — including a `setInterval` callback — gets a chance to run; this is the existing, already-relied-upon ordering guarantee `dataRef` itself depends on today (P7-R5), not a new assumption. Critically, the two *meaningful* navigation boundaries (Siguiente/Anterior, §11-§12) do not depend on this timing at all: they explicitly serialize the already-clamped destination step as an argument to `save()`, bypassing `stepRef` entirely. `stepRef` is used only by the interval/manual-save fallback path, where the consequence of any residual staleness is bounded by the same up-to-~30s tolerance already accepted for ordinary edits (§13) — not a new risk class. No additional synchronization subsystem is introduced.

AUTOSAVE SCHEDULING CHANGE: **NOT REQUIRED**.

## 10. Saved / Dirty Semantics

No redesign. `save()`'s explicit-argument variant still only calls `setSavedAt` after a successful write, now also returning that success/failure as a boolean; the existing dirty-invalidation effect still nulls `savedAt` on any subsequent unrelated edit. Only addition: the `justCheckpointedRef` guard, armed exclusively by the CP-01/02/03 wiring and only when `save()` reports success (§8-10a), so those three events' own state-lifting doesn't immediately self-invalidate a checkpoint that actually succeeded — while every other `save()` caller (interval, manual button, Siguiente, Anterior) correctly leaves a subsequent unrelated edit DIRTY, since no accompanying `data` mutation occurs for those callers and the flag is never armed on their behalf; and a *failed* CP-01/02/03 checkpoint also correctly leaves the following edit DIRTY, since the flag is never armed in that case either.

SAVED INDICATOR CODE CHANGE: **REQUIRED (integration only)** — reuse of the existing `justHydratedRef` pattern, not a semantic redesign.

## 18. Retomar Semantics

Unchanged sequence, extended only at the validation step: load draft → detect legacy/new envelope (§6) → hydrate `data` exactly as today (unconditional, immediate — unchanged from current behavior) → validate persisted `step` (§7), falling back to 0 if invalid/absent, but **do not apply it to live navigation state yet** → present existing draft banner → **Retomar**: `setDraftBanner(false)` and `setStep(validatedStep)` (today: `setDraftBanner(false)` only, implicitly always step 0). Retomar continues to perform zero independent data reconstruction — it only acts on the already-hydrated, already-validated snapshot.

**Explicit invariant (F-07):** while the resume/new-start decision is pending (i.e., before Retomar is clicked), the persisted `step` is validated but never applied — live `step` state remains at its initial `0` throughout this window, unchanged from current behavior. This is why **Empezar de nuevo** requires no explicit step reset of its own: `setStep` is never called before that decision point under either choice, so at the moment Empezar de nuevo can be clicked, live `step` is already, and still, `0`.

```
EMPEZAR DE NUEVO:
localStorage.removeItem(storageKey)   // removes the entire envelope: data + step + savedAt, atomically, in one call
→ setData(INITIAL)
→ setDraftBanner(false)
→ (live step remains 0 — no explicit reset needed; see invariant above)
```

No stale persisted step can survive Empezar de nuevo, since `data` and `step` share one removed envelope key. Current source's existing Empezar de nuevo handler performs no step reset today (there is none to perform, for the same reason) — this design preserves that, rather than inventing a new reset.

## 19. Final Submission

Unchanged. `submit()`'s POST body is still built field-by-field from `data` explicitly (`{...data, moduleStatuses, invitationToken, ...}`); `step` remains separate React state and is never spread into it — no code path added by this design causes `step` to reach the submission payload. Success still calls `localStorage.removeItem(storageKey)`, now removing the richer envelope in the same single call.

## 20. Failure Semantics

Unchanged try/catch around the write, now surfaced to callers as `save()`'s boolean return (§8-10a) rather than only internally swallowed. On failure: `setSavedAt` is not reached, `justCheckpointedRef` is never armed by the CP-01/02/03 wiring (it checks the return value), and `onChange(nextData)` still proceeds unconditionally so the underlying A0/Confirmar/Coach action is never blocked by a local persistence failure — the result is a correct DIRTY state, not a silently-lost or falsely-SAVED one. No new error UI, no toast subsystem, no retry/logging/queue mechanism.

## 12. Non-Interference

Touches only `IntakeForm.tsx` (envelope read/write, `stepRef`, `justCheckpointedRef`, `next()`/`back()` step-explicit `save()` calls) and `Module0.tsx` (new `onCheckpoint` prop, called at exactly 3 existing call sites). No change to: CR-CPS-57 Coach role, A0 extraction semantics, Structured Profile field taxonomy, Class A1 protection, Class A2/B enrichment, FACTS parser, Evidence Item Contract, Evidence Incorporation/Verification, A1, A5, Blueprint, GWP, Case Filing, database schema, RLS, RPC, AKAE, ALKA, AILA, AEPE.

## 13. Acceptance Tests (minimum 19)

T1 Legacy draft compatibility — bare-shape draft hydrates data unchanged, step defaults to 0.
T2 New draft resume position — envelope with step=7 → Retomar restores Module 7.
T3 Invalid step — malformed/out-of-range persisted step → data hydrates, navigation falls back to 0.
T4 A0 checkpoint — immediate refresh after successful extraction restores post-A0 profile without waiting for autosave.
T5 Confirm checkpoint — immediate refresh after Confirmar restores `beneficiary_confirmed` + `confirmed_by`/`confirmed_at`.
T6 Coach checkpoint — immediate refresh after a complete turn restores user message, Coach reply, post-merge profile.
T7 FACTS non-regression — checkpoint addition does not alter `parseCoachResponse`; FACTS remains non-visible.
T8 A1 non-regression — `acquireCoachFields`/Class A1 protection unchanged.
T9 Forward position — Module 6→7 transition, refresh + Retomar → Module 7.
T10 Backward position — Module 7→6 (Anterior), refresh + Retomar → Module 6.
T11 Ordinary autosave — a plain field edit still persists only via the 30s interval, no per-keystroke write introduced.
T12 Dirty/saved — mutation invalidates saved state; successful checkpoint restores saved state (via `justCheckpointedRef`); a subsequent unrelated unsaved edit goes dirty again.
T13 New start — Empezar de nuevo clears both data and step consistently (single envelope removal).
T14 Final submission — payload unchanged; `step` never appears in the `/api/intake` POST body.
T15 Legacy baseline — all existing `intake-intelligence-layer-validate.ts` tests remain PASS (currently 101/101).
R1-T16 Autosave flag non-leak (F-03) — autosave interval executes a successful save with no accompanying data mutation; `justCheckpointedRef` must not become/remain armed as a result; a subsequent unrelated ordinary edit must then transition the saved state to DIRTY. Fails if the generalized `save()` primitive incorrectly arms the flag itself.
R1-T17 Manual/navigation save flag non-leak (F-03) — exercise at least one non-CP save path (manual "Guardar borrador", or Siguiente/Anterior's step-only checkpoint); after a successful save with no accompanying `onChange`, a subsequent unrelated edit must become DIRTY.
R1-T18 Async concurrency characterization (F-02/F-03) — documents/exercises, as two separate tests (one for A0, one for Coach, since a single test cannot safely exercise both in one deterministic scenario), the established current behavior where a beneficiary confirmation or other Module0 mutation occurring while an A0 extraction or Coach turn is in flight is overwritten by the existing post-response merge. This characterizes the pre-existing condition identified in F-02; it does NOT authorize or require fixing that race under P7-R4.
R2-T19 Failed deterministic checkpoint does not falsely remain SAVED (F-01 residual) — given a draft in a previously-SAVED state, a CP-01/02/03 action computes `nextData`, and `localStorage.setItem` fails during the resulting checkpoint: `save(nextData)` must report failure (return `false`); `savedAt` must NOT be advanced; `justCheckpointedRef` must remain unarmed; `onChange(nextData)` must still occur (the beneficiary's action is not blocked by the local persistence failure); normal dirty invalidation must NOT be suppressed; resulting UI state must be DIRTY; a later successful save must return the draft to SAVED normally. Exercises one representative CP wiring path, since CP-01/02/03 share the identical canonical `onCheckpoint` implementation (§8-10a) — if a future implementation diverges from that shared wiring, coverage must be extended to prove each distinct path independently. Fails if `save()` does not expose failure, if `onCheckpoint` arms the flag unconditionally, if a failed checkpoint suppresses dirty invalidation, or if a failed write falsely advances `savedAt`.

## 14. Production Validation Scenarios (defined, not executed)

P-A: perform a checkpointed action (A0/Confirmar/Coach turn), refresh immediately, Retomar, verify the action survived.
P-B: reach a later module, refresh, Retomar, verify the exact module is restored.
P-C: complete a Coach turn, refresh immediately, Retomar, verify the visible reply and enriched profile survive and no FACTS payload is visible.

## 15. Explicit Non-Goals

No server-side/database draft persistence. No new API route. No new agent. No background worker, queue, debounce subsystem, or second timer. No change to autosave scheduling. No new visual design for the saved indicator. No localStorage migration script. No change to Coach/A0/Structured Profile/Evidence/A1/A5/Blueprint semantics.

## 16. Implementation Boundary

Scope limited to `IntakeForm.tsx` + `Module0.tsx`: envelope read/write via one generalized `save(explicitData?, explicitStep?): boolean` primitive; `stepRef` + `justCheckpointedRef` (mirroring existing `dataRef`/`justHydratedRef`, the latter now armed only on a successful `save()` return); one new `onCheckpoint` prop on `Module0`, invoked at 3 existing call sites (post-A0-merge, post-Confirmar, post-Coach-merge); `next()`/`back()` pass explicit destination step. No other file requires modification.

## 17. Design Decision

SCHEMA CHANGE: NO. MIGRATION: NO. DATABASE WRITE: NO. NEW RPC: NO. NEW API: NO. NEW PERSISTENCE SUBSYSTEM: NO.
Minimum checkpoint set preserved (E02/E03/E06). Resume Position Persistence satisfied (forward + backward, destination-step semantics). Backward compatible (legacy drafts hydrate unchanged, default step 0). Exact post-mutation state persistence achieved via explicit-argument `save()`, avoiding the `dataRef` staleness hazard. Single coherent envelope (atomic). Non-interference preserved.

**DESIGN STATUS: APPROVED FOR BOUNDED IMPLEMENTATION** — MR PASS (P7-R4-DES-01 Independent Design MR Rerun #2), Project Owner approval + bounded implementation authorization recorded as CR-CPS-60 in `docs/CANONICAL_PROJECT_STATE.md`. This artifact is now frozen as the implementation authority; do not alter it during implementation.
