import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { criteriaSetForClassification, resolveCriteriaSet } from "@/lib/canonical-criteria";
import { relationshipLabelEn } from "@/lib/relationship-labels";
import {
  buildAndStoreTestimonialLetters,
  type TestimonialLettersInput,
  type TestimonialLetterEntry,
} from "@/lib/agents/a3-testimonial-docx-builder";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const PRESENTATION_FORMATS: TestimonialLetterEntry["presentationFormat"][] = [
  "narrative",
  "headed",
  "numbered",
];

interface ReferenceEntry {
  id: string;
  name: string;
  currentTitle: string;
  company: string;
  country: string;
  relationshipType: string;
  relationshipDuration: string;
  signerCredentials: string;
  specificAchievements: string;
  targetCriterionKey: string;
}

function buildSystemPrompt(criterionLabel: string, criterionCitation: string): string {
  return `Eres el Motor Testimonial de A3 — Letter Generator de AUCIS (ACTION USA AI).

Tu función es redactar cartas de recomendación testimonial en inglés, en nombre de terceros (colegas, supervisores, clientes, mentores) que respaldan una petición de visa. Todas las cartas de esta llamada corresponden al mismo criterio USCIS: ${criterionLabel} (${criterionCitation}).

FUNDAMENTO — validado contra un RFE real (caso Neira, EB-1A):
USCIS rechaza explícitamente cartas que usan lenguaje elogioso sin sustento factual. Cita textual del RFE: "Letters that specifically articulate how the person's contributions are of major significance to the field and their impact on subsequent work add value. Letters that lack specifics and simply use hyperbolic language do not add value and are not considered to be probative evidence." Y: "...must explain, in detail, how the contribution was 'original' (not merely replicating the work of others) and how they were of 'major' significance."

REGLA ANTI-HIPÉRBOLE (obligatoria, sin excepción):
Ninguna frase evaluativa ("extraordinary", "exceptional", "pioneering", "invaluable") puede aparecer sin un hecho verificable inmediatamente adyacente que la sostenga (fecha, cifra, institución, resultado medible). Una frase elogiosa sin ese anclaje es hipérbole vacía y debes evitarla por completo.

ESTRUCTURA OBLIGATORIA — 7 bloques (8 claves, el bloque 4 se divide en 4a/4b):
1. Encabezado/Asunto — destinatario USCIS, referencia del caso, propósito de la carta
2. Identidad y autoridad del firmante — por qué su palabra tiene peso (credenciales)
3. Naturaleza de la relación — tipo y duración de la relación con el beneficiario
4a. Originalidad — qué introdujo o inventó el beneficiario que no fuera replicar el trabajo de otros
4b. Significancia — el impacto posterior y verificable de esa contribución (adopción institucional, cambios normativos, influencia en otros profesionales, resultados medibles) — NUNCA una repetición del mismo hecho de 4a sin el elemento temporal/downstream
5. Conexión regulatoria — por qué esto satisface específicamente el criterio ${criterionCitation}. CRÍTICO: el firmante NUNCA debe citar el número del CFR, usar frases como "the regulation requires" o "satisfies the standard", ni estructurar el párrafo como un argumento legal formal ("on originality... on major significance..."). El firmante no es abogado — es un colega, supervisor, o experto de campo, y debe seguir sonando como tal incluso en este bloque. En vez de citar la ley, debe describir en sus propias palabras profesionales por qué lo que presenció fue genuinamente nuevo y por qué tuvo un impacto real y medible — dejando que esos hechos, no una cita legal, sean los que demuestren el punto. Piensa en cómo ese profesional específico (dado su rol y background, ya descritos en el bloque 2) explicaría naturalmente por qué esto importa, no en cómo lo explicaría un abogado de inmigración.
6. Declaración de apoyo — postura explícita del firmante
7. Cierre — disponibilidad, contacto, firma (usa el nombre y título del firmante que se te proporciona)

MECANISMO DE VARIACIÓN — estás generando TODAS las cartas de este lote en una sola respuesta, con conciencia mutua entre ellas:

Capa 1 — Formato de presentación: a cada carta le corresponde uno de tres formatos, ya asignado en los datos de entrada (no lo decides tú): "narrative" (prosa continua, sin encabezados de sección dentro del texto), "headed" (con encabezados de sección implícitos en la estructura del párrafo), "numbered" (idem, con numeración implícita). El campo "presentationFormat" en tu salida debe coincidir exactamente con el que se te asignó para cada firmante — el builder de .docx se encarga del renderizado visual, tú solo generas el contenido de cada bloque.

Capa 2 — Variación de contenido: cada carta debe anclar su bloque 4a en un hecho concreto y distinto (fecha, evento, cifra, institución) de las demás cartas del mismo lote. Antes de escribir cada carta, revisa mentalmente los hechos ancla que ya usaste en las cartas anteriores del mismo lote — ningún hecho central puede repetirse entre firmantes.

Capa 3 — Variación de cierre: revisa los cierres (bloques 6-7) ya generados en el mismo lote antes de escribir el siguiente. Ninguna combinación de verbo-de-apoyo + estructura-de-disponibilidad puede repetirse (evita que todas las cartas terminen con la fórmula "I strongly urge/support/endorse...").

FORMATO DE SALIDA — responde ÚNICAMENTE con este JSON, sin texto adicional ni markdown:
{
  "letters": [
    {
      "referenceId": "el id del ReferenceEntry correspondiente, tal como se te proporcionó",
      "presentationFormat": "narrative | headed | numbered",
      "blocks": {
        "block1_header": "string",
        "block2_signerAuthority": "string",
        "block3_relationshipNature": "string",
        "block4a_originality": "string",
        "block4b_significance": "string",
        "block5_regulatoryConnection": "string",
        "block6_supportDeclaration": "string",
        "block7_closing": "string"
      }
    }
  ]
}`;
}

function buildUserPrompt(
  beneficiaryFullName: string,
  visaType: string,
  profession: string,
  industry: string,
  criterionLabel: string,
  criterionCitation: string,
  group: ReferenceEntry[],
  criterionKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blueprint: Record<string, any>
): string {
  const lines: string[] = [];
  lines.push(`BENEFICIARIO:`);
  lines.push(`Nombre: ${beneficiaryFullName}`);
  lines.push(`Clasificación de visa: ${visaType}`);
  lines.push(`Profesión/industria: ${profession} / ${industry}`);
  lines.push(``);
  lines.push(`CRITERIO A SUSTENTAR: ${criterionLabel} (${criterionCitation})`);
  lines.push(``);
  // AUCIS_BLUEPRINT_EXECUTION_CONTRACT.md Sección 1: A3 ejecuta la
  // decisión jurídica ya tomada por A5 — no la reinterpreta ni la
  // recalcula. La teoría del caso y la evidencia específica ya
  // identificada por A5 orientan el contenido; el estilo de redacción
  // (estructura de 7 bloques, regla anti-hipérbole, variación) sigue
  // siendo responsabilidad exclusiva de A3.
  if (blueprint.theory_of_case) {
    lines.push(`TEORÍA DEL CASO (ya decidida por A5 — úsala como contexto, nunca la contradigas):`);
    lines.push(blueprint.theory_of_case);
    lines.push(``);
  }
  const evidenceForCriterion: string[] = (blueprint.evidence_dependencies ?? {})[criterionKey] ?? [];
  if (evidenceForCriterion.length > 0) {
    lines.push(`EVIDENCIA QUE A5 YA IDENTIFICÓ COMO RELEVANTE PARA ESTE CRITERIO — prioriza estos hechos sobre cualquier otro dato del intake:`);
    evidenceForCriterion.forEach((e) => lines.push(`  - ${e}`));
    lines.push(``);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const relevantCrossRefs = (blueprint.criteria_cross_references ?? []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ref: any) => Array.isArray(ref?.criteria) && ref.criteria.includes(criterionKey)
  );
  if (relevantCrossRefs.length > 0) {
    lines.push(`CONEXIONES CON OTROS CRITERIOS (A5 ya identificó esto — puedes reflejarlo naturalmente en el bloque 5 si aplica, sin forzarlo):`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    relevantCrossRefs.forEach((ref: any) => lines.push(`  - ${ref.connection}`));
    lines.push(``);
  }
  lines.push(`FIRMANTES DE ESTE LOTE (genera una carta por cada uno, con conciencia mutua):`);

  group.forEach((ref, i) => {
    const format = PRESENTATION_FORMATS[i % PRESENTATION_FORMATS.length];
    lines.push(``);
    lines.push(`[REFERENCE_ID: ${ref.id}] — Formato asignado: ${format}`);
    lines.push(`Nombre: ${ref.name}`);
    lines.push(`Cargo actual: ${ref.currentTitle} en ${ref.company} (${ref.country})`);
    lines.push(`Relación con el beneficiario: ${relationshipLabelEn(ref.relationshipType)}, durante ${ref.relationshipDuration}`);
    lines.push(`Credenciales del firmante: ${ref.signerCredentials}`);
    lines.push(`Logros específicos que puede atestiguar: ${ref.specificAchievements}`);
  });

  return lines.join("\n");
}

interface ModelLetterResponse {
  referenceId: string;
  presentationFormat: "narrative" | "headed" | "numbered";
  blocks: TestimonialLetterEntry["blocks"];
}

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

async function callClaude(systemPrompt: string, userPrompt: string): Promise<ModelLetterResponse[]> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
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

  let parsed: { letters: ModelLetterResponse[] };
  try {
    parsed = JSON.parse(stripMarkdownFences(raw));
  } catch {
    throw new Error(`Claude response was not valid JSON: ${raw.slice(0, 500)}`);
  }

  if (!Array.isArray(parsed.letters)) {
    throw new Error(`Claude response missing "letters" array`);
  }

  return parsed.letters;
}

// Encapsulado deliberadamente: hoy selecciona el Blueprint vigente vía
// status IN ('approved','locked'), pero ADR-010 ya identificó que status
// mezcla dos dimensiones (workflow editorial + vigencia) — cuando
// case_strategy migre a workflow_status + currency_status (diferido,
// ver AUCIS_ARCHITECTURE_DECISIONS.md ADR-010), solo este función
// necesita actualizarse.
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const case_id: string | undefined = body.case_id;
    const submission_id: string | undefined = body.submission_id;

    if (!case_id) {
      return NextResponse.json({ error: "case_id is required" }, { status: 400 });
    }

    const db = adminDb();

    // ── 0. Fetch approved Blueprint — AUCIS_BLUEPRINT_EXECUTION_CONTRACT.md:
    // A3 ejecuta un Blueprint aprobado, nunca redacta cartas sin uno.
    const blueprint = await getApprovedBlueprint(db, case_id);
    if (!blueprint) {
      return NextResponse.json(
        { error: "No hay un Case Blueprint aprobado para este caso. A3 no puede ejecutar sin una estrategia aprobada." },
        { status: 409 }
      );
    }

    // ── 1. Fetch intake_submission ──────────────────────────────────────
    const subQuery = db.from("intake_submissions").select("*");
    const { data: submission, error: subErr } = submission_id
      ? await subQuery.eq("id", submission_id).maybeSingle()
      : await subQuery.eq("case_id", case_id).maybeSingle();

    if (subErr) throw new Error(`Error fetching submission: ${subErr.message}`);
    if (!submission) {
      return NextResponse.json(
        { error: "No intake submission found for this case." },
        { status: 404 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = submission as Record<string, any>;
    const m1 = sub.module1 ?? {};
    const m9 = sub.module9 ?? { references: [] };

    const beneficiaryFullName: string = m1.fullName ?? "";
    const visaType: string = m1.visaType ?? "";
    const profession: string = m1.profession ?? "";
    const industry: string = m1.industry ?? "";

    const { classification } = resolveCriteriaSet(visaType);
    const criteriaSet = criteriaSetForClassification(classification);

    // ── 2. Group references by targetCriterionKey, restricted to
    // criterios que el Blueprint efectivamente clasificó (dominant,
    // supporting, o corroborative — A3 no decide cuáles participan,
    // esa decisión ya la tomó A5; corroborative también genera
    // documentos, no solo dominant/supporting). ────────────────────────
    const blueprintCriteria = new Set<string>([
      ...(blueprint.dominant_criteria ?? []),
      ...(blueprint.supporting_criteria ?? []),
      ...(blueprint.corroborative_criteria ?? []),
    ]);

    const references: ReferenceEntry[] = m9.references ?? [];
    const grouped = new Map<string, ReferenceEntry[]>();
    for (const ref of references) {
      if (!ref.targetCriterionKey) continue;
      if (!blueprintCriteria.has(ref.targetCriterionKey)) continue;
      const list = grouped.get(ref.targetCriterionKey) ?? [];
      list.push(ref);
      grouped.set(ref.targetCriterionKey, list);
    }

    if (grouped.size === 0) {
      return NextResponse.json(
        { error: "Ninguna referencia con targetCriterionKey coincide con los criterios clasificados en el Blueprint aprobado." },
        { status: 400 }
      );
    }

    // ── 3. Generate one batch per criterion group ───────────────────────
    const results: Awaited<ReturnType<typeof buildAndStoreTestimonialLetters>>[] = [];

    for (const [criterionKey, group] of Array.from(grouped)) {
      const criterionDef = criteriaSet.find((c) => c.key === criterionKey);
      const criterionLabel = criterionDef?.label ?? criterionKey; // español — usado solo para criterion_covered (UI de staff)
      const criterionLabelEn = criterionDef?.labelEn ?? criterionKey; // inglés — usado en los prompts al modelo
      const criterionCitation = criterionDef?.citation ?? criterionKey;

      const systemPrompt = buildSystemPrompt(criterionLabelEn, criterionCitation);
      // AUCIS_BLUEPRINT_EXECUTION_CONTRACT.md Sección 4: si el Blueprint
      // no tiene evidence_dependencies para este criterio, no se inventa
      // ni se sustituye con specificAchievements del intake — se escala
      // marcando el batch para revisión humana explícita, sin bloquear
      // la generación de los demás criterios del mismo caso.
      const hasEvidenceForCriterion =
        ((blueprint.evidence_dependencies ?? {})[criterionKey] ?? []).length > 0;
      if (!hasEvidenceForCriterion) {
        console.warn(
          `[A3 Blueprint Executor] Escalando: criterio ${criterionKey} no tiene evidence_dependencies en el Blueprint aprobado (case_id ${case_id}). Generando sin ese contexto — requiere revisión humana antes de aprobar estas cartas.`
        );
      }

      const userPrompt = buildUserPrompt(
        beneficiaryFullName,
        visaType,
        profession,
        industry,
        criterionLabelEn,
        criterionCitation,
        group,
        criterionKey,
        blueprint
      );

      const modelLetters = await callClaude(systemPrompt, userPrompt);

      const letters: TestimonialLetterEntry[] = modelLetters.map((ml) => {
        const ref = group.find((r) => r.id === ml.referenceId);
        if (!ref) {
          throw new Error(`Model returned unknown referenceId: ${ml.referenceId}`);
        }
        return {
          letterId: crypto.randomUUID(),
          presentationFormat: ml.presentationFormat,
          signerName: ref.name,
          signerTitle: ref.currentTitle,
          signerCompany: ref.company,
          relationshipType: ref.relationshipType,
          blocks: ml.blocks,
        };
      });

      const input: TestimonialLettersInput = {
        caseId: case_id,
        beneficiaryFullName,
        visaType,
        criterionCitation,
        criterionLabel,
        criterionKey,
        letters,
      };

      const batchResult = await buildAndStoreTestimonialLetters(input);
      results.push(batchResult);
    }

    return NextResponse.json({
      case_id,
      criteriaProcessed: Array.from(grouped.keys()),
      batches: results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
