import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = adminDb();

    const m1 = body.module1 ?? {};
    const fullName  = (m1.fullName  || "").trim();
    const email     = (m1.email     || "").toLowerCase().trim();
    const whatsapp  = (m1.whatsapp  || "").trim();
    const profession = m1.profession || "";

    if (!fullName || !email) {
      return NextResponse.json({ error: "Nombre y email son requeridos." }, { status: 400 });
    }

    // 1 — Create client record
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] || "Sin";
    const lastName  = nameParts.slice(1).join(" ") || "Apellido";

    const { data: client, error: clientErr } = await db
      .from("clients")
      .insert({
        first_name: firstName,
        last_name:  lastName,
        email,
        phone: whatsapp,
        country_of_origin: m1.nationalities || m1.countryOfBirth || null,
        date_of_birth: m1.dateOfBirth || null,
        city: m1.cityOfResidence || null,
        notes: `AUCIS Intake — Profesión: ${profession}. Visa: ${m1.visaType || "no especificada"}.`,
        preferred_language: "es",
      })
      .select()
      .single();

    if (clientErr) throw new Error(`client: ${clientErr.message}`);

    // 2 — Create case
    const year      = new Date().getFullYear();
    const rand      = String(Math.floor(1000 + Math.random() * 9000));
    const caseNumber = `AUCIS-${year}-${rand}`;

    const { data: newCase, error: caseErr } = await db
      .from("cases")
      .insert({
        case_number:  caseNumber,
        client_id:    client.id,
        case_type:    "talento_extraordinario",
        status:       "nuevo",
        priority:     "normal",
        title:        `Evaluación ${m1.visaType || "O-1/EB-1"} — ${fullName}`,
        description:  `Profesión: ${profession}. Objetivo USA: ${m1.usaObjective || "no especificado"}.`,
      })
      .select()
      .single();

    if (caseErr) throw new Error(`case: ${caseErr.message}`);

    // 3 — Store full intake in intake_submissions
    const { error: intakeErr } = await db
      .from("intake_submissions")
      .insert({
        client_id: client.id,
        case_id:   newCase.id,
        status:    "submitted",
        module1:   body.module1  ?? {},
        module2:   body.module2  ?? {},
        module3:   {},
        module4:   body.module4  ?? {},
        module5:   body.module5  ?? {},
        module6:   body.module6  ?? {},
        module7:   body.module7  ?? {},
        module8:   body.module8  ?? {},
        module9:   body.module9  ?? {},
        module10:  body.module10 ?? {},
        module11:  body.module11 ?? {},
        module12:  body.module12 ?? {},
        module_progress: body.moduleStatuses
          ? Object.fromEntries((body.moduleStatuses as string[]).map((s, i) => [i + 1, s]))
          : {},
      });

    if (intakeErr) throw new Error(`intake: ${intakeErr.message}`);

    // 4 — Invite client to portal (sends email via Supabase Send Email Hook)
    await db.auth.admin
      .inviteUserByEmail(email, {
        data: { full_name: fullName, role: "client" },
        redirectTo: "https://actionusaai.com/auth/callback?next=/auth/setup-account&invite=1",
      })
      .catch((e: Error) => console.error("[intake] invite error:", e.message));

    // 5 — Admin notification email
    if (process.env.RESEND_API_KEY) {
      const m10 = body.module10 ?? {};
      const evidenceCount = ["awardsStatus","membershipsStatus","mediaStatus","articlesStatus",
        "booksStatus","conferencesStatus","judgingStatus","patentsStatus"]
        .filter(k => m10[k] === "tengo").length;

      const html = `
        <div style="font-family:sans-serif;max-width:600px">
          <h2 style="color:#3C3B6E;border-bottom:2px solid #B22234;padding-bottom:8px">
            Nueva Evaluación AUCIS
          </h2>
          <table cellpadding="6" style="border-collapse:collapse;width:100%">
            <tr style="background:#f8f8f8"><td><b>Nombre</b></td><td>${fullName}</td></tr>
            <tr><td><b>Email</b></td><td>${email}</td></tr>
            <tr style="background:#f8f8f8"><td><b>WhatsApp</b></td><td>${whatsapp}</td></tr>
            <tr><td><b>Profesión</b></td><td>${profession}</td></tr>
            <tr style="background:#f8f8f8"><td><b>Visa de interés</b></td><td>${m1.visaType || "No especificada"}</td></tr>
            <tr><td><b>Objetivo USA</b></td><td>${m1.usaObjective || "No especificado"}</td></tr>
            <tr style="background:#f8f8f8"><td><b>Evidencia documentada</b></td><td>${evidenceCount}/8 categorías</td></tr>
            <tr><td><b>Número de caso</b></td><td><b>${caseNumber}</b></td></tr>
          </table>
          <p style="margin-top:16px">
            <a href="https://actionusaai.com/cases/${newCase.id}"
              style="background:#B22234;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
              Ver caso en el portal →
            </a>
          </p>
        </div>
      `;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ACTION USA AI <noreply@actionusaai.com>",
          to:   ["actionusaaillc@gmail.com"],
          subject: `Nueva evaluación AUCIS: ${fullName} — ${caseNumber}`,
          html,
        }),
      }).catch((e: unknown) => console.error("[intake] admin email error:", e));
    }

    return NextResponse.json({ success: true, caseNumber, clientId: client.id, caseId: newCase.id });

  } catch (error) {
    const msg   = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack   : undefined;
    console.error("[intake] error:", msg);
    console.error("[intake] stack:", stack ?? "(no stack)");
    console.error("[intake] raw:", JSON.stringify(error, Object.getOwnPropertyNames(error instanceof Error ? error : {})));
    return NextResponse.json(
      { error: "Error al procesar la solicitud. Por favor intenta de nuevo." },
      { status: 500 }
    );
  }
}
