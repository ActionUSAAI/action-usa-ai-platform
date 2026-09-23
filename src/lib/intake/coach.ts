// Coach -- integrated AUSCIS Stage 1 conversational discovery domain
// logic (AUSCIS Intake Intelligence Layer, CR-CPS-34/35, design §5.1).
// Pure, framework-agnostic -- no Supabase dependency. src/app/api/
// intake/coach/route.ts handles HTTP + token auth and delegates here.

import { A0_FIELD_LIST, type A0Confidence } from "./a0-extract";
import { CLASS_A1_FIELDS } from "./structured-profile";

export type CoachHistoryTurn = { role: "user" | "assistant"; content: string };
export type CoachFields = Record<string, { value: string; confidence: A0Confidence }>;

// CR-CPS-57 §7 -- data-minimized Structured Profile context (mirrors
// src/lib/intake/structured-profile.ts's minimizedProfileContext() return
// shape; duplicated as a narrow local type only so this module does not
// need to import the full StructuredProfileStatus union for one field).
export type CoachProfileContext = Record<string, { value: string | null; status: string }>;

const BASE_SYSTEM_PROMPT = `Eres Coach, la capacidad de descubrimiento conversacional integrada de AUSCIS (Stage 1 -- Acquire, Discover, Structure, Complete). Tu misión: ayudar al beneficiario a revelar la representación más fuerte y verdadera posible de su trayectoria profesional real.

PRINCIPIO RECTOR: no te limites a registrar lo que el beneficiario dice de forma casual o minimizada. Investiga con preguntas de seguimiento: alcance, impacto, responsabilidad, complejidad, influencia, resultados cuantificables, corroboración. Si el beneficiario dice algo como "solo ayudé con..." o "no creo que cuente", profundiza -- pero SIN fabricar, exagerar, ni convertir incertidumbre en hecho.

PROHIBIDO SIEMPRE:
- inventar, exagerar o embellecer cualquier hecho
- determinar si un criterio USCIS está satisfecho
- decir o insinuar que el beneficiario califica o no califica
- verificar evidencia o dar una conclusión legal
- convertir una respuesta incierta ("creo que", "tal vez") en un hecho firme

Si el beneficiario no sabe o no recuerda algo, preserva esa incertidumbre explícitamente -- no la completes.

Mantén un tono cálido, profesional, curioso y persistente cuando algo parezca incompleto. Una pregunta a la vez.

Después de cada respuesta del beneficiario, si mencionó información nueva y suficientemente concreta relacionada con estos campos, inclúyela en FACTS (omite cualquier campo sin información nueva; nunca inventes un valor):
${A0_FIELD_LIST.join(", ")}

Responde EXACTAMENTE en este formato:
---REPLY---
<tu siguiente pregunta o comentario para el beneficiario, en español>
---FACTS---
{"fields": {"<campo>": {"value": "...", "confidence": "high|medium|low"}, ...}}`;

// CR-CPS-57 §8, corrected under P7-ALDO-M0-IMP-01-R1 (MR findings F-01/
// F-02) -- context-dependent operating guidance appended to the base
// prompt. Three, and only three, categories are distinguished:
//
//   PROTECTED CLASS A1  -- beneficiary_confirmed Class A1 fact. Never
//     re-asked, never re-emitted in FACTS. This is belt-and-suspenders --
//     acquireCoachFields() enforces the same rule structurally regardless
//     of prompt compliance.
//   MISSING/UNCONFIRMED CLASS A1 -- everything else in CLASS_A1_FIELDS
//     (absent, not_yet_acquired, acquired_unconfirmed, or conflicting).
//     Acquisition/confirmation of these remains an explicitly active
//     responsibility -- this is what keeps R-01's PATH B "information
//     completeness mandatory" guarantee intact once any single
//     professional fact has already been acquired.
//   ENRICHABLE (Class A2/B) -- ANY field outside CLASS_A1_FIELDS with a
//     value, confirmed or not. F-01 fix: these are never placed in the
//     protected-A1 list merely because they are beneficiary_confirmed --
//     confirmation attests the value, it does not freeze the topic.
//
// No persisted PATH A/PATH B flag exists or is introduced -- the same
// three-category logic applies unconditionally on both paths (§8 of the
// R1 authorization).
export function describeProfileContext(profileContext?: CoachProfileContext): string {
  if (!profileContext) return "";

  const protectedA1: string[] = [];
  const missingA1: string[] = [];
  for (const key of CLASS_A1_FIELDS) {
    const f = profileContext[key];
    if (f && f.value && f.status === "beneficiary_confirmed") protectedA1.push(key);
    else missingA1.push(key);
  }

  const enrichable: string[] = [];
  for (const key of A0_FIELD_LIST) {
    if ((CLASS_A1_FIELDS as readonly string[]).includes(key)) continue;
    const f = profileContext[key];
    if (!f || !f.value) continue;
    enrichable.push(key);
  }

  // Nothing known at all yet (first PATH B turn, or before A0/Coach has
  // acquired anything on PATH A): no context guidance needed -- broad
  // acquisition via the unmodified base prompt remains fully available.
  if (protectedA1.length === 0 && enrichable.length === 0) return "";

  const lines: string[] = [];
  if (protectedA1.length > 0) {
    lines.push(`Estos campos YA fueron confirmados por el beneficiario -- NUNCA los vuelvas a preguntar ni los incluyas en FACTS, incluso si el beneficiario los menciona de nuevo con otra redacción, idioma o formato: ${protectedA1.join(", ")}.`);
  }
  if (missingA1.length > 0) {
    lines.push(`Estos campos de identidad/contacto AÚN no han sido confirmados por el beneficiario (o no tienen información todavía): ${missingA1.join(", ")}. Completarlos y ayudar a confirmarlos sigue siendo tu responsabilidad activa, en paralelo con cualquier profundización profesional -- no la sustituye.`);
  }
  if (enrichable.length > 0) {
    const pendingClause = missingA1.length > 0
      ? " Esto es un complemento a -- no un reemplazo de -- completar la información de identidad/contacto aún pendiente indicada arriba."
      : "";
    lines.push(`Ya existe información profesional de base (${enrichable.join(", ")}). Puedes profundizarla y enriquecerla en relación con los criterios de habilidad extraordinaria aplicables -- alcance, impacto, selectividad, relevancia, responsabilidad, liderazgo, reconocimiento, corroboración independiente, resultados medibles, fechas/duración, alcance geográfico, distinción organizacional, audiencia/circulación/adopción, contexto de compensación, responsabilidad de jurado/evaluación, disponibilidad de soporte documental -- cuando sean relevantes. También puedes descubrir hechos profesionales/de criterio adicionales que no estén en el CV. Que un campo profesional ya haya sido confirmado por el beneficiario NO significa que debas dejar de preguntar sobre ese tema -- solo significa que el valor ya atestiguado nunca debe descartarse o reemplazarse en silencio.${pendingClause} Nunca determines si un criterio está satisfecho ni si el beneficiario califica -- eso permanece prohibido.`);
  }

  return "\n\n" + lines.join("\n");
}

export function buildSystemPrompt(profileContext?: CoachProfileContext): string {
  return BASE_SYSTEM_PROMPT + describeProfileContext(profileContext);
}

// P7-ALDO-M0-SF1 corrective invariant: internal structured Coach output
// must never be rendered as beneficiary-facing conversational text.
// Extracted as a pure function (mirrors this module's own "framework-
// agnostic, directly testable" design goal, already stated for A0) so the
// parsing/sanitization boundary is testable without a live model call.
export function parseCoachResponse(raw: string): { reply: string; fields: CoachFields } {
  const replyMatch = raw.match(/---REPLY---\s*([\s\S]*?)\s*---FACTS---/);
  const factsMatch = raw.match(/---FACTS---\s*([\s\S]*)$/);

  let reply: string;
  if (replyMatch) {
    reply = replyMatch[1].trim();
  } else {
    // Defensive fallback: the model deviated from the exact ---REPLY---
    // / ---FACTS--- contract. The internal FACTS payload must still never
    // reach the beneficiary -- strip everything from the first literal
    // ---FACTS--- marker onward, and any stray ---REPLY--- marker itself,
    // before falling back to the remaining raw text. No-op when neither
    // marker is present (plain free-text reply, unchanged behavior).
    reply = raw.split(/---FACTS---/)[0].replace(/---REPLY---/g, "").trim();
  }

  const fields: CoachFields = {};
  if (factsMatch) {
    const jsonMatch = factsMatch[1].match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { fields?: Record<string, { value?: string; confidence?: string }> };
        for (const [key, v] of Object.entries(parsed.fields ?? {})) {
          if (!(A0_FIELD_LIST as readonly string[]).includes(key)) continue;
          if (!v || typeof v.value !== "string" || !v.value.trim()) continue;
          const confidence = v.confidence === "high" || v.confidence === "medium" || v.confidence === "low" ? v.confidence : "low";
          fields[key] = { value: v.value.trim(), confidence };
        }
      } catch { /* malformed FACTS block -- reply still returned, no facts extracted this turn */ }
    }
  }

  return { reply, fields };
}

export async function sendCoachTurn(
  history: CoachHistoryTurn[],
  message: string,
  apiKey: string,
  profileContext?: CoachProfileContext
): Promise<{ reply: string; fields: CoachFields }> {
  const messages = [...history, { role: "user" as const, content: message }];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: buildSystemPrompt(profileContext),
      messages,
    }),
  });

  if (!res.ok) throw new Error(`Coach error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const raw: string = data.content?.[0]?.text ?? "";

  return parseCoachResponse(raw);
}
