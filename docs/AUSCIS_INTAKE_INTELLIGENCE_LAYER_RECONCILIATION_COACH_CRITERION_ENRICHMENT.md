# AUSCIS Intake Intelligence Layer — Prospective Reconciliation: Coach Criterion-Enrichment Responsibility Boundary

**Status:** APPROVED — CANONICAL PROSPECTIVE RECONCILIATION. Governing authority: CR-CPS-57.

**Approval record:**
```
ARCHITECTURAL REVIEW:     PASS
CORRECTIONS REQUIRED:     0
APPROVAL:                 PROJECT OWNER APPROVED
EFFECT:                   PROSPECTIVE ONLY
IMPLEMENTATION:           NOT AUTHORIZED
PRODUCTION:               NO CHANGE AUTHORIZED
```

Two Architectural Review corrections were applied prior to approval (§16 Design Delta Table: the "Fixed identity acquisition (Class A1)" row's PATH B scope corrected to be confirmation-bounded rather than unconditional; the "Professional/criterion enrichment (Class A2/B)" row's Status corrected from CLARIFIED to PROSPECTIVELY AMENDED). Zero corrections remain outstanding.

**Effect: PROSPECTIVE ONLY.** This document does not retroactively rewrite `docs/AUSCIS_INTAKE_INTELLIGENCE_LAYER_FINAL_EXACT_DESIGN.md` or `docs/AUSCIS_INTAKE_INTELLIGENCE_LAYER_RECONCILIATION_R01_R02.md`, and does not claim the rules stated below were historically present in either document. Both remain, unmodified, the historically accurate record of what was frozen/canonized on their respective dates.

**Governing sources consulted:**
1. `docs/AUSCIS_INTAKE_INTELLIGENCE_LAYER_FINAL_EXACT_DESIGN.md` (CR-CPS-33/34, FROZEN, 2026-09-17)
2. `docs/AUSCIS_INTAKE_INTELLIGENCE_LAYER_RECONCILIATION_R01_R02.md` (CR-CPS-37, CANONIZED — PROSPECTIVE ARCHITECTURAL EVOLUTION, 2026-09-18)
3. P7-ALDO-M0-SF2 source-trace findings (this session, 2026-09-22)
4. Project Owner decision, verbatim, 2026-09-22: *"The Coach debe reforzar y enriquecer la información que se extrajo de la hoja de vida correspondiente a cumplir los criterios."*

**Implementation status: NOT IMPLEMENTED. NOT AUTHORIZED BY THIS DOCUMENT.**

---

## 1. Reconciliation mission

SF2 established that the FROZEN Final Exact Design explicitly authorizes Coach to acquire *any* Structured Profile field — identity or criterion-narrative — "in parallel with" A0 (§5.1), with no field-category restriction. The Project Owner's 2026-09-22 decision narrows this: on the path where usable CV/A0 information exists, Coach's primary operating mode should shift toward reinforcing and enriching professional/criterion-relevant information, rather than acting as an undifferentiated second acquisition source for fixed identity facts already confirmed by the beneficiary.

Canonical responsibility after this reconciliation, if approved:

- **A0:** initial structured acquisition from an available CV. Unchanged.
- **Coach:** adaptive conversational acquisition and enrichment whose operating scope depends on whether usable A0/CV-derived information exists. When CV/A0 information exists, Coach primarily reinforces, deepens, supplements, and enriches professional information relevant to the applicable extraordinary-ability criteria. When no CV is available, Coach retains the broader acquisition responsibility required by R-01, so that information completeness never depends on CV availability.
- **Beneficiary:** reviews, corrects, and confirms information. Unchanged.

## 2. R-01 preserved exactly

```
CV OPTIONAL.
INFORMATION COMPLETENESS MANDATORY.
COACH MANDATORY.
```

R-01 (`RECONCILIATION_R01_R02.md` §1) is not altered, weakened, or reinterpreted by this document. Two operating paths are preserved explicitly:

**PATH A — CV present / A0 available**
```
CV → A0 extraction → Structured Profile → beneficiary review/correction/confirmation
   → Coach criterion-oriented enrichment → Structured Profile enrichment
   → beneficiary review/confirmation
```

**PATH B — CV absent / A0 unavailable**
```
No CV → Coach broader acquisition → Structured Profile
      → beneficiary review/correction/confirmation
      → Coach professional/criterion enrichment as necessary
```

PATH B preserves Coach's ability to acquire any information A0 would otherwise have supplied, **including missing identity information**. No rule in this reconciliation may break PATH B — this is a hard constraint, directly required by R-01's own text ("Absence of a CV does not lower the information standard — it shifts more acquisition burden onto Coach") and by SF2 §H's established dependency (Coach is R-01's *sole* identity-acquisition mechanism when no CV exists).

## 3. Field responsibility classes

### Class A — Fixed / objective identity & baseline facts

This reconciliation does **not** treat the existing executable `IDENTITY_FIELDS` list as proof that all twelve fields share identical semantic behavior. It distinguishes:

**A1 — Truly fixed identity/contact facts** (immutable-to-Coach once beneficiary-confirmed, per §4 below):
`familyName`, `givenName`, `middleName`, `dateOfBirth`, `nationalities`, `countryOfResidence`, `cityOfResidence`, `email`, `whatsapp`.

**A2 — Professional baseline facts** (identity-class today, but explicitly recognized as legitimate enrichment targets, not frozen facts):
`profession`, `industry`, `yearsExperience`.

The A1/A2 split is a **new prospective classification** — it does not exist in the current `IDENTITY_FIELDS` constant, which treats all twelve uniformly. Formalizing this split, if approved, is an implementation-surface concern (§9), not decided here beyond the boundary itself.

### Class B — Professional / criterion-relevant information

`awards`, `memberships`, `media_coverage`, `original_contributions`, `scholarly_articles`, `critical_role`, `high_salary`, `artistic_exhibitions`, and any other existing Structured Profile field whose purpose is professional or criterion-related rather than fixed identity. These fields are legitimate Coach enrichment targets under both PATH A and PATH B, consistent with the FROZEN design's existing, unmodified §5.1 authorization.

## 4. PATH A — A0 precedence for Class A1 fixed facts

For PATH A:

```
A0 extracts available fixed facts from the CV
    → beneficiary: REVIEW → CORRECT IF NECESSARY → CONFIRM
```

Once a **Class A1** fixed fact reaches `beneficiary_confirmed`, Coach MUST NOT:
- independently reacquire it;
- replace it;
- restate it as a competing source;
- downgrade it;
- reopen it as `conflicting` merely because the model generated a different spelling, translation, formatting, or formulation of the same fact;
- create a second entry for the same fixed fact.

The confirmed Class A1 value remains the beneficiary-attested Structured Profile value for Stage 1. This is a **Coach/A0 Intake responsibility rule only**. It explicitly does **not** mean the fact has been Evidence Verified, legally adjudicated, independently proven, approved by staff, or accepted by USCIS — the existing confirmation firewall (Final Exact Design §5.7 item 2) is preserved without modification.

**Class A2 (profession/industry/yearsExperience) is explicitly excluded from this immutability rule** — see §5.

## 5. No global immutability

This reconciliation explicitly **rejects** the rule `beneficiary_confirmed = globally immutable`. That is not the design, before or after this act.

- **Confirmed Class A1 fixed identity fact** + later Coach output → Coach does not reopen the field (§4).
- **Confirmed Class A2 / Class B professional or criterion-relevant fact** + later legitimate enrichment → may be supplemented/enriched through the governed Structured Profile process.

Worked example (design-level only, no storage mechanics prescribed): A0 extracts "11 Mexican National Championships"; beneficiary confirms; Coach later discovers "30+ State Championships" and additional championship detail through conversation. The architecture must permit this as legitimate enrichment of a Class A2/B professional fact, not treat the entire field as permanently frozen the way a Class A1 fact is. How enrichment is represented (append, supersede-with-history, revision) is **not decided by this document** — storage mechanics are an implementation-surface question (§9).

## 6. Coach must become A0-context-aware on PATH A

SF2 established (§G6-G10) that the current `sendCoachTurn()` contract receives **no** Structured Profile or A0 context whatsoever — Coach currently operates purely from raw conversational history. This reconciliation establishes that, on PATH A, Coach must have sufficient structured context to:
- avoid redundant acquisition of already-confirmed Class A1 facts;
- avoid asking for information already established;
- identify Class A2/B professional facts that warrant deeper exploration;
- identify missing criterion-relevant information;
- identify information that is incomplete, vague, or lacking corroboration;
- conduct criterion-oriented follow-up grounded in what A0 already found.

**Data minimization applies:** Coach receives only the Stage 1 Structured Profile context reasonably necessary for its authorized Intake responsibility — not unrestricted case data, not Evidence Items, not case strategy, not any data outside the existing Stage 1 boundary (Final Exact Design §3 Mission, §10 Non-interference).

## 7. Coach criterion-enrichment responsibility (PATH A)

Coach's primary enrichment function on PATH A: use A0-derived Class A2/B professional information as the starting context for intelligent questioning. Coach's role is not merely to reproduce the CV. Where relevant to existing professional facts and applicable extraordinary-ability criteria, Coach should probe:

scope, impact, selectivity, significance, responsibility, leadership, recognition, independent corroboration, measurable results, dates/duration, geographic reach, organizational distinction, audience/circulation/adoption, compensation context, judging/evaluation responsibility, documentary support availability.

Coach may also discover additional criterion-relevant professional facts not present in the CV (Class B), consistent with the FROZEN design's existing, unmodified authorization (Final Exact Design §5.1).

**Coach MUST NOT** (all firewalls carried forward unmodified from Final Exact Design §5.1, §6, §10):
- fabricate facts;
- suggest false answers;
- transform weak facts into stronger facts without beneficiary support;
- perform Evidence Verification;
- determine criterion satisfaction;
- make eligibility determinations;
- perform A1 analysis;
- perform A5 strategy;
- create legal conclusions.

## 8. Coach is not a legal decision engine

Criterion-oriented enrichment is explicitly distinguished from criterion adjudication:

**AUTHORIZED (Coach):** *"Tell me more about the national championship — who awarded it, when, how competitors qualified, and what documents support it?"* — information acquisition/enrichment.

**NOT AUTHORIZED (outside Coach's authority):** *"This award satisfies the O-1A nationally recognized prize criterion."* — a criterion-adjudication statement.

No A1/A5 authority moves upstream to Coach under this reconciliation. Final Exact Design §10 Non-interference is preserved without modification.

## 9. PATH B — broader Coach acquisition preserved

When no CV exists, Coach remains authorized to acquire whatever information is necessary to build the Structured Profile, **including Class A1 fixed identity facts** that would otherwise be supplied through A0 — this is the direct, unmodified continuation of R-01's "Coach becomes the sole acquisition path when no CV exists" provision (`RECONCILIATION_R01_R02.md` §4).

```
NO CV + missing Class A1 fact → Coach may acquire it → beneficiary reviews/corrects/confirms it.
```

After beneficiary confirmation of a Class A1 fact acquired via PATH B, the same §4 rule applies prospectively: Coach should treat it as established and should not repeatedly reacquire/reopen it without a distinct beneficiary-driven correction (§10). This preserves R-01 while preventing unnecessary conversational loops on PATH B once identity has been established and confirmed.

## 10. Beneficiary correction remains possible

Protection against Coach reacquisition must not prevent the beneficiary from correcting their own information. This reconciliation distinguishes:

- **Automated Coach reacquisition** — restricted for confirmed Class A1 facts (§4/§9).
- **Beneficiary-initiated correction** — must remain possible; a beneficiary must always be able to correct a previously confirmed fixed fact through the authorized Intake interaction.

**No exact correction UI mechanism is currently established by governing design for reopening an already-confirmed field outside the Coach-conflict path.** Per instruction not to invent a new subsystem:

**IMPLEMENTATION MECHANISM TO BE DETERMINED WITHIN EXISTING MODULE0 BOUNDARY.**

## 11. Contradiction handling — prospective clarification

Final Exact Design §7's mechanism is preserved:

```
DETECT → PRESERVE → SURFACE / RESOLVE
```

for legitimate unresolved contradictions. This reconciliation prospectively **clarifies** (does not delete) that mechanism: a Coach-generated alternative rendering of a beneficiary-confirmed **Class A1** fact is not, by itself, a new authoritative contradiction.

Examples:
- A0 + beneficiary: `nationality = "Mexican"`. Coach output: `"mexicana"`. → **NO CONFLICT.**
- A0 + beneficiary: `givenName = "Aldo"`, `middleName = "Omar"`. Coach output: `givenName = "Aldo Omar"`. → **NO COACH-GENERATED IDENTITY CONFLICT.**

This does not prevent a beneficiary from intentionally reporting that their previously confirmed information was wrong (§10). The distinction is:

**MODEL VARIATION** (a Coach-generated restatement of an already-confirmed Class A1 fact) ≠ **BENEFICIARY-ASSERTED CORRECTION / GENUINE CONTRADICTION** (the beneficiary themself reporting a different value).

No semantic-comparison AI is required or proposed by this reconciliation. The preferred architectural prevention is structural: Coach should not reacquire protected Class A1 fields once beneficiary-confirmed (§4), which prevents the redundant-reformulation class of false conflict from being generated in the first place, rather than requiring a comparison engine to detect and discard it after the fact.

## 12. Source preservation clarified

The existing principle that legitimate contradictory sources must not be silently destroyed is preserved. This reconciliation clarifies it does **not** require a second competing source record merely because Coach redundantly generated a protected Class A1 field's value:

**A legitimate independently reported contradiction ≠ a model-generated redundant reformulation.**

Only the former invokes the contradiction-preservation responsibility. No new schema is designed by this act.

## 13. Structured Profile status model — unchanged

Preserved exactly, no additions:
```
not_yet_acquired
acquired_unconfirmed
beneficiary_confirmed
conflicting
```
This reconciliation changes the **conditions** under which Coach is allowed to produce/reopen information for Class A1 fields — it does not change the status vocabulary itself.

## 14. FACTS leak — separate corrective track

P7-ALDO-M0-SF1 established that a beneficiary-visible internal `---FACTS---` payload leak is an **IMPLEMENTATION_DEFECT** (source: `coach.ts:64`'s fallback branch lacking a defensive strip). This reconciliation does not redefine the Coach wire protocol. It does establish the following invariant, prospectively binding on any future implementation:

**INTERNAL STRUCTURED COACH OUTPUT MUST NEVER BE RENDERED AS BENEFICIARY-FACING CONVERSATIONAL TEXT.**

The implementation correction for the SF1 defect may be executed in the same future bounded implementation package as this reconciliation's delta, for operational efficiency — but its authority is corrective (already established by SF1), not derived from this prospective design change. **Not implemented by this act.**

## 15. Non-interference

Explicitly preserved, unmodified, by this reconciliation:

A0 extraction-only firewall · CV optionality (R-01) · Coach mandatory participation · Structured Profile schema · beneficiary confirmation firewall (Final Exact Design §5.7) · Intake Complete semantics (§5.8) · Evidence Item Contract V2 · Structured Profile → Evidence Incorporation (migration 038) · Evidence Verification · A1 · A5 · Case Blueprint · GWP · Case Filing · AKAE / ALKA / AILA · AEPE · database schema · Production data.

No downstream component gains new authority under this reconciliation.

## 16. Design delta table

| Provision | Current governing rule | Prospective rule | Status |
|---|---|---|---|
| §5.1 Coach responsibility | general-purpose conversational discovery, no field-category distinction | operating scope becomes context-dependent: PATH A = primarily criterion-enrichment-oriented; PATH B = broad acquisition (unchanged) | PROSPECTIVELY AMENDED |
| Coach/A0 parallel acquisition | Coach and A0 feed Structured Profile "in parallel," no restriction | parallel acquisition preserved for Class A2/B on both paths, and for Class A1 on PATH B prior to beneficiary confirmation; restricted for Class A1 once beneficiary-confirmed, on both paths | PROSPECTIVELY AMENDED |
| CV-present operating mode (PATH A) | Coach behavior identical to PATH B (no distinction in governing text at field-scope level) | Coach primarily enriches Class A2/B; does not reacquire confirmed Class A1 | PROSPECTIVELY AMENDED |
| CV-absent operating mode (PATH B) | Coach is sole acquisition path (R-01) | unchanged — explicitly preserved as a hard constraint | UNCHANGED |
| Fixed identity acquisition (Class A1) | Coach authorized, undifferentiated by confirmation state | Coach remains authorized to acquire missing Class A1 facts on PATH B until beneficiary confirmation. Once a Class A1 fact is beneficiary-confirmed, the protection against automated Coach reacquisition/reopening applies on both PATH A and PATH B. | PROSPECTIVELY AMENDED |
| Professional/criterion enrichment (Class A2/B) | authorized, no priority stated | becomes Coach's primary PATH A emphasis | PROSPECTIVELY AMENDED |
| Coach access to Structured Profile context | none (SF2 §G6-G10) | Coach receives minimized, Stage-1-scoped Structured Profile context on PATH A | PROSPECTIVELY AMENDED |
| Beneficiary-confirmed fixed facts | can be reopened as `conflicting` by any disagreeing Coach output (Final Exact Design §7, general mechanism) | Coach-generated restatement of a confirmed Class A1 fact does not, by itself, trigger `conflicting`; genuine beneficiary-asserted contradictions still do | CLARIFIED |
| §7 contradiction handling | DETECT → PRESERVE → SURFACE/RESOLVE, general | mechanism preserved; scope clarified to exclude Coach model-variation of confirmed Class A1 facts | CLARIFIED |
| Source preservation | contradictory sources not silently destroyed | clarified to apply only to genuine contradictions, not redundant Coach reformulations of confirmed Class A1 facts | CLARIFIED |
| FACTS presentation invariant | not explicitly stated as an invariant (only as an SF1-identified defect) | internal structured Coach output must never render as beneficiary-facing text | CORRECTIVE INVARIANT |

## 17. Implementation boundary (identified, not authorized)

**Expected MUST CHANGE** (if this reconciliation is approved):
- Coach prompt / instruction contract
- Coach input/context contract

**Expected MAY NEED CHANGE** (pending a future implementation trace):
- `acquireField()`
- field classification constants/taxonomy (a Class A1/A2/B split does not currently exist in `IDENTITY_FIELDS`/`CRITERION_NARRATIVE_FIELDS`)
- Module0 orchestration/UI behavior

**Expected MUST NOT CHANGE:**
- `confirmField()` semantics
- StructuredProfile database shape
- database schema
- Intake submission contract
- Structured Profile → Evidence Incorporation
- Evidence firewall
- A1
- A5
- Case Blueprint

No code line changes are prescribed by this document.

## 18. Acceptance test principles (design-level only)

**Scenario 1 — CV + confirmed name.** A0 extracts Aldo/Omar/Garibay Olachea; beneficiary confirms. Coach later receives conversational mention "Aldo Omar." Expected: no identity conflict, no replacement, no reopening.

**Scenario 2 — CV + nationality language variation.** A0: "Mexican," beneficiary confirms. Coach conversation: "mexicana." Expected: no conflict generated by Coach.

**Scenario 3 — CV + criterion enrichment.** A0: "11 Mexican National Championships." Coach asks relevant follow-up; beneficiary provides additional supported professional history. Expected: professional/criterion information may be enriched.

**Scenario 4 — No CV.** A0 unavailable. Coach acquires name, DOB, nationality, and professional information. Beneficiary reviews/confirms. Expected: R-01 preserved.

**Scenario 5 — Beneficiary corrects a fixed fact.** A previously confirmed fixed fact is identified by the beneficiary as incorrect. Expected: authorized correction remains possible.

**Scenario 6 — FACTS protocol.** Model output contains an internal structured FACTS payload. Expected: internal payload never appears in beneficiary-visible Coach message.

**Scenario 7 — Firewall.** Coach discovers potentially strong award facts. Expected: Coach may gather facts/corroboration; Coach does not declare a criterion satisfied.

## 19. Closing determination

```
ARCHITECTURAL REVIEW: PASS.
CORRECTIONS REQUIRED: 0.
APPROVAL: PROJECT OWNER APPROVED (CR-CPS-57).
IMPLEMENTATION: NOT AUTHORIZED BY THIS ARTIFACT.
PRODUCTION: NO CHANGE AUTHORIZED.
NEXT GOVERNED ACT: NOT ESTABLISHED — approval of this prospective reconciliation does not itself select or authorize an Implementation Authorization Gate.
```

No MTCS number is assigned. P7 is not marked unblocked by this document. The Aldo Production fixture is not marked safe to continue by this document — its continuation status remains governed by P7-ALDO-M0-SF2's own determination (`KEEP_CURRENT_FIXTURE_PAUSED`), unaffected by this act.
