# AUSCIS — EVIDENCE ITEM CONTRACT V2

**Artifact:** Evidence Item Contract
**Version:** V2
**Domain:** AUSCIS — Case Evidence
**Contract Type:** Domain / Operational Contract
**Status:** APPROVED — GOVERNING CONTRACT
**Predecessor:** Evidence Item Contract V1
**Governing Architectural Authority:** ADR-011 — Evidence Lifecycle, Reassessment and Strategic Consumption
**Design Basis:** Approved Decisions 1–9
**Contract First Development Trigger:** SATISFIED
**Runtime Implementation Authorization:** NOT GRANTED BY THIS CONTRACT

---

## 1. PURPOSE

This contract governs the semantic identity, ownership, creation, documentary support, human verification, evolution, traceability, consumption, and Case-lifecycle incorporation of an **Evidence Item** within AUSCIS.

Its purpose is to establish a single governed Evidence model capable of supporting:

* Evidence originating during Intake;
* Evidence entering after Intake;
* documentary processing through A2;
* Evidence development;
* returned A3-originated documents;
* human verification;
* A1 Criterion Assessment;
* A5 strategic consumption;
* Blueprint-version-specific Evidence selection;
* historical traceability;
* future implementation without silent architectural inference.

This contract defines **what AUSCIS Evidence means and how it is governed**.

It does not prescribe the physical persistence mechanism except where necessary to preserve contractual invariants.

---

## 2. GOVERNING PRINCIPLES

The following principles govern this contract:

> **Evidence belongs to the Case.**

> **Evidence Item ≠ Document.**

> **Document receipt ≠ Evidence creation.**

> **Document processing ≠ Evidence incorporation.**

> **Evidence incorporation ≠ Human Verification.**

> **Human Verification ≠ Criterion satisfaction.**

> **Criterion Assessment ≠ Strategic selection.**

> **Strategic selection ≠ Filing authorization.**

> **A2 processes.**

> **A1 assesses.**

> **A5 decides strategy.**

> **Authorized Action USA humans verify.**

> **Evidence evolves without silently rewriting historical reliance.**

---

## 3. EVIDENCE ITEM DEFINITION

An **Evidence Item** is:

> **A controlled probative unit of the Case that combines a sufficiently identifiable probative fact with the document or set of documents supporting that fact, while keeping the factual and documentary components conceptually distinguishable for traceability, processing, human review, expert assessment, and strategic use.**

An Evidence Item therefore contains conceptually:

### Probative Component

The fact being established, demonstrated, corroborated, or developed.

### Documentary Component

The document or set of documents supporting that fact.

The two components belong to the same controlled probative unit but are not semantically fused.

---

## 4. EVIDENCE ITEM IDENTITY

Evidence Item identity represents the conceptual continuity of the probative unit.

Example:

> `EI-041 — Beneficiary made a significant contribution to Expedia's platform architecture.`

The documentary support for EI-041 may evolve without requiring the Evidence Item itself to lose its conceptual identity.

Therefore:

> **Evidence Item Identity is distinct from Evidence Item Composition.**

---

## 5. EVIDENCE ITEM COMPOSITION

Evidence Item Composition consists conceptually of:

* the current probative fact;
* the supporting document or documents;
* material attributes necessary to interpret the probative unit.

Composition may evolve during the Case.

Changes to composition are governed by the Material Change and Historical Reliance provisions of this contract.

---

## 6. EVIDENCE ITEM CREATION

An Evidence Item may exist from the moment a **sufficiently identifiable probative fact** is legitimately declared, captured, or incorporated into the Case.

Supporting documentation is not required for initial existence.

Therefore an Evidence Item may initially exist as:

> **Documentary Condition: `Reported`**

> **Human Verification Condition: `Pending`**

Evidence Item creation does not itself establish documentary completeness, human verification, legal sufficiency, criterion satisfaction, strategic selection, or Filing authorization.

---

## 7. AUTHORIZED ORIGINATION

Evidence Items may originate through authorized Case workflows including:

* Applicant Intake;
* A0 CV extraction;
* Applicant Dashboard;
* Action USA staff;
* returned Case documents;
* other governed Case workflows.

The source must contain a sufficiently identifiable probative fact.

---

## 8. AUTOMATED CREATION BOUNDARY

Automation may formally create an Evidence Item only when:

1. an authorized source exists;
2. the probative fact is sufficiently identifiable;
3. incorporation requires no material inference;
4. provenance is preserved.

Automation must not:

* invent missing facts;
* complete substantive factual gaps;
* convert inference into fact;
* silently resolve material ambiguity.

When material inference, ambiguity, contradiction, or interpretation is required:

> **automation must produce a proposal for human resolution rather than silently create formal Evidence.**

This contract recognizes the conceptual distinction between:

**Formal Evidence Item**

and

**Evidence Candidate / Proposal.**

It does not require a separate physical Candidate entity.

---

## 9. CASE OWNERSHIP

Evidence belongs conceptually to the **Case**.

Intake is an authorized Evidence origination channel but is not the exclusive Evidence owner or lifetime Evidence repository.

Therefore:

> **Intake completion does not freeze the Evidence Inventory.**

Evidence may continue to enter, develop, change, or be supplemented throughout authorized Case workflows.

---

## 10. CASE SCOPE

Evidence is Case-scoped.

An Evidence Item belonging to one Case must not silently become Evidence in another Case.

Cross-Case Evidence reuse, if ever required, must be separately governed.

All Evidence operations remain subject to tenant isolation and applicable authorization boundaries.

---

## 11. POST-INTAKE EVIDENCE

Post-Intake Evidence Entry is a first-class Case capability.

New Evidence after Intake does not require:

* reopening Intake;
* mutating the completed Intake solely to store Evidence;
* creating a second Intake;
* creating a parallel Evidence repository.

Multiple entry channels must converge upon:

> **one governed Case Evidence capability.**

---

## 12. DOCUMENTARY ENTRY CHANNELS

Case documents potentially relevant to Evidence may enter through governed channels including:

### Intake

Documents submitted during initial structured Intake.

### Applicant Dashboard — Requested Submission

Documents submitted in response to a specific Action USA/AUSCIS request.

### Applicant Dashboard — Additional Submission

Documents submitted voluntarily by the Applicant without a pre-existing specific request.

### Action USA Staff

Documents legitimately received or identified by authorized staff.

### Returned Generated Work Product

Documents originating from an A3 work product and later returned signed, modified, completed, or otherwise transformed through the external process.

### Other Governed Case Workflows

Additional authorized workflows may originate Case documents subject to their applicable contracts.

This list does not establish a closed physical enum.

---

## 13. REQUESTED VS ADDITIONAL SUBMISSIONS

Requested and Additional describe the **submission context**.

They do not determine:

* probative value;
* documentary completeness;
* Human Verification;
* criterion satisfaction;
* strategic relevance;
* Filing inclusion.

A requested document may be insufficient.

An unsolicited document may be highly valuable.

---

## 14. DOCUMENT ENTRY VS EVIDENCE INCORPORATION

Document Entry and Evidence Incorporation are separate governed acts.

Conceptually:

> **Document Entry → Document Processing → Evidence Incorporation / Association where applicable**

Receipt of a document does not inherently:

* create an Evidence Item;
* associate the document with an Evidence Item;
* confer `Documented`;
* confer `Verified`;
* trigger A1;
* trigger A5;
* select the document for Filing.

---

## 15. A2 DOCUMENT PROCESSING AUTHORITY

A2 is the authorized Document Processor within its governing scope.

A2 may:

* identify documents;
* classify documents;
* detect language;
* translate where required;
* extract objective information;
* identify objective documentary characteristics;
* produce structured information;
* support deterministic matching;
* identify processing deficiencies within its authorized technical/documentary scope.

A2 does not:

* own Evidence;
* confer Human Verification;
* determine legal sufficiency;
* determine criterion satisfaction;
* determine strategic value;
* determine final petition inclusion.

> **A2 processes Documents.**

---

## 16. A2 PROCESSING OF POST-INTAKE DOCUMENTS

Every new Applicant-uploaded Case document entering through the governed post-Intake Evidence channel must pass through A2 Document Processing **where A2 processing is applicable under its governing scope**.

Any exception to an otherwise applicable A2 processing requirement must be expressly governed rather than inferred ad hoc.

Staff-incorporated documents intended for potential Evidence incorporation pass through A2 where A2 processing is applicable under its governing scope.

---

## 17. EVIDENCE INCORPORATION

Following document processing, a document may:

* associate with an existing Evidence Item;
* support creation of a new Evidence Item;
* produce an Evidence association/creation proposal;
* remain a Case Document without Evidence association;
* be identified through the applicable workflow as duplicative, irrelevant, administrative, or otherwise non-Evidence.

Therefore:

> **Every governed upload may enter the Case; not every governed upload enters the Evidence Inventory.**

---

## 18. DETERMINISTIC INCORPORATION

A governed system may create or associate Evidence automatically where:

* the probative fact is sufficiently identifiable;
* the Evidence Item or intended association can be determined objectively;
* no material inference is required;
* provenance is preserved;
* the action falls within contractually authorized rules.

Deterministic incorporation does not confer Human Verification.

---

## 19. AMBIGUOUS INCORPORATION

Where a document may reasonably correspond to multiple facts or Evidence Items, requires substantive interpretation, contains contradiction, or otherwise requires material inference:

> **the system must produce a proposal for human resolution rather than silently determine formal Evidence incorporation.**

An authorized Action USA human may:

* accept;
* reject;
* correct;
* associate;
* unlink;
* create Evidence;
* determine that the document does not constitute Evidence support.

---

## 20. CASE DOCUMENT VS SUPPORTING DOCUMENT

A **Case Document** is a document existing within an authorized Case workflow.

A **Supporting Document** is a Case Document associated with an Evidence Item because it materially:

* supports;
* establishes;
* corroborates;
* contextualizes;
* or completes

the probative fact represented by that Evidence Item.

Therefore:

> **Every Supporting Document is a Case Document, but not every Case Document is a Supporting Document.**

---

## 21. EVIDENCE ASSOCIATION

Evidence association represents a governed documentary relationship:

> **Document → supports → Evidence Item**

Mere storage within:

* a client folder;
* Case storage;
* Intake;
* A2 output;
* Generated Work Product storage

does not itself establish Evidence association.

---

## 22. MULTIPLE SUPPORTING DOCUMENTS

An Evidence Item may have:

* zero Supporting Documents;
* one Supporting Document;
* multiple Supporting Documents.

Multiple documents supporting the same probative fact do not inherently require creation of multiple Evidence Items.

The singular `supporting_file_ref` model of Evidence Contract V1 is superseded.

---

## 23. ONE DOCUMENT SUPPORTING MULTIPLE EVIDENCE ITEMS

One Case Document may support multiple Evidence Items where its content materially supports multiple distinct probative facts.

Therefore the conceptual relationship:

> **Evidence Item ↔ Supporting Document**

is potentially many-to-many.

This provision does not prescribe the physical persistence model.

---

## 24. SUPPORTING DOCUMENT ROLE

A Supporting Document association may carry a documentary or probative role when necessary for processing or traceability.

Possible conceptual roles include:

* primary support;
* corroborating support;
* contextual support;
* completion support.

This contract does not establish these examples as a mandatory physical enum.

An Evidence Item is not required to have exactly one Primary Supporting Document.

---

## 25. DOCUMENTARY CONDITION

Each Evidence Item maintains an independent:

> **Documentary Condition**

with permitted semantic values:

`Reported | Partial | Documented`

These are independent conditions, not an irreversible linear lifecycle.

---

## 26. REPORTED

`Reported` means:

> A sufficiently identifiable probative fact exists within the Case, but sufficient associated documentary support does not currently exist.

A Reported Evidence Item is legitimate Case Evidence.

It may identify Evidence that must still be obtained or developed.

`Reported` does not mean rejected or legally insufficient.

---

## 27. PARTIAL

`Partial` means:

> One or more supporting documents exist, but an identified objective documentary deficiency prevents the current Evidence Item composition from being considered completely documented.

Examples may include:

* missing signature;
* incomplete pages;
* required translation pending;
* illegibility;
* missing required documentary component;
* insufficient objective identification.

`Partial` represents documentary completeness only.

---

## 28. DOCUMENTED

`Documented` means:

> The associated documentary support completely represents the probative unit as currently defined and no known objective documentary deficiency prevents that unit from being treated as documentarily complete.

`Documented` does **not** mean:

* Human Verified;
* legally sufficient;
* criterion satisfied;
* strategically selected;
* Filing-ready;
* persuasive to USCIS;
* guaranteed acceptance.

---

## 29. DOCUMENTARY CONDITION AUTHORITY

A2 and governed automation may evaluate objective documentary characteristics relevant to Documentary Condition within their authorized processing boundaries.

Whether a particular automated determination directly establishes Documentary Condition or requires human confirmation is governed by the applicable authorized workflow or implementation contract.

Where that authority is not established, automation must not silently confer the condition.

An authorized Action USA human may confirm or correct Documentary Condition.

A2 must not determine legal or strategic sufficiency.

Documentary Condition reflects documentary completeness of the Evidence Item, **not document count**.

---

## 30. DOCUMENTARY CONDITION REVERSIBILITY

`Reported | Partial | Documented` are not irreversible stages.

Documentary Condition may change as documentary support evolves.

A previously `Documented` Evidence Item may become `Partial` if a later-discovered objective deficiency materially affects documentary completeness.

Changes must preserve historical traceability.

Automation must not silently rewrite historically relied-upon conditions or human determinations.

---

## 31. HUMAN VERIFICATION CONDITION

Each Evidence Item maintains an independent:

> **Human Verification Condition**

with permitted semantic values:

`Pending | Verified | Needs Attention`

These values are not a sequential lifecycle.

---

## 32. PENDING

`Pending` means:

> The current material composition of the Evidence Item does not presently have an applicable Human Verification determination.

This may occur because:

* the Evidence Item has never been reviewed;
* supporting documents changed materially;
* the probative fact changed materially;
* another Material Change makes prior verification no longer applicable to the current composition.

---

## 33. VERIFIED

`Verified` means:

> An authorized Action USA human has reviewed the applicable material composition of the Evidence Item and reasonably confirmed that the Evidence Item and associated documents correspond to the declared probative fact, present sufficient apparent integrity and consistency to continue use within the Case, and reveal no evident documentary deficiency at the time of review requiring its use to stop.

Minimum human review includes, where applicable:

1. correspondence;
2. apparent integrity;
3. consistency;
4. reasonable documentary support.

Verification is not forensic authentication.

`Verified` does **not** constitute a determination that the Evidence:

* satisfies an immigration criterion;
* guarantees probative value before USCIS;
* must be selected by A5;
* must be included in the petition;
* will be accepted by USCIS.

---

## 34. NEEDS ATTENTION

`Needs Attention` means:

> An authorized Action USA human has identified a material issue requiring action before normal continued use of the Evidence Item under its current condition.

Possible reasons include:

* inconsistent signature;
* incorrect identity;
* contradictory dates;
* materially altered content;
* illegibility;
* incorrect association;
* required client clarification;
* material signer changes;
* other review deficiencies.

`Needs Attention` does not inherently mean permanent rejection.

The reason must remain traceable.

---

## 35. HUMAN VERIFICATION AUTHORITY

Only an authorized Action USA human may confer:

* `Verified`;
* `Needs Attention`.

Automation may:

* detect;
* signal;
* recommend;
* request review.

Automation must not substitute itself for Human Verification.

Applicant submission authority does not confer Human Verification authority.

---

## 36. VERIFICATION COMPOSITION BINDING

Every Human Verification determination must be traceable to the material Evidence composition actually reviewed.

A subsequent Material Change:

* preserves the historical verification determination;
* does not delete or rewrite it;
* returns the current Human Verification Condition to `Pending` until a new authorized human review occurs.

This is not revocation of historical verification.

It recognizes that the current composition differs from the composition previously reviewed.

---

## 37. MATERIAL CHANGE

A **Material Change** is:

> **A change to an Evidence Item's probative fact, supporting documentary composition, or relevant attributes that could reasonably affect a prior human verification, expert assessment, or strategic decision that relied upon that Evidence Item.**

Material Change may include:

* substantive change to the probative fact;
* change to relevant person or organization identity;
* substantive date change;
* replacement of materially relied-upon documentary support;
* materially changed letter;
* material signer change;
* modification of probative content;
* removal of documentary support previously relied upon;
* material correction;
* new documentary support materially changing what the Evidence Item represents.

---

## 38. NON-MATERIAL CHANGE

A Non-Material Change does not materially alter the probative composition relied upon.

Examples may include:

* technical duplicate;
* filename change;
* technical metadata correction;
* identical copy;
* format conversion without substantive content change;
* storage movement;
* purely duplicative support.

Non-Material Changes do not by themselves require re-verification or create a new material Evidence composition.

---

## 39. HISTORICAL RELIANCE

**Historical Reliance** exists when a governed human determination or governed expert-process output materially relied upon a particular Evidence composition.

Examples include:

* Human Verification;
* A1 Criterion Assessment;
* A5 Case Blueprint;
* other governed downstream artifacts where separately authorized.

Where Historical Reliance exists:

> **the relied-upon Evidence composition must remain reconstructable.**

---

## 40. NO SILENT OVERWRITE

AUSCIS must not silently overwrite material Evidence information relied upon by a governed human determination or governed expert-process output.

Current Evidence may evolve.

Historical reliance must not be rewritten to make a prior determination appear to have relied upon later information.

---

## 41. MATERIAL CORRECTIONS

Errors may be corrected.

Where corrected information was previously relied upon:

> **the correction must preserve the prior relied-upon history while establishing the corrected current composition.**

The historical system must not falsely represent that corrected information always existed.

---

## 42. SUPPORTING DOCUMENT REPLACEMENT

New documentary support may replace prior support for current use.

Example:

`Unsigned Letter`

followed by:

`Signed Letter`.

The prior document must not be silently destroyed where Historical Reliance or audit relevance exists.

Documentary currentness may belong to the:

> **Document ↔ Evidence Item association**

rather than necessarily to the global lifecycle of the Document.

This contract does not establish a universal intrinsic `Document.superseded` state.

---

## 43. UNLINKING SUPPORTING DOCUMENTS

Authorized humans may correct an erroneous or obsolete Evidence association.

Where no Historical Reliance exists, the association may be corrected under the applicable workflow.

Where Historical Reliance exists:

> the historical composition that included the prior association must remain reconstructable.

---

## 44. DOCUMENT DUPLICATION

Technical duplication does not inherently create:

* a new Evidence Item;
* a new probative fact;
* Material Change.

The technical deduplication mechanism is outside this contract.

---

## 45. SOURCE DOCUMENT AND TRANSLATION

A translation or governed processed representation does not inherently constitute a separate probative fact or Evidence Item.

The relationship between:

> **Source Document**

and

> **Translated / Processed Representation**

must preserve documentary provenance.

A translated or processed representation must not silently replace the originating document.

---

## 46. A3 GENERATED WORK PRODUCT

An A3-generated draft is:

> **Generated Work Product**

and is not Evidence merely because A3 generated it.

Internal approval of an A3 work product authorizes the applicable external-use workflow.

It does not confer Human Verification or strategic Evidence selection.

---

## 47. RETURNED A3-ORIGINATED DOCUMENT

Where an A3-generated work product is sent externally and subsequently returned signed, modified, completed, or otherwise transformed:

> **the returned artifact enters AUSCIS as a new Case Document.**

It remains conceptually distinct from the originating A3 Generated Work Product.

Where known, provenance between the two must be preserved.

---

## 48. NO EXACT-MATCH REQUIREMENT

A returned A3-originated document is evaluated as actually returned.

It need not be textually identical to the originating draft.

External participants may:

* correct information;
* modify language;
* add information;
* remove content;
* add letterhead;
* sign electronically or physically.

Material differences are governed by Material Change, documentary processing, Evidence incorporation, and Human Verification rules.

---

## 49. RETURNED DOCUMENT FLOW

The governed conceptual flow is:

> **A3 Generated Work Product → Human Approval for External Use → External Return → New Case Document → A2 Processing where applicable → Evidence Incorporation / Association → Human Verification where applicable → Authorized Downstream Consumption**

A3 does not become Evidence owner.

---

## 50. EVIDENCE REQUESTS

A governed Case workflow may communicate documentary or evidentiary needs to the Applicant and correlate returned submissions with those needs.

A documentary request does not inherently create a new Evidence Item.

This contract does not establish a mandatory physical `Evidence Request` entity.

---

## 51. A1 EVIDENCE CONSUMPTION

A1 remains an authorized Evidence consumer for Criterion Assessment.

A1 may consume Evidence across Documentary and Human Verification Conditions where permitted by its governing contract.

A1 must preserve the actual Evidence conditions it consumes.

A1 must not represent:

`Pending`

or:

`Needs Attention`

as:

`Verified`.

---

## 52. EVIDENCE CONDITION ≠ A1 CONCLUSION

Evidence condition does not predetermine Criterion Assessment.

Therefore:

> `Documented + Verified` ≠ automatically `Criterion Met`.

And:

> `Reported + Pending` ≠ automatically `Criterion Not Met`.

A1 assesses criterion coverage, support, gaps, weaknesses, inconsistencies, and evidence-development needs according to its governing authority.

A1 cannot create, infer, or substitute Human Verification.

---

## 53. EVIDENCE-TRIGGERED A1 REASSESSMENT

Within the Evidence-trigger scope governed by ADR-011:

> **Evidence creation, update, supplementation, processing, documentary-condition change, or Human Verification does not automatically trigger A1 reassessment.**

Evidence-triggered reassessment requires:

> **explicit authorized human action.**

The exact UI or implementation mechanism is deferred.

Conceptually this may be represented as:

> `Reassess with A1`

without requiring that exact interface wording.

---

## 54. TWO LEGITIMATE EVIDENCE PATHS

### Path A — Evidence Development Without Reassessment

> New/Changed Evidence → A2 where applicable → Evidence Inventory → Human Verification where applicable → existing Criterion Assessment remains unchanged.

### Path B — Evidence Development With Authorized Reassessment

> New/Changed Evidence → A2 where applicable → Evidence Inventory → Human Verification where applicable → authorized human explicitly requests A1 reassessment → new complete Criterion Assessment version.

Both are legitimate.

New Evidence does not inherently require reassessment.

---

## 55. CRITERION ASSESSMENT VERSIONING

An authorized Evidence-triggered A1 reassessment creates a **new complete Criterion Assessment version** based on the relevant current Case and Evidence context.

Prior Criterion Assessments must not be:

* overwritten;
* deleted;
* silently rewritten.

Each Criterion Assessment represents a versioned analytical snapshot.

This contract does not prescribe the physical persistence mechanism.

---

## 56. EVIDENCE-TO-A1 TRACEABILITY

A Criterion Assessment must preserve sufficient traceability to determine the materially relevant Evidence basis consumed by that assessment.

This does not require physical duplication of Evidence files inside the Criterion Assessment.

Later Evidence changes must not silently rewrite the evidentiary basis of a historical Criterion Assessment.

---

## 57. A5 STRATEGIC AUTHORITY

A5 is the exclusive strategic Evidence consumer for Case Blueprint purposes.

A5 may:

* consider Evidence;
* relate Evidence to criteria;
* prioritize Evidence;
* identify Evidence dependencies;
* identify required additional Evidence;
* select Evidence within a Blueprint Version;
* determine strategic use subject to its governing contract.

> **A1 assesses. A5 decides strategy.**

---

## 58. A5 MAY CONSIDER NON-VERIFIED EVIDENCE

A5 may consider Evidence with:

* `Pending`;
* `Needs Attention`;

where permitted by its governing authority, provided the actual condition remains represented and any separately governed applicable restriction or required action is preserved.

A5 cannot convert Evidence into `Verified`.

---

## 59. STRATEGIC SELECTION

`Used` is not an Evidence Item lifecycle state.

Strategic Evidence selection belongs conceptually to:

> **Case Blueprint Version ↔ Evidence Item**

The same Evidence Item may be treated differently across Blueprint versions.

Example:

**Blueprint v1:** not selected.

**Blueprint v2:** selected.

**Blueprint v3:** not selected.

The Evidence Item itself did not thereby change lifecycle state.

---

## 60. STRATEGIC SELECTION ≠ FILING AUTHORIZATION

Blueprint strategic selection does not itself constitute Filing authorization.

Final Filing inclusion remains governed by applicable Filing contracts, gates, and workflows.

This contract does not redefine those authorities.

---

## 61. NEW EVIDENCE AND BLUEPRINT CURRENTNESS

New or changed Evidence does not automatically:

* invalidate the current Blueprint;
* make the Blueprint stale;
* regenerate the Blueprint;
* execute A5.

AUSCIS may identify or signal that new Evidence exists since the current Blueprint.

Such a signal does not itself constitute strategic invalidation or regeneration.

---

## 62. CRITERION ASSESSMENT SUPERSESSION

Nothing in this contract removes existing Blueprint currentness rules associated with formal Criterion Assessment supersession.

The critical distinction is:

> **Evidence changed ≠ Criterion Assessment superseded.**

If an authorized A1 reassessment creates a new Criterion Assessment version and the prior assessment becomes superseded, applicable Blueprint currentness rules may operate according to their governing contracts.

---

## 63. NO AUTOMATIC EVIDENCE ORCHESTRATION

The following events do not inherently trigger A1, A5, Blueprint regeneration, or Blueprint invalidation:

* Evidence Item Created;
* Evidence Item Updated;
* Supporting Document Added;
* Supporting Document Removed;
* A2 Processing Completed;
* Documentary Condition Changed;
* Human Verification Changed;
* Material Change Detected.

Future automation requires separately approved authority.

This provision does not redefine legitimate A1/A5 workflows outside the Evidence-trigger scope governed by ADR-011.

---

## 64. EVIDENCE ENTRY THROUGHOUT CASE LIFECYCLE

Evidence may continue entering throughout Case stages where the applicable workflow permits Evidence incorporation.

This contract does not prematurely define specialized rules for:

* post-Filing Evidence;
* RFE;
* NOID;
* appeals;
* consular follow-up;
* closed Cases.

Those workflows may establish additional gates or restrictions.

---

## 65. PROVENANCE

Each material Evidence component must preserve sufficient provenance to reconstruct its legitimate origin where applicable.

Possible origins include:

* Applicant Intake;
* A0 CV extraction;
* Applicant Dashboard;
* Action USA staff;
* returned A3-originated document;
* external Applicant document;
* another governed Case workflow.

This list is not a mandatory closed physical enum.

---

## 66. PROVENANCE ≠ AUTHORITY

Provenance does not itself confer:

* Human Verification;
* authenticity;
* legal sufficiency;
* criterion satisfaction;
* strategic selection;
* Filing inclusion.

---

## 67. HISTORICAL CONSUMPTION TRACEABILITY

AUSCIS must preserve sufficient traceability to reconstruct, where materially relevant:

* the Evidence composition reviewed by a human;
* the Evidence composition consumed by an A1 Criterion Assessment;
* the Evidence considered/selected under a Blueprint Version;
* other historical reliance expressly governed by downstream contracts.

The physical implementation may use references, revisions, snapshots, relations, or another approved mechanism.

This contract does not choose that mechanism.

---

## 68. HUMAN CONTROL

Authorized Action USA humans retain authority, within their applicable roles and workflows, for consequential Evidence decisions including:

* creating Evidence where human judgment is required;
* resolving ambiguous Evidence proposals;
* correcting Evidence;
* linking/unlinking documentary support;
* conferring `Verified`;
* conferring or resolving `Needs Attention`;
* requesting Evidence-triggered A1 reassessment;
* initiating or approving strategic regeneration where governed by the applicable Blueprint workflow;
* determining whether new Evidence requires further action where strategic judgment is involved.

Automation may assist, process, detect, signal, structure, or recommend within approved boundaries.

It must not silently substitute itself for these human decisions.

---

## 69. APPLICANT AUTHORITY

Applicants may:

* declare facts;
* upload documents;
* respond to requests;
* provide additional documents;
* correct information through authorized workflows.

Applicant action does not confer:

* Human Verification;
* Criterion Assessment;
* strategic selection;
* Filing authorization.

---

## 70. PHYSICAL IMPLEMENTATION BOUNDARY

This contract does **not** itself authorize or prescribe:

* a generic `Document` table;
* an `evidence_items` table;
* an Evidence-document association table;
* an Evidence Candidate table;
* an Evidence Request table;
* Evidence revision tables;
* snapshot tables;
* event sourcing;
* hashes/checksums;
* DB triggers;
* Supabase schema;
* storage buckets;
* API endpoints;
* UI components;
* background jobs;
* event bus;
* migrations.

These mechanisms must be determined through **Implementation Reconciliation** against the existing tested AUSCIS runtime.

---

## 71. EXISTING IMPLEMENTATION REUSE

Before implementing this contract, AUSCIS must inspect and reconcile existing working abstractions including, where applicable:

* Intake document uploads;
* A2 document processing;
* document translations;
* Generated Work Products;
* storage metadata;
* Criterion Assessment versioning/currentness;
* Blueprint versioning/currentness;
* Human Approval Gates;
* other proven Case-document mechanisms.

> **Existing working capability must be preserved or reused where semantically compatible.**

A new physical abstraction is justified only where a verified implementation GAP requires it.

---

## 72. CONTRACT FIRST IMPLEMENTATION

Evidence runtime implementation must follow:

> **Approved Architecture → Approved Evidence Item Contract V2 → Implementation Reconciliation → Approved Change Set → Implementation → Testing → Production Verification**

Code or implementation agents must not invent unresolved Evidence business logic.

---

## 73. CORE CONTRACT INVARIANTS

### Identity and Ownership

**EV-01** — Evidence belongs to the Case.

**EV-02** — Intake is an Evidence origination channel, not the exclusive Evidence owner.

**EV-03** — Evidence Item and Document are conceptually distinct.

**EV-04** — Evidence Item identity is distinct from its material composition.

### Creation and Incorporation

**EV-05** — A sufficiently identifiable probative fact may exist as Evidence before supporting documentation exists.

**EV-06** — Document receipt does not inherently create Evidence.

**EV-07** — Document Entry and Evidence Incorporation are distinct governed acts.

**EV-08** — Automation may formally create or associate Evidence only without material inference and within authorized rules.

**EV-09** — Material ambiguity requires human resolution.

### Documentary Support

**EV-10** — An Evidence Item may have zero, one, or multiple Supporting Documents.

**EV-11** — One Document may support multiple Evidence Items where it materially supports multiple probative facts.

**EV-12** — Evidence association must represent meaningful documentary support.

**EV-13** — Evidence association does not confer Human Verification, legal sufficiency, criterion satisfaction, strategic selection, or Filing authorization.

**EV-14** — Documentary Condition represents documentary completeness, not document count.

### Documentary Condition

**EV-15** — Documentary Condition permits `Reported | Partial | Documented`.

**EV-16** — Documentary Condition values are not an irreversible sequence.

**EV-17** — Documentary Condition may change as support evolves while preserving historical traceability.

### Human Verification

**EV-18** — Human Verification Condition permits `Pending | Verified | Needs Attention`.

**EV-19** — Only authorized Action USA humans may confer `Verified` or `Needs Attention`.

**EV-20** — Human Verification is traceable to the material Evidence composition reviewed.

**EV-21** — Material Change after verification preserves historical verification but returns the current condition to `Pending`.

**EV-22** — Non-Material Change does not by itself require new Human Verification.

### Traceability

**EV-23** — Material Evidence changes preserve historical traceability.

**EV-24** — Historical Reliance requires the relied-upon Evidence composition to remain reconstructable.

**EV-25** — Material corrections must not silently rewrite relied-upon history.

**EV-26** — Provenance of material Evidence components must remain reconstructable.

**EV-27** — Provenance does not confer evidentiary or legal authority.

### Documents

**EV-28** — Translated and processed representations preserve source-document provenance.

**EV-29** — Technical duplicates do not inherently create new Evidence or Material Change.

**EV-30** — Documentary replacement must not silently destroy Historical Reliance.

**EV-31** — Documentary currentness may be relationship-specific and must not be prematurely assumed to be a universal intrinsic Document lifecycle.

### A3

**EV-32** — A3 Generated Work Product is not automatically Evidence.

**EV-33** — A returned signed/modified A3-originated artifact enters as a distinct Case Document.

**EV-34** — Exact textual identity between A3 draft and returned document is not required.

### A2

**EV-35** — A2 processes Documents but does not own Evidence.

**EV-36** — A2 does not confer Human Verification, criterion satisfaction, strategic selection, or Filing authority.

### A1

**EV-37** — A1 remains an authorized Evidence consumer.

**EV-38** — Evidence conditions do not predetermine A1 criterion conclusions.

**EV-39** — Evidence-triggered A1 reassessment requires explicit authorized human action.

**EV-40** — A1 reassessment creates a new complete Criterion Assessment version and does not overwrite prior versions.

**EV-41** — Historical A1 Evidence reliance must not be silently rewritten by later Evidence changes.

### A5 / Blueprint

**EV-42** — A5 remains the exclusive strategic Evidence consumer for Blueprint purposes.

**EV-43** — Strategic Evidence selection belongs to the Blueprint Version rather than to the Evidence Item lifecycle.

**EV-44** — `Used` is not an Evidence Item lifecycle state.

**EV-45** — New or changed Evidence does not automatically execute A5, regenerate Blueprint, or invalidate Blueprint.

**EV-46** — Formal Criterion Assessment supersession remains distinct from Evidence change and may invoke applicable Blueprint currentness rules.

### Post-Intake

**EV-47** — Intake completion does not freeze Evidence Inventory.

**EV-48** — Post-Intake Evidence does not require reopening completed Intake.

**EV-49** — Requested and unsolicited Applicant submissions are legitimate governed Case-document entry modes.

**EV-50** — Submission context does not determine probative value.

**EV-51** — Multiple Evidence entry channels converge on one governed Case Evidence capability.

**EV-52** — Evidence remains Case-scoped and tenant-isolated unless an explicit cross-Case mechanism is separately approved.

### Automation and Implementation

**EV-53** — Evidence events do not inherently trigger A1/A5 orchestration.

**EV-54** — Automation must not silently substitute itself for consequential human Evidence decisions.

**EV-55** — Physical persistence and versioning mechanisms require implementation reconciliation.

**EV-56** — This contract does not authorize creation of a generic physical Document entity merely because the conceptual Document distinction exists.

**EV-57** — Existing working AUSCIS capabilities must be reconciled and reused where semantically compatible before introducing replacement infrastructure.

---

## 74. SUPERSEDED V1 SEMANTICS

Upon final approval and materialization of V2, the following Evidence Item Contract V1 semantics are superseded where inconsistent with this contract:

1. linear lifecycle:

> `Reported → Documented → Verified → Used`

2. `Used` as intrinsic Evidence state;

3. Intake as exclusive Evidence owner/lifetime source;

4. singular supporting-document limitation;

5. Evidence update as an automatic generalized Criterion Assessment staleness trigger;

6. Evidence change as requiring automatic A1 reassessment;

7. Evidence change as an automatic generalized Blueprint invalidation/staleness trigger;

8. any implication that A2 confers legal or Human Verification authority;

9. any implication that strategic Evidence selection is intrinsic to the Evidence Item.

Compatible V1 semantics remain preserved unless expressly superseded by V2 or higher governing authority.

---

## 75. CROSS-ARCHITECTURE BOUNDARY

This contract governs **AUSCIS Case Evidence**.

It does not redefine AEPE or AKAE.

Specifically:

> **Case Evidence ≠ Governed Knowledge.**

Patterns discovered during Evidence V2 design that may be reusable beyond immigration remain:

> **CANDIDATE AEPE — NOT PROMOTED**

Any future promotion requires separately governed AEPE/cross-architecture review.

---

## 76. CANDIDATE AEPE REGISTER

The following patterns were identified during Evidence V2 design:

* **CA-AEPE-01 — Versioned Expert Assessment**
* **CA-AEPE-02 — Governed Reassessment Trigger**
* **CA-AEPE-03 — Input-to-Output Traceability**
* **CA-AEPE-04 — Version-Specific Selection / Consumption**
* **CA-AEPE-05 — Governed Decision Authority**
* **CA-AEPE-06 — Versioned Input Composition**
* **CA-AEPE-07 — Historical Reliance Traceability**
* **CA-AEPE-08 — Material vs Non-Material Change**
* **CA-AEPE-09 — Provenance Preservation**
* **CA-AEPE-10 — Source Artifact ↔ Expert Input Association**
* **CA-AEPE-11 — Relationship-Specific Currentness**
* **CA-AEPE-12 — Derived Artifact Provenance**
* **CA-AEPE-13 — Deterministic Association vs Human Resolution**
* **CA-AEPE-14 — Lifecycle-Continuous Expert Inputs**
* **CA-AEPE-15 — Multi-Channel Governed Input**
* **CA-AEPE-16 — Submission vs Incorporation Separation**
* **CA-AEPE-17 — Requested vs Unsolicited Input**

Status of all:

> **CANDIDATE AEPE — NOT PROMOTED**

This register is informational for future AEPE reconciliation and confers no AEPE authority.

---

## 77. IMPLEMENTATION AUTHORIZATION

**Final approval and governed materialization of this contract authorize progression to Implementation Reconciliation and subsequent implementation design.**

Neither Draft completion nor MR PASS alone constitutes implementation authorization.

Final approval does not, by itself, authorize:

* database changes;
* migrations;
* runtime code;
* API changes;
* UI changes;
* deployment;
* production modification.

Those require the subsequent governed implementation process.

Therefore:

> **DRAFT COMPLETE ≠ MR PASS ≠ FINAL APPROVAL ≠ IMPLEMENTATION RECONCILIATION ≠ APPROVED CHANGE SET ≠ IMPLEMENTATION AUTHORIZATION**

---

## 78. FINAL CONTRACT PRINCIPLE

> **Evidence in AUSCIS is a Case-owned, controlled probative unit whose factual identity and documentary support remain conceptually distinguishable. Evidence may originate and evolve throughout authorized Case workflows, including after Intake. Documents enter through governed channels, are processed by A2 where applicable, and become Evidence support only through authorized incorporation. Human Verification remains exclusively human; A1 assesses Evidence without silently changing its condition; A5 exclusively determines strategic use through Blueprint-version-specific selection. Material Evidence evolution preserves provenance and Historical Reliance and never silently rewrites prior human, analytical, or strategic decisions. New Evidence does not automatically execute A1, A5, or invalidate Blueprint. Physical implementation must reuse proven AUSCIS capabilities where compatible and may be introduced only after implementation reconciliation.**

---

# MATERIALIZED CONTRACT GOVERNANCE RECORD

```text
ARTIFACT:
AUSCIS — EVIDENCE ITEM CONTRACT V2

VERSION:
V2

STATUS:
APPROVED — GOVERNING CONTRACT

ADR-011:
INCORPORATED / PRESERVED

DECISIONS 1–9:
INCORPORATED / APPROVED

GAP-TO-CONTRACT
CLOSURE REVIEW:
PASS

FINAL MR:
CLOSED

MR-01:
SATISFIED / CLOSED

MR-02:
SATISFIED / CLOSED

MR-03:
SATISFIED / CLOSED

MR-04:
SATISFIED / CLOSED

PMV:
PASS

ALEXANDER FINAL APPROVAL:
APPROVED

EV-01–EV-57:
APPROVED

CA-AEPE-01–17:
CANDIDATE AEPE — NOT PROMOTED

CONTRACT FIRST DEVELOPMENT
TRIGGER:
SATISFIED

RUNTIME IMPLEMENTATION:
NOT AUTHORIZED

IMPLEMENTATION RECONCILIATION:
NEXT GOVERNED PHASE AFTER
MATERIALIZATION / VERSIONING
```
