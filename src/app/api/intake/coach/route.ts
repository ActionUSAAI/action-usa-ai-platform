import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCoachTurn } from "@/lib/intake/coach";

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = (body.token as string | null)?.trim() ?? "";
    const history = (body.history as { role: "user" | "assistant"; content: string }[] | null) ?? [];
    const message = (body.message as string | null)?.trim() ?? "";

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

    const { reply, fields } = await sendCoachTurn(history, message, ANTHROPIC_KEY);
    return NextResponse.json({ reply, fields });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
