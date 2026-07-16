import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildAndStoreInstitutionalLetters,
  type InstitutionalLettersInput,
  type InstitutionalLetterEntry,
  type InstitutionalLetterType,
} from "@/lib/agents/a3-institutional-docx-builder";
import { criteriaSetForClassification, resolveCriteriaSet } from "@/lib/canonical-criteria";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ============================================================
// POST /api/agents/a3-institutional-letters — orchestrates the
// Motor Institucional (docs/A3_ENGINE_INSTITUCIONAL.md v1.5):
// determines which of the 5 letterType candidates the case's
// intake data supports, generates each independently via Claude
// (no batching — unlike the Testimonial motor, each institutional
// letter targets a distinct organization, not a shared perceptual
// batch before the same examiner), and invokes the existing
// builder.
//
// Candidate determination requires the *detail* fields added
// for this motor (judgeSelectionCriteria, criticalRole,
// awardNominationAndJudgingCriteria) to be present — not just
// the generic evidence item existing, which would only support
// A1/O-1A scoring, not a probative institutional letter.
// ============================================================

interface CandidateLetter {
  letterType: InstitutionalLetterType;
  organizationName: string;
  criterionCitation: string | null;
  criterionLabel: string | null;
  sourceData: Record<string, unknown>;
}

const CRITERION_KEY_BY_LETTER_TYPE: Record<string, string> = {
  subtypeB_judge: "judging",
  subtypeB_criticalRole4a: "critical_role_4a",
  subtypeB_criticalRole4b: "critical_role_4b",
  subtypeB_awards: "awards",
};

function resolveCriterionCitationAndLabel(
  letterType: InstitutionalLetterType,
  visaType: string
): { citation: string | null; label: string | null } {
  const key = CRITERION_KEY_BY_LETTER_TYPE[letterType];
  if (!key) return { citation: null, label: null };
  const { classification } = resolveCriteriaSet(visaType);
  const def = criteriaSetForClassification(classification).find((c) => c.key === key);
  return { citation: def?.citation ?? null, label: def?.label ?? null };
}

function resolveCandidates(m10: Record<string, any>, m15: Record<string, any>, visaType: string): CandidateLetter[] {
  const candidates: CandidateLetter[] = [];

  // Subtipo A — Advisory Opinion (Module15 Section A)
  if (m15.hasPeerGroup === "si" && m15.peerGroupName) {
    candidates.push({
      letterType: "subtypeA_advisory",
      organizationName: m15.peerGroupName,
      criterionCitation: null,
      criterionLabel: null,
      sourceData: {
        peerGroupLetterType: m15.peerGroupLetterType,
      },
    });
  }

  // Subtipo B — Judge
  const judgingItems = (m10.judging ?? []) as Record<string, unknown>[];
  for (const item of judgingItems) {
    if (!item.judgeSelectionCriteria) continue;
    const { citation, label } = resolveCriterionCitationAndLabel("subtypeB_judge", visaType);
    candidates.push({
      letterType: "subtypeB_judge",
      organizationName: String(item.org ?? ""),
      criterionCitation: citation,
      criterionLabel: label,
      sourceData: item,
    });
  }

  // Subtipo B — Critical Role 4a/4b
  if (m10.criticalRole) {
    const cr = m10.criticalRole as Record<string, unknown>;
    const letterType: InstitutionalLetterType =
      cr.criticalRoleType === "elected" ? "subtypeB_criticalRole4a" : "subtypeB_criticalRole4b";
    const { citation, label } = resolveCriterionCitationAndLabel(letterType, visaType);
    candidates.push({
      letterType,
      organizationName: String(cr.organizationName ?? "").trim() || "Organization",
      criterionCitation: citation,
      criterionLabel: label,
      sourceData: cr,
    });
  }

  // Subtipo B — Awards
  const awardItems = (m10.awards ?? []) as Record<string, unknown>[];
  for (const item of awardItems) {
    if (!item.awardNominationAndJudgingCriteria) continue;
    const { citation, label } = resolveCriterionCitationAndLabel("subtypeB_awards", visaType);
    candidates.push({
      letterType: "subtypeB_awards",
      organizationName: String(item.org ?? ""),
      criterionCitation: citation,
      criterionLabel: label,
      sourceData: item,
    });
  }

  return candidates;
}

function buildSystemPrompt(letterType: InstitutionalLetterType): string {
  const base = `Eres el Motor Institucional de A3 — Letter Generator de AUCIS (ACTION USA AI).

Tu función es redactar, en inglés, una carta institucional emitida en nombre de una organización (no de un individuo a título personal) que respalda una petición de visa.

REGLA ANTI-GENERICIDAD (obligatoria, sin excepción):
El riesgo aquí no es el lenguaje hiperbólico — es la carta factualmente rica que no responde la pregunta regulatoria exacta. Caso real de referencia: una carta rechazada por RFE a pesar de narrativa abundante, porque nunca cubrió los elementos de evidencia específicos que el criterio exige. NO te limites a narrar logros del beneficiario. Debes responder, de forma verificable y punto por punto, a la lista específica de evidencia exigida para este sub-criterio (ver abajo).

ESTRUCTURA OBLIGATORIA — 5 bloques:
1. Encabezado/Asunto — destinatario USCIS, referencia del caso
2. Identidad y autoridad de la organización — descripción de la organización y su rol en el campo
3. Contenido central — el hecho certificado, cubriendo explícitamente los campos de evidencia exigidos
3b. Refuerzo específico — opcional, solo si aplica
4. Declaración — de opinión/no-objeción o de certificación del hecho
5. Cierre — SIEMPRE con placeholders literales en blanco: "[Nombre del funcionario autorizado]", "[Cargo oficial]", "[Teléfono]", "[Correo electrónico]", "[Firma]" — nunca inventes datos reales de firmante, esta carta se entrega en blanco para que la organización la complete y firme.
`;

  const typeSpecific: Record<InstitutionalLetterType, string> = {
    subtypeA_advisory: `
TIPO: Opinión Consultiva / No-Objeción.
El Bloque 3 debe declarar la postura de la organización respecto a la petición del beneficiario — opinión favorable o no-objeción, según corresponda.`,
    subtypeB_judge: `
TIPO: Certificación de rol de Juez/Evaluador.
El Bloque 3 DEBE cubrir explícitamente estos tres elementos, cada uno con evidencia verificable: (a) por qué la organización eligió a este beneficiario específicamente como juez/evaluador; (b) la significancia del evento juzgado (escala, nivel, relevancia); (c) si el veredicto del beneficiario fue final/vinculante y qué consecuencia verificable tuvo sobre los evaluados.`,
    subtypeB_criticalRole4a: `
TIPO: Certificación de Rol Crítico — Directivo/Electo.
El Bloque 3 DEBE cubrir: el cargo directivo/electo exacto y período de gestión; la reputación distinguida de la organización; y métricas de gestión cuantificables logradas durante el mandato (crecimiento de membresía, afiliaciones logradas, sistemas implementados).`,
    subtypeB_criticalRole4b: `
TIPO: Certificación de Rol Crítico — Técnico/Instructor.
El Bloque 3 DEBE cubrir: el cargo técnico/instructor exacto y período de servicio; los cursos o funciones específicas desempeñadas; y evidencia verificable de que el conocimiento transferido se institucionalizó (adopción curricular, continuidad, invitación renovada).`,
    subtypeB_awards: `
TIPO: Certificación de Competencias Ganadas.
El Bloque 3 DEBE cubrir explícitamente: los criterios de nominación y juzgamiento usados para seleccionar ganadores; la reputación del panel u organización otorgante; y la frecuencia y alcance del premio (cuántos se otorgan al año, alcance nacional/internacional).`,
  };

  return base + typeSpecific[letterType] + `

Devuelve ÚNICAMENTE este objeto JSON, sin markdown ni explicación adicional:
{
  "blocks": {
    "block1_header": "string",
    "block2_organizationIdentity": "string",
    "block3_coreContent": "string",
    "block3b_specificReinforcement": "string or null",
    "block4_declaration": "string",
    "block5_closing": "string"
  }
}`;
}

function buildUserPrompt(
  beneficiaryFullName: string,
  visaType: string,
  candidate: CandidateLetter
): string {
  const lines: string[] = [];
  lines.push(`BENEFICIARIO: ${beneficiaryFullName}`);
  lines.push(`Clasificación de visa: ${visaType}`);
  lines.push(`ORGANIZACIÓN: ${candidate.organizationName}`);
  lines.push(``);
  lines.push(`DATOS DE EVIDENCIA DISPONIBLES:`);
  for (const [key, value] of Object.entries(candidate.sourceData)) {
    if (value === null || value === undefined || value === "") continue;
    if (key.endsWith("Path") || key.endsWith("Name") || key === "id") continue;
    lines.push(`${key}: ${value}`);
  }
  return lines.join("\n");
}

interface ModelBlocksResponse {
  blocks: InstitutionalLetterEntry["blocks"];
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<ModelBlocksResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const raw = data.content?.[0]?.text ?? "";

  let parsed: ModelBlocksResponse;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Claude response was not valid JSON: ${raw.slice(0, 500)}`);
  }

  if (!parsed.blocks) {
    throw new Error(`Claude response missing "blocks"`);
  }

  return parsed;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const case_id: string | undefined = body.case_id;
    const submission_id: string | undefined = body.submission_id;

    if (!case_id) {
      return NextResponse.json({ error: "case_id is required" }, { status: 400 });
    }

    const db = adminDb();

    const subQuery = db.from("intake_submissions").select("*");
    const { data: submission, error: subErr } = submission_id
      ? await subQuery.eq("id", submission_id).maybeSingle()
      : await subQuery.eq("case_id", case_id).maybeSingle();

    if (subErr) throw new Error(`Error fetching submission: ${subErr.message}`);
    if (!submission) {
      return NextResponse.json({ error: "No intake submission found for this case." }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = submission as Record<string, any>;
    const m1 = sub.module1 ?? {};
    const m10 = sub.module10 ?? {};
    const m15 = sub.module15 ?? {};

    const beneficiaryFullName: string = m1.fullName ?? "";
    const visaType: string = m1.visaType ?? "";

    const candidates = resolveCandidates(m10, m15, visaType);

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No institutional letter candidates found — required detail fields are empty for this case." },
        { status: 400 }
      );
    }

    const letters: InstitutionalLetterEntry[] = [];

    for (const candidate of candidates) {
      const systemPrompt = buildSystemPrompt(candidate.letterType);
      const userPrompt = buildUserPrompt(beneficiaryFullName, visaType, candidate);
      const { blocks } = await callClaude(systemPrompt, userPrompt);

      letters.push({
        letterId: crypto.randomUUID(),
        letterType: candidate.letterType,
        organizationName: candidate.organizationName,
        criterionCitation: candidate.criterionCitation,
        criterionLabel: candidate.criterionLabel,
        blocks,
      });
    }

    const input: InstitutionalLettersInput = {
      caseId: case_id,
      beneficiaryFullName,
      letters,
    };

    const result = await buildAndStoreInstitutionalLetters(input);

    return NextResponse.json({
      case_id,
      lettersGenerated: result.length,
      letterTypes: candidates.map((c) => c.letterType),
      results: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
