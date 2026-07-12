import { createClient } from "@supabase/supabase-js";
import { criteriaSetForClassification, type Classification } from "@/lib/canonical-criteria";

// ============================================================
// A4 Exhibit Assembly — implements docs/A4_EXHIBIT_ASSEMBLY.md v1.2.
// Deterministic, no model call. Produces one case_exhibits row per
// active criterion, grouping agent_recommendation_letters rows by
// criterion_key in canonical order (canonical-criteria.ts).
//
// Simple case only (per this session's scope): assumes no existing
// case_exhibits rows for this case, so the merge-on-manual-reorder
// mechanism (suggested_merge_refs) is not exercised here — a
// re-assembly path for existing manually-reordered Exhibits is a
// separate, not-yet-implemented piece.
// ============================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface DocumentRef {
  sourceType: "a3_testimonial" | "a3_institutional" | "module10_upload";
  letterId: string | null;
  documentPath: string | null;
  documentLabel: string;
}

export interface ExhibitAssemblyResult {
  caseId: string;
  classification: Classification;
  exhibitsCreated: number;
  exhibitNumbers: number[];
}

// Critical role 4a/4b count as a single criterion — same business
// rule as A1's buildSystemPrompt countingRule.
function resolveActiveCriteria(criteriaMet: Record<string, boolean>): string[] {
  const active: string[] = [];
  let criticalRoleCounted = false;

  for (const [key, met] of Object.entries(criteriaMet ?? {})) {
    if (!met) continue;
    if (key === "critical_role_4a" || key === "critical_role_4b") {
      if (!criticalRoleCounted) {
        active.push(key);
        criticalRoleCounted = true;
      }
      continue;
    }
    active.push(key);
  }
  return active;
}

export async function assembleExhibits(caseId: string): Promise<ExhibitAssemblyResult> {
  const db = adminDb();

  const { data: analysis, error: analysisError } = await db
    .from("agent_intake_analysis")
    .select("classification_used, criteria_met")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (analysisError || !analysis) {
    throw new Error(
      `No agent_intake_analysis found for case ${caseId}: ${analysisError?.message ?? "no rows"}`
    );
  }

  const classification = (analysis.classification_used as Classification) ?? "O-1A";
  const activeCriteria = resolveActiveCriteria(analysis.criteria_met as Record<string, boolean>);

  const canonicalOrder = criteriaSetForClassification(classification).map((c) => c.key);
  const orderedActive = canonicalOrder.filter((key) => activeCriteria.includes(key));

  const { data: letters, error: lettersError } = await db
    .from("agent_recommendation_letters")
    .select("id, criterion_key, motor, recommender_name, docx_path")
    .eq("case_id", caseId)
    .not("criterion_key", "is", null);

  if (lettersError) {
    throw new Error(`Failed to load letters for case ${caseId}: ${lettersError.message}`);
  }

  const exhibitNumbers: number[] = [];
  let exhibitNumber = 1;

  for (const criterionKey of orderedActive) {
    const criterionLetters = (letters ?? []).filter((l) => l.criterion_key === criterionKey);

    const documentRefs: DocumentRef[] = criterionLetters.map((l) => ({
      sourceType: l.motor === "testimonial" ? "a3_testimonial" : "a3_institutional",
      letterId: l.id,
      documentPath: l.docx_path,
      documentLabel: `Letter from ${l.recommender_name}`,
    }));

    const criterionDef = criteriaSetForClassification(classification).find(
      (c) => c.key === criterionKey
    );

    const { error: insertError } = await db.from("case_exhibits").insert({
      case_id: caseId,
      exhibit_number: exhibitNumber,
      criterion_citation: criterionDef?.citation ?? criterionKey,
      criterion_label: criterionDef?.label ?? criterionKey,
      document_refs: documentRefs,
      manually_reordered: false,
    });

    if (insertError) {
      throw new Error(
        `Failed to create Exhibit ${exhibitNumber} (${criterionKey}) for case ${caseId}: ${insertError.message}`
      );
    }

    exhibitNumbers.push(exhibitNumber);
    exhibitNumber++;
  }

  return { caseId, classification, exhibitsCreated: exhibitNumbers.length, exhibitNumbers };
}
