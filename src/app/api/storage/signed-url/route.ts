import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  const db = createServiceClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await db.storage
    .from("intake-documents")
    .createSignedUrl(path, 3600);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create signed URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
