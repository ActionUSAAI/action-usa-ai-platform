import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { evaluateReadiness } from "@/lib/intake/readiness";

// AUSCIS Intake Intelligence Layer -- exception-resolution / readiness
// recheck surface (R-02, CR-CPS-37/38). No longer the universal
// approval gate: a clean Intake already transitions to 'complete'
// automatically at submission (src/app/api/intake/route.ts). This
// route exists for staff to re-run the exact same deterministic
// readiness function -- never a separate/looser check -- after
// resolving an informational exception (e.g. clarifying a conflict),
// reusing the same admin/supervisor-or-assigned-agent authorization
// pattern already established in src/app/api/case-letters/route.ts.

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

  // Same shared deterministic function the automatic post-submission
  // trigger uses -- no separate/looser staff-only readiness logic.
  // coach_conversation shape: { turns, acknowledged } (CR-CPS-40 D-2).
  const readiness = evaluateReadiness(
    (submission.module1 ?? {}) as Record<string, string>,
    (submission.coach_conversation ?? { turns: [], acknowledged: false }) as { turns: unknown[]; acknowledged: boolean },
    (submission.structured_profile ?? {}) as Record<string, { status?: string }>
  );

  if (readiness.status === "NEEDS_ATTENTION") {
    return NextResponse.json({ success: false, status: "NEEDS_ATTENTION", reasons: readiness.reasons }, { status: 200 });
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

  return NextResponse.json({ success: true, status: "READY", submission: updated });
}
