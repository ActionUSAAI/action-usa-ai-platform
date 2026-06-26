import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "";
  const isClientInvite = next.startsWith("/client");

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const userId = data.user.id;
      const userEmail = (data.user.email || "").toLowerCase().trim();
      const admin = createAdminClient();

      if (isClientInvite) {
        // Ensure profile exists with role='client'
        await admin.from("profiles").upsert(
          {
            id: userId,
            email: userEmail,
            full_name: data.user.user_metadata?.full_name || "",
            role: "client",
          },
          { onConflict: "id" }
        );

        // Link clients record to this auth user (required for RLS)
        await admin
          .from("clients")
          .update({ profile_id: userId })
          .eq("email", userEmail)
          .is("profile_id", null);

        return NextResponse.redirect(`${origin}/client/setup`);
      }

      // Normal login: redirect based on role
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
