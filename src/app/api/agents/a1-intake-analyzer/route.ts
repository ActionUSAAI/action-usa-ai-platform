import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CriterionDef, resolveCriteriaSet } from "@/lib/canonical-criteria";
import { str } from "@/lib/agents/shared-helpers";
import { formatEvidenceForPrompt } from "@/lib/agents/evidence-formatter";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildSystemPrompt(
  classification: "O-1A" | "O-1B" | "EB-1A",
  criteria: CriterionDef[]
): string {
  const criteriaList = criteria.map(c => `- ${c.key}: ${c.label}`).join("\n");
  const scoresSchema = criteria.map(c => `    "${c.key}": 0-100`).join(",\n");
  const metSchema = criteria.map(c => `    "${c.key}": true/false`).join(",\n");
  const gapsSchema = criteria.map(c => `    "${c.key}": "descripción de brecha o null si está cubierto"`).join(",\n");

  const hasSplitCriticalRole =
    criteria.some(c => c.key === "critical_role_4a") && criteria.some(c => c.key === "critical_role_4b");

  const countingRule = hasSplitCriticalRole
    ? `\nNOTA IMPORTANTE SOBRE CONTEO: critical_role_4a y critical_role_4b representan el MISMO criterio regulatorio (rol crítico/esencial en organización distinguida), evaluado por dos mecanismos de prueba distintos (cargo directivo/electo vs. técnico/instructor). Si AMBOS resultan "met" = true, cuentan como UN SOLO criterio satisfecho para el umbral mínimo, no como dos.`
    : "";

  return `Eres el Agente A1 — Intake Analyzer de AUCIS (Automated Case Intelligence System) de ACTION USA AI.

Tu función es analizar los datos de intake de un cliente y evaluar su viabilidad para una petición ${classification}, basándote en los criterios de USCIS correspondientes a esa clasificación.

CRITERIOS ${classification} (evalúa cada uno con un puntaje 0-100):
${criteriaList}

METODOLOGÍA DE PUNTAJE:
- 75-100: VIABLE — Evidencia sólida, suficiente para sustentar el criterio en la petición
- 50-74: DESARROLLABLE — Alguna evidencia pero necesita fortalecerse o documentarse mejor
- 25-49: DÉBIL — Evidencia limitada, brechas significativas
- 0-24: AUSENTE — Sin evidencia encontrada

Un criterio se considera "met" (criteria_met = true) si su puntaje es ≥ 60.
Se requieren al menos 3 criterios met.${countingRule}

Considera también:
- El estado declarado ("tengo/tal_vez/no_tengo") refleja la percepción del cliente — verifica con la evidencia concreta
- Las notas de disposición ("no_tengo") son oportunidades de desarrollo prospectivo
- Las respuestas del Módulo 11 son indicadores cualitativos del perfil

Devuelve ÚNICAMENTE este objeto JSON exacto, sin markdown ni explicación adicional:
{
  "visa_recommendation": "O-1A" | "O-1B" | "EB-1A" | "O-1A/EB-1A" | "unclear",
  "visa_confidence": "high" | "medium" | "low",
  "overall_strength": "strong" | "moderate" | "weak",
  "criteria_scores": {
${scoresSchema}
  },
  "criteria_met": {
${metSchema}
  },
  "criteria_gaps": {
${gapsSchema}
  },
  "strengths": ["fortaleza 1", "fortaleza 2", ...],
  "weaknesses": ["debilidad 1", "debilidad 2", ...],
  "strategic_notes": "Resumen estratégico ejecutivo para el equipo legal (3-5 oraciones)",
  "recommended_actions": ["acción 1", "acción 2", ...]
}`;
}

// ── Prompt builder ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildUserPrompt(sub: Record<string, any>): string {
  const m1  = sub.module1  ?? {};
  const m5  = sub.module5  ?? {};
  const m6  = sub.module6  ?? {};
  const m7  = sub.module7  ?? {};
  const m8  = sub.module8  ?? {};
  const m9  = sub.module9  ?? {};
  const m10 = sub.module10 ?? {};
  const m11 = sub.module11 ?? {};

  const lines: string[] = [];

  // ── Identity
  lines.push("=== PERFIL DEL SOLICITANTE ===");
  lines.push(`Nombre: ${str(m1.fullName)}`);
  lines.push(`Profesión declarada: ${str(m1.profession)}`);
  lines.push(`Industria: ${str(m1.industry)}`);
  lines.push(`Años de experiencia: ${str(m1.yearsExperience)}`);
  lines.push(`Visa de interés: ${str(m1.visaType)}`);
  lines.push(`Objetivo en EE.UU.: ${str(m1.usaObjective)}`);
  lines.push(`País de origen: ${str(m1.countryOfBirth)}`);
  lines.push(`País de residencia: ${str(m1.countryOfResidence)}`);

  // ── Education
  lines.push("\n=== EDUCACIÓN ===");
  const degrees = (m5.degrees ?? []) as Record<string, unknown>[];
  if (degrees.length === 0) {
    lines.push("Sin títulos registrados.");
  } else {
    degrees.forEach((d, i) => {
      lines.push(`Título ${i + 1}: ${str(d.degreeType)} en ${str(d.degreeName)} — ${str(d.institution)} (${str(d.country)}, ${str(d.graduationYear)})`);
    });
  }

  // ── Certifications
  lines.push("\n=== CERTIFICACIONES ===");
  const certs = (m6.certifications ?? []) as Record<string, unknown>[];
  if (certs.length === 0) {
    lines.push("Sin certificaciones registradas.");
  } else {
    certs.forEach(c => {
      lines.push(`- ${str(c.name)} — ${str(c.institution)} (${str(c.year)})`);
    });
  }

  // ── Employment
  lines.push("\n=== HISTORIAL LABORAL ===");
  const jobs = (m7.employment ?? []) as Record<string, unknown>[];
  if (jobs.length === 0) {
    lines.push("Sin empleos registrados.");
  } else {
    jobs.forEach((e, i) => {
      lines.push(`Empleo ${i + 1}: ${str(e.title)} en ${str(e.company)} (${str(e.country)})`);
      lines.push(`  Período: ${str(e.startDate)} — ${e.isCurrent ? "Presente" : str(e.endDate)}`);
      if (str(e.mainFunctions)) lines.push(`  Funciones: ${str(e.mainFunctions)}`);
      if (str(e.mainAchievements)) lines.push(`  Logros: ${str(e.mainAchievements)}`);
      if (str(e.peopleSupervised) && str(e.peopleSupervised) !== "0") lines.push(`  Personas supervisadas: ${str(e.peopleSupervised)}`);
      if (e.managesBudget) lines.push(`  Gestiona presupuesto: Sí — ${str(e.budgetAmount)}`);
      if (str(e.internationalRecognition)) lines.push(`  Reconocimiento internacional: ${str(e.internationalRecognition)}`);
    });
  }

  // ── Own businesses
  lines.push("\n=== EMPRESAS PROPIAS ===");
  if (m8.hasOwnBusinesses) {
    const biz = (m8.businesses ?? []) as Record<string, unknown>[];
    biz.forEach(b => {
      lines.push(`- ${str(b.name)} (fundada ${str(b.foundingYear)}): ${str(b.role)} — ${str(b.description)}`);
    });
  } else {
    lines.push("No ha fundado empresas propias.");
  }

  lines.push(formatEvidenceForPrompt(m9, m10));

  // ── Strategic self-assessment (Module 11)
  lines.push("\n=== AUTOEVALUACIÓN ESTRATÉGICA (MÓDULO 11) ===");
  const strategic: [string, string][] = [
    ["createdMethod",        "¿Ha creado un método, sistema o enfoque propio reconocido por otros?"],
    ["ledImpactProjects",    "¿Ha liderado proyectos de alto impacto en su campo?"],
    ["solvedComplexProblems","¿Ha resuelto problemas complejos que otros no pudieron?"],
    ["trainedProfessionals", "¿Ha entrenado o mentoreado a otros profesionales?"],
    ["consultedForExpertise","¿Es consultado como experto por otras organizaciones?"],
    ["evaluatedOthers",      "¿Ha evaluado el trabajo de otros en su campo?"],
    ["workedForRecognized",  "¿Ha trabajado en organizaciones de reconocida distinción?"],
    ["aboveAverageIncome",   "¿Gana significativamente más que el promedio de su campo?"],
    ["willingToConfirm",     "¿Están sus superiores/colegas dispuestos a confirmar su nivel de impacto?"],
    ["additionalInfo",       "Información adicional relevante"],
  ];
  strategic.forEach(([key, question]) => {
    const ans = (m11[key] ?? {}) as Record<string, unknown>;
    if (str(ans.answer).trim()) {
      lines.push(`\nP: ${question}`);
      lines.push(`R: ${str(ans.answer)}`);
      if (ans.hasEvidence) lines.push("   (Tiene evidencia documental)");
    }
  });

  lines.push("\n=== FIN DE DATOS ===");
  lines.push("\nDevuelve ÚNICAMENTE el objeto JSON solicitado, sin bloques de código markdown.");

  return lines.join("\n");
}

// ── Claude call ──────────────────────────────────────────────────────────────

interface A1Response {
  visa_recommendation: string;
  visa_confidence: string;
  overall_strength: string;
  criteria_scores: Record<string, number>;
  criteria_met: Record<string, boolean>;
  criteria_gaps: Record<string, string | null>;
  strengths: string[];
  weaknesses: string[];
  strategic_notes: string;
  recommended_actions: string[];
}

async function callClaude(userPrompt: string, systemPrompt: string): Promise<A1Response> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8192, // aumentado de 2048 tras truncamiento real detectado
      // con un caso de cliente rico en evidencia (O-1B, criteria_gaps extensos +
      // strengths/weaknesses + recommended_actions) — la respuesta se cortó a
      // mitad de generación, produciendo JSON incompleto, no malformado.
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
    return JSON.parse(raw) as A1Response;
  } catch (firstErr) {
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as A1Response;
      throw firstErr;
    } catch (secondErr) {
      const msg = secondErr instanceof Error ? secondErr.message : String(secondErr);
      // Guardamos el raw completo (no truncado) para poder diagnosticar
      // exactamente qué generó Claude cuando ambos intentos de parseo
      // fallan — antes se perdía por completo en este escenario.
      throw new Error(`Claude response was not valid JSON (${msg}). RAW: ${raw}`);
    }
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const db = adminDb();

  let body: { case_id: string; submission_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { case_id, submission_id } = body;
  if (!case_id) {
    return NextResponse.json({ error: "Missing required field: case_id" }, { status: 400 });
  }

  // ── 1. Create agent_run ──────────────────────────────────────────────────
  const { data: run, error: runErr } = await db
    .from("agent_runs")
    .insert({
      case_id,
      agent_name: "intake_analyzer",
      status: "running",
      started_at: new Date().toISOString(),
      input_snapshot: { case_id, submission_id: submission_id ?? null },
    })
    .select("id")
    .single();

  if (runErr || !run) {
    return NextResponse.json({ error: "Failed to create agent run", detail: runErr?.message }, { status: 500 });
  }
  const runId = run.id as string;

  try {
    // ── 2. Fetch intake_submission ─────────────────────────────────────────
    const subQuery = db.from("intake_submissions").select("*");
    const { data: submission, error: subErr } = submission_id
      ? await subQuery.eq("id", submission_id).maybeSingle()
      : await subQuery.eq("case_id", case_id).maybeSingle();

    if (subErr) throw new Error(`Error fetching submission: ${subErr.message}`);
    if (!submission) throw new Error("No intake submission found for this case. The client must complete the intake form first.");

    // ── 3. Resolve classification and build prompts ────────────────────────
    // Fase 3: la única fuente jurídica es Case.active_legal_petition, nunca
    // module1.visaType (que permanece únicamente como expectativa del
    // cliente, sin uso funcional aquí). resolveCriteriaSet() nunca falla
    // por sí sola -- ante un string vacío o inválido, retorna O-1A por
    // defecto de forma silenciosa (confirmado en su implementación) -- por
    // eso esta verificación debe ocurrir explícitamente antes de llamarla,
    // nunca delegada a ella.
    const { data: caseRow, error: caseErr } = await db
      .from("cases")
      .select("active_legal_petition")
      .eq("id", case_id)
      .maybeSingle();
    if (caseErr) throw new Error(`Error fetching case: ${caseErr.message}`);
    if (!caseRow?.active_legal_petition) {
      throw new Error(
        "Case is missing active_legal_petition. A1 can only evaluate a case whose legal classification has been confirmed. Use the Legal Decision Procedure, which enforces this via the Legal Decision Cycle Policy Contract v1."
      );
    }
    const { classification, criteria } = resolveCriteriaSet(caseRow.active_legal_petition);
    const systemPrompt = buildSystemPrompt(classification, criteria);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userPrompt = buildUserPrompt(submission as Record<string, any>);
    const result = await callClaude(userPrompt, systemPrompt);

    // ── 4. Determine current version chain for this case ───────────────────
    // Antes de insertar, buscamos si ya existe una versión vigente
    // (currency_status = 'current') de Criterion Assessment para este caso.
    // Si existe, la nueva fila la superará: version + 1, y al final
    // marcamos la anterior como 'superseded' con superseded_by apuntando
    // a la nueva fila — cerrando el gap real encontrado 2026-08-01 (el
    // esquema tenía version/superseded_by/currency_status desde antes,
    // pero ningún código los poblaba).
    const { data: previousCurrent } = await db
      .from("agent_intake_analysis")
      .select("id, version")
      .eq("case_id", case_id)
      .eq("currency_status", "current")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = previousCurrent ? previousCurrent.version + 1 : 1;

    // ── 5. Insert agent_intake_analysis ────────────────────────────────────
    const { data: analysis, error: insertErr } = await db
      .from("agent_intake_analysis")
      .insert({
        case_id,
        submission_id: submission.id,
        run_id: runId,
        status: "completed",
        currency_status: "current",
        version: nextVersion,
        recommended_visa_type: result.visa_recommendation,  // existing column name
        classification_used: classification,
        visa_confidence: result.visa_confidence,
        overall_strength: result.overall_strength,
        criteria_scores: result.criteria_scores,
        criteria_met: result.criteria_met,
        criteria_gaps: result.criteria_gaps,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        strategy_notes: result.strategic_notes,             // existing column name
        recommended_actions: result.recommended_actions,
        raw_response: JSON.stringify(result),
      })
      .select("*")
      .single();

    if (insertErr || !analysis) {
      throw new Error(`Failed to save analysis: ${insertErr?.message}`);
    }

    // ── 6. Supersede the previous version, if one existed ──────────────────
    // No bloqueante: si esto falla, la nueva fila ya quedó guardada
    // correctamente (lo importante); solo registramos el error sin
    // interrumpir la respuesta al usuario.
    if (previousCurrent) {
      const { error: supersedeErr } = await db
        .from("agent_intake_analysis")
        .update({ currency_status: "superseded", superseded_by: analysis.id })
        .eq("id", previousCurrent.id);
      if (supersedeErr) {
        console.error(`Failed to mark previous analysis ${previousCurrent.id} as superseded:`, supersedeErr.message);
      }
    }

    // ── 7. Complete agent_run ──────────────────────────────────────────────
    await db
      .from("agent_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        output_summary: {
          analysis_id: analysis.id,
          recommended_visa_type: result.visa_recommendation,
          overall_strength: result.overall_strength,
        },
      })
      .eq("id", runId);

    // A5 ya no se dispara automáticamente desde aquí. Desde la Fase 2.1,
    // el único orquestador válido es Legal Decision Procedure
    // (src/app/api/agents/legal-decision-cycle/route.ts), que invoca A1
    // síncronamente y, solo si tiene éxito, invoca A5 a continuación. A1
    // vuelve a tener una única responsabilidad: producir la evaluación
    // jurídica y persistirla. No dispara nada más.

    return NextResponse.json({ success: true, analysis });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    await db
      .from("agent_runs")
      .update({ status: "failed", error_detail: msg, completed_at: new Date().toISOString() })
      .eq("id", runId);

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
