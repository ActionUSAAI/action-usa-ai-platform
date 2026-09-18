import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

// AUSCIS Intake Intelligence Layer -- Intake Complete transition
// (CR-CPS-34/35, design §5.8). Staff-triggered (Action USA Staff Review,
// design §5.7 -- occurs after beneficiary review). Reuses the same
// admin/supervisor-or-assigned-agent authorization pattern already
// established in src/app/api/case-letters/route.ts.
//
// Form completeness ≠ information acquisition completeness (design
// §5.8): this route enforces the CR-CPS-34 prerequisites that are
// implementation-determinable -- required identity fields present,
// Coach discovery occurred, no unresolved conflicting field -- rather
// than merely checking that UI fields are non-empty.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: NextRequest) {
  const ssrClient = createServerClient();
  const { data: { user }, error: authErr } = await ssrClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminDb();
  const { data: callerProfile, error: profileErr } = await db
    .from("profiles").select("id, role").eq("id", user.id).single();
  if (profileErr || !callerProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  let body: { case_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.case_id) {
    return NextResponse.json({ error: "Missing required field: case_id" }, { status: 400 });
  }

  const isAdminOrSupervisor = callerProfile.role === "admin" || callerProfile.role === "supervisor";
  if (!isAdminOrSupervisor) {
    const { data: caseRow, error: caseErr } = await db
      .from("cases").select("assigned_agent_id").eq("id", body.case_id).maybeSingle();
    if (caseErr || !caseRow || caseRow.assigned_agent_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: submission, error: subErr } = await db
    .from("intake_submissions")
    .select("id, status, module1, structured_profile, coach_conversation")
    .eq("case_id", body.case_id)
    .maybeSingle();
  if (subErr) {
    return NextResponse.json({ error: `Error fetching submission: ${subErr.message}` }, { status: 500 });
  }
  if (!submission) {
    return NextResponse.json({ error: "No intake submission found for this case." }, { status: 404 });
  }
  if (submission.status === "complete") {
    return NextResponse.json({ error: "Intake ya está marcado como completo." }, { status: 409 });
  }

  // Form completeness ≠ acquisition completeness (design §5.8/§16 of
  // the implementation act) -- enforce implementation-determinable
  // CR-CPS-34 prerequisites, not just non-empty UI fields.
  const m1 = (submission.module1 ?? {}) as Record<string, string>;
  const missingIdentity: string[] = [];
  for (const f of ["fullName", "email", "whatsapp", "profession"]) {
    if (!m1[f] || !String(m1[f]).trim()) missingIdentity.push(f);
  }
  if (missingIdentity.length > 0) {
    return NextResponse.json({ error: `Intake incompleto: faltan campos de identidad requeridos (${missingIdentity.join(", ")}).` }, { status: 409 });
  }

  const coachConversation = (submission.coach_conversation ?? []) as unknown[];
  if (coachConversation.length === 0) {
    return NextResponse.json({ error: "Intake incompleto: el beneficiario no completó la conversación con el Coach." }, { status: 409 });
  }

  const structuredProfile = (submission.structured_profile ?? {}) as Record<string, { status?: string }>;
  const hasConflict = Object.values(structuredProfile).some(f => f.status === "conflicting");
  if (hasConflict) {
    return NextResponse.json({ error: "Intake incompleto: hay información en conflicto sin resolver en el Perfil Estructurado." }, { status: 409 });
  }

  const { data: updated, error: updateErr } = await db
    .from("intake_submissions")
    .update({ status: "complete" })
    .eq("id", submission.id)
    .eq("status", submission.status)
    .select("*")
    .maybeSingle();
  if (updateErr) {
    return NextResponse.json({ error: `Failed to update: ${updateErr.message}` }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "El estado del intake cambió concurrentemente -- reintenta." }, { status: 409 });
  }

  return NextResponse.json({ success: true, submission: updated });
}
