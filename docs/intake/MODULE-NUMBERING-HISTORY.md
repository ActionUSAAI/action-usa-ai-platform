# AUSCIS Intake Module Numbering — Canonical Identity & Legacy Compatibility

```
Status: FROZEN
Scope: Intake module identity / numbering compatibility
Canonical application numbering: Module0–Module13 + Summary
Legacy persistence contract: PRESERVED
Historical data migration: NONE
Database schema change: NONE
RPC signature change: NONE
Summary identity: NON-NUMBERED
Legacy module3: LEGACY_RESERVED_UNUSED
Canonicalization completion baseline (pre-C9 runtime state): 3b7771b4cfa22bfe4b11f782f3c2fb9fdfb088a5
```

## 1. Why the numbering differs

The original Intake had a Module 3 ("Family group") whose information was
later found to duplicate information already collected in Module 2. That
content was merged into Module 2 and removed from the beneficiary-visible
flow, but the remaining source components were never renumbered. From that
point on, the beneficiary-visible module number and the historical
source/persistence module number diverged — **non-uniformly**: +1 from
Module 3 through Module 11, +2 for Module 12–13, and the final
Summary/Submit screen sat outside the pattern entirely.

This history is corroborated directly by source: `git log --follow` on the
historical stub shows the commit `refactor(intake): merge Module3 (family)
into Module2, reduce to 12 steps`, and `migrations/001_aucis_intake.sql`
itself comments the `module3` column as `-- Family group`. The dead
historical stub (`// Module3 content merged into Module2 (Documentos y
Grupo Familiar).`) has since been removed as part of this canonicalization
(see §12).

Canonicalization (this workstream) closed the gap **at the application
layer only** — see §2 — without touching the legacy persistence contract.

## 2. The frozen architectural invariant

```
CANONICAL NUMBERING LIVES IN THE APPLICATION / DOMAIN LAYER.
LEGACY NUMBERING REMAINS AT PERSISTENCE AND HISTORICAL STORAGE BOUNDARIES.
```

Canonical application numbering does **not** authorize renaming:
- `IntakeFormData` legacy property keys;
- `intake_submissions` module columns;
- historical Storage namespaces;
- downstream persisted-contract reads (the six legal-document agents).

## 3. Canonical application model

```
Module0   Perfil Profesional (Coach + CV)
Module1   Identity
Module2   Documents + Family
Module3   Immigration History
Module4   Formal Education
Module5   Certifications
Module6   Work Experience
Module7   Own Businesses
Module8   References
Module9   Evidence
Module10  Strategic Information
Module11  Optional Strategic Services
Module12  Petitioner Information
Module13  Consultative Opinion & O-2 Companions
Summary   Resumen y Envío (final review/submit screen)
```

Labels above are the exact current `types.ts` section-heading labels
(`src/app/intake/types.ts`), source-verified, not invented. Summary is
**not** `Module14` and has no numbered data identity (§6).

## 4. Canonical → legacy data map

Every row below is written explicitly from current source — never derived
by arithmetic.

| Canonical Application Identity | Semantic Role | Legacy `IntakeFormData` Key | Legacy Persistence Column | Notes |
|---|---|---|---|---|
| Module0 | Perfil Profesional (Coach + CV) | `module0` | *none* | No standalone `intake_submissions.module0` column exists. Module0's relevant sub-state persists via the separate `structured_profile` and `coach_conversation` columns (migration `036`); `cvFilePath`/`cvFileName`/`cvSource` are never persisted into `intake_submissions` at all — only the uploaded file itself persists in Storage. |
| Module1 | Identity | `module1` | `module1` | Already canonically aligned — no rename occurred. |
| Module2 | Documents + Family | `module2` | `module2` | Already canonically aligned. |
| Module3 | Immigration History | `module4` | `module4` | — |
| Module4 | Formal Education | `module5` | `module5` | — |
| Module5 | Certifications | `module6` | `module6` | — |
| Module6 | Work Experience | `module7` | `module7` | — |
| Module7 | Own Businesses | `module8` | `module8` | — |
| Module8 | References | `module9` | `module9` | — |
| Module9 | Evidence | `module10` | `module10` | — |
| Module10 | Strategic Information | `module11` | `module11` | — |
| Module11 | Optional Strategic Services | `module12` | `module12` | — |
| Module12 | Petitioner Information | `module14` | `module14` | — |
| Module13 | Consultative Opinion & O-2 Companions | `module15` | `module15` | — |
| Summary | Resumen y Envío | *none* | *none* | Consumes only the computed `statuses` array; never has its own data key (§6). |

This exact table is also encoded, independently, in
`src/app/intake/module-numbering.ts` (§9) and in `IntakeForm.tsx`'s render
switch and `getModuleStatus` (§10–11) — all three were verified consistent
with each other and with this table at canonicalization completion.

## 5. Legacy `module3` — LEGACY_RESERVED_UNUSED

`intake_submissions.module3` remains part of the legacy persistence schema
and is written on every submission (always `{}` — no current client code
ever populates it). It does **not** correspond to canonical application
`Module3`; canonical `Module3` maps to legacy `module4` (§4).
`IntakeFormData` contains no `module3` property.

- It must **not** be repurposed.
- It must **not** be populated with canonical `Module3` data.
- It must **not** be dropped merely to make numbering visually continuous.

```
LEGACY_MODULE3: LEGACY_RESERVED_UNUSED
```

## 6. Summary — non-numbered application component

Summary is the final review/submission screen. It is not `Module14`. It has
no `IntakeFormData` numbered data property and no persistence column of its
own — it renders only the computed `statuses` array (per-module completion)
plus submit-flow state (`loading`, `error`, `onSubmit`). It must not be
assigned `module13`/`module14`/`module15` merely for visual continuity, and
its UI position does not create a domain or persistence module identity.

```
SUMMARY_APPLICATION_IDENTITY: SUMMARY_NON_DATA_COMPONENT
```

## 7. `IntakeFormData` legacy contract

The permanent legacy key set is exactly:

```
module0  module1  module2  module4  module5  module6  module7
module8  module9  module10 module11 module12 module14 module15
```

```
NO module3 property.
NO module13 property.
```

Canonical application components therefore intentionally render data such
as `Module3 → data.module4`, `Module4 → data.module5`, … `Module13 →
data.module15`. **This is compatibility, not an error.**

## 8. Render switch, status, and navigation

The render switch (`IntakeForm.tsx`) is an **intentional, strongly-typed
compatibility boundary** — each line pairs a canonical component tag with
its legacy data/`onChange` key explicitly (e.g. `<Module3 data={data.module4}
onChange={m => setData(p => ({...p, module4: m}))}/>`). It must **remain
explicit** unless a future, separately-authorized architecture change
proves otherwise. Do not replace it with a dynamic `legacyDataKey()` lookup
— the current explicit JSX gives TypeScript a direct structural check
against each component's distinct Props shape; a dynamic lookup would
require an unsafe cast and would reduce, not improve, safety.

```
RENDER_SWITCH_COMPATIBILITY: EXPLICIT_AND_TYPE_SAFE
```

`getModuleStatus` intentionally contains explicit legacy property accesses
(`f.module4`, `f.module6`, …) while its case identity (1–13) follows the
canonical/visible module sequence (they are intentionally numerically
identical post-canonicalization).

```
GETMODULESTATUS_CURRENT_BEHAVIOR: CORRECT
GETMODULESTATUS_C1_ADOPTION: NOT_RECOMMENDED
```

Dynamic `module-numbering.ts` lookup here would reduce literal-property
type safety and require casts without fixing any current drift (none
exists). One pre-existing, explicitly out-of-scope completion-rule
anomaly is recorded for completeness only, not as part of this numbering
architecture: canonical Module5 (Certifications)'s status can only ever
return `"partial"` or `"empty"`, never `"complete"` — this is a completion-
rule characteristic, unrelated to numbering, and is not governed by this
document.

Step integers in navigation (`computeNextStep`/`computePrevStep`, `TOTAL`)
represent **visible workflow positions**, not persistence or Storage
identities. Visible steps 1–13 coincide with canonical `Module1`–`Module13`
by design. Navigation must never infer a legacy persistence key from a step
number.

```
NAVIGATION_NUMBERING_DEBT: NONE
```

`module_progress` (persisted as `{1: "...", ..., 13: "..."}`) uses visible
workflow positions / canonical-shaped ordinal keys 1–13. `module-numbering.ts`
has no role here — `module_progress` never touches a `moduleN` data key.

```
MODULE_PROGRESS_COMPATIBILITY: PASS
```

## 9. Draft / localStorage

`DraftEnvelope { data, step, savedAt }` — `data` remains `IntakeFormData`
with the permanent legacy keys (§7). Canonical component renaming did not
create a new draft era; no draft migration or versioning exists or is
required.

```
DRAFT_COMPATIBILITY: PRESERVED
TWO_ERA_DRAFT_FORMAT: PROHIBITED
```

## 10. Submission / API / RPC path

```
IntakeFormData
  → submit payload ({...data, moduleStatuses, structuredProfile, coachConversation})
  → src/app/api/intake/route.ts (legacy "modules" object, incl. module3: {})
  → submit_intake_for_invitation(p_token, p_modules)
  → intake_submissions.moduleN columns
```

This is intentionally the legacy persistence contract. Canonical
application numbering does **not** propagate into persisted column
renames.

```
PERSISTENCE_CONTRACT: LEGACY_PRESERVED
HISTORICAL_DATA_MIGRATION: NO
DATABASE_SCHEMA_CHANGE: NO
RPC_SIGNATURE_CHANGE: NO
```

## 11. Storage compatibility

Source-verified historical numeric Storage prefixes:

| Canonical Identity | Semantic Role | Legacy Storage Prefix |
|---|---|---|
| Module4 | Formal Education | `module5/...` |
| Module5 | Certifications | `module6/...` |
| Module9 | Evidence | `module10/...` |
| Module10 | Strategic Information | `module11/...` |

Module12 (Petitioner Information) and Module13 (Consultative Opinion) use
already-semantic, non-numeric Storage prefixes (`petitioner/...`,
`consultative/...`, `companions/...`) and require no translation. No other
canonical module currently uploads a file.

Storage namespace values are historical compatibility identifiers.
Component/file canonicalization does not authorize renumbering them —
changing a prefix would create a **new** Storage namespace and disconnect
already-uploaded historical files. Current values match
`module-numbering.ts`'s `legacyStoragePrefix()` table exactly.
Centralizing the four literal call sites through that function is
optional, never required; prefix **value** changes are prohibited absent a
separately designed and authorized migration.

```
STORAGE_PREFIX_VALUE_CHANGE_REQUIRED: NO
HISTORICAL_STORAGE_PREFIX_RENUMBERING: PROHIBITED
```

## 12. Role of `module-numbering.ts`

Current exports:

```
CanonicalModuleId        — the 15-member canonical identity union
CANONICAL_MODULE_IDS     — ordered array of all 15
legacyDataKey(id)        — canonical -> legacy IntakeFormData key (or null)
legacyStoragePrefix(id)  — canonical -> legacy Storage prefix (or null)
```

Current production runtime consumption: **none** — every export's only
consumer is its own test file
(`supabase/tests/cbr-governed-flow/c1-module-numbering-compatibility-map-tests.ts`).

```
C1_RUNTIME_CONSUMPTION: NO
```

Its role today is: explicit canonical/legacy specification, a testable
compatibility map, and architectural ground truth — not a mandate to
dynamically route every boundary through it.

```
render switch adoption:      NOT_RECOMMENDED
getModuleStatus adoption:    NOT_RECOMMENDED
Storage resolver adoption:   OPTIONAL
persistence rewrite via C1:  NOT REQUIRED
```

## 13. No arithmetic module-number conversion

```
No code may infer legacy identity through formulas such as:
    legacy = canonical + 1
or any other arithmetic offset.
```

Reason: the mapping is non-uniform.

```
Module1  -> module1
Module2  -> module2
Module3  -> module4
...
Module11 -> module12
Module12 -> module14
Module13 -> module15
Summary  -> none
```

```
ARITHMETIC_MODULE_NUMBER_MAPPING: PROHIBITED
```

All mapping must use explicit, source-backed identities (§4, §9 of
`module-numbering.ts`).

## 14. Downstream agent contract

Six agents consume the persisted contract directly and were not, and must
not be, modified by application-layer renumbering:

```
a1-intake-analyzer
a5-case-strategy
a3-institutional-letters
a3-testimonial-letters
a4-attorney-letters
a4-i129-form
```

Each reads `submission.moduleN` using the **persistence-contract**
numbering (e.g. `m14` = legacy `module14` = canonical Module12) — never
canonical application numbering. Future application-layer renames must
never mechanically rename their `moduleN` accesses.

```
DOWNSTREAM_AGENT_NUMBERING_CHANGE_REQUIRED: NO
```

## 15. Historical canonicalization record

| Stage | Purpose | Result |
|---|---|---|
| C1 | Compatibility Mapping Foundation | CLOSED — PASS |
| C2-R1 | Canonical Type-Alias Rename | CLOSED — PASS |
| C3-R1 | Canonical Component/File Identity Rename + Module3/Summary Collision Resolution | CLOSED — PASS |
| C4 Source-First Gate | Runtime compatibility/naming review | CLOSED — PASS / NO IMPLEMENTATION REQUIRED |

## 16. Historical component identity map

For Git/history archaeology only — **never** a runtime conversion
algorithm:

```
old Module4          -> canonical Module3
old Module5          -> canonical Module4
old Module6          -> canonical Module5
old Module7          -> canonical Module6
old Module8          -> canonical Module7
old Module9          -> canonical Module8
old Module10         -> canonical Module9
old Module11         -> canonical Module10
old Module12         -> canonical Module11
old Module14         -> canonical Module12
old Module15         -> canonical Module13
old Module13 Summary -> Summary

Historical dead Module3 stub: REMOVED
```

## 17. Future Developer Guardrails

**DO NOT:**
- add `IntakeFormData.module3`;
- add `IntakeFormData.module13`;
- move canonical Module3 data into legacy `module3`;
- rename `intake_submissions` columns merely for visual alignment;
- renumber historical Storage prefixes;
- assign Summary a numbered data identity;
- derive legacy module identity arithmetically;
- mechanically rename downstream `sub.moduleN` reads;
- dynamically replace strongly-typed explicit boundaries merely to consume
  `module-numbering.ts`;
- create a second persistence era without an explicitly designed and
  authorized migration;
- infer persistence identity from a component's filename;
- infer Storage identity from a component's filename;
- infer persistence identity from a visible step number.

**DO:**
- preserve the explicit canonical→legacy mapping (§4);
- consult `module-numbering.ts` as the architectural ground truth;
- update its tests if an explicitly-authorized mapping ever changes;
- treat any persistence or Storage change as a migration requiring
  separate design and authorization;
- preserve historical compatibility unless a governed migration replaces
  it.

## 18. Non-Blocking Deferred Cleanup

The following cosmetic items were identified during canonicalization.
**They do not affect correctness** and remain optional, deferred, separate
future work:

1. `shouldShowModule12` — a stale name; a semantic candidate is
   `shouldShowOptionalStrategicServices`.
2. `computeNextStep`'s docstring contains stale "Module 12" wording that
   should reference canonical Module11 / visible step 11.
3. Two comments in `Module5.tsx` and `Module9.tsx` still read "Ver nota de
   updDegreeFields en Module5.tsx" — the function now lives in `Module4.tsx`.
4. `legacyStoragePrefix()` runtime adoption at the four Storage literal
   call sites remains optional, never required.
