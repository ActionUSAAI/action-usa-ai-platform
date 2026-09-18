import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUploadNamespace, buildStoragePath, isSafeUploadPath, resolveExtension } from "@/lib/intake/upload-authorization";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET       = "intake-documents";
const MAX_SIZE     = 10 * 1024 * 1024;
const ALLOWED      = ["application/pdf", "image/jpeg", "image/png"];

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file  = form.get("file") as File | null;
    const path  = (form.get("path")  as string | null) ?? "";
    const token = (form.get("token") as string | null)?.trim() ?? "";

    if (!file) return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "El archivo no puede exceder 10MB." }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Solo se permiten archivos PDF, JPG o PNG." }, { status: 400 });

    // CR-CPS-40 D-1: `path` is client-controlled -- validated against a
    // positive per-segment character allowlist before it may
    // participate in the storage key at all. Rejected here, before any
    // invitation lookup or storage write.
    if (!isSafeUploadPath(path)) {
      return NextResponse.json({ error: "Ruta de almacenamiento no válida." }, { status: 400 });
    }

    // The extension is derived exclusively from the already-validated
    // MIME type (closed set) -- fileName never participates in the
    // storage key (CR-CPS-40 D-1, filename/extension vector).
    const extension = resolveExtension(file.type);
    if (!extension) {
      return NextResponse.json({ error: "Tipo de archivo no soportado." }, { status: 400 });
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

    // Ownership hardening (CR-CPS-35 IAG-38, remediated CR-CPS-38/40
    // IAG-SEC-01): the authorized storage namespace is resolved
    // exclusively server-side from the validated invitation -- a
    // client-supplied sessionId can no longer influence it at all
    // (see src/lib/intake/upload-authorization.ts).
    const auth = await resolveUploadNamespace(db, token);
    if (!auth.ok) {
      const status = auth.error.includes("Falta el token") ? 401 : 403;
      return NextResponse.json({ error: auth.error }, { status });
    }

    const storagePath = buildStoragePath(auth.invitationId, path, extension);
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
