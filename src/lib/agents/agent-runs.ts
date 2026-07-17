import { type SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Shared agent_runs lifecycle helpers — extracted from
// a4-attorney-docx-builder.ts to avoid a third/fourth duplication
// across A3's two letter-generation builders (Testimonial,
// Institutional), which both need run_id (NOT NULL on
// agent_recommendation_letters) but previously wrote none —
// discovered via live testing, not caught by build/type-check
// since the Supabase client doesn't validate schema at compile
// time.
// ============================================================

// Permissive client type — the builders' local adminDb() infers
// SupabaseClient<any, "public", ...>, which is not assignable to the
// `never`-schema defaults of a bare ReturnType<typeof createClient>.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminDbClient = SupabaseClient<any, any, any>;

export async function createAgentRun(
  db: AdminDbClient,
  caseId: string,
  agentName: string,
  inputSnapshot: Record<string, unknown>
): Promise<string> {
  const { data: run, error } = await db
    .from("agent_runs")
    .insert({
      case_id: caseId,
      agent_name: agentName,
      status: "running",
      started_at: new Date().toISOString(),
      input_snapshot: inputSnapshot,
    })
    .select("id")
    .single();

  if (error || !run) {
    throw new Error(`Failed to create agent run: ${error?.message}`);
  }
  return run.id as string;
}

export async function completeAgentRun(
  db: AdminDbClient,
  runId: string,
  outputSummary: Record<string, unknown>
): Promise<void> {
  await db
    .from("agent_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      output_summary: outputSummary,
    })
    .eq("id", runId);
}

export async function failAgentRun(
  db: AdminDbClient,
  runId: string,
  message: string
): Promise<void> {
  await db
    .from("agent_runs")
    .update({
      status: "failed",
      error_detail: message,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
}
