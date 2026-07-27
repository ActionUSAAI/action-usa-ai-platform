# A5 — Case Strategy Engine — Diseño

**Estado:** Diseño completo, no implementado. Registrado 2026-07-24. Primera pieza real de `AUCIS_V2_STRATEGY_LAYER.md` en pasar de visión a diseño concreto.

## Propósito

Define la teoría jurídica del caso antes de generar cualquier documento — el peso relativo de cada criterio activo, la evidencia específica que mejor respalda cada uno, y cómo se conectan narrativamente entre sí. Resuelve directamente el hallazgo documentado en `docs/A4_ATTORNEY_EVIDENCE_GAP.md`: hoy el Motor Abogado redacta cada criterio sin acceso a contenido real de evidencia, solo cita legal + label + número de Exhibit.

## Flujo completo

1. **Disparo automático**, en cuanto A1 termina de analizar el caso (decisión de Alex — no requiere botón manual).
2. El motor lee: `criteria_met`/`criteria_scores` de A1, y el contenido completo y real de `Module9`/`Module10` (no solo qué criterios están marcados como viables, sino la sustancia de cada evidencia disponible) y `Module1` (perfil del beneficiario).
3. Con eso, Claude construye una propuesta de estrategia con tres componentes:
   - **Ángulo narrativo central** — la historia que conecta los criterios activos entre sí (no criterios aislados).
   - **Peso relativo sugerido por criterio** — ej. 35%/25%/20%/10%/10%, reflejando cuál es el núcleo real del caso vs. evidencia de apoyo.
   - **Mapa de evidencia por criterio** — qué evidencia específica (qué carta, qué entrada de `Module10`) respalda mejor cada argumento, y las conexiones narrativas explícitas entre criterios (ej. "el criterio 5 se corrobora con el criterio 6").
4. Se guarda como **propuesta** (`status: "proposed"`) — no se usa todavía para generar ningún documento.
5. Aparece en el panel del caso. El abogado puede **editar libremente** el texto/pesos antes de aprobar (decisión de Alex — no es solo aprobar/rechazar tal cual).
6. Solo con la estrategia en estado `"approved"`, los botones de generación de cartas (Testimonial, Institucional, Motor Abogado) se habilitan — decisión de Alex de bloquearlos hasta ese punto, para evitar generar documentos sobre una base no revisada.
7. Al generar, el Motor Abogado (con `petitionStrategy` elegida como hoy — este engine complementa esa decisión, no la reemplaza) recibe la evidencia real + pesos + conexiones narrativas de la estrategia aprobada, cerrando el gap de `A4_ATTORNEY_EVIDENCE_GAP.md`.

## Relación con la decisión manual existente (`petitionStrategy`)

El Case Strategy Engine **no reemplaza** la elección manual de `multiCriteria` vs. `singleAchievement` que ya existe en el Motor Abogado — la complementa. El abogado sigue eligiendo esa estrategia base; el Engine decide el peso y la evidencia específica por criterio dentro de esa elección.

## Tabla nueva — `case_strategy`

```sql
CREATE TABLE public.case_strategy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.agent_runs(id),
  status TEXT NOT NULL DEFAULT 'proposed', -- 'proposed' | 'approved' | 'edited'
  narrative_angle TEXT NOT NULL,
  criteria_weights JSONB NOT NULL, -- { "original_contributions": 35, "critical_role_4a": 25, ... }
  criteria_evidence_map JSONB NOT NULL, -- qué evidencia específica usar por criterio
  criteria_connections JSONB, -- conexiones narrativas entre criterios
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Lleva `run_id` (a diferencia de `i129_form_drafts`) porque sí involucra una llamada real a Claude para construir la propuesta — mismo patrón que A1/A3.

## UI necesaria

Nueva sección en el panel de caso, después de A1 y antes de "Generación de Cartas y Petición" — mostrando la estrategia propuesta (ángulo narrativo, pesos por criterio, mapa de evidencia), con controles de edición y un botón de aprobación. Los botones de Testimonial/Institucional/Abogado deben mostrarse deshabilitados con explicación ("Aprueba la estrategia del caso primero") hasta que `case_strategy.status === "approved"`.

## Preguntas de diseño pendientes, para la sesión de implementación

- ¿Qué pasa si A1 se re-ejecuta después de que ya existe una estrategia aprobada (ej. el intake cambió)? ¿Se invalida automáticamente la estrategia, o queda huérfana?
- ¿Cómo se le pasa exactamente la estrategia aprobada al Motor Abogado — se lee `case_strategy` directamente en la ruta, o se copia su contenido a algún lugar más accesible al momento de generar?
- ¿Este mismo mecanismo debería aplicar también a los Motores Testimonial/Institucional (que hoy generan cartas sin ninguna noción de peso/narrativa entre ellas), o solo al Motor Abogado?
- Diseño exacto del prompt de Claude para esta pieza — no definido en este documento, pendiente de sesión de implementación.

## Relación con otros documentos

- Resuelve el hallazgo de `docs/A4_ATTORNEY_EVIDENCE_GAP.md`.
- Desbloquea la integración completa de `docs/A6_SALARY_RESEARCH_DESIGN.md` con la Attorney Letter.
- Es el primer módulo de los cuatro descritos en `docs/AUCIS_V2_STRATEGY_LAYER.md` en pasar de visión a diseño concreto.
