import type { SupabaseClient } from "@supabase/supabase-js";

// AUSCIS Intake Intelligence Layer -- upload authorization/namespace
// resolution (CR-CPS-38 IAG-SEC-01 remediation). Framework-agnostic,
// directly testable -- mirrors the separation already established by
// record-letter-delivery.ts / a0-extract.ts / coach.ts.
//
// The authorized storage namespace is derived exclusively from the
// server-resolved invitation matched by `token`. No client-supplied
// value (sessionId or otherwise) can influence it -- this is the fix
// for the confirmed defect where a valid token for invitation A
// combined with an arbitrary/foreign sessionId B could previously
// write into namespace B.

export type UploadAuthorizationResult =
  | { ok: true; invitationId: string }
  | { ok: false; error: string };

export async function resolveUploadNamespace(
  db: SupabaseClient,
  token: string
): Promise<UploadAuthorizationResult> {
  if (!token) {
    return { ok: false, error: "Falta el token de invitación." };
  }
  const now = new Date().toISOString();
  const { data: invitation } = await db
    .from("intake_invitations")
    .select("id")
    .eq("token", token)
    .in("status", ["pending", "opened"])
    .gt("expires_at", now)
    .maybeSingle();
  if (!invitation) {
    return { ok: false, error: "Invitación inválida o expirada." };
  }
  return { ok: true, invitationId: invitation.id as string };
}

export function buildStoragePath(invitationId: string, path: string, fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "bin";
  const ts = Date.now();
  return `${invitationId}/${path}/${ts}.${ext}`;
}
