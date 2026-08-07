# AUCIS — Blueprint Contract v2

**Estado:** Aprobado. Reemplazará oficialmente a `AUCIS_BLUEPRINT_CONTRACT_V1.md` cuando `AUCIS_CONTRACT_CATALOG.md` quede actualizado reflejando esta versión, conforme a `AUCIS_ARCHITECTURE_DOCUMENTATION_GOVERNANCE.md`. Hasta ese momento, v1 permanece Frozen. Resultado del Blueprint Field Audit (2026-08-02) — alinea este contrato con `A5_CASE_BLUEPRINT_SPECIFICATION_V2.md`, no introduce ninguna decisión arquitectónica nueva.

## Objetivo

Este documento describe qué es el Blueprint desde la perspectiva de cualquier componente que lo consuma — no cómo A5 lo construye (eso vive en `A5_CASE_BLUEPRINT_SPECIFICATION_V2.md`). Un consumidor debe poder integrarse correctamente leyendo solo este documento, sin necesitar entender el razonamiento interno del productor.

## Contract Owner

El Core Legal Engine (la capa, no una implementación específica) es el propietario conceptual de este contrato — quien tiene autoridad para proponer cambios a su forma, vía ADR. Esto es distinto de quién produce el Blueprint hoy en la práctica.

## Consumidores

| Consumidor | Permiso |
|---|---|
| A3 (Document Generation Layer) | Lee, ejecuta. Nunca modifica. |
| A4 (Document Generation Layer) | Lee, ejecuta. Nunca modifica. |
| QA Engine (futuro) | Lee, valida contra el Blueprint. Nunca modifica ni ejecuta. |
| RFE Prediction Engine (futuro) | Lee, solo después de que QA Engine validó. Nunca modifica. |
| Learning Engine (futuro) | Lee versiones históricas, junto con Case Outcome. Nunca modifica. |
| Workflow Orchestration Service (Control Plane) | Lee `status` únicamente, para gating. No lee ni interpreta el contenido sustantivo. |

## Responsabilidades — qué debe contener

Las cinco secciones ya definidas en `A5_CASE_BLUEPRINT_SPECIFICATION_V2.md` (Identidad/Gobernanza, Estratégica, Probatoria, Argumentativa, Operativa) — este documento no las repite, las referencia como la fuente de verdad de la forma.

## Responsabilidades — qué nunca debe contener

- Nunca una re-evaluación de si un criterio está satisfecho (exclusivo de Criterion Assessment — ADR-002).
- Nunca estructura literal de documento — capítulos numerados, índices de Exhibits (ADR-008).
- Nunca predicción de riesgo de RFE ni evaluación desde la perspectiva del oficial revisor — reservado al futuro RFE Prediction Engine.
- Nunca contenido redactado listo para insertar en un documento final — el Blueprint dirige la redacción, no la sustituye. Siempre es instrucción/dirección que A3/A4 deben ejecutar mediante su propio proceso de redacción, nunca texto que deban copiar literalmente.
- Nunca datos que solo existen después de la generación documental ni después del resultado del caso.

## Contrato de entrada

- Criterion Assessment en su versión vigente para el caso (obligatorio).
- Contenido completo de evidencia del caso (hoy vía Module9/Module10; futuro vía Evidence Item).

## Contrato de salida

Remite íntegramente a `A5_CASE_BLUEPRINT_SPECIFICATION_V2.md` — Secciones A-E. No se repiten aquí para evitar divergencia entre ambos documentos con el tiempo.

Restricción adicional: un Blueprint con `status: "approved"` es inmutable en su contenido sustantivo — cualquier corrección posterior crea una nueva versión, nunca edita la fila existente.

## Reglas de Versionado

- Compatibilidad: cualquier consumidor debe poder leer un Blueprint de versión N sin fallar catastróficamente ante un campo desconocido de una versión N+1.
- Breaking changes: eliminar o cambiar el tipo de un campo existente requiere una nueva versión de la especificación y de este contrato, conforme a `AUCIS_ARCHITECTURE_DOCUMENTATION_GOVERNANCE.md` — no una edición silenciosa.
- Versiones futuras: este contrato mismo se versiona igual — cualquier cambio a Contract Owner, Productor, o Consumidores requiere un ADR explícito.

## Estados

`proposed → edited → approved → locked → superseded` — remite a `A5_CASE_BLUEPRINT_SPECIFICATION_V2.md`, Sección A.

## Reglas de Integridad

Un Blueprint es válido para consumo por Document Generation Layer solo si, simultáneamente:

1. `status = "approved"`.
2. `criterion_assessment_version_id` referencia una versión de Criterion Assessment que sigue siendo la vigente (si fue superseded después de la aprobación, el Blueprint queda "stale" y no debe consumirse sin revisión humana explícita, aunque su `status` técnico siga en `approved`).
3. Los campos obligatorios de las cinco secciones están presentes y no vacíos.

## Reglas de Consumo

| Consumidor | Puede | Nunca puede |
|---|---|---|
| A3 | Leer, ejecutar la estrategia contenida en el Blueprint; derivar el comportamiento documental a partir de `cross_references`, `foundational_evidence`, `evidence_dependencies`, y `argument_sequence`; citar evidencia referenciada. | Modificar cualquier campo; contradecir `dominant_criteria`/`cross_references`. |
| A4 | Igual que A3, más: convertir `argument_sequence` en estructura real de documento (única excepción, su responsabilidad explícita). | Modificar cualquier campo; producir un outline distinto al que resulta de ejecutar fielmente `argument_sequence`. |
| QA Engine | Leer, comparar Generated Document contra el Blueprint, señalar discrepancias. | Modificar el Blueprint ni los documentos; corregir automáticamente. |
| Learning Engine | Leer versiones históricas junto con Case Outcome. | Modificar Blueprints históricos; escribir directamente en Knowledge Layer. |
| Abogado (humano) | Editar cualquier campo antes de aprobar; aprobar; rechazar y solicitar regeneración. | Aprobar un Blueprint con campos obligatorios vacíos. |

Regla que unifica esta tabla: ningún consumidor reinterpreta el Blueprint. Ejecutar no es lo mismo que interpretar. Esta regla es la implementación específica, para el Blueprint, del Architectural Invariant #11 de `AUCIS_PLATFORM_ARCHITECTURE.md` ("ningún componente fuera del Core Legal Engine puede alterar, reinterpretar, sustituir o reconstruir una decisión jurídica previamente aprobada, salvo mediante una nueva versión producida por el propio Core Legal Engine") — no se define aquí como un principio nuevo y separado, para evitar duplicidad de jerarquía arquitectónica.

## Regla de Ingeniería: Contract First Development

Ningún componente nuevo de AUCIS puede implementarse antes de que exista un contrato formal aprobado para la información que consume y produce.

Esta regla no es específica del Blueprint — aplica a cualquier información que cruce la frontera entre dos componentes de la plataforma. El Blueprint Contract fue la primera aplicación concreta de esta regla, no su única aplicación.

## Referencias

- `AUCIS_CORE_DOMAIN_MODEL.md` — define Case Blueprint como entidad.
- `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md` — define la cascada de invalidación que afecta la validez de un Blueprint aprobado.
- `A5_CASE_BLUEPRINT_SPECIFICATION_V2.md` — define la forma exacta del contrato de salida.
- `AUCIS_ARCHITECTURE_DECISIONS.md` — ADR-002, ADR-008.
- `AUCIS_ARCHITECTURE_PRINCIPLES.md` — Principios 1, 2, 3, 4, 5.
- `AUCIS_PLATFORM_ARCHITECTURE.md` — Core Legal Engine como productor único; Architectural Invariants #1, #2, #4, #11.
- `AUCIS_ARCHITECTURE_DOCUMENTATION_GOVERNANCE.md` — política de versionado que habilita esta transición sin ADR nuevo.

## Verification Checklist

✓ Ausencia de contradicciones internas — ninguna fila o sección hace referencia a `petition_strategy_alignment`, `document_directives`, `generation_priorities`, o `attorney_instructions` como campos vigentes.
✓ Ausencia de referencias obsoletas — todas las citas a la especificación apuntan a v2.
✓ Consistencia terminológica — vocabulario idéntico al de v1 y a `A5_CASE_BLUEPRINT_SPECIFICATION_V2.md`.
✓ Cumplimiento con Blueprint Specification v2 — cada responsabilidad, permiso, y regla de consumo tiene respaldo explícito en la forma ya aprobada.
✓ Cumplimiento con ADR-008 — la fila de A3 refleja correctamente que las directivas documentales se derivan, no se reciben pre-construidas.
✓ Cumplimiento con ADR-010 — el campo `status` conserva su forma actual; no dividirlo aquí no es una contradicción, es trabajo pendiente ya identificado y fuera de alcance de esta versión.
✓ Cumplimiento con Architecture Principles — sin violación de ningún principio ya congelado.
✓ Cumplimiento con Architecture Documentation Governance — v1 permanece Frozen hasta que Catalog se actualice; ningún ADR nuevo fue creado ni requerido.

No se encontró ninguna contradicción arquitectónica que obligue a cambiar una decisión previamente aprobada.
