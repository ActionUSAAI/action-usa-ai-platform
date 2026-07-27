# A5 — Case Strategy Engine — Diseño

**Estado:** Diseño completo (v2, con Case Blueprint), no implementado. Registrado 2026-07-24, actualizado 2026-07-27. Primera pieza de la Capa 2 (Legal Intelligence) de `AUCIS_V2_STRATEGY_LAYER.md`.

## Misión

**A1 mide. A5 decide.** Nunca deben medir lo mismo.

A1 (Criteria Evaluation Engine) determina, de forma independiente y objetiva, si cada criterio está satisfecho y con qué nivel de solidez probatoria — nunca toma decisiones estratégicas.

A5 (Case Strategy Engine) construye la teoría jurídica del caso y diseña la estrategia probatoria que gobernará toda la petición — nunca vuelve a evaluar evidencia desde cero; consume los resultados de A1 (`criteria_met`, `criteria_scores`) como señal de entrada, no los recalcula.

Resuelve directamente el hallazgo documentado en `docs/A4_ATTORNEY_EVIDENCE_GAP.md`: hoy el Motor Abogado redacta cada criterio sin acceso a contenido real de evidencia, solo cita legal + label + número de Exhibit.

## El Case Blueprint — salida completa de A5

A diferencia del diseño original (solo pesos porcentuales por criterio), A5 produce un **Case Blueprint** completo:

- **Theory of the Case** — la tesis jurídica central del caso, en una o dos frases.
- **Primary Narrative** — la historia principal que conecta los criterios dominantes.
- **Secondary Narrative** — hilos narrativos de apoyo, si existen.
- **Dominant Criteria** — los criterios que son el núcleo real del caso (clasificación categórica, no solo un porcentaje).
- **Supporting Criteria** — criterios que refuerzan el caso pero no son el eje central.
- **Corroborative Criteria** — criterios que sirven principalmente para corroborar los dominantes/de apoyo, no para sostenerse por sí solos.
- **Evidence Dependencies** — qué evidencia específica (qué carta, qué entrada de `Module10`) respalda cada criterio — esto es lo que cierra el gap real de `A4_ATTORNEY_EVIDENCE_GAP.md`.
- **Suggested Reinforcements** — evidencia adicional que fortalecería el caso, si el abogado puede conseguirla.
- **Recommended Document Order** — en qué orden deberían presentarse los documentos del expediente.
- **Attorney Letter Outline** — estructura sugerida para la Attorney Petition Letter, basada en la teoría del caso.
- **Recommended Exhibit Order** — orden sugerido de Exhibits (complementa, no reemplaza, la lógica determinística de `assembleExhibits`).
- **Cross-References Between Criteria** — conexiones narrativas explícitas entre criterios (ej. "el criterio 5 se corrobora con el criterio 6").

**Explícitamente fuera de alcance de A5** (reservado para el futuro RFE Prediction Engine, decisión de Alex 2026-07-27): "Likely USCIS Concerns" y "Estimated RFE Risk". A5 construye la estrategia desde la perspectiva del abogado que arma el caso — no desde la perspectiva del oficial que lo revisa. Esa segunda perspectiva es un motor completamente distinto, que además solo tiene sentido aplicarse después de que el expediente pase por el futuro Quality Assurance Engine.

## Flujo completo

1. **Disparo automático**, en cuanto A1 termina de analizar el caso.
2. El motor lee: `criteria_met`/`criteria_scores` de A1 (nunca los recalcula), y el contenido completo y real de `Module9`/`Module10`/`Module1`.
3. Claude construye el Case Blueprint completo (estructura de arriba).
4. Se guarda como **propuesta** (`status: "proposed"`) — no se usa todavía para generar ningún documento.
5. Aparece en el panel del caso. El abogado puede **editar libremente** cualquier parte del Blueprint antes de aprobar.
6. Solo con el Blueprint en estado `"approved"`, los botones de generación de cartas (Testimonial, Institucional, Motor Abogado) se habilitan.
7. Al generar, el Motor Abogado recibe el Blueprint aprobado completo — Evidence Dependencies y Cross-References resuelven directamente el gap de `A4_ATTORNEY_EVIDENCE_GAP.md`.

## Relación con la decisión manual existente (`petitionStrategy`)

A5 no reemplaza la elección manual de `multiCriteria` vs. `singleAchievement` del Motor Abogado — la complementa. El abogado sigue eligiendo esa estrategia base; el Blueprint aprobado decide el peso, la evidencia, y la narrativa específica dentro de esa elección.

## Tabla nueva — `case_strategy`

```sql
CREATE TABLE public.case_strategy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.agent_runs(id),
  status TEXT NOT NULL DEFAULT 'proposed', -- 'proposed' | 'approved' | 'edited'
  theory_of_case TEXT NOT NULL,
  primary_narrative TEXT NOT NULL,
  secondary_narrative TEXT,
  dominant_criteria JSONB NOT NULL,      -- string[] de criterion_key
  supporting_criteria JSONB,             -- string[] de criterion_key
  corroborative_criteria JSONB,          -- string[] de criterion_key
  evidence_dependencies JSONB NOT NULL,  -- { criterion_key: [referencias a evidencia] }
  suggested_reinforcements JSONB,
  recommended_document_order JSONB,
  attorney_letter_outline JSONB,
  recommended_exhibit_order JSONB,
  criteria_cross_references JSONB,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Lleva `run_id` porque involucra una llamada real a Claude — mismo patrón que A1/A3.

## UI necesaria

Nueva sección en el panel de caso, después de A1 y antes de "Generación de Cartas y Petición" — mostrando el Case Blueprint completo, con controles de edición campo por campo y un botón de aprobación. Los botones de Testimonial/Institucional/Abogado quedan deshabilitados con explicación ("Aprueba la estrategia del caso primero") hasta que `case_strategy.status === "approved"`.

## Preguntas de diseño pendientes, para la sesión de implementación

- ¿Qué pasa si A1 se re-ejecuta después de que ya existe un Blueprint aprobado? (Decisión pendiente — no resuelta todavía)
- ¿Cómo se le pasa exactamente el Blueprint aprobado al Motor Abogado — se lee `case_strategy` directamente en la ruta, o se copia su contenido a algún lugar más accesible?
- ¿Este mismo mecanismo debe aplicar también a los Motores Testimonial/Institucional? (Decisión pendiente — no resuelta todavía)
- Diseño exacto del prompt de Claude para construir el Blueprint — no definido en este documento.
- ¿"Recommended Exhibit Order" debe ser solo una sugerencia que el abogado puede ignorar, o debe alimentar directamente la lógica de `assembleExhibits`? Requiere decisión explícita antes de implementar esa pieza específica.

## Relación con otros documentos

- Resuelve el hallazgo de `docs/A4_ATTORNEY_EVIDENCE_GAP.md`.
- Desbloquea la integración completa de `docs/A6_SALARY_RESEARCH_DESIGN.md` (ahora parte del futuro Market Intelligence Engine) con la Attorney Letter.
- Es la Capa 2 completa de `docs/AUCIS_V2_STRATEGY_LAYER.md`.
