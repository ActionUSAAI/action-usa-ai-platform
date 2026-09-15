import type { SupabaseClient } from "@supabase/supabase-js";

// QA Engine — bounded MVP (docs/QA_ENGINE_FINAL_EXACT_DESIGN.md, SHA256
// 33d5f7f07cebfd1acc261e66ea1d10e4f2298671b3c0271a8f0ef8ab678510ab).
// Framework-agnostic domain logic, shared by
// src/app/api/cases/[id]/qa-runs/route.ts and
// supabase/tests/qa-engine-validate.ts, mirroring the separation
// already established by resolve-signed-url-resource.ts (MTCS-07) and
// register-returned-gwp.ts (MTCS-08).
//
// READ -> COMPARE -> SIGNAL only. Never mutates case_strategy,
// agent_intake_analysis, agent_recommendation_letters, or
// agent_petition_drafts. Never triggers A1/A2/A3/A4/A5. No external
// research, no AI, no fuzzy matching — QA-MVP-01's coverage check is a
// pure deterministic set difference.

export interface CurrentBlueprint {
  id: string;
  case_id: string;
  dominant_criteria: string[];
  supporting_criteria: string[];
}

export interface QaFindings {
  blueprint_snapshot: {
    case_strategy_id: string;
    dominant_criteria: string[];
    supporting_criteria: string[];
  } | null;
  evaluated_letters: { id: string; criterion_covered: string }[];
  evaluated_petition_drafts: { id: string; criteria_covered: string[] }[];
  missing_criteria: string[];
  current_blueprint_found: boolean;
}

export interface QaRun {
  id: string;
  case_id: string;
  case_strategy_id: string | null;
  executed_by: string;
  executed_at: string;
  status: "completed";
  findings: QaFindings;
}

// QA-MVP-02 — Blueprint Currency Precondition (design §7/§9). Migration
// 023's currency_status computation already guarantees that a row
// marked 'current' references a Criterion Assessment that is itself
// currency_status='current' — no independent comparison is performed
// here, only the single authoritative read.
export async function resolveCurrentBlueprint(
  db: SupabaseClient,
  caseId: string
): Promise<CurrentBlueprint | null> {
  const { data, error } = await db
    .from("case_strategy")
    .select("id, case_id, dominant_criteria, supporting_criteria")
    .eq("case_id", caseId)
    .eq("currency_status", "current")
    .maybeSingle();
  if (error) throw new Error(`resolveCurrentBlueprint: ${error.message}`);
  if (!data) return null;
  return data as CurrentBlueprint;
}

function normalizeCriterion(value: string): string {
  return value.trim();
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeCriterion))).filter((v) => v.length > 0);
}

// QA-MVP-01 — Criterion Documentary Coverage (design §5/§8/§9). Never
// trusts agent_petition_drafts' own self-reported criteria_covered/
// criteria_missing as authoritative — independently re-derives
// coverage from the actual evaluated documents. Fully deterministic:
// no LLM, no semantic normalization beyond trim/dedupe.
export function computeCriterionCoverage(
  blueprint: CurrentBlueprint,
  letters: { id: string; criterion_covered: string }[],
  petitionDrafts: { id: string; criteria_sections: Record<string, unknown> | null }[]
): { missing_criteria: string[]; covered_by_letters: string[]; covered_by_petition: string[] } {
  const required = dedupe([...blueprint.dominant_criteria, ...blueprint.supporting_criteria]);

  const coveredByLetters = dedupe(letters.map((l) => l.criterion_covered));

  const coveredByPetition = dedupe(
    petitionDrafts.flatMap((p) =>
      p.criteria_sections
        ? Object.entries(p.criteria_sections)
            .filter(([, v]) => v !== null && v !== undefined && String(v).trim().length > 0)
            .map(([k]) => k)
        : []
    )
  );

  const covered = new Set([...coveredByLetters, ...coveredByPetition]);
  const missing = required.filter((c) => !covered.has(c));

  return { missing_criteria: missing, covered_by_letters: coveredByLetters, covered_by_petition: coveredByPetition };
}

export interface RunQaEngineParams {
  caseId: string;
  executedBy: string;
}

export type RunQaEngineResult =
  | { ok: true; run: QaRun }
  | { ok: false; error: { code: "PERSISTENCE_FAILURE"; message: string } };

// Orchestrates a single explicit QA execution: resolve inputs
// server-side -> compute deterministic results -> persist one
// immutable qa_runs row (same-case + immutability DB-enforced by
// migration 034's triggers) -> return the result. Never accepts
// caller-supplied document/Blueprint identities — every input is
// derived from the authorized caseId only.
export async function runQaEngine(db: SupabaseClient, params: RunQaEngineParams): Promise<RunQaEngineResult> {
  const { caseId, executedBy } = params;

  const blueprint = await resolveCurrentBlueprint(db, caseId);

  let findings: QaFindings;

  if (!blueprint) {
    findings = {
      blueprint_snapshot: null,
      evaluated_letters: [],
      evaluated_petition_drafts: [],
      missing_criteria: [],
      current_blueprint_found: false,
    };
  } else {
    const { data: letterRows, error: letterErr } = await db
      .from("agent_recommendation_letters")
      .select("id, criterion_covered")
      .eq("case_id", caseId);
    if (letterErr) return { ok: false, error: { code: "PERSISTENCE_FAILURE", message: `letters read failed: ${letterErr.message}` } };

    const { data: petitionRows, error: petitionErr } = await db
      .from("agent_petition_drafts")
      .select("id, criteria_covered, criteria_sections")
      .eq("case_id", caseId);
    if (petitionErr) return { ok: false, error: { code: "PERSISTENCE_FAILURE", message: `petition drafts read failed: ${petitionErr.message}` } };

    const letters = (letterRows ?? []) as { id: string; criterion_covered: string }[];
    const petitionDrafts = (petitionRows ?? []) as { id: string; criteria_covered: string[] | null; criteria_sections: Record<string, unknown> | null }[];

    const { missing_criteria } = computeCriterionCoverage(blueprint, letters, petitionDrafts);

    findings = {
      blueprint_snapshot: {
        case_strategy_id: blueprint.id,
        dominant_criteria: blueprint.dominant_criteria,
        supporting_criteria: blueprint.supporting_criteria,
      },
      evaluated_letters: letters.map((l) => ({ id: l.id, criterion_covered: l.criterion_covered })),
      evaluated_petition_drafts: petitionDrafts.map((p) => ({ id: p.id, criteria_covered: p.criteria_covered ?? [] })),
      missing_criteria,
      current_blueprint_found: true,
    };
  }

  const { data: inserted, error: insertErr } = await db
    .from("qa_runs")
    .insert({
      case_id: caseId,
      case_strategy_id: blueprint?.id ?? null,
      executed_by: executedBy,
      findings,
    })
    .select("*")
    .single();
  if (insertErr || !inserted) {
    return { ok: false, error: { code: "PERSISTENCE_FAILURE", message: insertErr?.message ?? "insert returned no row" } };
  }

  return { ok: true, run: inserted as QaRun };
}
