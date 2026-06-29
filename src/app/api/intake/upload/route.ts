import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET       = "intake-documents";
const MAX_SIZE     = 10 * 1024 * 1024;
const ALLOWED      = ["application/pdf", "image/jpeg", "image/png"];

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file      = form.get("file") as File | null;
    const path      = (form.get("path")      as string | null) ?? "";
    const sessionId = (form.get("sessionId") as string | null) ?? "tmp";

    if (!file) return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "El archivo no puede exceder 10MB." }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Solo se permiten archivos PDF, JPG o PNG." }, { status: 400 });

    const db  = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const ts  = Date.now();
    const storagePath = `${sessionId}/${path}/${ts}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error } = await db.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: file.type,
      upsert: true,
    });

    if (error) {
      console.error("[upload] storage:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ filePath: storagePath, fileName: file.name });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[upload] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
