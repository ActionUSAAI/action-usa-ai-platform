import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatEvidenceForPrompt } from "@/lib/agents/evidence-formatter";
import { resolveCriteriaSet } from "@/lib/canonical-criteria";

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
// Case Blueprint completo conforme a
// docs/A5_CASE_BLUEPRINT_SPECIFICATION_V2.md y
// docs/AUCIS_BLUEPRINT_CONTRACT_V2.md (Blueprint Field Audit,
// 2026-08-02).
//
// Removidos en v2 (ADR-008 — pertenecen a Document Generation
// Layer / Workflow, no al Core Legal Engine): petition_strategy_alignment,
// document_directives, generation_priorities, attorney_instructions.
// También removidos por el mismo criterio, nunca estuvieron en la
// v2 aprobada: recommended_document_order, attorney_letter_outline,
// recommended_exhibit_order.
//
// Deferred — Pending Empirical Validation (Blueprint Field Audit):
// evidence_priority, strategic_priorities, review_notes. Se generan
// solo si el propio modelo los considera relevantes (nunca
// obligatorios), y nunca se reinterpretan ni se fuerzan.
//
// Explícitamente fuera de alcance: "Likely USCIS Concerns" y
// "Estimated RFE Risk" — reservados para el futuro RFE Prediction
// Engine.
// ============================================================

interface ReasoningProvenance {
  source_type: "case_evidence" | "org_pattern" | "global_pattern";
  influence_weight: number;
  explanation: string;
  reference_id: string | null;
}

interface FoundationalEvidenceItem {
  evidence_item_id: string | null;
  description: string;
  why_foundational: string;
}

interface CrossReference {
  criteria: [string, string];
  connection: string;
}

interface A5Response {
  theory_of_case: string;
  primary_narrative: string;
  secondary_narrative: string | null;
  dominant_criteria: string[];
  supporting_criteria: string[];
  corroborative_criteria: string[];
  foundational_evidence: FoundationalEvidenceItem[];
  evidence_dependencies: Record<string, string[]>;
  evidence_priority: Record<string, string[]> | null;
  argument_sequence: string[];
  cross_references: CrossReference[];
  strategic_priorities: string[];
  reinforcement_opportunities: string[];
  missing_evidence_links: string[];
  review_notes: string | null;
  reasoning_provenance: {
    theory_of_case?: ReasoningProvenance[];
    primary_narrative?: ReasoningProvenance[];
    secondary_narrative?: ReasoningProvenance[];
    dominant_criteria?: Record<string, ReasoningProvenance[]>;
    supporting_criteria?: Record<string, ReasoningProvenance[]>;
    corroborative_criteria?: Record<string, ReasoningProvenance[]>;
    foundational_evidence?: ReasoningProvenance[];
    evidence_dependencies?: Record<string, ReasoningProvenance[]>;
    evidence_priority?: ReasoningProvenance[];
    argument_sequence?: ReasoningProvenance[];
    strategic_priorities?: ReasoningProvenance[];
    reinforcement_opportunities?: ReasoningProvenance[];
    missing_evidence_links?: ReasoningProvenance[];
  };
}

function buildSystemPrompt(): string {
  return `Eres el Case Strategy Engine (A5) de AUCIS (ACTION USA AI).
Tu función es construir la teoría jurídica del caso y diseñar la estrategia probatoria que gobernará toda la petición — nunca vuelves a evaluar si un criterio está satisfecho (eso ya lo hizo A1); tu trabajo es decidir cómo se cuenta la historia con lo que A1 ya confirmó.
"A1 mide. A5 decide." Nunca midas lo mismo que A1.

Recibirás: los criterios que A1 marcó como satisfechos, con sus puntajes individuales, y el contenido real y completo de toda la evidencia disponible (referencias, premios, membresías, publicaciones, rol crítico, etc.).

Con eso, construye:
1. **Theory of the Case** — la tesis jurídica central, en una o dos frases. OBLIGATORIO SIN EXCEPCIÓN, incluso si A1 no confirmó ningún criterio todavía: en ese escenario, la tesis debe describir honestamente el estado actual del desarrollo probatorio y la dirección estratégica (ej. "el caso tiene potencial en X pero requiere desarrollar evidencia en Y antes de ser viable"), nunca afirmar que hay criterios satisfechos que no lo están. NUNCA dejes este campo null o vacío — la prohibición de no presentar criterios no confirmados como satisfechos aplica a dominant_criteria/supporting_criteria, no te exime de escribir una tesis honesta sobre el estado real del caso.
2. **Primary Narrative** — la historia principal que conecta los criterios dominantes entre sí, no como compartimentos aislados. Mismo criterio que Theory of the Case: OBLIGATORIO SIN EXCEPCIÓN — si no hay criterios dominantes confirmados todavía, describe la narrativa de desarrollo probatorio (qué historia podría construirse y qué falta para sostenerla), nunca lo dejes null.
3. **Secondary Narrative** — hilos de apoyo, si existen (puede ser null si no aplica).
4. **Dominant / Supporting / Corroborative Criteria** — clasifica cada criterio activo en una de estas tres categorías, según su función real dentro del caso.
5. **Foundational Evidence** — la pieza (o pocas piezas) de evidencia sobre la que descansa la teoría completa del caso. Cada elemento: description (texto), why_foundational (por qué ancla la teoría). evidence_item_id siempre null hoy (no existe esa entidad todavía).
6. **Evidence Dependencies** — para cada criterio, qué evidencia específica mejor lo respalda. Sé específico, cita los hechos reales que recibiste.
7. **Evidence Priority** (opcional) — solo si hay más de una evidencia por criterio y su orden de importancia es relevante. Map criterion_key → array ordenado. Si no aplica, omite el campo o usa null.
8. **Argument Sequence** — secuencia lógica de argumentos, en el orden en que deberían razonarse. NUNCA capítulos de documento ni estructura de Attorney Letter — eso lo decide A4, no tú.
9. **Cross-References Between Criteria** — array de objetos {criteria: [key, key], connection: string} — conexiones narrativas explícitas entre criterios.
10. **Strategic Priorities** (opcional) — solo si hay un matiz táctico genuino que dominant/supporting/corroborative no capturan ya. No repitas esa clasificación con otras palabras.
11. **Reinforcement Opportunities** — qué evidencia adicional fortalecería el caso, si el abogado puede conseguirla.
12. **Missing Evidence Links** — vacíos probatorios que afectan la estrategia actual. Nunca predicción de RFE.
13. **Review Notes** — normalmente null; tú no rellenas este campo, es espacio para el abogado.
14. **Reasoning Provenance** — para cada campo de decisión que produzcas, agrega en reasoning_provenance la explicación de por qué llegaste a esa conclusión. source_type siempre "case_evidence". influence_weight siempre 1.0. reference_id siempre null (no existe Evidence Item tipada todavía). explanation: una frase concreta de por qué esa fuente influyó en esa decisión.

ACLARACIÓN IMPORTANTE: la prohibición de no presentar criterios no confirmados como satisfechos (ver más abajo) aplica exclusivamente a los campos dominant_criteria, supporting_criteria, y evidence_dependencies. NUNCA la extiendas a theory_of_case ni primary_narrative — esos dos campos son obligatorios siempre, y con cero criterios confirmados deben describir honestamente el estado de desarrollo del caso, no quedar vacíos.

PROHIBICIÓN CRÍTICA — CRITERION_KEY: los valores de "criterion_key" en dominant_criteria, supporting_criteria, corroborative_criteria, y evidence_dependencies DEBEN ser exclusivamente los que aparecen en la lista "EVALUACIÓN COMPLETA DE A1" que recibirás en el mensaje del usuario. NUNCA generes un criterion_key basado en nombres de campos que veas en la evidencia cruda (ej. nunca uses "artistic_exhibitions", "critical_role_org", "lead_starring_role", "performing_arts_commercial_success" u otros nombres de criterios de categorías de visa distintas). Si un campo de evidencia no corresponde a ningún criterion_key de la lista recibida, ignóralo para efectos de clasificación de criterios, aunque puedas usar su contenido narrativo dentro de foundational_evidence o evidence_dependencies de un criterion_key que sí sea válido.

PROHIBICIÓN CRÍTICA — CRITERIOS NO CONFIRMADOS: nunca incluyas en dominant_criteria ni en supporting_criteria ningún criterion_key marcado como "NO confirmado" por A1. Un criterio no confirmado solo puede aparecer en missing_evidence_links o en reinforcement_opportunities, nunca como si ya estuviera satisfecho.

PROHIBICIÓN CRÍTICA: nunca evalúes riesgo de RFE ni preocupaciones probables de USCIS. Tampoco inventes evidencia que no se te haya proporcionado.

PROHIBICIÓN CRÍTICA — ESTRUCTURA DOCUMENTAL: nunca generes capítulos de documento, índices de Exhibits, ni ningún campo equivalente a "attorney_letter_outline" o "recommended_exhibit_order" — esa responsabilidad pertenece exclusivamente a Document Generation Layer (A4), que la deriva de argument_sequence y cross_references. Tu única salida es argument_sequence como secuencia lógica de razonamiento, nunca como estructura de documento.

Responde ÚNICAMENTE con este JSON, sin texto adicional ni markdown:
{
  "theory_of_case": "string",
  "primary_narrative": "string",
  "secondary_narrative": "string o null",
  "dominant_criteria": ["criterion_key", ...],
  "supporting_criteria": ["criterion_key", ...],
  "corroborative_criteria": ["criterion_key", ...],
  "foundational_evidence": [{ "evidence_item_id": null, "description": "string", "why_foundational": "string" }],
  "evidence_dependencies": { "criterion_key": ["evidencia específica 1", "evidencia específica 2"] },
  "evidence_priority": { "criterion_key": ["evidencia más fuerte primero", "..."] } o null,
  "argument_sequence": ["string", ...],
  "cross_references": [{ "criteria": ["key1", "key2"], "connection": "string" }],
  "strategic_priorities": ["string", ...],
  "reinforcement_opportunities": ["string", ...],
  "missing_evidence_links": ["string", ...],
  "review_notes": null,
  "reasoning_provenance": {
    "theory_of_case": [{ "source_type": "case_evidence", "influence_weight": 1.0, "explanation": "string", "reference_id": null }]
  }
}`;
}

// PENDIENTE — encontrado 2026-08-14 (caso sintético Juan Lopez,
// case_id 443bf280-ec96-4b8f-b9bd-c3809b5a1787): esta función nunca
// recibe visaType/classification como parámetro — A5 no sabe si el
// caso es O-1A, O-1B, o EB-1A. En este caso real, el modelo mencionó
// "petición EB-1A" en theory_of_case cuando module1.visaType era
// "O-1A" — inferencia libre sin dato real que la sustente. No rompe
// la mecánica de clasificación de criterios (criterion_key es
// agnóstico de clasificación por diseño, según
// A5_CASE_BLUEPRINT_SPECIFICATION_V2.md), pero puede producir
// narrativa (theory_of_case, primary_narrative) que menciona la
// clasificación de visa equivocada en prosa. No corregido en esta
// sesión — encontrado durante la validación de un pendiente distinto
// (petitionStrategy: singleAchievement en A4), fuera del alcance de
// esa validación. Fix propuesto, no implementado: pasar
// visaType/classification a buildUserPrompt, similar a como ya lo
// hace a1-intake-analyzer/route.ts.
function buildUserPrompt(
  criteriaMet: Record<string, boolean>,
  criteriaScores: Record<string, number>,
  m9: Record<string, unknown>,
  m10: Record<string, unknown>,
  classification: string
): string {
  const lines: string[] = [];
  lines.push(`CLASIFICACIÓN JURÍDICA VIGENTE DEL CASO (Case.active_legal_petition): ${classification}`);
  lines.push("Usa exclusivamente esta clasificación en tu razonamiento -- nunca menciones ni asumas otra clasificación distinta a esta, sin importar lo que sugiera la evidencia cruda del intake.");
  lines.push("");
  lines.push("=== EVALUACIÓN COMPLETA DE A1 — ÚNICOS criterion_key VÁLIDOS PARA ESTE CASO (no los re-evalúes) ===");
  lines.push("IMPORTANTE: estos son los ÚNICOS criterios que existen para esta clasificación. No uses ningún otro nombre de criterio bajo ninguna circunstancia, sin importar qué campos veas en la evidencia cruda más abajo.");
  Object.entries(criteriaMet).forEach(([key, met]) => {
    lines.push(`- ${key}: ${met ? "CONFIRMADO" : "NO confirmado"} (puntaje A1 = ${criteriaScores[key] ?? "N/A"})`);
  });
  const noneConfirmed = Object.values(criteriaMet).every((met) => met === false);
  if (noneConfirmed) {
    lines.push("");
    lines.push("ATENCIÓN: A1 no confirmó NINGÚN criterio como satisfecho en este caso. dominant_criteria y supporting_criteria deben reflejar esta realidad — no inventes criterios confirmados que no existen. Puedes identificar cuáles criterios están MÁS CERCA de cumplirse (mayor puntaje) como foco de desarrollo futuro en missing_evidence_links/reinforcement_opportunities, pero NUNCA los presentes como si ya estuvieran satisfechos.");
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
  let body: { case_id: string; submission_id?: string; criteria_met: Record<string, boolean>; criteria_scores: Record<string, number>; criterion_assessment_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { case_id, submission_id, criteria_met, criteria_scores, criterion_assessment_id } = body;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any;

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
    // Fase 3: la única fuente jurídica es Case.active_legal_petition. Antes
    // de esta fase, A5 no recibía ninguna clasificación -- causa raíz del
    // bug original (theory_of_case mencionando "EB-1A" sin fundamento real,
    // caso Juan Lopez, 2026-08-14). resolveCriteriaSet() nunca falla por sí
    // sola ante un valor vacío/inválido (retorna O-1A por defecto de forma
    // silenciosa) -- la verificación debe ocurrir explícitamente antes.
    const { data: caseRowForA5, error: caseErrForA5 } = await db
      .from("cases")
      .select("active_legal_petition")
      .eq("id", case_id)
      .maybeSingle();
    if (caseErrForA5) throw new Error(`Error fetching case: ${caseErrForA5.message}`);
    if (!caseRowForA5?.active_legal_petition) {
      throw new Error(
        "Case is missing active_legal_petition. A5 can only build a strategy for a case whose legal classification has been confirmed. Use the Legal Decision Procedure, which enforces this via the Legal Decision Cycle Policy Contract v1."
      );
    }
    const { classification: classificationForA5 } = resolveCriteriaSet(caseRowForA5.active_legal_petition);

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(criteria_met, criteria_scores, m9, m10, classificationForA5);
    result = await callClaude(userPrompt, systemPrompt);

    // ── Determine current version chain for this case ──────────────────────
    // El lifecycle (proposed/edited/approved/locked) describe etapas de
    // revisión de UNA fila — no garantiza por sí solo que exista una sola
    // versión vigente por caso. Esa garantía la construye este código:
    // antes de insertar, buscamos cualquier fila no-superseded existente
    // (la más reciente por created_at) y la marcamos superseded al insertar
    // la nueva — mismo patrón ya aplicado en a1-intake-analyzer/route.ts.
    const { data: previousCurrent } = await db
      .from("case_strategy")
      .select("id, version")
      .eq("case_id", case_id)
      .neq("status", "superseded")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = previousCurrent ? previousCurrent.version + 1 : 1;

    const { data: strategy, error: insertErr } = await db
      .from("case_strategy")
      .insert({
        case_id,
        run_id: runId,
        status: "proposed",
        version: nextVersion,
        criterion_assessment_id: criterion_assessment_id ?? null,
        theory_of_case: result.theory_of_case,
        primary_narrative: result.primary_narrative,
        secondary_narrative: result.secondary_narrative,
        dominant_criteria: result.dominant_criteria,
        supporting_criteria: result.supporting_criteria,
        corroborative_criteria: result.corroborative_criteria,
        foundational_evidence: result.foundational_evidence,
        evidence_dependencies: result.evidence_dependencies,
        evidence_priority: result.evidence_priority,
        argument_sequence: result.argument_sequence,
        criteria_cross_references: result.cross_references,
        strategic_priorities: result.strategic_priorities,
        suggested_reinforcements: result.reinforcement_opportunities,
        missing_evidence_links: result.missing_evidence_links,
        review_notes: result.review_notes,
        reasoning_provenance: result.reasoning_provenance,
      })
      .select("*")
      .single();

    if (insertErr || !strategy) {
      throw new Error(`Failed to save strategy: ${insertErr?.message}`);
    }

    // ── Supersede the previous version, if one existed ──────────────────────
    // No bloqueante: si esto falla, la nueva fila ya quedó guardada
    // correctamente; solo registramos el error sin interrumpir la respuesta.
    if (previousCurrent) {
      const { error: supersedeErr } = await db
        .from("case_strategy")
        .update({ status: "superseded", superseded_by: strategy.id })
        .eq("id", previousCurrent.id);
      if (supersedeErr) {
        console.error(`Failed to mark previous strategy ${previousCurrent.id} as superseded:`, supersedeErr.message);
      }
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
    // Captura el último result parseado conocido (si callClaude() tuvo
    // éxito pero un paso posterior, ej. el INSERT, falló) — antes se
    // perdía por completo, dejando el fallo real (qué campo vino mal
    // formado) sin ningún rastro diagnosticable. Hallazgo real, caso
    // María Alejandra Barco Tabares, 2026-08-08: theory_of_case llegó
    // null en un JSON por lo demás válido, sin captura del raw porque
    // el parseo en sí no había fallado.
    await db
      .from("agent_runs")
      .update({
        status: "failed",
        error_detail: msg,
        completed_at: new Date().toISOString(),
        output_summary: typeof result !== "undefined" ? { last_parsed_result: result } : null,
      })
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
      foundational_evidence: unknown[];
      evidence_dependencies: Record<string, string[]>;
      evidence_priority: Record<string, string[]> | null;
      argument_sequence: string[];
      criteria_cross_references: unknown[];
      strategic_priorities: string[];
      suggested_reinforcements: string[];
      missing_evidence_links: string[];
      review_notes: string | null;
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
    if (!patch.status) patch.status = "edited";
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
