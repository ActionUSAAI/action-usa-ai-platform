import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendCoachTurn,
  type CoachProfileContext,
  type CoachFields,
  type BoundedEmploymentContext,
  type NextProfessionalTopic,
} from "@/lib/intake/coach";
import {
  extractCoachProfessionalIntelligence,
  type CoachProfessionalExtractionInput,
  type ProfessionalIntelligenceCoachResult,
} from "@/lib/intake/coach-professional-extraction";

// Coach -- integrated AUSCIS Stage 1 conversational discovery capability
// (AUSCIS Intake Intelligence Layer, CR-CPS-34/35, design §5.1). Stateless
// per-call: the client sends the full conversation history each turn
// (same client-held-draft pattern as every other Stage 1/Intake piece --
// see src/app/api/intake/a0-extract/route.ts's header for the rationale).
// Mandatory (design §5.1/§5.2): never bypassed regardless of CV source.
//
// Authority firewall (design §5.1, P-14 "Coach ≠ Research/RAG"): Coach
// discovers and probes only. It never adjudicates criteria, verifies
// Evidence, determines eligibility, or sets strategy. Facts it surfaces
// land in acquired_unconfirmed on the client (never beneficiary_confirmed
// or Verified) until the beneficiary reviews them (design §5.7).
//
// Conversation logic itself lives in src/lib/intake/coach.ts
// (framework-agnostic, directly testable).
//
// PI-D1B: an independent, parallel, optional/nonblocking second
// extraction call (src/lib/intake/coach-professional-extraction.ts,
// PI-D1A, untouched) runs alongside the normal Coach call via
// Promise.allSettled -- never Promise.all, never serialized -- so a
// professional-extraction failure can never affect the normal Coach
// call's own success/failure contract, which remains fully preserved
// and remains the sole authority over this route's HTTP status. The
// optional `professionalContext` request field is purely transient
// application/server routing context (never persisted, never sent to
// the normal Coach call, never model-visible as a candidate identifier)
// -- it is distinct from PI-D1C's own `boundedEmploymentContexts`
// request field (normal-Coach conversational guidance only, never sent
// to the D1A extraction call) and from the Coach-returned next-turn
// topic-intent signal (routing metadata only -- carries no candidateId,
// resolves no alias to any Candidate, and binds nothing). Transient
// client-runtime ownership of that signal (questionContext, rotation,
// same-turn discovery binding, checkpoint integration) remains a later
// slice (PI-D1D).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Conservative, route-local validator -- malformed/absent input yields
// `undefined` (treated as no context at all), mirroring this route's own
// existing established convention for every other optional structured
// field (profileContext/history above: a plain cast + `?? undefined`/`?? []`
// fallback, never a 400 for a malformed optional field). Identity strings
// are checked for type only, never required non-blank (partial Employment
// identity is already a first-class, supported shape elsewhere in this
// architecture) -- only candidateId must be a non-blank string, since an
// empty candidateId could never resolve to any real application target.
function parseProfessionalContext(value: unknown): CoachProfessionalExtractionInput["activeContext"] {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (v.domain !== "employment") return undefined;
  const candidateId = typeof v.candidateId === "string" ? v.candidateId.trim() : "";
  if (!candidateId) return undefined;
  if (typeof v.identity !== "object" || v.identity === null) return undefined;
  const i = v.identity as Record<string, unknown>;
  if (typeof i.company !== "string" || typeof i.title !== "string" || typeof i.startDate !== "string" || typeof i.endDate !== "string") return undefined;
  return { domain: "employment", candidateId, identity: { company: i.company, title: i.title, startDate: i.startDate, endDate: i.endDate } };
}

// PI-D1C -- separate, additive, route-local validator for the normal-
// Coach-guidance bounded contexts (distinct purpose from
// parseProfessionalContext above: this governs what Coach may discuss
// next, never what D1A may enrich now -- PI-D1C §5/§33 separation,
// frozen). Malformed entries are dropped individually rather than
// rejecting the whole optional field -- a non-array value yields an
// empty list; duplicate aliases keep only the first occurrence; more
// than three valid entries are truncated to the first three -- all
// consistent with this route's own established "malformed optional
// field degrades gracefully, never breaks the request" convention
// (parseProfessionalContext above; PI-D1B). No candidateId field exists
// on this type at all, so there is nothing to strip -- the firewall is
// structural, not a runtime check.
function parseBoundedEmploymentContexts(value: unknown): BoundedEmploymentContext[] {
  if (!Array.isArray(value)) return [];
  const seenAliases = new Set<string>();
  const result: BoundedEmploymentContext[] = [];
  for (const item of value) {
    if (result.length >= 3) break;
    if (typeof item !== "object" || item === null) continue;
    const v = item as Record<string, unknown>;
    const alias = v.alias;
    if (alias !== "P1" && alias !== "P2" && alias !== "P3") continue;
    if (seenAliases.has(alias)) continue;
    if (typeof v.identity !== "object" || v.identity === null) continue;
    const i = v.identity as Record<string, unknown>;
    if (typeof i.company !== "string" || typeof i.title !== "string" || typeof i.startDate !== "string" || typeof i.endDate !== "string") continue;
    seenAliases.add(alias);
    result.push({ alias, identity: { company: i.company, title: i.title, startDate: i.startDate, endDate: i.endDate } });
  }
  return result;
}

// PI-D1B orchestration core -- kept unexported (Next.js's App Router
// route-module type validation statically rejects any named export from
// route.ts other than the recognized HTTP-verb handlers/config, confirmed
// via `tsc --noEmit` during this implementation), but factored into its
// own function for the same separation-of-concerns reason this file
// already follows elsewhere (HTTP/auth stays in POST(), conversation
// logic stays framework-agnostic) and so POST()'s own body stays
// readable. The two Anthropic calls are launched together via
// Promise.allSettled; the normal Coach call alone decides this
// function's own success/failure (it re-throws on Coach rejection,
// letting POST()'s existing, unmodified catch block produce the exact
// same error response shape it already produced before PI-D1B) --
// professionalResult is consulted only when coachResult fulfilled, and
// is included only when it also fulfilled, with no distinction drawn
// between "PI legitimately found nothing" and "PI returned an empty
// result" -- both simply attach the (possibly all-empty) result object.
async function runCoachTurnWithProfessionalExtraction(
  history: Parameters<typeof sendCoachTurn>[0],
  message: string,
  apiKey: string,
  profileContext: CoachProfileContext | undefined,
  professionalContext: CoachProfessionalExtractionInput["activeContext"],
  boundedEmploymentContexts: readonly BoundedEmploymentContext[]
): Promise<{ reply: string; fields: CoachFields; nextProfessionalTopic: NextProfessionalTopic; professionalIntelligence?: ProfessionalIntelligenceCoachResult }> {
  // PI-D1C: boundedEmploymentContexts is forwarded ONLY to the normal
  // Coach call (next-conversational-topic guidance) -- it is never part
  // of the D1A extraction input, which remains exactly
  // {currentMessage, activeContext?} (PI-D1C §30/§31, frozen D1A
  // boundary, unmodified call below).
  const [coachResult, professionalResult] = await Promise.allSettled([
    sendCoachTurn(history, message, apiKey, profileContext, boundedEmploymentContexts),
    extractCoachProfessionalIntelligence(
      { currentMessage: message, ...(professionalContext ? { activeContext: professionalContext } : {}) },
      apiKey
    ),
  ]);

  if (coachResult.status === "rejected") throw coachResult.reason;

  const base = {
    reply: coachResult.value.reply,
    fields: coachResult.value.fields,
    nextProfessionalTopic: coachResult.value.nextProfessionalTopic,
  };
  if (professionalResult.status !== "fulfilled") return base;
  return { ...base, professionalIntelligence: professionalResult.value };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = (body.token as string | null)?.trim() ?? "";
    const history = (body.history as { role: "user" | "assistant"; content: string }[] | null) ?? [];
    const message = (body.message as string | null)?.trim() ?? "";
    // CR-CPS-57 §7: data-minimized Structured Profile context, already
    // minimized client-side (minimizedProfileContext()) before it ever
    // reaches this route -- passed through unmodified, never enriched
    // with any server-side case/Evidence/A1/A5 data.
    const profileContext = (body.profileContext as CoachProfileContext | null) ?? undefined;
    // PI-D1B: transient application/server extraction-routing context
    // only -- never persisted, never sent to the normal Coach call below.
    const professionalContext = parseProfessionalContext(body.professionalContext);
    // PI-D1C: transient normal-Coach guidance only -- never persisted,
    // never sent to the D1A extraction call below. Separate purpose from
    // professionalContext above (PI-D1C §5/§33).
    const boundedEmploymentContexts = parseBoundedEmploymentContexts(body.boundedEmploymentContexts);

    if (!token) return NextResponse.json({ error: "Falta el token de invitación." }, { status: 401 });
    if (!message) return NextResponse.json({ error: "Falta el mensaje." }, { status: 400 });

    const db = adminDb();
    const now = new Date().toISOString();
    const { data: invitation } = await db
      .from("intake_invitations")
      .select("id")
      .eq("token", token)
      .in("status", ["pending", "opened"])
      .gt("expires_at", now)
      .maybeSingle();
    if (!invitation) {
      return NextResponse.json({ error: "Invitación inválida o expirada." }, { status: 403 });
    }

    const result = await runCoachTurnWithProfessionalExtraction(history, message, ANTHROPIC_KEY, profileContext, professionalContext, boundedEmploymentContexts);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
