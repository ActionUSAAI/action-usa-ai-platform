import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_KEY   = process.env.RESEND_API_KEY!;
const FROM         = "ACTION USA AI <noreply@actionusaai.com>";
const SITE_URL     = "https://actionusaai.com";

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function invitationEmail(token: string, email: string): string {
  const link = `${SITE_URL}/intake?token=${token}`;

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#1B2B5E;padding:32px 40px;text-align:center">
            <p style="margin:0;color:#C9A84C;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase">ACTION USA AI</p>
            <h1 style="margin:12px 0 0;color:#ffffff;font-size:24px;font-weight:700;line-height:1.3">
              Tu evaluación de elegibilidad<br>te está esperando
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px">
            <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.7">
              Hola,
            </p>
            <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.7">
              Has sido invitado/a a completar tu <strong>evaluación de talento extraordinario</strong> con ACTION USA AI. Este formulario nos permite analizar en detalle tu perfil profesional para determinar tu elegibilidad para visas como la <strong>O-1A, O-1B o EB-1</strong>.
            </p>
            <p style="margin:0 0 32px;color:#374151;font-size:16px;line-height:1.7">
              El proceso toma entre <strong>20 y 40 minutos</strong>. Puedes pausar y continuar cuando quieras — tu progreso se guarda automáticamente.
            </p>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 0 32px">
                  <a href="${link}"
                     style="display:inline-block;background:#1B2B5E;color:#C9A84C;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:8px;letter-spacing:0.5px">
                    Completar mi evaluación →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Warning box -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#FEF9EC;border:1px solid #C9A84C;border-radius:8px;padding:16px 20px">
                  <p style="margin:0 0 6px;color:#92640A;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Importante</p>
                  <p style="margin:0;color:#78510A;font-size:14px;line-height:1.6">
                    Este enlace es <strong>personal e intransferible</strong> y expira en <strong>14 días</strong>.
                    No lo compartas con nadie. Si el enlace vence, contacta a tu asesor para solicitar uno nuevo.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 40px">
            <hr style="border:none;border-top:1px solid #E5E7EB;margin:0">
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px 32px">
            <p style="margin:0 0 8px;color:#9CA3AF;font-size:13px;line-height:1.6">
              Si el botón no funciona, copia y pega este enlace en tu navegador:
            </p>
            <p style="margin:0 0 20px;word-break:break-all">
              <a href="${link}" style="color:#1B2B5E;font-size:13px;text-decoration:underline">${link}</a>
            </p>
            <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:1.6">
              Este mensaje fue enviado a ${email}. Si no esperabas esta invitación,
              puedes ignorar este correo de forma segura.
            </p>
          </td>
        </tr>

        <!-- Brand footer -->
        <tr>
          <td style="background:#1B2B5E;padding:16px 40px;text-align:center">
            <p style="margin:0;color:#C9A84C;font-size:12px;letter-spacing:1px">
              ACTION USA AI · actionusaai.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
        subject: "Tu invitación para completar tu evaluación — ACTION USA AI",
        html: invitationEmail(token, email),
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
