# A4 — Motor Abogado

**Estado:** Diseño completo. No implementado.
**Versión:** 1.1
**Última actualización:** 2026-07-10

## Qué cambió respecto a 1.0

La Versión 1.0 de este documento fue escrita bajo un modelo de arquitectura incorrecto: describía este motor como "el tercer y último motor" de A3 ("Máquina 1" de un conjunto de tres, junto con el Motor Testimonial y el Motor Institucional), y su Pendiente #3 hablaba de "el orquestador que invoca los tres motores" como lógica interna de A3.

**Corrección aplicada en 1.1:** el Motor Abogado (Tipo 0 — Attorney Petition Letter, Tipo 0b — Consultation Exception Letter) no es parte de A3. Vive en **Agente 4** (`petition_builder`), agente independiente. A3 contiene únicamente dos motores: el Motor Testimonial (`A3_ENGINE_TESTIMONIAL_PERSONAL.md`) y el Motor Institucional (`A3_ENGINE_INSTITUCIONAL.md`). A4 depende de A3 — específicamente, de los Exhibits que sus dos motores producen — pero es un agente separado, no un tercer submotor interno.

Esta corrección no afecta el fundamento normativo, la estructura de bloques, ni la validación contra casos reales documentada más abajo — todo eso permanece vigente. El cambio es exclusivamente de ubicación arquitectónica: dónde vive este motor dentro del sistema de agentes.

## Propósito

Este documento especifica el motor de generación de la carta del abogado del Agente 4 (`petition_builder`) — diseñado con el mismo proceso de validación empleado en `A3_ENGINE_TESTIMONIAL_PERSONAL.md` y `A3_ENGINE_INSTITUCIONAL.md`. Cubre los dos tipos de carta en voz del preparador del caso: Tipo 0 (Attorney Petition Letter) y Tipo 0b (Consultation Exception Letter).

A diferencia de los motores de A3, éste no aporta evidencia nueva. Redacta el documento que compila, organiza y argumenta ante USCIS toda la evidencia ya reunida — incluyendo las cartas testimoniales e institucionales que A3 genera — anclándola explícitamente al texto regulatorio de cada criterio.

## Fundamento normativo — validado contra seis cartas de abogado reales y un par fallo/éxito

El diseño de este motor se validó contra seis Attorney Petition Letters reales, abarcando dos categorías de visa, dos estrategias de petición y dos firmantes distintos: Arroyo (I-129 O-1A, versión original de presentación inicial y versión corregida en respuesta al RFE), Neira (I-140 EB-1A), Garibay (I-129 O-1A, versión corregida), Carlos Rodríguez (I-129 O-1A, versión corregida), y Góngora (I-129 O-1B). Adicionalmente, se validó contra una carta real de excepción de consulta (Tipo 0b) del caso Garibay.

**Hallazgo central: el esqueleto de 7 bloques no cambia entre la versión fallida y la corregida de un mismo caso.** Al comparar la carta original de Arroyo (la que precedió al RFE) contra la versión corregida (la respuesta al RFE ya documentada en el fundamento normativo del Motor Institucional de A3), ambas siguen exactamente la misma estructura de bloques. Lo que cambia es la profundidad probatoria dentro de cada bloque — específicamente, si las cartas institucionales y testimoniales subyacentes cubrían o no los parámetros que USCIS exige para ese criterio. La carta original de Arroyo argumentaba Rol Crítico citando a la Cámara de Ganaderos de San Carlos con lenguaje de elogio genérico ("has proven to be an invaluable asset... contributing to the success and excellence of the rodeos"), sin establecer nunca una relación de empleo real — exactamente el defecto que el RFE señaló después. Esto confirma que **Tipo 0 es tan fuerte como la evidencia que teje**: no puede compensar con mejor redacción una carta institucional que nunca estableció el hecho que el criterio exige.

## Principio rector

**Anclaje regulatorio obligatorio (no anti-hipérbole, no anti-genericidad):** cada afirmación de elegibilidad debe estar explícitamente atada a la cita CFR/INA exacta del criterio que argumenta, y cada hecho citado debe señalar el Exhibit específico que lo sustenta. Este motor no prueba nada por sí mismo — organiza y explica por qué la evidencia ya reunida (Módulos 9 y 10, vía los dos motores de A3) satisface cada elemento que la norma exige. La calidad de Tipo 0 depende enteramente de la calidad de los insumos que recibe de A3; su función es puramente argumentativa y de organización legal.

## Tipo 0 — Attorney Petition Letter

### Estructura obligatoria — 7 bloques

El Bloque 2 aparece siempre, independientemente de la actividad u oficio del beneficiario — confirmado: aparece tanto en casos técnicos/deportivos (Arroyo, Neira, Garibay, Rodríguez) como en casos artísticos (Góngora, donde se integra con la sección "I. LAW").

| # | Bloque | Función | Fuente de datos |
|---|---|---|---|
| 1 | Encabezado/Asunto | Destinatario USCIS (dirección varía por service center y formulario), RE con clasificación exacta + cita INA/CFR | A1, Module12 (`uscisFilingAddresses`) |
| 2 | Presentación del campo de actividad | Contextualiza la disciplina u oficio del beneficiario — siempre presente | Module1 |
| 3 | Marco legal y estándar de prueba | Test de elegibilidad completo + enumeración literal de los criterios evidentiarios del CFR aplicable | A1 |
| 4 | Declaración de criterios satisfechos | Cuántos y cuáles criterios cumple el beneficiario | A1 |
| 5 | Desarrollo criterio por criterio | Cada criterio con su propio encabezado, argumento anclado al CFR, y referencia a Exhibit — aquí se citan las cartas testimoniales/institucionales que A3 ya generó | A1 + todos los módulos |
| 6 | Conclusión | Síntesis de elegibilidad + solicitud formal de aprobación | — |
| 7 | Cierre | Firma **real** del abogado que presenta el caso — a diferencia de los motores de A3, aquí no hay placeholders | Datos del abogado firmante |

### Dos rutas — según estrategia de petición

**Ruta A — Multi-criterio (3-de-N o 5-de-10 según clasificación).** La ruta por defecto. Validada contra Arroyo, Neira, Garibay y Rodríguez (O-1A/EB-1A vía "al menos 3 de 8" o "al menos 5 de 10" criterios) y Góngora (O-1B vía el estándar de distinción del 8 CFR 214.2(o)(3)(iv)). El Bloque 4 declara cuántos criterios se documentan y el Bloque 5 los recorre uno por uno.

**Ruta B — Logro único (major, internationally recognized award).** Validada contra Iñigo (EB-1A vía Grammy/Latin Grammy, 8 CFR 204.5(h)(3)). Reemplaza el recorrido criterio-por-criterio del Bloque 5 por un bloque analítico único que argumenta por qué ese premio específico califica como "major internationally recognized award": naturaleza competitiva internacional, rigor del proceso de evaluación, autoridad de la institución otorgante, e impacto en la carrera del beneficiario.

La ruta activa la determina A1, no es una decisión de formato — depende de si el caso cuenta con un logro que satisfaga por sí solo el estándar de premio mayor, o si debe construirse sobre la acumulación de criterios menores.

## Tipo 0b — Consultation Exception Letter

Validada contra el ejemplo real del caso Garibay (Escamilla & Poneck, LLP, abril 2021). Estructura, mucho más corta que Tipo 0:

1. Encabezado con membrete del bufete, fecha, dirección de USCIS.
2. RE: Consultation Requirement Exception + nombre del beneficiario.
3. Cuerpo en tres movimientos: (a) declarar que no existe un peer group apropiado, incluyendo organización laboral, que pueda emitir una opinión consultiva escrita para el área de habilidad del beneficiario; (b) justificar por qué — el campo es demasiado singular o poco prevalente para tener una organización reconocida en el índice de USCIS; (c) ofrecer evidencia sustituta — colaboración con una organización análoga de mayor alcance, más cartas de recomendación, reconocimientos o certificados adjuntos.
4. Cierre.

Fuente de datos: `Module13 §A: noAssociationJustification`, más `Module10` para la evidencia sustituta ofrecida en el punto (c).

## Datos de entrada

**Tipo 0:** A1 (análisis de fortaleza del caso y determinación de ruta) + todos los módulos + referencias a los Exhibits producidos por el Motor Testimonial y el Motor Institucional de A3.

**Tipo 0b:** `Module13 §A: noAssociationJustification` + `Module10` (evidencia sustituta).

## Fuente de datos — decisión de arquitectura

A diferencia de los dos motores de A3, **Tipo 0 es el único que consume la salida de A1**, no solo `intake_submissions` crudo. Esto es necesario porque Tipo 0 debe saber qué ruta usar (A o B) y qué criterios están activos en el caso — una decisión de estrategia legal, no de redacción, que ya vive en el análisis de A1.

**Consecuencia de orquestación entre agentes:** A4 debe generar Tipo 0 después de que A3 complete sus dos motores (Testimonial e Institucional) para el caso, porque el Bloque 5 de Tipo 0 referencia los Exhibits que esos dos motores producen. Generarlo antes dejaría referencias a documentos que aún no existen. Esta es una dependencia de secuencia entre agentes (A3 → A4), no una orquestación interna de submotores.

**Nota pendiente de cierre**: este documento aún no referencia explícitamente el esquema de `agent_petition_drafts` (`petition_type: 'standard' | 'consultation_exception'`, con `build_phase: 'initial' | 'rfe'` como eje separado para la fase de radicación). Tipo 0b corresponde al valor `'consultation_exception'` de `petition_type`; Tipo 0 corresponde a `'standard'`. Pendiente confirmar si esta tabla vive bajo el dominio de A4 en el esquema de base de datos, dado que es este agente quien la genera.

## Salida

Documento `.docx` con membrete del bufete y firma **real** del abogado que presenta el caso (Alexander Clavijo o Sandra Clavijo, Esq., según el caso) — a diferencia de los motores de A3, aquí no aplica la convención de placeholders en blanco, porque quien firma es el propio preparador del caso, no un tercero externo.

## Mecanismo de variación

No aplica en el sentido de los motores de A3. Tipo 0 es un documento único por caso, no un lote de cartas generadas en una sola pasada — no hay necesidad de variación entre instancias porque solo existe una instancia por petición. El riesgo de reutilización mecánica entre casos distintos se mitiga de forma natural, ya que cada caso trae hechos, evidencia y Exhibits propios.

## Pendiente antes de implementación

1. Confirmar con qué modelo/parámetros se ejecutará la llamada, y si A1 debe exponer explícitamente un campo de determinación de ruta (`petitionStrategy: "multi-criteria" | "one-time-achievement"`) para que Tipo 0 no tenga que inferirlo.
2. Confirmar el diseño de la lógica de ramificación por tipo de formulario y service center dentro del mismo prompt (ya cubierto parcialmente por `uscisFilingAddresses.ts`).
3. Definir el contrato de dependencia entre A3 y A4: cómo A4 confirma que los dos motores de A3 completaron su generación para el caso antes de iniciar Tipo 0 (estado de caso, bandera de completitud, o consulta directa de existencia de los Exhibits).
4. Cerrar la nota pendiente de la sección "Fuente de datos — decisión de arquitectura": confirmar si `agent_petition_drafts` vive bajo el dominio de A4 y actualizar este documento con la referencia explícita al esquema (`petition_type`, `build_phase`) una vez confirmado.
5. Con este documento, el diseño de A3 (dos motores: Testimonial e Institucional) y de A4 (Motor Abogado, Tipo 0 y Tipo 0b) queda completo en su primera fase de diseño. Pendiente: sesión de diseño para el mapeo definitivo de los siete bloques retóricos al esquema de datos (Pendiente #2 de `A3_LETTER_TAXONOMY.md`) antes de iniciar implementación.
