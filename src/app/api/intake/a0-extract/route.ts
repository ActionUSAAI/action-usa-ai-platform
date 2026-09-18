import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractCvFields } from "@/lib/intake/a0-extract";

// A0 -- CV Extractor (AUSCIS Intake Intelligence Layer, CR-CPS-34/35,
// design §5.3). Runs automatically on successful Module0 upload
// (DDR-TRIGGER-01). Stateless: reads the already-uploaded CV from
// Storage, extracts, and returns the result -- it does not persist
// anything server-side. The client merges the result into its own
// draft Structured Profile state via acquireField(), identical to how
// every other Intake module already accumulates draft state until
// final submission (see src/app/api/intake/route.ts).
//
// Firewall (design §5.3, verbatim Project Owner clarification):
// automatic extraction does not itself constitute beneficiary
// confirmation, factual verification, Evidence Verification, legal
// assessment, or criterion adjudication -- enforced by never returning
// a "confirmed" status; the client always lands new fields in
// acquired_unconfirmed via acquireField().
//
// Extraction logic itself lives in src/lib/intake/a0-extract.ts
// (framework-agnostic, directly testable -- mirrors the separation
// already established by record-letter-delivery.ts).

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const BUCKET        = "intake-documents";

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token    = (body.token as string | null)?.trim() ?? "";
    const filePath = (body.filePath as string | null)?.trim() ?? "";

    if (!token)    return NextResponse.json({ error: "Falta el token de invitación." }, { status: 401 });
    if (!filePath) return NextResponse.json({ error: "Falta la ruta del archivo." }, { status: 400 });

    const db = adminDb();
    const now = new Date().toISOString();
    const { data: invitation } = await db
      .from("intake_invitations")
      .select("id")
      .eq("token", token)
      .in("status", ["pending", "opened"])
      .gt("expires_at", now)
      .maybeSingle();
    if (!invitation) {
      return NextResponse.json({ error: "Invitación inválida o expirada." }, { status: 403 });
    }

    const { data: blob, error: downloadError } = await db.storage.from(BUCKET).download(filePath);
    if (downloadError || !blob) {
      return NextResponse.json({ error: `No se pudo leer el archivo subido: ${downloadError?.message ?? "desconocido"}` }, { status: 500 });
    }

    const mimeType = blob.type || "application/pdf";
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Upload success and A0 failure must remain technically
    // distinguishable (design §11/§7 of the implementation act): the
    // document is already safely stored; only extraction can fail here.
    try {
      const fields = await extractCvFields(base64, mimeType, ANTHROPIC_KEY);
      return NextResponse.json({ fields });
    } catch (extractErr) {
      const msg = extractErr instanceof Error ? extractErr.message : "A0 extraction failed";
      return NextResponse.json({ error: msg, extractionFailed: true }, { status: 502 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg, extractionFailed: true }, { status: 500 });
  }
}
