PROJECT-DIRECTION-001
AKAE / AEPE / AUSCIS — MINIMUM NECESSARY ARCHITECTURE & PROPORTIONAL GOVERNANCE
Artifact ID: PROJECT-DIRECTION-001
Artifact Type: Project Direction & Working Methodology
Project: AKAE / AEPE / AUSCIS Integrated Architecture
Project Director: Alexander Clavijo
Revision: 001
Status: PROPOSED FOR APPROVAL
Date: 2026-09-08
Architectural Authority Created: NO
Architectural State Modified: NO
Implementation Authorization: NO
1. PURPOSE
This document establishes the working direction and methodological discipline for the continued design, integration, and implementation of the AKAE / AEPE / AUSCIS ecosystem.
Its purpose is to prevent two opposite failures:

1. architectural invention without sufficient grounding, and
2. architectural paralysis caused by indefinite investigation of questions that were never previously designed.

The project remains governed by rigorous Source First principles when determining what architecture already exists.
However, when an integration capability is demonstrably necessary and existing architecture does not establish the required solution, the project SHALL NOT presume that further historical investigation will necessarily produce that solution.
Instead, the project may transition explicitly from:
DISCOVERY
to:
MINIMUM PROSPECTIVE DESIGN
subject to the controls established by this document.
2. PROJECT REALITY
AKAE, AEPE, and AUSCIS were not originally designed as one fully integrated architecture.
They emerged through progressive architectural development.
The historical AKAE checkpoint records the conceptual evolution from an AUSCIS requirement for reliable legal knowledge, through ALKA, toward the generalized AKAE architecture and subsequent domain specialization.
The resulting architecture established a fundamental separation between:
AKAE — universal knowledge acquisition;
ALKA / AILA — domain specialization;
AUSCIS — consumer / expert system.
AKAE Core was expressly intended to remain domain-independent.
AEPE was developed later as part of the continuing architectural generalization and integration work.
Accordingly, historical artifacts SHALL NOT be presumed to contain complete solutions for architectural relations, runtime contracts, interfaces, semantic objects, or integration requirements that did not exist or had not yet been designed when those artifacts were produced.
3. SOURCE FIRST REMAINS IN FORCE
This project direction does not weaken Source First.
Source First remains mandatory when determining:

* what an existing artifact establishes;
* existing architectural authority;
* lifecycle state;
* repository incorporation;
* dependencies;
* provenance;
* historical decisions;
* existing semantics;
* existing implementation;
* and existing architectural boundaries.

No missing architectural rule may be reconstructed from similarity, convenience, analogy, presumed intent, historical memory, or desired implementation behavior.
Therefore:

```

```


```
NOT ESTABLISHED
≠
IMPLICITLY ESTABLISHED

NOT ESTABLISHED
≠
INFERABLE BY CONVENIENCE

NOT ESTABLISHED
≠
PERMISSION TO INVENT HISTORICAL AUTHORITY
```

4. DISCOVERY AND DESIGN ARE DIFFERENT OPERATIONS
The project SHALL explicitly distinguish:
4.1 Architectural Discovery
Discovery asks:
What has already been established?
Valid results may include:

```

```


```
ESTABLISHED
NOT ESTABLISHED
CONTRADICTED
INDETERMINATE
```

A legitimate `NOT ESTABLISHED` or `INDETERMINATE` result SHALL be preserved as such.
4.2 Prospective Architectural Design
Prospective design asks:
Given the established architecture and a demonstrated current requirement, what is the minimum new architecture necessary for the integrated system to function correctly?
Prospective design SHALL NOT represent its output as historically established architecture.
It creates a proposal for new architecture, subject to the applicable architectural authority and approval process.
Therefore:

```

```


```
NOT ESTABLISHED
≠
PERMANENT PROHIBITION AGAINST NEW DESIGN
```

and:

```

```


```
PROSPECTIVE DESIGN
≠
RETROACTIVE DISCOVERY
```

5. STOP RULE FOR ARCHITECTURAL DISCOVERY
Architectural discovery SHALL NOT continue merely because the current result is `NOT ESTABLISHED`.
Where an investigation reaches:

```

```


```
CURRENT ANSWER:
NOT ESTABLISHED / INDETERMINATE

CAUSE OF INDETERMINACY:
NOT ESTABLISHED

ADDITIONAL PROVEN BLOCKER:
NO

NEXT REQUIRED DISCOVERY OPERATION:
NOT ESTABLISHED
```

the project SHALL NOT manufacture another discovery operation solely to continue decomposition.
At that point, the discovery branch may close.
This does not resolve the underlying architectural question.
It establishes only that further discovery is not presently justified by an established basis.
6. NECESSITY CHECK
After a missing architectural capability has been identified, the project SHALL ask:
Is this capability necessary for the current design, integration, or executable path?
If:

```

```


```
NECESSARY NOW:
NO
```

the issue SHOULD be deferred.
If:

```

```


```
NECESSARY NOW:
YES
```

the project may proceed to the Minimum Locus Check.
Necessity should preferably be demonstrated by one or more of:

*  concrete runtime evidence; 
*  an executable-path requirement; 
*  an architectural dependency; 
*  a required interface; 
*  a required semantic contract; 
*  or another concrete integration requirement. 

The project SHOULD prefer demonstrated requirements over speculative future completeness.
7. MINIMUM LOCUS CHECK
Before formulating a prospective architectural rule, the project SHALL perform a lightweight Minimum Locus Check.
Its purpose is to prevent a legitimate effort to simplify governance from accidentally assigning architectural authority to the wrong layer.
The check SHALL answer:

```

```


```
MISSING CAPABILITY:
<required capability>

NECESSARY NOW:
YES / NO

PROPOSED LOCUS:
AKAE
AEPE
AUSCIS
CROSS-ARCHITECTURE
OTHER / NOT YET DETERMINABLE

BASIS:
<brief architectural reason>

KNOWN CONFLICT WITH EXISTING AUTHORITY:
YES / NO / NOT ESTABLISHED
```

The Minimum Locus Check is intentionally lightweight.
It does not automatically require a separate Decision Locus Determination session.
It does not require finding a historical artifact expressly assigning a newly created responsibility to that locus.
Its question is prospective:
Considering the established boundaries of the system, which architecture is the appropriate owner of the new responsibility?
8. LOCUS ESCALATION RULE
The Minimum Locus Check SHALL NOT be treated as sufficient when it reveals a material authority conflict or a genuinely consequential ambiguity.
A fuller authority/locus determination is warranted only when necessary, including where:

* two or more architectures have competing established authority;
* the proposed rule would modify an existing authority boundary;
* the proposal would modify internal semantics of another architecture;
* the proposal would affect Frozen or otherwise protected architecture;
* the proposal would transfer authority between architectures;
* or the locus cannot be selected without materially changing an established architectural boundary.

Therefore:

```

```


```
MINIMUM LOCUS CHECK
        ↓
CLEAR / NON-CONFLICTING
        ↓
CONTINUE

MINIMUM LOCUS CHECK
        ↓
MATERIAL AUTHORITY CONFLICT
        ↓
ESCALATE ONLY AS NECESSARY
```

The project SHALL NOT escalate merely because theoretical alternatives can be imagined.
9. MINIMUM NECESSARY ARCHITECTURE PRINCIPLE
When:

1.  a capability is necessary now; 
2.  existing architecture does not already provide the required solution; 
3.  a suitable locus has been identified; 
4.  no material conflict prevents prospective design; 

the project SHOULD formulate the minimum prospective architectural addition necessary to satisfy the demonstrated requirement.
The proposal SHALL be constrained by four principles:
9.1 Necessity
Do not design functionality that is not required for the current problem.
9.2 Minimality
Do not solve adjacent or hypothetical future problems unless they are necessary consequences of the current solution.
9.3 Non-Conflict
Do not silently modify, override, reinterpret, or supersede established architecture.
9.4 Correct Locus
Do not place architecture in MASTER merely because multiple architectures exist in the ecosystem.
The responsibility belongs at the lowest correct architectural locus capable of owning it without violating established boundaries.
10. ARCHITECTURAL LOCUS MODEL
The default structural distinction is:

```

```


```
INTERNAL AKAE RESPONSIBILITY
        ↓
AKAE

INTERNAL AEPE RESPONSIBILITY
        ↓
AEPE

DOMAIN / AUSCIS RESPONSIBILITY
        ↓
AUSCIS

GENUINE CROSS-ARCHITECTURE CONTRACT
        ↓
MASTER / APPLICABLE
CROSS-ARCHITECTURE GOVERNANCE
```

This is a classification guide, not an automatic authority determination.
MASTER SHALL NOT be used as a universal destination for unresolved semantics.
Likewise, internal architectures SHALL NOT absorb responsibilities merely to avoid cross-architecture governance.
11. PROPORTIONAL GOVERNANCE PRINCIPLE
Governance effort SHOULD be proportional to the architectural consequence of the proposed change.
A narrow semantic required to unblock one bounded interaction should not automatically produce a large hierarchy of governance artifacts.
Conversely, a decision that changes:

* architectural authority;
* cross-architecture responsibility;
* lifecycle semantics;
* protected architecture;
* foundational boundaries;
* or system-wide invariants

may require stronger governance.
Therefore:
Use the minimum governance sufficient to preserve architectural integrity, authority, traceability, and auditability.
Governance SHALL protect the architecture.
It SHALL NOT become an objective independent of building the system.
12. IMPLEMENTATION FEEDBACK PRINCIPLE
Whenever possible, architectural work SHOULD return to implementation and runtime observation as soon as the minimum required architecture has been validly established.
The preferred cycle is:

```

```


```
RUNTIME / DESIGN NEED
        ↓
NECESSITY CHECK
        ↓
SOURCE CHECK
        ↓
MINIMUM LOCUS CHECK
        ↓
MINIMUM PROSPECTIVE DESIGN
        ↓
NON-CONFLICT REVIEW
        ↓
APPLICABLE APPROVAL
        ↓
IMPLEMENT
        ↓
EXECUTE
        ↓
OBSERVE
        ↓
NEXT REAL REQUIREMENT
```

The objective is to allow real execution evidence to identify the next required architectural problem rather than attempting to anticipate every possible future requirement analytically.
13. IMPLEMENTATION DOES NOT CREATE ARCHITECTURE
The use of runtime evidence does not authorize implementation to invent missing architectural semantics.
Where execution encounters a missing architectural decision that cannot be resolved locally without invention:

```

```


```
IMPLEMENTATION:
STOP AT THAT BOUNDARY
```

The missing requirement may then re-enter the appropriate design process.
Therefore:

```

```


```
RUNTIME EVIDENCE
→ MAY REVEAL ARCHITECTURAL NEED

RUNTIME EVIDENCE
≠
ARCHITECTURAL AUTHORITY

IMPLEMENTATION CONVENIENCE
≠
SEMANTIC AUTHORITY
```

The previously established architecture re-entry discipline remains applicable where relevant.
14. DOCUMENT PROLIFERATION CONTROL
A new architectural question does not automatically require a new persistent artifact.
Before creating a document, the project SHOULD ask:
Does this decision require persistent identity, lifecycle, independent approval, reuse, auditability, or future reference?
If not, the decision may be incorporated into the appropriate existing artifact or governed work product.
The project SHALL prefer:

```

```


```
MINIMUM NECESSARY DOCUMENTATION
```

over:

```

```


```
ONE NEW DOCUMENT
FOR EVERY QUESTION
```

provided traceability and architectural integrity remain sufficient.
15. HISTORICAL RECONCILIATION
Historical inconsistencies SHOULD be investigated when they materially affect a current architectural decision.
They SHALL NOT automatically block current design merely because they exist.
Accordingly:

```

```


```
HISTORICAL DISCREPANCY
≠
CURRENT BLOCKER
```

A historical discrepancy becomes materially relevant when current work depends upon determining the exact authority, content, identity, lifecycle, or meaning affected by that discrepancy.
Otherwise it may be:

```

```


```
RECORDED
+
DEFERRED
```

without being silently resolved.
16. AKAE-PIPELINE-001 CURRENT DOCUMENTARY ISSUE
Current investigation identified two documentary representations claiming:

```

```


```
AKAE-PIPELINE-001
REVISION 001
```

with materially different content and declared status.
The discrepancy remains unresolved as a documentary/governance matter.
No historical canonical identity is established by this document.
However, the AKAE project checkpoint records the intended consolidated pipeline as:

```

```


```
DESIGNATED AUTHORITATIVE SOURCE
        ↓
MAPPING
        ↓
KNOWLEDGE ACQUISITION
        ↓
KNOWLEDGE VERIFICATION
        ↓
VALIDATED KNOWLEDGE
        ↓
CONSUMER REASONING STAGE
        ↓
APPLICATION
```

and records Domain Independence, Source-Supported Knowledge Acquisition, and mandatory Knowledge Verification as the principal corrections to the pipeline. 
The developed pipeline PDF independently contains that seven-part transformation structure and expressly describes itself as domain-independent.  
This evidence may guide current prospective design where relevant.
It SHALL NOT be used to silently resolve the historical identity/status collision.
The historical discrepancy is therefore:

```

```


```
RECORDED:
YES

HISTORICALLY RECONCILED:
NO

AUTOMATIC CURRENT DESIGN BLOCKER:
NO
```

17. CURRENT INTEGRATION WORK
The first authorized vertical-slice execution established a concrete runtime stop at TC-01 because a valid KR-03 could not be constituted without inventing missing semantics.
Accordingly:

```

```


```
RC-01:
OPEN

RUNTIME-BLOCKING:
YES

KR-03 VALUE-CONSTITUTION:
UNRESOLVED
```

Existing historical investigation has not established a complete solution.
Therefore future work on RC-01 SHOULD transition from indefinite historical discovery toward the methodology established here:

```

```


```
NECESSITY
        ↓
MINIMUM LOCUS CHECK
        ↓
MINIMUM KR-03 DESIGN
        ↓
NON-CONFLICT REVIEW
        ↓
APPLICABLE APPROVAL
        ↓
IMPLEMENT
        ↓
RE-EXECUTE VERTICAL SLICE
```

This document does not determine what KR-03 means.
It does not determine its final locus.
It does not close RC-01.
18. DEFINED CONTEXT BOUNDARY
Existing AKAE pipeline material identifies a downstream Consumer Reasoning input consisting of:

```

```


```
Validated Knowledge
+
Defined Context
+
Other Governed Knowledge Inputs
```

while maintaining that AKAE Core defines the dependency contract without thereby becoming a domain reasoning engine. 
This is relevant architectural evidence.
However:

```

```


```
DEFINED CONTEXT = KR-03
NOT ESTABLISHED

DEFINED CONTEXT = APPLICABLE SPECIALIZATION CONTEXT
NOT ESTABLISHED

DEFINED CONTEXT → RC-01
RELATION NOT ESTABLISHED

DEFINED CONTEXT → RC-02
RELATION NOT ESTABLISHED
```

No such equivalence or relationship SHALL be inferred.
If one becomes necessary, it must be established prospectively through the appropriate process.
19. EFFICIENCY RULE
The project SHALL avoid two extremes:

```

```


```
UNDER-GOVERNANCE
        ↕
OVER-GOVERNANCE
```

The target is:

```

```


```
SUFFICIENT GOVERNANCE
        +
MINIMUM NECESSARY ARCHITECTURE
        +
RUNTIME FEEDBACK
```

A question SHOULD NOT be decomposed further merely because further decomposition is theoretically possible.
A new session SHOULD NOT be opened merely because a prior session ended in `NOT ESTABLISHED`.
A new artifact SHOULD NOT be created merely because a new question exists.
A new authority determination SHOULD NOT be performed merely because multiple possible loci can be imagined.
Further work requires a concrete reason.
20. OPERATING STANDARD
For unresolved issues, the default operating sequence is:

```

```


```
01 — IDENTIFY CONCRETE NEED

02 — CHECK EXISTING SOURCES

03 — IF ESTABLISHED:
     USE EXISTING ARCHITECTURE

04 — IF NOT ESTABLISHED:
     DETERMINE WHETHER NEEDED NOW

05 — IF NOT NEEDED:
     DEFER

06 — IF NEEDED:
     PERFORM MINIMUM LOCUS CHECK

07 — DESIGN MINIMUM SOLUTION

08 — VERIFY NON-CONFLICT

09 — APPLY ONLY THE GOVERNANCE
     REQUIRED BY THE DECISION'S CONSEQUENCE

10 — IMPLEMENT

11 — EXECUTE

12 — LET RUNTIME EVIDENCE IDENTIFY
     THE NEXT REAL REQUIREMENT
```

21. NON-EFFECTS
Approval of this document SHALL NOT by itself:

*  modify AKAE Core; 
*  modify AEPE; 
*  modify AUSCIS; 
*  modify MASTER-000; 
*  modify MASTER-SUBJECT-002; 
*  resolve the historical `AKAE-PIPELINE-001` collision; 
*  establish a new AKAE Core version; 
*  change any Frozen artifact; 
*  establish KR-03 semantics; 
*  establish Applicable Specialization Context semantics; 
*  establish SE-02 semantics; 
*  close RC-01; 
*  close RC-02; 
*  close RC-10; 
*  close RC-11; 
*  close RC-13; 
*  establish `Defined Context = KR-03`; 
*  authorize implementation; 
*  or change any existing architectural lifecycle state. 

22. PROJECT DIRECTION
The project adopts the following working direction:
Preserve Source First for determining what exists. Do not infer missing architecture. Do not search indefinitely for historical answers to requirements that may never have been designed. When a missing capability is concretely necessary, determine its appropriate locus through a Minimum Locus Check, design only the minimum prospective addition required, verify non-conflict, apply governance proportional to its architectural consequence, and return to implementation and runtime validation as soon as safely possible.
The governing objective is:

```

```


```
ARCHITECTURAL INTEGRITY
        +
MINIMUM NECESSARY ARCHITECTURE
        +
CORRECT LOCUS
        +
PROPORTIONAL GOVERNANCE
        +
RUNTIME EVIDENCE
        =
FUNCTIONING INTEGRATED SYSTEM
```

23. PROPOSED APPROVAL RECORD

```

```


```
PROJECT-DIRECTION-001

REVIEW:
N/A — director-issued project direction, not subject to MASTER-000 Architectural Review

PROJECT DIRECTOR APPROVAL:
APPROVED

APPROVAL DATE:
2026-09-08

STATUS:
APPROVED — IN EFFECT

SOURCE-FIRST:
PRESERVED

MINIMUM NECESSARY ARCHITECTURE:
ESTABLISHED AS PROJECT WORKING METHODOLOGY

MINIMUM LOCUS CHECK:
ESTABLISHED AS REQUIRED PRE-DESIGN CONTROL

PROPORTIONAL GOVERNANCE:
ESTABLISHED AS PROJECT WORKING METHODOLOGY

RUNTIME FEEDBACK:
ESTABLISHED AS PREFERRED VALIDATION LOOP

ARCHITECTURAL AUTHORITY CREATED:
NO

EXISTING ARCHITECTURE MODIFIED:
NO

IMPLEMENTATION AUTHORIZED:
NO
```

END OF PROJECT-DIRECTION-001 — REVISION 001
