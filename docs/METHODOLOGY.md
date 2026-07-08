# AUCIS — Case-Building Methodology

**System:** Automated Case Intelligence System (AUCIS)  
**Owner:** ACTION USA AI LLC  
**Version:** 1.0  
**Date:** 2026-06-29  
**Classification:** Confidential — Proprietary Methodology

---

## 1. Overview

The AUCIS methodology translates a client's professional trajectory into a legally viable extraordinary ability petition by systematically mapping evidence to regulatory criteria, assessing institutional weight, and sequencing argument construction to maximize USCIS approval probability.

The methodology applies to four visa categories: **O-1A** (extraordinary ability in sciences, education, business, or athletics), **O-1B** (extraordinary ability in arts, motion picture, or television), **EB-1A** (alien of extraordinary ability — self-petition), and **EB-1B** (outstanding professor or researcher).

---

## 2. Criteria Framework

### O-1A / EB-1A Criteria (8 regulatory criteria)

USCIS requires evidence satisfying at least **3 of 8** criteria for O-1A, and either 3 of 10 criteria or evidence of a major international award for EB-1A.

| # | Criterion | Key evidence types |
|---|---|---|
| 1 | Awards and prizes | Certificates, press coverage of award, award committee documentation |
| 2 | Membership in associations requiring outstanding achievement | Membership letters, bylaws showing selection criteria |
| 3 | Published material about the beneficiary | Press articles, media coverage, citations |
| 4 | Judging the work of others | Invitation letters, panel documentation, review records |
| 5 | Original scientific, scholarly, or business contributions | Patents, citations, adoption by others, impact metrics |
| 6 | Scholarly articles | Published papers, book chapters, citation counts |
| 7 | Critical role in distinguished organizations | Org chart, employment letters, company recognition |
| 8 | High salary relative to peers | BLS comparison, salary evidence, contracts |

### O-1B Criteria (arts / entertainment)

For O-1B, evidence maps to: lead/starring roles, critical acclaim, high remuneration, commercial success, recognized organizations, press coverage, and industry awards.

### Criterion viability scoring

Each criterion is scored 0–100 based on:

- **Quantity:** Number of distinct pieces of evidence
- **Quality:** Institutional tier of the source (see Section 4)
- **Recency:** Evidence within the past 5 years weighted higher
- **Specificity:** Evidence directly naming the beneficiary in the qualifying role

A criterion scoring ≥ 60 is considered **viable** for inclusion. Criteria scoring 40–59 are **developable** — the Strategy Builder identifies what evidence could be obtained to elevate them. Criteria below 40 are **weak** and deprioritized unless they are the only available path.

---

## 3. Institutional Hierarchy in Evidence

The weight USCIS assigns to evidence is strongly correlated with the prestige of the issuing institution. AUCIS classifies all institutions and publications into three tiers.

### Tier 1 — High institutional authority

- Nobel Prize, Pulitzer, Oscar, Grammy, Fields Medal, and equivalent international prizes
- Nature, Science, The Lancet, NEJM, IEEE Transactions, ACM (top-5 journals per field)
- Fortune 500 companies, G20 government agencies, UN bodies
- Harvard, MIT, Stanford, Oxford, and equivalent QS top-50 universities
- National academies of science, medicine, and engineering

**Effect:** A single Tier 1 artifact can establish a criterion on its own.

### Tier 2 — Solid institutional authority

- National professional associations (IEEE, AMA, ABA, AIA, etc.)
- Top-25 universities by field
- Nationally circulated press (Wall Street Journal, BBC, Bloomberg, Variety)
- Regional government agencies, established industry conferences (ranked A/A*)
- Companies with >500 employees and documented industry recognition

**Effect:** Typically 2–3 Tier 2 artifacts are needed to establish a criterion.

### Tier 3 — Supporting evidence

- Local press, industry blogs, company-internal awards
- Small professional associations without documented selection criteria
- Startup companies, freelance clients
- Conference proceedings below A ranking

**Effect:** Tier 3 evidence supports but does not independently satisfy a criterion. Used to add depth and corroboration.

### Institutional tier in the petition narrative

The petition explicitly names the institution and its standing when introducing evidence. For Tier 1 and Tier 2 sources, a brief parenthetical context is provided ("Nature, one of the world's two most prestigious scientific journals…") to educate USCIS adjudicators who may not be familiar with field-specific prestige hierarchies.

---

## 4. Recommendation Letters as Primary Criterion Artifacts

Recommendation letters are the connective tissue of extraordinary ability petitions. Unlike passive evidence (certificates, articles), letters provide the interpretive layer that explains *why* the evidence demonstrates extraordinary ability.

### Letter architecture

Each letter is structured in four sections:

1. **Recommender authority** — Who the recommender is and why their opinion carries weight (their own credentials, institutional affiliation, recognition in the field)
2. **Relationship to beneficiary** — How the recommender knows the beneficiary and in what capacity they observed the work
3. **Criterion-specific narrative** — Specific description of the beneficiary's work or achievement that satisfies the targeted criterion, with concrete examples and metrics
4. **Expert conclusion** — The recommender's expert opinion that the beneficiary's contributions are at the top of the field

### Recommender selection strategy

The AUCIS methodology targets a minimum of **6 recommendation letters** per petition, distributed as:

- 2–3 letters from direct collaborators or supervisors (relationship depth)
- 2–3 letters from independent experts who know the beneficiary by reputation (third-party validation)
- 1 letter from a recognized industry leader at Tier 1 or Tier 2 institution (institutional authority)

Independent letters — from experts who have no financial or personal relationship with the beneficiary — carry disproportionate weight with USCIS because they establish that the beneficiary's reputation extends beyond their immediate network.

### Criterion coverage matrix

Before generating letters, AUCIS maps each recommended letter to the criteria it will support. No criterion should be supported by fewer than 2 letters. The matrix ensures:

- Every viable criterion has at least 2 independent letter supporters
- No single recommender is the sole support for more than 1 criterion
- The highest-scoring criteria receive letters from the highest-tier recommenders

---

## 5. BLS Salary Comparison Approach

The high salary criterion (Criterion 8 for O-1A/EB-1A) requires demonstrating that the beneficiary's remuneration is significantly above the average for similarly employed workers. AUCIS uses a three-anchor comparison approach.

### Anchor 1 — BLS national mean

The Bureau of Labor Statistics Occupational Employment and Wage Statistics (OEWS) survey provides the national mean annual wage and the 90th percentile for the beneficiary's occupation code. A salary above the **75th percentile** is considered a strong showing; above the **90th percentile** is considered exceptional.

### Anchor 2 — Origin country comparison

For beneficiaries who earned their salary primarily outside the United States, AUCIS also compares against the average salary for the equivalent occupation in the beneficiary's country of origin. This comparison is expressed in USD using the prevailing exchange rate at the time of peak earnings. Even modest US salaries can demonstrate high remuneration when compared to origin-country standards.

### Anchor 3 — Field-internal comparison

Where BLS occupation codes are broad (e.g., "Software Developers" covering a wide range), AUCIS supplements with field-specific salary surveys (Radford, Mercer, H-1B disclosure data) to narrow the comparison to the beneficiary's specific sub-specialty.

### Salary narrative output

The salary analysis produces a 2–3 paragraph narrative suitable for direct inclusion in the petition, plus a comparison table. The narrative explicitly states the percentage above the BLS mean and the 90th percentile, the evidence type (W-2, contract, offer letter), and the conclusion that the salary demonstrates extraordinary compensation.

---

## 6. Intake-to-Petition Workflow

### Stage 1 — Intake (client-facing)

The client completes a 14-step structured intake form covering identity, documents, immigration history, education, certifications, employment, businesses, references, evidence by criterion, strategic self-assessment, and optional services. The form uses auto-save (localStorage, 30-second interval) and allows file uploads per evidence item.

### Stage 2 — Intake Analysis (A1)

Upon form submission, the Intake Analyzer reads all 14 intake steps and produces:
- Criterion viability scores
- Recommended visa type with confidence
- Evidence gap report
- Strategy notes for staff review

### Stage 3 — Document Processing (A2)

All uploaded files are processed to extract text, classify document type, assign institutional tier, and flag translation needs. Output feeds into the evidence inventory used by the Petition Builder.

### Stage 4 — Salary Research (A6)

If the high salary criterion is viable (score ≥ 40), the Salary Research agent runs the BLS comparison and produces the salary narrative and comparison table.

### Stage 5 — Letter Strategy (A3)

The Letter Generator produces first drafts for all planned recommendation letters based on the criterion coverage matrix and the recommender information collected in Module 9 (references). Each letter goes through a staff approval cycle before finalization.

### Stage 6 — Petition Assembly (A4)

The Petition Builder assembles:
- Cover letter addressing the specific visa category requirements
- Per-criterion narrative sections (one per viable criterion)
- Evidence exhibit list with file references
- Completeness checklist

### Stage 7 — Staff Review and Submission

The supervising attorney reviews all generated content, makes edits in the dashboard, approves letters, and finalizes the petition. The submission workflow records the `submitted_at` timestamp and triggers client notifications via A8.

### Stage 8 — Post-Submission Monitoring (A7 + A8)

The Case Monitor tracks USCIS processing status, deadline dates (including premium processing windows), and any USCIS notices. The Client Concierge sends periodic status updates and deadline alerts to keep the client informed throughout the adjudication period.

### RFE Response Path

If USCIS issues an RFE, the workflow branches:
- A2 processes the RFE document
- A5 identifies USCIS concerns and generates a response strategy
- A3 produces additional or revised letters targeting the raised issues
- A4 assembles the RFE response petition
- The case re-enters Stage 7 for attorney review and submission

---

## 7. Differentiators

**Evidence-first approach:** The AUCIS system begins with what the client *has*, not what the attorney needs. The intake form's Module 10 uses a three-state selector (tengo / tal vez / no tengo) that captures actual evidence, aspirational evidence, and gaps simultaneously. The "no tengo" state triggers strategy prompts that identify what evidence *could* be built — turning the intake into both a data collection and case-development tool.

**Disposition tracking:** For criteria where a client currently lacks evidence, the system captures the client's disposition narrative (what they know about the field, what competitions or associations they are aware of) to inform a prospective strategy for evidence building before petition filing.

**Bilingual operation:** All client-facing communications, intake prompts, and concierge messages support Spanish and English. The core legal documents (petition, letters) are generated in English. This bilingual approach serves the primary market of Latin American extraordinary ability professionals.

**Institutional tier scoring:** By explicitly classifying and scoring the institutional weight of each piece of evidence, AUCIS produces petitions that front-load the strongest evidence and frame weaker evidence as corroborating rather than primary. This mirrors how experienced immigration attorneys approach USCIS adjudicators.

---

## 8. Control de Acceso al Intake

### Decisión de diseño: acceso solo por invitación

La versión inicial del intake form era públicamente accesible sin restricción. Esta arquitectura fue reemplazada por un sistema de invitación con token criptográfico por las siguientes razones:

- **Integridad de datos:** Impide que cualquier persona sin relación con ACTION USA AI inicie un expediente, evitando registros de clientes y casos huérfanos en la base de datos.
- **Trazabilidad:** Cada sesión de intake queda vinculada a un caso y cliente pre-creados, lo que permite al equipo conocer el estado exacto de cada cliente antes de que termine de completar el formulario.
- **Seguridad:** El token de 256 bits generado criptográficamente mediante `randomBytes(32)` no puede ser adivinado o forzado por fuerza bruta.

### Patrón de creación en dos fases

El sistema separa la creación del expediente de su llenado:

**Fase 1 — Creación del expediente (al enviar la invitación)**

El administrador genera la invitación desde el dashboard. En ese momento se crean:
- El registro de `clients` (con nombre, email y teléfono, sin `profile_id` aún)
- El registro de `cases` (con número de caso asignado por el trigger de la base de datos, estado `nuevo`)
- El registro de `intake_invitations` (con token, `case_id`, `client_id`, `expires_at = now + 14 días`, `status = pending`)

El `profile_id` del cliente se vincula posteriormente, cuando el cliente crea su cuenta durante o después de completar el intake (mediante el flujo de invitación de Supabase Auth).

**Fase 2 — Llenado del formulario (cuando el cliente accede con su token)**

El cliente sigue el enlace personal. El servidor valida el token y renderiza el formulario. El `case_id` y `client_id` se pasan como props al componente de formulario y se incluyen en el payload de envío, permitiendo reconciliar la sumisión con el expediente pre-creado.

### Transición de estado "opened"

Cuando el servidor valida un token por primera vez (estado `pending`), actualiza inmediatamente el registro a `status = 'opened', opened_at = now()` antes de renderizar el formulario. Esto permite al equipo de administración distinguir, en tiempo real, entre:

- **pending:** La invitación fue enviada pero el cliente aún no ha abierto el enlace.
- **opened:** El cliente ha accedido al formulario al menos una vez.
- **submitted:** El cliente completó y envió el formulario.

Esta visibilidad operativa permite al equipo hacer seguimiento proactivo sin necesidad de preguntar al cliente si "ya abrió el enlace".

### Patrón de email no fatal

Si el servicio de email (Resend) falla al momento de enviar la invitación, el sistema **no revierte** la creación del caso ni de la invitación. En cambio:

- La invitación queda en estado `pending` en la base de datos
- La API devuelve `email_warning` en la respuesta con el detalle del error
- El panel de invitaciones en la ficha del caso muestra el aviso al administrador
- El administrador puede reintentar el envío desde el panel (el botón "Reenviar invitación" genera y envía una nueva invitación referenciando el mismo caso)

Este patrón prioriza la integridad del registro sobre la entrega del email, evitando que un fallo transitorio de Resend obligue al administrador a recrear manualmente el expediente.

---

## 9. Metodología de Traducción Certificada (Agente A2)

AUCIS implements a proprietary certified translation pipeline that processes all non-English documents submitted through the intake form. The system produces Word documents (.docx) that meet USCIS-accepted certification standards without requiring a separate human translator per document.

### Tres categorías de documento y estrategia de traducción

**Categoría: structured** (documentos estructurados)

Aplica a: actas de nacimiento, diplomas, transcripciones académicas, contratos, licencias, certificados de premios, documentos gubernamentales.

Estrategia: extracción campo a campo con secciones etiquetadas. El documento generado sigue esta estructura:

1. Encabezado de marca ACTION USA AI (centrado, azul navy)
2. Título "SUMMARY TRANSLATION" (centrado, azul navy, 18pt)
3. Bloque de identificación: DOCUMENT / ISSUED BY / ISSUED TO / DATE
4. **Declaración del traductor #1** (después del bloque de identificación)
5. Secciones de contenido con encabezados en azul navy bold
6. **Declaración del traductor #2** insertada en el punto medio de las secciones de contenido
7. Continuación de secciones
8. **Declaración del traductor #3 + línea de firma** (Alexander Clavijo) al final

La triple declaración para documentos estructurados es una convención establecida en la práctica de traducción certificada para USCIS: identifica la responsabilidad del traductor en múltiples puntos del documento, acreditando cada sección individualmente.

**Categoría: article** (artículos y publicaciones)

Aplica a: artículos de prensa, comunicados de prensa, publicaciones académicas, blogs.

Estructura del .docx:
1. Encabezado de marca ACTION USA AI
2. Título "CERTIFIED TRANSLATION"
3. Bloque: TITLE / PUBLISHED BY / DATE / AUTHOR
4. Cuerpo traducido (párrafos preservados con salto de línea doble)
5. **Declaración del traductor + firma** (una sola vez al final)

**Categoría: letter** (cartas y opiniones)

Aplica a: cartas de recomendación, cartas de opinión consultiva, cartas de empleo, cartas de referencia.

Estructura del .docx:
1. Encabezado de marca ACTION USA AI
2. Título "CERTIFIED TRANSLATION"
3. Bloque: FROM / TO / DATE (con "Letter — [tipo]" como identificador)
4. Traducción literal completa: saludo, cuerpo completo, cierre y bloque de firma del remitente
5. **Declaración del traductor + firma** (una sola vez al final)

### Política de exclusión

Pasaportes y visas **nunca se traducen**. USCIS acepta estos documentos en su idioma original. La exclusión se aplica en la capa `extract-files.ts`, que clasifica los siguientes tipos como `isExcluded: true` antes de pasarlos al panel A2: pasaporte del beneficiario, visa americana, I-94, I-797, EAD, I-20, DS-2019, pasaporte del cónyuge, visa del cónyuge, I-94 del cónyuge, pasaportes de hijos, visa de hijos, identificación con foto del peticionario, pasaportes de acompañantes O-2.

### Texto de declaración del traductor (verbatim para todos los documentos)

> "I, Alexander Clavijo, hereby declare that I am competent to translate the [LANGUAGE] language into English and that the foregoing is a summary translation of the attached document."

El marcador `[LANGUAGE]` es reemplazado con el idioma detectado por Claude (`detected_language` del campo METADATA de la respuesta).

### Pipeline AI: clasificación y traducción en una sola llamada

El documento se envía directamente a `claude-sonnet-4-6` como contenido multimodal:
- PDFs: block `type: "document"` con `source.type: "base64"` (beta header `pdfs-2024-09-25`)
- Imágenes: block `type: "image"` con `source.type: "base64"`

Un único prompt de sistema instruye al modelo a:
1. **Clasificar primero** — detectar idioma, categoría (structured/article/letter), y metadatos (documento_title, issued_by, issued_to, document_date, needs_translation)
2. **Traducir segundo** — producir el contenido en el formato apropiado para la categoría detectada

Esta arquitectura de llamada única elimina inconsistencias entre clasificación y traducción al mantener ambas tareas en el mismo contexto de modelo, y reduce la latencia a la mitad respecto a un diseño de dos llamadas secuenciales.

---

## 10. Modelo de Peticionario en el Intake

### Decisión de diseño

AUCIS captura la información del peticionario directamente en el formulario de admisión del cliente (Módulo 12) en lugar de requerir una ronda adicional de recopilación por parte del equipo preparador. Esto:

- Elimina una iteración de comunicación entre el equipo y el cliente
- Permite al Agente A2 traducir documentos del peticionario junto con los del beneficiario en el mismo flujo
- Produce un I-129 más preciso al usar los datos tal como los conoce el cliente, con validación posterior del equipo

### Tres modelos de peticionario y sus requerimientos documentales

**Empresa estadounidense (`empresa`)**

El modelo más frecuente. Requisitos documentales capturados en el Módulo 12:
- **Artículos de incorporación** — establece que la entidad existe legalmente en EE.UU.
- **Carta EIN del IRS** — establece la identidad tributaria federal

USCIS verifica que la empresa tiene capacidad operativa para emplear al beneficiario. La carta EIN es el documento más directo para acreditar esta capacidad sin pasar por una auditoría financiera.

**Persona natural (`persona_natural`)**

Permite que un individuo patrocine directamente a un beneficiario (p. ej., propietario de rancho, empleador individual, cliente artístico). Requisitos documentales:
- **Identificación con foto vigente** — pasaporte o documento de identidad gubernamental (excluida de traducción)
- **Acta de nacimiento** — para establecer identidad del peticionario (traducible)

Precedente validado: caso Rodriguez Castro O-1A, peticionario Jay McLaughlin como persona natural. USCIS emitió RFE solicitando identificación con foto y acta de nacimiento del peticionario. Al suministrar ambos documentos, la petición fue aprobada. Este precedente motivó la captura explícita de estos documentos en Módulo 12.

**Agente autorizado (`agente`)**

Aplica cuando un agente o agencia actúa en nombre de múltiples empleadores — frecuente en entretenimiento, deportes y artes escénicas. Requiere:
- Tipo de acuerdo con el empleador (poder notarial, contrato de representación exclusiva)

En estos casos, el **itinerario de eventos es obligatorio** per 8 CFR (o)(2)(ii)(C): el agente debe demostrar su capacidad de supervisar las condiciones de empleo mediante la presentación de fechas, nombres de empleadores por evento, venues y ubicaciones geográficas. El array `itineraryItems` del Módulo 12 captura esta información directamente exportable al I-129 y al cover letter.

### Tres escenarios de opinión consultiva (Módulo 13)

**Escenario 1 — Existe asociación de pares reconocida por USCIS:**

La asociación emite una carta de opinión favorable (`opinion_favorable`) o de no objeción (`no_objecion`). La carta favorable apoya activamente la petición; la de no objeción declara que la asociación no objeta sin necesariamente respaldarla. La elección entre ambas depende de la estrategia del caso y la disposición de la asociación.

**Escenario 2 — No existe asociación formal pero hay experto disponible:**

USCIS acepta la carta de un experto reconocido del campo cuando no existe una asociación de pares formal o aplicable. El experto debe tener credenciales documentadas en el área de especialización del beneficiario. Los campos `alternativeContactName`, `alternativeContactOrg` y `alternativeContactRelation` capturan esta información para que el equipo coordine la solicitud de la carta.

**Escenario 3 — No existe asociación ni experto disponible:**

El peticionario debe presentar una justificación escrita explicando la ausencia de asociación de pares aplicable a la especialidad del beneficiario. El campo `noAssociationJustification` del Módulo 13 captura esta narrativa, que el equipo puede usar directamente en la petición sin reformulación.

---

## 11. Acompañantes O-2

### Base legal

8 CFR (o)(4) establece que los acompañantes O-2 deben ser personas que sean **parte integral** de la actuación o evento del beneficiario O-1 y que posean **habilidades críticas y experiencia** con el beneficiario que no sean de naturaleza general y que no puedan ser realizadas por trabajadores locales. Este es un estándar más estricto que el de los dependientes (O-3): no se trata de familia sino de colaboradores operativamente indispensables.

### Campo whyEssential como herramienta de argumentación

El campo `whyEssential` del Módulo 13 instruye al cliente a explicar en sus propias palabras:
- Por qué la persona es indispensable para la actividad específica planeada en EE.UU.
- Por qué no puede ser reemplazada por un trabajador estadounidense disponible localmente
- La naturaleza específica de las habilidades que la hacen única en el contexto de la actuación del O-1

Este texto, revisado y enriquecido por el equipo preparador, alimenta directamente la narrativa de la petición O-2 sin necesidad de una entrevista adicional con el cliente.

### Precedente validado

Caso Aldo Garibay (O-1B, cantante) + Fernando Higuera (O-2, músico de acompañamiento). La petición conjunta fue aprobada. La evidencia determinante fue la acreditación de la **relación laboral preexistente de larga data** (contratos de conciertos previos, cartas de empleador documentando años de trabajo conjunto). El campo `relationshipDuration` del Módulo 13 captura este dato explícitamente porque USCIS lo pondera para evaluar si el acompañante es verdaderamente integral a la actuación del O-1.

### Documentación requerida por acompañante

| Documento | Campo | Excluido de traducción |
|---|---|---|
| Pasaporte del acompañante | `passportPath` / `passportName` | Sí — USCIS acepta originales |
| Evidencia de relación laboral | `employmentEvidencePath` / `employmentEvidenceName` | No — traducible si no está en inglés |

La evidencia de relación laboral incluye contratos previos de conciertos o producciones, cartas de empleador que acreditan la relación, nóminas, o cualquier documento que establezca la duración y naturaleza de la colaboración.

---

## 12. Metodología de Extracción de Taxonomía desde Casos Aprobados

### Principio

El vocabulario de fortalezas, criterios y argumentos utilizados por AUCIS se deriva de un corpus de peticiones aprobadas por USCIS, no de interpretaciones teóricas de la normativa. Esto garantiza que el lenguaje generado refleja lo que USCIS ha aceptado en condiciones reales.

### Proceso

1. **Recopilación del corpus** — Peticiones aprobadas en múltiples especialidades (músicos, médicos, empresarios, científicos, atletas) y distintos niveles de elaboración del preparador.
2. **Extracción de patrones por criterio** — Para cada criterio USCIS: argumentos centrales aceptados, nivel de detalle evidentiary requerido, frases de umbral recurrentes, documentos corroborantes comunes.
3. **Hallazgo clave** — El peso probatorio que USCIS asigna correlaciona con el **cumplimiento del mínimo regulatorio**, no con la sofisticación del lenguaje. Una descripción factual y bien documentada de un logro que satisface el criterio supera consistentemente a una argumentación elaborada sobre un logro que no lo satisface. Este hallazgo informa la lógica de scoring de A1 y la construcción de narrativas de A4.
4. **Actualización continua** — La taxonomía se enriquece con cada caso aprobado procesado por AUCIS, incrementando la especificidad del corpus por especialidad.

### Aplicación

- **A1**: determina si la evidencia del cliente satisface el mínimo regulatorio antes de asignar puntuación de viabilidad.
- **A4**: estructura narrativas de criterio usando el lenguaje que USCIS ha aceptado en casos comparables.
- **A3**: incorpora los argumentos de umbral al brief de cada recomendante.

---

## 13. Metodología de Auditoría de Integridad de Datos

### Principio

Cada columna definida en el esquema debe tener un camino de escritura verificable en el código de API correspondiente. La ausencia de ese camino es un defecto silencioso: el sistema acepta datos del cliente y los descarta sin error.

### Procedimiento de verificación

Para cada tabla con escritura desde la aplicación:

1. `SELECT column_name FROM information_schema.columns WHERE table_name = '<tabla>' ORDER BY ordinal_position;`
2. Inspección del bloque INSERT/UPDATE en la ruta de API correspondiente.
3. Diferencia entre esquema y código: toda columna presente en el esquema pero ausente en el INSERT es candidata a defecto. Se verifica si la omisión es intencional (DEFAULT suficiente, columna calculada, columna de solo lectura) o defecto real.
4. Columnas intencionalmente omitidas se documentan. Defectos reales se corrigen con migración + fix de ruta.

### Caso de ejemplo: module14 y module15 (migración 007)

`Module14.tsx` y `Module15.tsx` fueron integrados al formulario de intake en commit `938c98b` (2026-07-01). Las columnas `module14` y `module15` no existían en `intake_submissions`, y el INSERT en `/api/intake/route.ts` no las incluía. Todos los datos de peticionario y opinión consultiva capturados en el formulario eran silenciosamente descartados.

Corrección: migración `007_add_module14_module15_columns.sql` (ADD COLUMN con tipo, constraint y DEFAULT idénticos a `module1`–`module12`) + adición de `module14: body.module14 ?? {}` y `module15: body.module15 ?? {}` al bloque INSERT.

El defecto fue detectado antes del inicio de operación real con clientes. Todos los registros existentes eran datos de prueba.

### Cuándo ejecutar

- Al agregar campos a un módulo de intake existente
- Al agregar una nueva tabla con escritura desde la aplicación
- Como ítem de pre-launch checklist antes de operación real con clientes
- Al agregar un nuevo agente con tabla de output propia
