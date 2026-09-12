import type { SupabaseClient } from "@supabase/supabase-js";
import { extractTranslatableFiles, type DocumentFile } from "@/app/(dashboard)/cases/[id]/extract-files";
import { registerCanonicalDocument } from "./register-canonical-document";

const INTAKE_BUCKET = "intake-documents";

export interface RegistrationCompleteness {
  status: "complete" | "incomplete" | "none";
  expected: number;
  registered: number;
  missing: number;
}

/**
 * Read-only: recomputes expected-vs-registered counts for a Case's Intake
 * Submission. Never mutates, never calls Storage, never invokes
 * registerCanonicalDocument() — safe to call on ordinary Case page renders.
 *
 * Pass an already-loaded `submission` (e.g. one the caller fetched for its
 * own rendering) to avoid a redundant intake_submissions round trip; omit it
 * to have this function load it fresh.
 */
export async function getExpectedVsRegistered(
  db: SupabaseClient,
  caseId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  preloadedSubmission?: Record<string, any> | null
): Promise<RegistrationCompleteness> {
  const submission = preloadedSubmission !== undefined
    ? preloadedSubmission
    : (
        await db.from("intake_submissions").select("*").eq("case_id", caseId).maybeSingle()
      ).data;

  if (!submission) {
    return { status: "none", expected: 0, registered: 0, missing: 0 };
  }

  const expectedPaths = dedupePaths(extractTranslatableFiles(submission));

  if (expectedPaths.length === 0) {
    return { status: "complete", expected: 0, registered: 0, missing: 0 };
  }

  const { data: registeredRows } = await db
    .from("documents")
    .select("file_path")
    .eq("case_id", caseId)
    .eq("storage_bucket", INTAKE_BUCKET)
    .in("file_path", expectedPaths);

  const registeredCount = registeredRows?.length ?? 0;
  const missing = expectedPaths.length - registeredCount;

  return {
    status: missing > 0 ? "incomplete" : "complete",
    expected: expectedPaths.length,
    registered: registeredCount,
    missing,
  };
}

export interface ReconcileResult {
  expected: number;
  already_registered: number;
  recovered: number;
  missing_storage: number;
  failed: number;
}

/**
 * Mutation: recomputes the missing set server-side from authoritative
 * persisted state (never trusts a caller-supplied path list), verifies
 * physical Storage existence before registering, and calls the existing
 * idempotent registerCanonicalDocument() for each recoverable item.
 */
export async function reconcileCanonicalIntakeDocuments(
  db: SupabaseClient,
  caseId: string
): Promise<ReconcileResult> {
  const { data: submission } = await db
    .from("intake_submissions")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle();

  if (!submission) {
    return { expected: 0, already_registered: 0, recovered: 0, missing_storage: 0, failed: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expectedFiles = dedupeFiles(extractTranslatableFiles(submission as Record<string, any>));

  if (expectedFiles.length === 0) {
    return { expected: 0, already_registered: 0, recovered: 0, missing_storage: 0, failed: 0 };
  }

  const expectedPaths = expectedFiles.map((f) => f.filePath);
  const { data: registeredRows } = await db
    .from("documents")
    .select("file_path")
    .eq("case_id", caseId)
    .eq("storage_bucket", INTAKE_BUCKET)
    .in("file_path", expectedPaths);

  const registeredSet = new Set((registeredRows ?? []).map((r) => r.file_path as string));
  const missingFiles = expectedFiles.filter((f) => !registeredSet.has(f.filePath));

  let recovered = 0;
  let missingStorage = 0;
  let failed = 0;

  for (const file of missingFiles) {
    const segments = file.filePath.split("/");
    const objectName = segments.pop() as string;
    const parentPath = segments.join("/");

    const { data: listing, error: listErr } = await db.storage.from(INTAKE_BUCKET).list(parentPath);
    const existsInStorage = !listErr && !!listing?.some((obj) => obj.name === objectName);

    if (!existsInStorage) {
      missingStorage += 1;
      continue;
    }

    try {
      await registerCanonicalDocument(db, {
        caseId,
        storageBucket: INTAKE_BUCKET,
        filePath: file.filePath,
        fileName: file.fileName,
        uploadedBy: null,
      });
      recovered += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    expected: expectedFiles.length,
    already_registered: registeredSet.size,
    recovered,
    missing_storage: missingStorage,
    failed,
  };
}

function dedupeFiles(files: DocumentFile[]): DocumentFile[] {
  const byPath = new Map(files.map((f) => [f.filePath, f]));
  return Array.from(byPath.values());
}

function dedupePaths(files: DocumentFile[]): string[] {
  return Array.from(new Set(files.map((f) => f.filePath)));
}
