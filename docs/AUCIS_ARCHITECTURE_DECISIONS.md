# AUCIS — Architecture Decision Records (ADR)

**Estado:** Registro vivo. Cada decisión arquitectónica relevante de AUCIS se documenta aquí con su contexto, alternativas consideradas, y razón de la decisión final — no solo el resultado.

**Propósito:** que cualquier desarrollador, arquitecto, o futuro modelo de IA que trabaje sobre AUCIS entienda no solo la arquitectura final, sino el razonamiento que llevó a construirla — para poder evaluar cambios futuros con el mismo criterio, no solo copiar patrones sin entender por qué existen.

---

## ADR-001 — Reorientación de AUCIS hacia SaaS multi-tenant

**Fecha:** 2026-07-28
**Estado:** Aprobada

**Contexto:** AUCIS se construyó inicialmente como herramienta interna de ACTION USA AI LLC, sin conceptos de multi-tenencia.

**Problema:** decidir si el diseño de arquitectura futura debe seguir asumiendo un solo usuario final (ACTION USA) o debe prepararse desde ahora para múltiples firmas de inmigración.

**Alternativas consideradas:**
1. Mantener el diseño actual, agregar multi-tenencia después si se necesita.
2. Rediseñar el dominio completo asumiendo multi-tenencia desde el inicio.

**Decisión:** Opción 2. Todas las decisiones de arquitectura a partir de este punto asumen que AUCIS será usado por múltiples firmas, múltiples abogados, y múltiples tipos de caso migratorio.

**Justificación:** agregar multi-tenencia después de haber construido asumiendo un solo tenant requiere típicamente reescribir gran parte del modelo de datos y las políticas de acceso — más costoso que diseñar correctamente desde el inicio, dado que el proyecto ya tiene ambición explícita de convertirse en SaaS.

**Consecuencias:** se introduce `Organization` como entidad raíz de todo el dominio; toda entidad de datos de caso queda, directa o indirectamente, scoped a una Organization.

---

## ADR-002 — Separación entre Criterion Assessment y Case Blueprint

**Fecha:** 2026-07-27/28
**Estado:** Aprobada

**Contexto:** A1 evalúa criterios de elegibilidad; A5 (nuevo) fue diseñado para decidir estrategia del caso. Riesgo de que ambos terminaran evaluando lo mismo de formas distintas.

**Problema:** ¿A5 debería poder ajustar o recalcular los resultados de A1, o debe tratarlos como entrada fija?

**Alternativas consideradas:**
1. A5 puede ajustar/recalcular puntajes de criterios si su análisis estratégico sugiere que A1 se equivocó.
2. A5 trata los resultados de A1 como entrada inmutable, nunca los recalcula.

**Decisión:** Opción 2 — síntesis: "A1 mide. A5 decide. Nunca deben medir lo mismo."

**Justificación:** si ambos motores pudieran evaluar criterios, dejarían de existir como fuente única de verdad — cualquier discrepancia entre ambos generaría ambigüedad sobre cuál es la evaluación real. Mantener responsabilidades estrictamente separadas (A1 = evaluación objetiva; A5 = decisión estratégica sobre esa evaluación) es más limpio y auditable.

**Consecuencias:** Criterion Assessment es propiedad exclusiva de A1; Case Blueprint solo lo consume, nunca lo modifica. Esto requiere que Criterion Assessment esté versionado (cada ejecución de A1 es una versión nueva), para que Case Blueprint pueda anclarse a una versión específica.

---

## ADR-003 — Creación de Case Filing como entidad independiente

**Fecha:** 2026-07-28
**Estado:** Aprobada

**Contexto:** se discutía si "generar los documentos del expediente" era equivalente a "haber radicado el caso ante USCIS".

**Problema:** ¿el acto de radicación debe representarse dentro de Generated Document, o necesita su propia entidad?

**Alternativas consideradas:**
1. Agregar campos de radicación (fecha, número de recibo) directamente a Generated Document.
2. Crear una entidad nueva, Case Filing, que represente el acto de radicación en sí.

**Decisión:** Opción 2.

**Justificación:** un mismo conjunto de Generated Document puede radicarse en más de un acto de filing a lo largo del tiempo (radicación inicial, luego respuesta a RFE como un filing relacionado pero distinto). La cardinalidad de "documentos generados" vs. "actos de radicación" no es 1:1, lo cual viola la responsabilidad única si se intentara modelar dentro de Generated Document.

**Consecuencias:** Case Filing referencia el subconjunto específico de Generated Document incluidos en cada acto de radicación. Permite representar correctamente el ciclo radicación inicial → RFE → re-radicación como una secuencia de Filings relacionados.

---

## ADR-004 — Separación de Case Outcome de Case Blueprint

**Fecha:** 2026-07-28
**Estado:** Aprobada

**Contexto:** se planteó incorporar el resultado final del caso (aprobado/negado/RFE) como una sección dentro del propio Case Blueprint, para facilitar el futuro entrenamiento de una Knowledge Layer.

**Problema:** ¿el resultado del caso ante USCIS pertenece al Case Blueprint, o debe ser una entidad separada?

**Alternativas consideradas:**
1. Agregar una sección "Outcome Intelligence" dentro del Blueprint.
2. Crear una entidad nueva e independiente, Case Outcome, relacionada con el Blueprint pero no contenida en él.

**Decisión:** Opción 2.

**Justificación:** el Blueprint tiene un lifecycle que termina en estados terminales (`locked`/`superseded`) en el momento en que gobierna la generación documental — meses antes de que exista un resultado de USCIS. Forzar el resultado dentro del Blueprint violaría su inmutabilidad una vez aprobado. Además, un Case puede tener múltiples versiones de Blueprint a lo largo del tiempo, pero solo un resultado final por cada Filing — la cardinalidad no es 1:1, y el resultado no puede pertenecer lógicamente a "todos" ni a "uno arbitrario" de los Blueprints. A5 tampoco puede conocer el resultado en el momento en que construye el Blueprint — es lógicamente imposible que una entidad producida antes de radicar contenga datos que solo existen después.

**Consecuencias:** Case Outcome es una entidad nueva, relacionada con Case Filing (no directamente con Case Blueprint ni con Case), lo que permite que el futuro Learning Engine conecte Blueprint + Outcome vía la cadena Filing, sin mezclar responsabilidades de gobernanza (Blueprint) y observación de hechos (Outcome).

---

## ADR-005 — Sustitución de "USCIS Event" por "Case Event"

**Fecha:** 2026-07-28
**Estado:** Aprobada (reemplaza una decisión previa dentro de la misma sesión de diseño)

**Contexto:** se identificó la necesidad de un log de eventos externos posteriores a la radicación (recibo asignado, RFE, biometría, decisión). El nombre inicial propuesto fue "USCIS Event".

**Problema:** ¿el nombre de esta entidad debe reflejar la fuente actual más común de estos eventos (USCIS), o debe ser agnóstico a la fuente?

**Alternativas consideradas:**
1. Mantener "USCIS Event", específico a la agencia actual.
2. Generalizar a "Case Event", con la fuente (`source`) como atributo variable, no parte del nombre/identidad de la entidad.

**Decisión:** Opción 2.

**Justificación:** nombrar una entidad del Core Domain Model por su fuente actual más común viola el Principio de Evolución sin Refactorización — acopla el modelo a una agencia específica (USCIS), lo cual se rompería en cuanto AUCIS necesite soportar procedimientos que involucren otras agencias (NVC, Departamento de Estado, u otras en el futuro). El nombre de una entidad de dominio debe describir su función, no su origen más frecuente hoy.

**Consecuencias:** Case Event tiene `source` como atributo (uscis/attorney/client/system, extensible), no como parte de su identidad. Se establece además el principio de que `event_type` debe pertenecer a un catálogo canónico controlado (análogo a `canonical-criteria.ts`), no texto libre — para prevenir ambigüedad y deriva del modelo con el tiempo. El catálogo en sí no se diseña todavía.

---

## ADR-006 — Separación entre acciones de la firma y eventos externos dentro del lifecycle de Case Filing

**Fecha:** 2026-07-28
**Estado:** Aprobada

**Contexto:** al diseñar el lifecycle de Case Filing, se planteó inicialmente incluir estados como "Receipt Confirmed" como transiciones internas de la propia entidad.

**Problema:** ¿eventos como "USCIS asignó el número de recibo" deben modelarse como transiciones del lifecycle de Case Filing, o como eventos externos separados (Case Event)?

**Alternativas consideradas:**
1. Lifecycle amplio de Case Filing, incluyendo estados que dependen de acciones de USCIS (Prepared → Submitted → Receipt Confirmed → RFE Received → ...).
2. Lifecycle acotado de Case Filing (Prepared → Submitted → Superseded), representando solo lo que la firma controla; todo lo posterior se modela como Case Event.

**Decisión:** Opción 2.

**Justificación:** un lifecycle con transiciones implica que la misma entidad es dueña de cada transición. Pero la firma no controla cuándo USCIS asigna un recibo, emite un RFE, o decide — esos son hechos que la firma solo observa y registra, no acciones que ejecuta. Mezclar ambas categorías (acción propia vs. observación de un tercero) dentro de un mismo lifecycle viola la responsabilidad única de la entidad. Esta es la misma distinción aplicada a una escala más fina que ADR-004 (separación Blueprint/Outcome) — el patrón se repite en cada frontera donde el control pasa de la firma a un ente externo.

**Consecuencias:** Case Filing termina su lifecycle en `Submitted` (o `Superseded`). Todo lo posterior —incluyendo múltiples RFEs, que habrían sido difíciles de representar como estados únicos de un lifecycle— se modela como filas independientes en Case Event, un log append-only sin lifecycle propio. Esto también resuelve naturalmente el caso de múltiples RFEs sobre el mismo Filing, que un modelo de estados únicos no podría representar limpiamente.

---

## ADR-007 — Incorporación de Reasoning Provenance con múltiples fuentes

**Fecha:** 2026-07-28
**Estado:** Aprobada

**Contexto:** se discutió si el Case Blueprint debía prepararse desde ahora para una futura Knowledge Layer (patrones aprendidos por firma, patrones globales anonimizados), sin diseñar esa capa todavía.

**Problema:** ¿el Blueprint necesita cambiar de estructura cuando exista la Knowledge Layer, o puede diseñarse independientemente con solo puntos de integración?

**Alternativas consideradas:**
1. Diseñar el Blueprint sin ningún gancho hacia el futuro; incorporar la Knowledge Layer más adelante con los cambios estructurales que hagan falta en ese momento.
2. Incorporar desde ahora un campo simple de procedencia única (`reasoning_source`) por decisión.
3. Incorporar una estructura de múltiples fuentes de influencia con peso relativo (`Reasoning Provenance` como array de objetos, no un campo único).

**Decisión:** Opción 3.

**Justificación:** una decisión estratégica real casi nunca tiene una sola causa — podría estar sustentada simultáneamente por evidencia del caso, patrones de la firma, y patrones globales, en proporciones distintas. Forzar una sola fuente "ganadora" por campo perdería precisamente la explicabilidad que se busca para una IA auditable. El Blueprint en sí no debe *ser* la Knowledge Layer ni contenerla — es A5 quien, en el futuro, la consultaría como insumo adicional; el Blueprint solo necesita poder registrar de dónde vino cada influencia.

**Consecuencias:** cada decisión estratégica relevante del Blueprint lleva asociado un array de objetos Reasoning Provenance (`source_type`, `influence_weight`, `explanation`, `reference_id`). Hoy, `source_type` siempre vale `"case_evidence"` con `influence_weight = 1.0` — el campo existe pero no aporta funcionalidad real todavía (ver Brecha Técnica #2 en `A5_CASE_BLUEPRINT_SPECIFICATION_V1.md`).

---

## ADR-008 — Exclusión de estructura documental (outline, orden de exhibits) del Case Blueprint

**Fecha:** 2026-07-28
**Estado:** Aprobada

**Contexto:** una versión temprana de A5 (validada en producción antes de este rediseño) generaba `attorney_letter_outline` y `recommended_exhibit_order` como parte de su salida.

**Problema:** ¿A5 debe producir estructura de documentos (capítulos, índices, orden de exhibits), o eso corresponde exclusivamente a los motores de generación (A3/A4)?

**Alternativas consideradas:**
1. A5 continúa generando outline de documentos y orden de exhibits, como ya lo hacía.
2. A5 se limita a producir la secuencia lógica de argumentos (`argument_sequence`); la conversión a estructura de documento queda exclusivamente en manos de A4.

**Decisión:** Opción 2.

**Justificación:** principio establecido explícitamente: "A5 piensa. Todos los demás motores ejecutan." Generar un outline de capítulos o un índice de exhibits es una decisión de *ejecución documental*, no de *estrategia* — invade la responsabilidad de A4. Mantener la frontera estricta preserva que A5 sea la única fuente de razonamiento jurídico, y que A3/A4 sean ejecutores puros sin reinterpretar ni tomar decisiones estratégicas propias.

**Consecuencias:** el Blueprint produce `argument_sequence` (lista de pasos lógicos, ej. "demostrar originalidad → demostrar adopción → demostrar reconocimiento institucional") en lugar de un outline con capítulos numerados. La conversión de esa secuencia en estructura real de documento (capítulos, encabezados) es responsabilidad exclusiva de A4. De forma análoga, `generation_priorities` expresa énfasis estratégico, nunca numeración literal de Exhibits — eso sigue siendo responsabilidad de A4/`assembleExhibits`.

---

## ADR-009 — Congelamiento del Core Domain Model v1

**Fecha:** 2026-07-28
**Estado:** Aprobada

**Contexto:** tras varias rondas de descubrimiento de entidades (Organization, Case Filing, Case Event, Case Outcome, entre otras), se alcanzó un punto de madurez en el modelo.

**Decisión:** el Core Domain Model queda congelado en su v1. Nuevas entidades solo se incorporarán si superan el mismo criterio de descubrimiento aplicado durante esta fase (responsabilidad única real, cardinalidad propia, ownership distinto — no simplemente conveniencia de agrupar datos relacionados).

**Justificación:** un modelo de dominio que se sigue expandiendo indefinidamente sin criterio de cierre pierde valor como referencia estable. Establecer un punto de congelamiento explícito, documentado, permite que el desarrollo futuro se construya *sobre* el modelo en vez de seguir *rediseñándolo* indefinidamente.

**Consecuencias:** cualquier propuesta de nueva entidad futura debe justificarse con el mismo rigor usado en los ADR-002 a ADR-006 de este documento — no se agregan entidades por conveniencia de implementación.
