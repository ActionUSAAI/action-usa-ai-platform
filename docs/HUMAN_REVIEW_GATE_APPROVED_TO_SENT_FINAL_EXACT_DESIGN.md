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
Status of this document: FINAL EXACT DESIGN — TARGETED RECONCILIATION
                  INCORPORATED (D-REC-01)
Prior SHA256 (superseded): 2571ec51737ab6f097997c0feb59015d72234730c0bff4652fb7df125c499e23
Superseded by:    Targeted Final Exact Design Reconciliation
                  (D-REC-01 — corrects a load-bearing contradiction
                  between §11/§17 (sent terminal, UI action
                  disappears) and §25's GWP re-entry compatibility
                  claim, found by CR-CPS-25's Implementation
                  Authorization Gate) — this revision supersedes the
                  prior artifact in place; historical SHA preserved
                  above, per this repository's own established
                  design-correction convention (MTCS-08_FINAL_EXACT_
                  DESIGN.md §1).
```

## 2. Authority

```
CR-CPS-21   Project Owner Sequencing Decision — selected Human Review
            Gate (approved → sent) as NEXT GOVERNED GAP
CR-CPS-22   Non-Actionable Status Reconciliation — ACTIONABILITY
            ESTABLISHED, no B1/B2/B3/B4 blocker found
CR-CPS-23   MCS Materialization / Design-Entry Gate — PASS, DESIGN
            ENTRY AUTHORIZED
CR-CPS-24   Final Exact Design — APPROVED / FROZEN (original,
            SHA256 2571ec51737ab6f097997c0feb59015d72234730c0bff4652fb7df125c499e23)
CR-CPS-25   Implementation Authorization Gate — BLOCKED, IAB-07
            load-bearing design defect (D-REC-01)
THIS ACT    Targeted Final Exact Design Reconciliation — resolves
            D-REC-01 by re-deriving the data-model representation of
            "sent" from source (orthogonal metadata, not a status
            transition — §10/§11); Model A and DDR-01 unchanged; no
            new Project Owner decision required (elimination among
            candidates was deterministic — see governing act's own
            record)
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
- one new capability on agent_recommendation_letters: recording that
  an approved letter's external delivery has occurred (D-REC-01:
  represented as orthogonal metadata, not a status transition — see
  §10/§11)
- exact schema delta to record who/when
- exact API contract extension (existing endpoint)
- exact UI contract extension (existing component)
- exact authorization/concurrency/idempotency behavior
  (all reused/adapted verbatim in spirit from existing transitions)
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

## 7. Governing Invariants — RECONCILED (D-REC-01)

```
INV-01  Delivery may be recorded only when the letter's current
        status is `approved` (unchanged precondition).
INV-02  Recording delivery does NOT change `status` — it remains
        `approved` permanently thereafter (D-REC-01: replaces the
        prior "sent is terminal" framing, which was the source of
        the defect).
INV-03  Recording delivery confers no Evidence Item state, no
        automatic A1/A5/Blueprint/QA action, and — because `status`
        never changes — has NO relationship to and NO effect on
        MTCS-08 GWP re-entry eligibility, by construction rather
        than by a separately-maintained compatibility claim.
INV-04  Authorization for recording delivery is identical to every
        other existing transition on this table (no new
        authorization architecture).
INV-05  Recording delivery is a pure metadata write — AUSCIS performs
        no external dispatch, contacts no recipient, and integrates
        with no delivery channel.
INV-06  Delivery may be recorded at most once per letter (§19
        idempotency) — this is the mechanism that replaces the prior
        design's now-removed reliance on `sent` being a terminal
        status to prevent repeat actions.
```

## 8. Start Boundary

```
PERSISTED SOURCE STATE:  status = 'approved'
```

## 9. End Boundary

```
PERSISTED TARGET STATE:  status remains 'approved' (UNCHANGED by
  this action — see D-REC-01 reconciliation, §10/§11 below)
sent_by  = caller's profile id
sent_at  = server timestamp when delivery was recorded
Recording delivery is a one-time action per letter, not a status
transition (§19).
```

## 10. Canonical `sent` Semantics — RECONCILED (D-REC-01)

```
MODEL: A — status-only marker (Project Owner decision, preserved
unchanged by this reconciliation).

D-REC-01 CORRECTION: `sent` is a BUSINESS FACT — that AUSCIS staff
has confirmed the approved letter was delivered externally by some
means outside AUSCIS — recorded via `sent_by`/`sent_at` alone.
`sent` is NOT represented as a persisted `status` transition. The
`letter_status_enum` member `'sent'` remains schema-present (for
backward compatibility / no destructive migration) but is
permanently unused by this design — it is never assigned by any
code path this design authorizes.

WHY: `status` has always functioned in this repository as a single
current-lifecycle-stage field (draft/in_review/approved/rejected),
never as a compound field encoding two independent facts. No source
(Evidence Item Contract V2 §§46-49, migration history, MTCS-08's
design) requires "review stage" and "external delivery" to occupy
the same value. Separating them as orthogonal facts — "has this
letter received Human Approval for External Use" (status) and "has
delivery been confirmed" (sent_at) — preserves Human Approval as a
durable, non-revocable fact (§49) instead of allowing a later event
to silently overwrite it. AUSCIS still performs no dispatch,
contacts no recipient, and integrates with no delivery channel —
Model A is unchanged in substance.
```

## 11. State Machine — RECONCILED (D-REC-01)

```
draft
  |
  v
in_review
  |-- approved --.
  |               |  (status remains 'approved' permanently;
  |               |   delivery is recorded orthogonally via
  |               |   sent_by/sent_at — see §10, §16, §19)
  |
  `-- rejected   (terminal, unchanged)
```

No new status value is ever reached. `draft -> in_review` and
`in_review -> {approved, rejected}` are unaltered. The prior design's
`approved -> sent` status edge is REMOVED by this reconciliation and
replaced by an orthogonal delivery-recording action that leaves
`status` unchanged (see §16 API Contract, §19 Idempotency Contract).

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

## 16. API Contract — RECONCILED (D-REC-01)

```
ROUTE:          PATCH /api/case-letters   (existing endpoint, reused)
REQUEST BODY:   { letter_id: string, status: "sent" }
                (unchanged client-facing shape — "sent" remains the
                request-level trigger value for backward-compatible
                client semantics; it is NOT written to the `status`
                column — see below)
AUTHENTICATION: existing SSR session check (unmodified)
AUTHORIZATION:  existing is_admin_or_supervisor() OR
                case-assigned-agent check (unmodified)
PRECONDITION:   current letter.status === "approved"
                AND current letter.sent_at IS NULL
                (D-REC-01: the second clause replaces the prior
                design's reliance on ALLOWED_TRANSITIONS/status
                equality to prevent repeats, since `status` no
                longer changes)
TARGET ACTION:  record-delivery (a distinct handling branch inside
                the existing endpoint, keyed on the request's
                `status === "sent"` value; not a generic
                ALLOWED_TRANSITIONS status-map entry, and no entry
                is added to that map for "sent")
ON SUCCESS:     patch = { sent_by: callerProfile.id,
                sent_at: new Date().toISOString() }
                — `status` is NOT included in this patch and remains
                "approved" in the persisted row.
CONCURRENCY:    conditional update — .eq("status", "approved")
                .is("sent_at", null) — D-REC-01 replaces the prior
                single-column `.eq("status", letter.status)`
                predicate with a two-column predicate expressing the
                same "nothing changed since I read it" guarantee
                against the two columns that are now independently
                meaningful.
RESPONSES (all reuse existing exact response shapes/status codes):
  200  { letter: <updated row> }          — success (status still
                                            "approved", sent_at now
                                            populated)
  400  { error: "Missing required fields..." } — malformed body
  401  { error: "Unauthorized" }           — no session
  403  { error: "Forbidden" }              — authenticated but not
                                            authorized for this Case
  404  { error: "Letter not found" }       — letter_id doesn't exist
  409  { error: "Letter <id> is not eligible to be marked sent
        (status='<status>', sent_at='<sent_at>'); expected
        status='approved' and sent_at=null." } — wrong source status
        OR already recorded as sent (D-REC-01: new precondition
        message, same 409 mechanism/shape as every other transition)
  500  { error: "..." }                    — persistence failure
IDEMPOTENT REPLAY: a second record-delivery call against a letter
  whose sent_at is already set is rejected by the 409 path above
  (D-REC-01: this is the mechanism that replaces the prior design's
  now-invalid assumption that `status` becoming `sent` would itself
  block repeats).
EXTERNAL-ACTION FAILURE: NOT APPLICABLE (Model A performs no
  external action).
```

## 17. UI Contract — RECONCILED (D-REC-01)

```
WHERE:      LetterRow component (document-generation-section.tsx),
            in the existing status-keyed conditional block.
FOR STATUS: approved AND sent_at is null, alongside the existing
            "Subir documento devuelto" action (both render together;
            independent, non-exclusive actions). D-REC-01: because
            `status` never leaves "approved", visibility of the
            "Marcar como enviada" action is now additionally
            conditioned on `!letter.sent_at` — otherwise it would
            render forever after use.
FOR ROLES:  identical to existing action visibility — governed by
            the surrounding component's ALLOWED_ROLES gate, not
            per-action.
ACTION LABEL: "Marcar como enviada"
CONFIRMATION: none required — matches existing Aprobar/Rechazar
              buttons, which have no confirmation step.
PENDING STATE: existing `busy` (actionId === letter.id) pattern,
               reused verbatim — button disabled during the request.
SUCCESS STATE: existing refreshLetters() re-fetch pattern, reused
               verbatim.
FAILURE STATE: existing letterActionError display pattern, reused
               verbatim.
STATUS BADGE (D-REC-01, necessary consequential correction): the
  existing `LETTER_STATUS_LABEL[letter.status]` lookup is keyed by
  `status`, which never becomes `"sent"` under this reconciliation.
  Badge rendering becomes: `letter.sent_at ? "Enviada" :
  LETTER_STATUS_LABEL[letter.status]` — i.e. a populated `sent_at`
  takes rendering precedence and reuses the already-defined
  "Enviada" label/blue class, while the underlying `status` value
  driving every other piece of logic (including MTCS-08's own gate)
  remains "approved".
POST-SUCCESS RENDERING: once `sent_at` is populated, the "Marcar
  como enviada" action no longer renders for this letter (per its
  own visibility condition above). Critically — and this is the
  exact fix for D-REC-01 — the "Subir documento devuelto" action
  (MTCS-08) CONTINUES to render, because its own visibility
  condition (`letter.status === "approved"`) remains true forever;
  it was never gated on `sent_at` and requires no change.
```

## 18. Concurrency Contract — RECONCILED (D-REC-01)

```
Same spirit as every existing transition (conditional update
against the row state read at request time), applied to the two
columns now jointly relevant: `.eq("status", "approved")
.is("sent_at", null)` (§16). A stale client's record-delivery
request against a letter that has already been marked sent, moved
to rejected, or otherwise changed fails with the same 409 shape used
throughout this endpoint — no new concurrency mechanism is
introduced, only the predicate's column set changes to match the
reconciled data model.
```

## 19. Idempotency Contract — RECONCILED (D-REC-01)

```
A repeated record-delivery request after the first has already
succeeded is rejected by the 409 mechanism in §16, because `sent_at`
is no longer null on the second attempt. This directly replaces the
prior design's now-invalid reliance on `status` becoming `sent` (a
terminal value with no outgoing ALLOWED_TRANSITIONS entry) to block
repeats — `sent_at IS NULL` is the equivalent guard for the
reconciled model. No dedicated idempotency key or additional logic
beyond this precondition check is introduced.
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

## 25. GWP Re-entry Compatibility — RECONCILED (D-REC-01)

```
UNCHANGED, and now true BY CONSTRUCTION rather than by an
unenforced claim (this is the exact defect CR-CPS-25 found and this
reconciliation resolves). GWP re-entry's eligibility precondition
remains `agent_recommendation_letters.status = 'approved'` exactly
as MTCS-08 froze it, and — because recording delivery under the
reconciled model (§10/§11) never changes `status` — that precondition
remains satisfied for the lifetime of the letter, with or without
delivery having been recorded.

`src/lib/documents/register-returned-gwp.ts`'s existing eligibility
check (`letter.status !== "approved"` → INELIGIBLE) requires ZERO
modification: it already accepts exactly the one status value this
design ever produces or preserves. MTCS-08 CLASS: A — NO MTCS-08
CHANGE (§17 of the governing instruction's taxonomy) — no
compatibility patch, no contract amendment, no reopening of MTCS-08
in any form, code or contract.

Required invariant holds exactly and verifiably: a returned approved
GWP remains eligible for MTCS-08 re-entry regardless of whether
delivery has been recorded, because the only fact register-returned-
gwp.ts ever inspects (`status`) is never altered by this capability.
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

## 33. Test Requirements — RECONCILED (D-REC-01)

```
Minimum required validation (structural + live, mirroring this
repository's own established TEST-only validation pattern —
supabase/tests/*.ts against AUSCIS-TEST, never Production):
T-01  record-delivery succeeds for an authorized caller on an
      approved letter; status remains "approved" afterward
T-02  record-delivery persists sent_by/sent_at correctly
T-03  record-delivery rejected (409) from any non-approved source
      status (draft, in_review, rejected)
T-04  record-delivery rejected (403) for an unauthorized caller
T-05  repeated record-delivery against a letter whose sent_at is
      already set is rejected (409) — idempotency
T-06  concurrent stale request rejected by the reconciled
      status+sent_at conditional concurrency check
T-07  (RECONCILED — D-REC-01) GWP re-entry (MTCS-08 upload-returned-
      document, register-returned-gwp.ts) succeeds identically for
      an approved letter both BEFORE and AFTER delivery has been
      recorded — provable by construction since `status` is never
      written by this capability, and verified live by calling
      registerReturnedGeneratedWorkProduct against the same letter
      both before and after record-delivery
T-08  draft/in_review/approved/rejected transitions remain
      unaffected (regression)
```

## 34. Acceptance Criteria — RECONCILED (D-REC-01)

```
AC-01  existing draft->in_review works unchanged                 
AC-02  existing in_review->approved works unchanged               
AC-03  existing in_review->rejected works unchanged                
AC-04  (RECONCILED) delivery may be recorded only when status is
       `approved` (INV-01); status is never assigned any other
       value by this capability
AC-05  unauthorized actor cannot record delivery                  
AC-06  stale concurrent record-delivery request cannot silently
       succeed (§18)
AC-07  delivery semantics match Model A exactly (status-only
       business fact, no dispatch, no recipient, no channel)      
AC-08  persistence exactly matches §14/§15 (sent_by, sent_at only;
       `status` is never written by this capability)              
AC-09  UI exposes exactly one new action ("Marcar como enviada"),
       visible only when status === "approved" AND sent_at is null
AC-10  invalid record-delivery attempts rejected with the 409 shape
       defined in §16                                              
AC-11  Evidence states unchanged; no Evidence Item created         
AC-12  no automatic A1 invocation                                  
AC-13  no automatic A5 invocation                                  
AC-14  no automatic Blueprint regeneration                         
AC-15  no automatic QA invocation                                  
AC-16  MTCS-08's `approved` GWP re-entry boundary unchanged        
AC-17  (RECONCILED — was DESIGN CONFLICT under the prior artifact)
       a returned approved GWP remains re-entry-compatible
       regardless of whether delivery has been recorded — TRUE BY
       CONSTRUCTION because `status` is never altered by this
       capability (§25); verified live by T-07
AC-18  AKAE unchanged                                               
AC-19  AEPE unchanged                                               
AC-20  Production untouched throughout design and any future
       implementation authorized separately                        
AC-21  (RECONCILED) recording delivery is a one-time action per
       letter — not a status transition, and therefore has no
       terminal-state concept to preserve; §19's sent_at-null
       precondition is the sole mechanism preventing repeats
AC-22  repeated record-delivery against a letter whose sent_at is
       already set is rejected via the 409 mechanism (idempotency,
       §19)
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
determined by source, compatibility default, the Project Owner's
DDR-01 decision (Model A), or this reconciliation's deterministic
elimination among R1/R2/R3 (D-REC-01, no new Project Owner decision
required). No TBD/TODO/UNKNOWN remains. D-REC-01 is RESOLVED.
```

## 38. Final Design Status

```
FINAL EXACT DESIGN: APPROVED / FROZEN — RECONCILED (D-REC-01)
```
