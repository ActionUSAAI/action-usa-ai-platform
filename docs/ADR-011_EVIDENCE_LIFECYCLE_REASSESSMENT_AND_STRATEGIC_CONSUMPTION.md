# ADR-011 — Detailed Normative Decision Record

## Evidence Lifecycle, Reassessment and Strategic Consumption

**Nature of this document:** this is the **Detailed Normative Decision Record of ADR-011** (`docs/AUCIS_ARCHITECTURE_DECISIONS.md`). It is part of ADR-011, not a separate ADR. It has no independent authority and no constitutional level of its own — its entire authority derives exclusively from the ADR-011 entry in `docs/AUCIS_ARCHITECTURE_DECISIONS.md`, the canonical ADR registry. This document exists solely to preserve, in full, the granularity of the 19 Decisions (D-001–D-019) and 18 Invariants (INV-EV-01–INV-EV-18) that the condensed registry entry does not repeat.

---

**Architecture:** AUSCIS
**Domain:** Case Evidence / Criterion Assessment / Case Strategy
**Decision Type:** Governing Cross-Component Architectural Decision
**Status:** APPROVED
**Effective:** Prospective
**Supersedes:** Any prior architectural rule that requires automatic staleness or reassessment of a Criterion Assessment solely because an Evidence Item is created, updated, supplemented, or reprocessed.
**Affected Components:** Case, Evidence Layer, A1, A2, A5, Case Blueprint, Workflow / Control Plane, A3/A4 downstream consumers.

---

# 1. PURPOSE

This ADR establishes the governing architecture for the creation, documentary maturation, human verification, reassessment, and strategic consumption of **Evidence Items** in AUSCIS.

Its purpose is to reconcile the previously documented Evidence architecture with the actual operational process and the existing AUSCIS implementation, while preserving:

* Human-in-the-Loop control;
* separation of agent responsibilities;
* historical traceability;
* versioned Criterion Assessments;
* versioned Case Blueprints;
* explicit rather than automatic strategic regeneration;
* factual integrity of Case Evidence.

This ADR governs all subsequent evolution of the Evidence Item Contract, Criterion Assessment Contract, Domain Interaction Architecture, Workflow State Machine Contract, Core Domain Model, Platform Architecture, and related documentation.

---

# 2. GOVERNING PRINCIPLE

AUSCIS SHALL distinguish between:

1. **the probative fact;**
2. **the documentary support for that fact;**
3. **the documentary processing of that support;**
4. **human verification of the Evidence Item;**
5. **criterion assessment by A1;**
6. **strategic use by A5;**
7. **execution of the approved strategy by downstream agents.**

These functions SHALL NOT be collapsed into a single Evidence lifecycle.

The governing separation is:

> **A2 processes documents.
> Authorized Action USA humans verify Evidence.
> A1 assesses criteria.
> A5 decides strategy.
> A3/A4 execute the approved Blueprint.**

---

# 3. DECISION D-001 — EVIDENCE ITEM SEMANTIC DEFINITION

An **Evidence Item** SHALL represent:

> **A controlled probative unit of the Case that combines a verifiable fact with the document or set of documents that support it, while maintaining the factual and documentary components conceptually distinguishable for traceability, processing, verification, and strategic use.**

An Evidence Item is therefore neither merely a file nor merely an unsupported factual assertion.

The two components are:

### Factual Component

The fact AUSCIS seeks to establish.

Example:

> The Beneficiary received Award X in 2024.

### Documentary Component

The document or set of documents supporting that fact.

Example:

* award certificate;
* official results;
* official publication.

One Evidence Item MAY therefore be supported by multiple documents.

**Document ≠ Evidence Item.**

Multiple documents supporting the same controlled probative fact do not necessarily constitute multiple Evidence Items.

---

# 4. DECISION D-002 — DOMAIN OWNERSHIP

An Evidence Item SHALL belong to the **Case**.

Intake SHALL NOT be treated as the exclusive owner of Evidence.

Intake is one legitimate source from which Evidence Items may originate.

Additional legitimate sources MAY include:

* applicant post-Intake submissions;
* staff-entered Case information;
* A0-extracted factual information subject to the applicable human controls;
* returned signed letters;
* externally obtained supporting documentation;
* other governed Case-document intake channels.

No AI agent SHALL autonomously invent or alter the factual content of an Evidence Item.

---

# 5. DECISION D-003 — EVIDENCE MAY ENTER THROUGHOUT THE CASE

Evidence acquisition SHALL NOT terminate when Intake is completed.

A Case MAY receive new Evidence:

* during Intake;
* after A1's initial Criterion Assessment;
* during evidence development;
* after A3-generated work products are returned by the applicant;
* before Blueprint regeneration;
* during preparation of the petition;
* whenever the governed Case process legitimately permits additional evidence.

Accordingly:

> **Intake completion does not freeze the Evidence Inventory.**

---

# 6. DECISION D-004 — DOCUMENTARY CONDITION

The previous linear Evidence lifecycle:

> `Reported → Documented → Verified → Used`

is deprecated.

Evidence documentary maturity SHALL instead be represented independently through **Documentary Condition**.

The governed conceptual states are **independent values, not a sequential lifecycle** — no value is architecturally required to follow another in a fixed order:

### `Reported`

A probative fact has been declared or identified, but sufficient documentary support has not yet been associated with it.

### `Partial`

One or more supporting documents exist, but a known documentary deficiency prevents the Evidence Item from being considered sufficiently documented.

Examples include:

* missing signature;
* missing page;
* incomplete supporting documentation;
* required translation not yet completed;
* unreadable or incomplete file;
* required documentary component still outstanding.

### `Documented`

The Evidence Item has the documentary support necessary to represent the probative unit as currently defined within the Case.

`Documented` SHALL NOT mean:

* legally sufficient;
* criterion satisfied;
* strategically selected;
* USCIS-acceptable;
* authentic as a matter of forensic determination;
* guaranteed to carry probative weight.

Documentary Condition concerns documentary completeness, not legal strategy. Transition rules between these values, if any, belong to the Workflow/Contracts governing Evidence — not to this ADR.

---

# 7. DECISION D-005 — A2 DOCUMENT PROCESSING AUTHORITY

A2 SHALL remain the **Document Processor**.

A2 MAY:

* identify documents;
* classify documents;
* detect language;
* translate when required;
* normalize documents under approved processing rules;
* detect objective documentary characteristics within its authorized capability;
* support or propose documentary-condition transitions based on objective processing results.

A2 SHALL NOT:

* determine whether an immigration criterion is satisfied;
* determine probative legal value;
* determine strategic usefulness;
* select Evidence for the petition;
* verify an Evidence Item on behalf of Action USA;
* alter the factual assertion represented by an Evidence Item.

A2 processes.

It does not legally assess and does not strategically decide.

---

# 8. DECISION D-006 — HUMAN VERIFICATION CONDITION

Human verification SHALL be represented independently from Documentary Condition.

The governed conceptual states are **independent values, not a sequential lifecycle**. In particular, `Needs Attention` is **not necessarily subsequent to** `Verified` — either may be reached directly from `Pending`, and transition rules, if any, belong to the Workflow/Contracts governing Evidence, not to this ADR:

### `Pending`

The Evidence Item has not yet completed authorized human review.

### `Verified`

An authorized Action USA human has reviewed the Evidence Item and its associated supporting documentation and confirmed that they reasonably correspond to the probative fact they purport to support, with sufficient consistency to continue use within the Case and without an apparent documentary issue requiring the process to stop.

### `Needs Attention`

An authorized human has reviewed the Evidence Item and identified an issue requiring correction, clarification, supplementation, or other action before verification.

A reason SHOULD accompany `Needs Attention`.

Examples include:

* inconsistent name;
* contradictory date;
* missing or questionable signature;
* materially incomplete document;
* illegibility;
* inconsistent content;
* required clarification.

Only an authorized human SHALL confer `Verified` status.

Neither A1, A2 nor A5 may do so.

---

# 9. DECISION D-007 — MEANING OF VERIFIED

`Verified` SHALL NOT mean that AUSCIS or Action USA certifies:

* that the underlying fact is objectively true beyond doubt;
* that the document is forensically authentic;
* that USCIS will accept the evidence;
* that a criterion has been satisfied;
* that the evidence has high probative value;
* that the evidence must be included in the petition.

`Verified` is a **human Case-review condition**, not a USCIS adjudicative conclusion.

---

# 10. DECISION D-008 — STRATEGIC USE IS NOT AN EVIDENCE STATE

`Used` SHALL NOT remain a lifecycle or verification state of Evidence Item.

Strategic use belongs to the relationship between a specific **Case Blueprint version** and a specific **Evidence Item/version**.

Therefore an Evidence Item MAY remain:

> `Documented + Verified`

while different Blueprint versions make different strategic decisions concerning it.

Example:

> Evidence Item EI-023
> Documentary Condition: Documented
> Verification Condition: Verified

while:

> Blueprint v1 → Not Selected
> Blueprint v2 → Selected
> Blueprint v3 → Not Selected

The Evidence Item itself has not changed merely because strategy changed.

---

# 11. DECISION D-009 — A1 REMAINS AN AUTHORIZED EVIDENCE CONSUMER

A1 SHALL remain an authorized consumer of Case Evidence.

A1 evaluates the applicable immigration criteria using the Case information and Evidence made available to it at the time of a particular Criterion Assessment execution.

A Criterion Assessment therefore represents a **versioned assessment snapshot**, not a permanently reactive view of the live Evidence Inventory.

The governing principle remains:

> **A1 measures. A5 decides.**

---

# 12. DECISION D-010 — NEW EVIDENCE DOES NOT AUTOMATICALLY REASSESS A1

Creation, upload, processing, supplementation, correction, or verification of an Evidence Item SHALL NOT automatically execute A1.

Accordingly:

> **New Evidence ≠ Automatic A1 Reassessment.**

New Evidence SHALL NOT, solely by its existence, require an automatic Criterion Assessment regeneration.

Within the Evidence-trigger scope governed by this ADR, A1 reassessment requires an **explicit authorized human action**.

The system MAY signal that Evidence has been added or materially changed since the current Criterion Assessment.

Such a signal is informational and SHALL NOT itself constitute reassessment.

---

# 13. DECISION D-011 — EXPLICIT CRITERION REASSESSMENT

When an applicant or Action USA materially supplements Evidence with the purpose of curing deficiencies, strengthening criteria, or otherwise obtaining a new eligibility assessment, an authorized human MAY initiate:

> **Reassess Criteria with A1**

A1 SHALL then evaluate the appropriate Case information and Evidence available for that execution and produce a **new complete Criterion Assessment version**.

Example:

> Initial Evidence
> → A1 v1
> → several criteria deficient

Applicant subsequently provides substantial supporting Evidence:

> New Evidence
> → A2 processing
> → Evidence Inventory updated
> → authorized human requests reassessment
> → A1 v2

A1 v2 SHALL NOT overwrite A1 v1.

Historical assessments SHALL remain reconstructable.

---

# 14. DECISION D-012 — TWO LEGITIMATE POST-INTAKE EVIDENCE PATHS

AUSCIS SHALL support two legitimate Evidence-processing paths.

## Path A — Evidence without Criterion Reassessment

```text
New Evidence
    ↓
A2 processing, where applicable
    ↓
Evidence Inventory
    ↓
Human verification, where applicable
    ↓
A1 remains unchanged
    ↓
A5 may consider the Evidence upon explicit Blueprint generation/regeneration
```

This path applies when new Evidence does not require a new eligibility measurement.

## Path B — Evidence with Criterion Reassessment

```text
New / strengthened Evidence
    ↓
A2 processing, where applicable
    ↓
Evidence Inventory
    ↓
Human verification, where applicable
    ↓
Explicit human "Reassess with A1"
    ↓
New Criterion Assessment version
    ↓
A5 may generate/regenerate Blueprint
```

This path applies when Evidence is intended to cure, strengthen, or materially change criterion evaluation.

Neither path SHALL be triggered automatically merely because a file was uploaded.

---

# 15. DECISION D-013 — NEW EVIDENCE DOES NOT AUTOMATICALLY INVALIDATE THE BLUEPRINT

New or updated Evidence SHALL NOT, solely by its existence, automatically make the current Case Blueprint invalid or stale.

The Workflow / Control Plane MAY indicate:

> **New Evidence Available Since Current Blueprint**

or an equivalent informational condition.

This signal SHALL NOT itself:

* invalidate the Blueprint;
* execute A1;
* execute A5;
* regenerate documents.

The authorized human decides whether the new Evidence warrants:

* no strategic action;
* A1 reassessment;
* Blueprint regeneration;
* both A1 reassessment and subsequent Blueprint regeneration.

Before building any new informational-signal mechanism for this purpose, AUSCIS SHALL evaluate reuse of already-implemented and validated vigency/versioning patterns — see D-018.

---

# 16. DECISION D-014 — A5 STRATEGIC CONSUMPTION

A5 is the exclusive strategic reasoning engine.

When explicitly invoked, A5 MAY consume:

* the applicable current Criterion Assessment;
* Case information;
* Evidence Items available under the governed Evidence rules;
* other authorized strategic inputs.

A5 MAY determine:

* which Evidence Items are strategically relevant;
* which criterion or narrative they support;
* whether they should be selected;
* their role in the Case strategy;
* evidence dependencies;
* foundational Evidence;
* Reasoning Provenance.

A5 SHALL NOT alter the factual content of Evidence Items or confer human verification status.

---

# 17. DECISION D-015 — BLUEPRINT VERSIONING PRESERVES STRATEGIC HISTORY

Every Blueprint regeneration SHALL continue to create a new Case Blueprint version under the approved versioning architecture.

A previous Blueprint SHALL NOT be silently overwritten because Evidence changed.

This permits AUSCIS to reconstruct:

* which Criterion Assessment governed a strategy;
* which Evidence existed;
* which Evidence A5 selected;
* which strategic decisions were made;
* how the Case strategy evolved over time.

---

# 18. DECISION D-016 — GENERATED WORK PRODUCT IS NOT EVIDENCE

An A3-generated letter draft is a **Generated Work Product**, not Case Evidence.

Internal Action USA approval of that draft authorizes its release to the applicant under the existing Human Approval Gate.

It SHALL NOT automatically create or verify Evidence.

If the applicant later returns a signed, modified, executed, or otherwise completed document, that returned document is a new Case document and SHALL enter the governed document/evidence process.

Where applicable:

```text
A3 Draft
    ↓
Human Approval
    ↓
Applicant
    ↓
Returned signed/modified document
    ↓
A2 processing
    ↓
Evidence association/formalization
    ↓
Human verification
```

The returned document MAY differ from the A3 draft.

Such difference SHALL NOT automatically invalidate it.

---

# 19. DECISION D-017 — EVIDENCE VERSIONING AND TRACEABILITY

Evidence SHALL preserve historical traceability.

A material factual correction or material change in supporting documentation SHALL NOT silently rewrite historical Evidence relied upon by prior assessments or Blueprints.

The implementation SHALL preserve sufficient identity/version provenance to reconstruct:

* the probative fact;
* the supporting document or documents;
* the documentary condition;
* the human verification condition;
* the Evidence version or documentary state available to A1;
* the Evidence referenced by each Blueprint version.

**Versioning implementation neutrality:** this Decision requires historical traceability as an outcome, not a specific physical mechanism. It does NOT determine that adding or updating supporting documentation for the same probative fact necessarily requires creating a new Evidence Item version. The exact physical persistence/vigency model SHALL be determined during implementation reconciliation and SHALL NOT be invented by this ADR — and that determination SHALL first evaluate reuse of already-implemented and validated versioning/vigency patterns, including the `status`/`currency_status` pattern, where semantically appropriate, before introducing a parallel mechanism (see D-018).

---

# 20. DECISION D-018 — NO PREMATURE DOCUMENT ENTITY DESIGN

This ADR SHALL NOT be interpreted as authorization to create a new generic `Document` entity or table.

Before defining physical persistence, AUSCIS SHALL inspect and reuse, where architecturally appropriate, existing Case-file, upload, Storage, A2, translation, and document abstractions.

A new generalized document entity SHALL be introduced only if a verified implementation gap requires it.

This reuse-first principle extends to any vigency/versioning or informational-signal mechanism contemplated by this ADR (D-013, D-017) — none of them SHALL be treated as requiring new parallel infrastructure without first evaluating already-implemented and validated patterns.

---

# 21. DECISION D-019 — HUMAN CONTROL

The following actions require explicit human authority:

* conferring `Verified`;
* resolving `Needs Attention`;
* when considered as a consequence of Evidence Item creation, update, supplementation, processing, or verification: requesting A1 reassessment, and approving/regenerating strategy according to the applicable Blueprint workflow;
* determining whether new Evidence requires further action where strategic judgment is involved.

Automation MAY assist, process, detect, signal, or recommend within authorized boundaries.

Automation SHALL NOT silently substitute itself for these human decisions.

ADR-011 does not redefine other authorized A1/A5 workflows or orchestrations outside its Evidence-trigger scope.

---

# 22. SUPERSEDED PRIOR SEMANTICS

**Scope of this supersession:** the "Superseded" semantics below apply exclusively to staleness, reassessment, or invalidation automatically triggered by **Evidence Item creation, update, supplementation, processing, or verification**. They do not affect staleness or invalidation rules whose trigger is architecturally distinct from Evidence — two such rules are explicitly evaluated and confirmed **Preserved**, not superseded, immediately below.

Upon implementation of the corresponding contract/document revisions, the following prior architectural semantics SHALL be considered superseded:

### Superseded

`Reported → Documented → Verified → Used` as one Evidence lifecycle.

### Superseded

Intake as exclusive Evidence owner.

### Superseded

A single `supporting_file_ref` as a conceptual limitation that implies one Evidence Item can only have one supporting document.

### Superseded

`EvidenceItemUpdated → Criterion Assessment stale` as an automatic general rule.

### Superseded

`Evidence change → A1 reassessment` as a required workflow.

### Superseded

`Evidence change → Blueprint stale` as an automatic general rule.

### Superseded

`Used` as an intrinsic Evidence Item state.

### Preserved

A1 remains an Evidence consumer.

### Preserved

A1 assessments remain versioned.

### Preserved

A5 remains the exclusive strategic reasoning engine.

### Preserved

A3/A4 execute approved strategy without reinterpreting it.

### Preserved

Human-in-the-Loop.

### Preserved

Evidence factual content cannot be autonomously invented or altered by AI agents.

### Preserved

Material Beneficiary/Petitioner change → potentially stale downstream Criterion Assessment/Case Blueprint. Distinct trigger (Beneficiary/Petitioner, not Evidence) — outside the scope of this ADR's Evidence-triggered supersession.

### Preserved

Case Blueprint Superseded → a Generated Document governed by that Blueprint may be flagged as based on outdated strategy. Distinct trigger (Blueprint status transition, not Evidence) — outside the scope of this ADR's Evidence-triggered supersession.

---

# 23. IMPLEMENTATION CONSTRAINT

This ADR authorizes **architectural reconciliation only**.

It SHALL NOT by itself authorize implementation changes.

Before code implementation:

1. affected frozen contracts SHALL be versioned according to governance;
2. related architecture documents SHALL be reconciled;
3. existing implementation SHALL be inspected for reusable capabilities;
4. actual gaps SHALL be distinguished from already working behavior;
5. implementation instructions SHALL be derived from the approved architecture rather than allowing Code to invent business logic.

---

# 24. REQUIRED DOCUMENT RECONCILIATION

This ADR SHALL govern the focused reconciliation of:

1. `AUCIS_EVIDENCE_ITEM_CONTRACT_V1` → **Evidence Item Contract v2**
2. `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE`
3. `AUCIS_WORKFLOW_STATE_MACHINE_CONTRACT_V1` → **Workflow Contract v2**
4. `AUCIS_CRITERION_ASSESSMENT_CONTRACT_V1` → versioned reconciliation as required
5. `AUCIS_CORE_DOMAIN_MODEL` — Evidence Item and affected relationships only. Already reconciled in a prior session (Evidence Item entry restated as factual+documentary unit, Case-owned, with independent Documentary/Human Verification conditions and no `Used` state); that reconciliation remains pending only the addition of a citation back to this ADR.
6. `AUCIS_PLATFORM_ARCHITECTURE` — Evidence/A2/A1/A5 interaction only
7. **Case Blueprint governance** — `governance/level-4-contracts/blueprint-contract.md` is the current governing Blueprint Contract (Level 4, Frozen, subject to the Architectural Constitution). `A5_CASE_BLUEPRINT_SPECIFICATION_V2.md` remains the delegated specification for the exact shape/structure of the A5 Blueprint output, as the Contract itself provides. Reconciliation under this ADR touches only compatibility/references where required — neither document is modified by this ADR. `A5_CASE_BLUEPRINT_SPECIFICATION_V2.md` separately retains a previously identified, still-pending focal reconciliation on the phrase describing `criterion_assessment_version_id` as the dependency that "enables the invalidation cascade" — that phrasing is NOT corrected by this operation.
8. `AUCIS_CONTRACT_CATALOG`
9. applicable implementation roadmap references.

No unrelated AUSCIS architectural area SHALL be reopened solely because of this ADR.

---

# 25. ARCHITECTURAL INVARIANTS

The following invariants are binding:

**INV-EV-01**
Document and Evidence Item are distinct concepts.

**INV-EV-02**
An Evidence Item may have one or multiple supporting documents.

**INV-EV-03**
Evidence belongs to the Case and may enter after Intake.

**INV-EV-04**
AI agents may not autonomously invent or alter Evidence factual content.

**INV-EV-05**
A2 processes documents but does not decide legal sufficiency or strategy.

**INV-EV-06**
Only an authorized human may confer Evidence `Verified` status.

**INV-EV-07**
Verification does not mean criterion satisfaction.

**INV-EV-08**
Strategic selection is Blueprint-specific and is not an Evidence lifecycle state.

**INV-EV-09**
A1 remains an authorized Evidence consumer.

**INV-EV-10**
New Evidence does not automatically execute A1.

**INV-EV-11**
Within the Evidence-trigger scope governed by this ADR, A1 reassessment requires explicit authorized human action and produces a new Criterion Assessment version.

**INV-EV-12**
New Evidence does not automatically execute A5.

**INV-EV-13**
New Evidence does not automatically invalidate a current Blueprint.

**INV-EV-14**
A5 exclusively determines strategic use of Evidence.

**INV-EV-15**
A3/A4 do not reinterpret Evidence strategy independently of the governing Blueprint.

**INV-EV-16**
A3 internal draft approval does not convert a Generated Work Product into Evidence.

**INV-EV-17**
Historical Evidence, Criterion Assessments, and Blueprint decisions must remain reconstructable.

**INV-EV-18**
No new persistence abstraction shall be created until existing implementation capabilities have been reconciled.

---

# 26. GOVERNING FLOW

The resulting governed architecture is:

```text
                    CASE
                      │
        ┌─────────────┴─────────────┐
        │                           │
 Initial / Intake Evidence     Post-Intake Evidence
        │                           │
        └─────────────┬─────────────┘
                      ↓
               Document Intake
                      ↓
                     A2
        Process / Classify / Translate
                      ↓
               EVIDENCE INVENTORY
                      ↓
             Human Evidence Review
                      │
          ┌───────────┴───────────┐
          │                       │
      Verified              Needs Attention
          │
          ↓
   Human process decision
          │
    ┌─────┴──────────────────┐
    │                        │
No A1 reassessment      Reassess with A1
    │                        │
    │                        ↓
    │               Criterion Assessment vN
    │                        │
    └────────────┬───────────┘
                 ↓
       Human invokes A5 when appropriate
                 ↓
          CASE BLUEPRINT vN
                 ↓
        Human Approval / Governance
                 ↓
              A3 / A4
```

No arrow in this flow SHALL be interpreted as authorization for automatic execution unless another approved contract expressly provides such automation.

---

# 27. FINAL DECISION

AUSCIS adopts a **Case-centered, versioned, human-governed Evidence architecture**.

Evidence accumulation, document processing, human verification, criterion assessment, and strategic selection are separate concerns.

The system SHALL permit Evidence to evolve throughout the Case without forcing unnecessary reassessment or regeneration.

At the same time, when new Evidence materially strengthens or cures deficient criteria, AUSCIS SHALL permit an authorized human to explicitly initiate a new A1 assessment, preserving both the previous and new Criterion Assessments and allowing A5 to build a new strategic version from the updated Case state.

This architecture preserves:

> **Evidence evolves.
> Evidence-triggered A1 reassessment occurs only upon explicit authorized human request.
> A5 decides strategy.
> Humans govern consequential transitions.
> History is never silently rewritten.**

**ARCHITECTURAL DECISION: APPROVED**
