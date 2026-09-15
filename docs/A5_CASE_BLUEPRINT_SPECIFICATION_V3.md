# AUCIS — Case Blueprint Specification v3

**Estado:** Approved. Constituye la siguiente versión de este contrato. Reemplazará oficialmente a `A5_CASE_BLUEPRINT_SPECIFICATION_V2.md` únicamente cuando la transición documental quede completada conforme a `AUCIS_ARCHITECTURE_DOCUMENTATION_GOVERNANCE.md` — específicamente, cuando `AUCIS_BLUEPRINT_CONTRACT_V1.md` avance a v3 y `AUCIS_CONTRACT_CATALOG.md` quede actualizado. Hasta ese momento, v2 permanece Frozen.

Depende de `AUCIS_CORE_DOMAIN_MODEL.md` y `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md`. Sourced a `docs/MTCS-06_FINAL_EXACT_DESIGN.md` (Part X — Blueprint Contract Amendment; Design MR: PASS).

**Propósito:** el Case Blueprint es el contrato estratégico que gobierna todo el expediente — la única fuente oficial de estrategia para el caso. Todos los motores posteriores (A3, A4) deben consumirlo sin reinterpretarlo.

---

## Summary of Changes from v2

Esta versión es el "field-scope correction, not a re-architecture" ya anticipado por el precedente de supersesión v1→v2 de este mismo contrato — materializa MTCS-06.3/Part X, no reabre ninguna otra decisión de v2.

**Amended (narrow, additive) — `foundational_evidence` only.** Cada elemento gana cinco atributos opcionales de Historical Reliance, aplicables cuando el elemento usa `evidence_item_id` (no cuando usa el fallback `description`):
- `probative_revision_at_reliance?`
- `fact_at_reliance?`
- `documentary_condition_at_reliance?`
- `verification_condition_at_reliance?`
- `document_ids_at_reliance?`

**Added (new, sibling field) — `evidence_dependencies_reliance`.** Corrección de rumbo hallada durante la implementación de MTCS-06.3, registrada aquí explícitamente (no una ficción retroactiva): el diseño congelado (Part X) asumía que `evidence_dependencies` ya tenía el shape `Map criterion_key → array de { evidence_item_id | description }`. La inspección del runtime real (`a5-case-strategy/route.ts`, tanto el tipo `A5Response` como el schema JSON del prompt de Claude) estableció que el shape real es `Record<criterion_key, string[]>` — strings narrativos planos — consumidos directamente para texto real de cartas legales por `a3-testimonial-letters/route.ts`, `a3-institutional-letters/route.ts`, `a4-attorney-letters/route.ts`, y renderizados así por `blueprint-lifecycle-section.tsx`. Convertir cada string en un objeto, tal como el shape literal de Part X lo habría requerido, habría roto los cuatro. Decisión de implementación (posterior al freeze de Part X, no una de las DD-06-01 a DD-06-07): **`evidence_dependencies` permanece exactamente `Record<criterion_key, string[]>`, sin modificación** — y un nuevo campo hermano, `evidence_dependencies_reliance` (ver Sección C más abajo), lleva los mismos cinco atributos de Historical Reliance, indexado 1:1 con `evidence_dependencies[criterion_key]` (posición `i` de `evidence_dependencies_reliance[criterion_key]` describe la posición `i` de `evidence_dependencies[criterion_key]`, o es `null` cuando esa entrada es texto narrativo libre sin una Evidencia tipificada identificada).

**Unchanged** — todo lo demás permanece exactamente igual que en v2: el significado de `foundational_evidence` (la evidencia sobre la que descansa la teoría del caso) y de `evidence_dependencies` (dependencia por criterio, shape string[] incluido) no cambia; el alcance por versión de Blueprint no cambia; el fallback de texto libre `description` (Brecha #1) permanece válido sin modificación; toda la Sección A (Identidad y Gobernanza), `theory_of_case`, `primary_narrative`, `secondary_narrative`, `dominant_criteria`, `supporting_criteria`, `corroborative_criteria`, `argument_sequence`, `cross_references`, `reinforcement_opportunities`, `missing_evidence_links`, la estructura completa de Reasoning Provenance, los campos Deferred, los campos removidos en v2, y la Evaluación de Nivel de Abstracción — todos idénticos a v2.

**Same-case integrity:** per Part IX del diseño fuente, esta relación sigue siendo APP-VALIDATED (no DB-authoritative) — ni `foundational_evidence` ni el nuevo `evidence_dependencies_reliance` ganan una superficie relacional de FK propia. Esto queda explícitamente revelado, no compensado por un segundo mecanismo paralelo DB-enforced (DD-06-05 prohíbe un subsistema paralelo de Historical Reliance en A5).

**Persistencia atómica:** los valores de Historical Reliance (en `foundational_evidence` y en `evidence_dependencies_reliance`) se escriben en la misma fila, dentro del mismo INSERT que produce la fila de `case_strategy` — ningún mecanismo de persistencia adicional o separado.

### Migration Impact

Ningún consumidor existente de `foundational_evidence`/`evidence_dependencies` se rompe: `evidence_dependencies` no cambió de shape en absoluto (cero riesgo de ruptura por definición); `foundational_evidence` gana cinco atributos opcionales y aditivos, y `evidence_dependencies_reliance` es un campo enteramente nuevo — un consumidor que ignora campos desconocidos sigue funcionando exactamente como antes. Ningún consumidor actual de AUCIS depende en código de `foundational_evidence`'s cinco campos nuevos ni de `evidence_dependencies_reliance` al momento de esta versión.

---

## Normative Rules

Todo consumidor del Case Blueprint debe respetar, sin excepción:

1. **Consumir sin reinterpretar.** Ningún consumidor puede alterar, reinterpretar, o sustituir el contenido estratégico del Blueprint — solo ejecutarlo o mostrarlo.
2. **No inferir información inexistente.** Si un campo opcional no está presente, el consumidor no debe inventar ni asumir un valor — debe tratarlo como ausente.
3. **Preservar la semántica de los campos.** Un consumidor no puede usar un campo con un propósito distinto al definido en este contrato (ej. usar `evidence_dependencies` como si fuera `foundational_evidence`).
4. **No regenerar estrategia desde Criterion Assessment.** Ningún consumidor distinto de A5 puede volver a evaluar criterios o construir una estrategia alternativa a partir de `Criterion Assessment` — esa responsabilidad es exclusiva del Core Legal Engine.
5. **Respetar el estado del Blueprint.** Un Blueprint en `proposed` o `edited` no debe tratarse como fuente vigente para generación de documentos — solo `approved` o `locked` habilitan consumo por Document Generation Layer.
6. **No modificar campos diferidos como si estuvieran resueltos.** Los campos marcados **Deferred — Pending Empirical Validation** deben tratarse exactamente como cualquier otro campo del contrato en cuanto a lectura, pero ningún consumidor puede asumir su permanencia definitiva ni construir dependencias arquitectónicas nuevas sobre ellos.
7. **No reescribir Historical Reliance.** Los cinco atributos `*_at_reliance`/`document_ids_at_reliance` de `foundational_evidence`, y las entradas de `evidence_dependencies_reliance`, una vez persistidos en una versión de Blueprint, no pueden modificarse — solo una nueva versión de Blueprint (nueva ejecución de A5) puede producir un nuevo conjunto de Historical Reliance. Cambios posteriores en `evidence_items`/`evidence_item_documents` no alteran estos valores retroactivamente (MTCS-06 Part VII — Race-Integrity Rule; MTCS-06.4 — Narrow Historical Reliance Mutation Guard).

## Contract Invariants

- Un Case Blueprint referencia exactamente un `Criterion Assessment` (`criterion_assessment_version_id`), nunca más de uno ni ninguno.
- Un Case Blueprint representa una única estrategia jurídica coherente — nunca dos teorías del caso alternativas dentro del mismo Blueprint.
- Las decisiones del Blueprint no pueden ser modificadas por ningún consumidor — solo por el abogado, a través de las transiciones de `status` ya definidas, o por una nueva ejecución de A5 que produzca una versión nueva.
- Todo campo con Provenance declarado debe llevar al menos un objeto `Reasoning Provenance` cuando el campo tiene contenido — no puede haber decisión sin fuente registrada.
- Un Blueprint en `locked` es inmutable en su contenido — cualquier cambio posterior requiere una versión nueva, nunca una edición del mismo registro.
- Los atributos de Historical Reliance de un elemento de `foundational_evidence`, y las entradas de `evidence_dependencies_reliance`, son inmutables una vez persistidos (ver Regla 7 arriba).

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

**Nota de diseño futuro:** este campo existe para que el Blueprint nazca preparado para una futura Knowledge Layer (patrones aprendidos por firma, patrones globales anonimizados) sin necesitar modificar su estructura cuando esa capa se construya. A5, no el Blueprint, sería quien consulte esa capa — el Blueprint solo registra de dónde vino la influencia. Esta versión conserva el shape completo de Reasoning Provenance sin implementar ningún comportamiento de Knowledge Layer — permanece estructuralmente preparado, funcionalmente dormido, exactamente como en v1/v2. Reasoning Provenance es un mecanismo distinto de Historical Reliance (esta versión) — Provenance explica *por qué* una fuente influyó una decisión; Historical Reliance preserva *qué estado exacto* de Evidence fue leído. No se fusionan.

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
**Tipo:** Array de `{ evidence_item_id | description, why_foundational, probative_revision_at_reliance?, fact_at_reliance?, documentary_condition_at_reliance?, verification_condition_at_reliance?, document_ids_at_reliance? }`
**Oblig.:** Sí
**Provenance:** Sí
**Historical Reliance (MTCS-06, v3):** los cinco atributos `*_at_reliance`/`document_ids_at_reliance` aplican únicamente cuando el elemento usa `evidence_item_id` (no con el fallback `description`), se capturan una sola vez en el Reliance Input Snapshot Moment (misma lectura de Evidence usada para construir el razonamiento de A5), y son inmutables tras persistirse.

**Campo:** `evidence_dependencies`
**Definición:** Qué evidencia específica respalda cada criterio.
**Objetivo:** Cierra el gap original documentado en `A4_ATTORNEY_EVIDENCE_GAP.md` — contenido real, no solo cita+label.
**Tipo:** Map criterion_key → array de string (texto narrativo libre) — **sin cambio respecto a v2**, ver Summary of Changes.
**Oblig.:** Sí
**Provenance:** Sí — por entrada
**Historical Reliance (MTCS-06, v3):** NO aplica directamente a este campo — ver `evidence_dependencies_reliance` (campo nuevo, inmediatamente abajo) para la provenance indexada equivalente a la de `foundational_evidence`.

**Campo:** `evidence_dependencies_reliance` — **nuevo en v3**
**Definición:** Historical Reliance para `evidence_dependencies`, en un campo hermano en vez de embebida en cada string — ver Summary of Changes for la razón (shape real de `evidence_dependencies` en runtime = `string[]`, no objetos).
**Objetivo:** Cumple el mismo requisito de Part X (preservar exactamente qué Evidencia tipificada, en qué estado, respaldó cada dependencia) sin alterar `evidence_dependencies` y sin romper sus cuatro consumidores existentes (`a3-testimonial-letters`, `a3-institutional-letters`, `a4-attorney-letters`, `blueprint-lifecycle-section.tsx`).
**Tipo:** Map criterion_key → array de `{ evidence_item_id, probative_revision_at_reliance, fact_at_reliance, documentary_condition_at_reliance, verification_condition_at_reliance, document_ids_at_reliance } | null`, indexado 1:1 por posición con `evidence_dependencies[ese criterion_key]`. `null` en la posición `i` significa que `evidence_dependencies[criterion_key][i]` es texto narrativo libre sin una Evidencia tipificada específica identificada — nunca se infiere ni se rellena.
**Oblig.:** Sí (el Map en sí; sus entradas individuales pueden ser todas `null`)
**Provenance:** No aplica (esto ES la provenance de `evidence_dependencies`, no un campo que a su vez requiera su propio Reasoning Provenance)
**Historical Reliance (MTCS-06, v3):** capturado una sola vez en el Reliance Input Snapshot Moment (misma lectura de Evidence usada para `foundational_evidence` y para construir el razonamiento de A5), e inmutable tras persistirse — mismas reglas que `foundational_evidence`.

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

(Sin cambios respecto a v2 — v3 no remueve, renombra, ni reinterpreta ningún campo.)

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

**Brecha #1** — Evidence Item ya existe como entidad tipada (`evidence_items`, MTCS-01/03/04), pero A5 la consume de forma **APP-VALIDADA, no DB-authoritative** (Part IX del diseño fuente) — a diferencia de A1 Historical Reliance, que sí es DB-authoritative (MTCS-06.2). El fallback `description` (texto en prosa) permanece válido sin modificación para contenido que antecede a la Evidence tipada o cuando el abogado prefiere no vincular un `evidence_item_id` específico. Esta versión no cierra la brecha de forma general — solo habilita, de forma aditiva y opcional, que un elemento con `evidence_item_id` cargue también su estado-al-momento-de-confianza.

**Brecha #2** — Reasoning Provenance con `source_type` fijo en `"case_evidence"` hoy. Es un campo "dormido" hasta que exista la Knowledge Layer — la decisión correcta es no implementar de más antes de tiempo, pero vale la pena que quede explícito que hoy no aporta funcionalidad real, solo preparación estructural.

**Brecha #3** — No existe mecanismo técnico que impida que A3/A4 ignoren `argument_sequence` o cualquier otro campo de este contrato. La "obligatoriedad" mencionada en los principios arquitectónicos es, hoy, una instrucción de prompt fuerte — no una garantía técnica verificable. Esa garantía real sería trabajo del futuro Quality Assurance Engine (verificar que los documentos generados efectivamente siguieron el Blueprint), no de A5 ni del Blueprint mismo.

---

## Evaluación de nivel de abstracción (para servir como contrato estable multi-categoría)

Lo que funciona bien para durabilidad multi-categoría migratoria:

- Todo referencia `criterion_key` genérico, ya funcional para O-1A, O-1B, y EB-1A (confirmado contra `canonical-criteria.ts`).
- `argument_sequence` es texto libre ordenado, no una plantilla de capítulos fija — no asume la lógica argumental específica de "extraordinary ability".
- La remoción de `document_directives` y `generation_priorities` en v2 refuerza, no debilita, esta durabilidad — ambos campos dependían de estructura documental y estado operativo específicos de la implementación actual, exactamente el tipo de acoplamiento que compromete la estabilidad de un contrato multi-categoría a largo plazo.
- Los cinco atributos de Historical Reliance añadidos en v3 son opcionales, aditivos, y no dependen de ninguna estructura documental específica — no comprometen esta durabilidad.

**Conclusión:** el nivel de abstracción es correcto para servir de contrato estable durante mucho tiempo — el diseño no requeriría romperse para incorporar QA Engine, RFE Engine, o Knowledge Layer. Su funcionamiento pleno (no solo su estructura) depende de que la Brecha #1 se cierre eventualmente para A5 de forma DB-authoritative — decisión explícitamente fuera de alcance de MTCS-06 (DD-06-05).

---

## Verification Checklist

✓ Consistencia documental — el documento es autocontenido, no requiere consultar v2 para entenderse.
✓ Consistencia terminológica — vocabulario idéntico al usado en v2 y en los contratos ya congelados (`criterion_key`, `Reasoning Provenance`, `evidence_item_id`, etc.), sin términos nuevos introducidos fuera de los cinco atributos de Historical Reliance ya definidos por `docs/MTCS-06_FINAL_EXACT_DESIGN.md`.
✓ Consistencia con contratos existentes — ninguna referencia a `AUCIS_BLUEPRINT_CONTRACT_V1.md`, `ADR-008`, `ADR-010`, o `ADR-011` contradice su contenido ya congelado.
✓ Ausencia de contradicciones — el shape amendment sigue exactamente Part X del diseño fuente; ningún campo de v2 fue removido, renombrado, o reinterpretado.
✓ Ausencia de referencias obsoletas — no quedan menciones a `attorney_letter_outline`, `recommended_exhibit_order`, ni `recommended_document_order` como campos activos del Blueprint.
✓ Cumplimiento de Governance — v2 no fue marcado `Superseded` (permanece `Frozen` hasta completar la transición completa); ningún ADR nuevo fue creado; la jerarquía documental (`AUCIS_ARCHITECTURE_DOCUMENTATION_GOVERNANCE.md`) fue respetada en cada decisión de este documento.

No se encontró ninguna contradicción arquitectónica que obligue a cambiar una decisión previamente aprobada.

---

## Version History

- **v1** — Especificación inicial del Case Blueprint. Reemplazó el diseño previo de "pesos porcentuales simples".
- **v2** — Resultado del Blueprint Field Audit (2026-08-02): remoción de cuatro campos (`petition_strategy_alignment`, `document_directives`, `generation_priorities`, `attorney_instructions`) por alineación con responsabilidades ya definidas en ADR-008; diferimiento de tres campos (`review_notes`, `evidence_priority`, `strategic_priorities`) como Deferred — Pending Empirical Validation; conservación completa de la estructura de Reasoning Provenance como preparación estructural para la futura Knowledge Layer, sin implementar comportamiento nuevo.
- **v3** — Resultado de MTCS-06 (`docs/MTCS-06_FINAL_EXACT_DESIGN.md`, Part X, Design MR: PASS): amendment aditivo y angosto de `foundational_evidence` con cinco atributos opcionales de Historical Reliance (`probative_revision_at_reliance`, `fact_at_reliance`, `documentary_condition_at_reliance`, `verification_condition_at_reliance`, `document_ids_at_reliance`), aplicables cuando el elemento usa `evidence_item_id`. `evidence_dependencies` en sí **no se modificó** — descubierta durante la implementación una divergencia entre el shape que Part X asumía (objetos) y el shape real en runtime (`string[]`, consumido por cuatro rutas/UI existentes) — la misma provenance se agregó en cambio como campo hermano nuevo, `evidence_dependencies_reliance`, indexado 1:1 con `evidence_dependencies`. Ningún otro campo modificado. Relación A5↔Evidence permanece APP-VALIDATED (no DB-authoritative), por decisión explícita DD-06-05 — no un subsistema paralelo al de A1.
