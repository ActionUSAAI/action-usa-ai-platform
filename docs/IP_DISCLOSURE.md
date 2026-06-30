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
| Current version | 1.0 |
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

*This document should be updated whenever material new IP is added to the AUCIS system.*
