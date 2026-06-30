const SITE_URL = "https://actionusaai.com";
const FROM     = "ACTION USA AI <noreply@actionusaai.com>";
const SUBJECT  = "Inicio formal de su expediente — ACTION USA AI";

export function buildInvitationHtml(token: string, email: string): string {
  const link = `${SITE_URL}/intake?token=${token}`;

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

        <!-- Logo -->
        <tr>
          <td align="center" style="background:#ffffff;padding:28px 40px 20px">
            <img src="${SITE_URL}/logo.png" alt="ACTION USA AI" width="150" height="38"
                 style="display:block;max-width:150px;height:auto;border:0">
          </td>
        </tr>

        <!-- Header -->
        <tr>
          <td style="background:#1B2B5E;padding:32px 40px;text-align:center">
            <p style="margin:0;color:#C9A84C;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase">ACTION USA AI</p>
            <h1 style="margin:12px 0 0;color:#ffffff;font-size:24px;font-weight:700;line-height:1.3">
              Su expediente está listo<br>para comenzar
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
              Su caso ha sido aceptado y el equipo de ACTION USA AI ya se encuentra asignado para iniciar la preparación de su expediente.
            </p>
            <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.7">
              Como primer paso, le solicitamos completar el formulario inicial de información y cargar la documentación correspondiente. Esta información nos permitirá organizar sus datos personales, trayectoria profesional, documentos, logros y antecedentes relevantes para comenzar la construcción estratégica de su caso.
            </p>
            <p style="margin:0 0 32px;color:#374151;font-size:16px;line-height:1.7">
              El formulario toma aproximadamente entre <strong>20 y 40 minutos</strong>. Le recomendamos completarlo a la brevedad posible, ya que el equipo legal no podrá iniciar la preparación de su expediente hasta recibir esta información. Si necesita pausarlo, su progreso se guardará automáticamente.
            </p>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 0 32px">
                  <a href="${link}"
                     style="display:inline-block;background:#1B2B5E;color:#C9A84C;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:8px;letter-spacing:0.5px">
                    Completar mi información →
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
                    Este enlace es <strong>personal e intransferible</strong>, y tendrá una vigencia de <strong>14 días</strong>.
                    Por favor, no lo comparta con terceros. Si el enlace expira, comuníquese con su asesor para solicitar uno nuevo.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Sign-off -->
            <p style="margin:32px 0 0;color:#374151;font-size:15px;line-height:1.7">
              Atentamente,<br>
              <strong>ACTION USA AI</strong>
            </p>
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
              Si el botón no funciona, copie y pegue este enlace en su navegador:
            </p>
            <p style="margin:0 0 20px;word-break:break-all">
              <a href="${link}" style="color:#1B2B5E;font-size:13px;text-decoration:underline">${link}</a>
            </p>
            <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:1.6">
              Este mensaje fue enviado a ${email}. Si usted no solicitó esta comunicación,
              puede ignorar este correo de forma segura.
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

export async function sendInvitationEmail(token: string, email: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to:   [email],
      subject: SUBJECT,
      html: buildInvitationHtml(token, email),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
}
