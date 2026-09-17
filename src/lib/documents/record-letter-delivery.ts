import type { SupabaseClient } from "@supabase/supabase-js";

// Human Review Gate — Approved-to-Sent Transition (docs/HUMAN_REVIEW_
// GATE_APPROVED_TO_SENT_FINAL_EXACT_DESIGN.md, SHA256 3b18a26d5511044
// 0220fe71cbcbed0e70101cb32cfa13cb0a0cf0265f63dba7d — reconciled,
// D-REC-01). Framework-agnostic domain logic, shared by
// src/app/api/case-letters/route.ts and
// supabase/tests/human-review-gate-validate.ts, mirroring the
// separation already established by register-returned-gwp.ts
// (MTCS-08) and run-qa-engine.ts (QA Engine).
//
// The client-facing command `status: "sent"` never persists
// `status = "sent"`: delivery is recorded as orthogonal metadata
// (sent_by/sent_at) so that `status` remains "approved" permanently
// -- src/lib/documents/register-returned-gwp.ts's eligibility check
// (status === "approved") is therefore unaffected before and after
// delivery is recorded.

export interface DeliverableLetter {
  id: string;
  status: string;
  sent_at: string | null;
}

export type RecordLetterDeliveryError =
  | { code: "INELIGIBLE"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "PERSISTENCE_FAILURE"; message: string };

export type RecordLetterDeliveryResult =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { ok: true; letter: any }
  | { ok: false; error: RecordLetterDeliveryError };

export async function recordLetterDelivery(
  db: SupabaseClient,
  letter: DeliverableLetter,
  callerId: string
): Promise<RecordLetterDeliveryResult> {
  if (letter.status !== "approved" || letter.sent_at !== null) {
    return {
      ok: false,
      error: {
        code: "INELIGIBLE",
        message: `Letter ${letter.id} is not eligible to be marked sent (status='${letter.status}', sent_at='${letter.sent_at}'); expected status='approved' and sent_at=null.`,
      },
    };
  }

  // Update condicionado a approved+unsent (evita que dos confirmaciones
  // concurrentes de entrega, o una repetida, pisen silenciosamente el
  // resultado). `status` nunca se incluye en el patch.
  const { data: updated, error: updateErr } = await db
    .from("agent_recommendation_letters")
    .update({ sent_by: callerId, sent_at: new Date().toISOString() })
    .eq("id", letter.id)
    .eq("status", "approved")
    .is("sent_at", null)
    .select("*")
    .maybeSingle();
  if (updateErr) {
    return { ok: false, error: { code: "PERSISTENCE_FAILURE", message: `Failed to record delivery: ${updateErr.message}` } };
  }
  if (!updated) {
    return { ok: false, error: { code: "CONFLICT", message: "Letter delivery state changed concurrently -- retry." } };
  }

  return { ok: true, letter: updated };
}
