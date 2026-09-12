import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Fail closed: unlike the repo-wide `|| "https://<project>.supabase.co"` fallback
// convention used elsewhere, this governed Evidence authorization boundary must never
// silently default to any project (including Production) if configuration is missing.
export function adminDb() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("authorize-case-staff: Supabase server configuration is missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type CaseStaffAuthorization =
  | { ok: true; userId: string; role: string }
  | { ok: false; status: 401 | 403; error: string };

// Case-scoped staff authorization, extracted verbatim from the pattern already used by
// src/app/api/case-letters/route.ts (PATCH) and
// src/app/api/cases/[id]/reconcile-documents/route.ts — admin/supervisor unconditionally,
// or the agent assigned to this specific Case. Never trusts browser-supplied role or
// Case-ownership claims; always re-resolved server-side.
export async function authorizeCaseStaff(caseId: string): Promise<CaseStaffAuthorization> {
  const ssrClient = createServerClient();
  const { data: { user }, error: authErr } = await ssrClient.auth.getUser();
  if (authErr || !user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const db = adminDb();
  const { data: profile, error: profileErr } = await db
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();
  if (profileErr || !profile) {
    return { ok: false, status: 403, error: "Profile not found" };
  }

  const isAdminOrSupervisor = profile.role === "admin" || profile.role === "supervisor";
  if (!isAdminOrSupervisor) {
    const { data: caseRow, error: caseErr } = await db
      .from("cases")
      .select("assigned_agent_id")
      .eq("id", caseId)
      .maybeSingle();
    if (caseErr || !caseRow || caseRow.assigned_agent_id !== user.id) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
  }

  return { ok: true, userId: user.id, role: profile.role };
}
