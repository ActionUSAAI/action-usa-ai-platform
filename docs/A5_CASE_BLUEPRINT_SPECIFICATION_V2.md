# AUCIS — Case Blueprint Specification v2

**Estado:** Approved. Constituye la siguiente versión de este contrato. Reemplazará oficialmente a `A5_CASE_BLUEPRINT_SPECIFICATION_V1.md` únicamente cuando la transición documental quede completada conforme a `AUCIS_ARCHITECTURE_DOCUMENTATION_GOVERNANCE.md` — específicamente, cuando `AUCIS_BLUEPRINT_CONTRACT_V1.md` avance a v2 y `AUCIS_CONTRACT_CATALOG.md` quede actualizado. Hasta ese momento, v1 permanece Frozen.

Depende de `AUCIS_CORE_DOMAIN_MODEL.md` y `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md`.

**Propósito:** el Case Blueprint es el contrato estratégico que gobierna todo el expediente — la única fuente oficial de estrategia para el caso. Todos los motores posteriores (A3, A4) deben consumirlo sin reinterpretarlo.

---

## Summary of Changes from v1

**Removed** — cuatro campos salen del contrato porque esta versión alinea el Blueprint con responsabilidades ya definidas por ADR-008 (frontera Strategy/Execution), no porque ADR-008 introduzca una responsabilidad nueva:
- `petition_strategy_alignment`
- `document_directives`
- `generation_priorities`
- `attorney_instructions`

**Deferred** — tres campos permanecen en el contrato sin modificación, pero marcados como **Deferred — Pending Empirical Validation**:
- `review_notes`
- `evidence_priority`
- `strategic_priorities`

**Unchanged** — el resto del contrato permanece exactamente igual: toda la Sección A (Identidad y Gobernanza), `theory_of_case`, `primary_narrative`, `secondary_narrative`, `dominant_criteria`, `supporting_criteria`, `corroborative_criteria`, `foundational_evidence`, `evidence_dependencies`, `argument_sequence`, `cross_references`, `reinforcement_opportunities`, `missing_evidence_links`, la estructura completa de Reasoning Provenance, las Brechas Técnicas, y la Evaluación de Nivel de Abstracción.

### Migration Impact

Consumidores que hoy leen alguno de los cuatro campos removidos deben adaptarse de la siguiente forma:

| Campo removido | Adaptación requerida del consumidor |
|---|---|
| `petition_strategy_alignment` | El consumidor debe leer la elección `multiCriteria`/`singleAchievement` directamente de la fuente donde el abogado la capturó originalmente, no del Blueprint. |
| `document_directives` | Document Generation Layer (A3/A4) debe derivar sus propias directivas de generación a partir de `cross_references`, `foundational_evidence`, `dominant_criteria`, y `evidence_dependencies`, ya presentes en el contrato — no debe esperar recibirlas pre-traducidas. |
| `generation_priorities` | Workflow Orchestration Service, en coordinación con Document Generation Layer, determina el orden de generación observando estado operativo real (qué existe, qué falta) — no debe esperar esta señal del Blueprint. |
| `attorney_instructions` | El abogado adjunta instrucciones de override directamente al ejecutar A3/A4, como parámetro de esa ejecución — no como campo persistido en el Blueprint. |

Ningún consumidor actual de AUCIS depende en código de estos cuatro campos al momento de esta versión — esta sección documenta la adaptación requerida para implementaciones futuras que pudieran haberlos asumido.

---

## Normative Rules

Todo consumidor del Case Blueprint debe respetar, sin excepción:

1. **Consumir sin reinterpretar.** Ningún consumidor puede alterar, reinterpretar, o sustituir el contenido estratégico del Blueprint — solo ejecutarlo o mostrarlo.
2. **No inferir información inexistente.** Si un campo opcional no está presente, el consumidor no debe inventar ni asumir un valor — debe tratarlo como ausente.
3. **Preservar la semántica de los campos.** Un consumidor no puede usar un campo con un propósito distinto al definido en este contrato (ej. usar `evidence_dependencies` como si fuera `foundational_evidence`).
4. **No regenerar estrategia desde Criterion Assessment.** Ningún consumidor distinto de A5 puede volver a evaluar criterios o construir una estrategia alternativa a partir de `Criterion Assessment` — esa responsabilidad es exclusiva del Core Legal Engine.
5. **Respetar el estado del Blueprint.** Un Blueprint en `proposed` o `edited` no debe tratarse como fuente vigente para generación de documentos — solo `approved` o `locked` habilitan consumo por Document Generation Layer.
6. **No modificar campos diferidos como si estuvieran resueltos.** Los campos marcados **Deferred — Pending Empirical Validation** deben tratarse exactamente como cualquier otro campo del contrato en cuanto a lectura, pero ningún consumidor puede asumir su permanencia definitiva ni construir dependencias arquitectónicas nuevas sobre ellos.

## Contract Invariants

- Un Case Blueprint referencia exactamente un `Criterion Assessment` (`criterion_assessment_version_id`), nunca más de uno ni ninguno.
- Un Case Blueprint representa una única estrategia jurídica coherente — nunca dos teorías del caso alternativas dentro del mismo Blueprint.
- Las decisiones del Blueprint no pueden ser modificadas por ningún consumidor — solo por el abogado, a través de las transiciones de `status` ya definidas, o por una nueva ejecución de A5 que produzca una versión nueva.
- Todo campo con Provenance declarado debe llevar al menos un objeto `Reasoning Provenance` cuando el campo tiene contenido — no puede haber decisión sin fuente registrada.
- Un Blueprint en `locked` es inmutable en su contenido — cualquier cambio posterior requiere una versión nueva, nunca una edición del mismo registro.

---

## Principio rector

A1 mide. A5 decide. Ningún campo de este documento puede ser una re-evaluación de si un criterio está satisfecho — eso es exclusivamente responsabilidad de Criterion Assessment (A1). El Blueprint decide cómo se cuenta la historia con lo que A1 ya confirmó.

---

## Tipo transversal: Reasoning Provenance

Se adjunta a cada decisión estratégica del Blueprint que lo requiera. No es un campo aislado — es una estructura reutilizable.

| Atributo | Definición |
|---|---|
| `source_type` | `"case_evidence" \| "org_pattern" \| "global_pattern"`. Hoy siempre `"case_evidence"` — los otros dos valores quedan reservados para cuando exista la futura Knowledge Layer. |
| `influence_weight` | Número (0–1) — qué tan determinante fue esta fuente. Hoy siempre 1.0. |
| `explanation` | Texto — por qué esta fuente influyó de esta forma. |
| `reference_id` | ID de la entidad que respalda esto (ej. `evidence_item_id`). Puede ser null si la referencia es solo textual — ver Brecha Técnica #1. |

Una decisión puede tener múltiples objetos de este tipo (array) — varias fuentes pueden influir simultáneamente en la misma decisión.

**Nota de diseño futuro:** este campo existe para que el Blueprint nazca preparado para una futura Knowledge Layer (patrones aprendidos por firma, patrones globales anonimizados) sin necesitar modificar su estructura cuando esa capa se construya. A5, no el Blueprint, sería quien consulte esa capa — el Blueprint solo registra de dónde vino la influencia. Esta versión conserva el shape completo de Reasoning Provenance sin implementar ningún comportamiento de Knowledge Layer — permanece estructuralmente preparado, funcionalmente dormido, exactamente como en v1.

---

## Sección A — Identidad y Gobernanza

**Campo:** `blueprint_id`
**Definición:** Identificador único de esta versión específica.
**Tipo:** UUID
**Oblig.:** Sí
**Genera:** A5
**Modifica:** Nadie (inmutable)
**Consumen:** Todos

**Campo:** `case_id`
**Definición:** Caso al que pertenece.
**Tipo:** UUID (ref. Case)
**Oblig.:** Sí
**Genera:** A5
**Modifica:** Nadie
**Consumen:** Todos

**Campo:** `criterion_assessment_version_id`
**Definición:** Versión específica de Criterion Assessment que fundamenta este Blueprint — dependencia explícita que habilita la cascada de invalidación.
**Tipo:** UUID (ref.)
**Oblig.:** Sí
**Genera:** A5
**Modifica:** Nadie
**Consumen:** A5 (al regenerar), QA futuro

**Campo:** `status`
**Definición:** proposed → edited → approved → locked → superseded.
**Tipo:** Enum
**Oblig.:** Sí
**Genera:** A5 (crea en proposed)
**Modifica:** Abogado (transiciones)
**Consumen:** Todos

**Campo:** `approved_by` / `approved_at`
**Definición:** Quién y cuándo aprobó.
**Tipo:** ref. User / timestamp
**Oblig.:** Condicional
**Genera:** —
**Modifica:** Abogado
**Consumen:** QA futuro, auditoría

---

## Sección B — Información Estratégica

**Campo:** `theory_of_case`
**Definición:** Tesis jurídica central en 1-2 frases.
**Objetivo:** Ancla todo lo demás — cada otro campo debe ser trazable a esto.
**Tipo:** Texto
**Oblig.:** Sí
**Provenance:** Sí — array

**Campo:** `primary_narrative`
**Definición:** Historia que conecta los criterios dominantes.
**Objetivo:** Da forma narrativa a la evidencia, evita criterios aislados.
**Tipo:** Texto
**Oblig.:** Sí
**Provenance:** Sí — array

**Campo:** `secondary_narrative`
**Definición:** Hilos de apoyo, si existen.
**Objetivo:** Complementa sin competir con la narrativa principal.
**Tipo:** Texto | null
**Oblig.:** No
**Provenance:** Sí — array

---

## Sección C — Información Probatoria

**Campo:** `dominant_criteria`
**Definición:** Criterios que son el núcleo del caso.
**Objetivo:** Prioriza dónde se invierte el mayor desarrollo argumental.
**Tipo:** Array de criterion_key
**Oblig.:** Sí
**Provenance:** Sí — por criterio

**Campo:** `supporting_criteria`
**Definición:** Criterios de refuerzo.
**Tipo:** Array de criterion_key
**Oblig.:** Sí (puede ser vacío)
**Provenance:** Sí — por criterio

**Campo:** `corroborative_criteria`
**Definición:** Criterios que solo corroboran a otros.
**Tipo:** Array de criterion_key
**Oblig.:** Sí (puede ser vacío)
**Provenance:** Sí — por criterio

**Campo:** `foundational_evidence`
**Definición:** La pieza (o pocas piezas) de evidencia sobre la que descansa la teoría completa del caso.
**Objetivo:** Ancla narrativa.
**Tipo:** Array de `{ evidence_item_id | description, why_foundational }`
**Oblig.:** Sí
**Provenance:** Sí

**Campo:** `evidence_dependencies`
**Definición:** Qué evidencia específica respalda cada criterio.
**Objetivo:** Cierra el gap original documentado en `A4_ATTORNEY_EVIDENCE_GAP.md` — contenido real, no solo cita+label.
**Tipo:** Map criterion_key → array de `{ evidence_item_id | description }`
**Oblig.:** Sí
**Provenance:** Sí — por entrada

**Campo:** `evidence_priority` — **Deferred — Pending Empirical Validation** (ver Nota de Diferimiento)
**Definición:** Dentro de cada criterio, orden de importancia de la evidencia disponible.
**Objetivo:** Distingue "lo mejor" de "lo disponible" cuando hay múltiples piezas.
**Tipo:** Map criterion_key → array ordenado de evidence refs
**Oblig.:** No (solo si hay >1 evidencia por criterio)
**Provenance:** Sí

---

## Sección D — Información Argumentativa

**Campo:** `argument_sequence`
**Definición:** Secuencia lógica de argumentos — NO capítulos de documento.
**Objetivo:** Da orden de razonamiento a A4, sin imponerle estructura documental.
**Tipo:** Array ordenado de strings
**Oblig.:** Sí
**Provenance:** Sí

**Campo:** `cross_references`
**Definición:** Conexiones narrativas explícitas entre criterios.
**Objetivo:** Comportamiento validado como el más valioso de A5 en pruebas reales.
**Tipo:** Array de `{ criteria: [key, key], connection: string }`
**Oblig.:** Sí (puede ser vacío)
**Provenance:** Sí — por conexión

**Campo:** `strategic_priorities` — **Deferred — Pending Empirical Validation** (ver Nota de Diferimiento)
**Definición:** Dónde concentrar el mayor esfuerzo argumental, más allá de la clasificación de tres niveles.
**Objetivo:** Matiza dominant/supporting/corroborative con intención táctica del caso.
**Tipo:** Array de strings
**Oblig.:** No
**Provenance:** Sí

**Campo:** `reinforcement_opportunities`
**Definición:** Evidencia adicional que fortalecería el caso.
**Objetivo:** Guía al abogado sobre qué pedirle al cliente.
**Tipo:** Array de strings
**Oblig.:** No
**Provenance:** Sí

**Campo:** `missing_evidence_links`
**Definición:** Vacíos probatorios que afectan la estrategia actual. Explícitamente NO predicción de RFE — reservado para el futuro RFE Prediction Engine.
**Objetivo:** Fortalecer antes de que exista un RFE.
**Tipo:** Array de strings
**Oblig.:** No
**Provenance:** Sí

---

## Sección E — Información Operativa (Directrices)

**Campo:** `review_notes` — **Deferred — Pending Empirical Validation** (ver Nota de Diferimiento)
**Definición:** Notas del abogado durante revisión.
**Objetivo:** Espacio explícito para contexto humano que no encaja en otro campo.
**Tipo:** Texto
**Oblig.:** No

---

## Campos removidos en v2, y por qué

Esta versión alinea el contrato con responsabilidades ya definidas por ADR-008 — no introduce una decisión arquitectónica nueva.

| Campo removido | Vivía en (v1) | Por qué salió |
|---|---|---|
| `petition_strategy_alignment` | Sección B | Refleja una elección ya capturada en otro punto del dominio (elección del abogado entre `multiCriteria`/`singleAchievement`). El propio v1 ya lo documentaba como "reflejo, no decisión de A5" — nunca fue producto del Core Legal Engine. |
| `document_directives` | Sección E | Traducción de decisiones ya contenidas en `cross_references`/`foundational_evidence`/`evidence_dependencies` hacia instrucciones por tipo de documento — responsabilidad ya asignada a Document Generation Layer por ADR-008. |
| `generation_priorities` | Sección E | Depende de estado operativo (qué documentos ya existen) inexistente al momento en que A5 construye el Blueprint — no es estrategia jurídica congelable en un snapshot. |
| `attorney_instructions` | Sección E | Destino operacional explícito hacia A3/A4 ("override el comportamiento por defecto") — mismo criterio ya aplicado por ADR-008 a `attorney_letter_outline`. |

## Campos explícitamente EXCLUIDOS del Blueprint

| Campo descartado | Por qué no pertenece a A5 |
|---|---|
| `attorney_letter_outline` (capítulos de documento) | A5 no genera documentos ni su estructura — eso es responsabilidad de A4. A5 entrega `argument_sequence`; A4 decide cómo convertirla en capítulos. |
| `recommended_exhibit_order` (numeración/índice literal) | Organización documental — trabajo de A4/`assembleExhibits`, no de A5. |
| `recommended_document_order` | Depende de estado operativo, no de estrategia jurídica — mismo argumento que `generation_priorities`. |
| Predicción de riesgo de RFE / preocupaciones de USCIS | Reservado para el futuro RFE Prediction Engine, que además solo tiene sentido aplicarse después de que el expediente pase por el futuro Quality Assurance Engine. A5 razona desde la perspectiva del abogado que arma el caso, no desde la del oficial que lo revisa. |
| Reglas de voz genéricas (ej. "nunca citar reglamentos en boca del testigo") | Ya viven fijas en el prompt de cada motor (A3 Testimonial, Institucional). |

## Nota de Diferimiento — Deferred Fields

`review_notes`, `evidence_priority`, y `strategic_priorities` permanecen en este contrato, sin modificación de su definición o tipo, clasificados como **Deferred — Pending Empirical Validation** (Blueprint Field Audit, 2026-08-02).

Esta clasificación significa explícitamente:

- **No quedan aprobados definitivamente.** Su permanencia en este contrato no constituye una decisión de que pertenezcan al Blueprint a largo plazo.
- **Permanecen congelados únicamente por ausencia de evidencia empírica suficiente** para decidir, en cualquier sentido, si deben eliminarse, trasladarse a otro componente, o confirmarse como parte definitiva del contrato.
- **Cualquier modificación futura de estos tres campos requiere evidencia operacional nueva** — implementación real, uso en producción, o comportamiento verificable — nunca razonamiento arquitectónico adicional sin esa evidencia.

---

## Brechas técnicas conocidas (honestas, no resueltas en esta especificación)

**Brecha #1** — Evidence Item no existe todavía como entidad tipada. Hasta que se implemente (ver `AUCIS_CORE_DOMAIN_MODEL.md`), los campos que referencian `evidence_item_id` usarán `description` (texto en prosa) en lugar de una referencia estable real. El Blueprint queda estructuralmente preparado para IDs reales, pero funciona hoy con descripciones — consistente con no bloquear el trabajo actual hasta que el Core Domain Model completo esté implementado.

**Brecha #2** — Reasoning Provenance con `source_type` fijo en `"case_evidence"` hoy. Es un campo "dormido" hasta que exista la Knowledge Layer — la decisión correcta es no implementar de más antes de tiempo, pero vale la pena que quede explícito que hoy no aporta funcionalidad real, solo preparación estructural.

**Brecha #3** — No existe mecanismo técnico que impida que A3/A4 ignoren `argument_sequence` o cualquier otro campo de este contrato. La "obligatoriedad" mencionada en los principios arquitectónicos es, hoy, una instrucción de prompt fuerte — no una garantía técnica verificable. Esa garantía real sería trabajo del futuro Quality Assurance Engine (verificar que los documentos generados efectivamente siguieron el Blueprint), no de A5 ni del Blueprint mismo.

---

## Evaluación de nivel de abstracción (para servir como contrato estable multi-categoría)

Lo que funciona bien para durabilidad multi-categoría migratoria:

- Todo referencia `criterion_key` genérico, ya funcional para O-1A, O-1B, y EB-1A (confirmado contra `canonical-criteria.ts`).
- `argument_sequence` es texto libre ordenado, no una plantilla de capítulos fija — no asume la lógica argumental específica de "extraordinary ability".
- La remoción de `document_directives` y `generation_priorities` en esta versión refuerza, no debilita, esta durabilidad — ambos campos dependían de estructura documental y estado operativo específicos de la implementación actual, exactamente el tipo de acoplamiento que compromete la estabilidad de un contrato multi-categoría a largo plazo.

**Conclusión:** el nivel de abstracción es correcto para servir de contrato estable durante mucho tiempo — el diseño no requeriría romperse para incorporar QA Engine, RFE Engine, o Knowledge Layer. Su funcionamiento pleno (no solo su estructura) depende de que la Brecha #1 se cierre eventualmente.

---

## Verification Checklist

✓ Consistencia documental — el documento es autocontenido, no requiere consultar v1 para entenderse.
✓ Consistencia terminológica — vocabulario idéntico al usado en v1 y en los contratos ya congelados (`criterion_key`, `Reasoning Provenance`, etc.), sin términos nuevos introducidos.
✓ Consistencia con contratos existentes — ninguna referencia a `AUCIS_BLUEPRINT_CONTRACT_V1.md`, `ADR-008`, o `ADR-010` contradice su contenido ya congelado.
✓ Ausencia de contradicciones — los cuatro campos removidos no aparecen mencionados como vigentes en ninguna sección; los tres diferidos mantienen su etiqueta de forma consistente en cada aparición.
✓ Ausencia de referencias obsoletas — no quedan menciones a `attorney_letter_outline`, `recommended_exhibit_order`, ni `recommended_document_order` como campos activos del Blueprint.
✓ Cumplimiento de Governance — v1 no fue marcado `Superseded` (permanece `Frozen` hasta completar la transición completa); ningún ADR nuevo fue creado; la jerarquía documental (`AUCIS_ARCHITECTURE_DOCUMENTATION_GOVERNANCE.md`) fue respetada en cada decisión de este documento.

No se encontró ninguna contradicción arquitectónica que obligue a cambiar una decisión previamente aprobada.

---

## Version History

- **v1** — Especificación inicial del Case Blueprint. Reemplazó el diseño previo de "pesos porcentuales simples".
- **v2** — Resultado del Blueprint Field Audit (2026-08-02): remoción de cuatro campos (`petition_strategy_alignment`, `document_directives`, `generation_priorities`, `attorney_instructions`) por alineación con responsabilidades ya definidas en ADR-008; diferimiento de tres campos (`review_notes`, `evidence_priority`, `strategic_priorities`) como Deferred — Pending Empirical Validation; conservación completa de la estructura de Reasoning Provenance como preparación estructural para la futura Knowledge Layer, sin implementar comportamiento nuevo.
