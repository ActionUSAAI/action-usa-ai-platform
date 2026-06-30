import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";
import { sendInvitationEmail } from "@/lib/email/invitation";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Maps UI select values → DB enum + display label for the case title
const CASE_TYPE_DB: Record<string, string> = {
  o1a_eb1a:       "talento_extraordinario",
  o1b:            "talento_extraordinario",
  por_determinar: "otro",
};

const CASE_TYPE_LABEL: Record<string, string> = {
  o1a_eb1a:       "Talento Extraordinario O-1A / EB-1A",
  o1b:            "Talento Extraordinario O-1B",
  por_determinar: "Por Determinar",
};

const ALLOWED_ROLES = ["admin", "supervisor", "agent"];

export async function POST(request: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const ssrClient = createServerClient();
  const { data: { user }, error: authErr } = await ssrClient.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminDb();

  const { data: callerProfile, error: profileErr } = await db
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profileErr || !callerProfile || !ALLOWED_ROLES.includes(callerProfile.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────────
  let body: { full_name: string; email: string; phone?: string; case_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { full_name, email, phone, case_type: caseTypeKey = "por_determinar" } = body;

  if (!full_name?.trim() || !email?.trim()) {
    return NextResponse.json(
      { error: "Missing required fields: full_name, email" },
      { status: 400 },
    );
  }

  const dbCaseType   = CASE_TYPE_DB[caseTypeKey]   ?? "otro";
  const caseLabel    = CASE_TYPE_LABEL[caseTypeKey] ?? "Por Determinar";
  const cleanEmail   = email.trim().toLowerCase();
  const cleanName    = full_name.trim();

  const nameParts = cleanName.split(/\s+/);
  const firstName = nameParts[0];
  const lastName  = nameParts.slice(1).join(" ") || "";

  // ── 3. Find or create client ─────────────────────────────────────────────────
  let clientId: string;
  let clientCreated = false;

  const { data: existing } = await db
    .from("clients")
    .select("id")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (existing) {
    clientId = existing.id as string;
  } else {
    const { data: newClient, error: clientErr } = await db
      .from("clients")
      .insert({
        first_name:         firstName,
        last_name:          lastName,
        email:              cleanEmail,
        phone:              phone?.trim() || null,
        preferred_language: "es",
      })
      .select("id")
      .single();

    if (clientErr || !newClient) {
      return NextResponse.json(
        { error: "Failed to create client", detail: clientErr?.message },
        { status: 500 },
      );
    }

    clientId = newClient.id as string;
    clientCreated = true;
  }

  // ── 4. Create case ───────────────────────────────────────────────────────────
  // No case_number sent — the DB trigger (generate_case_number) assigns a
  // guaranteed-unique AUA-YYYY-NNNNN from a sequence.
  const { data: newCase, error: caseErr } = await db
    .from("cases")
    .insert({
      client_id: clientId,
      case_type: dbCaseType,
      status:    "nuevo",
      priority:  "normal",
      title:     `Evaluación ${caseLabel} — ${cleanName}`,
    })
    .select("id, case_number")
    .single();

  if (caseErr || !newCase) {
    // Roll back newly created client so we don't leave orphans
    if (clientCreated) {
      await db.from("clients").delete().eq("id", clientId);
    }
    return NextResponse.json(
      { error: "Failed to create case", detail: caseErr?.message },
      { status: 500 },
    );
  }

  const caseId = newCase.id as string;

  // ── 5. Generate token + insert invitation ────────────────────────────────────
  const token = randomBytes(32).toString("base64url");

  const { data: invitation, error: invErr } = await db
    .from("intake_invitations")
    .insert({
      token,
      case_id:    caseId,
      client_id:  clientId,
      email:      cleanEmail,
      status:     "pending",
      created_by: callerProfile.id,
    })
    .select("id, expires_at")
    .single();

  if (invErr || !invitation) {
    // Roll back case (and client if newly created)
    await db.from("cases").delete().eq("id", caseId);
    if (clientCreated) await db.from("clients").delete().eq("id", clientId);

    return NextResponse.json(
      { error: "Failed to create invitation", detail: invErr?.message },
      { status: 500 },
    );
  }

  // ── 6. Send email (non-fatal) ────────────────────────────────────────────────
  let emailWarning: string | undefined;

  try {
    await sendInvitationEmail(token, cleanEmail);
  } catch (err) {
    emailWarning = err instanceof Error ? err.message : String(err);
    console.error("[invitations/create] email error:", emailWarning);
  }

  // ── 7. Respond ───────────────────────────────────────────────────────────────
  return NextResponse.json({
    success:       true,
    case_id:       caseId,
    case_number:   newCase.case_number,
    invitation_id: invitation.id,
    expires_at:    invitation.expires_at,
    ...(emailWarning ? { email_warning: emailWarning } : {}),
  });
}
