// Coach -- integrated AUSCIS Stage 1 conversational discovery domain
// logic (AUSCIS Intake Intelligence Layer, CR-CPS-34/35, design §5.1).
// Pure, framework-agnostic -- no Supabase dependency. src/app/api/
// intake/coach/route.ts handles HTTP + token auth and delegates here.

import { A0_FIELD_LIST, type A0Confidence } from "./a0-extract";

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

// CR-CPS-57 §8 -- context-dependent operating guidance appended to the
// base prompt. Confirmed Class A1 facts are never re-asked (and are also
// structurally protected regardless, by acquireCoachFields() -- this is
// belt-and-suspenders, not the sole protection). When professional
// baseline/criterion information already exists, Coach's stated priority
// shifts to reinforcement/enrichment of that information relative to
// applicable extraordinary-ability criteria -- this happens naturally
// (no separate persisted PATH A/PATH B flag) because the guidance is
// conditioned on there being anything yet to enrich.
export function describeProfileContext(profileContext?: CoachProfileContext): string {
  if (!profileContext) return "";
  const confirmed: string[] = [];
  const known: string[] = [];
  for (const key of A0_FIELD_LIST) {
    const f = profileContext[key];
    if (!f || !f.value) continue;
    if (f.status === "beneficiary_confirmed") confirmed.push(key);
    else known.push(key);
  }
  if (confirmed.length === 0 && known.length === 0) return "";

  const lines: string[] = [];
  if (confirmed.length > 0) {
    lines.push(`Estos campos YA fueron confirmados por el beneficiario -- NUNCA los vuelvas a preguntar ni los incluyas en FACTS, incluso si el beneficiario los menciona de nuevo con otra redacción, idioma o formato: ${confirmed.join(", ")}.`);
  }
  if (known.length > 0) {
    lines.push(`Estos campos ya tienen información (del CV o de esta conversación) pero aún no están confirmados por el beneficiario -- no los repreguntes salvo que el beneficiario aporte espontáneamente más detalle: ${known.join(", ")}.`);
  }
  lines.push("Ya existe información profesional de base. Tu prioridad principal ahora es reforzar, profundizar y enriquecer esa información en relación con los criterios de habilidad extraordinaria aplicables -- alcance, impacto, selectividad, relevancia, responsabilidad, liderazgo, reconocimiento, corroboración independiente, resultados medibles, fechas/duración, alcance geográfico, distinción organizacional, audiencia/circulación/adopción, contexto de compensación, responsabilidad de jurado/evaluación, disponibilidad de soporte documental -- cuando sean relevantes a los hechos ya conocidos. También puedes descubrir hechos profesionales/de criterio adicionales que no estén en el CV. Nunca determines si un criterio está satisfecho ni si el beneficiario califica -- eso permanece prohibido.");

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
