import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";
import { buildInvitationHtml } from "@/lib/email/invitation";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_KEY   = process.env.RESEND_API_KEY!;
const FROM         = "ACTION USA AI <noreply@actionusaai.com>";

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  // ── 1. Verify caller auth via SSR client (cookie-based session) ─────────────
  const ssrClient = createServerClient();
  const { data: { user }, error: authErr } = await ssrClient.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminDb();

  // ── 2. Verify caller role ────────────────────────────────────────────────────
  const { data: callerProfile, error: profileErr } = await db
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profileErr || !callerProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  const ALLOWED_ROLES = ["admin", "supervisor", "agent"];
  if (!ALLOWED_ROLES.includes(callerProfile.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 3. Parse body ────────────────────────────────────────────────────────────
  let body: { case_id: string; client_id: string; email: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { case_id, client_id, email } = body;

  if (!case_id || !client_id || !email) {
    return NextResponse.json(
      { error: "Missing required fields: case_id, client_id, email" },
      { status: 400 },
    );
  }

  // ── 4. Generate token ────────────────────────────────────────────────────────
  const token = randomBytes(32).toString("base64url");

  // ── 5. Insert invitation row ─────────────────────────────────────────────────
  const { data: invitation, error: insertErr } = await db
    .from("intake_invitations")
    .insert({
      token,
      case_id,
      client_id,
      email,
      status: "pending",
      created_by: callerProfile.id,
    })
    .select("id, expires_at")
    .single();

  if (insertErr || !invitation) {
    return NextResponse.json(
      { error: "Failed to create invitation", detail: insertErr?.message },
      { status: 500 },
    );
  }

  // ── 6. Send email via Resend ─────────────────────────────────────────────────
  let emailWarning: string | undefined;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to:   [email],
        subject: "Inicio formal de su expediente — ACTION USA AI",
        html: buildInvitationHtml(token, email),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Resend ${res.status}: ${detail}`);
    }
  } catch (err) {
    emailWarning = err instanceof Error ? err.message : String(err);
    console.error("[invitations] email error:", emailWarning);
  }

  // ── 7. Return result ─────────────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    invitation_id: invitation.id,
    expires_at: invitation.expires_at,
    ...(emailWarning ? { email_warning: emailWarning } : {}),
  });
}
