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
  ├── /intake          — Public multi-step intake form (14 steps)
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
- **JSONB modules:** Each intake module is stored as a JSONB column in `intake_submissions` (`module1`–`module12`, `module14`, `module15`), allowing schema evolution without migrations for form changes.
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

## 3. Intake Form — 14 Steps

The intake form collects structured data across 14 steps. Module 3 (family group) was merged into Module 2 in v1.0 to reduce friction; the `module3` column is retained for schema compatibility and receives `{}`. Step numbers shown in the UI ("Módulo X de 14") correspond to step position, not to database column names — the column mapping is shown in the table below.

| Step | DB column | Key data collected |
|---|---|---|
| 1 | `module1` | Identity, profession, visa objective |
| 2 | `module2` | Personal immigration documents + spouse + children |
| 3 | `module4` | US entry history, visa rejections, deportation |
| 4 | `module5` | Formal education + degree files |
| 5 | `module6` | Professional certifications + files |
| 6 | `module7` | Employment history (detailed) |
| 7 | `module8` | Own businesses |
| 8 | `module9` | Professional references + professional trajectory and own achievements |
| 9 | `module10` | Evidence by criterion (8 criteria + income + web presence) + artistic exhibitions and shows |
| 10 | `module11` | Strategic self-assessment (10 questions + evidence files) |
| 11 | `module12` | Optional strategic services interest (UI: "Módulo 11 de 14") |
| 12 | `module14` | Petitioner information (UI: "Módulo 12 de 14") |
| 13 | `module15` | Consultative opinion (peer group org contact fields when applicable) + O-2 companions (UI: "Módulo 13 de 14") |
| 14 | *(UI only)* | Review and submit — no DB column (`module13` does not exist) |

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

#### Form coverage

| Form | Parts generated |
|---|---|
| I-129 | Parts 1, 2, 3, 5, 6, 7 + O and P Classifications Supplement to Form I-129 |
| I-140 | Parts 1, 2, 3, 5, 6 |

Beneficiary and petitioner signature fields are left blank in the generated draft. The petition lifecycle for signature is:

`draft_generated` → `sent_for_signature` → `signed_uploaded`

Preparer Certification (Part 8 in I-129; Part 10 in I-140) is pre-filled with constant ACTION USA AI LLC preparer data and does not require client input.

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

#### Form validity monitoring

A7 includes a subfunction that monitors the currency of USCIS form versions referenced in active petitions. The architecture is two-layer to minimize bandwidth:

1. **Lightweight edition check** — Fetches the USCIS index page for the form and extracts the published edition date string (e.g., "Edition 01/17/25"). Compares against the stored expected edition date. No form download occurs if dates match.
2. **Full download on discrepancy** — If the extracted edition date differs from the stored value, downloads the full form PDF and computes a content hash. On confirmed change, updates the stored edition date and hash, and emits an `agent_case_event` flagging petitions in `draft_generated` status that reference the outdated form edition.

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

1. Client completes 14-step intake form
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

### Row-Level Security — Three-level access pattern

Applied uniformly across all `agent_*` tables (migrations 005–006), `document_translations` (migration 005), and `intake_submissions` (migration 001):

| Level | Role | Condition |
|---|---|---|
| 1 — Full read | `admin`, `supervisor` | `is_admin_or_supervisor()` SECURITY DEFINER function |
| 2 — Own cases | `agent` | `case_id IN (SELECT id FROM cases WHERE assigned_agent_id = auth.uid())` |
| 3 — Own data | `client` | `client_id = auth.uid()` or via case join (preserved per table) |

`service_role` bypasses RLS entirely and has unrestricted FOR ALL access on all tables.

`agent_logs` has no direct `case_id` and uses a double join: `run_id IN (SELECT id FROM agent_runs WHERE case_id IN (SELECT id FROM cases WHERE assigned_agent_id = auth.uid()))`.

`document_translations` has no `admin_full` policy by design: write access is restricted to `service_role` only. No authenticated session — including `admin` — can INSERT, UPDATE, or DELETE rows. This ensures AI-generated certified translations are immutable from the dashboard.

Client policies (`client_view_own_case_events`, `client_view_own_deadlines`) on `agent_case_events` and `agent_case_deadlines` are preserved alongside the staff policies — both are PERMISSIVE and stack with OR semantics.

---

## 8. Sistema de Invitaciones

The invitation system replaces open public access to the intake form with a cryptographic token-gated flow. Clients can only reach the intake form via a personal, time-limited invitation link generated by an admin.

### Table: `intake_invitations`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `token` | TEXT NOT NULL UNIQUE | 32-byte cryptographically random value, `base64url` encoded |
| `case_id` | UUID NOT NULL | FK → `cases(id)` ON DELETE CASCADE |
| `client_id` | UUID NOT NULL | FK → `clients(id)` ON DELETE CASCADE |
| `email` | TEXT NOT NULL | Destination address |
| `status` | TEXT NOT NULL | Enum: `pending` / `opened` / `submitted` / `expired` / `revoked`; default `pending` |
| `expires_at` | TIMESTAMPTZ NOT NULL | Default `NOW() + INTERVAL '14 days'` |
| `opened_at` | TIMESTAMPTZ | Set on first valid token access |
| `submitted_at` | TIMESTAMPTZ | Set when intake form is submitted |
| `revoked_at` | TIMESTAMPTZ | Set if manually revoked |
| `revoked_by` | UUID | FK → `profiles(id)` |
| `superseded_by` | UUID | Self-referential FK; set when a new invitation replaces an existing one |
| `created_by` | UUID | FK → `profiles(id)` |
| `created_at` | TIMESTAMPTZ NOT NULL | Default `NOW()` |

RLS: service role has full access; admin/supervisor/agent roles can SELECT, INSERT, and UPDATE.

### Invitation Model A — from existing case (`POST /api/admin/invitations`)

Used from the case detail page `InvitationPanel` when a case and client already exist.

1. Caller auth verified via cookie-based SSR session; role checked against `profiles`
2. Token generated: `randomBytes(32).toString("base64url")`
3. Row inserted into `intake_invitations` with provided `case_id`, `client_id`, `email`
4. Invitation email sent via Resend (non-fatal — row is kept if Resend fails)
5. Returns `{ success, invitation_id, expires_at, email_warning? }`

### Invitation Model B — standalone creation (`POST /api/admin/invitations/create`)

Used from the cases list page modal when no prior case exists. Creates client, case, and invitation in a single atomic-as-possible operation.

1. Caller auth and role verified (same pattern as Model A)
2. `clients.email` lookup via `maybeSingle()` — reuses existing client if found, otherwise inserts new client (no `profile_id` yet)
3. Case inserted with `case_number` generated by DB trigger (`generate_case_number` — sequence-based, guaranteed unique)
4. Token generated and invitation inserted
5. On invitation insert failure: case and newly created client are deleted (best-effort rollback)
6. Email sent via `sendInvitationEmail()` from shared library (non-fatal)
7. Returns `{ success, case_id, case_number, invitation_id, expires_at, email_warning? }`

### Shared email library (`src/lib/email/invitation.ts`)

Both invitation routes import from this shared module:

- `buildInvitationHtml(token, email): string` — renders the full branded HTML email (logo, navy header, body copy, gold warning box, CTA button linking to `https://actionusaai.com/intake?token={token}`)
- `sendInvitationEmail(token, email): Promise<void>` — calls Resend API; throws on non-2xx response

Subject line: `"Inicio formal de su expediente — ACTION USA AI"`

### Token generation

```typescript
import { randomBytes } from "crypto";
const token = randomBytes(32).toString("base64url");
```

Produces a 43-character URL-safe base64 string with 256 bits of entropy. No padding characters that could cause issues in query strings.

### Token validation (server component)

`src/app/intake/page.tsx` is a Next.js server component that executes before any client code is sent to the browser:

```typescript
const { data: invitation } = await db
  .from("intake_invitations")
  .select("id, status, case_id, client_id")
  .eq("token", token)
  .in("status", ["pending", "opened"])
  .gt("expires_at", now)
  .maybeSingle();

if (!invitation) redirect("/intake/no-access");
```

On first valid access (`status = 'pending'`), the server immediately updates the row to `status = 'opened', opened_at = now` before rendering the form.

### Access control

| Condition | Result |
|---|---|
| No `token` query param | Redirect → `/intake/no-access` |
| Token not found in DB | Redirect → `/intake/no-access` |
| Token found but `status = 'submitted'` or `'expired'` or `'revoked'` | Redirect → `/intake/no-access` |
| Token found, `expires_at` in the past | Redirect → `/intake/no-access` |
| Token valid, `status = 'pending'` | Mark `opened`, render form |
| Token valid, `status = 'opened'` | Render form (idempotent re-access) |

`/intake/no-access` is a static page with no navigation links displaying a branded error message in formal Spanish.

### Draft isolation

The client-side localStorage draft key is scoped per token to prevent cross-session contamination when two invitation links are opened in the same browser:

```typescript
const storageKey   = `aucis_intake_draft_${token}`;
const sessionIdKey = `aucis_session_${token}`;
```

---

## 9. Intake Form — Módulo 12: Información del Peticionario

> **Nota de nomenclatura:** Por razones históricas de diseño, este módulo y el siguiente se presentan como Módulo 12 y Módulo 13 en la interfaz de usuario, pero persisten en las columnas `module14` y `module15` de `intake_submissions`. La numeración 14/15 coincidió originalmente con la tabla `case_expedition_docs` etiquetada como "Module 14 — admin only" en el comentario de `001_aucis_intake.sql`, lo que generó una colisión de nombres nunca resuelta a nivel de esquema. La columna `module13` no existe — el paso de revisión final (step 14) es puramente de UI y no persiste datos propios.

Módulo 12 captura la información del peticionario responsable de presentar la petición I-129 ante USCIS. Su diseño refleja los tres modelos legales de peticionario reconocidos por USCIS para visas de no-inmigrante.

### Tipos de peticionario

| Tipo | Descripción |
|---|---|
| `empresa` | LLC, Corp. u otra entidad legal registrada en EE.UU. |
| `persona_natural` | Individuo que actúa como empleador o patrocinador directo |
| `agente` | Agente o agencia que actúa en nombre del empleador |

### Campos condicionales por tipo

**empresa:**
- `companyName` — Nombre legal de la empresa
- `ein` — Número EIN (formato XX-XXXXXXX)
- `stateOfIncorporation` — Estado de incorporación
- `companyAddress` — Dirección completa
- `representativeName` — Nombre del representante autorizado
- `representativeTitle` — Cargo del representante
- `companyArticlesPath` / `companyArticlesName` — Artículos de incorporación (upload)
- `einDocPath` / `einDocName` — Carta EIN del IRS (upload)

**persona_natural:**
- `petitionerFullName` — Nombre completo
- `petitionerDateOfBirth` — Fecha de nacimiento
- `petitionerAddress` — Dirección completa
- `petitionerRelationship` — Relación con el beneficiario
- `petitionerIdPath` / `petitionerIdName` — Identificación con foto (upload; excluida de traducción)
- `petitionerBirthCertPath` / `petitionerBirthCertName` — Acta de nacimiento (upload; traducible)

**agente:**
- `agentName` — Nombre del agente o agencia
- `agentEmployerName` — Nombre del empleador representado
- `agentAgreementType` — Tipo de acuerdo con el empleador

### Campos comunes (visibles tras seleccionar tipo)

- `businessNature` — Naturaleza del negocio o actividad
- `offeredPosition` — Cargo o posición ofrecida al beneficiario
- `serviceStartDate` / `serviceEndDate` — Fechas de inicio y fin del servicio
- `hasWrittenContract` — Boolean (YesNo)
- `contractPath` / `contractName` — Contrato escrito (upload, condicional)
- `contractVerbalTerms` — Descripción de acuerdo verbal (condicional)

### Itinerario de eventos

Requerido por 8 CFR para visas O-1 cuando el peticionario es agente. Se captura como array `itineraryItems`:

| Campo | Descripción |
|---|---|
| `id` | UUID local generado en cliente |
| `eventDate` | Fecha de inicio del evento |
| `eventEndDate` | Fecha de fin del evento |
| `eventName` | Nombre del evento o actividad |
| `venue` | Lugar o venue |
| `city` | Ciudad |
| `state` | Estado (USA) |
| `employerName` | Empleador en este evento (si difiere del peticionario principal) |

### TypeScript types

Defined in `src/app/intake/types.ts`:

```typescript
type ItineraryItem = {
  id: string; eventDate: string; eventEndDate: string; eventName: string;
  venue: string; city: string; state: string; employerName: string;
};

type Module14 = {
  petitionerType: "empresa" | "persona_natural" | "agente" | "";
  // empresa
  companyName: string; ein: string; stateOfIncorporation: string;
  companyAddress: string; representativeName: string; representativeTitle: string;
  companyArticlesPath: string; companyArticlesName: string;
  einDocPath: string; einDocName: string;
  // persona_natural
  petitionerFullName: string; petitionerDateOfBirth: string;
  petitionerAddress: string; petitionerRelationship: string;
  petitionerIdPath: string; petitionerIdName: string;
  petitionerBirthCertPath: string; petitionerBirthCertName: string;
  // agente
  agentName: string; agentEmployerName: string; agentAgreementType: string;
  // common
  businessNature: string; offeredPosition: string;
  serviceStartDate: string; serviceEndDate: string;
  hasWrittenContract: boolean | null;
  contractPath: string; contractName: string; contractVerbalTerms: string;
  // itinerary
  hasItinerary: boolean | null; itineraryItems: ItineraryItem[];
};
```

Stored as `module14` JSONB column in `intake_submissions`.

---

## 10. Intake Form — Módulo 13: Opinión Consultiva y Acompañantes O-2

> **Nota de nomenclatura:** Este módulo se presenta como "Módulo 13 de 14" en la UI; persiste en la columna `module15` de `intake_submissions` por las razones históricas descritas en la sección anterior.

Módulo 13 captura los dos requerimientos de USCIS que son exclusivos de las visas O: la opinión consultiva y los acompañantes O-2.

### Sección A — Opinión Consultiva

USCIS requiere una carta de opinión de una asociación o experto del campo del beneficiario antes de aprobar cualquier petición O-1.

| Campo | Tipo | Descripción |
|---|---|---|
| `hasPeerGroup` | `"si" \| "no" \| "no_se" \| ""` | Existencia de asociación de pares |
| `peerGroupName` | string | Nombre de la asociación (si `hasPeerGroup === "si"`) |
| `peerGroupLetterType` | `"opinion_favorable" \| "no_objecion" \| ""` | Tipo de carta esperada |
| `peerGroupLetterPath` / `peerGroupLetterName` | string | Upload de carta (si ya disponible) |
| `alternativeContactName` | string | Experto alternativo (si no hay asociación formal) |
| `alternativeContactOrg` | string | Organización del experto alternativo |
| `alternativeContactRelation` | string | Relación con el campo del beneficiario |
| `noAssociationJustification` | string | Justificación escrita de ausencia de asociación |
| `consultativeNotes` | string | Notas adicionales para el equipo |

### Sección B — Acompañantes O-2

Captura de acompañantes esenciales bajo 8 CFR (o)(4).

| Campo | Descripción |
|---|---|
| `hasO2Companions` | Boolean |
| `companions` | Array de `O2Companion` |

**O2Companion fields:**
- `id`, `fullName`, `nationality`, `role`, `whyEssential`, `relationshipDuration`
- `passportPath` / `passportName` — Pasaporte del acompañante (upload; excluido de traducción)
- `employmentEvidencePath` / `employmentEvidenceName` — Evidencia de relación laboral (upload; traducible)

### TypeScript types

Defined in `src/app/intake/types.ts`:

```typescript
type O2Companion = {
  id: string; fullName: string; nationality: string; role: string;
  whyEssential: string; relationshipDuration: string;
  passportPath: string; passportName: string;
  employmentEvidencePath: string; employmentEvidenceName: string;
};

type Module15 = {
  hasPeerGroup: "si" | "no" | "no_se" | "";
  peerGroupName: string;
  peerGroupLetterType: "opinion_favorable" | "no_objecion" | "";
  peerGroupLetterPath: string; peerGroupLetterName: string;
  alternativeContactName: string; alternativeContactOrg: string;
  alternativeContactRelation: string; noAssociationJustification: string;
  consultativeNotes: string;
  hasO2Companions: boolean | null; companions: O2Companion[];
};
```

Stored as `module15` JSONB column in `intake_submissions`.

### Step map (TOTAL = 14)

| Step | DB column | Content |
|---|---|---|
| 1–10 | `module1`–`module11` | (unchanged — see Section 3) |
| 11 | `module12` | Servicios Estratégicos (conditional) (UI: "Módulo 11") |
| 12 | `module14` | Información del Peticionario (UI: "Módulo 12") |
| 13 | `module15` | Opinión Consultiva y Acompañantes O-2 (UI: "Módulo 13") |
| 14 | *(UI only)* | Revisión y Envío — no DB column |

`TOTAL = 14`; the submit step is at step 14 (UI-only, no data column). The `getModuleStatus` handler uses cases 12 and 13 for the petitioner and consultative modules. Module 3 remains absorbed into Module 2; the `module3` JSONB column receives `{}` for backward compatibility.

---

## 11. Agente A2 — Document Processor (Translation Pipeline)

The implemented A2 agent is a certified translation pipeline that processes uploaded documents from Supabase Storage, translates them using `claude-sonnet-4-6` multimodal capabilities, and produces a formatted Word document (.docx) suitable for USCIS submission.

> **Note:** This section describes the implemented translation pipeline. The placeholder A2 description in Section 5 (OCR classification to `agent_processed_documents`) describes the original design intent and is preserved for continuity.

### Endpoint

`POST /api/agents/a2-document-processor`

### Input

```json
{
  "case_id":       "uuid",
  "file_path":     "abc123/module5/degree/timestamp.pdf",
  "file_name":     "titulo_universitario.pdf",
  "document_type": "diploma"
}
```

`document_type` is optional and serves as a hint to Claude for classification.

### Pipeline

1. **Idempotency check** — Returns the existing completed translation if one exists for this `case_id` + `file_path` combination.
2. **Insert processing record** — Creates a row in `document_translations` with `status = 'processing'`.
3. **Download from Storage** — Uses service role client to download the file from bucket `intake-documents`. Converts the resulting Blob to a base64 string.
4. **MIME type detection** — Inferred from file extension: `pdf → application/pdf`, `jpg/jpeg → image/jpeg`, `png → image/png`.
5. **Claude multimodal call** — Sends the file as a `document` block (PDF, with `anthropic-beta: pdfs-2024-09-25` header) or `image` block (JPG/PNG) plus a text instruction. A single API call to `claude-sonnet-4-6` performs language detection, document classification, and translation. Structured response format:
   ```
   ---METADATA---
   {"detected_language":"...","document_category":"structured|article|letter",
    "document_type":"...","document_title":"...","issued_by":"...","issued_to":"...",
    "document_date":"...","needs_translation":true}
   ---TRANSLATION---
   [translated content, or ENGLISH if already in English]
   ```
6. **Build .docx** — If `needs_translation === true` and content is not `ENGLISH`, generates a Word document using the `docx` npm library (v9) with the branded template described below.
7. **Upload .docx** — Stores generated file at `{case_id}/translations/{original_filename}_EN.docx` in bucket `intake-documents` with `upsert: true`.
8. **Update record** — Sets `status = 'completed'`, stores all Claude-detected metadata fields and the .docx path.

On any error: sets `status = 'failed'` and stores `error_message`.

### .docx template by category

| Category | Documents | Structure |
|---|---|---|
| `structured` | Diplomas, birth certificates, contracts, licenses, awards, government records | Identification block → Declaration #1 → SECTION headers (navy bold) with field: value lines → Declaration #2 at section midpoint → body continuation → Declaration #3 + signature line |
| `article` | Press articles, academic publications, press releases | TITLE / PUBLISHED BY / DATE / AUTHOR block → translated body paragraphs → Declaration + signature |
| `letter` | Recommendation letters, opinion letters, employment letters | FROM / TO / DATE block → full literal translation → Declaration + signature |

All templates include ACTION USA AI branded header (navy wordmark, "Certified Translation Services" subtitle, centered).

### Exclusion policy

Passports and visas are **never passed to the translation route**. Exclusion is enforced at the `extract-files.ts` layer before the panel renders, not in the route itself. Excluded document types: passport, usVisa, i94, i797, ead, i20, ds2019, spousePassport, spouseVisa, spouseI94, child passports/visas, petitionerIdPath, companion passports.

### Translator (hardcoded)

All generated documents are signed by **Alexander Clavijo**. Declaration text (verbatim):

> "I, Alexander Clavijo, hereby declare that I am competent to translate the [LANGUAGE] language into English and that the foregoing is a summary translation of the attached document."

### UI component

`src/app/(dashboard)/cases/[id]/a2-panel.tsx` — client component rendered below `A1Panel` in the case detail page (`cases/[id]/page.tsx`). Features:
- Per-file "Traducir" button with loading spinner
- "Traducir todos (N)" batch button for all pending/failed files
- Green "✓ Traducido" badge + ".docx" download button on completion
- "Reintentar" button on failure
- Collapsed section for excluded documents (passports/visas)
- Re-translate button (refresh icon) on completed translations

---

## 12. Tabla: document_translations

Stores one row per document translation attempt for Agent A2.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `case_id` | UUID NOT NULL | FK → `cases(id)` ON DELETE CASCADE |
| `agent` | TEXT | Default `'A2_DOCUMENT_PROCESSOR'` |
| `status` | TEXT NOT NULL | `processing` / `completed` / `failed` |
| `original_file_path` | TEXT NOT NULL | Path in `intake-documents` bucket |
| `original_file_name` | TEXT NOT NULL | Original filename |
| `document_type` | TEXT | Provided as hint or detected by Claude |
| `document_category` | TEXT | `structured` / `article` / `letter` — Claude-detected |
| `document_title` | TEXT | Document title from Claude |
| `detected_language` | TEXT | Source language detected by Claude |
| `issued_by` | TEXT | Issuing authority or sender |
| `issued_to` | TEXT | Recipient or subject |
| `document_date` | TEXT | Date extracted from the document |
| `translated_content` | TEXT | Full translated text |
| `translation_docx_path` | TEXT | Storage path of generated .docx |
| `translation_docx_name` | TEXT | Filename of generated .docx |
| `error_message` | TEXT | Error detail when `status = 'failed'` |
| `created_at` | TIMESTAMPTZ NOT NULL | Default `NOW()` |
| `updated_at` | TIMESTAMPTZ NOT NULL | Auto-updated by `set_updated_at()` trigger |

**Indexes:** `idx_doc_translations_case (case_id)`, `idx_doc_translations_case_status (case_id, status)`

**RLS:** Service role has full access. Authenticated staff roles (admin, supervisor, agent) have SELECT access. Document downloads use signed URLs generated server-side via the service role.

**Migration:** `supabase/migrations/005_document_translations.sql`

---

## 13. Infraestructura de soporte

### GET /api/storage/signed-url

Auth-gated endpoint for generating pre-signed download URLs for files in the `intake-documents` bucket.

- Verifies the user session via SSR cookie (`createClient()` from `@/lib/supabase/server`) before generating any URL
- Uses service role client to call `storage.from("intake-documents").createSignedUrl(path, 3600)`
- Returns `{ url: string }` — valid for 1 hour
- Used by `a2-panel.tsx` when the user clicks "Descargar .docx"
- Returns 401 if unauthenticated, 400 if `path` query param is missing, 500 on Storage error

### extract-files.ts

Server-side utility at `src/app/(dashboard)/cases/[id]/extract-files.ts`. Traverses the full submission JSONB across all 14 intake modules and returns a flat array of `DocumentFile` objects.

```typescript
interface DocumentFile {
  filePath: string;
  fileName: string;
  label: string;       // human-readable Spanish label for the A2 panel
  isExcluded: boolean; // true for passports, visas, and government-issued photo IDs
}
```

Modules covered: 2 (personal docs + family), 5 (diplomas), 6 (certifications), 10 (awards, memberships, media, articles, books, conferences, judging, patents, income evidence), 11 (strategic evidence × 10 question types), 14 (petitioner documents), 15 (consultative letter + companion employment evidence).

Called from `cases/[id]/page.tsx` (server component) after fetching the full submission with `select("*")`, and passed as `documentFiles` prop to `A2Panel`.

---

## 12. Type C0 — Employment Agreement

### Overview

Type C0 covers the employment agreement between the petitioner and the O-1/EB-1 beneficiary. AUCIS handles it through a bifurcated workflow driven by whether the client already has a written contract at intake time.

### Bifurcation: generation vs. cross-verification

The `hasWrittenContract` field captured in Module 12 (Petitioner Information) determines which path executes:

| Condition | Path | Output |
|---|---|---|
| `hasWrittenContract === false` | **Generation** — A4 produces a minimum-viable employment agreement from intake data | Draft `.docx` contract |
| `hasWrittenContract === true` | **Cross-verification** — A4 checks the uploaded contract against I-129 evidentiary requirements | Compliance report flagging gaps |

### Minimum data core (generation path)

The generated contract is built from the following fields already captured in Module 12:

- Parties: `companyName` / `petitionerFullName` + beneficiary identity from Module 1
- Position: `offeredPosition`, `businessNature`
- Period: `serviceStartDate`, `serviceEndDate`
- Compensation: salary field from Module 12 (amount + periodicity selector: hourly / monthly / annual)
- Additional benefits: `additionalBenefits` free-text field from Module 12
- Termination clause: mutual written notice (default 30 days); included in all generated contracts regardless of petitioner type
- Governing law: determined from `stateOfIncorporation` or `petitionerAddress`

### Optional modules excluded from standard core

The following clauses are **not** included in the generated standard core due to higher legal exposure and the requirement for attorney review:

- Non-compete / non-solicitation
- Intellectual property assignment
- Exclusivity provisions
- Revenue-sharing or royalty structures

When any of these apply, A4 flags the contract for attorney review rather than generating the clause.
