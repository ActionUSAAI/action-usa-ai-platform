// A0 -- CV Extractor domain logic (AUSCIS Intake Intelligence Layer,
// CR-CPS-34/35, design §5.3). Pure, framework-agnostic -- no Supabase
// dependency, so it is directly testable (mirrors the separation
// already established by record-letter-delivery.ts / run-qa-engine.ts).
// src/app/api/intake/a0-extract/route.ts handles HTTP + token auth and
// delegates extraction here.

export const A0_FIELD_LIST = [
  "familyName", "givenName", "middleName", "dateOfBirth", "nationalities",
  "countryOfResidence", "cityOfResidence", "email", "whatsapp",
  "profession", "industry", "yearsExperience",
  "awards", "memberships", "media_coverage", "judging",
  "original_contributions", "scholarly_articles", "critical_role",
  "high_salary", "artistic_exhibitions",
] as const;

export type A0Confidence = "high" | "medium" | "low";
export type A0ExtractedFields = Record<string, { value: string; confidence: A0Confidence }>;

const SYSTEM_PROMPT = `Eres A0, el motor extractor de CVs de AUSCIS (docs/AUCIS_CV_COACH_INTEGRATION.md). Tu única función es EXTRAER Y ESTRUCTURAR información que el documento afirma explícitamente -- nunca evaluar criterios USCIS, nunca determinar elegibilidad, nunca inventar información que no esté en el documento.

Extrae, cuando estén presentes en el documento, estos campos exactos:
${A0_FIELD_LIST.map(f => `- ${f}`).join("\n")}

Los campos familyName..yearsExperience son datos de identidad/profesionales directos.
Los campos awards..artistic_exhibitions son resúmenes narrativos breves (1-3 frases) de cualquier información relevante para ese criterio que el documento mencione explícitamente -- NO los evalúes, solo resume lo que el documento dice.

Para cada campo que puedas extraer, asigna confidence:
- "high": el documento lo afirma directa y claramente
- "medium": requiere alguna interpretación razonable
- "low": mención ambigua o parcial

Nunca extraigas un campo marcado en el documento como "[Pendiente de verificar]" o equivalente -- omítelo.
No inventes valores para campos no mencionados -- simplemente omítelos del resultado.

Responde ÚNICAMENTE con JSON válido de la forma:
{"fields": {"<nombre_campo>": {"value": "...", "confidence": "high|medium|low"}, ...}}`;

export async function extractCvFields(
  fileBase64: string,
  mimeType: string,
  apiKey: string
): Promise<A0ExtractedFields> {
  const isPdf = mimeType === "application/pdf";
  const fileBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: mimeType, data: fileBase64 } }
    : { type: "image",    source: { type: "base64", media_type: mimeType, data: fileBase64 } };

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
  if (isPdf) headers["anthropic-beta"] = "pdfs-2024-09-25";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: [fileBlock, { type: "text", text: "Extrae la información del documento según las instrucciones." }] }],
    }),
  });

  if (!res.ok) throw new Error(`A0 extraction failed: Claude API error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const raw: string = data.content?.[0]?.text ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("A0 extraction returned an unparseable response.");

  let parsed: { fields?: Record<string, { value?: string; confidence?: string }> };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("A0 extraction returned invalid JSON.");
  }

  const fields: A0ExtractedFields = {};
  for (const [key, v] of Object.entries(parsed.fields ?? {})) {
    if (!(A0_FIELD_LIST as readonly string[]).includes(key)) continue;
    if (!v || typeof v.value !== "string" || !v.value.trim()) continue;
    const confidence = v.confidence === "high" || v.confidence === "medium" || v.confidence === "low" ? v.confidence : "low";
    fields[key] = { value: v.value.trim(), confidence };
  }
  return fields;
}
