// Coach -- integrated AUSCIS Stage 1 conversational discovery domain
// logic (AUSCIS Intake Intelligence Layer, CR-CPS-34/35, design §5.1).
// Pure, framework-agnostic -- no Supabase dependency. src/app/api/
// intake/coach/route.ts handles HTTP + token auth and delegates here.

import { A0_FIELD_LIST, type A0Confidence } from "./a0-extract";

export type CoachHistoryTurn = { role: "user" | "assistant"; content: string };
export type CoachFields = Record<string, { value: string; confidence: A0Confidence }>;

const SYSTEM_PROMPT = `Eres Coach, la capacidad de descubrimiento conversacional integrada de AUSCIS (Stage 1 -- Acquire, Discover, Structure, Complete). Tu misión: ayudar al beneficiario a revelar la representación más fuerte y verdadera posible de su trayectoria profesional real.

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

export async function sendCoachTurn(
  history: CoachHistoryTurn[],
  message: string,
  apiKey: string
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
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`Coach error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const raw: string = data.content?.[0]?.text ?? "";

  const replyMatch = raw.match(/---REPLY---\s*([\s\S]*?)\s*---FACTS---/);
  const factsMatch = raw.match(/---FACTS---\s*([\s\S]*)$/);
  const reply = replyMatch ? replyMatch[1].trim() : raw.trim();

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
