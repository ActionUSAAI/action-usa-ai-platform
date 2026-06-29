# AUCIS — Case-Building Methodology

**System:** Automated Case Intelligence System (AUCIS)  
**Owner:** ACTION USA AI LLC  
**Version:** 1.0  
**Date:** 2026-06-29  
**Classification:** Confidential — Proprietary Methodology

---

## 1. Overview

The AUCIS methodology translates a client's professional trajectory into a legally viable extraordinary ability petition by systematically mapping evidence to regulatory criteria, assessing institutional weight, and sequencing argument construction to maximize USCIS approval probability.

The methodology applies to four visa categories: **O-1A** (extraordinary ability in sciences, education, business, or athletics), **O-1B** (extraordinary ability in arts, motion picture, or television), **EB-1A** (alien of extraordinary ability — self-petition), and **EB-1B** (outstanding professor or researcher).

---

## 2. Criteria Framework

### O-1A / EB-1A Criteria (8 regulatory criteria)

USCIS requires evidence satisfying at least **3 of 8** criteria for O-1A, and either 3 of 10 criteria or evidence of a major international award for EB-1A.

| # | Criterion | Key evidence types |
|---|---|---|
| 1 | Awards and prizes | Certificates, press coverage of award, award committee documentation |
| 2 | Membership in associations requiring outstanding achievement | Membership letters, bylaws showing selection criteria |
| 3 | Published material about the beneficiary | Press articles, media coverage, citations |
| 4 | Judging the work of others | Invitation letters, panel documentation, review records |
| 5 | Original scientific, scholarly, or business contributions | Patents, citations, adoption by others, impact metrics |
| 6 | Scholarly articles | Published papers, book chapters, citation counts |
| 7 | Critical role in distinguished organizations | Org chart, employment letters, company recognition |
| 8 | High salary relative to peers | BLS comparison, salary evidence, contracts |

### O-1B Criteria (arts / entertainment)

For O-1B, evidence maps to: lead/starring roles, critical acclaim, high remuneration, commercial success, recognized organizations, press coverage, and industry awards.

### Criterion viability scoring

Each criterion is scored 0–100 based on:

- **Quantity:** Number of distinct pieces of evidence
- **Quality:** Institutional tier of the source (see Section 4)
- **Recency:** Evidence within the past 5 years weighted higher
- **Specificity:** Evidence directly naming the beneficiary in the qualifying role

A criterion scoring ≥ 60 is considered **viable** for inclusion. Criteria scoring 40–59 are **developable** — the Strategy Builder identifies what evidence could be obtained to elevate them. Criteria below 40 are **weak** and deprioritized unless they are the only available path.

---

## 3. Institutional Hierarchy in Evidence

The weight USCIS assigns to evidence is strongly correlated with the prestige of the issuing institution. AUCIS classifies all institutions and publications into three tiers.

### Tier 1 — High institutional authority

- Nobel Prize, Pulitzer, Oscar, Grammy, Fields Medal, and equivalent international prizes
- Nature, Science, The Lancet, NEJM, IEEE Transactions, ACM (top-5 journals per field)
- Fortune 500 companies, G20 government agencies, UN bodies
- Harvard, MIT, Stanford, Oxford, and equivalent QS top-50 universities
- National academies of science, medicine, and engineering

**Effect:** A single Tier 1 artifact can establish a criterion on its own.

### Tier 2 — Solid institutional authority

- National professional associations (IEEE, AMA, ABA, AIA, etc.)
- Top-25 universities by field
- Nationally circulated press (Wall Street Journal, BBC, Bloomberg, Variety)
- Regional government agencies, established industry conferences (ranked A/A*)
- Companies with >500 employees and documented industry recognition

**Effect:** Typically 2–3 Tier 2 artifacts are needed to establish a criterion.

### Tier 3 — Supporting evidence

- Local press, industry blogs, company-internal awards
- Small professional associations without documented selection criteria
- Startup companies, freelance clients
- Conference proceedings below A ranking

**Effect:** Tier 3 evidence supports but does not independently satisfy a criterion. Used to add depth and corroboration.

### Institutional tier in the petition narrative

The petition explicitly names the institution and its standing when introducing evidence. For Tier 1 and Tier 2 sources, a brief parenthetical context is provided ("Nature, one of the world's two most prestigious scientific journals…") to educate USCIS adjudicators who may not be familiar with field-specific prestige hierarchies.

---

## 4. Recommendation Letters as Primary Criterion Artifacts

Recommendation letters are the connective tissue of extraordinary ability petitions. Unlike passive evidence (certificates, articles), letters provide the interpretive layer that explains *why* the evidence demonstrates extraordinary ability.

### Letter architecture

Each letter is structured in four sections:

1. **Recommender authority** — Who the recommender is and why their opinion carries weight (their own credentials, institutional affiliation, recognition in the field)
2. **Relationship to beneficiary** — How the recommender knows the beneficiary and in what capacity they observed the work
3. **Criterion-specific narrative** — Specific description of the beneficiary's work or achievement that satisfies the targeted criterion, with concrete examples and metrics
4. **Expert conclusion** — The recommender's expert opinion that the beneficiary's contributions are at the top of the field

### Recommender selection strategy

The AUCIS methodology targets a minimum of **6 recommendation letters** per petition, distributed as:

- 2–3 letters from direct collaborators or supervisors (relationship depth)
- 2–3 letters from independent experts who know the beneficiary by reputation (third-party validation)
- 1 letter from a recognized industry leader at Tier 1 or Tier 2 institution (institutional authority)

Independent letters — from experts who have no financial or personal relationship with the beneficiary — carry disproportionate weight with USCIS because they establish that the beneficiary's reputation extends beyond their immediate network.

### Criterion coverage matrix

Before generating letters, AUCIS maps each recommended letter to the criteria it will support. No criterion should be supported by fewer than 2 letters. The matrix ensures:

- Every viable criterion has at least 2 independent letter supporters
- No single recommender is the sole support for more than 1 criterion
- The highest-scoring criteria receive letters from the highest-tier recommenders

---

## 5. BLS Salary Comparison Approach

The high salary criterion (Criterion 8 for O-1A/EB-1A) requires demonstrating that the beneficiary's remuneration is significantly above the average for similarly employed workers. AUCIS uses a three-anchor comparison approach.

### Anchor 1 — BLS national mean

The Bureau of Labor Statistics Occupational Employment and Wage Statistics (OEWS) survey provides the national mean annual wage and the 90th percentile for the beneficiary's occupation code. A salary above the **75th percentile** is considered a strong showing; above the **90th percentile** is considered exceptional.

### Anchor 2 — Origin country comparison

For beneficiaries who earned their salary primarily outside the United States, AUCIS also compares against the average salary for the equivalent occupation in the beneficiary's country of origin. This comparison is expressed in USD using the prevailing exchange rate at the time of peak earnings. Even modest US salaries can demonstrate high remuneration when compared to origin-country standards.

### Anchor 3 — Field-internal comparison

Where BLS occupation codes are broad (e.g., "Software Developers" covering a wide range), AUCIS supplements with field-specific salary surveys (Radford, Mercer, H-1B disclosure data) to narrow the comparison to the beneficiary's specific sub-specialty.

### Salary narrative output

The salary analysis produces a 2–3 paragraph narrative suitable for direct inclusion in the petition, plus a comparison table. The narrative explicitly states the percentage above the BLS mean and the 90th percentile, the evidence type (W-2, contract, offer letter), and the conclusion that the salary demonstrates extraordinary compensation.

---

## 6. Intake-to-Petition Workflow

### Stage 1 — Intake (client-facing)

The client completes a 12-module structured intake form covering identity, documents, immigration history, education, certifications, employment, businesses, references, evidence by criterion, strategic self-assessment, and optional services. The form uses auto-save (localStorage, 30-second interval) and allows file uploads per evidence item.

### Stage 2 — Intake Analysis (A1)

Upon form submission, the Intake Analyzer reads all 12 modules and produces:
- Criterion viability scores
- Recommended visa type with confidence
- Evidence gap report
- Strategy notes for staff review

### Stage 3 — Document Processing (A2)

All uploaded files are processed to extract text, classify document type, assign institutional tier, and flag translation needs. Output feeds into the evidence inventory used by the Petition Builder.

### Stage 4 — Salary Research (A6)

If the high salary criterion is viable (score ≥ 40), the Salary Research agent runs the BLS comparison and produces the salary narrative and comparison table.

### Stage 5 — Letter Strategy (A3)

The Letter Generator produces first drafts for all planned recommendation letters based on the criterion coverage matrix and the recommender information collected in Module 9 (references). Each letter goes through a staff approval cycle before finalization.

### Stage 6 — Petition Assembly (A4)

The Petition Builder assembles:
- Cover letter addressing the specific visa category requirements
- Per-criterion narrative sections (one per viable criterion)
- Evidence exhibit list with file references
- Completeness checklist

### Stage 7 — Staff Review and Submission

The supervising attorney reviews all generated content, makes edits in the dashboard, approves letters, and finalizes the petition. The submission workflow records the `submitted_at` timestamp and triggers client notifications via A8.

### Stage 8 — Post-Submission Monitoring (A7 + A8)

The Case Monitor tracks USCIS processing status, deadline dates (including premium processing windows), and any USCIS notices. The Client Concierge sends periodic status updates and deadline alerts to keep the client informed throughout the adjudication period.

### RFE Response Path

If USCIS issues an RFE, the workflow branches:
- A2 processes the RFE document
- A5 identifies USCIS concerns and generates a response strategy
- A3 produces additional or revised letters targeting the raised issues
- A4 assembles the RFE response petition
- The case re-enters Stage 7 for attorney review and submission

---

## 7. Differentiators

**Evidence-first approach:** The AUCIS system begins with what the client *has*, not what the attorney needs. The intake form's Module 10 uses a three-state selector (tengo / tal vez / no tengo) that captures actual evidence, aspirational evidence, and gaps simultaneously. The "no tengo" state triggers strategy prompts that identify what evidence *could* be built — turning the intake into both a data collection and case-development tool.

**Disposition tracking:** For criteria where a client currently lacks evidence, the system captures the client's disposition narrative (what they know about the field, what competitions or associations they are aware of) to inform a prospective strategy for evidence building before petition filing.

**Bilingual operation:** All client-facing communications, intake prompts, and concierge messages support Spanish and English. The core legal documents (petition, letters) are generated in English. This bilingual approach serves the primary market of Latin American extraordinary ability professionals.

**Institutional tier scoring:** By explicitly classifying and scoring the institutional weight of each piece of evidence, AUCIS produces petitions that front-load the strongest evidence and frame weaker evidence as corroborating rather than primary. This mirrors how experienced immigration attorneys approach USCIS adjudicators.
