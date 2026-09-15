import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizeCaseStaff, adminDb } from "@/lib/auth/authorize-case-staff";
import { resolveCanonicalDocument, resolveLegacyBinding, type ResolvedResource } from "@/lib/storage/resolve-signed-url-resource";

// MTCS-07 — signed-URL hardening (docs/MTCS-07_FINAL_EXACT_DESIGN.md).
// AUTHENTICATE → RESOLVE/VERIFY RESOURCE BINDING → AUTHORIZE CASE STAFF →
// SIGN → RETURN. authorizeCaseStaff() is always called before any
// createSignedUrl() — no branch may sign first. Resolution logic lives in
// src/lib/storage/resolve-signed-url-resource.ts, shared with
// supabase/tests/mtcs07-validate.js so both exercise the same code.

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documentId = request.nextUrl.searchParams.get("document_id");
  const path = request.nextUrl.searchParams.get("path");

  const db = adminDb();
  let resolved: ResolvedResource;

  try {
    if (documentId) {
      // Canonical mode: document_id is authoritative — no caller-supplied
      // case_id/file_path/bucket is ever accepted on this route. Unknown
      // document_id never falls through to legacy resolution.
      const canonical = await resolveCanonicalDocument(db, documentId);
      if (!canonical) {
        return NextResponse.json({ error: `Unknown document_id: ${documentId}` }, { status: 404 });
      }
      resolved = canonical;
    } else if (path) {
      const binding = await resolveLegacyBinding(db, path);
      if (!binding) {
        return NextResponse.json({ error: "No authoritative binding found for the requested resource" }, { status: 404 });
      }
      resolved = binding;
    } else {
      return NextResponse.json({ error: "Missing required parameter: document_id or path" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to resolve requested resource" },
      { status: 500 }
    );
  }

  const auth = await authorizeCaseStaff(resolved.caseId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await db.storage
    .from(resolved.bucket)
    .createSignedUrl(resolved.filePath, 3600);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create signed URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
