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

## 2026-07-16

**Contexto:** primera prueba de punta a punta de los tres motores de generación de cartas contra datos reales (caso sintético), tras recuperar la sesión de un cierre inesperado de Claude Code. Objetivo: verificar que el pipeline diseñado en sesiones anteriores funcionara en ejecución real, no solo en compilación.

**Bugs reales encontrados y corregidos, en orden de aparición:**

1. **Parseo de JSON con fences de markdown** — Claude a veces envuelve su respuesta JSON en fences de markdown (` ```json ... ``` `) a pesar de que los tres `systemPrompt` piden explícitamente JSON puro. Corregido con `stripMarkdownFences()` en las tres rutas (`a3-testimonial-letters`, `a3-institutional-letters`, `a4-attorney-letters`). Commit `2b636fc`.

2. **Tipo MIME de `.docx` no permitido en el bucket de Storage** — el bucket `intake-documents` tenía "Restrict MIME types" activado con solo `application/pdf, image/jpeg, image/png` permitidos, nunca se agregó el tipo de Word (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`). Corregido directamente en la configuración del bucket en el dashboard de Supabase — no requirió cambio de código. Sugiere que A2 (que también sube `.docx` a este bucket) tampoco se había probado realmente contra este bucket hasta ahora.

3. **`agent_recommendation_letters.run_id` (`NOT NULL`) nunca escrito por los builders de A3** — ni el builder Testimonial ni el Institucional creaban un `agent_run` ni lo referenciaban al insertar, a diferencia del builder de A4 (Abogado), que sí lo hacía desde su diseño original. El error solo se manifestaba en runtime, nunca en build/type-check. Corregido extrayendo el ciclo de tres fases (`createAgentRun`/`completeAgentRun`/`failAgentRun`) a un módulo compartido nuevo, `src/lib/agents/agent-runs.ts` (evitando triplicar el código que ya existía en A4), e integrándolo en ambos builders con grano de un `agent_run` por lote. Commit `485f77b`.

**Validación de contenido:** tras las tres correcciones, se generaron y revisaron manualmente dos cartas testimoniales reales contra un caso de prueba sintético (O-1A, criterio `original_contributions`). Ambas cumplieron la regla anti-hipérbole, la estructura de 7 bloques, y el mecanismo de variación de Capa 1 (formatos de presentación distintos entre las dos cartas del mismo lote).

**Hallazgo de diseño pendiente, no corregido en esta sesión:** los tres builders suben el `.docx` a Storage *antes* de insertar en `agent_recommendation_letters`/`agent_petition_drafts`. Si el insert falla después de un upload exitoso (como ocurrió en las pruebas previas al fix de `run_id`), queda un archivo huérfano en Storage sin fila que lo referencie — se encontró y limpió manualmente un huérfano de este tipo durante la limpieza del caso de prueba. Opciones para una sesión futura: (a) compensar en el `catch`/`failAgentRun` borrando el `.docx` ya subido, (b) invertir el orden (insertar primero, subir después — viable ya que `docx_path` se puede predecir antes del upload), o (c) un job de barrido periódico que borre `.docx` sin fila correspondiente. No urgente — no afecta el happy-path con `run_id` ya corregido.

**Caso de prueba sintético:** creado y limpiado en su totalidad al cierre de la sesión (cliente, caso, intake_submission, agent_run, 2 cartas, y el .docx huérfano) — ningún dato de prueba permanece en producción.

**Estado resultante:** los tres motores de generación de cartas (Testimonial, Institucional, Abogado) tienen código completo y, en el caso del Testimonial, verificación real de ejecución de punta a punta. Institucional y Abogado comparten las mismas correcciones (fences, run_id vía el mismo módulo compartido) pero no se probaron en ejecución real en esta sesión — candidatos naturales para la próxima sesión de pruebas.

## 2026-07-17

**Contexto:** continuación de la validación en ejecución real — hoy, el Motor Institucional (ayer fue el Testimonial).

**Bug encontrado y corregido:**

**Fences de markdown más allá del patrón esperado** — el fix de ayer (`2b636fc`) usaba un regex estricto que exigía el fence exactamente al inicio y fin absolutos del string. La primera prueba real del Motor Institucional falló con el mismo error de "not valid JSON" a pesar de que el fix ya estaba cableado — el regex no cubría la variante específica de envoltorio que produjo el modelo en esta corrida. Corregido agregando un fallback de extracción por llaves balanceadas (`indexOf("{")`/`lastIndexOf("}")`), tolerante a prosa envolvente, fences de una línea, o contenido tras el cierre. Commit `157adb9`. Validado en ejecución real: generó exitosamente las 2 cartas de prueba tras el fix.

**Validación de contenido — resultado mixto:**

Se generaron y revisaron manualmente dos cartas institucionales contra un caso de prueba sintético (O-1A): `subtypeB_criticalRole4a` (Rol Crítico directivo/electo) y `subtypeA_advisory` (Opinión Consultiva).

- **Rol Crítico 4a — impecable.** `organizationName` se usó correctamente (confirmando el fix `e5e7fe4` de ayer), las tres métricas de gestión exigidas por el criterio se desarrollaron con hechos verificables, cierre con placeholders en blanco correctos.
- **Advisory Opinion — comportamiento no deseado, sin corregir.** El `systemPrompt` instruye que el Bloque 3 debe limitarse a declarar la postura de la organización (favorable/no-objeción), pero el modelo generó un recorrido completo de los 8 criterios O-1A, cada uno con placeholders `[To be completed by the organization: ...]` — una plantilla genérica, no la opinión sustantiva esperada. Causa raíz: `sourceData` del candidato `subtypeA_advisory` llega casi vacío al modelo (solo `peerGroupLetterType`), porque el intake (`Module15` Sección A) no captura evidencia sustantiva más allá del nombre de la organización y el tipo de carta esperada — a diferencia de los sub-criterios de Subtipo B, que sí tienen campos de detalle ricos (agregados en sesiones anteriores). El modelo, sin datos con qué trabajar, generó una estructura no solicitada en vez de una carta corta y honesta sobre los datos limitados disponibles.

**Pendiente de decisión en sesión futura:** dos caminos no excluyentes — (a) endurecer el `systemPrompt` de `subtypeA_advisory` para que, ante datos escasos, genere una carta breve y fiel a lo disponible en vez de inventar estructura no solicitada; (b) enriquecer el intake (`Module15` Sección A) con campos de contexto adicionales para que el candidato tenga más con qué trabajar. No es un bug de código — es una interacción entre diseño de prompt y suficiencia de datos de intake, mismo patrón de causa raíz que motivó las correcciones de intake de sesiones anteriores (Juez, Competencias Ganadas, Rol Crítico).

**Caso de prueba sintético:** creado y limpiado en su totalidad — sin huérfanos en Storage esta vez (confirmado con listado dinámico por prefijo), a diferencia de la sesión de ayer.

**Estado resultante:** dos de los tres motores (Testimonial, Institucional) validados en ejecución real, con sus respectivos bugs de runtime corregidos. Pendiente: Motor Abogado (Tipo 0/Tipo 0b) — nunca probado en ejecución real.

## 2026-07-17 (continuación) — Motor Abogado

**Contexto:** cierre de la validación en ejecución real de los tres motores de generación de cartas. Sesión previa (misma fecha) cubrió el Motor Institucional; esta cubre el Motor Abogado (Tipo 0 + Tipo 0b) — el único que faltaba, y el más complejo por depender de Exhibits reales previamente ensamblados.

**Caso de prueba:** encadenó los tres motores en secuencia por primera vez — Testimonial → Institucional → Abogado — sobre un único caso sintético, con `agent_intake_analysis` sembrada manualmente (nunca se corrió A1 real) para simular `classification_used`/`criteria_met` con dos criterios activos (`original_contributions`, `critical_role_4a`).

**Incidentes de infraestructura, no de código:**

- Saldo de la cuenta de API de Anthropic agotado a mitad de sesión — resuelto recargando créditos en console.anthropic.com. Causó una falsa alarma: el primer error tras el agotamiento se leyó como fallo de parseo de JSON, cuando en realidad era el error 400 de crédito insuficiente devuelto por la API, camuflado por el mensaje genérico de error del `catch`.
- Caché de build de Next.js (`.next/`) corrompiéndose repetidamente tras varios reinicios y ediciones de archivo en caliente durante la sesión — resuelto con `rm -rf .next` (y en una ocasión también `node_modules/.cache`). No relacionado con el código de la aplicación.
- Se aprovechó para vincular Claude Code a la suscripción Pro existente (`/login` → cuenta con suscripción) en vez de seguir facturando por uso de API directa, evitando agotamientos de saldo futuros en el propio Claude Code.

**Bug real encontrado y corregido — trazabilidad de Exhibits rota en Tipo 0:**

`assembleExhibits` funcionó correctamente en su primera ejecución real (ensambló 2 Exhibits a partir de las cartas Testimonial e Institucional ya generadas), y ambas llamadas a Claude para Tipo 0 y Tipo 0b completaron sin error — pero una revisión de los datos crudos en `agent_petition_drafts.blocks` reveló que `block5_criteriaDevelopment[].exhibitNumbers` y `.criterionLabel` quedaban vacíos para ambos criterios, a pesar de que `case_exhibits` sí tenía las citas correctas.

Causa raíz: el `.find()` que empareja la respuesta del modelo con las filas de `case_exhibits` comparaba `r.criterion_citation` (solo la cita CFR cruda) contra `ra.criterionCitation` devuelto por el modelo — pero el modelo devolvía el string combinado `"Label (Citation)"`, siguiendo fielmente el formato con el que `buildTipo0UserPrompt` le mostraba los criterios activos (`"${label} (${citation}) — Exhibit ${n}"`). El modelo no desobedeció ninguna instrucción; el prompt le enseñó, sin querer, el patrón incorrecto a imitar.

Corregido en la causa raíz, no en el síntoma: `buildTipo0UserPrompt` ahora presenta cada criterio con tres campos explícitamente separados (`"Criterion citation: X | Label: Y | Exhibit: Z"`), y `buildTipo0SystemPrompt` agrega un ejemplo concreto de qué copiar (solo la cita) y qué no copiar (el label combinado). Se agregó `.trim()` en ambos lados del `.find()` como salvaguarda adicional, sin sustituir el fix de fondo. Commit `d6a3433`.

**Validación posterior al fix:** re-ejecutado contra el mismo caso (con `case_exhibits` ya ensamblado, así que la re-ejecución solo ejercitó la llamada a Claude y el `.find()` corregidos, sin tocar el ensamblaje). Ambos criterios resolvieron correctamente: `exhibitNumbers: ["1"]` / `["2"]`, con `criterionLabel` poblado en ambos.

**Validación de contenido:** Tipo 0 cita jurisprudencia real y correcta (INA §101(a)(15)(O)(i), 8 CFR 214.2(o)(3), *Kazarian*, *Matter of Dhanasar*, *Matter of Chawathe*), desarrolla ambos criterios con el estándar de dos elementos exigido por cada uno, y cierra con firma real del abogado (no placeholder, conforme al diseño). Tipo 0b cita correctamente 8 CFR 214.2(o)(5)(ii) y el precedente Garibay, usa fielmente los datos de `noAssociationJustification`/`alternativeContactName` del intake, y también cierra con firma real.

**Caso de prueba sintético:** limpiado en su totalidad — 8 tablas y 4 subcarpetas de Storage verificadas en 0, sin huérfanos (confirmado con listado dinámico por prefijo en las 4 rutas).

**Estado resultante:** los tres motores de generación de cartas (Testimonial, Institucional, Abogado) están validados en ejecución real de punta a punta, con todos los bugs de runtime descubiertos corregidos y commiteados. Pendientes abiertos, sin cambios respecto a entradas anteriores: (1) comportamiento del Advisory Opinion con datos escasos (entrada anterior de hoy), (2) huérfanos de Storage si el insert falla tras el upload (entrada de ayer), (3) no-determinismo de `criteria_met` en A1 (entrada previa).

## 2026-07-17 (cierre) — Fix del Advisory Opinion

**Contexto:** cierre del último pendiente abierto de la sesión de hoy — el comportamiento no deseado del candidato `subtypeA_advisory` con datos escasos, registrado en la entrada anterior de la mañana.

**Fix aplicado:** el `systemPrompt` de `subtypeA_advisory` restringe ahora explícitamente el Bloque 3 a una declaración de postura breve (2-4 oraciones), aclara que esta carta no argumenta los criterios de la petición (función exclusiva de la Attorney Petition Letter), y prohíbe explícitamente inventar contenido o recorrer criterios uno por uno cuando los datos de entrada son escasos — instruyendo preferir una carta corta y honesta sobre una plantilla extensa inventada. Commit `b9ff9db`.

**Validación en ejecución real:** caso de prueba aislado (solo `Module15.hasPeerGroup: "si"`, sin candidatos de Subtipo B) replicando exactamente el escenario de datos escasos de la mañana. Resultado: carta de 2-3 oraciones declarando la postura, sin ningún desglose de criterios ni placeholders de relleno — contraste directo con la plantilla de 8 criterios de la corrida anterior al fix. El modelo agregó por iniciativa propia un disclaimer legal breve ("does not constitute legal representation"), coherente con el tono pedido, sin contradecir ninguna instrucción.

**Caso de prueba sintético:** limpiado en su totalidad — verificado en 0 en las 4 tablas relevantes y Storage.

**Estado resultante:** los tres motores de generación de cartas (Testimonial, Institucional, Abogado) están validados en ejecución real de punta a punta, sin bugs de comportamiento conocidos pendientes. Pendientes de diseño que permanecen abiertos, sin cambios: (1) huérfanos de Storage si el insert falla tras el upload, (2) no-determinismo de `criteria_met` en A1, (3) enriquecer `Module15` Sección A con más campos de intake (opción complementaria al fix de hoy, no necesaria para el comportamiento correcto, solo para opiniones consultivas más sustantivas si el negocio lo requiere en el futuro).
