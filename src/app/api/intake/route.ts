import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = adminDb();

    // 1 — Save raw intake data
    const { data: intake, error: intakeErr } = await db
      .from("intake_submissions")
      .insert({
        full_name: body.fullName,
        email: (body.email || "").toLowerCase().trim(),
        whatsapp: body.whatsapp,
        nationality: body.nationality,
        profession: body.profession,
        years_experience: parseInt(body.yearsExperience) || 0,
        usa_objective: body.usaObjective,
        employment_history: body.employment || [],
        has_awards: body.hasAwards,
        awards: body.awards || [],
        awards_disposition: body.awardsDisposition || null,
        has_memberships: body.hasMemberships,
        memberships: body.memberships || [],
        memberships_disposition: body.membershipsDisposition || null,
        has_media_coverage: body.hasMediaCoverage,
        media_coverage: body.mediaCoverage || [],
        media_disposition: body.mediaDisposition || null,
        has_articles: body.hasArticles,
        articles: body.articles || [],
        articles_disposition: body.articlesDisposition || null,
        has_books: body.hasBooks,
        books: body.books || [],
        books_disposition: body.booksDisposition || null,
        peer_references: body.references || [],
        distinguished_company: body.distinguishedCompany || null,
        distinguished_role: body.distinguishedRole || null,
        why_distinguished: body.whyDistinguished || null,
        why_role_critical: body.whyRoleCritical || null,
        best_period_start: body.bestPeriodStart || null,
        best_period_end: body.bestPeriodEnd || null,
        annual_income: body.annualIncome || null,
        usa_income_goal: body.usaIncomeGoal || null,
        has_leading_role: body.hasLeadingRole,
        leading_role_description: body.leadingRoleDescription || null,
        has_commercial_success: body.hasCommercialSuccess,
        commercial_success_description: body.commercialSuccessDescription || null,
        has_judged_others: body.hasJudgedOthers,
        judged_others_description: body.judgedOthersDescription || null,
        has_exhibitions: body.hasExhibitions,
        exhibitions_description: body.exhibitionsDescription || null,
        academic_degrees: body.academicDegrees || [],
        status: "pending",
      })
      .select()
      .single();

    if (intakeErr) throw new Error(`intake: ${intakeErr.message}`);

    // 2 — Create client profile
    const parts = (body.fullName || "").trim().split(/\s+/);
    const firstName = parts[0] || "Sin";
    const lastName = parts.slice(1).join(" ") || "Apellido";
    const dateStr = new Date().toLocaleDateString("es-US");

    const { data: client, error: clientErr } = await db
      .from("clients")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email: (body.email || "").toLowerCase().trim(),
        phone: body.whatsapp,
        country_of_origin: body.nationality,
        notes: `Evaluación de talento extraordinario (${dateStr}). Profesión: ${body.profession}.`,
        preferred_language: "es",
      })
      .select()
      .single();

    if (clientErr) throw new Error(`client: ${clientErr.message}`);

    // 3 — Create case
    const year = new Date().getFullYear();
    const rand = String(Math.floor(1000 + Math.random() * 9000));
    const caseNumber = `EVA-${year}-${rand}`;

    const { data: newCase, error: caseErr } = await db
      .from("cases")
      .insert({
        case_number: caseNumber,
        client_id: client.id,
        case_type: "talento_extraordinario",
        status: "nuevo",
        title: `Evaluación O-1B/EB-1B — ${body.fullName}`,
        description: `Evaluación O-1B / EB-1B — ${body.profession}. Objetivo: ${body.usaObjective}`,
        priority: "normal",
      })
      .select()
      .single();

    if (caseErr) throw new Error(`case: ${caseErr.message}`);

    // 4 — Link intake to client + case
    await db
      .from("intake_submissions")
      .update({ client_id: client.id, case_id: newCase.id, status: "completed" })
      .eq("id", intake.id);

    // 5 — Invite client to create portal account (sends email)
    await db.auth.admin
      .inviteUserByEmail((body.email || "").toLowerCase().trim(), {
        data: { full_name: body.fullName, role: "client" },
        redirectTo: "https://actionusaai.com/auth/callback?next=/client/setup",
      })
      .catch((e: Error) => console.error("Invite error:", e.message));

    // 6 — Admin notification (requires RESEND_API_KEY env var)
    if (process.env.RESEND_API_KEY) {
      const html = `
        <h2 style="color:#3C3B6E">Nueva Evaluación de Talento Extraordinario</h2>
        <table cellpadding="6" style="border-collapse:collapse">
          <tr><td><b>Nombre:</b></td><td>${body.fullName}</td></tr>
          <tr><td><b>Email:</b></td><td>${body.email}</td></tr>
          <tr><td><b>WhatsApp:</b></td><td>${body.whatsapp}</td></tr>
          <tr><td><b>Profesión:</b></td><td>${body.profession}</td></tr>
          <tr><td><b>Caso:</b></td><td>${caseNumber}</td></tr>
          <tr><td><b>Objetivo:</b></td><td>${body.usaObjective}</td></tr>
        </table>
        <p><a href="https://actionusaai.com/cases/${newCase.id}" style="color:#B22234">Ver caso en el portal →</a></p>
      `;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ACTION USA AI <no-reply@actionusaai.com>",
          to: ["actionusaaillc@gmail.com"],
          subject: `Nueva evaluación: ${body.fullName} — ${caseNumber}`,
          html,
        }),
      }).catch((e: unknown) => console.error("Admin email error:", e));
    }

    return NextResponse.json({
      success: true,
      caseNumber,
      clientId: client.id,
      caseId: newCase.id,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    console.error("Intake API error:", msg);
    return NextResponse.json(
      { error: "Error al procesar la solicitud. Por favor intenta de nuevo." },
      { status: 500 }
    );
  }
}
