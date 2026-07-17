import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assembleExhibits } from "@/lib/agents/a4-exhibit-assembly";
import {
  buildAndStoreAttorneyPetitionLetter,
  buildAndStoreConsultationExceptionLetter,
  type AttorneyPetitionInput,
  type ConsultationExceptionInput,
  type CriterionArgument,
} from "@/lib/agents/a4-attorney-docx-builder";
import { resolveCriteriaSet } from "@/lib/canonical-criteria";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ============================================================
// POST /api/agents/a4-attorney-letters — orchestrates Motor
// Abogado (docs/A4_ENGINE_ABOGADO.md v1.4): generates Tipo 0
// (Attorney Petition Letter) always, and Tipo 0b (Consultation
// Exception Letter) additionally when Module15.hasPeerGroup ===
// "no" and noAssociationJustification is populated.
//
// petitionStrategy is an explicit input, not inferred — deciding
// whether a case qualifies for the "major internationally
// recognized award" standard (Ruta B) is professional legal
// judgment (Alex/Sandra), not something this system determines
// automatically, consistent with targetCriterionKey (Module9)
// and other explicit-judgment fields in this session.
//
// Tipo 0 is a single cohesive document — unlike Testimonial
// (batched per criterion) or Institutional (independent call per
// letter), this route makes ONE Claude call producing the full
// envelope. Exhibit numbers are never invented by the model —
// resolved from case_exhibits (assembleExhibits, already run or
// run here if not yet assembled) and merged in by the route.
// ============================================================

const MODEL = "claude-sonnet-4-6";

function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  return fenceMatch ? fenceMatch[1] : trimmed;
}

async function callClaude(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<any> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
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

  try {
    return JSON.parse(stripMarkdownFences(raw));
  } catch {
    throw new Error(`Claude response was not valid JSON: ${raw.slice(0, 500)}`);
  }
}

function buildTipo0SystemPrompt(petitionStrategy: "multiCriteria" | "singleAchievement"): string {
  const base = `Eres el Motor Abogado de A4 — Petition Builder de AUCIS (ACTION USA AI).

Tu función es redactar, en inglés, la Attorney Petition Letter — el documento maestro que organiza y argumenta ante USCIS toda la evidencia del expediente, en voz del abogado que presenta el caso.

PRINCIPIO RECTOR — anclaje regulatorio obligatorio:
Cada afirmación de elegibilidad debe estar explícitamente atada a la cita CFR/INA exacta del criterio que argumenta. Este motor no prueba nada por sí mismo — organiza y explica por qué la evidencia ya reunida (cartas testimoniales e institucionales, documentos de Módulo 10) satisface cada elemento que la norma exige. Caso real de referencia: la carta original de Arroyo fue rechazada por RFE al argumentar Rol Crítico con lenguaje de elogio genérico, sin establecer nunca el hecho que el criterio exige — no repitas ese error.

ESTRUCTURA OBLIGATORIA — 7 bloques:
1. Encabezado/Asunto — destinatario USCIS, RE con clasificación exacta
2. Presentación del campo de actividad — contextualiza la disciplina del beneficiario
3. Marco legal y estándar de prueba — test de elegibilidad completo
4. Declaración de criterios satisfechos
5. Desarrollo criterio por criterio (o análisis de logro único, ver abajo)
6. Conclusión — síntesis + solicitud formal de aprobación
7. Cierre — con firma REAL del abogado (nombre real, nunca placeholder)
`;

  const strategySpecific =
    petitionStrategy === "multiCriteria"
      ? `
RUTA: Multi-criterio. Para cada criterio activo que se te proporcione, escribe un argumento (campo "argument") que conecte la evidencia disponible con el texto exacto del criterio. NO cites números de Exhibit en el texto — eso lo agrega el sistema automáticamente después. Devuelve un array "criteriaArguments" con un elemento por criterio, en el mismo orden en que se te proporcionaron, cada uno con "criterionCitation" (copiado exactamente) y "argument".`
      : `
RUTA: Logro único (major, internationally recognized award). Se te proporcionarán todos los premios documentados del beneficiario. Identifica cuál de ellos, si alguno, califica como premio mayor de reconocimiento internacional, y escribe un único análisis ("singleAchievementAnalysis") argumentando por qué ese premio específico satisface el estándar: naturaleza competitiva internacional, rigor del proceso de evaluación, autoridad de la institución otorgante, e impacto en la carrera del beneficiario. Si ningún premio califica claramente, sé honesto en el análisis sobre la fortaleza relativa del caso.`;

  const outputContract =
    petitionStrategy === "multiCriteria"
      ? `
Devuelve ÚNICAMENTE este JSON:
{
  "block1_header": "string",
  "block2_fieldPresentation": "string",
  "block3_legalFrameworkStandard": "string",
  "block4_criteriaSatisfiedDeclaration": "string",
  "criteriaArguments": [{ "criterionCitation": "string", "argument": "string" }],
  "block6_conclusion": "string",
  "block7_closing": "string"
}`
      : `
Devuelve ÚNICAMENTE este JSON:
{
  "block1_header": "string",
  "block2_fieldPresentation": "string",
  "block3_legalFrameworkStandard": "string",
  "block4_criteriaSatisfiedDeclaration": "string",
  "singleAchievementAnalysis": "string",
  "block6_conclusion": "string",
  "block7_closing": "string"
}`;

  return base + strategySpecific + outputContract;
}

function buildTipo0UserPrompt(
  beneficiaryFullName: string,
  visaType: string,
  petitionStrategy: "multiCriteria" | "singleAchievement",
  attorneyName: string,
  exhibitRows: { criterion_citation: string; criterion_label: string; exhibit_number: number }[],
  awards: Record<string, unknown>[]
): string {
  const lines: string[] = [];
  lines.push(`BENEFICIARIO: ${beneficiaryFullName}`);
  lines.push(`Clasificación de visa: ${visaType}`);
  lines.push(`Abogado que presenta el caso: ${attorneyName}`);
  lines.push(``);

  if (petitionStrategy === "multiCriteria") {
    lines.push(`CRITERIOS ACTIVOS (en orden canónico, con Exhibit ya asignado):`);
    exhibitRows.forEach((r) => {
      lines.push(`- ${r.criterion_label} (${r.criterion_citation}) — Exhibit ${r.exhibit_number}`);
    });
  } else {
    lines.push(`PREMIOS DOCUMENTADOS (identifica cuál califica como logro único mayor):`);
    awards.forEach((a) => {
      lines.push(`- ${a.name} — ${a.org} (${a.year}, ${a.country}): ${a.description}`);
    });
  }

  return lines.join("\n");
}

function buildTipo0bSystemPrompt(): string {
  return `Eres el Motor Abogado de A4 — Petition Builder de AUCIS (ACTION USA AI).

Tu función es redactar, en inglés, una Consultation Exception Letter — validada contra el caso real Garibay (Escamilla & Poneck, LLP). Estructura de 4 movimientos:
1. Encabezado — destinatario USCIS
2. RE: Consultation Requirement Exception + nombre del beneficiario
3. Cuerpo en tres partes: (a) declarar que no existe un peer group apropiado que pueda emitir opinión consultiva; (b) justificar por qué — el campo es demasiado singular o poco prevalente; (c) ofrecer evidencia sustituta disponible.
4. Cierre — con firma REAL del abogado.

Devuelve ÚNICAMENTE este JSON:
{
  "block1_header": "string",
  "block2_reSubject": "string",
  "block3a_noPeerGroupDeclaration": "string",
  "block3b_fieldSingularityJustification": "string",
  "block3c_substituteEvidence": "string",
  "block4_closing": "string"
}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const case_id: string | undefined = body.case_id;
    const attorneyName: string | undefined = body.attorneyName;
    const firmName: string | undefined = body.firmName;
    const firmAddress: string | undefined = body.firmAddress;
    const petitionStrategy: "multiCriteria" | "singleAchievement" | undefined = body.petitionStrategy;

    if (!case_id || !attorneyName || !firmName || !firmAddress || !petitionStrategy) {
      return NextResponse.json(
        { error: "case_id, attorneyName, firmName, firmAddress, and petitionStrategy are all required." },
        { status: 400 }
      );
    }

    const db = adminDb();

    const { data: submission, error: subErr } = await db
      .from("intake_submissions")
      .select("*")
      .eq("case_id", case_id)
      .maybeSingle();

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

    const { classification } = resolveCriteriaSet(visaType);
    const context = { caseId: case_id, beneficiaryFullName, visaType: classification, attorneyName, firmName, firmAddress };

    // ── Tipo 0 — Attorney Petition Letter ──────────────────────────────
    let exhibitRows: { criterion_citation: string; criterion_label: string; exhibit_number: number }[] = [];

    if (petitionStrategy === "multiCriteria") {
      const { data: existingExhibits } = await db
        .from("case_exhibits")
        .select("criterion_citation, criterion_label, exhibit_number")
        .eq("case_id", case_id)
        .order("exhibit_number", { ascending: true });

      if (!existingExhibits || existingExhibits.length === 0) {
        await assembleExhibits(case_id);
        const { data: freshExhibits, error: exhErr } = await db
          .from("case_exhibits")
          .select("criterion_citation, criterion_label, exhibit_number")
          .eq("case_id", case_id)
          .order("exhibit_number", { ascending: true });
        if (exhErr) throw new Error(`Error fetching assembled exhibits: ${exhErr.message}`);
        exhibitRows = freshExhibits ?? [];
      } else {
        exhibitRows = existingExhibits;
      }

      if (exhibitRows.length === 0) {
        return NextResponse.json(
          { error: "No active criteria/Exhibits found for this case — cannot build multiCriteria petition." },
          { status: 400 }
        );
      }
    }

    const awards = (m10.awards ?? []) as Record<string, unknown>[];

    const tipo0SystemPrompt = buildTipo0SystemPrompt(petitionStrategy);
    const tipo0UserPrompt = buildTipo0UserPrompt(
      beneficiaryFullName,
      visaType,
      petitionStrategy,
      attorneyName,
      exhibitRows,
      awards
    );

    const modelResponse = await callClaude(tipo0SystemPrompt, tipo0UserPrompt, 8192);

    let criteriaDevelopment: CriterionArgument[] = [];
    let singleAchievementAnalysis: string | null = null;

    if (petitionStrategy === "multiCriteria") {
      const rawArguments = (modelResponse.criteriaArguments ?? []) as { criterionCitation: string; argument: string }[];
      criteriaDevelopment = rawArguments.map((ra) => {
        const row = exhibitRows.find((r) => r.criterion_citation === ra.criterionCitation);
        return {
          criterionCitation: ra.criterionCitation,
          criterionLabel: row?.criterion_label ?? "",
          argument: ra.argument,
          exhibitNumbers: row ? [String(row.exhibit_number)] : [],
        };
      });
    } else {
      singleAchievementAnalysis = modelResponse.singleAchievementAnalysis ?? "";
    }

    const attorneyInput: AttorneyPetitionInput = {
      ...context,
      petitionStrategy,
      blocks: {
        block1_header: modelResponse.block1_header,
        block2_fieldPresentation: modelResponse.block2_fieldPresentation,
        block3_legalFrameworkStandard: modelResponse.block3_legalFrameworkStandard,
        block4_criteriaSatisfiedDeclaration: modelResponse.block4_criteriaSatisfiedDeclaration,
        block5_criteriaDevelopment: criteriaDevelopment,
        block5_singleAchievementAnalysis: singleAchievementAnalysis,
        block6_conclusion: modelResponse.block6_conclusion,
        block7_closing: modelResponse.block7_closing,
      },
    };

    const tipo0Result = await buildAndStoreAttorneyPetitionLetter(attorneyInput);

    // ── Tipo 0b — Consultation Exception Letter (conditional) ─────────
    let tipo0bResult = null;

    if (m15.hasPeerGroup === "no" && m15.noAssociationJustification) {
      const tipo0bSystemPrompt = buildTipo0bSystemPrompt();
      const tipo0bUserPrompt = [
        `BENEFICIARIO: ${beneficiaryFullName}`,
        `Clasificación de visa: ${visaType}`,
        `Justificación de ausencia de asociación: ${m15.noAssociationJustification}`,
        m15.alternativeContactName ? `Contacto alternativo: ${m15.alternativeContactName} (${m15.alternativeContactOrg}) — ${m15.alternativeContactRelation}` : "",
      ].filter(Boolean).join("\n");

      const tipo0bResponse = await callClaude(tipo0bSystemPrompt, tipo0bUserPrompt, 2048);

      const consultationInput: ConsultationExceptionInput = {
        ...context,
        blocks: {
          block1_header: tipo0bResponse.block1_header,
          block2_reSubject: tipo0bResponse.block2_reSubject,
          block3a_noPeerGroupDeclaration: tipo0bResponse.block3a_noPeerGroupDeclaration,
          block3b_fieldSingularityJustification: tipo0bResponse.block3b_fieldSingularityJustification,
          block3c_substituteEvidence: tipo0bResponse.block3c_substituteEvidence,
          block4_closing: tipo0bResponse.block4_closing,
        },
      };

      tipo0bResult = await buildAndStoreConsultationExceptionLetter(consultationInput);
    }

    return NextResponse.json({
      case_id,
      tipo0: tipo0Result,
      tipo0b: tipo0bResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
