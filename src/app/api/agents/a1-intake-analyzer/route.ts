import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CriterionDef, resolveCriteriaSet } from "@/lib/canonical-criteria";
import { str } from "@/lib/agents/shared-helpers";
import { formatEvidenceForPrompt } from "@/lib/agents/evidence-formatter";
import { createKnowledgeRequirement } from "@/lib/akae/knowledge-requirement";
import { determineEntry } from "@/lib/akae/entry-determination";
import { deliverGovernedKnowledge, GovernedKnowledgeAnswer } from "@/lib/akae/governed-knowledge-delivery";

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
  criteria: CriterionDef[],
  criticalRoleGovernedKnowledge?: GovernedKnowledgeAnswer | null
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

  // Solo se agrega cuando AKAE entregó texto oficial verificado (nunca
  // FOUND_BUT_NOT_VERIFIED ni NOT_ACQUIRED) — ver
  // src/lib/akae/governed-knowledge-delivery.ts. Sin esto, el criterio se
  // evalúa como antes, solo con el label corto.
  const governedKnowledgeBlock = criticalRoleGovernedKnowledge?.verified && criticalRoleGovernedKnowledge.text
    ? `\n\nCONOCIMIENTO JURÍDICO GOBERNADO Y VERIFICADO — aplica exclusivamente a critical_role_4a/critical_role_4b (${criticalRoleGovernedKnowledge.citation}):\n"${criticalRoleGovernedKnowledge.text}"\nEvalúa critical_role_4a y critical_role_4b usando este texto oficial verificado como estándar, no tu conocimiento de fondo sobre la regulación.`
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
Se requieren al menos 3 criterios met.${countingRule}${governedKnowledgeBlock}

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

// MTCS-06 Reliance Input Snapshot Moment (Part VI) — captured once by the
// route handler from evidence_items/evidence_item_documents, before the
// Claude call, and threaded through unchanged. Never re-derived at
// persistence time (Part VII Race-Integrity Rule).
interface EvidenceSnapshotItem {
  evidence_item_id: string;
  probative_revision_at_reliance: number;
  fact_at_reliance: string;
  documentary_condition_at_reliance: string;
  verification_condition_at_reliance: string;
  document_ids_at_reliance: string[];
}

const DOCUMENTARY_CONDITION_LABEL: Record<string, string> = {
  reported: "Reportado", partial: "Parcialmente documentado", documented: "Documentado",
};
const VERIFICATION_CONDITION_LABEL: Record<string, string> = {
  pending: "Pendiente", verified: "Verificado", needs_attention: "Requiere atención",
};

// Surfaced as context only — never a gate on criteria eligibility or scoring
// (Part III Governing Principles, DD-06-01/DD-06-02). No A1 scoring/threshold
// change: this section is purely additive informational context for Claude.
function formatEvidenceSnapshotForPrompt(snapshot: EvidenceSnapshotItem[]): string {
  const lines: string[] = ["\n=== EVIDENCIA TIPIFICADA REGISTRADA (Evidence V2) ==="];
  if (snapshot.length === 0) {
    lines.push("Sin evidencia tipificada registrada para este caso.");
  } else {
    snapshot.forEach(e => {
      lines.push(`- Hecho: ${e.fact_at_reliance}`);
      lines.push(`  Estado documental: ${DOCUMENTARY_CONDITION_LABEL[e.documentary_condition_at_reliance] ?? e.documentary_condition_at_reliance} | Estado de verificación: ${VERIFICATION_CONDITION_LABEL[e.verification_condition_at_reliance] ?? e.verification_condition_at_reliance}`);
      lines.push(`  Documentos de soporte adjuntos: ${e.document_ids_at_reliance.length}`);
    });
    lines.push("\nEsta evidencia se presenta como contexto adicional; no condiciona ni reemplaza la evaluación de los módulos de intake anteriores.");
  }
  return lines.join("\n");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildUserPrompt(sub: Record<string, any>, evidenceSnapshot: EvidenceSnapshotItem[]): string {
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
  lines.push(formatEvidenceSnapshotForPrompt(evidenceSnapshot));

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

    // ── AKAE consumption (TC-01/TC-04, bounded to this slice) ──────────────
    // La necesidad de conocimiento gobernado para critical_role_4a/4b nace
    // aquí, en A1, donde antes se evaluaba el criterio solo con el label
    // corto. A1 nunca lee LKA-*.md ni el almacenamiento interno de AKAE
    // directamente — solo consume GovernedKnowledgeAnswer, la interfaz de
    // entrega de src/lib/akae/governed-knowledge-delivery.ts. Cuando AKAE no
    // entrega texto verificado (no adquirido, o adquirido pero no
    // verificado), buildSystemPrompt no incluye ningún bloque adicional y el
    // criterio se evalúa exactamente como antes.
    const criticalRoleCriterion = criteria.find(
      c => c.key === "critical_role_4a" || c.key === "critical_role_4b"
    );
    let criticalRoleGovernedKnowledge: GovernedKnowledgeAnswer | null = null;
    if (criticalRoleCriterion) {
      const kr = createKnowledgeRequirement(
        criticalRoleCriterion.citation,
        `Obtener conocimiento gobernado correspondiente a ${criticalRoleCriterion.citation} — estándar de "rol crítico/esencial en organización distinguida" para evaluar ${criticalRoleCriterion.key}.`,
        "AILA"
      );
      const entry = determineEntry(kr);
      criticalRoleGovernedKnowledge = entry.entryConditionsSatisfied
        ? deliverGovernedKnowledge(kr.kr02.citation)
        : null;
    }

    const systemPrompt = buildSystemPrompt(classification, criteria, criticalRoleGovernedKnowledge);

    // ── MTCS-06.1: Evidence + Document read at the Reliance Input Snapshot
    // Moment (Part VI) ───────────────────────────────────────────────────
    // Every CURRENT Evidence composition for this Case is read here, once,
    // regardless of Documentary/Verification Condition (DD-06-01/DD-06-02 —
    // surfaced as context, never a gate; no A1 scoring/threshold/criteria
    // change). The captured values are threaded through the Claude call
    // unchanged and are exactly what gets persisted as Historical Reliance
    // in step 5 below — never re-queried at persistence time (Part VII
    // Race-Integrity Rule).
    const { data: currentEvidence, error: evidenceErr } = await db
      .from("evidence_items")
      .select("id, fact, version, documentary_condition, verification_condition")
      .eq("case_id", case_id)
      .eq("currency_status", "current");
    if (evidenceErr) throw new Error(`Error fetching evidence: ${evidenceErr.message}`);

    const evidenceIds = (currentEvidence ?? []).map(e => e.id as string);
    const evidenceDocumentIds = new Map<string, string[]>();
    if (evidenceIds.length > 0) {
      const { data: assoc, error: assocErr } = await db
        .from("evidence_item_documents")
        .select("evidence_item_id, document_id")
        .in("evidence_item_id", evidenceIds);
      if (assocErr) throw new Error(`Error fetching evidence documents: ${assocErr.message}`);
      for (const row of assoc ?? []) {
        const key = row.evidence_item_id as string;
        const arr = evidenceDocumentIds.get(key) ?? [];
        arr.push(row.document_id as string);
        evidenceDocumentIds.set(key, arr);
      }
    }

    const evidenceSnapshot: EvidenceSnapshotItem[] = (currentEvidence ?? []).map(e => ({
      evidence_item_id: e.id as string,
      probative_revision_at_reliance: e.version as number,
      fact_at_reliance: e.fact as string,
      documentary_condition_at_reliance: e.documentary_condition as string,
      verification_condition_at_reliance: e.verification_condition as string,
      document_ids_at_reliance: evidenceDocumentIds.get(e.id as string) ?? [],
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userPrompt = buildUserPrompt(submission as Record<string, any>, evidenceSnapshot);
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

    // ── 5. Insert agent_intake_analysis + A1 Historical Reliance ────────────
    // MTCS-06.2: one governed, transactional Postgres function (migration
    // 029) performs the agent_intake_analysis insert together with the A1
    // Historical Reliance + Historical Reliance Document rows, using exactly
    // the values captured at the Reliance Input Snapshot Moment above —
    // never re-derived. All-or-nothing (Part XIII Atomicity).
    const { data: analysis, error: insertErr } = await db.rpc("create_a1_assessment_with_reliance", {
      p_case_id: case_id,
      p_submission_id: submission.id,
      p_run_id: runId,
      p_version: nextVersion,
      p_recommended_visa_type: result.visa_recommendation,  // existing column name
      p_classification_used: classification,
      p_visa_confidence: result.visa_confidence,
      p_overall_strength: result.overall_strength,
      p_criteria_scores: result.criteria_scores,
      p_criteria_met: result.criteria_met,
      p_criteria_gaps: result.criteria_gaps,
      p_strengths: result.strengths,
      p_weaknesses: result.weaknesses,
      p_strategy_notes: result.strategic_notes,             // existing column name
      p_recommended_actions: result.recommended_actions,
      p_raw_response: JSON.stringify(result),
      p_reliance: evidenceSnapshot,
    });

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
