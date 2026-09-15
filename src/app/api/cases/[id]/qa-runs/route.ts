import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { authorizeCaseStaff } from "@/lib/auth/authorize-case-staff";
import { runQaEngine } from "@/lib/qa/run-qa-engine";

// QA Engine — bounded MVP (docs/QA_ENGINE_FINAL_EXACT_DESIGN.md, SHA256
// 33d5f7f07cebfd1acc261e66ea1d10e4f2298671b3c0271a8f0ef8ab678510ab).
// AUTHENTICATE -> BIND (Case, from the path param) -> AUTHORIZE
// (authorizeCaseStaff) -> RESOLVE AUTHORITATIVE INPUTS server-side ->
// EXECUTE QA -> PERSIST / RETURN. GET is strictly read-only and never
// creates, reconciles, or refreshes a run. [id] is cases.id.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const ssrClient = createServerClient();
  const { data: { user }, error: authErr } = await ssrClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const caseId = params.id;

  const auth = await authorizeCaseStaff(caseId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = adminDb();
  const result = await runQaEngine(db, { caseId, executedBy: user.id });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ run: result.run });
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const ssrClient = createServerClient();
  const { data: { user }, error: authErr } = await ssrClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const caseId = params.id;

  const auth = await authorizeCaseStaff(caseId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = adminDb();
  const { data, error } = await db
    .from("qa_runs")
    .select("*")
    .eq("case_id", caseId)
    .order("executed_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ runs: data ?? [] });
}
