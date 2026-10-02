import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Fail closed, mirrors authorize-case-staff.ts's adminDb() exactly.
export function adminDb() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("authorize-client-staff: Supabase server configuration is missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type ClientStaffAuthorization =
  | { ok: true; userId: string; role: string }
  | { ok: false; status: 401 | 403; error: string };

// Client-scoped staff authorization (CBR §J Layer 1) — the same pattern as
// authorizeCaseStaff (src/lib/auth/authorize-case-staff.ts), keyed directly
// on clients.assigned_agent_id since CBR governs per-client canonical
// beneficiary data, not per-case. Never trusts a browser-supplied role or
// actor identity — the real user is resolved server-side via SSR session,
// and the returned userId is the ONLY actor identity any caller may pass
// on to the governed TX-0x RPCs (never a client-supplied id). The governed
// RPCs themselves re-run this same predicate under lock (Layer 2) — this
// function is the additive, earlier, fail-fast check, not a replacement.
export async function authorizeClientStaff(clientId: string): Promise<ClientStaffAuthorization> {
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
    const { data: clientRow, error: clientErr } = await db
      .from("clients")
      .select("assigned_agent_id")
      .eq("id", clientId)
      .maybeSingle();
    if (clientErr || !clientRow || clientRow.assigned_agent_id !== user.id) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
  }

  return { ok: true, userId: user.id, role: profile.role };
}
