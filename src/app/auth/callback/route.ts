import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Sets profile role=client and links clients.profile_id
async function activateClient(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  email: string,
  fullName: string
) {
  const normalEmail = email.toLowerCase().trim();
  await admin
    .from("profiles")
    .upsert(
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

  const code      = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type      = searchParams.get("type");          // "invite" | "recovery" | null
  const next      = searchParams.get("next") ?? "";
  // invite=1 is set by our inviteUserByEmail redirectTo — may be absent if Supabase
  // strips custom params, so we also detect invites via user_metadata.role below
  const explicitInvite = searchParams.get("invite") === "1";

  const supabase = createClient();
  const admin    = createAdminClient();

  // ── TOKEN-HASH FLOW ─────────────────────────────────────────────────────────
  // Supabase (newer flows / some email client configurations) sends token_hash+type
  // directly instead of going through the PKCE code exchange.
  if (tokenHash && (type === "invite" || type === "recovery")) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "invite" | "recovery",
    });

    if (!error && data.user) {
      if (type === "invite") {
        await activateClient(
          admin,
          data.user.id,
          data.user.email ?? "",
          data.user.user_metadata?.full_name ?? ""
        );
      }
      // Both invite and recovery need password setup
      return NextResponse.redirect(`${origin}/auth/setup-account`);
    }

    return NextResponse.redirect(`${origin}/login?error=link_invalido`);
  }

  // ── PKCE CODE FLOW ──────────────────────────────────────────────────────────
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const userId   = data.user.id;
      const email    = data.user.email ?? "";
      const fullName = data.user.user_metadata?.full_name ?? "";
      // role stored at invite time in user_metadata — reliable even if invite=1 was lost
      const metaRole = data.user.user_metadata?.role;

      const isInvite = explicitInvite || (metaRole === "client" && type !== "recovery");

      if (isInvite) {
        await activateClient(admin, userId, email, fullName);
        return NextResponse.redirect(`${origin}/auth/setup-account`);
      }

      // Password reset (forgot-password flow) → password setup page
      if (next === "/auth/setup-account" || type === "recovery") {
        return NextResponse.redirect(`${origin}/auth/setup-account`);
      }

      // Normal code exchange → redirect by role in DB
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
