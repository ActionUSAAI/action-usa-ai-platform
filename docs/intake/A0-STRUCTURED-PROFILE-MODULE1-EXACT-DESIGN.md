# A0 → Structured Profile → Intake Module 1 — Exact Design

Scope: M1-GAP-01 → M1-GAP-07
Status: APPROVED FOR IMPLEMENTATION GATING
Design Result: PASS
Implementation Status: NOT IMPLEMENTED

This document freezes the already-completed Exact Design produced
against canonical source at commit `6230131c310217f00738147e7a65a3b63adbfd22`
(main, == origin/main). It does not itself authorize implementation.
Actual implementation requires a separate, explicit Owner-authorized
implementation gate.

## A. Source Identity

```
BRANCH: main
HEAD: 6230131c310217f00738147e7a65a3b63adbfd22 (== origin/main)
ORIGIN_MAIN: 6230131c310217f00738147e7a65a3b63adbfd22
STATUS: clean (only the 3 historically-protected AC-69 files, untouched)
```

## B. Governing Baseline

Carried forward unchanged from the Post-CBR Continuity & Exact Gap
Gate:

```
A0_MODULE1_POST_CBR_CONTINUITY_GATE: PASS
FACTS_TO_INTAKE_FIX: VERIFIED_PRESENT
SAVE_RESUME_FIX: VERIFIED_PRESENT
HISTORICAL_21_FIELD_MODEL: UNCHANGED
CURRENT_STRUCTURED_PROFILE_FIELD_COUNT: 21
CURRENT_A0_WRITABLE_FIELD_COUNT: 21
CURRENT_COACH_WRITABLE_FIELD_COUNT: 21
CURRENT_A0_COACH_OVERLAP_COUNT: 21
CURRENT_MODULE1_PREFILL_SOURCE_FIELD_COUNT: 12
COACH_SPECIALIZATION: STRUCTURALLY_ENFORCED
PROVENANCE_PRESERVATION: PASS
MODULE1_SILENT_OVERWRITE_PROTECTION: PASS
CURRENT_MODULE1_CBR_CONSUMPTION: NONE
MODULE1_READY_FOR_IMPLEMENTATION_CLOSURE: NO
NEXT_STEP: MODULE1_EXACT_DESIGN_REQUIRED
BLOCKER_COUNT: 7
```

Governing design principle: the purpose is not to make CBR feed
Intake Module 1. The purpose is that if AUSCIS can acquire a fact for
the current case and Module 1 needs that fact, the current-case
acquisition path must be able to preserve and reuse it without
information loss. Primary path: Source Document → A0 → Structured
Profile → Prefill → Intake Module 1. Coach participates only
according to its already-established specialized enrichment rules.
CBR remains outside the Module 1 read path.

## C. Capability A — M1 Acquisition Expansion

Covers M1-GAP-01 (countryOfBirth), M1-GAP-02 (foreignStreet),
M1-GAP-03 (foreignCity), M1-GAP-04 (foreignProvince), M1-GAP-05
(foreignPostalCode), M1-GAP-06 (foreignCountry).

Required target flow: Source Document → A0 extraction → Structured
Profile → `prefillModule1()` → Module 1. The design preserves current
no-overwrite behavior, current save/resume behavior, current
provenance behavior, current A0/Coach specialization, current FACTS
separation, and the current CBR boundary.

## D. Exact Field Model

| ACQUISITION_KEY | STRUCTURED_PROFILE_KEY | MODULE1_TARGET_KEY | TRANSFORMATION | NORMALIZATION |
|---|---|---|---|---|
| `countryOfBirth` | `countryOfBirth` | `countryOfBirth` | none (identical names) | none beyond existing universal `.trim()` |
| `foreignStreet` | `foreignStreet` | `beneficiaryForeignStreetNumberName` | rename on prefill write | none |
| `foreignCity` | `foreignCity` | `beneficiaryForeignCity` | rename on prefill write | none |
| `foreignProvince` | `foreignProvince` | `beneficiaryForeignProvince` | rename on prefill write | none |
| `foreignPostalCode` | `foreignPostalCode` | `beneficiaryForeignPostalCode` | rename on prefill write | none — stays `string`, never coerced to number |
| `foreignCountry` | `foreignCountry` | `beneficiaryForeignCountry` | rename on prefill write | none |

Decision: the acquisition-layer vocabulary uses the short semantic
names (matching CBR's own existing vocabulary where it overlaps —
`countryOfBirth`, `foreignStreet`, `foreignProvince`,
`foreignPostalCode`, `foreignCountry` are literally CBR's own field
keys; `foreignCity` is new even to CBR). The long `beneficiaryForeign*`
names stay confined to Module 1's UI/type layer. Only the prefill
mapping needs to know about the five renamed keys.

## E. Structured Profile Expansion

```
CURRENT_SP_FIELD_COUNT: 21
PROPOSED_SP_FIELD_COUNT: 27
SP_FIELDS_ADDED: countryOfBirth, foreignStreet, foreignCity, foreignProvince, foreignPostalCode, foreignCountry
```

Affected symbols — and symbols confirmed **not** affected, because
`acquireField`, `confirmField`, `acquireCoachFields`,
`minimizedProfileContext`, and `emptyStructuredProfile` all operate
generically over `Record<string, StructuredProfileField>` keyed by
whatever is in `ALL_STRUCTURED_PROFILE_FIELDS` — none of them
hard-code a field name:

| Symbol | Change |
|---|---|
| `IDENTITY_FIELDS` (structured-profile.ts) | add 6 keys |
| `CLASS_A1_FIELDS` (structured-profile.ts) | add 6 keys (see §Field Classification) |
| `ALL_STRUCTURED_PROFILE_FIELDS` | unchanged derivation (`[...IDENTITY_FIELDS, ...CRITERION_NARRATIVE_FIELDS]`) — grows to 27 automatically |
| `A0_FIELD_LIST` (a0-extract.ts) | add 6 keys — a separately declared, currently-duplicate constant; must be kept in sync by hand (pre-existing maintenance characteristic, not introduced by this design) |
| `StructuredProfileField`, `StructuredProfile`, `emptyField()`, `acquireField()`, `confirmField()`, `acquireCoachFields()`, `minimizedProfileContext()`, serialization, resume | NOT_REQUIRED — all already field-name-agnostic |
| `coach.ts` (`describeProfileContext`, `BASE_SYSTEM_PROMPT`) | NOT_REQUIRED — both already iterate `CLASS_A1_FIELDS`/`A0_FIELD_LIST` generically |

### Field Classification

| FIELD | PROPOSED_CLASS | RATIONALE | FREEZE_AFTER_CONFIRMATION |
|---|---|---|---|
| countryOfBirth | CLASS_A1 | Immutable biographical fact, same character as `dateOfBirth` (already Class A1) | YES |
| foreignStreet | CLASS_A1 | Same current-foreign-address concept as `countryOfResidence`/`cityOfResidence` (already Class A1) — consistency with existing precedent | YES |
| foreignCity | CLASS_A1 | Same rationale | YES |
| foreignProvince | CLASS_A1 | Same rationale | YES |
| foreignPostalCode | CLASS_A1 | Same rationale | YES |
| foreignCountry | CLASS_A1 | Same rationale | YES |

No new class is required. Judgment call made, not escalated: a
foreign residential address can change in reality, but the system
already freezes the coarser-grained `countryOfResidence`/
`cityOfResidence` on confirmation — treating the finer-grained
decomposition any differently would be an inconsistency, not a safer
design.

## F. A0 Extraction Design

No new prompt branch. `a0-extract.ts`'s `SYSTEM_PROMPT` is
auto-generated from `A0_FIELD_LIST.map(f => "- "+f)`, and the existing
global instructions ("Nunca extraigas un campo marcado... No inventes
valores para campos no mencionados -- simplemente omítelos") already
apply uniformly to every field in the list, including the six new
ones — zero new anti-fabrication logic is required. It already
forbids inferring countryOfBirth from residence, foreignCountry from
nationality, etc., by construction (it only extracts what the document
explicitly states).

```
EXTRACTION KEY        | EXPECTED VALUE          | NULL/UNKNOWN BEHAVIOR          | WHITELIST
countryOfBirth         | free-text country       | omitted from result if absent  | A0_FIELD_LIST (extend)
foreignStreet           | free-text address        | omitted if absent               | A0_FIELD_LIST (extend)
foreignCity             | free-text city            | omitted if absent                | A0_FIELD_LIST (extend)
foreignProvince         | free-text province         | omitted if absent                 | A0_FIELD_LIST (extend)
foreignPostalCode       | free-text code (string)     | omitted if absent                   | A0_FIELD_LIST (extend)
foreignCountry          | free-text country            | omitted if absent                    | A0_FIELD_LIST (extend)
```

Source-document-reality limitation, reported, not designed around: A0
currently only operates on CV/résumé documents (`extractCvFields`,
Module0.tsx comment: "CV/résumé source document"). A CV rarely states
country of birth or a foreign home address — those are typically
passport/ID-document content, not résumé content. This design still
correctly implements "extract if present, never invent," but the
Owner should expect low real-world A0 coverage for these six fields
specifically, with Coach's missing-A1 pursuit carrying most of the
practical acquisition load. Broadening Document architecture to
accept passports/ID documents is explicitly out of scope and not
proposed.

## G. Coach Participation Design

| FIELD | A0_ACQUIRES | COACH_MAY_ACQUIRE_IF_MISSING | COACH_MAY_ENRICH_IF_UNCONFIRMED | COACH_MAY_CHANGE_IF_CONFIRMED |
|---|---|---|---|---|
| countryOfBirth | YES | YES | YES | NO |
| foreignStreet | YES | YES | YES | NO |
| foreignCity | YES | YES | YES | NO |
| foreignProvince | YES | YES | YES | NO |
| foreignPostalCode | YES | YES | YES | NO |
| foreignCountry | YES | YES | YES | NO |

No Coach code change required. Once the six keys are added to
`CLASS_A1_FIELDS`, `describeProfileContext()`'s existing
`missingA1`/`protectedA1` loop (iterating `CLASS_A1_FIELDS`
generically) automatically starts telling Coach to pursue them when
absent and never re-ask them once confirmed — exactly the
belt-and-suspenders mechanism already proven for
`countryOfResidence`/`cityOfResidence`. `acquireCoachFields()`'s
structural freeze check likewise covers the new keys automatically.

### Precedence Rule

```
MODULE1_FIELD_VALUE_PRECEDENCE:
  1. Existing non-empty Module1 value (beneficiary/staff-typed, or restored from a saved draft) — always wins, never overwritten.
  2. Else, Structured Profile value for the matching key, regardless of acquisition
     source or confirmation status (unchanged existing prefillModule1 rule) — prefilled.
  3. Else, field remains empty — Module 1 asks normally.

Within Structured Profile itself (unchanged, already generic): if A0 and Coach
produce disagreeing values, acquireField() marks the field "conflicting" and
preserves both rather than silently picking one — this already applies to the
new fields with zero additional code.
```

## H. Prefill Mapping Design

Current no-overwrite rule (`existing === undefined || null || ""`) is
unchanged. Extension is additive, in `prefill-engine.ts`:

```
countryOfBirth            → countryOfBirth                          (covered automatically by adding the key to IDENTITY_FIELDS — same-name loop, zero new code)

Translated keys (explicit small map, since names differ):
foreignStreet              → beneficiaryForeignStreetNumberName
foreignCity                → beneficiaryForeignCity
foreignProvince             → beneficiaryForeignProvince
foreignPostalCode            → beneficiaryForeignPostalCode
foreignCountry               → beneficiaryForeignCountry
```

Design: add a second, small loop in `prefillModule1()` — identical
no-overwrite guard, iterating a `FOREIGN_ADDRESS_FIELD_MAP:
Record<string,string>` of `{spKey: module1Key}` pairs — rather than
forcing these five into the same-name `IDENTITY_FIELDS` loop (which
assumes identical keys). `countryOfBirth` is added directly to
`IDENTITY_FIELDS` since its name already matches.

Type check: all six target Module1 fields are `string` (confirmed,
`types.ts`); all six SP fields are `value: string | null` — compatible,
no coercion needed anywhere.

### Conditional Foreign Address Behavior

```
FOREIGN_ADDRESS_PREFILL_CONDITION: NONE
```
Confirmed from `Module1.tsx`: the foreign-address fields render
unconditionally — only the separate U.S.-address block is gated
behind `willChangeStatusInUSA === true`. Foreign-address Module1 state
always exists and is always visible; prefill may populate it with no
condition.

### Normalization

All six Module1 targets are plain free-text `TextInput` (not
select/dropdown/number — postal code is `string`-typed and plain-text,
confirmed).

```
SOURCE_VALUE_FORM: free text, as stated in the document
SP_VALUE_FORM: free text, trimmed only by A0/Coach's existing universal .trim() (already applied to every field today, not new)
MODULE1_VALUE_FORM: free text, unchanged
NORMALIZATION_RULE: none beyond the existing universal trim — no casing, no coercion, no leading-zero loss (postal code never touches a numeric type anywhere in this chain)
```

## I. Confirmation / Provenance Design

```
NEW_FIELDS_USE_EXISTING_PROVENANCE_STATE_MACHINE: YES
```
`acquireField`/`confirmField` are keyed generically; adding six keys
to the field-list constants is sufficient. Initial source assignment:
`cv_extraction` (A0) or `coach_discovery` (Coach), exactly like every
other field. No second provenance mechanism is created. Beneficiary
correction, reconfirmation, and reacquisition-after-confirmation all
follow the exact existing state machine (including the
`confirmed_from_source` logic) with zero special-casing.

## J. Capability B — Invitation Email Reuse

Covers M1-GAP-07 (email).

### Email Authority / Trust Decision

```
intake_invitations.email TEXT NOT NULL (tied 1:1 to client_id) — migration 003.
src/app/api/admin/invitations/create/route.ts: cleanEmail is used to BOTH
  find-or-create the clients row (clients.email = cleanEmail) AND populate
  intake_invitations.email — the identical value, at the identical moment,
  for the identical person.

INVITATION_EMAIL_SEMANTICS: BENEFICIARY_EMAIL
SAFE_TO_PREFILL_MODULE1_EMAIL: YES
```
Fully established from source — not a petitioner/representative/
operational contact. It is the beneficiary's own email, staff-entered
when the client/invitation were created.

### Integration Point

```
INVITATION_EMAIL_INTEGRATION: STRUCTURED_PROFILE_SEED
```
Rationale against the five evaluation criteria:
- **Provenance**: `source: "staff_entered"` is literally true (staff
  did type it, at invitation creation) — an existing enum member, no
  fabricated provenance.
- **Confirmation**: lands as ordinary `acquired_unconfirmed`,
  reviewable/correctable by the beneficiary in Module0's existing
  review UI exactly like any other acquired field — no special-casing.
- **A0/Coach visibility**: Coach's `missingA1`/`protectedA1` logic
  immediately sees email as already-known and stops asking for it —
  this directly closes the re-ask friction at its actual cause, not
  just at Module 1.
- **No-overwrite**: inherited automatically from `prefillModule1`'s
  existing rule — zero new code.
- **Single source of truth**: Structured Profile remains the one
  place reflecting "what does the system currently know about this
  beneficiary's email" — a direct, SP-bypassing prefill input would
  create a second, incoherent source (Module1 shows a value while
  Coach still thinks email is unknown and keeps asking).

Design: compute once, at `IntakeFormData` initial construction (not a
recurring effect, not re-applied on every render) —
`acquireField(emptyField(), { value: invitationEmail, source:
"staff_entered", confidence: "high" })` — seeding
`INITIAL.module0.structuredProfile.email`. If a saved draft exists,
the existing hydration merge (`{...INITIAL, ...saved}`) already lets
the saved value win, since `saved` is spread last.

### Email No-Overwrite / Precedence

```
EMAIL_PRECEDENCE:
  1. Existing Module1.email (beneficiary-typed, or restored from a saved draft) — wins, never overwritten.
  2. Else, Structured Profile email as of session start — which is either:
     a. the invitation-seeded value (source=staff_entered), if A0/Coach have not yet
        acquired anything, or
     b. whatever A0/Coach actually acquired/confirmed, via the EXISTING acquireField
        conflict-detection path if it disagrees with the seed (marked "conflicting",
        both preserved, never silently overwritten — zero new logic).
  3. Else empty — Module 1 asks normally (cannot occur once seeded, since the
     invitation always supplies a NOT NULL email at this point in the flow).
```

## K. CBR Boundary

```
MODULE1_CBR_CONSUMPTION_AFTER_DESIGN: NONE
```
Nothing in this design reads, writes, or references `cbr_internal`,
any `cbr_tx0*` function, any gate, or any admission window. Confirmed
by construction — every change above is confined to
`structured-profile.ts`, `a0-extract.ts`, `prefill-engine.ts`,
`page.tsx`, `IntakeForm.tsx`, `Module0.tsx`. This design does not
authorize CBR reads for Module 1, CBR writes from A0 or Structured
Profile, CBR TX execution, CBR gate activation, CBR admission windows,
or CBR schema expansion.

```
CBR-FUTURE-QUESTION-01: Should foreignCity eventually become canonical cross-case
  beneficiary data (CBR has no foreign_city column today)?
CLASSIFICATION: OUT_OF_SCOPE_FOR_THIS_DESIGN — recorded, not designed, no migration proposed.
```

## Separate Validation Finding

```
M1-FUTURE-VALIDATION-01: Module1 UI visually marks many fields "required" but
  validate() enforces only fullName/email/whatsapp/profession.
STATUS: OPEN_SEPARATE_FINDING — not fixed, not included in this design's boundary.
```

## L. File Impact Map

| PATH | WHY | CAPABILITY | SYMBOLS | CHANGE TYPE | RISK | CLASS |
|---|---|---|---|---|---|---|
| `src/lib/intake/structured-profile.ts` | SP vocabulary + classification | A | `IDENTITY_FIELDS`, `CLASS_A1_FIELDS` | constant extension (+6 each) | LOW | REQUIRED |
| `src/lib/intake/a0-extract.ts` | A0 whitelist/prompt source | A | `A0_FIELD_LIST` | constant extension (+6) | LOW | REQUIRED |
| `src/lib/intake/coach.ts` | — | A | none | none | — | NOT_REQUIRED |
| `src/lib/intake/prefill-engine.ts` | prefill the 6 new fields into Module1 | A | `prefillModule1()` | add `countryOfBirth` to existing loop; add new small translated-key loop for 5 foreign-address fields | LOW-MEDIUM (must mirror exact no-overwrite guard) | REQUIRED |
| `src/app/intake/modules/Module0.tsx` | review-UI labels for the 6 new fields | A | `FIELD_LABELS` | add 6 Spanish labels | LOW (cosmetic; functional fallback `key` already exists) | REQUIRED (UX correctness) |
| `src/app/intake/page.tsx` | load invitation email | B | invitation `.select(...)`, `<IntakeForm>` props | add `email` to select; add `invitationEmail` prop | LOW | REQUIRED |
| `src/app/intake/IntakeForm.tsx` | seed SP.email once at session start | B | `invitationEmail` prop, `INITIAL` construction | one-time conditional seed via `acquireField` | LOW-MEDIUM (must not re-run on every render; must defer to hydration) | REQUIRED |
| `src/app/intake/modules/Module1.tsx` | — | — | none | none | — | NOT_REQUIRED (fields already exist) |
| `src/app/intake/types.ts` | — | — | none | none | — | NOT_REQUIRED (Module1 type already has all 6 target keys) |
| `src/app/api/intake/a0-extract/route.ts`, `.../coach/route.ts` | — | — | none | none | — | NOT_REQUIRED (pure HTTP delegation) |
| Intake Intelligence Layer regression harness(es) (e.g. `supabase/tests/intake-intelligence-layer-validate.ts`, `provenance-unit-tests.ts`) | regression coverage | BOTH | new test cases | additive | LOW | REQUIRED |

## M. Regression Test Design

All 23 proposed tests are adopted, mapped to the mechanisms above:

```
TEST-A01  A0 accepts countryOfBirth when source supplies it.
TEST-A02  A0 accepts all five foreign-address components when supplied.
TEST-A03  missing source values remain absent — no hallucinated values.
TEST-A04  new fields survive Structured Profile serialization/state lifecycle.
TEST-A05  beneficiary confirmation preserves original provenance.
TEST-A06  Coach cannot overwrite confirmed protected new fields.
TEST-A07  Coach can acquire permitted missing new fields if design authorizes it.
TEST-P01  prefill maps countryOfBirth correctly.
TEST-P02  prefill maps foreignStreet correctly.
TEST-P03  prefill maps foreignCity correctly.
TEST-P04  prefill maps foreignProvince correctly.
TEST-P05  prefill maps foreignPostalCode without numeric coercion.
TEST-P06  prefill maps foreignCountry correctly.
TEST-P07  existing Module 1 values are never overwritten.
TEST-P08  restored saved Module 1 values are never overwritten.
TEST-E01  invitation email is reused only if its semantics are authorized.
TEST-E02  existing Module 1 email wins over invitation email.
TEST-E03  saved/resumed beneficiary email wins over invitation email.
TEST-E04  stronger Structured Profile email precedence is deterministic.
TEST-R01  FACTS → Intake separation remains intact.
TEST-R02  existing save/resume behavior remains intact.
TEST-R03  existing 12-field prefill behavior does not regress.
TEST-R04  CBR remains absent from Module 1 read/write path.
```

TEST-A01–A07 exercise `a0-extract.ts`/`structured-profile.ts`/
`coach.ts`'s existing generic machinery against the six new keys;
TEST-P01–P08 exercise `prefill-engine.ts`'s two loops (direct +
translated); TEST-E01–E04 exercise the `IntakeForm.tsx`
seed-once-at-INITIAL design and its precedence against Module1/SP/
saved-draft values; TEST-R01–R04 are pure non-regression checks of
already-verified behavior (FACTS separation, save/resume, the original
12-field prefill, CBR absence).

### Regression Protection Plan

The implementation must explicitly preserve: the existing 12-field
identity prefill (profession, industry, yearsExperience, whatsapp,
email via the existing SP path, and the rest); `fullName` derivation;
no-overwrite semantics; save/resume; pending resume position; autosave
stability; CP-01/02/03 checkpoints; FACTS separation; Coach Class A1
protection; `confirmed_from_source`; criterion-narrative exclusion from
Module 1; and CBR non-participation. TEST-R01–R04 plus the full
existing Intake Intelligence Layer regression suite are the mechanism
by which this is proven, not merely asserted.

## N. Implementation Slices

```
SLICE A1 — SP vocabulary/classification
  FILES: structured-profile.ts
  PRECONDITIONS: none
  CHANGE: +6 IDENTITY_FIELDS, +6 CLASS_A1_FIELDS
  TESTS: TEST-A04, TEST-A05, TEST-A06
  SUCCESS: 27-field vocabulary, generic functions unchanged, Class A1 freeze covers new keys
  ROLLBACK: revert the two constant arrays

SLICE A2 — A0 extraction
  FILES: a0-extract.ts
  PRECONDITIONS: A1 landed (keeps the two whitelists in sync)
  CHANGE: +6 A0_FIELD_LIST
  TESTS: TEST-A01, TEST-A02, TEST-A03
  SUCCESS: A0 extracts the 6 fields only when source-stated; omits otherwise
  ROLLBACK: revert the constant

SLICE A3 — Coach compatibility verification (no code change expected)
  FILES: none (coach.ts inherits A1 automatically)
  PRECONDITIONS: A1 landed
  CHANGE: none
  TESTS: TEST-A06, TEST-A07 (confirm inheritance, not new logic)
  SUCCESS: Coach prompt guidance correctly lists the 6 new fields as protected/missing/enrichable
  ROLLBACK: n/a

SLICE A4 — Prefill mapping
  FILES: prefill-engine.ts, Module0.tsx (FIELD_LABELS)
  PRECONDITIONS: A1 landed
  CHANGE: countryOfBirth into existing loop; new translated-key loop for 5 fields; 6 labels
  TESTS: TEST-P01–P08
  SUCCESS: all 6 fields prefill correctly, no-overwrite preserved, labels render
  ROLLBACK: revert prefill-engine.ts and the label additions

SLICE B1 — Invitation email reuse
  FILES: page.tsx, IntakeForm.tsx
  PRECONDITIONS: none (independent of Capability A; may land in parallel)
  CHANGE: select email; thread prop; one-time INITIAL seed via acquireField
  TESTS: TEST-E01–E04
  SUCCESS: email appears prefilled only when Module1/SP/saved-draft don't already have it; Coach stops asking for it
  ROLLBACK: revert page.tsx select + IntakeForm.tsx seed

SLICE T — Full regression verification
  FILES: Intake Intelligence Layer test harness(es)
  PRECONDITIONS: A1–A4 and B1 landed
  CHANGE: additive tests only
  TESTS: TEST-R01–R04 plus the full A/P/E suite
  SUCCESS: zero regression in the 12-field path, FACTS separation, save/resume, CBR absence
  ROLLBACK: n/a (test-only)
```

Dependency order: A1 → {A2, A4 in parallel} → A3 (verification only) →
T, with B1 independent and parallelizable at any point.

## O. Owner Decisions

```
OWNER_DECISIONS_REQUIRED: NONE
```
Every input this design needed was resolved from current source:
invitation-email semantics (unambiguous), foreign-address conditional
rendering (unconditional, confirmed), Coach inheritance (automatic,
zero new code). Two judgment calls were made rather than escalated,
with rationale given above for the Owner to override if desired: (1)
classifying all six new fields as Class A1 by consistency with the
existing `countryOfResidence`/`cityOfResidence` precedent; (2) seeding
the invitation email into Structured Profile (not a direct,
SP-bypassing prefill input) for coherence with Coach's existing
visibility logic.

## P. Gap-by-Gap Design Determination

```
M1-GAP-01_DESIGN: READY   (countryOfBirth)
M1-GAP-02_DESIGN: READY   (foreignStreet)
M1-GAP-03_DESIGN: READY   (foreignCity)
M1-GAP-04_DESIGN: READY   (foreignProvince)
M1-GAP-05_DESIGN: READY   (foreignPostalCode)
M1-GAP-06_DESIGN: READY   (foreignCountry)
M1-GAP-07_DESIGN: READY   (invitation email reuse)

MODULE1_EXACT_DESIGN: PASS
```

## Q. Final Authorization Boundary

```
DESIGN: APPROVED
IMPLEMENTATION: NOT YET AUTHORIZED BY THIS ARTIFACT

SOURCE MUTATION: NOT PERFORMED AS PART OF DESIGN
DATABASE MUTATION: NOT AUTHORIZED
CBR MODIFICATION: NOT AUTHORIZED
MIGRATION: NOT AUTHORIZED
PRODUCTION: NOT AUTHORIZED
P7: BLOCKED
BROADER_PHASE_B: NOT AUTHORIZED
```

The next implementation act requires separate Owner authorization.
