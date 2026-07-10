# Intellectual Property Disclosure

**Document type:** Trade Secret and IP Disclosure  
**Classification:** Strictly Confidential  
**Date of creation:** June 29, 2026

---

## 1. System Identification

| Field | Value |
|---|---|
| System name | AUCIS — Automated Case Intelligence System |
| Full name | ACTION USA AI Case Intelligence System |
| Owner | ACTION USA AI LLC |
| Author / Inventor | Alexander Clavijo |
| Creation date | 2026 |
| Current version | 1.4 |
| Repository | Private — github.com/ActionUSAAI/action-usa-ai-platform |
| Deployment | actionusaai.com |

---

## 2. Description of the System

AUCIS is a proprietary software system that automates the preparation of United States extraordinary ability immigration petitions (visa categories O-1A, O-1B, EB-1A, and EB-1B) through a coordinated pipeline of eight AI agents, a structured multi-module client intake system, and a secure web-based case management platform.

The system integrates large language model capabilities (Anthropic Claude) with structured legal frameworks, institutional hierarchy scoring, and a proprietary evidence-to-criterion mapping methodology to produce petition-ready content — including recommendation letters, criterion narratives, salary analyses, and evidence checklists — with minimal attorney manual effort.

---

## 3. Novel Elements Claimed as Intellectual Property

The following elements of AUCIS are novel, non-obvious, and constitute proprietary trade secrets of ACTION USA AI LLC:

### 3.1 Eight-agent coordinated pipeline for immigration petition preparation

The specific architecture of eight specialized AI agents (Intake Analyzer, Document Processor, Letter Generator, Petition Builder, RFE Analyzer, Salary Research, Case Monitor, Client Concierge) operating over a shared relational database with an agent run audit layer, designed specifically for the extraordinary ability petition workflow.

### 3.2 Three-state evidence intake model

The use of a three-state selector (tengo / tal vez / no tengo) in the evidence intake module, combined with disposition text fields that capture client knowledge about the field when evidence is absent, enabling simultaneous data collection and prospective case development strategy within a single intake interaction.

### 3.3 Institutional tier classification system

The proprietary three-tier (Tier 1 / Tier 2 / Tier 3) classification of institutions, publications, and organizations for use in immigration petition evidence weighting and narrative framing, and its application to automatically score and rank evidence by legal persuasive weight before USCIS adjudicators.

### 3.4 Criterion viability scoring model

The numerical scoring model (0–100) applied per USCIS criterion to determine evidence sufficiency, with thresholds for viable (≥ 60), developable (40–59), and weak (< 40) classifications, and its use to drive agent behavior and petition construction decisions.

### 3.5 Criterion coverage matrix for recommendation letters

The methodology of mapping each planned recommendation letter to specific USCIS criteria before drafting, ensuring no criterion is supported by fewer than two independent letters and distributing institutional authority across the recommender pool by tier.

### 3.6 Three-anchor BLS salary comparison methodology

The use of three simultaneous salary anchors — BLS national mean/90th percentile, origin-country average in USD, and field-internal survey data — to construct a multi-dimensional salary comparison narrative for the high remuneration USCIS criterion.

### 3.7 JSONB-per-module intake schema with schema evolution pattern

The technical design of storing each intake module as a JSONB column in a single PostgreSQL table, combined with the client-side shallow-merge strategy for handling schema evolution without breaking existing client sessions stored in localStorage.

### 3.8 Two-phase petition build methodology

The structured two-phase petition construction workflow (Phase 1: initial petition; Phase 2: RFE response) with shared agent infrastructure, branching at the RFE Analyzer stage and producing a separate `agent_petition_drafts` record linked to the RFE analysis, enabling reuse of Phase 1 evidence and letters.

### 3.9 Bilingual AI-generated client communications system

The Client Concierge agent's design as a bilingual (Spanish/English), tone-adaptive, message-type-parameterized communication system that generates USCIS-aware client updates without disclosing legal strategy or making outcome representations.

### 3.10 Dual-model invitation architecture

The design of two distinct invitation pathways — Model A (from an existing case detail page, requiring pre-existing client and case records) and Model B (standalone, creating client, case, and invitation atomically from a single admin interaction) — operating through a shared `intake_invitations` table and shared email template library, with best-effort rollback on partial failure in Model B.

### 3.11 Cryptographic token-gated intake access control

The implementation of cryptographically secure, time-limited, single-use intake form access via 256-bit random tokens (`randomBytes(32).toString("base64url")`), validated server-side in a Next.js server component before any client code is rendered, with automatic redirect to a branded no-access page on any validation failure (absent token, unknown token, expired token, or revoked/submitted status).

### 3.12 Pre-creation pattern for client and case records at invitation time

The architectural decision to create the client record, case record, and invitation record at the moment the admin sends the invitation — prior to any client interaction — rather than at form submission time. This two-phase pattern enables real-time case tracking, staff visibility into client engagement status, and clean data integrity independent of whether the client completes the form.

### 3.13 Per-token localStorage namespace isolation

The technique of deriving the client-side localStorage draft key and session ID key from the invitation token itself (`aucis_intake_draft_{token}`, `aucis_session_{token}`), preventing draft data contamination between different invitation sessions opened in the same browser context.

### 3.14 Server-side invitation validation with automatic status progression

The server-side logic that validates the invitation token and simultaneously advances the invitation status from `pending` to `opened` (recording `opened_at`) on first valid access, providing real-time admin visibility into whether the client has begun the intake process without requiring any client-side action or explicit notification.

### 3.15 Automated certified translation system with three-format institutional template

The proprietary Word document (.docx) generation engine that produces USCIS-grade certified translations in three distinct formats — structured (field-by-field with labeled sections), article (header block plus translated body), and letter (header block plus full literal translation) — each with the ACTION USA AI institutional branding, navy/gold color scheme, and translator certification declarations positioned according to the document category. The selection of format is automated via AI document classification, requiring no manual categorization by staff.

### 3.16 AI-powered document classification and translation pipeline (single multimodal API call)

The design of a translation pipeline that combines language detection, document classification (category and type), metadata extraction (title, issuer, recipient, date), and full translation into a single call to a multimodal language model, using a structured two-section response format (`---METADATA---` / `---TRANSLATION---`) that enables deterministic parsing without a second API round-trip. This architecture eliminates inter-call inconsistencies and reduces per-document processing latency by approximately 50% compared to a sequential two-call design.

### 3.17 Triple translator declaration pattern for structured documents

The proprietary placement of the translator certification declaration at three specific points within structured-category translated documents: (1) immediately after the identification block, (2) at the mathematical midpoint of the content sections, and (3) at the end of the document with a physical signature line. This triple-declaration pattern replicates the USCIS-accepted format for certified translations of multi-section documents and is automatically implemented by the DOCX builder based on document category classification.

### 3.18 Conditional petitioner capture module with three legal models and corresponding evidentiary document requirements

The design of Module 14 as a conditionally rendered form that presents one of three distinct field sets based on the petitioner type selected (empresa / persona_natural / agente), each with its specific evidentiary document upload requirements pre-mapped to the USCIS I-129 evidentiary standards for that petitioner type — including the derivation of those requirements from real-case precedent (Rodriguez Castro O-1A, petitioner Jay McLaughlin as individual, approved upon submission of photo ID and birth certificate following RFE).

### 3.19 Consultative opinion management module covering all three USCIS scenarios

The design of Module 15 Section A as a three-path decision tree that captures the correct consultative opinion information for every possible scenario USCIS may encounter: (1) an applicable peer group exists on the USCIS list, with selection between opinion favorable and no-objection letter types; (2) no applicable peer group exists but an alternative expert or related association is available, with fields for expert credentials and relationship to the field; (3) no peer group or expert exists, requiring a written justification of absence that USCIS accepts in lieu of an opinion letter. All three paths produce information directly usable in the petition narrative without additional client communication.

### 3.20 O-2 companion capture with non-replaceability documentation field

The design of Module 15 Section B as an O-2 companion intake sub-system that captures the specific information required by 8 CFR (o)(4) — particularly the `whyEssential` field that documents the non-replaceability argument in the client's own words — along with the `relationshipDuration` field that directly addresses the USCIS scrutiny point of whether the collaboration is genuinely pre-existing and integral to the O-1 beneficiary's performance, as established by precedent case Garibay/Higuera (O-1/O-2, approved).

### 3.21 Signed URL gateway for secure authenticated document download

The implementation of a server-side signed URL generation endpoint (`GET /api/storage/signed-url`) that gates document download access behind an active user session verification before issuing a time-limited (1-hour) pre-signed Storage URL, ensuring that translation documents — which contain sensitive personal information — are never accessible to unauthenticated parties while remaining directly downloadable in the browser without additional authentication steps from the staff dashboard.

### 3.22 Type C0 employment agreement workflow with generation-vs-cross-verification bifurcation

The architecture of the Type C0 employment agreement workflow as a two-path system driven by the `hasWrittenContract` field captured in the petitioner intake module: when no written contract exists, A4 generates a minimum-viable employment agreement from a defined core data set (parties, position, compensation with periodicity selector, additional benefits, mutual-notice termination clause, governing law) using structured intake data already collected in Module 12; when a written contract exists, A4 cross-verifies the uploaded contract against I-129 evidentiary requirements and produces a compliance report flagging gaps. Optional contract modules (non-compete, IP assignment, exclusivity, revenue-sharing) are excluded from the automated generation core and flagged for attorney review due to their higher legal exposure.

### 3.23 Three-level Row-Level Security pattern standardized across the AUCIS data layer

The specific implementation of a three-level RLS architecture applied uniformly across all 12 agent tables, intake, and translation tables: (1) admin and supervisor roles granted full read access via a SECURITY DEFINER PostgreSQL function (`is_admin_or_supervisor()`); (2) agent role scoped to cases where `assigned_agent_id = auth.uid()`; (3) client role scoped to own data. The `document_translations` table additionally excludes any write policy for authenticated sessions — including admin — restricting write access exclusively to `service_role`, ensuring AI-generated certified translations are immutable from the dashboard. Client-side policies on case events and deadlines are preserved as additive PERMISSIVE policies alongside staff policies.

### 3.24 Generation-vs-cross-verification bifurcation as a general document workflow pattern

The general architectural pattern — implemented initially for Type C0 — of branching AI document workflow execution based on the existence of a prior client document: when a document exists, the system performs cross-verification against regulatory requirements; when it does not, the system generates a minimum-viable document from structured intake data. The bifurcation point is captured in structured intake data at form submission time, drives agent prompt selection, and produces distinct output types (compliance report vs. generated draft) stored in a unified output table. This pattern decouples the intake data model from the document generation model and enables the system to handle both new and incumbent client relationships without separate workflows.

### 3.25 Discriminated-union evidentiary modeling for dual-mechanism regulatory sub-criteria

The design of the `CriticalRoleEvidence` type as a TypeScript discriminated union (`criticalRoleType: 'elected' | 'technical'`) modeling the USCIS "critical or essential capacity" sub-criterion as two mutually exclusive evidentiary proof mechanisms rather than a single generic field set: an elected/appointed-role branch requiring quantifiable organizational growth metrics during a documented tenure period, and a technical/instructor-role branch requiring evidence of post-engagement institutionalization of transferred knowledge. This bifurcation, derived from comparative analysis of two approved case precedents with structurally distinct factual patterns (Rodríguez/ACRICAMDE — elected association presidency; Neira/National Carabineros School — technical instructor role), prevents the evidentiary mistyping that would result from treating both proof mechanisms under a shared generic field schema, and enforces at compile time that letter-generation logic cannot access proof-mechanism-specific fields belonging to the inapplicable branch.

---

## 4. Technology Stack Disclosure

The following third-party technologies are used in AUCIS under their respective licenses. Their use does not constitute a claim of ownership over those technologies:

- **Next.js** — MIT License (Vercel, Inc.)
- **Supabase** — Apache 2.0 / Supabase, Inc.
- **Anthropic Claude API** — Proprietary API (Anthropic, PBC) — used under commercial API agreement
- **Resend** — Proprietary API (Resend, Inc.) — used under commercial agreement
- **Tailwind CSS** — MIT License
- **Vercel hosting** — Proprietary platform (Vercel, Inc.) — used under commercial agreement

The novel intellectual property of ACTION USA AI LLC resides in the system architecture, agent coordination logic, scoring models, methodological frameworks, and proprietary prompts — not in the underlying infrastructure components listed above.

---

## 5. Confidentiality and Trade Secret Statement

The information contained in this document and in all associated source code, database schemas, agent prompts, scoring models, and methodology documents constitutes trade secrets of **ACTION USA AI LLC** under the Defend Trade Secrets Act of 2016 (18 U.S.C. § 1836 et seq.) and applicable state trade secret laws.

This information:

- Has independent economic value by virtue of not being generally known or readily ascertainable by others who could obtain economic value from its disclosure or use;
- Is subject to reasonable measures to maintain its secrecy, including repository access controls, confidentiality obligations for all personnel, and restricted disclosure on a need-to-know basis.

**Unauthorized disclosure, reproduction, reverse engineering, or use of any element described in this document is strictly prohibited and may subject the violating party to civil and criminal liability under applicable law.**

All personnel, contractors, and service providers with access to AUCIS source code or documentation are required to have executed a Non-Disclosure Agreement with ACTION USA AI LLC prior to access.

---

## 6. Authorship Declaration

I, **Alexander Clavijo**, declare that I am the sole author and inventor of the AUCIS system as described in this document, and that the intellectual property described herein was created in the course of founding and operating ACTION USA AI LLC.

This disclosure is made for the purpose of establishing priority of creation and supporting future patent applications, copyright registrations, and trade secret enforcement actions.

---

## 7. Document Control

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-06-29 | Alexander Clavijo | Initial disclosure |
| 1.1 | 2026-06-30 | Alexander Clavijo | Added IP items 3.10–3.14: invitation system architecture |
| 1.2 | 2026-07-01 | Alexander Clavijo | Added IP items 3.15–3.21: A2 translation pipeline, Modules 14–15, petitioner models, O-2 companions, signed URL gateway |
| 1.3 | 2026-07-08 | Alexander Clavijo | Added IP items 3.22–3.24: Type C0 workflow architecture, three-level RLS pattern, generation-vs-cross-verification bifurcation pattern |
| 1.4 | 2026-07-10 | Alexander Clavijo | Added IP item 3.25: discriminated-union evidentiary modeling (CriticalRoleEvidence) |

*This document should be updated whenever material new IP is added to the AUCIS system.*
