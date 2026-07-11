# A3 — Motor Testimonial Personal

**Estado:** Diseño completo. No implementado.
**Versión:** 1.3
**Última actualización:** 2026-07-11

## Qué cambió respecto a 1.2

Se resuelve el Pendiente #1 (modelo/parámetros de ejecución). Verificado contra documentación vigente de Anthropic: `claude-sonnet-4-6` soporta hasta 128k tokens de salida en la Messages API; el streaming es obligatorio solo por encima de 21,333 tokens (requisito de los SDKs, no de la API en sí). Con el escenario confirmado de hasta 8-10 firmantes por caso robusto, el lote completo de cartas testimoniales se estima en 6,000-8,000 tokens de contenido — se fija `max_tokens: 16000` con margen de seguridad, quedando por debajo del umbral de streaming obligatorio para simplificar la implementación inicial.

**Decisión:** `model: claude-sonnet-4-6`, `max_tokens: 16000`.

## Qué cambió respecto a 1.1

Dos correcciones, ambas de cierre — no afectan el diseño sustantivo del motor:

**(a) Unificación de nomenclatura: `signerId` → `letterId`.** El contrato de salida usaba `signerId` como identificador estable de carta. Al diseñar el Bloque 5 de Tipo 0 en `A4_ENGINE_ABOGADO.md` v1.2 (que debe citar el Exhibit correspondiente a cada carta), se estableció `letterId` como nombre estándar del identificador en los tres motores — ya adoptado en `A3_ENGINE_INSTITUCIONAL.md` v1.3 y en el diseño de ensamblaje de Exhibits de A4. Se corrige aquí para que los tres contratos usen el mismo nombre de campo para el mismo concepto, evitando mapeo de nombres innecesario entre capas durante la implementación.

**(b) Pendiente #3 marcado como resuelto.** Pedía diseñar el mismo nivel de detalle de contrato de salida para el Motor Institucional y el Motor Abogado — ambos ya lo tienen (`A3_ENGINE_INSTITUCIONAL.md` v1.3, `A4_ENGINE_ABOGADO.md` v1.2). Queda obsoleto como pendiente activo.

## Qué cambió respecto a 1.0

La Versión 1.0 tenía dos tipos de desactualización, corregidas en 1.1:

**(a) Referencias al modelo de arquitectura viejo**, heredadas de la misma confusión ya corregida en `A3_ENGINE_INSTITUCIONAL.md`, `A4_ENGINE_ABOGADO.md` y `A3_LETTER_TAXONOMY.md`: el subtítulo "(Máquina 2)", la frase "el primero de los tres motores en ser diseñado" en Propósito, y el Pendiente #3 que trataba al Motor Abogado como parte de A3. Corregido: A3 contiene dos motores (Testimonial, Institucional); el Motor Abogado vive en Agente 4 — ver `A4_ENGINE_ABOGADO.md`.

**(b) Pendiente #2 resuelto — contrato de salida estructurada.** Se define el formato JSON de salida, mapeando cada uno de los 7 bloques retóricos (8 claves, ya que el Bloque 4 se divide en 4a/4b) a una clave de datos independiente, y se precisa la sección "Fuente de datos" para reflejar que el Bloque 5 sí consume la determinación de criterios activos de A1 — una precisión que la v1.0 pasaba por alto al afirmar categóricamente que A3 solo consume `intake_submissions`.

## Propósito

Este documento especifica el motor de generación de cartas testimoniales personales de A3 — uno de sus dos motores, junto con el Motor Institucional (`A3_ENGINE_INSTITUCIONAL.md`). Redacta cartas de recomendación en nombre de terceros (colegas, supervisores, clientes, mentores) que respaldan la petición de visa de un beneficiario.

## Fundamento normativo — validado contra un RFE real

El diseño de este motor no es teórico: está validado contra la respuesta a un RFE real (caso Neira, I-140 EB-1A, IOE0929191963) donde USCIS especificó textualmente qué hace que una carta testimonial sea probativa para el criterio de "contribuciones originales de importancia significativa":

> *"Letters that specifically articulate how the person's contributions are of major significance to the field and their impact on subsequent work add value. Letters that lack specifics and simply use hyperbolic language do not add value and are not considered to be probative evidence."*

> *"...must explain, in detail, how the contribution was 'original' (not merely replicating the work of others) and how they were of 'major' significance. General statements regarding the importance of the endeavors which are not supported by documentary evidence are insufficient."*

Las cinco cartas testimoniales redactadas siguiendo esta instrucción (Forero, Salgado García, Naranjo, Duran, Vela Mahecha) resultaron en la aprobación del caso. Cada una ancla su contenido en dos elementos verificables: qué introdujo el beneficiario (originalidad) y qué pasó después como consecuencia (significancia/impacto downstream).

## Principio rector

El peso probatorio de una carta ante USCIS depende del cumplimiento de dos elementos explícitos, no de la elegancia del lenguaje:

1. **Originalidad** — qué hizo el beneficiario que no fuera replicar el trabajo de otros.
2. **Significancia mayor** — el impacto verificable y posterior de esa contribución (adopción institucional, cambios normativos, influencia en otros profesionales, resultados medibles).

**Regla anti-hipérbole (obligatoria):** ninguna frase evaluativa ("extraordinario", "excepcional", "pionero", "invaluable") puede aparecer sin un hecho verificable inmediatamente adyacente que la sostenga. Una carta que describe sin sustento es hipérbole vacía — USCIS la descarta explícitamente como no probativa.

## Estructura obligatoria de 7 bloques

| # | Bloque | Función | Fuente de datos |
|---|---|---|---|
| 1 | Encabezado/Asunto | Destinatario (USCIS), referencia del caso, propósito | Datos del caso |
| 2 | Identidad y autoridad del firmante | Por qué su palabra tiene peso | `signerCredentials` |
| 3 | Naturaleza de la relación | Tipo y duración de la relación con el beneficiario | `relationshipType`, `relationshipDuration` |
| 4a | Evidencia específica — Originalidad | Qué inventó/introdujo el beneficiario | `specificAchievements` |
| 4b | Evidencia específica — Significancia | Impacto posterior verificable de esa contribución | `specificAchievements` |
| 5 | Conexión regulatoria | Por qué esto satisface el criterio evaluado | A1 (criterios activos del caso) |
| 6 | Declaración de apoyo | Postura del firmante | — |
| 7 | Cierre | Firma, disponibilidad, contacto | Datos del firmante |

## Mecanismo de variación — generación en lote

Todas las cartas de un mismo caso se generan **en una sola pasada** (no una por una), para que el modelo tenga conciencia mutua entre ellas y pueda garantizar variación real.

**Capa 1 — Variación estructural.** Cada carta del lote recibe, en orden rotativo, uno de tres formatos de presentación:
- (a) narrativa continua sin encabezados de sección
- (b) secciones con encabezados en negrita, sin numerar
- (c) secciones numeradas con viñetas

Ninguna carta consecutiva del mismo lote puede compartir formato. Este formato se captura en el campo `presentationFormat` del contrato de salida (ver sección siguiente) y es responsabilidad del builder de `.docx` — no del modelo — renderizar los bloques ya generados según el formato asignado.

**Capa 2 — Variación de contenido.** Cada carta debe anclar su Bloque 4a en un hecho concreto y distinto (fecha, evento, cifra, institución) desde las primeras líneas del cuerpo. El modelo revisa los `specificAchievements` de todos los firmantes del lote antes de escribir — ningún hecho central puede repetirse entre cartas del mismo caso.

**Capa 3 — Variación de cierre.** El modelo revisa los cierres ya generados en el mismo lote antes de escribir el Bloque 6-7 de cada carta siguiente. Ninguna combinación de verbo-de-apoyo + estructura-de-disponibilidad puede repetirse (evita que todas las cartas terminen con la misma fórmula tipo "I strongly [urge/support/endorse]...").

## Contrato de salida estructurada

La llamada al modelo genera todas las cartas del lote en una sola respuesta, como un array donde cada carta expone sus bloques como claves independientes — no como un bloque de texto libre por carta. Esta decisión es deliberada: la Capa 1 del mecanismo de variación exige que el mismo contenido factual pueda renderizarse en tres formatos de presentación distintos según qué carta del lote sea. Si el modelo devolviera cada carta como prosa ya fusionada, el builder de `.docx` no podría reorganizar esos hechos en el formato correspondiente sin una segunda llamada al modelo. Con los bloques como claves separadas, la variación de Capa 1 se resuelve en el paso de renderizado, no en el de generación.

```json
{
  "letters": [
    {
      "letterId": "string — identificador estable de esta carta dentro del caso, p.ej. UUID o slug determinístico",
      "presentationFormat": "narrative | headed | numbered",
      "blocks": {
        "block1_header": "string",
        "block2_signerAuthority": "string",
        "block3_relationshipNature": "string",
        "block4a_originality": "string",
        "block4b_significance": "string",
        "block5_regulatoryConnection": "string",
        "block6_supportDeclaration": "string",
        "block7_closing": "string"
      }
    }
  ]
}
```

`letterId` no participa en la generación de contenido — es asignado por el sistema (no por el modelo) al momento de crear el registro de la carta, y se preserva estable a través de regeneraciones, siguiendo la misma convención establecida en `A3_ENGINE_INSTITUCIONAL.md` v1.3.

### Mapeo bloque → campo de entrada → clave de salida

| Bloque | Campo(s) de entrada | Clave de salida | Nota de generación |
|---|---|---|---|
| 1 — Encabezado/Asunto | Datos del caso (`Module1`: `fullName`, `visaType`) | `block1_header` | Fijo por caso, no varía entre firmantes del lote salvo el nombre del firmante mismo |
| 2 — Identidad y autoridad | `signerCredentials` | `block2_signerAuthority` | — |
| 3 — Naturaleza de la relación | `relationshipType`, `relationshipDuration` | `block3_relationshipNature` | — |
| 4a — Originalidad | `specificAchievements` | `block4a_originality` | Sujeto a Capa 2: el modelo debe verificar que el hecho ancla no se repita con `block4a_originality` de otras cartas del mismo lote |
| 4b — Significancia | `specificAchievements` | `block4b_significance` | Debe expresar impacto **posterior** verificable — no puede ser una repetición del mismo hecho de 4a sin el elemento temporal/downstream |
| 5 — Conexión regulatoria | Criterios activos del caso (A1) | `block5_regulatoryConnection` | Único bloque que consume salida de A1, no solo `intake_submissions` |
| 6 — Declaración de apoyo | — (generado) | `block6_supportDeclaration` | Sujeto a Capa 3: combinación verbo-de-apoyo no repetible entre cartas del lote |
| 7 — Cierre | Datos del firmante (`name`, `currentTitle`, `company`, `email`, `phone`) | `block7_closing` | Sujeto a Capa 3 igual que Bloque 6 — se generan como unidad en la práctica, aunque como claves separadas |

## Datos de entrada

**Del beneficiario** (`Module1`): `fullName`, `profession`, `industry`, `visaType`

**Por cada firmante** (`Module9.references[]`): `name`, `currentTitle`, `company`, `country`, `email`, `phone`, `relationshipType`, `relationshipDuration`, `signerCredentials`, `specificAchievements`

## Fuente de datos — decisión de arquitectura

A3 consume `intake_submissions` (datos crudos) como fuente primaria de hechos del beneficiario y del firmante — no la salida de `agent_intake_analysis` (A1). Investigado y confirmado: el `buildUserPrompt` de A1 no procesa Módulo 9 en detalle suficiente para este propósito — resume las referencias en frases genéricas para su propio análisis de fortaleza del caso, perdiendo las fechas, cifras y hechos concretos que este motor necesita. A1 tampoco lee Módulo 12, 14 ni 15.

**Precisión aplicada en 1.1:** esta regla general tiene una excepción acotada y explícita — el Bloque 5 (Conexión regulatoria) sí consume la determinación de criterios activos de A1, porque necesita saber a qué criterio regulatorio específico ancla cada carta. A1 se usa aquí únicamente para esa determinación de criterio, nunca como fuente de hechos del beneficiario o del firmante.

## Salida

Documento `.docx` limpio, sin membrete — el firmante lo revisa, imprime, firma manualmente, y se re-sube al portal del cliente. Idioma: inglés, salvo que el caso específico requiera español.

## Pendiente antes de implementación

1. ~~Confirmar con qué modelo/parámetros se ejecutará la llamada...~~ **Resuelto en esta revisión** — ver "Qué cambió respecto a 1.2".
2. Definir el builder de `.docx` que consume el contrato de salida estructurada de la sección anterior y aplica el renderizado correspondiente a cada `presentationFormat` (narrative/headed/numbered) — el contrato de datos ya quedó definido en esta revisión; falta la lógica de renderizado.
3. ~~Diseñar el mismo nivel de detalle de contrato de salida estructurada para el Motor Institucional y el Motor Abogado...~~ **Resuelto**: ambos motores tienen su contrato de salida definido (`A3_ENGINE_INSTITUCIONAL.md` v1.3, `A4_ENGINE_ABOGADO.md` v1.2).
