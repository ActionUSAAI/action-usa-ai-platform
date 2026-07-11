# A3 — Motor Institucional

**Estado:** Diseño completo. No implementado.
**Versión:** 1.2
**Última actualización:** 2026-07-10

## Qué cambió respecto a 1.1

Esta revisión aplica cuatro correcciones:

**(a) Sincronización de nombres de campo con `types.ts`.** La tabla de Subtipo B usaba `exactTenureDates` (4a) y `exactServiceDates` (4b) como campos de fecha únicos. La implementación real de `CriticalRoleEvidence` (commit `677e16f`) usa fechas estructuradas separadas: `tenureStartDate`/`tenureEndDate` para 4a, `serviceStartDate`/`serviceEndDate` para 4b (ambas ISO 8601, con el campo de fin admitiendo `null` si el rol sigue activo). La tabla se corrige para reflejar los nombres reales.

**(b) Referencias residuales al modelo de arquitectura viejo**, heredadas de la misma confusión ya corregida en `A3_ENGINE_TESTIMONIAL_PERSONAL.md`, `A4_ENGINE_ABOGADO.md` y `A3_LETTER_TAXONOMY.md`: el subtítulo "(Máquina 3)", la frase "el segundo de los tres motores" en Propósito, y el Pendiente #6 que trataba al Motor Abogado como parte de A3. Corregido: A3 contiene dos motores (Testimonial, Institucional); el Motor Abogado vive en Agente 4 — ver `A4_ENGINE_ABOGADO.md`.

**(c) Pendiente #5 marcado como resuelto.** La bandera de ramificación 4a/4b ya está implementada como unión discriminada (`criticalRoleType: 'elected' | 'technical'`) en `CriticalRoleEvidence`, `src/app/intake/types.ts`, commit `677e16f`. No requiere migración de datos legados — verificado contra producción: `Module10` es JSONB, 2 filas al momento de la implementación, ninguna con datos de Rol Crítico.

**(d) Pendiente #2 resuelto — contrato de salida estructurada.** Se define el formato JSON de salida con un discriminador `letterType` que captura ambos niveles de ramificación (Subtipo A/B, y dentro de B, el sub-criterio activo) sin expandir la forma de los bloques por cada combinación — a diferencia del Motor Testimonial, donde los bloques son estructuralmente fijos y solo varía el contenido, aquí el Bloque 3 tiene distintos campos de entrada según la rama, pero una única forma de salida.

## Propósito

Este documento especifica el motor de generación de cartas institucionales de A3 — uno de sus dos motores, junto con el Motor Testimonial Personal (`A3_ENGINE_TESTIMONIAL_PERSONAL.md`). Redacta cartas emitidas en nombre de una organización (asociación, federación, escuela, entidad gubernamental) — no de un individuo a título personal — que certifican un hecho puntual sobre el beneficiario o emiten una opinión de idoneidad general.

A diferencia del Motor Testimonial, este motor agrupa dos subtipos con estructuras de datos, función legal y nivel de exigencia probatoria distintos. Tratarlos como una sola plantilla fue el primer error de diseño descartado en este proceso.

## Fundamento normativo — validado contra un RFE real y cinco pares de cartas antes/después

El diseño de este motor se validó contra el RFE real del caso Arroyo (I-129 O-1A, IOE8888897299, Texas Service Center) y contra los pares de cartas —fallidas y corregidas— que ese mismo expediente produjo. A diferencia del Motor Testimonial, donde un solo RFE bastó, aquí fueron necesarios tres hallazgos independientes porque cada sub-criterio de Subtipo B falla por una razón conceptual distinta.

**Juez.** El RFE fue explícito: *"the record is lacking in providing objective supporting documentation to establish the significance of the work judged by the beneficiary, and information identifying the criteria used to select judges."* Y enumeró exactamente tres piezas de evidencia exigidas: *"evidence showing the significance of the work judged by the beneficiary; information identifying the criteria used to select judges; and an explanation describing how and why the beneficiary received an invitation to be a judge."* La carta original de Double T Arena no las cubría. La carta corregida (`DOBLE T ARENA 2.pdf`) sí, y la plantilla de un caso posterior (`Rancho_La_Jarana_Judge.docx`) las cubre con un nivel de rigor superior, añadiendo un elemento no exigido explícitamente por el RFE pero que refuerza la significancia: que el veredicto del juez fue final y vinculante, con consecuencias verificables sobre los evaluados.

**Rol Crítico.** El RFE rechazó la carta de la Cámara de Ganaderos de San Carlos por un error de categoría, no de detalle: *"Performing in an event an association sponsors or creates is not the same as being employed by that association."* La evidencia exigida —empleo o nombramiento formal real en capacidad esencial, para una organización de reputación distinguida— se encontró resuelta en dos cartas de casos ya aprobados, que resultaron ser **dos patrones fácticos distintos, no variaciones del mismo patrón**: la de Carlos Rodríguez como Presidente de ACRICAMDE (cargo electo, prueba por métricas de gestión — crecimiento de membresía, afiliación lograda con APHA en 2019, sistema de microchip implementado) y la de Dr. Andrés Neira en la Escuela Nacional de Carabineros de Colombia (mismo beneficiario del Motor Testimonial; cargo de instructor técnico, prueba por institucionalización — técnica incorporada al currículo, invitación renovada en 2021).

**Competencias Ganadas.** El RFE señaló que los premios presentados eran indicativos de reconocimiento local o regional, no nacional o internacional, y exigió evidencia de *"criteria used to nominate and judge the participants and award winners"* y *"the origination, purpose, significance, and scope of each award,"* incluyendo la reputación del panel y la frecuencia del premio. La carta original de Pro Rodeo de Costa Rica (`PRO RODEO COSTA RICA.pdf`, 28 feb 2024) no lo hacía — es una narrativa factualmente rica pero que no responde a la pregunta regulatoria. La carta corregida de ACRICAMDE (`CARTA ACRICAMDE RFE_1.pdf`, 12 sep 2024) sí, punto por punto.

## Principio rector

A diferencia del Motor Testimonial, aquí el riesgo no es el lenguaje hiperbólico — es la carta factualmente rica que responde la pregunta equivocada. Pro Rodeo de Costa Rica no exagera nada: simplemente narra logros reales sin tocar los elementos que el criterio exige. Por eso el principio rector de este motor es una **regla anti-genericidad**, no anti-hipérbole:

**Regla anti-genericidad (obligatoria):** ninguna carta institucional puede limitarse a narrar logros o cualidades del beneficiario. Debe responder, de forma verificable y punto por punto, a la lista específica de evidencia que USCIS exige para el criterio concreto que esa carta busca satisfacer. Una carta elegante que omite esos elementos es, a efectos probatorios, indistinguible de una carta rechazada.

## Los dos subtipos — no comparten estructura de datos

| | Subtipo A — Opinión Consultiva / No-Objeción | Subtipo B — Certificación |
|---|---|---|
| Función legal | Veredicto de idoneidad general | Confirmar un hecho puntual y verificable |
| Hecho específico | Opcional (refuerzo si existe relación directa) | Obligatorio — es el contenido central |
| Fuente de datos | `Module13` (`peerGroupName`, `peerGroupLetterType`) | `Module10`, según sub-criterio específico |
| Ejemplo validado | AQHA/Garibay (O-2, no-objeción, corta y genérica); AQHA/Rodríguez (O-1, más rica por membresía compartida) | Ver tabla de sub-criterios abajo |

## Estructura obligatoria — 5 bloques con contenido variable por subtipo

| # | Bloque | Subtipo A | Subtipo B |
|---|---|---|---|
| 1 | Encabezado/Asunto | Igual en ambos: destinatario (USCIS), referencia del caso | Igual en ambos |
| 2 | Identidad y autoridad de la organización | Descripción general de la organización y su rol en el campo | Depende del sub-criterio — ver tabla siguiente |
| 3 | Contenido central | Reconocimiento general de habilidad del aplicante | Obligatorio — el hecho certificado, con sus campos específicos |
| 3b | Refuerzo específico | Opcional | Ya cubierto en el Bloque 3 |
| 4 | Declaración | De no-objeción u opinión favorable | De certificación del hecho |
| 5 | Cierre | Siempre con placeholders en blanco — nunca datos reales de firmante | Igual en ambos |

## Subtipo B — los sub-criterios prioritarios y sus campos obligatorios

Estos son, por decisión operativa de ACTION USA, los sub-criterios institucionales que realmente suplen un criterio regulatorio ante USCIS (junto con Contribuciones al Campo, que se resuelve vía Motor Testimonial y queda fuera del alcance de este motor). Rol Crítico se presenta dividido en 4a y 4b, conforme a la corrección aplicada en la v1.1.

| Sub-criterio | Campos obligatorios (Bloque 2/3) | Mecanismo de prueba | Validado contra (fallo → éxito) |
|---|---|---|---|
| **Juez** | `judgeSelectionCriteria` (por qué la organización lo eligió/invitó a él específicamente); `judgedEventSignificance` (escala, nivel, relevancia del evento juzgado); `judgmentAuthorityAndConsequence` (si el veredicto fue final/vinculante y qué consecuencia verificable tuvo sobre los evaluados) | Significancia del evento juzgado + autoridad del veredicto | Double T Arena original (insuficiente) → Double T Arena corregida + Rancho La Jarana (plantilla de referencia) |
| **Rol Crítico 4a — Directivo/Electo** | `electedOrAppointedTitle`; `tenureStartDate` + `tenureEndDate` (ISO 8601; `tenureEndDate` admite `null` si el rol sigue activo); `organizationReputationEvidence` (reputación distinguida de la organización); `organizationalGrowthMetrics` (crecimiento medible atribuible a la gestión durante el mandato — membresía, nuevas afiliaciones logradas, sistemas o programas implementados) | Métricas de gestión cuantificables durante el período de liderazgo | San Carlos Livestock Chamber (rechazada — confundía patrocinio con empleo) → Rodríguez/ACRICAMDE (presidencia 2017-2024, afiliación APHA lograda en 2019, sistema de microchip implementado) |
| **Rol Crítico 4b — Técnico/Instructor** | `formalPositionTitle`; `serviceStartDate` + `serviceEndDate` (ISO 8601; `serviceEndDate` admite `null` si el rol sigue activo — no requiere contrato laboral tradicional, sí un nombramiento formal y verificable); `specificCoursesOrDutiesTaught` (qué enseñó/entrenó concretamente — cursos numerados, programas específicos); `institutionalizationEvidence` (evidencia de que el conocimiento transferido se incorporó de forma permanente — adopción curricular, continuidad en el currículo, renovación de la invitación como prueba de valor continuado) | Institucionalización verificable del conocimiento transferido | San Carlos Livestock Chamber (rechazada — confundía patrocinio con empleo) → Neira/Escuela Nacional de Carabineros (instructor de los cursos 009/010, técnica incorporada al currículo, invitación renovada en 2021) |
| **Competencias Ganadas** | `awardNominationAndJudgingCriteria` (criterios de nominación y juzgamiento de participantes y ganadores); `panelOrOrgReputationEvidence` (afiliaciones, reconocimiento cruzado por otras asociaciones); `awardFrequencyAndScope` (cuántos premios se otorgan al año, alcance nacional/internacional) | Rigor del proceso de nominación/juzgamiento | Pro Rodeo de Costa Rica (insuficiente) → ACRICAMDE corregida (post-RFE) |

**Nota de arquitectura:** el campo `institutionalizationEvidence` de Rol Crítico 4b y el campo `judgmentAuthorityAndConsequence` de Juez comparten una misma lógica subyacente — la del principio de originalidad+significancia del Motor Testimonial, trasladado al nivel institucional. En ambos casos no basta con afirmar que el rol o el veredicto importó; hay que mostrar qué cambió después, de forma verificable, como consecuencia de él. **Rol Crítico 4a no comparte esta lógica.** Su mecanismo de prueba no depende de un impacto narrado ni de institucionalización posterior — depende de la métrica de gestión cuantificable en sí misma, verificable durante el propio período del mandato, sin necesidad de mostrar continuidad más allá de él.

## Mecanismo de variación

A diferencia del Motor Testimonial, aquí no aplican las tres capas completas. Cada carta institucional va dirigida a una organización distinta y no compite por espacio en el mismo "lote" perceptual ante el oficial — el riesgo de que dos cartas se lean como intercambiables es mucho menor.

**Capa única — variación de contenido, solo cuando aplica.** Si un mismo caso requiere múltiples cartas del mismo sub-criterio (por ejemplo, varios acompañantes O-2 con cartas de Rol Crítico de organizaciones distintas), el modelo debe revisar las cartas ya generadas del mismo lote antes de escribir la siguiente, y no puede reutilizar la misma formulación de esencialidad o significancia entre ellas. Pendiente de confirmación con un caso real que presente esta situación — por ahora no se ha validado empíricamente.

## Contrato de salida estructurada

La ramificación de este motor ocurre en dos niveles — Subtipo (A/B) y, dentro de B, el sub-criterio activo (Juez, 4a, 4b, Competencias Ganadas) — pero la forma de los bloques de salida es idéntica en las cinco ramas: siempre son los mismos cinco campos (`block1` a `block5`, con `block3b` opcional). Lo que cambia entre ramas es qué campos de entrada alimentan `block3_coreContent`, no la forma de la salida. Por eso el contrato usa un discriminador único, `letterType`, en lugar de expandir una clave de salida distinta por cada sub-criterio — a diferencia del Motor Testimonial, donde los 8 campos de entrada mapean 1 a 1 con 8 claves de salida porque ahí la estructura nunca se ramifica, solo varía el contenido.

```json
{
  "letterType": "subtypeA_advisory | subtypeB_judge | subtypeB_criticalRole4a | subtypeB_criticalRole4b | subtypeB_awards",
  "blocks": {
    "block1_header": "string",
    "block2_organizationIdentity": "string",
    "block3_coreContent": "string",
    "block3b_specificReinforcement": "string | null",
    "block4_declaration": "string",
    "block5_closing": "string"
  }
}
```

`block3b_specificReinforcement` es `null` en toda rama de Subtipo B (el bloque 3b no aplica según la tabla de estructura obligatoria) y opcionalmente poblado en Subtipo A. `block5_closing` contiene siempre los placeholders literales (`[Nombre del funcionario autorizado]`, `[Cargo oficial]`, `[Teléfono]`, `[Correo electrónico]`, `[Firma]`) — nunca datos reales de firmante, conforme a la sección "Salida".

### Mapeo `letterType` → campos de entrada que alimentan `block3_coreContent`

| `letterType` | Campos de entrada | Fuente |
|---|---|---|
| `subtypeA_advisory` | `peerGroupName`, `peerGroupLetterType` | `Module13` |
| `subtypeB_judge` | `judgeSelectionCriteria`, `judgedEventSignificance`, `judgmentAuthorityAndConsequence` | `Module10` |
| `subtypeB_criticalRole4a` | `electedOrAppointedTitle`, `tenureStartDate`, `tenureEndDate`, `organizationReputationEvidence`, `organizationalGrowthMetrics` | `Module10.criticalRole` (rama `elected` de `CriticalRoleEvidence`) |
| `subtypeB_criticalRole4b` | `formalPositionTitle`, `serviceStartDate`, `serviceEndDate`, `specificCoursesOrDutiesTaught`, `institutionalizationEvidence` | `Module10.criticalRole` (rama `technical` de `CriticalRoleEvidence`) |
| `subtypeB_awards` | `awardNominationAndJudgingCriteria`, `panelOrOrgReputationEvidence`, `awardFrequencyAndScope` | `Module10` |

`letterType` para Rol Crítico se deriva directamente de `Module10.criticalRole.criticalRoleType` (`'elected'` → `subtypeB_criticalRole4a`; `'technical'` → `subtypeB_criticalRole4b`) — no requiere una determinación separada por parte del modelo ni de A1, ya que la bandera de ramificación ya existe en el dato estructurado del intake.

## Datos de entrada

**Del beneficiario** (`Module1`): `fullName`, `profession`, `industry`, `visaType`

**Subtipo A** (`Module13`): `peerGroupName`, `peerGroupLetterType`

**Subtipo B** (`Module10`), ramificado por sub-criterio activo del caso: los campos de la tabla anterior, más el criterio USCIS específico que la carta busca satisfacer (para anclar el Bloque 4 a la cita regulatoria correcta). Para Rol Crítico, el campo `Module10.criticalRole.criticalRoleType` (`CriticalRoleEvidence`, `src/app/intake/types.ts`) determina directamente si aplica 4a o 4b.

## Fuente de datos — decisión de arquitectura

Misma decisión que en el Motor Testimonial y por la misma razón: A3 consume `intake_submissions` (datos crudos), no la salida de `agent_intake_analysis` (A1). El `buildUserPrompt` de A1 no procesa Módulo 10 ni Módulo 13 con el nivel de detalle que este motor necesita — resume para su propio análisis de fortaleza del caso, perdiendo las fechas, cargos exactos y criterios de selección que aquí son obligatorios.

## Salida

A diferencia del Motor Testimonial, cuyo output es un documento terminado que el firmante solo revisa y firma, aquí el output es **siempre un modelo con placeholders explícitos** — `[Nombre del funcionario autorizado]`, `[Cargo oficial]`, `[Teléfono]`, `[Correo electrónico]`, `[Firma]` — nunca datos reales de firmante. Esto quedó confirmado empíricamente por `Rancho_La_Jarana_Judge.docx`, que usa exactamente esta convención (`[Name]`, `[Title]`) mientras deja completamente poblados los hechos institucionales y del evento.

El flujo posterior a la generación no cambia respecto a lo ya acordado: el cliente lleva el modelo a la organización, la organización lo transcribe a su papel membretado, lo firma, y el cliente lo re-sube al portal (alimentando `Module13.peerGroupLetterPath` / `peerGroupLetterName`). Por esto, Módulo 10 y Módulo 13 no necesitan campos de firmante institucional — el diseño original del intake, con esos campos como carga de archivo y no de generación, ya era correcto.

Documento `.docx` limpio, sin membrete. Idioma: inglés, salvo que el caso específico requiera español.

## Pendiente antes de implementación

1. Confirmar con qué modelo/parámetros se ejecutará la llamada (referencia: A1 usa `claude-sonnet-4-6`, `max_tokens: 2048`).
2. ~~Definir el formato exacto de salida estructurada...~~ **Resuelto en esta revisión** — ver "Contrato de salida estructurada".
3. Validar si existe un caso real donde el campo `formalPositionTitle` de Rol Crítico 4b corresponda a un contrato laboral tradicional (en lugar de un nombramiento formal como el de Neira) — actualmente el diseño asume que un nombramiento verificable con fechas exactas basta, pero no se ha probado contra ese escenario.
4. Validar el mecanismo de variación de Capa única contra un caso real con múltiples cartas del mismo sub-criterio (pendiente, ver sección de Mecanismo de variación).
5. ~~Definir, en la migración de base de datos correspondiente a Módulo 10, cómo se representa la bandera de ramificación 4a/4b...~~ **Resuelto**: implementado como unión discriminada `CriticalRoleEvidence` en `src/app/intake/types.ts`, commit `677e16f`. Sin deuda de migración de datos legados (verificado contra producción al momento de la implementación).
6. Definir el builder de `.docx` que consume el contrato de salida de este documento y el del Motor Testimonial, aplicando el layout correspondiente según `letterType` (Institucional) o `presentationFormat` (Testimonial).
