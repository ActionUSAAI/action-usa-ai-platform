# MTCS-08 — Generated Work Product Re-entry — FINAL EXACT DESIGN

## 1. Identification

```
MTCS:                 MTCS-08
Name:                  Generated Work Product Re-entry
Materialized by:       MCS Materialization / Design-Entry Gate,
                        decision MCS-MAT-A, commit eee1495
Governing CPS:          docs/CANONICAL_PROJECT_STATE.md
Status of this document: FINAL EXACT DESIGN
Implementation status:  NOT AUTHORIZED
```

## 2. Governing Sources

- `docs/AUCIS_EVIDENCE_ITEM_CONTRACT_V2.md` §46–50 (FROZEN) — primary source.
- `docs/CANONICAL_PROJECT_STATE.md` §G, §J, §P, §Q, §T (post-JSR-B, post-materialization state).
- Closed contracts consumed, not reopened: MTCS-02/02A (canonical Document identity), MTCS-03 (Evidence↔Document), MTCS-04 (Governed Evidence Producer, Human Verification), MTCS-05 (human-triggered A2 entry wiring), MTCS-06 (A1/A5 Historical Reliance), MTCS-07 (signed-URL hardening).

## 3. Canonical Purpose

Register a returned, externally signed/modified/completed/transformed A3 Generated Work Product as a new canonical Case Document, preserving provenance to its originating Generated Work Product where known — nothing more.

## 4. Frozen Lifecycle

```
A3 Generated Work Product
        ↓
Human Approval for External Use
        ↓
External Return
        ↓
New Case Document
        ↓
A2 Processing where applicable
        ↓
Evidence Incorporation / Association
        ↓
Human Verification where applicable
        ↓
Authorized Downstream Consumption
```

`GENERATED WORK PRODUCT ≠ CASE DOCUMENT ≠ EVIDENCE ITEM` (§46–47). MTCS-08 implements only the third and fourth nodes above (External Return → New Case Document, with provenance). Every node after that is handoff to already-closed substrate, not reimplemented.

## 5. Scope

**In scope:** authenticated-staff ingestion of a returned artifact; canonical Case Document registration; provenance persistence to the originating GWP where known; the minimum storage/UI/API seam required to do this safely.

**Out of scope:** dispatch mechanics/provenance; `sent` as a status; external-actor system access; automatic A2/Evidence/Verification/A1/A5/Blueprint behavior; new authorization architecture; new storage bucket.

## 6. Start Boundary

```
ELIGIBILITY PRECONDITION: agent_recommendation_letters.status = 'approved'
RE-ENTRY TRIGGER:         physical/external return of the signed, modified,
                           completed, transformed, or corrected artifact,
                           received by AUSCIS staff
PERSISTED 'sent' REQUIRED: NO — reaffirmed; Evidence Item Contract V2 §49
                           gates re-entry on approval, not on a persisted
                           dispatch state.
```

## 7. End Boundary

Canonical Case Document registration, with provenance persisted, where known. MTCS-08 does not extend into A2, Evidence, or Verification — those remain owned by MTCS-05, MTCS-03/04 respectively, unmodified.

## 8. Identity Model

```
GWP identity:            agent_recommendation_letters.id       (existing, stable)
Case Document identity:  documents.id                           (existing, stable, MTCS-02A canonical)
Evidence Item identity:  evidence_items.id (migration 024)       (existing, stable, untouched)
IDENTITY CONFLICT:       NONE
```

## 9. Repository Constraint Map (as inspected)

```
agent_recommendation_letters (migration 002/010):
  id, run_id, case_id, letter_draft, letter_version, status
    (letter_status_enum: draft|in_review|approved|rejected|sent),
  approved_by, approved_at, motor, letter_type, docx_path, blocks JSONB

documents (schema.sql + migration 025):
  id, case_id, client_id, uploaded_by (nullable), name, description,
  file_path, file_size, mime_type, status (document_status, default
  'pendiente'), rejection_reason, verified_by, verified_at, expires_at,
  storage_bucket (TEXT NOT NULL DEFAULT 'case-documents'),
  UNIQUE (case_id, storage_bucket, file_path)
  RLS: NONE — confirmed via full-repository grep; documents has never
  carried a row-level security policy. Authorization on this table is
  enforced entirely at the API layer (authorizeCaseStaff), consistent
  with every existing route that writes to it.

document_translations (migration 025):
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL
    — the one existing precedent in this repository for a nullable
    lineage FK from a derived/returned artifact back to its canonical
    source. MTCS-08's lineage design mirrors this precedent exactly,
    applied in the reverse direction (documents → its own origin).

registerCanonicalDocument (src/lib/documents/register-canonical-document.ts):
  idempotent upsert on (case_id, storage_bucket, file_path); resolves
  Case→client_id server-side; never infers Case ownership from path/
  session/uploader/filename; does not create Evidence, does not invoke
  A1/A5. Directly reusable.

authorizeCaseStaff (src/lib/auth/authorize-case-staff.ts):
  already-generalized shared helper (admin/supervisor unconditionally,
  or the agent assigned to the Case) — extracted from the exact pattern
  used by case-letters PATCH and reconcile-documents. Directly reusable,
  zero modification.

case-letters route (src/app/api/case-letters/route.ts):
  PATCH implements draft→in_review→{approved,rejected}; SSR session auth
  + authorizeCaseStaff + optimistic-concurrency conditional update.
  Precedent for MTCS-08's own route security shape.

signed-url route + resolve-signed-url-resource.ts (MTCS-07):
  resolveCanonicalDocument(db, documentId) reads case_id/storage_bucket/
  file_path directly off documents.id — bucket-agnostic. A new
  documents row from MTCS-08 is automatically servable through this
  existing mechanism with zero MTCS-07 changes.

a2-document-processor route (MTCS-05 handoff target):
  hardcodes BUCKET = "intake-documents" for all of its own reads/writes;
  human-triggered from document-translation-section.tsx.

Storage bucket usage (repository-wide grep):
  "intake-documents" — used by A1/A2/A3/A4/intake-upload; multiple
    confirmed, currently-functioning callers. De facto general document
    storage bucket despite its name.
  "case-documents" — the documents.storage_bucket column DEFAULT, and
    the target of exactly one real caller: src/app/client/dashboard/
    upload-btn.tsx — whose own inline code comment reads: "Verifica que
    el bucket 'case-documents' exista en Supabase Storage." No
    migration creates this bucket in Supabase Storage; its provisioning
    status is not confirmed by any source inspected.

Existing upload validation precedent (src/app/api/intake/upload/route.ts):
  MAX_SIZE = 10MB; ALLOWED = [application/pdf, image/jpeg, image/png];
  storage path built server-side, not from raw client filename alone.

Existing ad-hoc Case-document upload precedent (upload-btn.tsx):
  filename sanitized via /[^a-zA-Z0-9._-]/g → "_"; path =
  `${caseId}/${Date.now()}_${safeName}`; accepts pdf/jpg/jpeg/png/doc/
  docx/xls/xlsx. Predates registerCanonicalDocument — uses a plain
  .insert() rather than the idempotent upsert, and is client-facing
  (not the actor model MTCS-08 requires). Reused here only for its
  path/sanitization convention, not its registration or actor model.

UI attachment point (document-generation-section.tsx):
  per-letter row component renders letter.status, letter.id,
  letter.docx_path, and conditional action buttons keyed on
  letter.status (draft/in_review/approved). This is the existing,
  correct attachment point for a new conditional action.

Audit infrastructure: no dedicated audit_log table exists anywhere in
  the repository. Actor/timestamp provenance is carried by each
  table's own uploaded_by/created_at-style columns — the existing,
  repository-wide convention.
```

## 10. Selected Lineage Model — Q1 RESOLVED

```
SELECTED MODEL:     L-01 — nullable FK on documents

EXACT TABLE:        public.documents
EXACT COLUMN:       originating_recommendation_letter_id UUID
FK:                 REFERENCES public.agent_recommendation_letters(id)
NULLABILITY:        NULL — required only "where known" (§47); every
                     pre-existing documents row remains NULL (no
                     backfill — see §21 of this document)
ON DELETE:          SET NULL — the returned Case Document is an
                     independent canonical Case Document (§47); deleting
                     its origin must not delete or block deletion of the
                     returned document. RESTRICT would block legitimate
                     origin cleanup for no frozen reason; CASCADE would
                     violate §47 directly.
INDEX:               idx_documents_originating_recommendation_letter_id
                     (btree), mirroring the existing
                     idx_document_translations_document_id precedent
UNIQUE CONSTRAINT:   NONE on this column — one GWP may have 0..N
                     returned documents (§12/Q2 below)
```

**Rationale:** exactly one precedent exists anywhere in this repository for this class of relationship — `document_translations.document_id`, an additive nullable FK from a derived artifact back to its canonical source, added by migration 025 after MTCS-02 had already closed. L-01 applies that same precedent in the mirror direction. A dedicated relation table (L-02) is not justified: cardinality is 0..1 on the returned-document side (a returned letter has at most one origin), so a single nullable column fully and minimally represents it. This choice also collapses the transactional-integrity question (§26 of the governing gate) to a non-issue: because lineage is a column on the same row being inserted, canonical registration and lineage persistence are the same atomic single-row upsert — not two operations requiring a wrapper.

## 11. Same-Case Invariant

`documents.case_id` for the returned artifact is never client-supplied — it is derived server-side from `agent_recommendation_letters.case_id` via the letter row fetched by the route (§14 below), then passed into `registerCanonicalDocument`, which itself re-derives `client_id` from `cases` server-side. There is no code path by which a returned document's `case_id` could diverge from its originating letter's `case_id`. Enforcement is **application-level, server-derived binding** — the same mechanism MTCS-02A already uses for every other canonical registration; no database trigger is introduced, consistent with `registerCanonicalDocument`'s existing design (CD-14: never infers or fabricates Case ownership from client input).

## 12. Q2 — Multiplicity RESOLVED

```
GWP → RETURNED DOCUMENT:        0..N — SUPPORTED. Nothing in Evidence
                                 Item Contract V2 prohibits multiple
                                 legitimate returns (e.g., a corrected
                                 re-signed copy); §48 anticipates
                                 external modification generally.
RETURNED DOCUMENT → GWP:        0..1 — a single nullable FK column is
                                 singular by construction.
CORRECTED SECOND RETURN:        R-01 — creates ANOTHER Case Document.
                                 No Document-supersession mechanism
                                 exists anywhere in this repository
                                 (documents carries no version/
                                 supersede columns, unlike
                                 case_strategy) — R-03 does not apply;
                                 R-02 (overwrite) would violate §47.
TECHNICAL RETRY:                handled by the existing MTCS-02A
                                 idempotency key (case_id,
                                 storage_bucket, file_path) via
                                 registerCanonicalDocument's
                                 upsert+ignoreDuplicates+resolve-
                                 existing behavior, reused unchanged.
```

## 13. Q3 — Return Ingestion Contract RESOLVED

**Actor**
```
AUTHORIZED ACTOR:   authenticated AUSCIS staff — admin, supervisor, or
                    the agent assigned to the Case — via
                    authorizeCaseStaff(letter.case_id), reused
                    verbatim, zero modification.
EXTERNAL ACTOR:     NO AUSCIS system access. Consistent with §48's
                    anticipation of an out-of-band real-world exchange;
                    AUSCIS's boundary is the staff ingestion action.
```

**UI**
```
FILE/COMPONENT:      src/app/(dashboard)/cases/[id]/document-generation-section.tsx
                      — the existing per-letter row component.
ENTRY ACTION:         a new conditional action ("Subir documento
                      devuelto" / equivalent), rendered alongside the
                      existing download button.
VISIBILITY CONDITION: letter.status === "approved" only — draft,
                      in_review, and rejected never show it; 'sent'
                      is unreachable today and, per §21 below, is not
                      an accepted precondition regardless.
ORIGINATING GWP ID SOURCE: letter.id, already present in this row's
                      existing props — no new data fetch required.
CASE ID SOURCE:       server-derived (see §11); the UI never
                      constructs or sends case_id.
```
(Design only — no component code is written by this act.)

**API**
```
METHOD:               POST
ROUTE:                /api/case-letters/[id]/returned-document
                      (mirrors the repository's existing nested-
                      resource convention, e.g.
                      /api/cases/[id]/evidence/[compositionId]/documents;
                      [id] here is agent_recommendation_letters.id,
                      the primary binding identity per §20 of the
                      governing gate)
AUTHENTICATION:       SSR cookie session via createServerClient(),
                      identical to case-letters PATCH
AUTHORIZATION:         authorizeCaseStaff(letter.case_id), reused
                      verbatim
CONTENT TYPE:          multipart/form-data
INPUT:                 file (required) — nothing else; case_id and
                      client_id are never accepted from the client
SERVER-DERIVED FIELDS: case_id, client_id (via registerCanonicalDocument
                      → cases lookup), storage_bucket (fixed, §15),
                      file_path (server-generated, §16),
                      originating_recommendation_letter_id (= [id]
                      path param), uploaded_by (= authenticated user id),
                      status (canonical default 'pendiente')
SUCCESS RESPONSE:      { document_id, case_id, originating_gwp_id,
                      document_status } — no signed URL by default;
                      later access goes through the existing MTCS-07
                      signed-URL route (§18 below)
ERROR STATES:
  401 — unauthenticated
  403 — authenticated but unauthorized for this Case
  404 — [id] does not resolve to an existing
        agent_recommendation_letters row
  409 — letter.status !== 'approved' (not eligible) OR a concurrent
        state change is detected
  400 — missing file, disallowed MIME type, or file exceeds size limit
  5xx — storage or persistence failure
```

**Service boundary**
```
NEW FILE:  src/lib/documents/register-returned-gwp.ts
FUNCTION:  registerReturnedGeneratedWorkProduct(db, { letterId, file,
           uploadedBy })
RESPONSIBILITY: fetch + validate the letter (exists, status ===
  'approved'); derive case_id; build the deterministic storage path
  (§16); upload to storage; call the extended registerCanonicalDocument
  (§17, RC-02) with the lineage parameter; return the resulting
  document identity.
SEPARATION: mirrors the existing repository pattern of
  resolve-signed-url-resource.ts (framework-agnostic logic) vs.
  signed-url/route.ts (transport) — the route stays a thin
  auth-then-delegate layer; the service function carries the domain
  logic and is independently testable, matching that established
  precedent rather than inventing a new one.
```

## 14. Q4 — Storage Design RESOLVED

```
SELECTED EXISTING BUCKET: "intake-documents"
RATIONALE: the only bucket in this repository with multiple confirmed,
  currently-functioning real callers (A1/A2/A3/A4/intake-upload) —
  already the repository's de facto general document-storage bucket
  despite its name. The column-default alternative, "case-documents",
  has exactly one real caller (upload-btn.tsx) whose own code comment
  flags that its provisioning in Supabase Storage is unconfirmed. Design
  correctness requires selecting the bucket known to exist. This is a
  deployment/configuration-level choice, not an identity-level one
  (Part VII precedent) — MTCS-07's signed-URL resolution is already
  bucket-agnostic (§9 above), so this choice can be revisited later
  without any architectural consequence if "case-documents"'s
  provisioning is later confirmed.
NEW BUCKET: NO
PATH PATTERN: {case_id}/gwp-returns/{originating_letter_id}/
              {timestamp}_{sanitized_filename}
  — case-scoped first segment (matches upload-btn.tsx's own
  ${caseId}/... convention); a fixed gwp-returns/ segment keeps
  MTCS-08 artifacts visually distinct within the shared bucket;
  scoped further by the originating letter id (collision-free across
  multiple GWPs and, combined with the timestamp, across multiple
  returns of the same GWP — §12); filename sanitized via the same
  /[^a-zA-Z0-9._-]/g → "_" pattern already used by upload-btn.tsx.
UPLOAD MODEL: identical to intake/upload — request.formData(),
  service-role storage client, .storage.from(bucket).upload(path,
  bytes, { contentType, upsert: true }).
FILE VALIDATION: MIME types [application/pdf, image/jpeg, image/png,
  application/msword, application/vnd.openxmlformats-officedocument.
  wordprocessingml.document] — narrowed from upload-btn.tsx's broader
  accept list by dropping spreadsheet types, which are not a plausible
  format for a returned recommendation letter. Size limit: 10MB,
  reusing intake/upload's existing MAX_SIZE constant as the established
  precedent for this class of operation.
FAILURE / RECOVERY:
  1. storage upload succeeds, DB registration fails: orphaned storage
     object, no DB row. Recovery = safe retry (same deterministic
     path → registerCanonicalDocument's upsert handles it). This
     exact risk class is already tolerated, unaddressed, by every
     existing upload route in this repository (none of them clean up
     orphaned storage objects) — MTCS-08 inherits, not invents, this
     tolerance.
  2. DB registration + lineage failure: eliminated as a distinct case
     by the L-01 design (§10) — registration and lineage are the same
     atomic upsert.
  3. retry after partial failure: safe, idempotent (same reasoning
     as case 1).
  4. duplicate submission: idempotent via the existing
     (case_id, storage_bucket, file_path) unique constraint.
  5. orphaned storage object: possible but inert — consistent with
     existing repository-wide risk tolerance, not a new gap introduced
     by MTCS-08.
```

## 15. Canonical Document Registration

```
REGISTER CANONICAL DOCUMENT: RC-02 — additive optional parameter.
  registerCanonicalDocument(db, { ...existing params,
    originatingRecommendationLetterId?: string | null })
  — included in the upsert payload only when provided; every existing
  caller (A2, intake, reconcile-documents) is unaffected — omitting the
  parameter reproduces today's exact behavior byte-for-byte. This
  satisfies the governing gate's stated preference against
  contaminating generic Document registration with GWP-specific logic:
  the parameter is a generic, nullable lineage reference at the
  function-signature level, not a GWP-specific code path.
documents.id REMAINS CANONICAL CASE DOCUMENT ID: YES — unchanged.
```

## 16. Document Metadata

| `documents` field | Source |
|---|---|
| id | generated by registerCanonicalDocument (existing) |
| case_id | server-derived from the letter row |
| client_id | server-derived via registerCanonicalDocument's Case lookup (existing) |
| uploaded_by | authenticated staff user id |
| name | original filename (sanitized for storage path only; `name` may retain the human-readable original) |
| file_path | server-generated deterministic path (§14) |
| storage_bucket | "intake-documents" (fixed) |
| file_size / mime_type | from the uploaded file |
| status | canonical default `'pendiente'` (unchanged) |
| verified_by / verified_at | NULL (unchanged default — no automatic verification) |
| **originating_recommendation_letter_id** | **MTCS-08 delta** — the bound `[id]` path param |

## 17. Transaction / Failure Semantics

See §14's Failure/Recovery block. Canonical registration and lineage persistence are one atomic row-level upsert under L-01 (§10) — no two-phase commit or transactional wrapper is required, and none is introduced.

## 18. A2 Handoff

```
A2 AUTOMATIC ON RETURN: FORBIDDEN — no source authorizes it.
EXISTING HUMAN-TRIGGERED A2: REUSABLE, unchanged (a2-document-processor,
  MTCS-05). The newly-registered documents row becomes a generic Case
  Document like any other and is available to this existing mechanism
  without new automation.
NOTE (not architecturally blocking): whether the existing MTCS-05
  triggering UI (document-translation-section.tsx) applies any filter
  that would need a one-line adjustment to surface this new document
  class was not fully verified in this design pass. If such a filter
  exists, closing it is a bounded implementation-level adjustment to
  existing MTCS-05 UI — not new architecture, and not required for
  MTCS-08's own boundary to be complete.
```

## 19. Evidence Handoff

```
RETURNED DOCUMENT AUTOMATICALLY BECOMES EVIDENCE: NO
AUTOMATIC EVIDENCE ASSOCIATION: FORBIDDEN
EXISTING PRODUCER-MEDIATED PATH: REUSABLE, unchanged (migration 028:
  attach_evidence_document, create_evidence_composition_with_documents).
  MTCS-08 does not touch this migration or these RPCs at all.
```

## 20. Human Verification Boundary

```
PRESERVED. New Evidence compositions subsequently created from this
document, under existing Producer rules, default to Human Verification
Condition = Pending (EV-15/EV-18), exactly as today. The returned
document itself cannot become Verified merely by being registered, and
this design introduces no code path that would make it so.
```

## 21. Non-trigger Rules

```
AUTOMATIC A1:                     NO — no source conflict
AUTOMATIC A5:                     NO — no source conflict
AUTOMATIC BLUEPRINT REGENERATION: NO — no source conflict
```
None of these are touched by any file this design proposes.

## 22. Migration Delta

```
MIGRATION REQUIRED: YES
PROPOSED NEXT MIGRATION NUMBER: 033 (confirmed next after
  032_a1_historical_reliance_immutability_trigger.sql)
PROPOSED FILENAME: 033_gwp_reentry_lineage.sql
TABLES ALTERED: public.documents (only)
COLUMNS ADDED: originating_recommendation_letter_id UUID
CONSTRAINTS: FOREIGN KEY REFERENCES public.agent_recommendation_letters(id)
  ON DELETE SET NULL
INDEXES: idx_documents_originating_recommendation_letter_id (btree)
TRIGGERS: none
RLS DELTA: none — documents carries no RLS policy today (confirmed);
  none is introduced.
```
This migration is specified, not created. No SQL file is written by this act.

## 23. Existing-Data / Backfill Rule

```
BACKFILL: NONE. Provenance is preserved "where known" (§47) — it is
never reconstructed speculatively. No filename, docx_path, beneficiary
name, timestamp, or storage-path heuristic is used to infer historical
origin for any pre-existing documents row. Every existing row keeps
originating_recommendation_letter_id = NULL indefinitely unless a
future, separately-governed act establishes an authoritative source
for backfilling it.
```

## 24. Security / RLS

No RLS delta (§22). Authorization is enforced entirely at the API layer via `authorizeCaseStaff`, matching the existing, unmodified pattern for every other route that writes to `documents`. No new client-facing mutation path is exposed for the lineage column — it is only ever set server-side by the new route.

## 25. MTCS-06 Compatibility

```
MTCS-06 IMPACT: NONE. Historical Reliance is scoped to already-recorded
Evidence Item composition/versions (evidence_dependencies,
foundational_evidence) and its migration-032 immutability trigger. A
new, unrelated documents row and an additive nullable column on
documents do not touch any table or trigger MTCS-06 owns.
```

## 26. MTCS-07 Compatibility

```
MTCS-07 IMPACT: COMPATIBLE, no changes required. resolveCanonicalDocument
already reads case_id/storage_bucket/file_path generically off
documents.id — bucket-agnostic. Any document registered by MTCS-08 is
automatically servable through the existing signed-URL route
(AUTHENTICATE → BIND → RESOLVE → AUTHORIZE → SIGN, unmodified) with
zero code change to src/app/api/storage/signed-url/route.ts or
src/lib/storage/resolve-signed-url-resource.ts.
```

## 27. AEPE Classification

```
CANDIDATE AEPE — NOT PROMOTED. The general pattern "externally-returned
artifact → new domain document, with origin provenance preserved" is
noted as a plausible future-reusable shape. AEPE itself is not
modified, and no AEPE artifact is created by this act.
```

## 28. AKAE Impact

```
AKAE IMPACT: NONE. Returned Case Documents and any Evidence later
derived from them remain Case-level information. No code path
introduced by this design writes to AKAE, ALKA, or AILA.
```

## 29. Acceptance Criteria

```
AC-01  Only an authenticated, authorized staff actor (authorizeCaseStaff)
       can ingest a returned GWP artifact.                        PASS-DESIGN
AC-02  The server binds the operation to an existing originating GWP
       via the [id] path param, never a client-supplied identity.  PASS-DESIGN
AC-03  The server derives authoritative Case identity from the GWP row,
       never from client input.                                    PASS-DESIGN
AC-04  The originating GWP must satisfy status === 'approved'; 409
       otherwise.                                                  PASS-DESIGN
AC-05  The returned artifact is stored as a new object; the
       originating GWP row/docx_path is never overwritten.         PASS-DESIGN
AC-06  A NEW canonical documents.id represents the returned artifact.
                                                                     PASS-DESIGN
AC-07  Known origin provenance is persisted via
       originating_recommendation_letter_id in the same atomic
       upsert as registration.                                     PASS-DESIGN
AC-08  Returned Document and GWP share the same case_id by
       server-side derivation, never client input.                 PASS-DESIGN
AC-09  The returned artifact does not automatically become Evidence.
                                                                     PASS-DESIGN
AC-10  No automatic A2 occurs.                                     PASS-DESIGN
AC-11  No automatic Human Verification occurs.                     PASS-DESIGN
AC-12  No automatic A1 occurs.                                     PASS-DESIGN
AC-13  No automatic A5 occurs.                                     PASS-DESIGN
AC-14  No automatic Blueprint regeneration occurs.                 PASS-DESIGN
AC-15  Multiple legitimate returned documents from one GWP are
       representable (0..N, §12).                                  PASS-DESIGN
AC-16  Technical retry cannot silently corrupt lineage — same
       deterministic path + existing upsert idempotency.           PASS-DESIGN
AC-17  Registration cannot report success while known provenance
       silently fails to persist — eliminated as a distinct failure
       mode by the L-01 single-row-upsert design.                  PASS-DESIGN
AC-18  documents.id remains the sole canonical Case Document identity.
                                                                     PASS-DESIGN
AC-19  No new storage bucket is created.                           PASS-DESIGN
AC-20  No external actor portal/account is created.                PASS-DESIGN
AC-21  'sent' is not introduced as a re-entry prerequisite.         PASS-DESIGN
AC-22  MTCS-01–07 remain closed; their responsibilities are reused,
       not reimplemented.                                          PASS-DESIGN
AC-23  Production is untouched during design.                      PASS-DESIGN
AC-24  registerCanonicalDocument's behavior for every existing caller
       is unchanged when the new parameter is omitted.             PASS-DESIGN
```

## 30. Explicit Out-of-Scope

Dispatch mechanics/provenance; `sent` as a status or precondition; external-actor (recommender/signer) system access of any kind; new authorization architecture; new storage bucket; audit-log infrastructure beyond existing `uploaded_by`/`created_at` columns; return-multiplicity policy beyond what §12 already resolves; automatic A1/A5/Blueprint/QA/Market Intelligence/RFE Prediction/Learning triggering; any modification to MTCS-01–07's own tables, triggers, or contracts; bucket-provisioning verification for `case-documents` (noted, not performed).

## 31. Implementation Authorization State

```
FINAL EXACT DESIGN: APPROVED / FROZEN (pending review in §32/Part XIII)
IMPLEMENTATION:      NOT AUTHORIZED — a separate governed act must
                     authorize implementation against this frozen
                     design.
```
