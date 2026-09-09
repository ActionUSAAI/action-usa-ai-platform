import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Human Approval Gate para agent_recommendation_letters. Workflow
// documentado (docs/TECHNICAL_SPEC.md): draft -> in_review -> approved
// -> sent. Este endpoint implementa únicamente draft->in_review y
// in_review->{approved,rejected} -- 'sent' queda fuera de alcance (no
// relacionado con Evidence/A1, y no fue pedido). No se permite ningún
// salto directo (ej. draft->approved).
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["in_review"],
  in_review: ["approved", "rejected"],
};

export async function GET(req: NextRequest) {
  const case_id = req.nextUrl.searchParams.get("case_id");
  if (!case_id) {
    return NextResponse.json({ error: "case_id is required" }, { status: 400 });
  }

  const db = adminDb();
  const { data, error } = await db
    .from("agent_recommendation_letters")
    .select("*")
    .eq("case_id", case_id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ letters: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  // ── 1. Verify caller auth via SSR client (cookie-based session) ──────────
  const ssrClient = createServerClient();
  const { data: { user }, error: authErr } = await ssrClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminDb();

  const { data: callerProfile, error: profileErr } = await db
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();
  if (profileErr || !callerProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  let body: { letter_id: string; status: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { letter_id, status: targetStatus } = body;
  if (!letter_id || !targetStatus) {
    return NextResponse.json({ error: "Missing required fields: letter_id, status" }, { status: 400 });
  }

  // ── 2. Fetch the letter -- must exist ─────────────────────────────────────
  const { data: letter, error: letterErr } = await db
    .from("agent_recommendation_letters")
    .select("id, case_id, status")
    .eq("id", letter_id)
    .maybeSingle();
  if (letterErr) {
    return NextResponse.json({ error: `Error fetching letter: ${letterErr.message}` }, { status: 500 });
  }
  if (!letter) {
    return NextResponse.json({ error: "Letter not found" }, { status: 404 });
  }

  // ── 3. Authorize: same pattern as the existing RLS SELECT policy for
  // this table (staff_select_agent_recommendation_letters, migration
  // 006) -- is_admin_or_supervisor() OR case assigned to this user. ────────
  const isAdminOrSupervisor = callerProfile.role === "admin" || callerProfile.role === "supervisor";
  if (!isAdminOrSupervisor) {
    const { data: caseRow, error: caseErr } = await db
      .from("cases")
      .select("assigned_agent_id")
      .eq("id", letter.case_id)
      .maybeSingle();
    if (caseErr || !caseRow || caseRow.assigned_agent_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // ── 4. Validate the transition -- never overwrite an incompatible state
  // silently (ej. draft->approved directamente, o aprobar una carta que
  // ya está approved/rejected/sent). ────────────────────────────────────────
  const allowedNext = ALLOWED_TRANSITIONS[letter.status] ?? [];
  if (!allowedNext.includes(targetStatus)) {
    return NextResponse.json(
      { error: `Invalid transition: cannot move from '${letter.status}' to '${targetStatus}'. Allowed from '${letter.status}': ${allowedNext.join(", ") || "none"}.` },
      { status: 409 }
    );
  }

  // ── 5. Apply the transition. approved_by/approved_at only on approval,
  // usando la identidad real del llamador (no confiando en el cliente). ────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = { status: targetStatus };
  if (targetStatus === "approved") {
    patch.approved_by = callerProfile.id;
    patch.approved_at = new Date().toISOString();
  }

  // Update condicionado al estado leído (evita una carrera donde dos
  // aprobaciones concurrentes pisen silenciosamente el resultado).
  const { data: updated, error: updateErr } = await db
    .from("agent_recommendation_letters")
    .update(patch)
    .eq("id", letter_id)
    .eq("status", letter.status)
    .select("*")
    .maybeSingle();
  if (updateErr) {
    return NextResponse.json({ error: `Failed to update letter: ${updateErr.message}` }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "Letter status changed concurrently -- retry." }, { status: 409 });
  }

  return NextResponse.json({ success: true, letter: updated });
}
