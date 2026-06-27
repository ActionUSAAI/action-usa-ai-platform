import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "";
  const isClientInvite = searchParams.get("invite") === "1";

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const userId = data.user.id;
      const userEmail = (data.user.email || "").toLowerCase().trim();
      const admin = createAdminClient();

      if (isClientInvite) {
        // Ensure profile has role='client'
        await admin.from("profiles").upsert(
          {
            id: userId,
            email: userEmail,
            full_name: data.user.user_metadata?.full_name || "",
            role: "client",
          },
          { onConflict: "id" }
        );

        // Link clients.profile_id so RLS lets the client see their cases
        await admin
          .from("clients")
          .update({ profile_id: userId })
          .eq("email", userEmail)
          .is("profile_id", null);

        // → password setup page
        return NextResponse.redirect(`${origin}/auth/setup-account`);
      }

      // Password reset or magic link — just go to setup page (user already authed)
      if (next === "/auth/setup-account") {
        return NextResponse.redirect(`${origin}/auth/setup-account`);
      }

      // Normal OAuth/login flow — redirect by role
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
