import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTranslatableFiles } from "@/app/(dashboard)/cases/[id]/extract-files";
import { registerCanonicalDocument } from "@/lib/documents/register-canonical-document";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const INTAKE_BUCKET = "intake-documents";

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

    // invitationCaseId/invitationClientId are browser-supplied context only —
    // never authoritative for Case/Client identity (MTCS-02B, CB-03). Case/Client
    // ownership is resolved exclusively server-side, from the invitation row
    // matched by invitationToken, inside submit_intake_for_invitation().
    const invitationToken = (body.invitationToken || "").trim();
    if (!invitationToken) {
      return NextResponse.json({ error: "Falta el token de invitación." }, { status: 400 });
    }

    const modules = {
      module1:  body.module1  ?? {},
      module2:  body.module2  ?? {},
      module3:  body.module3  ?? {},
      module4:  body.module4  ?? {},
      module5:  body.module5  ?? {},
      module6:  body.module6  ?? {},
      module7:  body.module7  ?? {},
      module8:  body.module8  ?? {},
      module9:  body.module9  ?? {},
      module10: body.module10 ?? {},
      module11: body.module11 ?? {},
      module12: body.module12 ?? {},
      module14: body.module14 ?? {},
      module15: body.module15 ?? {},
      module_progress: body.moduleStatuses
        ? Object.fromEntries((body.moduleStatuses as string[]).map((s, i) => [i + 1, s]))
        : {},
      structured_profile: body.structuredProfile ?? {},
      coach_conversation: body.coachConversation ?? [],
    };

    // 1/2/3 — Atomically resolve the authoritative Case/Client from the
    // invitation and persist the Intake Submission (MTCS-02B Bridge).
    const { data: submitResult, error: submitErr } = await db
      .rpc("submit_intake_for_invitation", { p_token: invitationToken, p_modules: modules })
      .single();

    if (submitErr) {
      const msg = submitErr.message || "";
      if (msg.includes("invalid_invitation") || msg.includes("invitation_not_eligible") || msg.includes("invitation_expired")) {
        return NextResponse.json({ error: "La invitación no es válida o ya fue utilizada." }, { status: 409 });
      }
      throw new Error(`intake: ${submitErr.message}`);
    }

    const { submission_id: submissionId, case_id: caseIdResolved, client_id: clientIdResolved } =
      submitResult as { submission_id: string; case_id: string; client_id: string };

    const { data: caseRow, error: caseLookupErr } = await db
      .from("cases")
      .select("case_number")
      .eq("id", caseIdResolved)
      .single();
    if (caseLookupErr) throw new Error(`case lookup: ${caseLookupErr.message}`);
    const caseNumber = caseRow.case_number as string;

    // Normal-path canonical document registration (MTCS-02B). Best-effort:
    // a registration failure here never fails the Intake submission itself —
    // the explicit staff reconciliation action (POST
    // /api/cases/[id]/reconcile-documents) exists precisely to close any gap
    // left by a failure at this step. Never creates Evidence, never invokes A2.
    const expectedFiles = extractTranslatableFiles(modules);
    for (const file of expectedFiles) {
      try {
        await registerCanonicalDocument(db, {
          caseId: caseIdResolved,
          storageBucket: INTAKE_BUCKET,
          filePath: file.filePath,
          fileName: file.fileName,
          uploadedBy: null,
        });
      } catch (e) {
        console.error("[intake] canonical registration failed:", file.filePath, e instanceof Error ? e.message : e);
      }
    }

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
            <a href="https://actionusaai.com/cases/${caseIdResolved}"
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

    return NextResponse.json({ success: true, caseNumber, clientId: clientIdResolved, caseId: caseIdResolved, submissionId });

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
