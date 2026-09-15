# MTCS-06 — A1/A5 Historical Reliance — Final Exact Design

## PART I — IDENTIFICATION AND AUTHORITY

```
ARTIFACT ID:            MTCS-06-FINAL-EXACT-DESIGN
TITLE:                  MTCS-06 — A1/A5 Historical Reliance — Final Exact Design
PROJECT:                AUSCIS
MCS:                    MTCS-06 — A1/A5 Historical Reliance
ARTIFACT TYPE:          Final Exact Design
ARCHITECTURAL STATE:    FROZEN
DESIGN MR:              PASS
CORRECTIONS REQUIRED:   0
IMPLEMENTATION STATE:   GAP / NOT IMPLEMENTED
GOVERNING CPS:          docs/CANONICAL_PROJECT_STATE.md
SOURCE BASELINE:        bcdc0a707c30c7f7d900884078a4a4f082812fe6
JOINT DECISIONS:        DD-06-01 through DD-06-07 — RESOLVED
GENERALIZATION:         CA-AEPE-07 — Historical Reliance Traceability
                        CANDIDATE AEPE — NOT PROMOTED
```

```
DESIGN:            APPROVED / FROZEN
IMPLEMENTATION:    NOT AUTHORIZED
```

This artifact is self-contained. A future reader needing only
`docs/CANONICAL_PROJECT_STATE.md` plus this artifact can determine
exactly what MTCS-06 is designed to implement, without reconstructing
prior conversational sessions.

**Source hierarchy this artifact consolidates:** MTCS-06 Exact Design →
MTCS-06 Exact Design — Joint Decision Reconciliation (DD-06-01–04) →
MTCS-06 Final Joint Decision Reconciliation (DD-06-05/DD-06-06) →
DD-06-07 (Fact at Reliance) → DD-06-07 Incorporated — Delta
Reconciliation → this Final Exact Design.

---

## PART II — PROBLEM STATEMENT

A1 and A5 currently produce versioned reasoning artifacts
(`agent_intake_analysis`, `case_strategy`) but do not preserve
structured Historical Reliance on the exact Evidence input used to
produce that reasoning. Neither route references `evidence_items` or
`evidence_item_documents` at runtime today. Historical Reliance must
make prior reasoning historically reconstructable — exactly what
Evidence composition, at what state, with which associated Documents,
was actually supplied to the reasoning process — without later Evidence
evolution silently rewriting what an already-persisted reasoning
artifact is recorded as having relied upon.

This design does not broaden into general reasoning provenance, general
Evidence lifecycle redesign, or general A1/A5 reasoning redesign.

---

## PART III — GOVERNING PRINCIPLES

```
Evidence Item ≠ Document
Case Evidence ≠ Governed Knowledge
Historical Reliance ≠ Verification
Historical Reliance ≠ Current Evidence State
Verification remains human-only
Documentary Condition is surfaced, not a gate
Verification Condition is surfaced, not a gate
Evidence changes do not automatically trigger A1/A5
No automatic Blueprint regeneration
No full Evidence snapshot
No Evidence V2 lifecycle redesign
No parallel A5 Historical Reliance subsystem
```

---

## PART IV — FINAL JOINT DECISION REGISTER

```
DD-06-01 — RESOLVED
Any CURRENT Evidence composition may be considered by A1/A5, regardless
of Verification Condition (Pending / Verified / Needs Attention).
Verification Condition is surfaced to the reasoning process, never a
gate. RELIED UPON ≠ VERIFIED; VERIFIED ≠ RELIED UPON.

DD-06-02 — RESOLVED
Documentary Condition (Reported / Partial / Documented) is surfaced as
context, never a gate on eligibility.

DD-06-03 — RESOLVED
Historical Reliance preserves minimum state-at-reliance provenance:
evidence_item_id, probative_revision_at_reliance,
documentary_condition_at_reliance, verification_condition_at_reliance.
No full Evidence snapshot. Refined (not reversed) by DD-06-07.

DD-06-04 — RESOLVED
A1 Historical Reliance uses a dedicated normalized persistence
relationship (not a JSONB column), with DB-authoritative same-case
traceability. Applies to A1 only, not A5.

DD-06-05 — RESOLVED — OPTION A APPROVED
A5 continues using the existing frozen Blueprint Evidence-reference
structures (foundational_evidence, evidence_dependencies) through a
narrow, additive contract amendment. No parallel A5 Historical
Reliance subsystem.

DD-06-06 — RESOLVED
Exact canonical Document membership (documents.id) at the moment of
reliance must remain historically reconstructable, regardless of
Evidence's Verification/Documentary Condition, surviving later
attach/detach.

DD-06-07 — RESOLVED
The exact Evidence fact text supplied to A1/A5 at the Reliance Input
Snapshot Moment must be preserved as fact_at_reliance. Minimal
provenance only — not a full Evidence snapshot.
```

No DD remains open.

---

## PART V — FINAL HISTORICAL RELIANCE INVARIANT

```
REASONING ARTIFACT
        │
        ▼
HISTORICAL RELIANCE
        │
        ├── evidence_item_id
        ├── probative_revision_at_reliance
        ├── fact_at_reliance
        ├── documentary_condition_at_reliance
        ├── verification_condition_at_reliance
        │
        └── exact canonical Documents at reliance
```

Canonical Document identity: `documents.id` (confirmed — MTCS-02A
convergence; storage_bucket/file_path remain physical locators only).

Historical Reliance represents the Evidence input actually supplied to
the reasoning process — not merely whatever Evidence state happens to
exist later, at persistence time.

---

## PART VI — RELIANCE INPUT SNAPSHOT MOMENT

```
EVIDENCE READ
      │
      ▼
RELIANCE INPUT SNAPSHOT MOMENT
      │
      ├── evidence_item_id
      ├── probative_revision
      ├── fact
      ├── documentary_condition
      ├── verification_condition
      └── document membership (document_ids)
      │
      ▼
A1 / A5 REASONING INPUT
      │
      ▼
REASONING (e.g., Claude call — may take real wall-clock time)
      │
      ▼
PERSIST HISTORICAL RELIANCE
```

All six values are captured **once**, from the single Evidence read
used to construct the A1/A5 prompt, and threaded through the reasoning
operation as ordinary in-memory values. At final persistence, the
system **does not re-query** `evidence_items`/`evidence_item_documents`
— it writes exactly the captured values.

---

## PART VII — RACE-INTEGRITY RULE

```
Snapshot:
Revision 2, Fact A, Documents A/B/C
        │
        ▼
A1/A5 reasoning
        │
        ├──── meanwhile ────► Live Evidence becomes:
        │                     Revision 3, Fact B, Documents A/C/D
        ▼
Historical persistence MUST remain:
Revision 2, Fact A, Documents A/B/C
```

Because nothing is re-queried after the snapshot moment (Part VI), this
is guaranteed by construction, not by locking or transaction isolation
on the Evidence tables themselves.

---

## PART VIII — A1 FINAL HISTORICAL RELIANCE MODEL

```
agent_intake_analysis
        │
        ▼
A1 Historical Reliance
   PK: (criterion_assessment_id, evidence_item_id)
   FK: (criterion_assessment_id, case_id) → agent_intake_analysis(id, case_id)
       [requires additive UNIQUE(id, case_id) on agent_intake_analysis —
        design only, mirrors migration 027's identical precedent for
        evidence_items/documents]
   FK: (evidence_item_id, case_id) → evidence_items(id, case_id)
       [already exists — migration 027]
   Fields: probative_revision_at_reliance,
           fact_at_reliance,
           documentary_condition_at_reliance,
           verification_condition_at_reliance,
           created_at
        │
        │ 1:N
        ▼
A1 Historical Reliance Document
   PK: (criterion_assessment_id, evidence_item_id, document_id)
   FK: (criterion_assessment_id, evidence_item_id) → A1 Historical Reliance
   FK: (document_id, case_id) → documents(id, case_id)
       [already exists — migration 027]
```

`fact_at_reliance` belongs to the Evidence-level Historical Reliance
row, not to each Document-membership row — never duplicated per
Document.

**Same-case integrity:**
```
A1 → Evidence:    DB-AUTHORITATIVE
A1 → Document:    DB-AUTHORITATIVE
```

**Uniqueness:** the composite PKs above. **Immutability:** insert-only,
no UPDATE grant on either table (HR-02, Evidence Item Contract V2 §40).
**Delete behavior:** `ON DELETE CASCADE` on all FKs, transitively from
Case deletion, matching `evidence_item_documents`'s own precedent
exactly. No SQL is executed by this artifact.

---

## PART IX — A5 FINAL HISTORICAL RELIANCE MODEL

```
Case Blueprint Version (case_strategy.id)
        │
        ▼
foundational_evidence[] / evidence_dependencies[criterion][]
   (existing frozen JSONB columns, per-Blueprint-version scope
   unchanged)
        │
        └── each element (final proposed shape, Part X):
```
```
{
  evidence_item_id | description,
  why_foundational,                        // foundational_evidence only
  probative_revision_at_reliance?,
  fact_at_reliance?,
  documentary_condition_at_reliance?,
  verification_condition_at_reliance?,
  document_ids_at_reliance?
}
```

The five provenance fields apply when `evidence_item_id` is present;
the `description`-only free-text fallback (for content predating typed
Evidence) is preserved unchanged.

**Same-case integrity:**
```
A5 → Evidence:    APP-VALIDATED
A5 → Document:    APP-VALIDATED
```
The frozen JSONB structure has no relational FK surface — this is
explicitly disclosed, not compensated by a second, parallel DB-enforced
mechanism (DD-06-05 forbids a parallel A5 subsystem).

**Atomic persistence:** same-row, same INSERT as the `case_strategy`
row itself. **Contract amendment requirement:** YES (Part X).

---

## PART X — BLUEPRINT CONTRACT AMENDMENT

```
CONTRACT AMENDMENT REQUIRED:
YES
```

**CURRENT SHAPE** (`A5_CASE_BLUEPRINT_SPECIFICATION_V2.md:178,185`,
verbatim):
```
foundational_evidence:
  Array de { evidence_item_id | description, why_foundational }

evidence_dependencies:
  Map criterion_key → array de { evidence_item_id | description }
```

**FINAL PROPOSED SHAPE:**
```
foundational_evidence:
  Array de {
    evidence_item_id | description,
    why_foundational,
    probative_revision_at_reliance?,
    fact_at_reliance?,
    documentary_condition_at_reliance?,
    verification_condition_at_reliance?,
    document_ids_at_reliance?
  }

evidence_dependencies:
  Map criterion_key → array de {
    evidence_item_id | description,
    probative_revision_at_reliance?,
    fact_at_reliance?,
    documentary_condition_at_reliance?,
    verification_condition_at_reliance?,
    document_ids_at_reliance?
  }
```

**Preserved semantics:** `foundational_evidence`'s meaning (the
load-bearing evidence the case theory rests on) is unchanged;
`evidence_dependencies`'s meaning (per-criterion dependency list) is
unchanged; per-Blueprint-version scope is unchanged; the `description`
free-text fallback (Brecha #1,
`A5_CASE_BLUEPRINT_SPECIFICATION_V2.md:282`) remains valid; nothing
existing is removed, renamed, or reinterpreted.

**Classification:**
```
NARROW
ADDITIVE
VERSION-WORTHY
NOT A RE-ARCHITECTURE
```

**Expected governed successor** (per the contract's own established
v1→v2 supersession precedent — a "field-scope correction, not a
re-architecture"): `A5_CASE_BLUEPRINT_SPECIFICATION_V3`, additive-only,
with v2 preserved as the prior version, not deleted.

**This amendment is recorded here as required future work — it is NOT
created or modified by this materialization operation.**

---

## PART XI — DOCUMENT-SET HISTORICAL RECONSTRUCTION

```
DOCUMENT-SET HISTORICAL RECONSTRUCTION:
REAL GAP IDENTIFIED → RESOLVED IN FINAL DESIGN
```

**A1:** reliance-scoped normalized document membership (Part VIII,
"A1 Historical Reliance Document").
**A5:** `document_ids_at_reliance` array embedded inside the existing,
now-amended Blueprint Evidence reference (Part IX/X).

Resolution mechanism: capturing the document-id set at the Reliance
Input Snapshot Moment (Part VI) and persisting it directly — never
relying on a later query against the historyless, live-only
`evidence_item_documents` table. `evidence_item_documents` itself is
**not** versioned or redesigned.

---

## PART XII — FACT-AT-RELIANCE HISTORICAL RECONSTRUCTION

```
FACT-TEXT HISTORICAL RECONSTRUCTION:
REAL GAP IDENTIFIED → RESOLVED BY DD-06-07
```

Historical Reliance preserves `fact_at_reliance` — captured once at the
Reliance Input Snapshot Moment, persisted immutably alongside the other
provenance fields. This is minimal provenance (one scalar TEXT value
per reliance record), not a full Evidence snapshot: no Document
content, no review history, no metadata, no prompt text, no Case state
is duplicated anywhere in this design.

Divergence between current `evidence_items.fact` and a historical
`fact_at_reliance`, following a legitimate correction, is expected
behavior, not a data-integrity defect.

---

## PART XIII — ATOMICITY

**A1 write atomicity:** the reasoning-artifact insert
(`agent_intake_analysis`), the A1 Historical Reliance row insert(s),
and the A1 Historical Reliance Document row insert(s) must succeed or
fail together. Approved design precedent: one `SECURITY INVOKER`
governed Postgres function, directly extending the existing
`create_evidence_composition_with_documents()` idiom (outer entity +
child rows, atomically, one transaction) one level deeper. Not
implemented by this artifact.

**A5 write atomicity:** unchanged — the reliance fields (including
`fact_at_reliance` and `document_ids_at_reliance`) are written in the
same INSERT as the `case_strategy` row itself. No separate transaction
or subsystem.

**Input-snapshot correctness** (distinct from write atomicity):
resolved for both agents by Part VI/VII's capture-once-and-thread-
through rule — persisted values must be the values captured at the
snapshot moment, never re-derived at write time.

---

## PART XIV — IMMUTABILITY

Once persisted, no Historical Reliance record is rewritten by:
```
fact correction · document attach · document detach ·
Documentary Condition change · Verification Condition change ·
Human Review · Evidence supersession · A1 reassessment ·
A5 new strategy · new Blueprint version
```
A new reasoning artifact produces its own, independent Historical
Reliance record (Part IV, DD-06-01 lineage; existing append-only
versioning pattern for `agent_intake_analysis`/`case_strategy`). Old
reasoning provenance remains unchanged.

---

## PART XV — BLUEPRINT PATCH GUARD

```
NARROW MTCS-06 PATCH GUARD:
SUFFICIENT
```

The Historical Reliance provenance added to A5 lives entirely inside
`foundational_evidence`/`evidence_dependencies` — the existing narrow
guard (rejecting PATCH updates to these two JSONB columns once the
Blueprint has left `proposed`/`edited` status) already covers every
field added by this design, including `fact_at_reliance` and
`document_ids_at_reliance`, with no widening required. General
Blueprint PATCH/lock enforcement beyond these two fields remains
outside MTCS-06.

---

## PART XVI — FINAL MINIMUM CHANGE SET

```
MTCS-06.1 — A1 Evidence + Document Read
Capture once, at the Reliance Input Snapshot Moment, for all eligible
CURRENT Evidence compositions (no Verification/Documentary gate):
evidence_item_id, probative_revision, fact, documentary_condition,
verification_condition, document_ids. No A1 scoring/threshold/criteria
change. Read-only.

MTCS-06.2 — A1 Historical Reliance Persistence
One governed, transactional Postgres function performing: the
agent_intake_analysis insert, A1 Historical Reliance row insert(s),
and A1 Historical Reliance Document row insert(s) — using exactly the
values captured by MTCS-06.1, never re-derived. Requires an additive
UNIQUE(id, case_id) on agent_intake_analysis. No Evidence V2 schema
change.

MTCS-06.3 — A5 Evidence + Document Read and Blueprint Reliance
Population
Independent Evidence/document capture (same pattern as MTCS-06.1, own
selection, not derived from A1's set). Populate the amended
foundational_evidence/evidence_dependencies fields with real
evidence_item_id, probative_revision_at_reliance, fact_at_reliance,
documentary_condition_at_reliance, verification_condition_at_reliance,
document_ids_at_reliance. Requires the Blueprint Contract amendment
(Part X). No parallel A5 subsystem. No A5 strategic-reasoning change.

MTCS-06.4 — Narrow Historical Reliance Mutation Guard
Targeted PATCH guard on exactly foundational_evidence/
evidence_dependencies once the Blueprint has left proposed/edited
status. No general Blueprint lock-enforcement change.
```

No MTCS-06.5. The document-membership and fact-at-reliance
requirements folded entirely into MTCS-06.2/06.3 — neither required a
separable mechanical unit.

---

## PART XVII — ACCEPTANCE CRITERIA

```
AC-01  A historical A1 assessment identifies the exact Evidence
       composition(s) it relied upon.
AC-02  A historical A5 strategy/Blueprint identifies the exact
       Evidence composition(s) it relied upon.
AC-03  Later Evidence composition changes do not rewrite old reliance.
AC-04  A new reassessment/strategy relies on newer Evidence without
       changing old reasoning provenance.
AC-05  Cross-case Evidence reference rejected (DB-authoritative A1;
       app-validated A5).
AC-06  Historical reliance does not alter Documentary Condition.
AC-07  Historical reliance does not alter Verification Condition.
AC-08  Evidence changes do not automatically trigger A1/A5/Blueprint.
AC-09  No existing Evidence V2 behavior regresses.
AC-10  No outside-scope capability is introduced.
AC-11  probative_revision_at_reliance preserved for every reliance
       record.
AC-12  documentary_condition_at_reliance preserved for every reliance
       record.
AC-13  verification_condition_at_reliance preserved for every reliance
       record.
AC-14  Pending Evidence considered without becoming Verified.
AC-15  Needs Attention Evidence considered without becoming Verified.
AC-16  Reported/Partial Evidence considered without becoming
       Documented.
AC-17  A1 and A5 maintain independent reliance sets.
AC-18  Old reliance remains historically reconstructable after later
       Evidence state changes.
AC-19  For every A1/A5 Historical Reliance record, the exact canonical
       Document membership supplied to the reasoning process remains
       reconstructable after later Evidence attach/detach,
       supersession, review, or other normal Evidence evolution — for
       Evidence of ANY Verification or Documentary Condition at
       reliance time.
AC-20  Attaching a Document to an Evidence composition after reliance
       does not alter any existing reliance record's document set.
AC-21  Detaching a Document from an Evidence composition after
       reliance does not alter any existing reliance record's
       document set.
AC-22  Cross-case Document reference rejected (DB-authoritative A1;
       app-validated A5).
AC-23  Persisted Historical Reliance provenance corresponds exactly to
       what was captured at the Reliance Input Snapshot Moment, not to
       whatever state exists at final persistence time.
AC-24  fact_at_reliance is preserved for every reliance record (A1 and
       A5) and corresponds exactly to the fact text captured at the
       Reliance Input Snapshot Moment.
AC-25  A later in-place fact correction does not alter any existing
       reliance record's fact_at_reliance.
AC-26  Divergence between current evidence_items.fact and a historical
       fact_at_reliance, following a legitimate correction, is
       expected behavior, not a data-integrity defect.
```

---

## PART XVIII — FUTURE IMPLEMENTATION TEST MATRIX

```
A1 Pending Evidence + documents A/B/C — first reliance
A5 Pending Evidence + documents A/B/C — first reliance
attach D after reliance → old reliance remains A/B/C
detach B after reliance → old reliance remains A/B/C
fact correction after reliance → old fact_at_reliance remains original
current fact ≠ historical fact_at_reliance → expected, not an error
probative_revision change after reliance → old revision preserved
Documentary Condition change after reliance → old condition preserved
Verification Condition change after reliance, incl. re-review → old
  condition preserved
Evidence supersession after reliance → old reliance preserved
Human Review occurring after an earlier Pending-state reliance → old
  Pending state preserved
A1 reassessment with a different document/fact set → new independent
  reliance, old untouched
A5 new Blueprint version with a different document/fact set → new
  independent reliance, old untouched
cross-case Evidence rejection — A1 (DB), A5 (app)
cross-case Document rejection — A1 (DB), A5 (app)
duplicate document membership in one reliance record (idempotent)
A1 governed-function rollback on partial failure (all rows all-or-
  nothing)
A5 persistence failure (same-row, existing behavior unchanged)
Evidence mutated between reasoning-input capture and reasoning-artifact
  persistence — historical record still matches captured values
no automatic reassessment/regeneration triggered by any Evidence or
  Document change
```

No test code is produced by this artifact.

---

## PART XIX — EXPLICIT NON-REQUIREMENTS

```
Agentic RAG · Market Intelligence · Learning Engine · RFE Prediction ·
CV/A0 general completion · Coach · Multi-Tenant · Human Review Gate ·
Generated Work Product re-entry · new agents · A2 redesign · general
Evidence lifecycle redesign · AEPE architecture · AKAE architecture ·
INA · automatic A1 reassessment · automatic A5 regeneration ·
automatic Blueprint regeneration · general A1 scoring redesign ·
general A5 reasoning redesign · general Blueprint locking · A3/A4
Blueprint-version pinning · general event sourcing · generic audit
infrastructure
```

Future implementation may not treat MTCS-06 as authorization for any of
the above.

---

## PART XX — GENERALIZATION BOUNDARY

```
CA-AEPE-07 — Historical Reliance Traceability
STATUS: CANDIDATE AEPE — NOT PROMOTED
```

No AEPE artifact is created or modified by this design or by this
materialization.

---

## PART XXI — IMPLEMENTATION BOUNDARY

```
THIS ARTIFACT AUTHORIZES DESIGN ONLY.
MTCS-06 IMPLEMENTATION: NOT AUTHORIZED.
```

No migration number is assigned. No schema or runtime code is created
by this artifact. Implementation requires separate, explicit
authorization after canonical freeze.

---

## PART XXII — DESIGN MR RECORD

```
MTCS-06 FINAL EXACT DESIGN — DESIGN MR

RESULT:                              PASS
CORRECTIONS REQUIRED:                0
A1 HISTORICAL RELIANCE MODEL:        PASS
A5 HISTORICAL RELIANCE MODEL:        PASS
EXACT DOCUMENT-SET RECONSTRUCTION:   PASS
EXACT FACT-AT-RELIANCE RECONSTRUCTION: PASS
RELIANCE INPUT SNAPSHOT:             PASS
RACE-INTEGRITY MODEL:                PASS
WRITE ATOMICITY:                     PASS
SAME-CASE INTEGRITY:                 PASS
BLUEPRINT CONTRACT AMENDMENT:        PASS — NARROW / ADDITIVE
EVIDENCE V2 COMPATIBILITY:           PASS
HUMAN VERIFICATION BOUNDARY:         PRESERVED
NEW JOINT DECISIONS:                 NONE
```

---

## PART XXIII — FINAL DESIGN STATE

```
MTCS-06 — A1/A5 HISTORICAL RELIANCE

FINAL EXACT DESIGN:       APPROVED
ARCHITECTURAL STATE:      FROZEN
DESIGN MR:                PASS
CORRECTIONS REQUIRED:     0
JOINT DECISIONS:          DD-06-01 THROUGH DD-06-07 — RESOLVED
IMPLEMENTATION:           NOT AUTHORIZED
```
