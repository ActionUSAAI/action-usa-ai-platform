import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const RESEND_KEY  = process.env.RESEND_API_KEY!;
const HOOK_SECRET = process.env.SUPABASE_HOOK_SECRET!; // v1,whsec_<base64>
const FROM        = "ACTION USA AI <noreply@actionusaai.com>";
const SITE_URL    = "https://actionusaai.com";

// ── Signature verification ─────────────────────────────────────────────────────
function verifySignature(rawBody: string, header: string | null): boolean {
  if (!header || !HOOK_SECRET) return false;
  try {
    const secretB64 = HOOK_SECRET.replace(/^v1,whsec_/, "");
    const keyBytes  = Buffer.from(secretB64, "base64");
    const expected  = header.replace(/^v1=/, "");
    const computed  = createHmac("sha256", keyBytes).update(rawBody).digest("hex");
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Resend send ────────────────────────────────────────────────────────────────
async function send(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_KEY) throw new Error("RESEND_API_KEY env var is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

// ── URL builder ────────────────────────────────────────────────────────────────
// All links go through /auth/callback which handles verifyOtp for every type.
function actionUrl(tokenHash: string, type: string): string {
  return `${SITE_URL}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`;
}

// ── Shared HTML wrapper ────────────────────────────────────────────────────────
const BLUE = "#3C3B6E";

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f5;padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;">
  <!-- Logo -->
  <tr><td align="center" style="padding-bottom:20px;">
    <div style="display:inline-block;background:${BLUE};border-radius:12px;padding:14px 28px;">
      <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:0.5px;">ACTION USA AI</span>
    </div>
  </td></tr>
  <!-- Card -->
  <tr><td style="background:#fff;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      ${body}
      <tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
          ACTION USA AI · Servicios de Inmigración<br/>
          <a href="mailto:actionusaaillc@gmail.com" style="color:#9ca3af;text-decoration:none;">actionusaaillc@gmail.com</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function btn(url: string, label: string): string {
  return `<tr><td align="center" style="padding:20px 32px 0;">
    <a href="${url}" style="display:inline-block;background:${BLUE};color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:10px;">${label} &rarr;</a>
  </td></tr>
  <tr><td style="padding:14px 32px 0;">
    <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
      Si el botón no funciona, copia este enlace:<br/>
      <a href="${url}" style="color:${BLUE};word-break:break-all;">${url}</a>
    </p>
  </td></tr>`;
}

// ── Email templates ────────────────────────────────────────────────────────────
function tplInvite(name: string, url: string): string {
  return wrap(`
    <tr><td style="padding:36px 32px 24px;">
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">¡Tienes una invitación!</h1>
      <p style="margin:0 0 12px;font-size:15px;color:#4b5563;line-height:1.65;">
        Hola <strong>${name}</strong>, has sido invitado(a) al portal de clientes de
        <strong>ACTION USA AI</strong>. Aquí podrás seguir el progreso de tu caso
        de inmigración y comunicarte con tu equipo legal.
      </p>
      <p style="margin:0;font-size:14px;color:#6b7280;">
        Haz clic en el botón para crear tu contraseña y activar tu cuenta.
      </p>
    </td></tr>
    ${btn(url, "Activar mi cuenta")}
    <tr><td style="padding:20px 32px 32px;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Este enlace es válido por 24 horas. Si no esperabas esta invitación puedes ignorar este mensaje.
      </p>
    </td></tr>
  `);
}

function tplSignup(name: string, url: string): string {
  return wrap(`
    <tr><td style="padding:36px 32px 24px;">
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">Confirma tu correo</h1>
      <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.65;">
        Hola <strong>${name}</strong>, haz clic en el botón para confirmar
        tu dirección de correo y activar tu cuenta en ACTION USA AI.
      </p>
    </td></tr>
    ${btn(url, "Confirmar correo")}
    <tr><td style="padding:20px 32px 32px;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Si no creaste esta cuenta puedes ignorar este mensaje.
      </p>
    </td></tr>
  `);
}

function tplRecovery(name: string, url: string): string {
  return wrap(`
    <tr><td style="padding:36px 32px 24px;">
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">Restablece tu contraseña</h1>
      <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.65;">
        Hola <strong>${name}</strong>, recibimos una solicitud para restablecer
        la contraseña de tu cuenta. Si fuiste tú, haz clic abajo.
      </p>
    </td></tr>
    ${btn(url, "Crear nueva contraseña")}
    <tr><td style="padding:20px 32px 32px;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Si no solicitaste esto puedes ignorar este mensaje — tu contraseña no cambiará.
      </p>
    </td></tr>
  `);
}

function tplMagicLink(name: string, url: string): string {
  return wrap(`
    <tr><td style="padding:36px 32px 24px;">
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">Tu enlace de acceso</h1>
      <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.65;">
        Hola <strong>${name}</strong>, usa este enlace para iniciar sesión en ACTION USA AI.
        Expira pronto.
      </p>
    </td></tr>
    ${btn(url, "Iniciar sesión")}
    <tr><td style="padding:20px 32px 32px;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Si no solicitaste esto puedes ignorar este mensaje.
      </p>
    </td></tr>
  `);
}

function tplEmailChange(name: string, url: string): string {
  return wrap(`
    <tr><td style="padding:36px 32px 24px;">
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">Confirma tu nuevo correo</h1>
      <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.65;">
        Hola <strong>${name}</strong>, haz clic para confirmar el cambio
        de correo electrónico en tu cuenta de ACTION USA AI.
      </p>
    </td></tr>
    ${btn(url, "Confirmar nuevo correo")}
    <tr><td style="padding:20px 32px 32px;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Si no solicitaste este cambio escríbenos a actionusaaillc@gmail.com de inmediato.
      </p>
    </td></tr>
  `);
}

// ── Hook types ─────────────────────────────────────────────────────────────────
interface HookPayload {
  user: {
    email: string;
    user_metadata?: { full_name?: string };
  };
  email_data: {
    token_hash:       string;
    token_hash_new?:  string;
    email_action_type: string;
  };
}

// ── Handler ────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // ── Env diagnostics (safe — no secret values exposed) ─────────────────────
  const hasResendKey  = !!process.env.RESEND_API_KEY;
  const hasHookSecret = !!process.env.SUPABASE_HOOK_SECRET;
  console.log("[send-email] env check — RESEND_API_KEY:", hasResendKey, "| SUPABASE_HOOK_SECRET:", hasHookSecret);
  console.log("[send-email] raw body length:", rawBody.length, "| body preview:", rawBody.slice(0, 200));

  // TEMP: signature check disabled for flow testing — re-enable before production
  // if (!verifySignature(rawBody, request.headers.get("x-supabase-signature"))) {
  //   console.error("send-email: invalid signature");
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  let payload: HookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch (parseErr) {
    console.error("[send-email] JSON parse error:", parseErr, "| raw:", rawBody.slice(0, 500));
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { user, email_data } = payload;
  const { email_action_type, token_hash, token_hash_new } = email_data;
  const name = user.user_metadata?.full_name || user.email;
  const to   = user.email;

  console.log("[send-email] action:", email_action_type, "| to:", to, "| token_hash present:", !!token_hash);

  try {
    switch (email_action_type) {
      case "invite":
        await send(to, "Tienes una invitación para unirte a ACTION USA AI",
          tplInvite(name, actionUrl(token_hash, "invite")));
        break;

      case "signup":
        await send(to, "Confirma tu correo en ACTION USA AI",
          tplSignup(name, actionUrl(token_hash, "signup")));
        break;

      case "recovery":
        await send(to, "Restablece tu contraseña en ACTION USA AI",
          tplRecovery(name, actionUrl(token_hash, "recovery")));
        break;

      case "magiclink":
        await send(to, "Tu enlace de acceso a ACTION USA AI",
          tplMagicLink(name, actionUrl(token_hash, "magiclink")));
        break;

      case "email_change_new":
        await send(to, "Confirma tu nuevo correo en ACTION USA AI",
          tplEmailChange(name, actionUrl(token_hash_new ?? token_hash, "email_change_new")));
        break;

      case "email_change_current":
        await send(to, "Tu correo en ACTION USA AI está siendo cambiado",
          tplEmailChange(name, actionUrl(token_hash, "email_change_current")));
        break;

      default:
        console.log("send-email: unknown type", email_action_type);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-email error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
