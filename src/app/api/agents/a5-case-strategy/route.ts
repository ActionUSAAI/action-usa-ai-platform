import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatEvidenceForPrompt } from "@/lib/agents/evidence-formatter";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ============================================================
// A5 — Case Strategy Engine
//
// "A1 mide. A5 decide." — A5 consume criteria_met/criteria_scores
// de A1 como señal de entrada, nunca los recalcula. Construye el
// Case Blueprint completo: teoría del caso, narrativa, priorización
// de criterios (dominant/supporting/corroborative), dependencias de
// evidencia, y estructura sugerida de documentos.
//
// Ver docs/A5_CASE_STRATEGY_ENGINE_DESIGN.md.
//
// Explícitamente fuera de alcance: "Likely USCIS Concerns" y
// "Estimated RFE Risk" — reservados para el futuro RFE Prediction
// Engine (Capa 5 de docs/AUCIS_V2_STRATEGY_LAYER.md).
// ============================================================

interface A5Response {
  theory_of_case: string;
  primary_narrative: string;
  secondary_narrative: string | null;
  dominant_criteria: string[];
  supporting_criteria: string[];
  corroborative_criteria: string[];
  evidence_dependencies: Record<string, string[]>;
  suggested_reinforcements: string[];
  recommended_document_order: string[];
  attorney_letter_outline: string[];
  recommended_exhibit_order: string[];
  criteria_cross_references: string[];
}

function buildSystemPrompt(): string {
  return `Eres el Case Strategy Engine (A5) de AUCIS (ACTION USA AI).

Tu función es construir la teoría jurídica del caso y diseñar la estrategia probatoria que gobernará toda la petición — nunca vuelves a evaluar si un criterio está satisfecho (eso ya lo hizo A1); tu trabajo es decidir cómo se cuenta la historia con lo que A1 ya confirmó.

"A1 mide. A5 decide." Nunca midas lo mismo que A1.

Recibirás: los criterios que A1 marcó como satisfechos, con sus puntajes individuales, y el contenido real y completo de toda la evidencia disponible (referencias, premios, membresías, publicaciones, rol crítico, etc.).

Con eso, construye:
1. **Theory of the Case** — la tesis jurídica central, en una o dos frases.
2. **Primary Narrative** — la historia principal que conecta los criterios dominantes entre sí, no como compartimentos aislados.
3. **Secondary Narrative** — hilos de apoyo, si existen (puede ser null si no aplica).
4. **Dominant / Supporting / Corroborative Criteria** — clasifica cada criterio activo en una de estas tres categorías, según su función real dentro del caso (no todos los criterios pesan igual).
5. **Evidence Dependencies** — para cada criterio, qué evidencia específica (nombre del recomendante, tipo de documento, hecho concreto) mejor lo respalda. Sé específico, cita los hechos reales que recibiste, no genérico.
6. **Suggested Reinforcements** — qué evidencia adicional fortalecería el caso, si el abogado puede conseguirla.
7. **Recommended Document Order** — en qué orden deberían presentarse los documentos del expediente.
8. **Attorney Letter Outline** — estructura sugerida para la Attorney Petition Letter, basada en la teoría del caso.
9. **Recommended Exhibit Order** — orden sugerido de Exhibits.
10. **Cross-References Between Criteria** — conexiones narrativas explícitas entre criterios (ej. "el criterio X se corrobora con el criterio Y porque...").

PROHIBICIÓN CRÍTICA — CRITERION_KEY: los valores de "criterion_key" en dominant_criteria, supporting_criteria, corroborative_criteria, y evidence_dependencies DEBEN ser exclusivamente los que aparecen en la lista "EVALUACIÓN COMPLETA DE A1" que recibirás en el mensaje del usuario. NUNCA generes un criterion_key basado en nombres de campos que veas en la evidencia cruda (ej. nunca uses "artistic_exhibitions", "critical_role_org", "lead_starring_role", "performing_arts_commercial_success" u otros nombres de criterios de categorías de visa distintas — esos pueden aparecer en los datos de evidencia por razones históricas del formulario, pero NO son válidos para la clasificación de este caso). Si un campo de evidencia no corresponde a ningún criterion_key de la lista recibida, ignóralo para efectos de clasificación de criterios, aunque puedas usar su contenido narrativo dentro de foundational_evidence o evidence_dependencies de un criterion_key que sí sea válido.

PROHIBICIÓN CRÍTICA — CRITERIOS NO CONFIRMADOS: nunca incluyas en dominant_criteria ni en supporting_criteria ningún criterion_key marcado como "NO confirmado" por A1. Un criterio no confirmado solo puede aparecer en missing_evidence_links o en reinforcement_opportunities, nunca como si ya estuviera satisfecho.

PROHIBICIÓN CRÍTICA: nunca evalúes riesgo de RFE ni preocupaciones probables de USCIS — eso pertenece a un motor futuro distinto. Tampoco inventes evidencia que no se te haya proporcionado — si algo no está en los datos que recibiste, no lo menciones como si existiera.

Responde ÚNICAMENTE con este JSON, sin texto adicional ni markdown:
{
  "theory_of_case": "string",
  "primary_narrative": "string",
  "secondary_narrative": "string o null",
  "dominant_criteria": ["criterion_key", ...],
  "supporting_criteria": ["criterion_key", ...],
  "corroborative_criteria": ["criterion_key", ...],
  "evidence_dependencies": { "criterion_key": ["evidencia específica 1", "evidencia específica 2"] },
  "suggested_reinforcements": ["string", ...],
  "recommended_document_order": ["string", ...],
  "attorney_letter_outline": ["string", ...],
  "recommended_exhibit_order": ["string", ...],
  "criteria_cross_references": ["string", ...]
}`;
}

function buildUserPrompt(
  criteriaMet: Record<string, boolean>,
  criteriaScores: Record<string, number>,
  m9: Record<string, unknown>,
  m10: Record<string, unknown>
): string {
  const lines: string[] = [];

  lines.push("=== EVALUACIÓN COMPLETA DE A1 — ÚNICOS criterion_key VÁLIDOS PARA ESTE CASO (no los re-evalúes) ===");
  lines.push("IMPORTANTE: estos son los ÚNICOS criterios que existen para esta clasificación. No uses ningún otro nombre de criterio bajo ninguna circunstancia, sin importar qué campos veas en la evidencia cruda más abajo.");
  Object.entries(criteriaMet).forEach(([key, met]) => {
    lines.push(`- ${key}: ${met ? "CONFIRMADO" : "NO confirmado"} (puntaje A1 = ${criteriaScores[key] ?? "N/A"})`);
  });
  const noneConfirmed = Object.values(criteriaMet).every((met) => met === false);
  if (noneConfirmed) {
    lines.push("");
    lines.push("ATENCIÓN: A1 no confirmó NINGÚN criterio como satisfecho en este caso. dominant_criteria y supporting_criteria deben reflejar esta realidad — no inventes criterios confirmados que no existen. Puedes identificar cuáles criterios están MÁS CERCA de cumplirse (mayor puntaje) como foco de desarrollo futuro, pero NUNCA los presentes como si ya estuvieran satisfechos.");
  }
  lines.push("");
  lines.push(formatEvidenceForPrompt(m9, m10));

  return lines.join("\n");
}

async function callClaude(userPrompt: string, systemPrompt: string): Promise<A5Response> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8192, // aumentado de 4096 — mismo truncamiento real detectado
      // que en A1 (commit c807d99), esta vez en el Case Blueprint, que tiene
      // más secciones (narrativas, evidence_dependencies por criterio,
      // cross_references, document/exhibit order) y por tanto necesita más
      // margen para casos ricos en evidencia.
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  const raw: string = data.content?.[0]?.text ?? "";
  try {
    return JSON.parse(raw) as A5Response;
  } catch (firstErr) {
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as A5Response;
      throw firstErr;
    } catch (secondErr) {
      const msg = secondErr instanceof Error ? secondErr.message : String(secondErr);
      // Guardamos el raw completo (no truncado) para poder diagnosticar
      // exactamente qué generó Claude cuando ambos intentos de parseo
      // fallan — mismo patrón de fix que A1 (commit c12baa2).
      throw new Error(`Claude response was not valid JSON (${msg}). RAW: ${raw}`);
    }
  }
}

export async function POST(request: NextRequest) {
  const db = adminDb();
  let body: { case_id: string; submission_id?: string; criteria_met: Record<string, boolean>; criteria_scores: Record<string, number> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { case_id, submission_id, criteria_met, criteria_scores } = body;
  if (!case_id || !criteria_met || !criteria_scores) {
    return NextResponse.json({ error: "Missing required fields: case_id, criteria_met, criteria_scores" }, { status: 400 });
  }

  const { data: run, error: runErr } = await db
    .from("agent_runs")
    .insert({
      case_id,
      agent_name: "case_strategy",
      status: "running",
      started_at: new Date().toISOString(),
      // criteria_met/criteria_scores incluidos para poder auditar exactamente
      // qué evaluó A1 y qué recibió A5 — antes solo se guardaba case_id/
      // submission_id, imposibilitando diagnosticar discrepancias entre
      // ambos motores (hallazgo real, caso María Alejandra Barco Tabares).
      input_snapshot: { case_id, submission_id: submission_id ?? null, criteria_met, criteria_scores },
    })
    .select("id")
    .single();
  if (runErr || !run) {
    return NextResponse.json({ error: "Failed to create agent run", detail: runErr?.message }, { status: 500 });
  }
  const runId = run.id as string;

  try {
    const subQuery = db.from("intake_submissions").select("*");
    const { data: submission, error: subErr } = submission_id
      ? await subQuery.eq("id", submission_id).maybeSingle()
      : await subQuery.eq("case_id", case_id).maybeSingle();

    if (subErr) throw new Error(`Error fetching submission: ${subErr.message}`);
    if (!submission) throw new Error("No intake submission found for this case.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = submission as Record<string, any>;
    const m9 = sub.module9 ?? {};
    const m10 = sub.module10 ?? {};

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(criteria_met, criteria_scores, m9, m10);
    const result = await callClaude(userPrompt, systemPrompt);

    const { data: strategy, error: insertErr } = await db
      .from("case_strategy")
      .insert({
        case_id,
        run_id: runId,
        status: "proposed",
        theory_of_case: result.theory_of_case,
        primary_narrative: result.primary_narrative,
        secondary_narrative: result.secondary_narrative,
        dominant_criteria: result.dominant_criteria,
        supporting_criteria: result.supporting_criteria,
        corroborative_criteria: result.corroborative_criteria,
        evidence_dependencies: result.evidence_dependencies,
        suggested_reinforcements: result.suggested_reinforcements,
        recommended_document_order: result.recommended_document_order,
        attorney_letter_outline: result.attorney_letter_outline,
        recommended_exhibit_order: result.recommended_exhibit_order,
        criteria_cross_references: result.criteria_cross_references,
      })
      .select("*")
      .single();

    if (insertErr || !strategy) {
      throw new Error(`Failed to save case strategy: ${insertErr?.message}`);
    }

    await db
      .from("agent_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        output_summary: { strategy_id: strategy.id, theory_of_case: result.theory_of_case },
      })
      .eq("id", runId);

    return NextResponse.json({ success: true, strategy });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .from("agent_runs")
      .update({ status: "failed", error_detail: msg, completed_at: new Date().toISOString() })
      .eq("id", runId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const db = adminDb();
  let body: {
    strategy_id: string;
    updates?: Partial<{
      theory_of_case: string;
      primary_narrative: string;
      secondary_narrative: string | null;
      dominant_criteria: string[];
      supporting_criteria: string[];
      corroborative_criteria: string[];
      evidence_dependencies: Record<string, string[]>;
      suggested_reinforcements: string[];
      recommended_document_order: string[];
      attorney_letter_outline: string[];
      recommended_exhibit_order: string[];
      criteria_cross_references: string[];
    }>;
    approve?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { strategy_id, updates, approve } = body;
  if (!strategy_id) {
    return NextResponse.json({ error: "Missing required field: strategy_id" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {};
  if (updates) {
    Object.assign(patch, updates);
    patch.edited_at = new Date().toISOString();
  }
  if (approve === true) {
    patch.status = "approved";
    patch.approved_at = new Date().toISOString();
    // NOTA: approved_by (auth.users.id) requiere el usuario autenticado
    // desde el cliente — pendiente de conectar con el sistema de auth
    // real al integrar esta ruta con el panel.
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updates or approve flag provided" }, { status: 400 });
  }

  const { data: strategy, error: updateErr } = await db
    .from("case_strategy")
    .update(patch)
    .eq("id", strategy_id)
    .select("*")
    .single();

  if (updateErr || !strategy) {
    return NextResponse.json({ error: `Failed to update case strategy: ${updateErr?.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, strategy });
}
