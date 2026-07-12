// Single source of truth for the ordered, per-classification USCIS
// criteria sets used across A1 (system prompt + scoring), the intake
// analysis panel (UI labels), and A4's Exhibit assembly (canonical
// Exhibit ordering + CFR citation, docs/A4_EXHIBIT_ASSEMBLY.md v1.2).
//
// Order matters: the assembly step assigns exhibit_number following
// array order, skipping criteria the case doesn't satisfy.

export interface CriterionDef {
  key: string;
  label: string; // regulatory-style label, used verbatim in A1's system prompt
  citation: string; // CFR citation, used in case_exhibits.criterion_citation
}

export type Classification = "O-1A" | "O-1B" | "EB-1A";

export const CRITERIA_O1A: CriterionDef[] = [
  { key: "awards", label: "Premios o reconocimientos por excelencia en el campo", citation: "8 CFR 214.2(o)(3)(iii)(B)(1)" },
  { key: "memberships", label: "Membresía en asociaciones que requieren logros extraordinarios", citation: "8 CFR 214.2(o)(3)(iii)(B)(2)" },
  { key: "media_coverage", label: "Material publicado sobre el solicitante en medios de comunicación", citation: "8 CFR 214.2(o)(3)(iii)(B)(3)" },
  { key: "judging", label: "Haber evaluado o juzgado el trabajo de otros en el campo", citation: "8 CFR 214.2(o)(3)(iii)(B)(4)" },
  { key: "original_contributions", label: "Contribuciones originales de importancia significativa al campo", citation: "8 CFR 214.2(o)(3)(iii)(B)(5)" },
  { key: "scholarly_articles", label: "Artículos académicos en revistas o publicaciones profesionales", citation: "8 CFR 214.2(o)(3)(iii)(B)(6)" },
  { key: "critical_role_4a", label: "Rol crítico/esencial en organización distinguida — cargo directivo/electo", citation: "8 CFR 214.2(o)(3)(iii)(B)(7)" },
  { key: "critical_role_4b", label: "Rol crítico/esencial en organización distinguida — cargo técnico/instructor", citation: "8 CFR 214.2(o)(3)(iii)(B)(7)" },
  { key: "high_salary", label: "Alta remuneración relativa a los pares del campo", citation: "8 CFR 214.2(o)(3)(iii)(B)(8)" },
];

export const CRITERIA_EB1A: CriterionDef[] = [
  { key: "awards", label: "Premios o reconocimientos por excelencia en el campo", citation: "8 CFR 204.5(h)(3)(i)" },
  { key: "memberships", label: "Membresía en asociaciones que requieren logros extraordinarios", citation: "8 CFR 204.5(h)(3)(ii)" },
  { key: "media_coverage", label: "Material publicado sobre el solicitante en medios de comunicación", citation: "8 CFR 204.5(h)(3)(iii)" },
  { key: "judging", label: "Haber evaluado o juzgado el trabajo de otros en el campo", citation: "8 CFR 204.5(h)(3)(iv)" },
  { key: "original_contributions", label: "Contribuciones originales de importancia significativa al campo", citation: "8 CFR 204.5(h)(3)(v)" },
  { key: "scholarly_articles", label: "Artículos académicos en revistas o publicaciones profesionales", citation: "8 CFR 204.5(h)(3)(vi)" },
  { key: "artistic_exhibitions", label: "Exhibición del trabajo en exposiciones o muestras artísticas", citation: "8 CFR 204.5(h)(3)(vii)" },
  { key: "critical_role_4a", label: "Rol principal o de suma importancia en organizaciones distinguidas — cargo directivo/electo", citation: "8 CFR 204.5(h)(3)(viii)" },
  { key: "critical_role_4b", label: "Rol principal o de suma importancia en organizaciones distinguidas — cargo técnico/instructor", citation: "8 CFR 204.5(h)(3)(viii)" },
  { key: "high_salary", label: "Salario alto o remuneración notablemente alta", citation: "8 CFR 204.5(h)(3)(ix)" },
  { key: "performing_arts_commercial_success", label: "Éxitos comerciales en las artes escénicas", citation: "8 CFR 204.5(h)(3)(x)" },
];

export const CRITERIA_O1B: CriterionDef[] = [
  { key: "lead_starring_role", label: "Rol principal o protagónico en producciones/eventos de reputación distinguida", citation: "8 CFR 214.2(o)(3)(iv)(B)(1)" },
  { key: "national_recognition", label: "Reconocimiento nacional/internacional por reseñas críticas o material publicado", citation: "8 CFR 214.2(o)(3)(iv)(B)(2)" },
  { key: "critical_role_org", label: "Rol principal, protagónico o crítico en organización de reputación distinguida", citation: "8 CFR 214.2(o)(3)(iv)(B)(3)" },
  { key: "commercial_success", label: "Récord de éxitos comerciales o de crítica mayores", citation: "8 CFR 214.2(o)(3)(iv)(B)(4)" },
  { key: "significant_recognition", label: "Reconocimiento significativo de logros por organizaciones/críticos/expertos", citation: "8 CFR 214.2(o)(3)(iv)(B)(5)" },
  { key: "high_salary", label: "Salario alto o remuneración sustancial comparativa", citation: "8 CFR 214.2(o)(3)(iv)(B)(6)" },
];

export function resolveCriteriaSet(visaType: string): { classification: Classification; criteria: CriterionDef[] } {
  const v = (visaType || "").toUpperCase();
  if (v.includes("O-1B")) return { classification: "O-1B", criteria: CRITERIA_O1B };
  if (v.includes("EB-1")) return { classification: "EB-1A", criteria: CRITERIA_EB1A };
  return { classification: "O-1A", criteria: CRITERIA_O1A };
}

export function criteriaSetForClassification(classification: Classification): CriterionDef[] {
  if (classification === "O-1B") return CRITERIA_O1B;
  if (classification === "EB-1A") return CRITERIA_EB1A;
  return CRITERIA_O1A;
}
