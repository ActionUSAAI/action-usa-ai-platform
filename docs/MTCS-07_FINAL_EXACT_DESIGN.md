# AUSCIS — MTCS-07
## Signed-URL Hardening
## Final Exact Design

---

## 1. Identification

```
ARTIFACT:            MTCS-07_FINAL_EXACT_DESIGN
MTCS:                MTCS-07
NAME:                signed-URL hardening
DOMAIN:              AUSCIS
ARTIFACT TYPE:       Final Exact Design
DESIGN STATUS:       APPROVED
ARCHITECTURAL STATE: FROZEN
FINAL DESIGN MR:     PASS
```

---

## 2. Governing Authority / Source

```
SOURCE:
supabase/migrations/025_canonical_documents.sql:33

VERBATIM:
"...or MTCS-07 (signed-URL hardening). No third document
infrastructure is introduced (CD-12); no existing data is
rewritten or moved."
```

Migration 025 establishes only the deferred MTCS-07 scope/name — it does not independently establish an exact mechanism, TTL policy, bucket policy, or threat model. The detailed design below is Source-First derived from existing canonical Document infrastructure (MTCS-02A), the current signed-URL runtime, existing authorization primitives, and existing artifact-storage behavior (Intake, A2 translation, A3/A4/I-129 generation).

---

## 3. Scope

> Harden the existing signed-URL access path so that service-role URL signing occurs only after authoritative resource binding and Case-level staff authorization, while preserving canonical Document identity and legitimate existing legacy artifact download paths.

No third Document infrastructure. No new canonical bucket. No file migration. No authorization-system redesign. No Client entitlement is created.

---

## 4. Real Gap

> The existing service-role signed-URL route authenticates a session but accepts a caller-supplied Storage path and signs it without first proving that the requested object belongs to an authoritative Case/resource accessible to that caller.

Runtime source: `src/app/api/storage/signed-url/route.ts` (pre-hardening: session-only auth, raw caller-supplied `path`, hardcoded `"intake-documents"`, service-role `createSignedUrl`, zero Case/Document ownership check).

---

## 5. Gap Classification

```
GAP TYPE: IMPLEMENTATION GAP
```

Not an architectural gap. Every primitive this design composes already exists and is already frozen: `documents.id`/`case_id`/`storage_bucket`/`file_path` (MTCS-02A), `authorizeCaseStaff()` (already reused by `case-letters/route.ts` and `reconcile-documents/route.ts`), case-scoped `intake_submissions`, `document_translations`, and the generated-document tables, and A2's own `document_id`-resolution precedent (MTCS-02A canonical mode).

---

## 6. Existing Runtime Baseline

```
SIGNED-URL SURFACES:            1  (src/app/api/storage/signed-url/route.ts)
PUBLIC-URL SURFACES:            0
SERVICE-ROLE SIGNING SURFACES:  1  (same route)
CLIENT-SIDE SIGNING SURFACES:   0
```

Current call sites (unchanged by this design — see §18): `src/lib/download-file.ts` (shared helper, consumed by `documents-panel.tsx`), `document-translation-section.tsx` (inline), `document-generation-section.tsx` (inline). All three render only under the staff route group `src/app/(dashboard)/cases/[id]/`.

TEST-project (`utpsqevarnxscdqzywkk`, confirmed ≠ production `slasbfepqovdsezmadjh`) read-only inspection: both provisioned buckets (`intake-documents`, `documents`) are private (`public: false`); `case-documents` (referenced in code, written to `documents.storage_bucket`'s default) is **not provisioned in TEST** — a pre-existing, unrelated inconsistency, explicitly out of scope (§24).

---

## 7. Design Principles / Invariants

**FI-01 — Identity separation**
```
documents.id  ≠  storage_bucket + file_path  ≠  signed URL
```
`documents.id` = canonical Case Document identity. `storage_bucket + file_path` = physical Storage locator. Signed URL = ephemeral access capability.

**FI-02 — Signed URL is never durable identity.** Never persisted as Document identity, Evidence identity, Historical Reliance identity, Blueprint identity, or any other durable repository identity. (Confirmed: MTCS-06 Historical Reliance persists `documents.id` only — T-10.)

**FI-03 — Authorization sequence**
```
AUTHENTICATE → RESOLVE/VERIFY RESOURCE BINDING → RESOLVE CASE + LOCATOR
            → AUTHORIZE CASE STAFF → SIGN → RETURN EPHEMERAL URL
```

**FI-04 — No pre-authorization signing.** `createSignedUrl()` never executes before binding + authorization, in any mode.

**FI-05 — Caller data is non-authoritative.** The caller may identify a requested resource but may never authoritatively dictate Case ownership, bucket, canonical locator, or authorization outcome.

**FI-06 — Fail closed.** No verified binding, or no authorization → no signed URL, ever.

---

## 8. Authorized Caller Set

```
ADMIN:            ALLOW
SUPERVISOR:        ALLOW
ASSIGNED AGENT:    ALLOW
UNASSIGNED AGENT:  DENY
CLIENT OWNER:      DENY
UNRELATED CLIENT:  DENY
UNAUTHENTICATED:   DENY
```

Authorization primitive: `authorizeCaseStaff(resolved_case_id)` — reused verbatim, unmodified, from `src/lib/auth/authorize-case-staff.ts`.

Client download entitlement: **NOT ESTABLISHED.** Zero RLS policies exist on `public.documents` or `public.clients`; zero `storage.objects` policies exist anywhere in the repository; zero Client-facing download UI exists anywhere under `src/app/client/`. `clients.profile_id = auth.uid()` establishes identity only; `documents.client_id` establishes association only — neither establishes entitlement (per direct source inspection, not inference). Client download is **OUTSIDE MTCS-07** (D07-03).

---

## 9. Canonical Mode

```
INPUT: document_id

RESOLUTION:
  documents.id → case_id → storage_bucket → file_path

RULES:
  caller case_id:            NON-AUTHORITATIVE / IGNORED
  caller file_path:          NON-AUTHORITATIVE / IGNORED
  caller storage_bucket:     NOT ACCEPTED
  unknown document_id:       404
  legacy fallback after
  unknown document_id:       PROHIBITED

AUTHORIZE: authorizeCaseStaff(documents.case_id)
SIGN:      documents.storage_bucket + documents.file_path
```

Mirrors `a2-document-processor/route.ts`'s existing MTCS-02A canonical-mode precedent exactly.

---

## 10. Legacy Mode

Legacy mode exists only because true legacy objects are demonstrated to be real and currently required (not merely tolerated):

- **Original intake documents** may exist in Storage before canonical registration completes — a real, currently-occurring, UI-surfaced state (`documents-panel.tsx`'s "Registro canónico incompleto" indicator), not a hypothetical.
- **Translations** and **generated recommendation letters / petition drafts / I-129 drafts** are **structurally** outside `public.documents` by existing, unmodified design — they are never registered into it at all.

Exactly four authoritative binding families exist. No fifth, generic fallback. No `case_id + arbitrary file_path → signed URL`. A legacy-shaped request that matches none of LB-01–LB-04 → `404`.

```
LB-01 — public.documents
LB-02 — public.intake_submissions
LB-03 — public.document_translations
LB-04 — agent_recommendation_letters / agent_petition_drafts / i129_form_drafts
```

---

## 11. LB-01 — `documents`

```
SOURCE: public.documents
UNIQUE: (case_id, storage_bucket, file_path)
        — src/lib/documents/register-canonical-document.ts:64
          (onConflict: "case_id,storage_bucket,file_path")
```

If a legacy-shaped request matches a canonical `documents` row, it is **treated as canonical** (§9) — no downgrade to generic legacy semantics.

---

## 12. LB-02 — `intake_submissions`

```
SOURCE: public.intake_submissions + extractTranslatableFiles()
```

```
case-scoped intake_submission (WHERE case_id = ?)
  → extractTranslatableFiles(submission)
  → exact requested file_path present?

YES → binding valid; resolved_case_id = authoritative Case;
      resolved_bucket = "intake-documents";
      resolved_file_path = verified file_path

NO  → no LB-02 match
```

Mirrors `src/lib/documents/reconcile-intake-documents.ts`'s existing, documented behavior: "never trusts a caller-supplied path list" — the legitimate path set is always re-derived server-side from the case-scoped `intake_submissions` row.

---

## 13. LB-03 — `document_translations`

```
SOURCE: public.document_translations
BINDING: case_id + translation_docx_path (exact match required)
```

```
no matching row → no LB-03 match (404 upstream, §20)

matching row found:
  resolved_case_id   = translation.case_id
  resolved_file_path = translation.translation_docx_path   (never original_file_path)
```

### LB-03 bucket reconstruction

```
IF translation.document_id IS NOT NULL:
    documents.id = translation.document_id
    resolved_bucket = documents.storage_bucket

ELSE:
    resolved_bucket = "intake-documents"
```

**Reason:** `document_translations.document_id` (migration 025: `ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL`) is an exact FK, populated by A2 (`src/app/api/agents/a2-document-processor/route.ts:400`, `document_id: document_id ?? null`) with the precise `document_id` A2 itself received and resolved at generation time. It is a direct pointer to A2's own generation-time resolution, not a re-derived guess.

A2's own generation-time bucket semantics (unmodified by this design):
```
default (legacy mode):    bucket = "intake-documents"
canonical mode:            bucket = canonical.storage_bucket   (resolved from the document_id A2 received)
translation upload:        storage.from(bucket)
```

The reconstruction above exactly mirrors these semantics — it is not an independent inference.

**Explicitly superseded, non-normative mechanism:** re-deriving the bucket via `documents.select(...).eq(case_id,?).eq(file_path, original_file_path)` (a two-column match) is **not** the frozen mechanism — `documents` is unique on three columns (`case_id, storage_bucket, file_path`), so a two-column re-derivation carries a theoretical ambiguity the `document_id` FK does not.

---

## 14. LB-03 FK NULL Semantics

```
CLASSIFICATION: A — impossible/prohibited by existing architecture/runtime
```

**Normative rationale** (source-verified during Final Design MR, not assumed):
- `document_translations.document_id` uses `ON DELETE SET NULL`.
- Exhaustive repository search found **zero** application-code path that deletes an individual `public.documents` row (`grep -rn '.from("documents").delete'` across `src/` → no matches) and **zero** migration containing `DELETE FROM public.documents`.
- The only mechanism that removes a `documents` row is `documents.case_id REFERENCES cases(id) ON DELETE CASCADE` — i.e., whole-Case teardown.
- `document_translations.case_id` carries the identical `ON DELETE CASCADE` from `cases` (migration 005) — so whenever a `documents` row is deleted, any `document_translations` row for the same Case is deleted in the *same* cascading operation.
- Therefore, under current runtime, no code path produces a surviving `document_translations` row whose `document_id` was independently NULLed while its bucket provenance was lost.
- The only situation that currently produces `document_id IS NULL` is the originally-intended one: A2 ran in legacy mode for that translation and never had a `document_id` to record.

**`document_id IS NULL → "intake-documents"` is therefore deterministically faithful** under existing-runtime assumptions.

**Implementation guard (binding on future work):** if future architecture introduces independent deletion of canonical `documents` rows while preserving related `document_translations` rows, this assumption must be re-reviewed before such behavior can coexist safely with this frozen design.

---

## 15. LB-04 — Generated Artifacts

```
SOURCES: agent_recommendation_letters, agent_petition_drafts, i129_form_drafts
BINDING: case_id + docx_path (exact match required)
```

Independently verified per table (not assumed from shared TypeScript interfaces): all three carry non-nullable `case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE` (migrations 002, 002, 016 respectively) and a `docx_path` column (migrations 010, 012, 016 respectively).

```
match found:
  resolved_case_id   = governing row.case_id
  resolved_bucket    = "intake-documents"
  resolved_file_path = governing row.docx_path

no match: no LB-04 match
```

Bucket confirmed via each writer's unconditionally-hardcoded `BUCKET = "intake-documents"` constant (`a4-attorney-docx-builder.ts`, `a3-institutional-docx-builder.ts`, `a3-testimonial-docx-builder.ts`, `a4-i129-form/route.ts`).

Securing this existing download path does not register these artifacts as canonical `documents` rows, does not implement Generated Work Product re-entry, and does not create Evidence from them.

---

## 16. Signed-URL Generation Contract

```
1. AUTHENTICATE
   auth.getUser()
   no authenticated user → 401

2A. CANONICAL MODE — document_id supplied
    resolve public.documents by document_id
    not found → 404
    resolved_case_id   = documents.case_id
    resolved_bucket    = documents.storage_bucket
    resolved_file_path = documents.file_path
    (caller-supplied case_id/file_path ignored; caller-supplied bucket not accepted)

2B. LEGACY-SHAPED MODE — case_id + file_path supplied
    LB-01 match  → canonical semantics (§9/§11)
    ELSE LB-02 match → §12
    ELSE LB-03 match → §13/§14
    ELSE LB-04 match → §15
    ELSE → 404

2C. Neither document_id nor case_id+file_path supplied → 400

3. AUTHORIZE
   authorizeCaseStaff(resolved_case_id)
   denied → 403

4. SIGN
   storage.from(resolved_bucket).createSignedUrl(resolved_file_path, 3600)
   Storage/signing failure → controlled server error, NO URL

5. RETURN
   { url }
```

---

## 17. Failure Contract

```
401 — unauthenticated
400 — missing/malformed supported resource identity
404 — canonical resource not found, OR no authoritative legacy binding
403 — authenticated but unauthorized Case staff principal
500 / controlled server error — Storage signing failure
```

**Prohibited, in every case:** public URL fallback, raw-path fallback, legacy fallback after an invalid `document_id`, caller-selected bucket, cross-bucket probing, unsigned-path response.

---

## 18. Threat Model / Security Closure

```
T-01  Unauthorized Case access:                          CLOSED
T-02  Arbitrary path / canonical identity confusion:      CLOSED
T-03  Service-role signing before authorization:          CLOSED
T-04  TTL excessive:                                      NOT ESTABLISHED (no source requirement exists to violate)
T-05  Public/permanent URL bypass:                        NOT PRESENT
T-06  Locator manipulation independent of canonical row:  addressed by authoritative locator/binding resolution within scope
T-07  Derivative artifact (translation/generated) bypass: CLOSED — same binding+authorization gate as originals
T-08  Unsafe fallback:                                    NOT PRESENT / PROHIBITED
T-09  Legacy mechanism inconsistent with canonical Docs:  CLOSED within this design's authoritative binding/bucket-resolution scope
T-10  Signed URL/path persisted as durable identity:      NOT PRESENT
```

### Cross-Case security invariant

```
Authorized for Case A + resource belonging only to Case B  ≠  authorization to sign Case B's resource
```

For every mode (canonical, LB-01, LB-02, LB-03, LB-04), authoritative resource binding **and** `authorizeCaseStaff(resolved_case_id)` are independently mandatory — neither substitutes for the other.

TTL: `3600` seconds, unchanged from current runtime, not caller-controllable, no established requirement to alter it.

---

## 19. Current Call-Site Compatibility

| Surface | Artifact | Binding | Bucket resolution | Required caller change |
|---|---|---|---|---|
| `documents-panel.tsx` / `download-file.ts` | original intake | LB-01 / LB-02 | canonical bucket or `intake-documents` | none |
| `document-translation-section.tsx` | translation `.docx` | LB-03 | `document_id → documents.storage_bucket`, else `intake-documents` (§14) | none |
| `document-generation-section.tsx` | letters / petitions / I-129 | LB-04 | `intake-documents` | none |

MTCS-07 does not require caller adoption to close the demonstrated security gap — route-side resolution is sufficient for all three current call-site families.

Optional, non-security cleanup (converging the two inline `handleDownload` duplicates onto the shared `downloadFile()` helper): **IO-07-01, IMPROVEMENT OPPORTUNITY, outside the frozen MCS.**

---

## 20. Minimum Change Set

**MTCS-07.1 — Authorization Before Signing**
```
authoritative binding/resolution → authorizeCaseStaff(resolved_case_id) → createSignedUrl()
```
No Client branch. No new authorization primitive.

**MTCS-07.2 — Canonical and Legacy Resource Resolution**
```
canonical document_id resolution
+ authoritative legacy binding (LB-01–LB-04)
+ authoritative bucket resolution (including LB-03's document_id-FK-based reconstruction)
```

**MTCS-07.3 — NOT REQUIRED.** No additional MCS item.

---

## 21. Acceptance Criteria

```
AC-07-01  Admin/Supervisor + authorized resource → signed URL
AC-07-02  Assigned Agent + same-Case resource → signed URL
AC-07-03  Agent assigned to Case A + canonical Document belonging to Case B → denied, no signed URL
AC-07-04  Client owner → 403
AC-07-05  Unrelated Client → 403
AC-07-06  Unauthenticated → 401
AC-07-07  document_id → server resolves authoritative case_id/storage_bucket/file_path; caller locator claims ignored
AC-07-08  case_id + file_path must match LB-01/LB-02/LB-03/LB-04 with correct family-specific bucket semantics; no match → 404; a match still requires authorizeCaseStaff()
AC-07-09  Unknown document_id → 404, no legacy fallback
AC-07-10  TTL = 3600, caller cannot modify
AC-07-11  Success response contains only the ephemeral signed URL; failure contains only a controlled error — never a raw/public locator
AC-07-12  All three existing call-site families continue without user-visible regression
AC-07-13  Translation bucket reconstruction: document_translations.document_id not null → documents[document_id].storage_bucket; document_id null → intake-documents, under the frozen LB-03 FK NULL semantics (§14)
```

---

## 22. Negative Test Matrix

```
N-01  Unauthenticated request                                   → DENY (401)
N-02  Unassigned Agent                                          → DENY (403)
N-03  Client owner                                               → DENY (403)
N-04  Unrelated Client                                            → DENY (403)
N-05  Unknown document_id                                         → 404
N-06  Case A Agent + Case B canonical document_id                 → DENY
N-07  Case A + Case B LB-02 path substitution                     → NO signed URL
N-08  Case A + Case B translation path substitution                → NO signed URL
N-09  Case A + Case B generated docx path substitution              → NO signed URL
N-10  Arbitrary path absent from all four authoritative sources     → 404
N-11  Caller bucket substitution                                    → impossible / ignored / rejected
N-12  Invalid document_id + otherwise-valid legacy path              → 404, no fallback
N-13  Translation with document_id set                              → exact canonical documents.storage_bucket
N-14  Valid legacy translation, document_id NULL                     → intake-documents
N-15  Storage signing failure                                        → no URL
```

Not executed by this act — reserved for the separately-authorized Implementation MR / TEST validation.

---

## 23. Database / Storage Delta

```
DB DELTA:             NONE
STORAGE POLICY DELTA: NONE
```

No new table, column, bucket, bucket migration, Storage policy, or authorization model. Every column/table this design reads already exists: `documents.id/case_id/storage_bucket/file_path`, `intake_submissions`, `document_translations.case_id/translation_docx_path/document_id`, `agent_recommendation_letters/agent_petition_drafts/i129_form_drafts.case_id/docx_path`, `profiles.role`, `cases.assigned_agent_id`, `clients.profile_id`.

---

## 24. Compatibility with MTCS-01–06

```
MTCS-01:   COMPATIBLE
MTCS-02A:  COMPATIBLE
MTCS-02B:  COMPATIBLE
MTCS-03:   COMPATIBLE
MTCS-04:   COMPATIBLE
MTCS-05:   COMPATIBLE
MTCS-06:   COMPATIBLE / NO REGRESSION
```

Preserved invariants: Document ≠ Evidence Item · signed URL ≠ Document · signed URL ≠ Historical Reliance · Case Evidence ≠ Governed Knowledge. No Evidence lifecycle mutation. No A1/A5 reassessment. No Blueprint regeneration. Nothing in this design touches `evidence_items`, `evidence_item_documents`, `a1_historical_reliance*`, `case_strategy.foundational_evidence`/`evidence_dependencies_reliance`, or any Historical Reliance field.

The pre-existing `case-documents`/`documents`(-bucket)/`intake-documents` naming inconsistency (TEST-provisioning finding, §6) remains unresolved and untouched — reported, not silently fixed.

---

## 25. Explicit Out-of-Scope

Client download entitlement · Client Portal download feature · Client upload repair · bucket consolidation · `case-documents` provisioning · Storage bucket migration · Storage architecture redesign · GWP re-entry · Generated Work Product canonicalization · translation architecture redesign · A2 redesign · A3 redesign · A4 redesign · Evidence V2 redesign · Blueprint locking/pinning · Human Review Gate · CV/A0/Coach · QA · Market Intelligence · A6 · Agentic RAG · RFE Prediction · Learning Engine · Organization/Multi-Tenant · AEPE promotion · AKAE/ALKA/AILA/INA · Production deployment.

---

## 26. AEPE Classification

```
CANDIDATE AEPE — NOT PROMOTED
```

Reusable pattern observed twice in this repository (A2's `document_id` resolution; this design): *Canonical Resource Identity → Server-Side Authorized Resolution → Ephemeral Access Capability.* No AEPE artifact created or modified.

---

## 27. Final Design Decisions

```
D07-01  Signed URLs require authoritative resource binding before signing.
D07-02  Case authorization uses existing authorizeCaseStaff() only.
D07-03  Client download entitlement is not established and remains outside MTCS-07.
D07-04  Canonical document_id resolves authoritative Case and Storage locator server-side.
D07-05  Legacy-shaped requests require authoritative binding through LB-01–LB-04.
D07-06  No arbitrary raw-path fallback exists.
D07-07  LB-02 and LB-04 use intake-documents.
D07-08  LB-03 uses document_translations.document_id → documents.storage_bucket when document_id is present.
D07-09  LB-03 document_id NULL uses intake-documents under the source-verified current-runtime FK-null semantics (§14).
D07-10  Signed URL TTL remains 3600 seconds.
D07-11  No DB or Storage-policy delta is required.
D07-12  Caller adoption is not required to close MTCS-07.
D07-13  No Client authorization branch is introduced.
D07-14  MTCS-07 introduces no third Document infrastructure and no canonical bucket redesign.
```

---

## Freeze Declaration

MTCS-07 — signed-URL hardening has completed Final Design Review.

```
FINAL DESIGN MR:              PASS
CORRECTIONS REQUIRED:          0
OPEN JOINT DECISIONS:          0
ARCHITECTURAL CONFLICTS:       0
LOAD-BEARING NOT VERIFIABLE:   0

EXACT DESIGN:                  APPROVED
ARCHITECTURAL STATE:           FROZEN
IMPLEMENTATION STATE:          GAP / NOT IMPLEMENTED
IMPLEMENTATION AUTHORIZATION:  NOT GRANTED
```

Any future material change to the frozen design requires explicit governed reopening before implementation.
