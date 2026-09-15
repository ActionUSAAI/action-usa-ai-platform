import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { authorizeCaseStaff } from "@/lib/auth/authorize-case-staff";
import { resolveOriginatingLetter, registerReturnedGeneratedWorkProduct } from "@/lib/documents/register-returned-gwp";

// MTCS-08 — Generated Work Product Re-entry
// (docs/MTCS-08_FINAL_EXACT_DESIGN.md, SHA256
// ae73ab1e4bf4e00e9cfcc0b1fff92073f0fa301d505848e85434d4a6dc31a5dd).
// AUTHENTICATE → BIND (to the originating GWP, server-side) →
// AUTHORIZE (Case, via authorizeCaseStaff) → validate eligibility →
// delegate to registerReturnedGeneratedWorkProduct. [id] is
// agent_recommendation_letters.id — the sole binding identity; no
// case_id/client_id/storage_bucket/file_path/originating id is ever
// accepted from the client.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const ssrClient = createServerClient();
  const { data: { user }, error: authErr } = await ssrClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminDb();

  const letter = await resolveOriginatingLetter(db, params.id);
  if (!letter) {
    return NextResponse.json({ error: `Unknown recommendation letter: ${params.id}` }, { status: 404 });
  }

  const auth = await authorizeCaseStaff(letter.case_id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart/form-data body" }, { status: 400 });
  }
  const file = form.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Missing required field: file" }, { status: 400 });
  }

  const fileBytes = await file.arrayBuffer();

  const result = await registerReturnedGeneratedWorkProduct(db, {
    letter,
    fileBytes,
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    uploadedBy: user.id,
  });

  if (!result.ok) {
    const status = result.error.code === "INELIGIBLE" ? 409
      : result.error.code === "INVALID_FILE" ? 400
      : 500;
    return NextResponse.json({ error: result.error.message }, { status });
  }

  return NextResponse.json({
    document_id: result.document.id,
    case_id: result.document.case_id,
    originating_gwp_id: letter.id,
    document_status: "pendiente",
  });
}
