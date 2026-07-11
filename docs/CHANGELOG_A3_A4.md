# Changelog — Arquitectura A3 / A4 (Generación de Cartas)

Registro cronológico de decisiones de arquitectura y correcciones documentales para el sistema de generación de cartas (Agente 3 — Letter Generator, Agente 4 — Petition Builder). No es un documento de especificación viva; para el diseño vigente, ver `A3_LETTER_TAXONOMY.md`, `A3_ENGINE_TESTIMONIAL_PERSONAL.md`, `A3_ENGINE_INSTITUCIONAL.md`, `A4_ENGINE_ABOGADO.md`.

## 2026-07-10

**Contexto:** una sesión de chat distinta, desconectada de la memoria de la sesión de diseño original, generó preguntas de implementación asumiendo que A3 contenía tres motores internos (Testimonial, Institucional, Abogado) sin agente separado para la Attorney Petition Letter. Esto contradecía una decisión ya tomada en la sesión de diseño: el Motor Abogado (Tipo 0, Tipo 0b) vive en Agente 4 (`petition_builder`), no en A3. La causa raíz fue la falta de un artefacto de documentación que capturara esa decisión antes de que se comiteara `A3_ENGINE_ABOGADO.md` bajo el modelo incorrecto.

**Correcciones aplicadas, en orden:**

1. **Separación de Rol Crítico en 4a/4b** — `A3_ENGINE_INSTITUCIONAL.md` v1.0 trataba el sub-criterio "Rol Crítico" como una categoría única con cuatro campos genéricos compartidos (`formalPositionTitle`, `exactTenureDates`, `specificFunctionalDuties`, `institutionalImpactEvidence`), mezclando dos mecanismos de prueba distintos: cargo directivo/electo (Rodríguez/ACRICAMDE, prueba por métricas de gestión) y cargo técnico/instructor (Neira/Escuela de Carabineros, prueba por institucionalización). Corregido a v1.1 con dos sub-criterios formales, 4a y 4b, cada uno con su propio subconjunto de campos. Commit `13898a0`.

2. **Corrección de referencia factual** — la nota de versión de `A3_ENGINE_INSTITUCIONAL.md` v1.1 afirmaba incorrectamente que `A3_LETTER_TAXONOMY.md` no había sido comiteado. Corregido tras verificación (`git log`) de que el archivo sí existía desde `fb2354c` mas no contenía referencias al campo genérico viejo. Commit `c194a23`.

3. **`CriticalRoleEvidence` en `types.ts`** — implementado el tipo como unión discriminada (`criticalRoleType: 'elected' | 'technical'`) en `src/app/intake/types.ts`, con fechas estructuradas (ISO 8601) en lugar de texto libre, para permitir validación cruzada de fechas y formateo consistente en generación de A3. Verificado contra esquema real de producción: `Module10` es JSONB sin columnas tipadas, 2 filas en producción, ninguna con datos de Rol Crítico — implementación sin deuda de migración de datos legados. Commit `677e16f`.

4. **Reubicación del Motor Abogado a Agente 4** — `A3_ENGINE_ABOGADO.md` v1.0 describía el Motor Abogado (Tipo 0, Tipo 0b) como "Máquina 1" de tres submotores internos de A3. Corregido: el motor vive en Agente 4 (`petition_builder`), agente independiente que depende de los Exhibits producidos por los dos motores de A3. Archivo renombrado a `A4_ENGINE_ABOGADO.md` (v1.1) vía `git mv`, preservando historial. Commit `6f37024`.

5. **Alineación de `A3_LETTER_TAXONOMY.md`** — corregido de "tres motores" a "dos motores" (Testimonial, Institucional); catálogo de tipos de carta conservado completo, con Tipo 0/Tipo 0b reasignados a Agente 4 en la columna de atribución. Commit `ab38d08`.

**Estado resultante:** `A3_LETTER_TAXONOMY.md`, `A3_ENGINE_INSTITUCIONAL.md`, `A3_ENGINE_TESTIMONIAL_PERSONAL.md` y `A4_ENGINE_ABOGADO.md` son mutuamente consistentes. A3 = dos motores (Testimonial, Institucional). A4 = Motor Abogado (Tipo 0, Tipo 0b), dependiente de los Exhibits de A3.

**Medida preventiva:** se agregó la sección "Continuidad entre sesiones" a `A3_LETTER_TAXONOMY.md`, instruyendo a cualquier chat nuevo a leer los cuatro documentos de arquitectura completos antes de responder preguntas de diseño sobre A3/A4.

**Continuación — contratos de salida estructurada:**

Tras cerrar la corrección de arquitectura, se abordó el pendiente #2 de `A3_ENGINE_TESTIMONIAL_PERSONAL.md` y `A3_ENGINE_INSTITUCIONAL.md`: definir el formato de salida JSON que consumirá el builder de `.docx` de cada motor.

6. **IP Disclosure — entrada 3.25** — se documentó `CriticalRoleEvidence` como reclamo de propiedad intelectual (modelado de sub-criterio regulatorio de doble mecanismo mediante unión discriminada), con tabla de control y versión de `IP_DISCLOSURE.md` sincronizadas a 1.4. Commit `98151e5`.

7. **`A3_LETTER_TAXONOMY.md` v1.2** — se incorporó la separación 4a/4b de Rol Crítico al catálogo de tipos de carta, y se agregó la sección "Continuidad entre sesiones" para prevenir que un chat nuevo repita la confusión de arquitectura ya corregida. Commit `ba9e0c0`.

8. **`A3_ENGINE_TESTIMONIAL_PERSONAL.md` v1.1** — se definió el contrato de salida estructurada: un array de cartas donde cada una expone sus 7 bloques retóricos (8 claves, por la división 4a/4b del Bloque 4) como campos JSON independientes, con `presentationFormat` como control de la Capa 1 de variación del mecanismo de lote. Se precisó también que el Bloque 5 consume la determinación de criterio de A1, matizando la regla general de que el motor solo consume `intake_submissions`. Commit `72bc8a9`.

9. **`A3_ENGINE_INSTITUCIONAL.md` v1.2** — se definió el contrato de salida estructurada con discriminador `letterType` (cinco valores: `subtypeA_advisory`, `subtypeB_judge`, `subtypeB_criticalRole4a`, `subtypeB_criticalRole4b`, `subtypeB_awards`), a diferencia del Testimonial, sin expandir los bloques de salida por rama — el discriminador captura la doble ramificación (Subtipo A/B, y sub-criterio dentro de B) mientras la forma de los 6 campos de salida permanece fija. Se sincronizaron además los nombres de campo de fecha de Rol Crítico (`exactTenureDates`/`exactServiceDates` → `tenureStartDate`/`tenureEndDate`, `serviceStartDate`/`serviceEndDate`) con la implementación real de `CriticalRoleEvidence`, que había quedado desalineada desde su propia v1.1. Commit `75842b0`.

**Estado resultante (actualizado):** los cuatro documentos de arquitectura están sincronizados entre sí y con el código real. El Motor Testimonial y el Motor Institucional tienen su contrato de salida JSON formalmente definido — listo para que el builder de `.docx` de cada uno se implemente contra un esquema fijo. Pendiente: el mismo ejercicio de contrato de salida para el Motor Abogado (`A4_ENGINE_ABOGADO.md`).

## 2026-07-11

**Contexto:** continuación del trabajo de diseño de A3/A4, cerrando los pendientes menores identificados al final de la sesión anterior (modelo/parámetros de ejecución, mecanismo de notificación de discrepancias en Exhibits, orden determinístico de criterios para el ensamblaje).

**Correcciones y diseño aplicados, en orden:**

1. **Modelo y `max_tokens` de los tres motores** — se fija `claude-sonnet-4-6` para los tres, con `max_tokens` calibrado por motor según volumen de salida esperado (Testimonial 16000, Institucional 4096, Abogado Tipo 0 8192 / Tipo 0b 2048), verificado contra límites reales de la API (128k tokens de salida, streaming obligatorio >21,333). Commit `d4f8375`.

2. **Mecanismo de fusión sobre orden manual en Exhibits** — cuando el ensamblaje detecta que un Exhibit con reordenamiento manual necesitaría cambios (documento nuevo o removido), calcula una fusión que preserva el orden curado por el abogado en vez de recalcular desde cero. Notificación vía banner en la vista del caso. Commit `f58c995`.

3. **Orden canónico de criterios por clasificación de visa** — se investigó el Pendiente #3 (orden determinístico de criterios activos) y se encontró que A1 expone los criterios como `Record<string, ...>` producido directamente por el modelo de lenguaje, sin garantía de orden ni de estabilidad del conjunto entre llamadas. Se resolvió sin tocar A1: el ensamblaje usa un orden canónico fijo por clasificación de visa (O-1A, O-1B, EB-1A/EB-1B), verificado contra el USCIS Policy Manual.

**Hallazgo pendiente de investigación (no resuelto en esta sesión):** el conjunto de criterios que A1 marca como `criteria_met` puede variar entre llamadas para los mismos datos de intake, porque la llamada al modelo no usa `temperature: 0` ni mecanismo de determinismo. Esto excede el alcance de A3/A4 — afecta a A1 en su totalidad y a cualquier agente río abajo que consuma `criteria_met`. Mitigación actual: revisión humana del análisis de A1 antes de que se use para generar cartas, lo cual reduce el riesgo práctico. Pendiente de una sesión de diseño dedicada a A1 si se decide abordarlo con más rigor que la revisión manual.

**Estado resultante:** el diseño de contrato de salida y ensamblaje de los tres motores de generación de cartas queda completo, sin pendientes menores abiertos salvo implementación real (builders de `.docx`, lógica de ensamblaje ejecutable, migraciones aplicadas, rutas API, UI del banner de discrepancias).
