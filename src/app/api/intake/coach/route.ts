import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCoachTurn, type CoachProfileContext, type CoachFields } from "@/lib/intake/coach";
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
// -- it is NOT the future bounded Coach-guidance list, NOT a next-turn
// topic-intent signal returned by Coach, and NOT rotation state; those
// remain later slices (PI-D1C/PI-D1D).

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
  professionalContext: CoachProfessionalExtractionInput["activeContext"]
): Promise<{ reply: string; fields: CoachFields; professionalIntelligence?: ProfessionalIntelligenceCoachResult }> {
  const [coachResult, professionalResult] = await Promise.allSettled([
    sendCoachTurn(history, message, apiKey, profileContext),
    extractCoachProfessionalIntelligence(
      { currentMessage: message, ...(professionalContext ? { activeContext: professionalContext } : {}) },
      apiKey
    ),
  ]);

  if (coachResult.status === "rejected") throw coachResult.reason;

  const base = { reply: coachResult.value.reply, fields: coachResult.value.fields };
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

    const result = await runCoachTurnWithProfessionalExtraction(history, message, ANTHROPIC_KEY, profileContext, professionalContext);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
