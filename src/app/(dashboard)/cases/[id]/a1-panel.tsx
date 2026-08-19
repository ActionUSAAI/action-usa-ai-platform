// Este archivo existe únicamente como puente de compatibilidad temporal.
// La lógica real vive ahora en legal-decision-section.tsx (Fase 5, Paso 3
// — disolución de A1Panel hacia la sección de dominio Legal Decision).
// a5-panel.tsx todavía importa resolveCriteriaLabels desde este archivo;
// según la restricción explícita de este paso ("no modificar A5Panel
// todavía"), a5-panel.tsx no se toca aquí. Este puente se retira en el
// Paso 4/5, cuando a5-panel.tsx se divida y pueda actualizar su import
// directamente hacia legal-decision-section.tsx.
export {
  resolveCriteriaLabels,
  SHORT_LABEL_OVERRIDES,
} from "./legal-decision-section";
export type { IntakeAnalysis } from "./legal-decision-section";
