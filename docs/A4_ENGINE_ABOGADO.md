# A4 — Motor Abogado

**Estado:** Diseño completo. No implementado.
**Versión:** 1.4
**Última actualización:** 2026-07-16

## Qué cambió respecto a 1.3

Corrección de nomenclatura: las referencias a la fuente de datos `Module13 §A` se actualizan a `Module15 §A` (Tipos 0b), alineando el documento con la columna real `module15` de `intake_submissions`. Sin cambios de diseño ni de contrato de salida.

## Qué cambió respecto a 1.2

Se resuelve por completo el Pendiente #1 (parcialmente resuelto desde v1.1 con la definición de `petitionStrategy`, faltaba modelo/parámetros). Misma verificación que en los dos motores de A3: `claude-sonnet-4-6`, hasta 128k tokens de salida, streaming obligatorio solo por encima de 21,333. Tipo 0 es el documento de mayor longitud individual de los tres motores (hasta 7 criterios desarrollados en Ruta A, según el caso Rodríguez) — se fija `max_tokens: 8192`. Tipo 0b es considerablemente más corto — se fija `max_tokens: 2048`.

**Decisión:** `model: claude-sonnet-4-6` para ambos tipos; `max_tokens: 8192` (Tipo 0), `max_tokens: 2048` (Tipo 0b).

## Qué cambió respecto a 1.1

Se resuelve el Pendiente #2 (contrato de salida estructurada), pendiente desde la v1.1 y ya resuelto para los dos motores de A3. Este es el tercer y último de los tres contratos de salida diseñados en esta fase.

**Hallazgo durante el diseño:** el Bloque 5 de Tipo 0 debe citar el Exhibit específico que sustenta cada argumento de criterio, pero el contrato de salida del Motor Institucional no tenía ningún identificador estable por carta. Se corrigió `A3_ENGINE_INSTITUCIONAL.md` a v1.3, agregando `letterId` al envelope — ver ese documento para el detalle.

**Decisión de arquitectura tomada aquí:** ni el Motor Testimonial ni el Motor Institucional conocen su propio número de Exhibit al generarse — ese número depende del orden final del paquete probatorio completo del caso (que incluye documentos que no son cartas), y las cartas se generan antes de que ese orden exista. La numeración de Exhibits es responsabilidad de **A4**, en un paso de ensamblaje determinístico (no generativo) previo a la llamada de Tipo 0: A4 construye un mapa `letterId → exhibitNumber` a partir del orden real del paquete de evidencia, y ese mapa ya resuelto se entrega como parte del contexto de entrada al prompt de Tipo 0. El modelo nunca inventa ni infiere numeración de Exhibits.

Esto también resuelve, de forma indirecta, el Pendiente #3 (contrato de dependencia A3 → A4): A4 no solo depende de que A3 haya completado sus dos motores — depende específicamente de tener el mapa `letterId → exhibitNumber` ya construido antes de invocar el prompt de Tipo 0.

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
| 5 | Desarrollo criterio por criterio | Cada criterio con su propio encabezado, argumento anclado al CFR, y referencia a Exhibit — aquí se citan las cartas testimoniales/institucionales que A3 ya generó | A1 + todos los módulos + mapa `letterId → exhibitNumber` ensamblado por A4 |
| 6 | Conclusión | Síntesis de elegibilidad + solicitud formal de aprobación | — |
| 7 | Cierre | Firma **real** del abogado que presenta el caso — a diferencia de los motores de A3, aquí no hay placeholders | Datos del abogado firmante |

### Dos rutas — según estrategia de petición

**Ruta A — Multi-criterio (3-de-N o 5-de-10 según clasificación).** La ruta por defecto. Validada contra Arroyo, Neira, Garibay y Rodríguez (O-1A/EB-1A vía "al menos 3 de 8" o "al menos 5 de 10" criterios) y Góngora (O-1B vía el estándar de distinción del 8 CFR 214.2(o)(3)(iv)). El Bloque 4 declara cuántos criterios se documentan y el Bloque 5 los recorre uno por uno.

**Ruta B — Logro único (major, internationally recognized award).** Validada contra Iñigo (EB-1A vía Grammy/Latin Grammy, 8 CFR 204.5(h)(3)). Reemplaza el recorrido criterio-por-criterio del Bloque 5 por un bloque analítico único que argumenta por qué ese premio específico califica como "major internationally recognized award": naturaleza competitiva internacional, rigor del proceso de evaluación, autoridad de la institución otorgante, e impacto en la carrera del beneficiario.

La ruta activa la determina A1, no es una decisión de formato — depende de si el caso cuenta con un logro que satisfaga por sí solo el estándar de premio mayor, o si debe construirse sobre la acumulación de criterios menores. Se captura como `petitionStrategy` en el contrato de salida (ver sección siguiente), resolviendo el Pendiente #1: A1 debe exponer este campo explícitamente (`petitionStrategy: "multiCriteria" | "singleAchievement"`) para que Tipo 0 no tenga que inferir la ruta.

## Tipo 0b — Consultation Exception Letter

Validada contra el ejemplo real del caso Garibay (Escamilla & Poneck, LLP, abril 2021). Estructura, mucho más corta que Tipo 0:

1. Encabezado con membrete del bufete, fecha, dirección de USCIS.
2. RE: Consultation Requirement Exception + nombre del beneficiario.
3. Cuerpo en tres movimientos: (a) declarar que no existe un peer group apropiado, incluyendo organización laboral, que pueda emitir una opinión consultiva escrita para el área de habilidad del beneficiario; (b) justificar por qué — el campo es demasiado singular o poco prevalente para tener una organización reconocida en el índice de USCIS; (c) ofrecer evidencia sustituta — colaboración con una organización análoga de mayor alcance, más cartas de recomendación, reconocimientos o certificados adjuntos.
4. Cierre.

Fuente de datos: `Module15 §A: noAssociationJustification`, más `Module10` para la evidencia sustituta ofrecida en el punto (c).

## Contrato de salida estructurada

### Tipo 0

A diferencia de los dos motores de A3, el Bloque 5 de Tipo 0 no tiene longitud fija: en Ruta A es un array con tantos elementos como criterios satisfechos tenga el caso; en Ruta B es un único bloque analítico. El contrato usa `petitionStrategy` como discriminador de forma —no de contenido, como en el Motor Institucional— porque aquí sí cambia la estructura misma del Bloque 5, no solo qué lo alimenta.

```json
{
  "petitionStrategy": "multiCriteria | singleAchievement",
  "blocks": {
    "block1_header": "string",
    "block2_fieldPresentation": "string",
    "block3_legalFrameworkStandard": "string",
    "block4_criteriaSatisfiedDeclaration": "string",
    "block5_criteriaDevelopment": [
      {
        "criterionCitation": "string — cita CFR/INA exacta, p.ej. '8 CFR 204.5(h)(3)(iv)'",
        "criterionLabel": "string — nombre legible del criterio",
        "argument": "string",
        "exhibitNumbers": ["string — Exhibit N, ya resuelto por A4 antes de esta llamada"]
      }
    ],
    "block5_singleAchievementAnalysis": "string | null",
    "block6_conclusion": "string",
    "block7_closing": "string"
  }
}
```

Regla de exclusión mutua: si `petitionStrategy = "multiCriteria"`, `block5_criteriaDevelopment` está poblado y `block5_singleAchievementAnalysis` es `null`. Si `petitionStrategy = "singleAchievement"`, `block5_criteriaDevelopment` es `[]` y `block5_singleAchievementAnalysis` contiene el bloque analítico único. Nunca ambos poblados a la vez.

`exhibitNumbers` es un array (no un string único) porque un mismo argumento de criterio puede citar más de un Exhibit — por ejemplo, dos cartas testimoniales distintas que refuerzan el mismo criterio.

`block7_closing` contiene datos reales del abogado firmante (nombre, no placeholder), conforme a la sección "Salida".

### Tipo 0b

Envelope propio, sin relación estructural con los 7 bloques de Tipo 0 — los tres movimientos del cuerpo (declaración, justificación, evidencia sustituta) se exponen como campos independientes en lugar de un bloque de texto único, para que el builder de `.docx` pueda aplicar formato diferenciado a cada movimiento si el caso lo requiere.

```json
{
  "letterType": "consultationException",
  "blocks": {
    "block1_header": "string",
    "block2_reSubject": "string",
    "block3a_noPeerGroupDeclaration": "string",
    "block3b_fieldSingularityJustification": "string",
    "block3c_substituteEvidence": "string",
    "block4_closing": "string"
  }
}
```

## Datos de entrada

**Tipo 0:** A1 (análisis de fortaleza del caso, `petitionStrategy`, criterios activos) + todos los módulos + mapa `letterId → exhibitNumber` ensamblado por A4 a partir de las cartas ya generadas por los dos motores de A3.

**Tipo 0b:** `Module15 §A: noAssociationJustification` + `Module10` (evidencia sustituta).

## Fuente de datos — decisión de arquitectura

A diferencia de los dos motores de A3, **Tipo 0 es el único que consume la salida de A1**, no solo `intake_submissions` crudo. Esto es necesario porque Tipo 0 debe saber qué ruta usar (A o B) y qué criterios están activos en el caso — una decisión de estrategia legal, no de redacción, que ya vive en el análisis de A1.

**Consecuencia de orquestación entre agentes:** A4 debe generar Tipo 0 después de que A3 complete sus dos motores (Testimonial e Institucional) para el caso, porque el Bloque 5 de Tipo 0 referencia los Exhibits que esos dos motores producen. Generarlo antes dejaría referencias a documentos que aún no existen. Esta es una dependencia de secuencia entre agentes (A3 → A4), no una orquestación interna de submotores.

**Nota resuelta en esta revisión:** `agent_petition_drafts` usa `petition_type: 'standard' | 'consultation_exception'` para distinguir Tipo 0 de Tipo 0b, con `build_phase: 'initial' | 'rfe'` como eje separado para la fase de radicación. Esta tabla vive bajo el dominio de A4, que es quien la genera y la escribe.

## Salida

Documento `.docx` con membrete del bufete y firma **real** del abogado que presenta el caso (Alexander Clavijo o Sandra Clavijo, Esq., según el caso) — a diferencia de los motores de A3, aquí no aplica la convención de placeholders en blanco, porque quien firma es el propio preparador del caso, no un tercero externo.

## Mecanismo de variación

No aplica en el sentido de los motores de A3. Tipo 0 es un documento único por caso, no un lote de cartas generadas en una sola pasada — no hay necesidad de variación entre instancias porque solo existe una instancia por petición. El riesgo de reutilización mecánica entre casos distintos se mitiga de forma natural, ya que cada caso trae hechos, evidencia y Exhibits propios.

## Pendiente antes de implementación

1. ~~Confirmar con qué modelo/parámetros se ejecutará la llamada, y si A1 debe exponer explícitamente un campo de determinación de ruta...~~ **Resuelto por completo en esta revisión** — ver "Qué cambió respecto a 1.2".
2. ~~Definir el formato exacto de salida estructurada...~~ **Resuelto en esta revisión** — ver "Contrato de salida estructurada".
3. ~~Definir el contrato de dependencia entre A3 y A4...~~ **Resuelto en esta revisión**: A4 depende del mapa `letterId → exhibitNumber`, construido en un paso de ensamblaje determinístico previo a la llamada de Tipo 0. Pendiente de implementar ese paso de ensamblaje como tal (no solo documentado aquí como decisión).
4. ~~Cerrar la nota pendiente... confirmar si `agent_petition_drafts` vive bajo el dominio de A4...~~ **Resuelto en esta revisión** — ver "Fuente de datos — decisión de arquitectura".
5. Confirmar el diseño de la lógica de ramificación por tipo de formulario y service center dentro del mismo prompt (ya cubierto parcialmente por `uscisFilingAddresses.ts`).
6. Implementar el paso de ensamblaje que construye el mapa `letterId → exhibitNumber` a partir del paquete completo de evidencia del caso (cartas de A3 + documentos de Módulo 10 que no son cartas) — este paso es prerequisito operativo para poder invocar Tipo 0, y su lógica de ordenamiento de Exhibits (por criterio, por fecha, por tipo de documento) aún no está definida.
7. Con este documento, el diseño de contrato de salida de los tres motores de generación de cartas (A3 Testimonial, A3 Institucional, A4 Abogado) queda completo. Falta implementación de los builders de `.docx` correspondientes.
