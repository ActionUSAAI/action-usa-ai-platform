# Human Review Gate — Approved-to-Sent Transition — Final Exact Design

## 1. Identification

```
Capability:       Human Review Gate — Approved-to-Sent Transition
Domain:           AUSCIS
MCS Identifier:   NOT ESTABLISHED (UNNUMBERED — per QA Engine's own
                  precedent, CR-CPS-13: no standing rule of automatic
                  sequential MTCS assignment upon materialization or
                  design)
MTCS Identifier:  NOT ESTABLISHED — requires a separate, explicit,
                  act-specific Project Owner grant
```

## 2. Authority

```
CR-CPS-21   Project Owner Sequencing Decision — selected Human Review
            Gate (approved → sent) as NEXT GOVERNED GAP
CR-CPS-22   Non-Actionable Status Reconciliation — ACTIONABILITY
            ESTABLISHED, no B1/B2/B3/B4 blocker found
CR-CPS-23   MCS Materialization / Design-Entry Gate — PASS, DESIGN
            ENTRY AUTHORIZED
THIS ACT    Final Exact Design — Project Owner decision (Model A,
            status-only) supplied for DDR-01; all other design
            surfaces resolved from source/compatibility default
```

## 3. Problem Statement

The Human Review Gate implements a governed `draft → in_review →
approved/rejected` lifecycle for A3-generated recommendation letters
(`agent_recommendation_letters`). The schema has recognized a `sent`
status value since project inception, but the governed runtime never
exposes or executes an `approved → sent` transition. The Project
Owner has requested this capability (CR-CPS-21) and resolved its
central open semantic question (below) as: `sent` is a status-only
marker recorded by AUSCIS staff after the letter has been delivered
externally by some means outside AUSCIS — consistent with MTCS-08's
own established treatment of a Generated Work Product's actual
external delivery as a real-world, staff-mediated event occurring
outside the system.

## 4. Current-State Baseline

```
agent_recommendation_letters (migration 002/010/011/014):
  id, run_id, case_id, recommender_name, recommender_title,
  recommender_org, recommender_tier, relationship_type,
  criterion_covered, letter_draft, letter_version,
  status letter_status_enum NOT NULL DEFAULT 'draft',
  admin_notes, approved_by, approved_at, previous_version_id,
  created_at, updated_at
letter_status_enum: draft | in_review | approved | rejected | sent
  (migration 002 — 'sent' already present, never reachable)

Working transitions (src/app/api/case-letters/route.ts,
ALLOWED_TRANSITIONS):
  draft      -> in_review
  in_review  -> approved | rejected

Authorization (identical for every existing transition):
  is_admin_or_supervisor() OR cases.assigned_agent_id = caller
  (mirrors migration 006's staff_select_agent_recommendation_letters
  RLS policy; writes use adminDb/service-role, so this check is
  enforced in application code, not RLS)

Concurrency: conditional update — .eq("status", letter.status) —
  a stale client cannot silently overwrite a status that has already
  changed.

UI (src/app/(dashboard)/cases/[id]/document-generation-section.tsx,
  LetterRow): one conditional action per status. `approved` currently
  renders only "Subir documento devuelto" (MTCS-08 upload-returned-
  document action) plus the universal "Descargar" action.
  LETTER_STATUS_LABEL/CLASS already define `sent: "Enviada"` /
  blue badge — cosmetic only, no action path exists.

MTCS-08 (approved GWP -> returned document -> new Case Document):
  triggers directly off `status === "approved"`, via a separate
  upload endpoint, independent of any `sent` state. Unaffected by
  this design.
```

## 5. Scope

```
IN SCOPE:
- one new transition, approved -> sent, on
  agent_recommendation_letters
- exact schema delta to record who/when
- exact API contract extension (existing endpoint)
- exact UI contract extension (existing component)
- exact authorization/concurrency/idempotency behavior
  (all reused verbatim from existing transitions)
```

## 6. Out of Scope

```
- dispatch mechanics of any kind (Model A: status-only, no AUSCIS
  action delivers anything)
- recipient identity, channel, or delivery infrastructure
- email/notification integration (Resend or otherwise)
- reversing `sent` back to any prior status
- any relationship to External Return / MTCS-08 GWP re-entry beyond
  what already exists (none)
- any Evidence Item, A1, A5, Blueprint, QA, AKAE, or AEPE behavior
- Production deployment
- implementation of any kind (this document is design only)
```

## 7. Governing Invariants

```
INV-01  A letter may transition to `sent` only from `approved`.
INV-02  `sent` is terminal — no transition originates from `sent`.
INV-03  `sent` confers no Evidence Item state, no automatic A1/A5/
        Blueprint/QA action, and no relationship to MTCS-08 GWP
        re-entry (approved remains GWP re-entry's sole gate,
        unaffected by whether the letter has separately been marked
        sent).
INV-04  Authorization for approved -> sent is identical to every
        other existing transition on this table (no new
        authorization architecture).
INV-05  The transition is a pure status-only write — AUSCIS performs
        no external dispatch, contacts no recipient, and integrates
        with no delivery channel.
```

## 8. Start Boundary

```
PERSISTED SOURCE STATE:  status = 'approved'
```

## 9. End Boundary

```
PERSISTED TARGET STATE:  status = 'sent'
sent_by  = caller's profile id
sent_at  = server timestamp at transition
No further governed transition exists from `sent` (INV-02).
```

## 10. Canonical `sent` Semantics

```
MODEL: A — status-only marker (Project Owner decision, this act).
`sent` records that AUSCIS staff has confirmed the approved letter
was delivered externally by some means outside AUSCIS. AUSCIS does
not perform, verify, or track the delivery itself.
```

## 11. State Machine

```
draft
  |
  v
in_review
  |-- approved --.
  |               \
  |                v
  |              sent   (terminal)
  |
  `-- rejected   (terminal, unchanged)
```

Only `approved -> sent` is added. No other edge is created, removed,
or altered.

## 12. Actor Model

```
Initiating actor: authenticated AUSCIS staff (admin, supervisor, or
  the Case's assigned agent) — identical actor class to every
  existing transition on this table. No external actor is involved
  (Model A performs no dispatch).
```

## 13. Authorization Model

```
Reused verbatim, zero new logic:
  is_admin_or_supervisor() OR cases.assigned_agent_id = caller.uid()
No broader or narrower rule applies to `sent` specifically.
```

## 14. Data Model

```
New columns on agent_recommendation_letters:
  sent_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL
  sent_at   TIMESTAMPTZ

Mirrors approved_by/approved_at exactly in shape and nullability
(both NULL until the transition occurs; ON DELETE SET NULL matches
approved_by's own existing FK behavior).
```

## 15. Persistence Delta

```
DATABASE DELTA: EXACT, ADDITIVE ONLY

ALTER TABLE public.agent_recommendation_letters
  ADD COLUMN sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN sent_at TIMESTAMPTZ;

No index, trigger, RLS, or constraint change required. No existing
row's data is affected (both columns nullable, default NULL). The
existing trg_letters_updated_at (updated_at) trigger fires normally,
unmodified.
```

## 16. API Contract

```
ROUTE:          PATCH /api/case-letters   (existing endpoint, reused)
REQUEST BODY:   { letter_id: string, status: "sent" }
                (identical shape to existing approved/rejected calls)
AUTHENTICATION: existing SSR session check (unmodified)
AUTHORIZATION:  existing is_admin_or_supervisor() OR
                case-assigned-agent check (unmodified)
PRECONDITION:   current letter.status === "approved"
ALLOWED_TRANSITIONS DELTA:
  approved: ["sent"]   (added; approved currently maps to [])
TARGET STATUS:  "sent"
ON SUCCESS:     patch = { status: "sent", sent_by: callerProfile.id,
                sent_at: new Date().toISOString() }
                (mirrors the existing approved_by/approved_at branch
                exactly, applied when targetStatus === "sent")
CONCURRENCY:    existing conditional .eq("status", letter.status)
                update — unmodified, applies automatically to this
                transition
RESPONSES (all reuse existing exact response shapes/status codes):
  200  { letter: <updated row> }          — success
  400  { error: "Missing required fields..." } — malformed body
  401  { error: "Unauthorized" }           — no session
  403  { error: "Forbidden" }              — authenticated but not
                                            authorized for this Case
  404  { error: "Letter not found" }       — letter_id doesn't exist
  409  { error: "Invalid transition: cannot move from '<status>' to
        'sent'. Allowed from '<status>': ..." } — wrong source status,
        including a repeat call against an already-`sent` letter
        (idempotent-safe rejection, no new logic required)
  500  { error: "..." }                    — persistence failure
IDEMPOTENT REPLAY: a second approved->sent call against an
  already-`sent` letter is rejected by the existing 409 path (source
  status no longer `approved`) — no special-case code needed.
EXTERNAL-ACTION FAILURE: NOT APPLICABLE (Model A performs no
  external action).
```

## 17. UI Contract

```
WHERE:      LetterRow component (document-generation-section.tsx),
            same conditional-per-status block used by every other
            status.
FOR STATUS: approved only, alongside the existing "Subir documento
            devuelto" action (both render together; independent,
            non-exclusive actions).
FOR ROLES:  identical to existing action visibility — governed by
            the surrounding component's ALLOWED_ROLES gate, not
            per-action.
ACTION LABEL: "Marcar como enviada"
CONFIRMATION: none required — matches existing Aprobar/Rechazar
              buttons, which have no confirmation step.
PENDING STATE: existing `busy` (actionId === letter.id) pattern,
               reused verbatim — button disabled during the request.
SUCCESS STATE: existing refreshLetters() re-fetch pattern, reused
               verbatim — status badge updates to "Enviada" (label
               already defined) automatically on refresh.
FAILURE STATE: existing letterActionError display pattern, reused
               verbatim.
POST-SUCCESS RENDERING: once status === "sent", no further action
  renders for this letter in LetterRow (no case matches "sent" in
  the conditional block) except the universal "Descargar" action —
  consistent with `rejected`, which similarly renders no status
  action once terminal.
```

## 18. Concurrency Contract

```
Identical to every existing transition: conditional update against
the status value read at request time. A stale client's approved->
sent request against a letter already moved elsewhere (e.g. by
another admin) fails with the existing 409 Invalid-transition
response — no new concurrency mechanism required.
```

## 19. Idempotency Contract

```
A repeated approved->sent request after the first has already
succeeded is rejected by the existing ALLOWED_TRANSITIONS/409
mechanism (source status is now `sent`, which has no outgoing
transitions). No dedicated idempotency key or additional logic is
introduced.
```

## 20. Failure Contract

```
All failure modes are identical in shape to every existing
transition on this endpoint (400/401/403/404/409/500, see §16).
No new failure category exists because Model A performs no external
action.
```

## 21. Retry Contract

```
Client-side retry of a failed request is safe: on true failure
(5xx) the status was not persisted, so retrying repeats the same
precondition check; on 409 (already sent, or status changed) retry
correctly fails again. No server-side retry logic is introduced.
```

## 22. Audit / Provenance Contract

```
sent_by + sent_at (§14/§15) provide actor+timestamp provenance,
mirroring approved_by/approved_at exactly. The existing generic
updated_at trigger additionally captures the row's last-modified
timestamp, as it already does for every other transition. No new
audit-log table or mechanism is introduced.
```

## 23. Dispatch / Delivery Contract

```
NOT APPLICABLE — Model A (status-only) performs no dispatch or
delivery of any kind. AUSCIS records only that staff has confirmed
external delivery occurred; AUSCIS does not execute, verify, or
track that delivery.
```

## 24. Recipient / Channel Contract

```
NOT APPLICABLE — no recipient identity or delivery channel exists
in this design, consistent with Model A and with MTCS-08's own
treatment of external delivery as occurring entirely outside
AUSCIS.
```

## 25. GWP Re-entry Compatibility

```
UNCHANGED. GWP re-entry's eligibility precondition remains
`agent_recommendation_letters.status = 'approved'` exactly as
MTCS-08 froze it. A letter's later transition to `sent` does not
remove, gate, or otherwise interact with GWP re-entry eligibility —
the upload-returned-document action already triggers directly off
`status === "approved"`, and continues to do so regardless of
whether the letter is later also marked `sent`. Required invariant
(§45 of the governing instruction) holds: a returned approved GWP
remains eligible for MTCS-08 re-entry regardless of whether `sent`
has been recorded.
```

## 26. Evidence V2 Boundary

```
Transition to `sent` does NOT: create an Evidence Item; change any
Documentary or Verification Condition; confer Verified, Needs
Attention, or Documented; trigger Evidence composition; trigger A1
reassessment; trigger A5; or regenerate the Case Blueprint.
```

## 27. A1 / A5 / Blueprint Boundary

```
No automatic A1 reassessment, A5 rerun, Blueprint regeneration, or
Evidence selection occurs as a result of this transition.
```

## 28. QA Boundary

```
QA Engine remains CLOSED and unmodified. No automatic QA invocation,
no QA schema change, no QA design change results from this
capability.
```

## 29. AKAE / AEPE Boundary

```
This is an AUSCIS-scoped operational capability. No AKAE mutation.
No AEPE promotion. CANDIDATE AEPE — NOT PROMOTED (no reusable
pattern is asserted as generalizable here beyond what already exists
for approved_by/approved_at).
```

## 30. Security Invariants

```
Least privilege preserved: authorization is neither broadened nor
narrowed relative to the existing approve/reject transitions on
this exact table (§13). No new data is exposed. No new write surface
beyond the two additive nullable columns.
```

## 31. Compatibility Requirements

```
Zero modification to draft->in_review, in_review->approved, or
in_review->rejected behavior. Zero modification to MTCS-08's
upload-returned-document path. Zero modification to any RLS policy
(existing SELECT-only policy already covers the new columns as part
of `SELECT *`/row visibility; writes remain service-role, as for
every other transition on this table).
```

## 32. Migration Requirements

```
One additive migration: ALTER TABLE public.agent_recommendation_letters
ADD COLUMN sent_by ... , ADD COLUMN sent_at ... (§15, exact SQL
given). No other migration required. No backfill required (both
columns nullable, no existing row requires a value).
```

## 33. Test Requirements

```
Minimum required validation (structural + live, mirroring this
repository's own established TEST-only validation pattern —
supabase/tests/*.ts against AUSCIS-TEST, never Production):
T-01  approved -> sent succeeds for an authorized caller
T-02  approved -> sent persists sent_by/sent_at correctly
T-03  approved -> sent rejected (409) from any non-approved source
      status (draft, in_review, rejected)
T-04  approved -> sent rejected (403) for an unauthorized caller
T-05  repeated approved -> sent against an already-sent letter is
      rejected (409) — idempotency
T-06  concurrent stale request rejected by existing optimistic
      concurrency check
T-07  GWP re-entry (MTCS-08 upload-returned-document) remains
      functional for an approved letter regardless of sent state
T-08  draft/in_review/approved/rejected transitions remain
      unaffected (regression)
```

## 34. Acceptance Criteria

```
AC-01  existing draft->in_review works unchanged                 
AC-02  existing in_review->approved works unchanged               
AC-03  existing in_review->rejected works unchanged                
AC-04  only `approved` may transition to `sent` (INV-01)          
AC-05  unauthorized actor cannot transition to `sent`             
AC-06  stale concurrent transition cannot silently succeed        
AC-07  `sent` semantics match Model A exactly (status-only, no
       dispatch, no recipient, no channel)                        
AC-08  persistence exactly matches §14/§15 (sent_by, sent_at only) 
AC-09  UI exposes exactly one new action ("Marcar como enviada"),
       visible only when status === "approved"                    
AC-10  invalid transitions rejected with the existing 409 shape    
AC-11  Evidence states unchanged; no Evidence Item created         
AC-12  no automatic A1 invocation                                  
AC-13  no automatic A5 invocation                                  
AC-14  no automatic Blueprint regeneration                         
AC-15  no automatic QA invocation                                  
AC-16  MTCS-08's `approved` GWP re-entry boundary unchanged        
AC-17  returned approved GWP remains re-entry-compatible
       regardless of sent state                                    
AC-18  AKAE unchanged                                               
AC-19  AEPE unchanged                                               
AC-20  Production untouched throughout design and any future
       implementation authorized separately                        
AC-21  `sent` is terminal — no transition originates from `sent`   
AC-22  repeated approved->sent against an already-sent letter is
       rejected via the existing 409 mechanism (idempotency)       
```

## 35. Implementation Boundary

```
This document authorizes DESIGN ONLY. Implementation (migration,
API change, UI change, tests) requires a separate, later
Implementation Authorization Gate. No code, migration, or test is
created by this act.
```

## 36. Production Boundary

```
PRODUCTION: HARD-DENIED throughout design and remains so until a
separately authorized implementation is deployed through this
repository's own TEST-first discipline (AUSCIS-TEST,
utpsqevarnxscdqzywkk, never slasbfepqovdsezmadjh, without explicit
separate authorization).
```

## 37. Open Questions

```
NONE LOAD-BEARING. All design surfaces in §§10-34 are fully
determined by source, compatibility default, or the Project Owner's
DDR-01 decision (Model A). No TBD/TODO/UNKNOWN remains.
```

## 38. Final Design Status

```
FINAL EXACT DESIGN: APPROVED / FROZEN
```
