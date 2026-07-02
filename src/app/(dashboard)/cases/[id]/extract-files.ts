export interface DocumentFile {
  filePath: string;
  fileName: string;
  label: string;
  isExcluded: boolean;
}

function add(
  files: DocumentFile[],
  filePath: string | null | undefined,
  fileName: string | null | undefined,
  label: string,
  isExcluded = false
) {
  if (filePath && fileName) {
    files.push({ filePath, fileName, label, isExcluded });
  }
}

const M11_LABELS: Record<string, string> = {
  createdMethod:          "Método creado",
  ledImpactProjects:      "Proyectos de impacto",
  solvedComplexProblems:  "Problemas complejos resueltos",
  trainedProfessionals:   "Profesionales entrenados",
  consultedForExpertise:  "Consultoría de expertise",
  evaluatedOthers:        "Evaluación de otros",
  workedForRecognized:    "Trabajo en entidades reconocidas",
  aboveAverageIncome:     "Ingreso superior al promedio",
  willingToConfirm:       "Disposición de confirmación",
  additionalInfo:         "Información adicional",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractTranslatableFiles(submission: Record<string, any>): DocumentFile[] {
  const files: DocumentFile[] = [];

  // ── Module 2 — Documents + Family ──────────────────────────────────────────
  const m2 = submission.module2 ?? {};
  add(files, m2.passport?.filePath,         m2.passport?.fileName,         "Pasaporte",            true);
  add(files, m2.usVisa?.filePath,           m2.usVisa?.fileName,           "Visa americana",       true);
  add(files, m2.i94?.filePath,              m2.i94?.fileName,              "I-94",                 true);
  add(files, m2.i797?.filePath,             m2.i797?.fileName,             "I-797",                true);
  add(files, m2.ead?.filePath,              m2.ead?.fileName,              "EAD",                  true);
  add(files, m2.i20?.filePath,              m2.i20?.fileName,              "I-20",                 true);
  add(files, m2.ds2019?.filePath,           m2.ds2019?.fileName,           "DS-2019",              true);
  add(files, m2.spouseMarriageCert?.filePath, m2.spouseMarriageCert?.fileName, "Acta de matrimonio");
  add(files, m2.spousePassport?.filePath,   m2.spousePassport?.fileName,   "Pasaporte del cónyuge", true);
  add(files, m2.spouseVisa?.filePath,       m2.spouseVisa?.fileName,       "Visa del cónyuge",     true);
  add(files, m2.spouseI94?.filePath,        m2.spouseI94?.fileName,        "I-94 del cónyuge",     true);

  for (const child of (m2.childrenDocs ?? [])) {
    const name = child.childName || "hijo/a";
    add(files, child.birthCert?.filePath, child.birthCert?.fileName, `Acta de nacimiento — ${name}`);
    add(files, child.passport?.filePath,  child.passport?.fileName,  `Pasaporte — ${name}`, true);
    add(files, child.visa?.filePath,      child.visa?.fileName,      `Visa — ${name}`,      true);
  }

  // ── Module 5 — Degrees ─────────────────────────────────────────────────────
  for (const deg of (submission.module5?.degrees ?? [])) {
    const lbl = deg.degreeName || deg.degreeType || "Título";
    add(files, deg.filePath, deg.fileName, `Diploma — ${lbl}`);
  }

  // ── Module 6 — Certifications ──────────────────────────────────────────────
  for (const cert of (submission.module6?.certifications ?? [])) {
    add(files, cert.filePath, cert.fileName, `Certificación — ${cert.name || "certificado"}`);
  }

  // ── Module 10 — Evidence ───────────────────────────────────────────────────
  const m10 = submission.module10 ?? {};
  for (const it of (m10.awards        ?? [])) add(files, it.filePath, it.fileName, `Premio — ${it.name || "reconocimiento"}`);
  for (const it of (m10.memberships   ?? [])) add(files, it.filePath, it.fileName, `Membresía — ${it.orgName || "organización"}`);
  for (const it of (m10.media         ?? [])) add(files, it.filePath, it.fileName, `Artículo de prensa — ${it.title || "publicación"}`);
  for (const it of (m10.articles      ?? [])) add(files, it.filePath, it.fileName, `Artículo académico — ${it.title || "publicación"}`);
  for (const it of (m10.books         ?? [])) add(files, it.filePath, it.fileName, `Libro — ${it.title || "libro"}`);
  for (const it of (m10.conferences   ?? [])) add(files, it.filePath, it.fileName, `Conferencia — ${it.event || "evento"}`);
  for (const it of (m10.judging       ?? [])) add(files, it.filePath, it.fileName, `Evaluación — ${it.eventOrProcess || "proceso"}`);
  for (const it of (m10.patents       ?? [])) add(files, it.filePath, it.fileName, `Patente — ${it.name || "patente"}`);

  const inc = m10.incomeEvidence ?? {};
  add(files, inc.taxFilePath,      inc.taxFileName,      "Declaración de impuestos");
  add(files, inc.certFilePath,     inc.certFileName,     "Certificación de salario");
  add(files, inc.contractFilePath, inc.contractFileName, "Contrato laboral");

  // ── Module 11 — Strategic evidence ────────────────────────────────────────
  const m11 = submission.module11 ?? {};
  for (const [key, lbl] of Object.entries(M11_LABELS)) {
    const ans = m11[key] ?? {};
    add(files, ans.filePath, ans.fileName, `Evidencia — ${lbl}`);
  }

  // ── Module 14 — Petitioner ─────────────────────────────────────────────────
  const m14 = submission.module14 ?? {};
  add(files, m14.companyArticlesPath,     m14.companyArticlesName,     "Artículos de incorporación");
  add(files, m14.einDocPath,              m14.einDocName,              "Carta EIN (IRS)");
  add(files, m14.petitionerIdPath,        m14.petitionerIdName,        "Identificación del peticionario", true);
  add(files, m14.petitionerBirthCertPath, m14.petitionerBirthCertName, "Acta de nacimiento del peticionario");
  add(files, m14.contractPath,            m14.contractName,            "Contrato del peticionario");

  // ── Module 15 — Consultative + O-2 ────────────────────────────────────────
  const m15 = submission.module15 ?? {};
  add(files, m15.peerGroupLetterPath, m15.peerGroupLetterName, "Carta de opinión consultiva");
  for (const comp of (m15.companions ?? [])) {
    const name = comp.fullName || "acompañante";
    add(files, comp.passportPath,          comp.passportName,          `Pasaporte — ${name}`,        true);
    add(files, comp.employmentEvidencePath, comp.employmentEvidenceName, `Evidencia laboral — ${name}`);
  }

  return files;
}
