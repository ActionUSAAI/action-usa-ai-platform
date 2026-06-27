import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

async function activateClient(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  email: string,
  fullName: string
) {
  const normalEmail = email.toLowerCase().trim();
  await admin.from("profiles").upsert(
    { id: userId, email: normalEmail, full_name: fullName, role: "client" },
    { onConflict: "id" }
  );
  await admin
    .from("clients")
    .update({ profile_id: userId })
    .eq("email", normalEmail)
    .is("profile_id", null);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code           = searchParams.get("code");
  const tokenHash      = searchParams.get("token_hash");
  const type           = searchParams.get("type");
  const next           = searchParams.get("next") ?? "";
  const explicitInvite = searchParams.get("invite") === "1";

  const supabase = createClient();
  const admin    = createAdminClient();

  // ── TOKEN-HASH FLOW ─────────────────────────────────────────────────────────
  // Used by our /api/send-email hook: every confirmation link points here
  // with token_hash + type instead of going through Supabase's verify endpoint.
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      // verifyOtp accepts: invite | recovery | signup | magiclink |
      //                    email_change_new | email_change_current
      type: type as Parameters<typeof supabase.auth.verifyOtp>[0]["type"],
    });

    if (!error && data.user) {
      // Client invite → set profile role + link client record → password setup
      if (type === "invite") {
        await activateClient(admin, data.user.id, data.user.email ?? "", data.user.user_metadata?.full_name ?? "");
        return NextResponse.redirect(`${origin}/auth/setup-account`);
      }

      // Password recovery → password setup
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/auth/setup-account`);
      }

      // signup / magiclink / email_change_* → redirect by role
      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profile?.role === "client") {
        return NextResponse.redirect(`${origin}/client/dashboard`);
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }

    return NextResponse.redirect(`${origin}/login?error=link_invalido`);
  }

  // ── PKCE CODE FLOW ──────────────────────────────────────────────────────────
  // Fallback: Supabase default email template or magic link via browser client.
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const userId   = data.user.id;
      const email    = data.user.email ?? "";
      const fullName = data.user.user_metadata?.full_name ?? "";
      const metaRole = data.user.user_metadata?.role;

      // Detect invite: explicit param OR role=client in metadata (set at inviteUserByEmail time)
      const isInvite = explicitInvite || (metaRole === "client" && type !== "recovery");

      if (isInvite) {
        await activateClient(admin, userId, email, fullName);
        return NextResponse.redirect(`${origin}/auth/setup-account`);
      }

      if (next === "/auth/setup-account" || type === "recovery") {
        return NextResponse.redirect(`${origin}/auth/setup-account`);
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profile?.role === "client") {
        return NextResponse.redirect(`${origin}/client/dashboard`);
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link_invalido`);
}
