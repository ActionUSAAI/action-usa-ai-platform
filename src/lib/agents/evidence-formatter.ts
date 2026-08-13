import { str } from "./shared-helpers";

function bool(v: unknown): string {
  return v === true ? "Sí" : v === false ? "No" : "No especificado";
}

function statusLabel(s: string): string {
  if (s === "tengo") return "TIENE EVIDENCIA";
  if (s === "tal_vez") return "POSIBLEMENTE TIENE";
  if (s === "no_tengo") return "NO TIENE";
  return s || "no especificado";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatEvidenceForPrompt(m9: Record<string, any>, m10: Record<string, any>): string {
  const lines: string[] = [];

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
  // Critical Role (4a/4b) — el formulario de intake existe y está activo
  // desde el commit 5b96594 (2026-07-12), Module10.tsx. Si este objeto
  // llega vacío, significa que el cliente no completó esta sección (o
  // respondió que no aplica) — el formulario no distingue hoy entre
  // "sin responder" y "no aplica" (Module10.tsx no tiene un campo de
  // estado paralelo aquí, a diferencia de otros campos del mismo módulo
  // como criticalRoleOrgStatus). Mejora de UI identificada, no resuelta
  // en este fix — ver hallazgo 2026-08-08, caso María Alejandra Barco
  // Tabares.
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
  } else if (m10.criticalRoleStatus === "no_tengo") {
    lines.push(`\n[CRITERION: critical_role_4a/4b] ROL CRÍTICO — El cliente confirmó que no tiene este tipo de rol/evidencia`);
  } else if (m10.criticalRoleStatus === "tal_vez") {
    lines.push(`\n[CRITERION: critical_role_4a/4b] ROL CRÍTICO — El cliente indicó que tal vez tiene evidencia relevante, pero no completó los detalles — vale la pena investigar con el cliente`);
  } else {
    lines.push(`\n[CRITERION: critical_role_4a/4b] ROL CRÍTICO — Sin respuesta del cliente en esta sección del intake`);
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

  return lines.join("\n");
}
