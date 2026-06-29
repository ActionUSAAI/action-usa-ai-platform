# AUCIS — Technical Specification

**System:** Automated Case Intelligence System (AUCIS)  
**Owner:** ACTION USA AI LLC  
**Version:** 1.0  
**Date:** 2026-06-29  
**Classification:** Confidential

---

## 1. Architecture Overview

AUCIS is a multi-agent SaaS platform built to automate the preparation of extraordinary ability immigration petitions (O-1A, O-1B, EB-1A, EB-1B) from client intake through petition submission. The system orchestrates eight specialized AI agents over a shared Supabase data layer, exposed through a Next.js 14 web application deployed on Vercel.

```
Client Browser
      │
      ▼
Next.js 14 App (Vercel Edge)
  ├── /intake          — Public multi-step intake form (12 modules)
  ├── /portal          — Authenticated client dashboard
  ├── /(dashboard)     — Staff dashboard (cases, clients, documents)
  └── /api/agents/*    — Internal agent trigger endpoints
             │
             ▼
     Supabase (PostgreSQL + Storage + Auth)
  ├── intake_submissions    — JSONB per-module intake data
  ├── cases / clients       — Core CRM entities
  ├── agent_runs            — Execution log per agent invocation
  ├── agent_*               — Per-agent output tables (12 tables)
  └── Storage bucket: intake-documents
             │
             ▼
     External APIs
  ├── Anthropic API (claude-sonnet-4-6)   — All AI generation
  └── Resend                              — Transactional email
```

### Key design principles

- **Service-role pattern:** All agent routes use the Supabase service role key. No agent runs in an authenticated user context.
- **JSONB modules:** Each intake module is stored as a JSONB column (`module1`–`module12`) in `intake_submissions`, allowing schema evolution without migrations for form changes.
- **Agent run audit trail:** Every agent invocation creates an `agent_runs` record tracking status, input snapshot, output summary, and error detail.
- **Idempotent inserts:** New analysis versions are inserted (not updated) and linked via `superseded_by` to maintain full history.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) | `"use client"` boundary at page level; server components for dashboard |
| Language | TypeScript | Strict mode; no `any` in intake types |
| Styling | Tailwind CSS | Utility-first; no CSS modules |
| Auth | Supabase Auth (SSR) | Cookie-based session via `@supabase/ssr` |
| Database | Supabase (PostgreSQL 15) | JSONB for module data; typed enums for agent tables |
| Storage | Supabase Storage | Bucket `intake-documents`; path: `{sessionId}/{module}/{type}/{timestamp}.{ext}` |
| AI | Anthropic API (`claude-sonnet-4-6`) | Raw fetch; JSON-mode enforced via system prompt |
| Email | Resend | Raw fetch; from `noreply@actionusaai.com` |
| Hosting | Vercel (Hobby → Pro) | GitHub App integration; auto-deploy on push to `main` |
| DNS | Vercel DNS | Domain: `actionusaai.com` |

---

## 3. Intake Form — 12 Modules

The intake form collects structured data across 12 steps. Module 3 (family group) was merged into Module 2 in v1.0 to reduce friction. The `module3` column is retained in the database for schema compatibility and receives `{}`.

| Step | Module | Key data collected |
|---|---|---|
| 1 | Module 1 | Identity, profession, visa objective |
| 2 | Module 2 | Personal immigration documents + spouse + children |
| 3 | Module 4 | US entry history, visa rejections, deportation |
| 4 | Module 5 | Formal education + degree files |
| 5 | Module 6 | Professional certifications + files |
| 6 | Module 7 | Employment history (detailed) |
| 7 | Module 8 | Own businesses |
| 8 | Module 9 | Professional references |
| 9 | Module 10 | Evidence by criterion (8 criteria + income + web presence) |
| 10 | Module 11 | Strategic self-assessment (10 questions + evidence files) |
| 11 | Module 12 | Optional strategic services interest |
| 12 | Module 13 | Review and submit |

### File upload pattern

Files are uploaded client-side to `POST /api/intake/upload`. The API validates MIME type (PDF, JPG, PNG) and size (≤ 10 MB), then proxies to Supabase Storage using the service role. The returned `filePath` and `fileName` are stored inside the JSONB module fields.

---

## 4. Database Schema — Summary

### Core tables (pre-existing)

- `profiles` — Supabase Auth users with `role` (admin, supervisor, agent, client)
- `clients` — Client CRM record linked to `profiles` via `profile_id`
- `cases` — Immigration case linked to `clients`; `case_type` enum includes `talento_extraordinario`
- `intake_submissions` — JSONB modules; one per case

### Agent tables (migration 002)

| Table | Agent | Purpose |
|---|---|---|
| `agent_runs` | All | Execution record per invocation |
| `agent_logs` | All | Step-level log entries per run |
| `agent_intake_analysis` | A1 | Criteria scores, recommended visa type, strengths/weaknesses |
| `agent_processed_documents` | A2 | OCR output, doc type classification, tier rating |
| `agent_recommendation_letters` | A3 | Versioned letter drafts with approval workflow |
| `agent_petition_drafts` | A4 | Full petition with criteria sections, evidence checklist |
| `agent_rfe_analyses` | A5 | RFE issue identification and response strategy |
| `agent_salary_analyses` | A6 | BLS comparison, origin-country comparison, salary narrative |
| `agent_case_events` | A7 | Case timeline events with action tracking |
| `agent_case_deadlines` | A7 | Deadline tracking with alert schedule |
| `agent_notifications` | A8 | Email/in-app notifications with delivery tracking |
| `agent_concierge_messages` | A8 | AI-generated message content with approval state |

All tables have RLS enabled. Service role has full access. Admin role has full authenticated access. Clients have SELECT-only access to their own case data.

---

## 5. Eight Specialized Agents

### A1 — Intake Analyzer

Reads the completed intake form (`intake_submissions`) and produces a structured analysis:

- Per-criterion scores (0–100) for up to 8 O-1A criteria and 6 EB-1A criteria
- Recommended visa type and confidence score
- Identified strengths, weaknesses, and evidence gaps
- Executive summary and strategy notes

Output stored in `agent_intake_analysis`.

### A2 — Document Processor

Processes uploaded files from Supabase Storage:

- Extracts text (OCR where needed)
- Classifies document type using `doc_type_enum`
- Assigns institutional tier (`tier_1`, `tier_2`, `tier_3`) based on the organization issuing the document
- Flags documents needing translation
- Output stored in `agent_processed_documents`

### A3 — Letter Generator

Generates recommendation letter drafts:

- One letter per recommender, covering one or more criteria
- Adapts tone and specificity to recommender relationship type (direct supervisor, peer expert, industry leader, academic, client)
- Versioned: each revision is a new row linked via `previous_version_id`
- Approval workflow: draft → in_review → approved → sent
- Output stored in `agent_recommendation_letters`

### A4 — Petition Builder

Assembles the complete petition document:

- Cover letter
- Per-criterion narrative sections (stored as JSONB)
- Evidence checklist with completeness percentage
- Supports two build phases: `initial` and `rfe` (RFE response)
- Output stored in `agent_petition_drafts`

### A5 — RFE Analyzer

Processes USCIS Requests for Evidence:

- Identifies issues raised by USCIS from the RFE document
- Generates response strategy
- Lists additional evidence needed
- Links to an `agent_petition_drafts` record for the response draft
- Output stored in `agent_rfe_analyses`

### A6 — Salary Research

Produces quantitative salary comparison analysis:

- BLS mean and 90th percentile for the occupation (national)
- Client's actual salary with evidence type
- Origin-country average salary with USD conversion
- Percentage above BLS mean and origin average
- Qualifies/disqualifies the high salary criterion
- Narrative paragraph ready for petition use
- Output stored in `agent_salary_analyses`

### A7 — Case Monitor

Tracks case lifecycle events and deadlines:

- Emits `agent_case_events` records for status changes, RFE receipt, approvals, denials
- Manages `agent_case_deadlines` with configurable alert schedules (default: 30, 14, 7, 1 days before deadline)
- Flags events that require staff action

### A8 — Client Concierge

Generates and delivers personalized client communications:

- Accepts: `case_id`, `trigger_event`, `audience`, `message_type`, `language`
- Fetches case context and 3 most recent events
- Calls `claude-sonnet-4-6` with tone/audience-specific system prompt
- Inserts into `agent_concierge_messages` and `agent_notifications`
- Sends email via Resend; updates notification status
- Returns `{ success, notification_id, message_preview }`
- Endpoint: `POST /api/agents/concierge`

---

## 6. Two-Phase Case Building Methodology

### Phase 1 — Initial Petition

1. Client completes 12-module intake form
2. A1 (Intake Analyzer) scores criteria and recommends visa type
3. A2 (Document Processor) classifies and validates uploaded evidence
4. A6 (Salary Research) runs BLS comparison if high-salary criterion is viable
5. A3 (Letter Generator) drafts recommendation letters for selected criteria
6. A4 (Petition Builder) assembles cover letter and criterion narratives
7. Staff reviews, approves letters, finalizes petition
8. A8 (Client Concierge) sends client status updates throughout

### Phase 2 — RFE Response

1. USCIS issues RFE; staff uploads the RFE document
2. A2 processes the RFE document
3. A5 (RFE Analyzer) identifies USCIS concerns and response strategy
4. A3 generates additional or revised recommendation letters as needed
5. A4 builds RFE response petition (`build_phase = 'rfe'`)
6. Staff reviews and submits response
7. A7 (Case Monitor) tracks the RFE deadline; A8 notifies client

---

## 7. Security Model

- All agent API routes are internal (no public auth requirement) but protected by service role key which is never exposed client-side
- RLS on all tables prevents cross-client data leakage
- File uploads validated by MIME type and size before reaching Storage
- Supabase Auth webhook (`/api/send-email`) verified via Svix HMAC-SHA256 signature
- No user-supplied data is interpolated into SQL strings; all queries use Supabase client parameterization
