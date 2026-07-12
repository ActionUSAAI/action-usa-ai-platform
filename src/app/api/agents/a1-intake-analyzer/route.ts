import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return (typeof v === "string" ? v : "") || "";
}

function bool(v: unknown): string {
  return v === true ? "Sí" : v === false ? "No" : "No especificado";
}

function statusLabel(s: string): string {
  if (s === "tengo") return "TIENE EVIDENCIA";
  if (s === "tal_vez") return "POSIBLEMENTE TIENE";
  if (s === "no_tengo") return "NO TIENE";
  return s || "no especificado";
}

// ── Criteria sets by classification ──────────────────────────────────────────

interface CriterionDef { key: string; label: string; }

const CRITERIA_O1A: CriterionDef[] = [
  { key: "awards", label: "Premios o reconocimientos por excelencia en el campo" },
  { key: "memberships", label: "Membresía en asociaciones que requieren logros extraordinarios" },
  { key: "media_coverage", label: "Material publicado sobre el solicitante en medios de comunicación" },
  { key: "judging", label: "Haber evaluado o juzgado el trabajo de otros en el campo" },
  { key: "original_contributions", label: "Contribuciones originales de importancia significativa al campo" },
  { key: "scholarly_articles", label: "Artículos académicos en revistas o publicaciones profesionales" },
  { key: "critical_role_4a", label: "Rol crítico/esencial en organización distinguida — cargo directivo/electo" },
  { key: "critical_role_4b", label: "Rol crítico/esencial en organización distinguida — cargo técnico/instructor" },
  { key: "high_salary", label: "Alta remuneración relativa a los pares del campo" },
];

const CRITERIA_EB1A: CriterionDef[] = [
  ...CRITERIA_O1A.slice(0, 6),
  { key: "artistic_exhibitions", label: "Exhibición del trabajo en exposiciones o muestras artísticas" },
  { key: "critical_role_4a", label: "Rol principal o de suma importancia en organizaciones distinguidas — cargo directivo/electo" },
  { key: "critical_role_4b", label: "Rol principal o de suma importancia en organizaciones distinguidas — cargo técnico/instructor" },
  { key: "high_salary", label: "Salario alto o remuneración notablemente alta" },
  { key: "performing_arts_commercial_success", label: "Éxitos comerciales en las artes escénicas" },
];

const CRITERIA_O1B: CriterionDef[] = [
  { key: "lead_starring_role", label: "Rol principal o protagónico en producciones/eventos de reputación distinguida" },
  { key: "national_recognition", label: "Reconocimiento nacional/internacional por reseñas críticas o material publicado" },
  { key: "critical_role_org", label: "Rol principal, protagónico o crítico en organización de reputación distinguida" },
  { key: "commercial_success", label: "Récord de éxitos comerciales o de crítica mayores" },
  { key: "significant_recognition", label: "Reconocimiento significativo de logros por organizaciones/críticos/expertos" },
  { key: "high_salary", label: "Salario alto o remuneración sustancial comparativa" },
];

function resolveCriteriaSet(visaType: string): { classification: "O-1A" | "O-1B" | "EB-1A"; criteria: CriterionDef[] } {
  const v = (visaType || "").toUpperCase();
  if (v.includes("O-1B")) return { classification: "O-1B", criteria: CRITERIA_O1B };
  if (v.includes("EB-1")) return { classification: "EB-1A", criteria: CRITERIA_EB1A };
  return { classification: "O-1A", criteria: CRITERIA_O1A };
}

function buildSystemPrompt(
  classification: "O-1A" | "O-1B" | "EB-1A",
  criteria: CriterionDef[]
): string {
  const criteriaList = criteria.map(c => `- ${c.key}: ${c.label}`).join("\n");
  const scoresSchema = criteria.map(c => `    "${c.key}": 0-100`).join(",\n");
  const metSchema = criteria.map(c => `    "${c.key}": true/false`).join(",\n");
  const gapsSchema = criteria.map(c => `    "${c.key}": "descripción de brecha o null si está cubierto"`).join(",\n");

  const hasSplitCriticalRole =
    criteria.some(c => c.key === "critical_role_4a") && criteria.some(c => c.key === "critical_role_4b");

  const countingRule = hasSplitCriticalRole
    ? `\nNOTA IMPORTANTE SOBRE CONTEO: critical_role_4a y critical_role_4b representan el MISMO criterio regulatorio (rol crítico/esencial en organización distinguida), evaluado por dos mecanismos de prueba distintos (cargo directivo/electo vs. técnico/instructor). Si AMBOS resultan "met" = true, cuentan como UN SOLO criterio satisfecho para el umbral mínimo, no como dos.`
    : "";

  return `Eres el Agente A1 — Intake Analyzer de AUCIS (Automated Case Intelligence System) de ACTION USA AI.

Tu función es analizar los datos de intake de un cliente y evaluar su viabilidad para una petición ${classification}, basándote en los criterios de USCIS correspondientes a esa clasificación.

CRITERIOS ${classification} (evalúa cada uno con un puntaje 0-100):
${criteriaList}

METODOLOGÍA DE PUNTAJE:
- 75-100: VIABLE — Evidencia sólida, suficiente para sustentar el criterio en la petición
- 50-74: DESARROLLABLE — Alguna evidencia pero necesita fortalecerse o documentarse mejor
- 25-49: DÉBIL — Evidencia limitada, brechas significativas
- 0-24: AUSENTE — Sin evidencia encontrada

Un criterio se considera "met" (criteria_met = true) si su puntaje es ≥ 60.
Se requieren al menos 3 criterios met.${countingRule}

Considera también:
- El estado declarado ("tengo/tal_vez/no_tengo") refleja la percepción del cliente — verifica con la evidencia concreta
- Las notas de disposición ("no_tengo") son oportunidades de desarrollo prospectivo
- Las respuestas del Módulo 11 son indicadores cualitativos del perfil

Devuelve ÚNICAMENTE este objeto JSON exacto, sin markdown ni explicación adicional:
{
  "visa_recommendation": "O-1A" | "O-1B" | "EB-1A" | "O-1A/EB-1A" | "unclear",
  "visa_confidence": "high" | "medium" | "low",
  "overall_strength": "strong" | "moderate" | "weak",
  "criteria_scores": {
${scoresSchema}
  },
  "criteria_met": {
${metSchema}
  },
  "criteria_gaps": {
${gapsSchema}
  },
  "strengths": ["fortaleza 1", "fortaleza 2", ...],
  "weaknesses": ["debilidad 1", "debilidad 2", ...],
  "strategic_notes": "Resumen estratégico ejecutivo para el equipo legal (3-5 oraciones)",
  "recommended_actions": ["acción 1", "acción 2", ...]
}`;
}

// ── Prompt builder ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildUserPrompt(sub: Record<string, any>): string {
  const m1  = sub.module1  ?? {};
  const m5  = sub.module5  ?? {};
  const m6  = sub.module6  ?? {};
  const m7  = sub.module7  ?? {};
  const m8  = sub.module8  ?? {};
  const m9  = sub.module9  ?? {};
  const m10 = sub.module10 ?? {};
  const m11 = sub.module11 ?? {};

  const lines: string[] = [];

  // ── Identity
  lines.push("=== PERFIL DEL SOLICITANTE ===");
  lines.push(`Nombre: ${str(m1.fullName)}`);
  lines.push(`Profesión declarada: ${str(m1.profession)}`);
  lines.push(`Industria: ${str(m1.industry)}`);
  lines.push(`Años de experiencia: ${str(m1.yearsExperience)}`);
  lines.push(`Visa de interés: ${str(m1.visaType)}`);
  lines.push(`Objetivo en EE.UU.: ${str(m1.usaObjective)}`);
  lines.push(`País de origen: ${str(m1.countryOfBirth)}`);
  lines.push(`País de residencia: ${str(m1.countryOfResidence)}`);

  // ── Education
  lines.push("\n=== EDUCACIÓN ===");
  const degrees = (m5.degrees ?? []) as Record<string, unknown>[];
  if (degrees.length === 0) {
    lines.push("Sin títulos registrados.");
  } else {
    degrees.forEach((d, i) => {
      lines.push(`Título ${i + 1}: ${str(d.degreeType)} en ${str(d.degreeName)} — ${str(d.institution)} (${str(d.country)}, ${str(d.graduationYear)})`);
    });
  }

  // ── Certifications
  lines.push("\n=== CERTIFICACIONES ===");
  const certs = (m6.certifications ?? []) as Record<string, unknown>[];
  if (certs.length === 0) {
    lines.push("Sin certificaciones registradas.");
  } else {
    certs.forEach(c => {
      lines.push(`- ${str(c.name)} — ${str(c.institution)} (${str(c.year)})`);
    });
  }

  // ── Employment
  lines.push("\n=== HISTORIAL LABORAL ===");
  const jobs = (m7.employment ?? []) as Record<string, unknown>[];
  if (jobs.length === 0) {
    lines.push("Sin empleos registrados.");
  } else {
    jobs.forEach((e, i) => {
      lines.push(`Empleo ${i + 1}: ${str(e.title)} en ${str(e.company)} (${str(e.country)})`);
      lines.push(`  Período: ${str(e.startDate)} — ${e.isCurrent ? "Presente" : str(e.endDate)}`);
      if (str(e.mainFunctions)) lines.push(`  Funciones: ${str(e.mainFunctions)}`);
      if (str(e.mainAchievements)) lines.push(`  Logros: ${str(e.mainAchievements)}`);
      if (str(e.peopleSupervised) && str(e.peopleSupervised) !== "0") lines.push(`  Personas supervisadas: ${str(e.peopleSupervised)}`);
      if (e.managesBudget) lines.push(`  Gestiona presupuesto: Sí — ${str(e.budgetAmount)}`);
      if (str(e.internationalRecognition)) lines.push(`  Reconocimiento internacional: ${str(e.internationalRecognition)}`);
    });
  }

  // ── Own businesses
  lines.push("\n=== EMPRESAS PROPIAS ===");
  if (m8.hasOwnBusinesses) {
    const biz = (m8.businesses ?? []) as Record<string, unknown>[];
    biz.forEach(b => {
      lines.push(`- ${str(b.name)} (fundada ${str(b.foundingYear)}): ${str(b.role)} — ${str(b.description)}`);
    });
  } else {
    lines.push("No ha fundado empresas propias.");
  }

  // ── References
  lines.push("\n=== REFERENCIAS PROFESIONALES ===");
  const refs = (m9.references ?? []) as Record<string, unknown>[];
  const validRefs = refs.filter(r => str(r.name));
  if (validRefs.length === 0) {
    lines.push("Sin referencias registradas.");
  } else {
    const relLabel = (v: string): string => ({
      supervisor: "Supervisor(a)", colega: "Colega", cliente: "Cliente",
      mentor: "Mentor(a)", colaborador: "Colaborador(a)", subordinado: "Subordinado(a)",
      otro: "Otro",
    }[v] || v);
    validRefs.forEach(r => {
      lines.push(`- ${str(r.name)} — ${str(r.currentTitle)} en ${str(r.company)} (${str(r.country)})`);
      const rel = str(r.relationshipType);
      const dur = str(r.relationshipDuration);
      if (rel || dur) lines.push(`  Relación: ${relLabel(rel) || "no especificada"}${dur ? ` — ${dur}` : ""}`);
      if (str(r.signerCredentials)) lines.push(`  Trayectoria/autoridad: ${str(r.signerCredentials)}`);
      if (str(r.specificAchievements)) lines.push(`  Puede confirmar: ${str(r.specificAchievements)}`);
    });
  }

  // ── Evidence by criterion (Module 10)
  lines.push("\n=== EVIDENCIA POR CRITERIO (MÓDULO 10) ===");

  // Awards
  lines.push(`\n[CRITERION: awards] PREMIOS Y RECONOCIMIENTOS — ${statusLabel(str(m10.awardsStatus))}`);
  const awards = (m10.awards ?? []) as Record<string, unknown>[];
  awards.forEach(a => lines.push(`  - ${str(a.name)} — ${str(a.organization)} (${str(a.year)}) — Alcance: ${str(a.scope)}`));
  if (str(m10.awardsDisposition)) lines.push(`  Notas del cliente: ${str(m10.awardsDisposition)}`);

  // Memberships
  lines.push(`\n[CRITERION: memberships] MEMBRESÍAS PROFESIONALES — ${statusLabel(str(m10.membershipsStatus))}`);
  const memberships = (m10.memberships ?? []) as Record<string, unknown>[];
  memberships.forEach(m => lines.push(`  - ${str(m.organization)} (${str(m.year)}) — Criterios de selección: ${str(m.selectionCriteria)}`));
  if (str(m10.membershipsDisposition)) lines.push(`  Notas del cliente: ${str(m10.membershipsDisposition)}`);

  // Media coverage
  lines.push(`\n[CRITERION: media_coverage] COBERTURA MEDIÁTICA — ${statusLabel(str(m10.mediaStatus))}`);
  const media = (m10.media ?? []) as Record<string, unknown>[];
  media.forEach(med => lines.push(`  - ${str(med.publication)} — "${str(med.title)}" (${str(med.date)}) — Alcance: ${str(med.reach)}`));
  if (str(m10.mediaDisposition)) lines.push(`  Notas del cliente: ${str(m10.mediaDisposition)}`);

  // Scholarly articles
  lines.push(`\n[CRITERION: scholarly_articles] ARTÍCULOS ACADÉMICOS — ${statusLabel(str(m10.articlesStatus))}`);
  const articles = (m10.articles ?? []) as Record<string, unknown>[];
  articles.forEach(a => lines.push(`  - "${str(a.title)}" — ${str(a.journal)} (${str(a.year)}) — Citas: ${str(a.citations) || "0"}`));
  if (str(m10.articlesDisposition)) lines.push(`  Notas del cliente: ${str(m10.articlesDisposition)}`);

  // Books
  lines.push(`\n[CRITERION: scholarly_articles] LIBROS — ${statusLabel(str(m10.booksStatus))}`);
  const books = (m10.books ?? []) as Record<string, unknown>[];
  books.forEach(b => lines.push(`  - "${str(b.title)}" — ${str(b.publisher)} (${str(b.year)})`));
  if (str(m10.booksDisposition)) lines.push(`  Notas del cliente: ${str(m10.booksDisposition)}`);

  // Conferences
  lines.push(`\n[CRITERION: media_coverage] CONFERENCIAS/PRESENTACIONES — ${statusLabel(str(m10.conferencesStatus))}`);
  const conferences = (m10.conferences ?? []) as Record<string, unknown>[];
  conferences.forEach(c => lines.push(`  - ${str(c.name)} (${str(c.year)}) — ${str(c.role) || "presentación"}`));
  if (str(m10.conferencesDisposition)) lines.push(`  Notas del cliente: ${str(m10.conferencesDisposition)}`);

  // Judging
  lines.push(`\n[CRITERION: judging] ROL DE JUEZ/EVALUADOR — ${statusLabel(str(m10.judgingStatus))}`);
  const judging = (m10.judging ?? []) as Record<string, unknown>[];
  judging.forEach(j => lines.push(`  - ${str(j.organization)} (${str(j.year)}) — ${str(j.role)}`));
  if (str(m10.judgingDisposition)) lines.push(`  Notas del cliente: ${str(m10.judgingDisposition)}`);

  // Original contributions (patents)
  lines.push(`\n[CRITERION: original_contributions] CONTRIBUCIONES ORIGINALES / PATENTES — ${statusLabel(str(m10.patentsStatus))}`);
  const patents = (m10.patents ?? []) as Record<string, unknown>[];
  patents.forEach(p => lines.push(`  - ${str(p.title)} (${str(p.year)}) — ${str(p.status)}`));
  if (str(m10.patentsDisposition)) lines.push(`  Notas del cliente: ${str(m10.patentsDisposition)}`);

  // Critical Role (4a/4b) — defensive read, no intake UI exists for this field yet
  if (m10.criticalRole) {
    const cr = m10.criticalRole as Record<string, unknown>;
    if (cr.criticalRoleType === "elected") {
      lines.push(`\n[CRITERION: critical_role_4a] ROL CRÍTICO — DIRECTIVO/ELECTO`);
      lines.push(`  Cargo: ${str(cr.electedOrAppointedTitle)}`);
      lines.push(`  Período: ${str(cr.tenureStartDate)} — ${str(cr.tenureEndDate) || "Presente"}`);
      lines.push(`  Reputación de la organización: ${str(cr.organizationReputationEvidence)}`);
      lines.push(`  Métricas de crecimiento: ${str(cr.organizationalGrowthMetrics)}`);
    } else if (cr.criticalRoleType === "technical") {
      lines.push(`\n[CRITERION: critical_role_4b] ROL CRÍTICO — TÉCNICO/INSTRUCTOR`);
      lines.push(`  Cargo: ${str(cr.formalPositionTitle)}`);
      lines.push(`  Período: ${str(cr.serviceStartDate)} — ${str(cr.serviceEndDate) || "Presente"}`);
      lines.push(`  Cursos/funciones: ${str(cr.specificCoursesOrDutiesTaught)}`);
      lines.push(`  Evidencia de institucionalización: ${str(cr.institutionalizationEvidence)}`);
    }
  } else {
    lines.push(`\n[CRITERION: critical_role_4a/4b] ROL CRÍTICO — Sin datos capturados (pendiente de UI de intake)`);
  }

  // Artistic Exhibitions (EB-1A)
  lines.push(`\n[CRITERION: artistic_exhibitions] EXHIBICIONES ARTÍSTICAS — ${statusLabel(str(m10.artisticExhibitionsStatus))}`);
  const artExh = (m10.artisticExhibitions ?? []) as Record<string, unknown>[];
  artExh.forEach(a => lines.push(`  - ${str(a.exhibitionName)} — ${str(a.venue)} (${str(a.country)}, ${str(a.date)})`));
  if (str(m10.artisticExhibitionsDisposition)) lines.push(`  Notas del cliente: ${str(m10.artisticExhibitionsDisposition)}`);

  // Performing Arts Commercial Success (EB-1A)
  lines.push(`\n[CRITERION: performing_arts_commercial_success] ÉXITOS COMERCIALES EN ARTES ESCÉNICAS — ${statusLabel(str(m10.performingArtsSuccessStatus))}`);
  const paSuccess = (m10.performingArtsSuccess ?? []) as Record<string, unknown>[];
  paSuccess.forEach(p => lines.push(`  - ${str(p.productionOrWorkTitle)} — ${str(p.successIndicator)}: ${str(p.figureOrMetric)} (${str(p.source)}, ${str(p.date)})`));
  if (str(m10.performingArtsSuccessDisposition)) lines.push(`  Notas del cliente: ${str(m10.performingArtsSuccessDisposition)}`);

  // Lead/Starring Role (O-1B)
  lines.push(`\n[CRITERION: lead_starring_role] ROL PROTAGÓNICO — ${statusLabel(str(m10.leadStarringRoleStatus))}`);
  const leadRole = (m10.leadStarringRole ?? []) as Record<string, unknown>[];
  leadRole.forEach(l => lines.push(`  - ${str(l.productionOrEventName)} — ${str(l.roleDescription)} (${str(l.organization)}, ${str(l.date)}) — Reputación: ${str(l.reputationEvidence)}`));
  if (str(m10.leadStarringRoleDisposition)) lines.push(`  Notas del cliente: ${str(m10.leadStarringRoleDisposition)}`);

  // Critical Reviews (O-1B → national_recognition)
  lines.push(`\n[CRITERION: national_recognition] RESEÑAS CRÍTICAS — ${statusLabel(str(m10.criticalReviewsStatus))}`);
  const reviews = (m10.criticalReviews ?? []) as Record<string, unknown>[];
  reviews.forEach(r => lines.push(`  - ${str(r.publication)} — "${str(r.title)}" (${str(r.date)})`));
  if (str(m10.criticalReviewsDisposition)) lines.push(`  Notas del cliente: ${str(m10.criticalReviewsDisposition)}`);

  // Critical Role in Organization (O-1B)
  lines.push(`\n[CRITERION: critical_role_org] ROL CRÍTICO EN ORGANIZACIÓN (O-1B) — ${statusLabel(str(m10.criticalRoleOrgStatus))}`);
  const roleOrg = (m10.criticalRoleOrg ?? []) as Record<string, unknown>[];
  roleOrg.forEach(r => lines.push(`  - ${str(r.organization)} — ${str(r.roleTitle)} (${str(r.startDate)} — ${str(r.endDate) || "Presente"}) — Reputación: ${str(r.reputationEvidence)}`));
  if (str(m10.criticalRoleOrgDisposition)) lines.push(`  Notas del cliente: ${str(m10.criticalRoleOrgDisposition)}`);

  // Commercial Success (O-1B)
  lines.push(`\n[CRITERION: commercial_success] ÉXITOS COMERCIALES/DE CRÍTICA — ${statusLabel(str(m10.commercialSuccessStatus))}`);
  const commSuccess = (m10.commercialSuccess ?? []) as Record<string, unknown>[];
  commSuccess.forEach(c => lines.push(`  - ${str(c.productionOrWorkTitle)} — ${str(c.successIndicator)}: ${str(c.figureOrMetric)} (${str(c.source)}, ${str(c.date)})`));
  if (str(m10.commercialSuccessDisposition)) lines.push(`  Notas del cliente: ${str(m10.commercialSuccessDisposition)}`);

  // Significant Recognition (O-1B)
  lines.push(`\n[CRITERION: significant_recognition] RECONOCIMIENTO SIGNIFICATIVO — ${statusLabel(str(m10.significantRecognitionStatus))}`);
  const sigRecog = (m10.significantRecognition ?? []) as Record<string, unknown>[];
  sigRecog.forEach(s => lines.push(`  - ${str(s.recognizingParty)} (${str(s.recognizingPartyCredentials)}) — ${str(s.achievementRecognized)} (${str(s.date)})`));
  if (str(m10.significantRecognitionDisposition)) lines.push(`  Notas del cliente: ${str(m10.significantRecognitionDisposition)}`);

  // Income evidence
  const inc = (m10.incomeEvidence ?? {}) as Record<string, unknown>;
  lines.push("\n[CRITERION: high_salary] EVIDENCIA DE INGRESOS");
  lines.push(`  Declaraciones de impuestos (W-2/1040): ${bool(inc.hasTaxReturns)}`);
  lines.push(`  Certificaciones de salario: ${bool(inc.hasCertifications)}`);
  lines.push(`  Contratos: ${bool(inc.hasContracts)}`);

  if (m10.hasWebsite) {
    lines.push(`  Presencia web: ${str(m10.websiteUrl)}`);
  }

  // ── Strategic self-assessment (Module 11)
  lines.push("\n=== AUTOEVALUACIÓN ESTRATÉGICA (MÓDULO 11) ===");
  const strategic: [string, string][] = [
    ["createdMethod",        "¿Ha creado un método, sistema o enfoque propio reconocido por otros?"],
    ["ledImpactProjects",    "¿Ha liderado proyectos de alto impacto en su campo?"],
    ["solvedComplexProblems","¿Ha resuelto problemas complejos que otros no pudieron?"],
    ["trainedProfessionals", "¿Ha entrenado o mentoreado a otros profesionales?"],
    ["consultedForExpertise","¿Es consultado como experto por otras organizaciones?"],
    ["evaluatedOthers",      "¿Ha evaluado el trabajo de otros en su campo?"],
    ["workedForRecognized",  "¿Ha trabajado en organizaciones de reconocida distinción?"],
    ["aboveAverageIncome",   "¿Gana significativamente más que el promedio de su campo?"],
    ["willingToConfirm",     "¿Están sus superiores/colegas dispuestos a confirmar su nivel de impacto?"],
    ["additionalInfo",       "Información adicional relevante"],
  ];
  strategic.forEach(([key, question]) => {
    const ans = (m11[key] ?? {}) as Record<string, unknown>;
    if (str(ans.answer).trim()) {
      lines.push(`\nP: ${question}`);
      lines.push(`R: ${str(ans.answer)}`);
      if (ans.hasEvidence) lines.push("   (Tiene evidencia documental)");
    }
  });

  lines.push("\n=== FIN DE DATOS ===");
  lines.push("\nDevuelve ÚNICAMENTE el objeto JSON solicitado, sin bloques de código markdown.");

  return lines.join("\n");
}

// ── Claude call ──────────────────────────────────────────────────────────────

interface A1Response {
  visa_recommendation: string;
  visa_confidence: string;
  overall_strength: string;
  criteria_scores: Record<string, number>;
  criteria_met: Record<string, boolean>;
  criteria_gaps: Record<string, string | null>;
  strengths: string[];
  weaknesses: string[];
  strategic_notes: string;
  recommended_actions: string[];
}

async function callClaude(userPrompt: string, systemPrompt: string): Promise<A1Response> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw: string = data.content?.[0]?.text ?? "";

  try {
    return JSON.parse(raw) as A1Response;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as A1Response;
    throw new Error("Claude response was not valid JSON: " + raw.slice(0, 300));
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const db = adminDb();

  let body: { case_id: string; submission_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { case_id, submission_id } = body;
  if (!case_id) {
    return NextResponse.json({ error: "Missing required field: case_id" }, { status: 400 });
  }

  // ── 1. Create agent_run ──────────────────────────────────────────────────
  const { data: run, error: runErr } = await db
    .from("agent_runs")
    .insert({
      case_id,
      agent_name: "intake_analyzer",
      status: "running",
      started_at: new Date().toISOString(),
      input_snapshot: { case_id, submission_id: submission_id ?? null },
    })
    .select("id")
    .single();

  if (runErr || !run) {
    return NextResponse.json({ error: "Failed to create agent run", detail: runErr?.message }, { status: 500 });
  }
  const runId = run.id as string;

  try {
    // ── 2. Fetch intake_submission ─────────────────────────────────────────
    const subQuery = db.from("intake_submissions").select("*");
    const { data: submission, error: subErr } = submission_id
      ? await subQuery.eq("id", submission_id).maybeSingle()
      : await subQuery.eq("case_id", case_id).maybeSingle();

    if (subErr) throw new Error(`Error fetching submission: ${subErr.message}`);
    if (!submission) throw new Error("No intake submission found for this case. The client must complete the intake form first.");

    // ── 3. Resolve classification and build prompts ────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m1ForClassification = (submission as Record<string, any>).module1 ?? {};
    const { classification, criteria } = resolveCriteriaSet(String(m1ForClassification.visaType ?? ""));
    const systemPrompt = buildSystemPrompt(classification, criteria);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userPrompt = buildUserPrompt(submission as Record<string, any>);
    const result = await callClaude(userPrompt, systemPrompt);

    // ── 4. Insert agent_intake_analysis ────────────────────────────────────
    const { data: analysis, error: insertErr } = await db
      .from("agent_intake_analysis")
      .insert({
        case_id,
        submission_id: submission.id,
        run_id: runId,
        status: "completed",
        recommended_visa_type: result.visa_recommendation,  // existing column name
        classification_used: classification,
        visa_confidence: result.visa_confidence,
        overall_strength: result.overall_strength,
        criteria_scores: result.criteria_scores,
        criteria_met: result.criteria_met,
        criteria_gaps: result.criteria_gaps,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        strategy_notes: result.strategic_notes,             // existing column name
        recommended_actions: result.recommended_actions,
        raw_response: JSON.stringify(result),
      })
      .select("*")
      .single();

    if (insertErr || !analysis) {
      throw new Error(`Failed to save analysis: ${insertErr?.message}`);
    }

    // ── 5. Complete agent_run ──────────────────────────────────────────────
    await db
      .from("agent_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        output_summary: {
          analysis_id: analysis.id,
          recommended_visa_type: result.visa_recommendation,
          overall_strength: result.overall_strength,
        },
      })
      .eq("id", runId);

    return NextResponse.json({ success: true, analysis });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    await db
      .from("agent_runs")
      .update({ status: "failed", error_detail: msg, completed_at: new Date().toISOString() })
      .eq("id", runId);

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
