# AUCIS — Case Blueprint Specification v1

**Estado:** Aprobado 2026-07-28. Reemplaza el diseño previo de "pesos porcentuales simples" documentado en versiones anteriores de `A5_CASE_STRATEGY_ENGINE_DESIGN.md`. Depende de `AUCIS_CORE_DOMAIN_MODEL.md` y `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md`.

**Propósito:** el Case Blueprint es el contrato estratégico que gobierna todo el expediente — la única fuente oficial de estrategia para el caso. Todos los motores posteriores (A3, A4) deben consumirlo sin reinterpretarlo.

**Principio rector:** *A1 mide. A5 decide.* Ningún campo de este documento puede ser una re-evaluación de si un criterio está satisfecho — eso es exclusivamente responsabilidad de Criterion Assessment (A1). El Blueprint decide cómo se cuenta la historia con lo que A1 ya confirmó.

---

## Tipo transversal: Reasoning Provenance

Se adjunta a cada decisión estratégica del Blueprint que lo requiera. No es un campo aislado — es una estructura reutilizable.

| Atributo | Definición |
|---|---|
| `source_type` | `"case_evidence"` \| `"org_pattern"` \| `"global_pattern"`. Hoy siempre `"case_evidence"` — los otros dos valores quedan reservados para cuando exista la futura Knowledge Layer. |
| `influence_weight` | Número (0–1) — qué tan determinante fue esta fuente. Hoy siempre `1.0`. |
| `explanation` | Texto — por qué esta fuente influyó de esta forma. |
| `reference_id` | ID de la entidad que respalda esto (ej. evidence_item_id). Puede ser null si la referencia es solo textual — ver Brecha Técnica #1. |

Una decisión puede tener múltiples objetos de este tipo (array) — varias fuentes pueden influir simultáneamente en la misma decisión.

**Nota de diseño futuro:** este campo existe para que el Blueprint nazca preparado para una futura Knowledge Layer (patrones aprendidos por firma, patrones globales anonimizados) sin necesitar modificar su estructura cuando esa capa se construya. A5, no el Blueprint, sería quien consulte esa capa — el Blueprint solo registra de dónde vino la influencia.

---

## Sección A — Identidad y Gobernanza

| Campo | Definición | Tipo | Oblig. | Genera | Modifica | Consumen |
|---|---|---|---|---|---|---|
| `blueprint_id` | Identificador único de esta versión específica. | UUID | Sí | A5 | Nadie (inmutable) | Todos |
| `case_id` | Caso al que pertenece. | UUID (ref. Case) | Sí | A5 | Nadie | Todos |
| `criterion_assessment_version_id` | Versión específica de Criterion Assessment que fundamenta este Blueprint — dependencia explícita que habilita la cascada de invalidación. | UUID (ref.) | Sí | A5 | Nadie | A5 (al regenerar), QA futuro |
| `status` | proposed → edited → approved → locked → superseded. | Enum | Sí | A5 (crea en proposed) | Abogado (transiciones) | Todos |
| `approved_by` / `approved_at` | Quién y cuándo aprobó. | ref. User / timestamp | Condicional | — | Abogado | QA futuro, auditoría |

---

## Sección B — Información Estratégica

| Campo | Definición | Objetivo | Tipo | Oblig. | Provenance |
|---|---|---|---|---|---|
| `theory_of_case` | Tesis jurídica central en 1-2 frases. | Ancla todo lo demás — cada otro campo debe ser trazable a esto. | Texto | Sí | Sí — array |
| `primary_narrative` | Historia que conecta los criterios dominantes. | Da forma narrativa a la evidencia, evita criterios aislados. | Texto | Sí | Sí — array |
| `secondary_narrative` | Hilos de apoyo, si existen. | Complementa sin competir con la narrativa principal. | Texto \| null | No | Sí — array |
| `petition_strategy_alignment` | Para cuál estrategia base ya elegida por el abogado (multiCriteria/singleAchievement) fue construido este Blueprint. | Evita que A5 duplique una decisión que ya es responsabilidad humana. | Enum (valor heredado) | Sí | No aplica — es reflejo, no decisión de A5 |

**Nota de diseño:** se descartó un campo de "clasificación de fortaleza del caso" propio de A5 (ej. "Strategic Classification") porque duplicaría `overall_strength`, que ya produce A1 — violaría el principio de fuente única de verdad.

---

## Sección C — Información Probatoria

| Campo | Definición | Objetivo | Tipo | Oblig. | Provenance |
|---|---|---|---|---|---|
| `dominant_criteria` | Criterios que son el núcleo del caso. | Prioriza dónde se invierte el mayor desarrollo argumental. | Array de criterion_key | Sí | Sí — por criterio |
| `supporting_criteria` | Criterios de refuerzo. | — | Array de criterion_key | Sí (puede ser vacío) | Sí — por criterio |
| `corroborative_criteria` | Criterios que solo corroboran a otros. | — | Array de criterion_key | Sí (puede ser vacío) | Sí — por criterio |
| `foundational_evidence` | La pieza (o pocas piezas) de evidencia sobre la que descansa la teoría completa del caso. | Ancla narrativa. | Array de { evidence_item_id \| description, why_foundational } | Sí | Sí |
| `evidence_dependencies` | Qué evidencia específica respalda cada criterio. | Cierra el gap original documentado en A4_ATTORNEY_EVIDENCE_GAP.md — contenido real, no solo cita+label. | Map criterion_key → array de { evidence_item_id \| description } | Sí | Sí — por entrada |
| `evidence_priority` | Dentro de cada criterio, orden de importancia de la evidencia disponible. | Distingue "lo mejor" de "lo disponible" cuando hay múltiples piezas. | Map criterion_key → array ordenado de evidence refs | No (solo si hay >1 evidencia por criterio) | Sí |

---

## Sección D — Información Argumentativa

| Campo | Definición | Objetivo | Tipo | Oblig. | Provenance |
|---|---|---|---|---|---|
| `argument_sequence` | Secuencia lógica de argumentos — NO capítulos de documento. | Da orden de razonamiento a A4, sin imponerle estructura documental. | Array ordenado de strings | Sí | Sí |
| `cross_references` | Conexiones narrativas explícitas entre criterios. | Comportamiento validado como el más valioso de A5 en pruebas reales. | Array de { criteria: [key, key], connection: string } | Sí (puede ser vacío) | Sí — por conexión |
| `strategic_priorities` | Dónde concentrar el mayor esfuerzo argumental, más allá de la clasificación de tres niveles. | Matiza dominant/supporting/corroborative con intención táctica del caso. | Array de strings | No | Sí |
| `reinforcement_opportunities` | Evidencia adicional que fortalecería el caso. | Guía al abogado sobre qué pedirle al cliente. | Array de strings | No | Sí |
| `missing_evidence_links` | Vacíos probatorios que afectan la estrategia actual. **Explícitamente NO predicción de RFE** — reservado para el futuro RFE Prediction Engine. | Fortalecer antes de que exista un RFE. | Array de strings | No | Sí |

---

## Sección E — Información Operativa (Directrices)

| Campo | Definición | Objetivo | Tipo | Oblig. |
|---|---|---|---|---|
| `document_directives` | Reglas obligatorias específicas de ESTE caso, por tipo de documento. No repite reglas de voz genéricas ya fijas en cada prompt de motor — solo directivas específicas del caso. | Ej.: "en la carta del recomendante X, enfatiza la conexión judging↔awards porque es la Foundational Evidence de este caso." | Map genérico document_type_key → array de strings | No |
| `generation_priorities` | Énfasis estratégico de qué generar primero. **Nunca** numeración/índice literal de Exhibits o capítulos — eso sigue siendo trabajo exclusivo de A4/assembleExhibits. | Ej.: "genera primero las cartas que respaldan foundational_evidence." | Array ordenado de strings | No |
| `review_notes` | Notas del abogado durante revisión. | Espacio explícito para contexto humano que no encaja en otro campo. | Texto | No |
| `attorney_instructions` | Instrucciones del abogado que override el comportamiento por defecto de A3/A4 para este caso. | Escape hatch explícito — el humano siempre tiene la última palabra. | Texto | No |

---

## Campos explícitamente EXCLUIDOS del Blueprint, y por qué

| Campo descartado | Por qué no pertenece a A5 |
|---|---|
| `attorney_letter_outline` (capítulos de documento) | A5 no genera documentos ni su estructura — eso es responsabilidad de A4. A5 entrega `argument_sequence` (secuencia lógica); A4 decide cómo convertirla en capítulos. |
| `recommended_exhibit_order` (numeración/índice literal) | Organización documental — trabajo de A4/assembleExhibits, no de A5. |
| Predicción de riesgo de RFE / preocupaciones de USCIS | Reservado para el futuro RFE Prediction Engine, que además solo tiene sentido aplicarse después de que el expediente pase por el futuro Quality Assurance Engine. A5 razona desde la perspectiva del abogado que arma el caso, no desde la del oficial que lo revisa. |
| Reglas de voz genéricas (ej. "nunca citar reglamentos en boca del testigo") | Ya viven fijas en el prompt de cada motor (A3 Testimonial, Institucional). `document_directives` de A5 es solo para directivas específicas del caso — repetirlas aquí duplicaría una fuente de verdad ya existente. |

---

## Brechas técnicas conocidas (honestas, no resueltas en esta especificación)

**Brecha #1 — Evidence Item no existe todavía como entidad tipada.** Hasta que se implemente (ver `AUCIS_CORE_DOMAIN_MODEL.md`), los campos que referencian `evidence_item_id` usarán `description` (texto en prosa) en lugar de una referencia estable real. El Blueprint queda estructuralmente preparado para IDs reales, pero funciona hoy con descripciones — consistente con no bloquear el trabajo actual hasta que el Core Domain Model completo esté implementado.

**Brecha #2 — Reasoning Provenance con source_type fijo en "case_evidence" hoy.** Es un campo "dormido" hasta que exista la Knowledge Layer — la decisión correcta es no implementar de más antes de tiempo, pero vale la pena que quede explícito que hoy no aporta funcionalidad real, solo preparación estructural.

**Brecha #3 — No existe mecanismo técnico que impida que A3/A4 ignoren `document_directives`/`argument_sequence`.** La "obligatoriedad" mencionada en los principios arquitectónicos es, hoy, una instrucción de prompt fuerte — no una garantía técnica verificable. Esa garantía real sería trabajo del futuro Quality Assurance Engine (verificar que los documentos generados efectivamente siguieron el Blueprint), no de A5 ni del Blueprint mismo.

---

## Evaluación de nivel de abstracción (para servir como contrato estable multi-categoría)

**Lo que funciona bien para durabilidad multi-categoría migratoria:**
- Todo referencia `criterion_key` genérico, ya funcional para O-1A, O-1B, y EB-1A (confirmado contra `canonical-criteria.ts`).
- `argument_sequence` es texto libre ordenado, no una plantilla de capítulos fija — no asume la lógica argumental específica de "extraordinary ability".
- `document_directives` usa mapa genérico por tipo de documento, no campos hardcodeados por motor.

**Conclusión:** el nivel de abstracción es correcto para servir de contrato estable durante mucho tiempo — el diseño no requeriría romperse para incorporar QA Engine, RFE Engine, o Knowledge Layer. Su funcionamiento pleno (no solo su estructura) depende de que la Brecha #1 se cierre eventualmente.
