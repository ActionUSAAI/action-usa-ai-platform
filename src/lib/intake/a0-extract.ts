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
  // A0-M1-SLICE-A2: current-case acquisition for Module 1's countryOfBirth +
  // foreign-address fields (M1-GAP-01..06, frozen design docs/intake/
  // A0-STRUCTURED-PROFILE-MODULE1-EXACT-DESIGN.md §F). Same IDENTITY_FIELDS
  // membership established for these keys in Slice A1 (structured-profile.ts).
  "countryOfBirth", "foreignStreet", "foreignCity", "foreignProvince",
  "foreignPostalCode", "foreignCountry",
  "awards", "memberships", "media_coverage", "judging",
  "original_contributions", "scholarly_articles", "critical_role",
  "high_salary", "artistic_exhibitions",
] as const;

export type A0Confidence = "high" | "medium" | "low";
export type A0ExtractedFields = Record<string, { value: string; confidence: A0Confidence }>;

const SYSTEM_PROMPT = `Eres A0, el motor extractor de CVs de AUSCIS (docs/AUCIS_CV_COACH_INTEGRATION.md). Tu única función es EXTRAER Y ESTRUCTURAR información que el documento afirma explícitamente -- nunca evaluar criterios USCIS, nunca determinar elegibilidad, nunca inventar información que no esté en el documento.

Extrae, cuando estén presentes en el documento, estos campos exactos:
${A0_FIELD_LIST.map(f => `- ${f}`).join("\n")}

Los campos familyName..foreignCountry son datos de identidad/profesionales/dirección directos.
Los campos awards..artistic_exhibitions son resúmenes narrativos breves (1-3 frases) de cualquier información relevante para ese criterio que el documento mencione explícitamente -- NO los evalúes, solo resume lo que el documento dice.

Reglas específicas para countryOfBirth y los campos de dirección extranjera (foreignStreet, foreignCity, foreignProvince, foreignPostalCode, foreignCountry):
- countryOfBirth es el país de nacimiento. NUNCA lo infieras de nationalities, countryOfResidence, ni cityOfResidence -- extráelo solo si el documento lo afirma explícitamente como país de nacimiento.
- Los cinco campos de dirección extranjera son independientes entre sí: extrae cada uno solo si el documento lo afirma explícitamente, sin requerir que los demás estén presentes y sin inventar ni derivar un componente a partir de otro (p. ej. no derives foreignCountry a partir de foreignCity).
- foreignPostalCode es siempre texto exacto, preservando cualquier cero inicial -- nunca lo conviertas a número.

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

// ============================================================
// Professional Candidate Acquisition (PI-B1) -- a SECOND, fully
// independent acquisition call/parser, added alongside extractCvFields()
// without modifying it (Post-Module1 Professional Intelligence Exact
// Architecture + PI-B Exact Design, TWO_CALLS). Consumes the already-
// closed PI-A candidate model (src/lib/intake/professional-intelligence.ts)
// unmodified. Scope: Employment/Education/Certification/Business/Evidence
// only -- Reference and StrategicAnswer remain deferred to future Coach
// work and are never requested or constructed here. No within-CV
// deduplication is performed (Owner-frozen PI-B1 scope reduction): every
// valid candidate occurrence is preserved as its own candidate.
import {
  type ProfessionalIntelligenceCandidates,
  type EmploymentCandidate,
  type EducationCandidate,
  type CertificationCandidate,
  type BusinessCandidate,
  type EvidenceCandidate,
  type EvidenceCandidateCategory,
  type CandidateConfidence,
  emptyProfessionalIntelligenceCandidates,
} from "./professional-intelligence";

const EVIDENCE_CATEGORIES: readonly EvidenceCandidateCategory[] =
  ["awards", "memberships", "media", "judging", "criticalRole", "artisticExhibitions"];

// Explicit, non-fuzzy ownership/founding vocabulary (§45). Matched as a
// whole word (case-insensitive) inside the model-returned role string --
// never by inferring ownership from an ordinary executive title like
// "CEO"/"President"/"Director"/"Manager" alone.
const OWNERSHIP_ROLE_WORDS = [
  "founder", "co-founder", "cofounder", "owner", "partner",
  "fundador", "fundadora", "cofundador", "cofundadora",
  "propietario", "propietaria", "socio", "socia",
];
function hasOwnershipRole(role: string): boolean {
  const normalized = role.toLowerCase();
  return OWNERSHIP_ROLE_WORDS.some(word => new RegExp(`\\b${word}\\b`).test(normalized));
}

const PROFESSIONAL_CANDIDATE_SYSTEM_PROMPT = `Eres el motor de adquisición de candidatos profesionales de AUSCIS. Tu única función es PROPONER, a partir del CV, candidatos de información profesional que el beneficiario podrá revisar y aceptar más adelante -- nunca evaluar criterios de inmigración, nunca determinar criterios O-1/EB-1, nunca inventar, nunca enriquecer con conocimiento general, nunca afirmar que existe evidencia documental.

Reglas estrictas, aplicables a TODAS las categorías:
- Extrae solo información que el documento afirme explícitamente.
- NUNCA infieras responsabilidades a partir de un título de puesto.
- NUNCA infieras logros a partir de responsabilidades.
- NUNCA infieras propiedad/fundación de una empresa a partir de un empleo ordinario (CEO, Presidente, Director, Gerente NO implican propiedad por sí solos).
- NUNCA conviertas a un colega, supervisor, cliente o participante de proyecto mencionado en el texto en una referencia -- NO generes candidatos de referencia bajo ninguna circunstancia.
- NUNCA generes candidatos de "respuesta estratégica" -- esa categoría no existe en esta tarea.
- NUNCA afirmes que existe evidencia documental, que el beneficiario la posee, ni determines si un criterio está satisfecho.
- Cada elemento real distinto (cada empleo, cada título académico, cada certificación, cada empresa) debe ser un elemento separado del arreglo correspondiente -- nunca resumas varios elementos distintos en uno solo.
- Para cada candidato incluye "confidence" ("high"|"medium"|"low") y "rawText" (el texto de apoyo que redactes a partir del documento para este candidato -- preferiblemente fiel a la redacción original, nunca inventado).

Fechas de empleo (startDate, endDate):
- Si el documento indica explícitamente mes Y año, usa el formato "YYYY-MM".
- Si el documento indica solo el año, conserva el año tal cual (p. ej. "2022") -- NUNCA inventes un mes.
- Si el documento indica "Presente", "Actual", "Actualmente" o equivalente, deja endDate como cadena vacía -- NUNCA inventes un mes de finalización.
- Si una fecha no está explícita, deja el campo como cadena vacía.

Empresas propias (BusinessCandidate): genera un candidato solo cuando el documento establece explícitamente una relación de propiedad o fundación (p. ej. "Fundador", "Co-fundador", "Propietario", "Socio" o equivalente) -- nunca a partir de un cargo ejecutivo ordinario por sí solo.

Evidencia (EvidenceCandidate): las categorías permitidas son exactamente "awards", "memberships", "media", "judging", "criticalRole", "artisticExhibitions". Genera un candidato solo cuando el documento contiene una afirmación explícita que pertenece razonablemente a esa categoría -- esto NUNCA significa que la evidencia exista o que el beneficiario la posea, solo que esa categoría podría merecer revisión.

No generes ni devuelvas: id, status, source, provenance, caseId, clientId, destino de módulo, ni ningún estado de posesión de evidencia -- esos campos son controlados exclusivamente por la aplicación.

Responde ÚNICAMENTE con JSON válido de la forma:
{"candidates": {
  "employment": [{"company":"...","title":"...","startDate":"...","endDate":"...","mainFunctions":"...","importantProjects":"...","mainAchievements":"...","confidence":"high|medium|low","rawText":"..."}],
  "education": [{"institution":"...","degreeName":"...","graduationYear":"...","confidence":"high|medium|low","rawText":"..."}],
  "certification": [{"name":"...","institution":"...","year":"...","confidence":"high|medium|low","rawText":"..."}],
  "business": [{"name":"...","role":"...","foundedYear":"...","confidence":"high|medium|low","rawText":"..."}],
  "evidence": [{"category":"awards|memberships|media|judging|criticalRole|artisticExhibitions","confidence":"high|medium|low","rawText":"..."}]
}}`;

function genCandidateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function validateConfidence(v: unknown): CandidateConfidence {
  return v === "high" || v === "medium" || v === "low" ? v : "low";
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function nonBlank(v: unknown): string | null {
  const s = asString(v);
  return s.length > 0 ? s : null;
}

// Pure, LLM-independent parser/validator -- exported specifically so
// PI-B1 is testable locally without any network/live-model call (§37).
// Never trusts id/status/source/provenance or any other application-
// controlled field from raw input; every candidate is explicitly
// reconstructed field-by-field. Top-level failures (no parseable JSON
// object, invalid JSON) THROW -- they are never silently converted to
// an empty result here; that conversion is the future orchestration
// layer's responsibility (PI-B2), not this function's.
export function parseProfessionalCandidateResponse(raw: string): ProfessionalIntelligenceCandidates {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Professional candidate acquisition returned an unparseable response.");

  let parsed: { candidates?: Record<string, unknown> };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Professional candidate acquisition returned invalid JSON.");
  }

  const raw_: Record<string, unknown> = parsed.candidates ?? {};
  const result = emptyProfessionalIntelligenceCandidates();

  const rawEmployment = Array.isArray(raw_.employment) ? raw_.employment : [];
  for (const item of rawEmployment) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const company = nonBlank(r.company);
    const title = nonBlank(r.title);
    const rawText = nonBlank(r.rawText);
    if (!company || !title || !rawText) continue;
    const candidate: EmploymentCandidate = {
      id: genCandidateId(), domain: "employment", status: "proposed",
      provenance: [{ source: "cv_extraction", rawText, confidence: validateConfidence(r.confidence) }],
      company, title,
      startDate: asString(r.startDate), endDate: asString(r.endDate),
      mainFunctions: asString(r.mainFunctions), importantProjects: asString(r.importantProjects),
      mainAchievements: asString(r.mainAchievements),
    };
    result.employment.push(candidate);
  }

  const rawEducation = Array.isArray(raw_.education) ? raw_.education : [];
  for (const item of rawEducation) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const institution = nonBlank(r.institution);
    const degreeName = nonBlank(r.degreeName);
    const rawText = nonBlank(r.rawText);
    if (!institution || !degreeName || !rawText) continue;
    const candidate: EducationCandidate = {
      id: genCandidateId(), domain: "education", status: "proposed",
      provenance: [{ source: "cv_extraction", rawText, confidence: validateConfidence(r.confidence) }],
      institution, degreeName, graduationYear: asString(r.graduationYear),
    };
    result.education.push(candidate);
  }

  const rawCertification = Array.isArray(raw_.certification) ? raw_.certification : [];
  for (const item of rawCertification) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const name = nonBlank(r.name);
    const rawText = nonBlank(r.rawText);
    if (!name || !rawText) continue;
    const candidate: CertificationCandidate = {
      id: genCandidateId(), domain: "certification", status: "proposed",
      provenance: [{ source: "cv_extraction", rawText, confidence: validateConfidence(r.confidence) }],
      name, institution: asString(r.institution), year: asString(r.year),
    };
    result.certification.push(candidate);
  }

  const rawBusiness = Array.isArray(raw_.business) ? raw_.business : [];
  for (const item of rawBusiness) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const name = nonBlank(r.name);
    const role = nonBlank(r.role);
    const rawText = nonBlank(r.rawText);
    if (!name || !role || !rawText) continue;
    if (!hasOwnershipRole(role)) continue;
    const candidate: BusinessCandidate = {
      id: genCandidateId(), domain: "business", status: "proposed",
      provenance: [{ source: "cv_extraction", rawText, confidence: validateConfidence(r.confidence) }],
      name, role, foundedYear: asString(r.foundedYear),
    };
    result.business.push(candidate);
  }

  const rawEvidence = Array.isArray(raw_.evidence) ? raw_.evidence : [];
  for (const item of rawEvidence) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const category = typeof r.category === "string" ? r.category : "";
    if (!(EVIDENCE_CATEGORIES as readonly string[]).includes(category)) continue;
    const rawText = nonBlank(r.rawText);
    if (!rawText) continue;
    const candidate: EvidenceCandidate = {
      id: genCandidateId(), domain: "evidence", status: "proposed",
      provenance: [{ source: "cv_extraction", rawText, confidence: validateConfidence(r.confidence) }],
      category: category as EvidenceCandidateCategory,
    };
    result.evidence.push(candidate);
  }

  // reference/strategicAnswer: never requested, never constructed, even
  // if the model unexpectedly returns such a bucket -- result.reference
  // and result.strategicAnswer remain the empty arrays emptyProfessionalIntelligenceCandidates() already set.
  return result;
}

export async function extractProfessionalCandidates(
  fileBase64: string,
  mimeType: string,
  apiKey: string
): Promise<ProfessionalIntelligenceCandidates> {
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
      max_tokens: 4096,
      system: PROFESSIONAL_CANDIDATE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: [fileBlock, { type: "text", text: "Propón los candidatos profesionales del documento según las instrucciones." }] }],
    }),
  });

  if (!res.ok) throw new Error(`Professional candidate acquisition failed: Claude API error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const raw: string = data.content?.[0]?.text ?? "";
  return parseProfessionalCandidateResponse(raw);
}
