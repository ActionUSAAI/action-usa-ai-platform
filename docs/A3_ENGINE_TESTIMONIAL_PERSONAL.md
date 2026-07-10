# A3 — Motor Testimonial Personal (Máquina 2)

**Estado:** Diseño completo. No implementado.
**Versión:** 1.0
**Última actualización:** 2026-07-10

## Propósito

Este documento especifica el motor de generación de cartas testimoniales personales de A3 — el primero de los tres motores en ser diseñado por completo, siguiendo la taxonomía definida en `A3_LETTER_TAXONOMY.md`. Redacta cartas de recomendación en nombre de terceros (colegas, supervisores, clientes, mentores) que respaldan la petición de visa de un beneficiario.

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

Ninguna carta consecutiva del mismo lote puede compartir formato.

**Capa 2 — Variación de contenido.** Cada carta debe anclar su Bloque 4 en un hecho concreto y distinto (fecha, evento, cifra, institución) desde las primeras líneas del cuerpo. El modelo revisa los `specificAchievements` de todos los firmantes del lote antes de escribir — ningún hecho central puede repetirse entre cartas del mismo caso.

**Capa 3 — Variación de cierre.** El modelo revisa los cierres ya generados en el mismo lote antes de escribir el Bloque 6-7 de cada carta siguiente. Ninguna combinación de verbo-de-apoyo + estructura-de-disponibilidad puede repetirse (evita que todas las cartas terminen con la misma fórmula tipo "I strongly [urge/support/endorse]...").

## Datos de entrada

**Del beneficiario** (`Module1`): `fullName`, `profession`, `industry`, `visaType`

**Por cada firmante** (`Module9.references[]`): `name`, `currentTitle`, `company`, `country`, `email`, `phone`, `relationshipType`, `relationshipDuration`, `signerCredentials`, `specificAchievements`

## Fuente de datos — decisión de arquitectura

A3 consume `intake_submissions` (datos crudos), no la salida de `agent_intake_analysis` (A1). Investigado y confirmado: el `buildUserPrompt` de A1 no procesa Módulo 9 en detalle suficiente para este propósito — resume las referencias en frases genéricas para su propio análisis de fortaleza del caso, perdiendo las fechas, cifras y hechos concretos que este motor necesita. A1 tampoco lee Módulo 12, 14 ni 15.

## Salida

Documento `.docx` limpio, sin membrete — el firmante lo revisa, imprime, firma manualmente, y se re-sube al portal del cliente. Idioma: inglés, salvo que el caso específico requiera español.

## Pendiente antes de implementación

1. Confirmar con qué modelo/parámetros se ejecutará la llamada (referencia: A1 usa `claude-sonnet-4-6`, `max_tokens: 2048` — este motor probablemente necesita un límite de tokens mayor dado que genera múltiples cartas completas en una sola respuesta).
2. Definir el formato exacto de salida estructurada (JSON con array de cartas vs. generación directa a `.docx`) antes de implementar la ruta API.
3. Diseñar el mismo nivel de detalle para el Motor Institucional y el Motor Abogado, siguiendo este documento como plantilla de proceso.
