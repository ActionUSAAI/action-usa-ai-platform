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

// PI-D1C -- bounded, opaque, turn-local Employment identity contexts the
// application may offer Coach so it can guide conversation toward known
// professional facts without ever being told a candidateId (PI-D1-R1 §F/
// §G firewall, PI-D1-R2/R3 alias architecture). The alias is routing
// metadata only -- it carries no identity, acceptance, evidence, or
// persistence meaning (PI-D1-R2 §I/§J). Which Candidates become P1/P2/P3,
// pinning, and rotation are all future IntakeForm/D1D application
// concerns; this module only ever receives and echoes an already-built
// snapshot.
export interface BoundedEmploymentContext {
  alias: "P1" | "P2" | "P3";
  identity: {
    company: string;
    title: string;
    startDate: string;
    endDate: string;
  };
}

// PI-D1C -- Coach's own structured routing intent for the NEXT question
// it is about to ask (not the current beneficiary message, PI-D1-R2 §F
// off-by-one firewall). `known_employment` is only ever valid when its
// alias exists in THIS exact request's bounded snapshot (layer-2
// membership check, PI-D1-R2 §22) -- an absent/invalid/fuzzy alias, or
// any other malformed signal, downgrades to `none` rather than being
// reinterpreted or reanchored. `continue_new_employment` (PI-D1-R3,
// frozen) and `open_discovery` carry no entity identity at all; binding
// either to an actual Candidate is explicitly NOT this module's or this
// slice's responsibility (PI-D1-R3 same-turn cardinality binding, owned
// by future IntakeForm/D1D application logic).
export type NextProfessionalTopic =
  | { mode: "known_employment"; alias: "P1" | "P2" | "P3" }
  | { mode: "open_discovery" }
  | { mode: "continue_new_employment" }
  | { mode: "none" };

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

A3-R1: reglas específicas para countryOfBirth y los campos de dirección extranjera (foreignStreet, foreignCity, foreignProvince, foreignPostalCode, foreignCountry) -- idénticas en espíritu a las que ya rigen la extracción de CV:
- countryOfBirth es el país de NACIMIENTO del beneficiario. NUNCA lo infieras de nationalities, countryOfResidence, cityOfResidence, foreignCountry ni foreignCity. Decir "soy colombiano" o "vivo en México" (incluso ambos juntos) NO establece countryOfBirth -- solo una afirmación explícita sobre dónde nació (p. ej. "nací en Colombia", o un equivalente natural) lo establece.
- countryOfResidence/cityOfResidence (dónde vive actualmente el beneficiario) y foreignCountry/foreignCity (los componentes de su dirección extranjera) son conceptos distintos. Una afirmación como "vivo en Cali, Colombia" puede respaldar cityOfResidence/countryOfResidence, pero NUNCA establece automáticamente foreignCity/foreignCountry -- solo hazlo si el beneficiario afirma explícitamente que esa es también su dirección extranjera.
- Los cinco campos de dirección extranjera son independientes entre sí: registra solo el/los componente(s) que el beneficiario afirme explícitamente, sin requerir los demás y sin derivar ni fabricar un componente a partir de otro (p. ej. de foreignCity nunca derives foreignCountry).
- foreignPostalCode es siempre texto exacto tal como lo diga el beneficiario, preservando cualquier cero inicial -- nunca lo conviertas a número.
- Si una afirmación es ambigua respecto a cuál de estos campos aplica, pregunta para aclarar o deja el campo sin resolver -- nunca completes la ambigüedad por inferencia.

Además de FACTS, después de cada respuesta reporta en una sección final ---NEXT_TOPIC--- un objeto JSON que describe de qué trata tu PRÓXIMA pregunta (la que acabas de redactar en tu respuesta de este mismo turno) -- nunca el mensaje del beneficiario que acabas de recibir. Usa exactamente uno de estos modos:
- "known_employment" con "alias": solo si tu próxima pregunta profundiza uno de los contextos profesionales conocidos que la aplicación te indique en este turno (ver sección de contextos más abajo, si existe) -- usa exactamente el alias indicado por la aplicación, nunca inventes uno.
- "continue_new_employment": si tu próxima pregunta continúa profundizando un hecho de empleo completamente NUEVO que el beneficiario acaba de mencionar en su mensaje más reciente (uno que no está en la lista de contextos conocidos).
- "open_discovery": si tu próxima pregunta explora un tema profesional nuevo sin relación con los contextos conocidos ni con un empleo recién mencionado.
- "none": si tu próxima pregunta no tiene un enrutamiento profesional/de empleo aplicable -- identidad, contacto, administrativo, cierre o resumen sin pregunta, u otro tema no profesional.
Nunca incluyas ningún identificador que no sea el alias exacto indicado por la aplicación. Nunca inventes un alias. Nunca menciones "P1", "P2", "P3", "known_employment", "open_discovery", "continue_new_employment", "none" ni "NEXT_TOPIC" en tu respuesta al beneficiario -- son mecánica interna de enrutamiento, nunca terminología de cara al beneficiario.

Responde EXACTAMENTE en este formato:
---REPLY---
<tu siguiente pregunta o comentario para el beneficiario, en español>
---FACTS---
{"fields": {"<campo>": {"value": "...", "confidence": "high|medium|low"}, ...}}
---NEXT_TOPIC---
{"mode": "known_employment|open_discovery|continue_new_employment|none"}`;

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

// PI-D1C -- appended only when a non-empty bounded snapshot exists for
// this turn; the common no-context case leaves the prompt byte-identical
// to its pre-D1C shape (empty string contributes nothing). Lists only
// identity fields (company/title/startDate/endDate) -- never candidateId,
// never material fields (mainFunctions/importantProjects/mainAchievements),
// never provenance, never Candidate status (PI-D1-R1 §F/§G firewall;
// PI-D1C §6/§8). Explicitly frames the listed facts as machine-held
// context, not new beneficiary assertions, and reiterates that the
// alias labels are internal routing mechanics never spoken to the
// beneficiary.
function describeBoundedEmploymentContexts(contexts: readonly BoundedEmploymentContext[]): string {
  if (contexts.length === 0) return "";
  const lines = contexts.map(c => {
    const dates = c.identity.startDate || c.identity.endDate
      ? ` (${c.identity.startDate || "?"} - ${c.identity.endDate || "Presente"})`
      : "";
    return `${c.alias}: ${c.identity.title || "(puesto no especificado)"} en ${c.identity.company || "(empresa no especificada)"}${dates}`;
  }).join("\n");
  return `\n\nCONTEXTOS PROFESIONALES CONOCIDOS DISPONIBLES PARA ESTE TURNO (datos ya registrados por la aplicación -- NO son afirmaciones nuevas del beneficiario; las etiquetas son mecánica interna de enrutamiento que nunca debes mencionar al beneficiario):\n${lines}\n\nPuedes usar esta información para guiar preguntas de seguimiento naturales cuando sea útil -- no asumas que está completa, no inventes hechos que no se muestren aquí, y no afirmes que esto es evidencia verificada. Si tu próxima pregunta profundiza uno de estos contextos, usa su alias exacto en NEXT_TOPIC.`;
}

export function buildSystemPrompt(
  profileContext?: CoachProfileContext,
  boundedEmploymentContexts?: readonly BoundedEmploymentContext[]
): string {
  return BASE_SYSTEM_PROMPT + describeProfileContext(profileContext) + describeBoundedEmploymentContexts(boundedEmploymentContexts ?? []);
}

// PI-D1C -- strict, defensive parser for the NEXT_TOPIC routing signal.
// Layer 1 (vocabulary): mode must be exactly one of the four frozen
// values; a known_employment alias must be exactly "P1"/"P2"/"P3" --
// no normalization, no fuzzy variants ("p1","P01","1","job1" all fail).
// Layer 2 (snapshot membership): a syntactically valid alias that was
// NOT part of THIS exact request's bounded snapshot still downgrades to
// "none" -- never reanchored, never semantically recovered from reply
// prose. Any other malformed input (missing marker, empty marker,
// malformed JSON, a JSON array, an unknown mode, a known_employment
// with no alias) downgrades to "none" the same way -- this signal can
// never fail the overall Coach response (PI-D1-R2/R3 off-by-one and
// safe-fallback firewalls).
function parseNextProfessionalTopic(
  rawSection: string | undefined,
  boundedEmploymentContexts: readonly BoundedEmploymentContext[]
): NextProfessionalTopic {
  if (!rawSection) return { mode: "none" };
  const jsonMatch = rawSection.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { mode: "none" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return { mode: "none" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { mode: "none" };

  const p = parsed as Record<string, unknown>;
  if (p.mode === "open_discovery" || p.mode === "continue_new_employment" || p.mode === "none") {
    return { mode: p.mode };
  }
  if (p.mode === "known_employment") {
    const alias = p.alias;
    if (alias !== "P1" && alias !== "P2" && alias !== "P3") return { mode: "none" };
    if (!boundedEmploymentContexts.some(c => c.alias === alias)) return { mode: "none" };
    return { mode: "known_employment", alias };
  }
  return { mode: "none" };
}

// P7-ALDO-M0-SF1 corrective invariant: internal structured Coach output
// must never be rendered as beneficiary-facing conversational text.
// Extracted as a pure function (mirrors this module's own "framework-
// agnostic, directly testable" design goal, already stated for A0) so the
// parsing/sanitization boundary is testable without a live model call.
//
// PI-D1C extends this additively with a third, fully independent marker
// boundary (---NEXT_TOPIC---) -- FACTS parsing is unchanged and remains
// unaffected by a malformed/missing NEXT_TOPIC section; NEXT_TOPIC
// parsing is equally unaffected by a malformed/missing FACTS section.
// `boundedEmploymentContexts` governs only NEXT_TOPIC's layer-2 alias
// membership validation -- it never affects reply/FACTS extraction.
export function parseCoachResponse(
  raw: string,
  boundedEmploymentContexts?: readonly BoundedEmploymentContext[]
): { reply: string; fields: CoachFields; nextProfessionalTopic: NextProfessionalTopic } {
  const replyMatch = raw.match(/---REPLY---\s*([\s\S]*?)\s*---(?:FACTS|NEXT_TOPIC)---/);
  const factsMatch = raw.match(/---FACTS---\s*([\s\S]*?)(?=\s*---NEXT_TOPIC---|$)/);
  const nextTopicMatch = raw.match(/---NEXT_TOPIC---\s*([\s\S]*)$/);

  let reply: string;
  if (replyMatch) {
    reply = replyMatch[1].trim();
  } else {
    // Defensive fallback: the model deviated from the exact ---REPLY---
    // / ---FACTS--- / ---NEXT_TOPIC--- contract. The internal FACTS/
    // NEXT_TOPIC payloads must still never reach the beneficiary -- strip
    // everything from the first literal ---FACTS--- or ---NEXT_TOPIC---
    // marker onward, and any stray ---REPLY--- marker itself, before
    // falling back to the remaining raw text. No-op when none of the
    // markers are present (plain free-text reply, unchanged behavior).
    reply = raw.split(/---FACTS---|---NEXT_TOPIC---/)[0].replace(/---REPLY---/g, "").trim();
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

  const nextProfessionalTopic = parseNextProfessionalTopic(nextTopicMatch?.[1], boundedEmploymentContexts ?? []);

  return { reply, fields, nextProfessionalTopic };
}

export async function sendCoachTurn(
  history: CoachHistoryTurn[],
  message: string,
  apiKey: string,
  profileContext?: CoachProfileContext,
  boundedEmploymentContexts?: readonly BoundedEmploymentContext[]
): Promise<{ reply: string; fields: CoachFields; nextProfessionalTopic: NextProfessionalTopic }> {
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
      system: buildSystemPrompt(profileContext, boundedEmploymentContexts),
      messages,
    }),
  });

  if (!res.ok) throw new Error(`Coach error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const raw: string = data.content?.[0]?.text ?? "";

  return parseCoachResponse(raw, boundedEmploymentContexts);
}
