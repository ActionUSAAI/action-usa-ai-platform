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
import { resolveCriteriaSet, criteriaSetForClassification } from "@/lib/canonical-criteria";

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

// Palabras clave en español, por criterion_key, para ubicar en qué paso de
// argument_sequence (prosa libre generada por A5) se menciona cada
// criterio por primera vez. No son los labels canónicos completos —
// argument_sequence parafrasea, nunca inserta el label formal verbatim
// (confirmado con datos reales, caso Neira Rincón, 2026-08-13: ni el
// criterionKey transformado ni el label completo coinciden nunca contra
// la prosa real). Son fragmentos de palabra (stems), tolerantes a
// inflexión de género/número en español — ej. "académic" cubre
// "académica"/"académico"/"académicos"/"académicas".
const CRITERION_KEYWORDS_ES: Record<string, string[]> = {
  awards: ["premio", "galardón"],
  memberships: ["membresía"],
  media_coverage: ["cobertura mediátic", "medios de comunicación", "prensa"],
  judging: ["jurado", "juez", "evaluador"],
  original_contributions: ["contribuciones original", "contribución original", "aporte original"],
  scholarly_articles: ["materiales académ", "publicación académica", "publicaciones académicas", "artículos académicos", "revista profesional"],
  critical_role_4a: ["rol crítico", "rol directivo", "cargo directivo"],
  critical_role_4b: ["rol técnico", "cargo técnico", "instructor"],
  high_salary: ["salario", "remuneración", "compensación"],
  artistic_exhibitions: ["exhibición", "exposición artística"],
  performing_arts_commercial_success: ["éxito comercial", "taquilla"],
  lead_starring_role: ["rol protagónico", "papel principal", "protagonista"],
  national_recognition: ["reconocimiento nacional", "reconocimiento internacional"],
  critical_role_org: ["rol protagónico", "rol crítico"],
  commercial_success: ["éxito comercial", "éxito de crítica"],
  significant_recognition: ["reconocimiento significativo"],
};

function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();

  // Try the strict fence pattern first (fast path for the common case).
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (fenceMatch) return fenceMatch[1];

  // Fallback: extract the first balanced {...} block, tolerating
  // surrounding prose, single-line fences, trailing content after
  // the closing fence, or any other wrapping the model might add
  // despite the system prompt asking for pure JSON.
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
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

PROHIBICIÓN CRÍTICA — CITAS JURISPRUDENCIALES: nunca cites casos judiciales, "Matter of ___", precedentes administrativos (AAO, BIA), ni ninguna autoridad legal específica más allá del texto directo del reglamento CFR/INA — ni inventados ni reales — a menos que se te proporcionen explícitamente como parte de los datos de entrada. Hallazgo real (caso Neira Rincón, 2026-08-13): el modelo citó "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)" para sustentar el estándar de mérito de una petición O-1A — Dhanasar es el test de tres partes para National Interest Waiver (categoría EB-2), no aplica a determinaciones de mérito en O-1A. Una cita jurisprudencial real pero mal aplicada es un riesgo legal más grave que no citar ninguna — nunca cites jurisprudencia por iniciativa propia, fundamenta el estándar únicamente en el texto directo del reglamento CFR/INA correspondiente a la clasificación de este caso.

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
RUTA: Multi-criterio. Para cada criterio activo que se te proporcione, escribe un argumento (campo "argument") que conecte la evidencia disponible con el texto exacto del criterio. NO cites números de Exhibit en el texto — eso lo agrega el sistema automáticamente después. Devuelve un array "criteriaArguments" con un elemento por criterio, en el mismo orden en que se te proporcionaron, cada uno con "criterionCitation" (copiado exactamente) y "argument".

IMPORTANTE: "criterionCitation" debe ser copiado EXACTAMENTE del valor que sigue a "Criterion citation:" en la lista de criterios activos que se te proporciona — solo la cita regulatoria, sin el label y sin el número de Exhibit. Por ejemplo, si el criterio activo se te presenta como:
- Criterion citation: 8 CFR 214.2(o)(3)(iii)(B)(5) | Label: Contribuciones originales de importancia significativa al campo | Exhibit: 1
entonces "criterionCitation" en tu respuesta debe ser exactamente "8 CFR 214.2(o)(3)(iii)(B)(5)" — NO "Contribuciones originales de importancia significativa al campo (8 CFR 214.2(o)(3)(iii)(B)(5))" ni ninguna otra variación con el label incluido.`
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
  awards: Record<string, unknown>[],
  orderedCriteria: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blueprint: Record<string, any>,
  criterionCitationByKey: Record<string, string>
): string {
  const lines: string[] = [];
  lines.push(`BENEFICIARIO: ${beneficiaryFullName}`);
  lines.push(`Clasificación de visa: ${visaType}`);
  lines.push(`Abogado que presenta el caso: ${attorneyName}`);
  lines.push(``);

  if (petitionStrategy === "multiCriteria") {
    // AUCIS_BLUEPRINT_EXECUTION_CONTRACT.md: A4 convierte argument_sequence
    // en estructura real de documento — su única libertad estructural.
    // El orden aquí ya viene determinado por el Blueprint (orderedCriteria),
    // nunca por case_exhibits.
    if (blueprint.theory_of_case) {
      lines.push(`TEORÍA DEL CASO (ya decidida por A5 — organiza block2/block3 alrededor de esto, nunca la contradigas):`);
      lines.push(blueprint.theory_of_case);
      lines.push(``);
    }
    if ((blueprint.argument_sequence ?? []).length > 0) {
      lines.push(`SECUENCIA LÓGICA DE ARGUMENTACIÓN (ya decidida por A5 — tu única libertad es convertir esto en prosa de sección legal; no cambies el orden ni omitas pasos):`);
      (blueprint.argument_sequence as string[]).forEach((step: string) => lines.push(`  ${step}`));
      lines.push(``);
    }
    lines.push(`CRITERIOS A ARGUMENTAR, EN ESTE ORDEN (ya decidido por A5 según argument_sequence — no reordenes):`);
    orderedCriteria.forEach((criterionKey) => {
      const canonicalCitation = criterionCitationByKey[criterionKey];
      const row = canonicalCitation ? exhibitRows.find((r) => r.criterion_citation === canonicalCitation) : undefined;
      if (!row) return;
      lines.push(`- Criterion citation: ${row.criterion_citation} | Label: ${row.criterion_label} | Exhibit: ${row.exhibit_number}`);
      const evidenceForCriterion: string[] = (blueprint.evidence_dependencies ?? {})[criterionKey] ?? [];
      if (evidenceForCriterion.length > 0) {
        lines.push(`  Evidencia que A5 ya identificó como relevante:`);
        evidenceForCriterion.forEach((e) => lines.push(`    - ${e}`));
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const relevantCrossRefs = (blueprint.criteria_cross_references ?? []).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ref: any) => Array.isArray(ref?.criteria) && ref.criteria.includes(criterionKey)
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      relevantCrossRefs.forEach((ref: any) => lines.push(`  Conexión con otro criterio (A5 ya identificó esto): ${ref.connection}`));
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
Tu función es redactar, en inglés, una Consultation Exception Letter. Estructura de 4 movimientos:
1. Encabezado — destinatario USCIS
2. RE: Consultation Requirement Exception + nombre del beneficiario
3. Cuerpo en tres partes: (a) declarar que no existe un peer group apropiado que pueda emitir opinión consultiva; (b) justificar por qué — el campo es demasiado singular o poco prevalente; (c) ofrecer evidencia sustituta disponible.
4. Cierre — con firma REAL del abogado.

PROHIBICIÓN CRÍTICA: nunca cites casos judiciales, "Matter of ___", precedentes administrativos, ni ninguna autoridad legal específica dentro del texto de la carta — ni inventados ni reales — a menos que se te proporcionen explícitamente como parte de los datos de entrada. Fundamenta el argumento únicamente en el texto directo del reglamento (8 C.F.R. § 214.2(o)(5)(ii)) y en la lógica factual del caso. Citar un caso sin verificación es un riesgo legal real — nunca lo hagas por iniciativa propia.

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

// Encapsulado deliberadamente: hoy selecciona el Blueprint vigente vía
// status IN ('approved','locked'), pero ADR-010 ya identificó que status
// mezcla dos dimensiones (workflow editorial + vigencia) — cuando
// case_strategy migre a workflow_status + currency_status (diferido,
// ver AUCIS_ARCHITECTURE_DECISIONS.md ADR-010), solo esta función
// necesita actualizarse. Mismo patrón que a3-testimonial-letters/route.ts
// y a3-institutional-letters/route.ts.
async function getApprovedBlueprint(db: ReturnType<typeof adminDb>, caseId: string) {
  const { data: strategy, error } = await db
    .from("case_strategy")
    .select("*")
    .eq("case_id", caseId)
    .in("status", ["approved", "locked"])
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Error fetching Blueprint: ${error.message}`);
  return strategy;
}

// Resuelve la cita CFR canónica de un criterion_key del Blueprint, para
// hacer matching exacto contra case_exhibits.criterion_citation — nunca
// comparación de texto libre contra criterion_label (bug real encontrado
// 2026-08-13: "critical_role_4a" no coincide como substring de "Critical
// or essential role..." aunque el Exhibit correcto sí exista). Mismo
// patrón que resolveCriterionCitationAndLabel() en
// a3-institutional-letters/route.ts.
function resolveCriterionCitation(criterionKey: string, visaType: string): string | null {
  const { classification } = resolveCriteriaSet(visaType);
  const def = criteriaSetForClassification(classification).find((c) => c.key === criterionKey);
  return def?.citation ?? null;
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

    // ── Fetch approved Blueprint — AUCIS_BLUEPRINT_EXECUTION_CONTRACT.md:
    // A4 ejecuta la estrategia ya decidida por A5, nunca la reconstruye.
    // A diferencia de a3-institutional-letters, aquí no hay tipo de carta
    // exento — la Attorney Petition Letter siempre argumenta criterios
    // del Blueprint.
    const blueprint = await getApprovedBlueprint(db, case_id);
    if (!blueprint) {
      return NextResponse.json(
        { error: "No hay un Case Blueprint aprobado para este caso. A4 no puede ejecutar sin una estrategia aprobada." },
        { status: 409 }
      );
    }

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
    // AUCIS_BLUEPRINT_EXECUTION_CONTRACT.md: el Blueprint decide QUÉ
    // criterios argumentar y en qué orden (dominant_criteria +
    // supporting_criteria, ordenados según argument_sequence).
    // case_exhibits sigue siendo, exclusivamente, la fuente del número
    // físico de cada Exhibit — nunca al revés. Blueprint → qué evidencia
    // usar → case_exhibits → qué número tiene cada Exhibit.
    let exhibitRows: { criterion_citation: string; criterion_label: string; exhibit_number: number }[] = [];
    let orderedCriteria: string[] = [];
    const escalatedCriteria: { criterionKey: string; reason: string }[] = [];

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

      // QUÉ argumentar y en qué orden: del Blueprint, no de case_exhibits.
      const blueprintCriteria: string[] = [
        ...(blueprint.dominant_criteria ?? []),
        ...(blueprint.supporting_criteria ?? []),
      ];
      // argument_sequence es texto libre ordenado (no un array de
      // criterion_key) — se usa para ordenar los criterios según en qué
      // paso de la secuencia lógica aparecen mencionados por primera vez.
      // Un criterio del Blueprint que no aparece mencionado en ningún
      // paso queda al final, en el orden en que A5 lo listó.
      const argumentSequence: string[] = blueprint.argument_sequence ?? [];
      // Segundo fix real (caso Neira Rincón, 2026-08-13): ni el
      // criterionKey transformado a inglés ni el label canónico completo
      // en español coinciden nunca contra argument_sequence — A5 genera
      // prosa que parafrasea, nunca inserta el label formal verbatim.
      // CRITERION_KEYWORDS_ES usa fragmentos de palabra tolerantes a
      // paráfrasis e inflexión, en vez de una frase exacta completa.
      const argumentSequenceLower = argumentSequence.map((step) => step.toLowerCase());
      const sequenceRank = (criterionKey: string): number => {
        const keywords = CRITERION_KEYWORDS_ES[criterionKey] ?? [];
        if (keywords.length === 0) return Number.MAX_SAFE_INTEGER;
        const idx = argumentSequenceLower.findIndex((step) =>
          keywords.some((kw) => step.includes(kw.toLowerCase()))
        );
        return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
      };
      orderedCriteria = [...blueprintCriteria].sort((a, b) => sequenceRank(a) - sequenceRank(b));

      // AUCIS_BLUEPRINT_EXECUTION_CONTRACT.md Sección 4: el Blueprint
      // decidió argumentar un criterio para el que no existe Exhibit
      // físico todavía — no se infiere ni se sustituye, se escala.
      for (const criterionKey of orderedCriteria) {
        const canonicalCitation = resolveCriterionCitation(criterionKey, visaType);
        const hasExhibit = canonicalCitation !== null && exhibitRows.some((r) => r.criterion_citation === canonicalCitation);
        if (!hasExhibit) {
          escalatedCriteria.push({
            criterionKey,
            reason: "El Blueprint clasificó este criterio para argumentar, pero no existe un Exhibit ensamblado que lo respalde.",
          });
          console.warn(
            `[A4 Blueprint Executor] Escalando: criterio ${criterionKey} no tiene Exhibit en case_exhibits (case_id ${case_id}). No se argumentará en esta petición.`
          );
        }
      }
      orderedCriteria = orderedCriteria.filter((c) => !escalatedCriteria.some((e) => e.criterionKey === c));

      if (orderedCriteria.length === 0) {
        return NextResponse.json(
          { error: "Ningún criterio del Blueprint aprobado tiene Exhibit ensamblado — no se puede construir la petición.", escalatedCriteria },
          { status: 400 }
        );
      }
    }

    const awards = (m10.awards ?? []) as Record<string, unknown>[];

    const tipo0SystemPrompt = buildTipo0SystemPrompt(petitionStrategy);
    const criterionCitationByKey: Record<string, string> = {};
    for (const criterionKey of orderedCriteria) {
      const citation = resolveCriterionCitation(criterionKey, visaType);
      if (citation) criterionCitationByKey[criterionKey] = citation;
    }

    const tipo0UserPrompt = buildTipo0UserPrompt(
      beneficiaryFullName,
      visaType,
      petitionStrategy,
      attorneyName,
      exhibitRows,
      awards,
      orderedCriteria,
      blueprint,
      criterionCitationByKey
    );

    const modelResponse = await callClaude(tipo0SystemPrompt, tipo0UserPrompt, 8192);

    let criteriaDevelopment: CriterionArgument[] = [];
    let singleAchievementAnalysis: string | null = null;

    if (petitionStrategy === "multiCriteria") {
      const rawArguments = (modelResponse.criteriaArguments ?? []) as { criterionCitation: string; argument: string }[];
      criteriaDevelopment = rawArguments.map((ra) => {
        const row = exhibitRows.find((r) => r.criterion_citation.trim() === ra.criterionCitation.trim());
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
      escalatedCriteria: escalatedCriteria.length > 0 ? escalatedCriteria : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
