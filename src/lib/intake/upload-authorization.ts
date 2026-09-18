import type { SupabaseClient } from "@supabase/supabase-js";

// AUSCIS Intake Intelligence Layer -- upload authorization/namespace
// resolution (CR-CPS-38 IAG-SEC-01, corrected under CR-CPS-40 D-1).
// Framework-agnostic, directly testable -- mirrors the separation
// already established by record-letter-delivery.ts / a0-extract.ts /
// coach.ts.
//
// The authorized storage namespace is derived exclusively from the
// server-resolved invitation matched by `token`. CR-CPS-40 proved,
// live, that this alone was insufficient: the client-supplied `path`
// segment appended after invitationId was unsanitized, and Supabase
// Storage resolves ".." sequences server-side -- a crafted `path`
// could relocate the write into a DIFFERENT invitation's real
// namespace even though invitationId itself was correctly resolved.
//
// Corrected with a positive, per-segment character allowlist (not a
// blacklist of dangerous substrings): every path segment must consist
// only of [A-Za-z0-9_-]. This is not a stylistic restriction -- it is
// the exact character set every legitimate caller across the whole
// Intake form already uses (audited: module0/cv, module2/passport,
// module2/child-<genId>-passport, module5/<genId>, module10/<section>/
// <genId>, companions/<genId>/passport, petitioner/id, consultative/
// letter, etc. -- genId() itself is `Math.random().toString(36)`,
// always [a-z0-9]). Because "." and repeated/leading "/" (which
// produce empty segments) are structurally excluded from the
// allowlist, ".." traversal and absolute-path redefinition are both
// impossible to express, not merely rejected by pattern-matching after
// the fact.
//
// The file extension is a second, independent vector CR-CPS-40 flagged
// (fileName.split(".").pop() trusted an entirely client-controlled
// string). Corrected by deriving the extension exclusively from the
// already-validated, closed MIME-type allowlist -- the client-supplied
// fileName no longer participates in the storage key at all.

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

export function isSafeUploadPath(path: string): boolean {
  if (!path) return false;
  const segments = path.split("/");
  return segments.every(seg => SAFE_SEGMENT.test(seg));
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export function resolveExtension(mimeType: string): string | null {
  return EXTENSION_BY_MIME[mimeType] ?? null;
}

export type UploadAuthorizationResult =
  | { ok: true; invitationId: string }
  | { ok: false; error: string };

export async function resolveUploadNamespace(
  db: SupabaseClient,
  token: string
): Promise<UploadAuthorizationResult> {
  if (!token) {
    return { ok: false, error: "Falta el token de invitación." };
  }
  const now = new Date().toISOString();
  const { data: invitation } = await db
    .from("intake_invitations")
    .select("id")
    .eq("token", token)
    .in("status", ["pending", "opened"])
    .gt("expires_at", now)
    .maybeSingle();
  if (!invitation) {
    return { ok: false, error: "Invitación inválida o expirada." };
  }
  return { ok: true, invitationId: invitation.id as string };
}

// `path` must already have passed isSafeUploadPath(); `extension` must
// already have come from resolveExtension() -- both server-validated,
// closed-set inputs. No component of the returned key is trusted raw
// client input.
export function buildStoragePath(invitationId: string, path: string, extension: string): string {
  const ts = Date.now();
  return `${invitationId}/${path}/${ts}.${extension}`;
}

// F-01 (CR-CPS-42): the read-side half of the same invariant
// buildStoragePath enforces on write. A0 (src/app/api/intake/
// a0-extract/route.ts) previously resolved the caller's invitation but
// never verified the client-echoed `filePath` actually belonged to it
// -- a valid token for invitation A could download invitation B's CV.
// Fail-closed by construction: a missing/malformed/empty path never
// matches. Scoped to the exact CV namespace A0 has any legitimate
// reason to read (not the invitation's storage namespace generally --
// A0 has no reason to read a beneficiary's other uploaded documents).
export function isCvPathAuthorizedForInvitation(filePath: string, invitationId: string): boolean {
  if (!filePath || !invitationId) return false;
  return filePath.startsWith(`${invitationId}/module0/cv/`);
}
