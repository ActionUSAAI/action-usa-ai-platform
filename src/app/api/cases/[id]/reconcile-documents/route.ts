import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { reconcileCanonicalIntakeDocuments } from "@/lib/documents/reconcile-intake-documents";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Explicit, authorized canonical-document reconciliation (MTCS-02B Recovery,
// CRR-01). Accepts only the Case id from the URL — the missing-registration
// set is always recomputed server-side from intake_submissions + documents,
// never trusted from the request body. Auth pattern reused verbatim from
// src/app/api/case-letters/route.ts PATCH.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const caseId = params.id;

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

  const isAdminOrSupervisor = callerProfile.role === "admin" || callerProfile.role === "supervisor";
  if (!isAdminOrSupervisor) {
    const { data: caseRow, error: caseErr } = await db
      .from("cases")
      .select("assigned_agent_id")
      .eq("id", caseId)
      .maybeSingle();
    if (caseErr || !caseRow || caseRow.assigned_agent_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const result = await reconcileCanonicalIntakeDocuments(db, caseId);
  return NextResponse.json({ success: true, ...result });
}
