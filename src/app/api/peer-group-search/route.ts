import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const profession = searchParams.get("profession")?.trim() ?? "";
    const industry = searchParams.get("industry")?.trim() ?? "";
    const visaType = searchParams.get("visaType")?.trim() ?? "";

    if (visaType.toUpperCase().includes("EB-1")) {
      return NextResponse.json({ suggestions: [] });
    }

    if (!profession && !industry) {
      return NextResponse.json({ suggestions: [] });
    }

    const db = adminDb();
    const terms = [profession, industry].filter(Boolean);
    const orFilter = terms.map((t) => `professions_covered.ilike.%${t}%`).join(",");

    const { data, error } = await db
      .from("peer_group_organizations")
      .select("id, organization_name, category, professions_covered")
      .or(orFilter)
      .limit(3);

    if (error) throw new Error(`Peer group search failed: ${error.message}`);

    return NextResponse.json({ suggestions: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
