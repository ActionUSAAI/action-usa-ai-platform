import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const email = (user.email || "").toLowerCase().trim();

  // Ensure profile has role=client (upsert is safe to call multiple times)
  await admin.from("profiles").upsert(
    {
      id: user.id,
      email,
      full_name: user.user_metadata?.full_name || "",
      role: "client",
    },
    { onConflict: "id" }
  );

  // Link the client record that was created at intake time
  await admin
    .from("clients")
    .update({ profile_id: user.id })
    .eq("email", email)
    .is("profile_id", null);

  return NextResponse.json({ success: true });
}
