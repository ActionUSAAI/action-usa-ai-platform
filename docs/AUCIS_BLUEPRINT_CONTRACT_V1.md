# AUCIS — Blueprint Contract v1

**Estado:** Congelado. Aprobado 2026-07-29. Primer contrato formal producido bajo la regla Contract First Development (ver sección al final). Contrato de integración oficial entre el Core Legal Engine y el resto de la plataforma.

## Objetivo

Este documento describe *qué es* el Blueprint desde la perspectiva de cualquier componente que lo consuma — no *cómo* A5 lo construye (eso vive en `A5_CASE_BLUEPRINT_SPECIFICATION_V1.md`). Un consumidor debe poder integrarse correctamente leyendo solo este documento, sin necesitar entender el razonamiento interno del productor.

## Contract Owner

El **Core Legal Engine** (la capa, no una implementación específica) es el propietario conceptual de este contrato — quien tiene autoridad para proponer cambios a su forma, vía ADR. Esto es distinto de quién produce el Blueprint hoy en la práctica.

**Hoy**, A5 es el único componente del Core Legal Engine que produce Blueprints — por eso "Productor: A5" en la sección siguiente es correcto como estado actual. Pero si en el futuro el Core Legal Engine incorporara un segundo componente de razonamiento, ese componente heredaría automáticamente la autoridad de producir Blueprints bajo este mismo contrato — sin que el contrato necesite cambiar, porque pertenece a la capa, no al motor específico que hoy lo implementa.

## Productor

**A5, único y exclusivo hoy.** Ningún otro componente de la plataforma puede crear ni modificar el contenido sustantivo de un Blueprint.

## Consumidores autorizados

| Consumidor | Permiso |
|---|---|
| A3 (Document Generation Layer) | Lee, ejecuta. Nunca modifica. |
| A4 (Document Generation Layer) | Lee, ejecuta. Nunca modifica. |
| QA Engine (futuro) | Lee, valida contra el Blueprint. Nunca modifica ni ejecuta. |
| RFE Prediction Engine (futuro) | Lee, solo después de que QA Engine validó. Nunca modifica. |
| Learning Engine (futuro) | Lee versiones históricas, junto con Case Outcome. Nunca modifica. |
| Workflow Orchestration Service (Control Plane) | Lee `status` únicamente, para gating. No lee ni interpreta el contenido sustantivo. |

## Responsabilidades — qué debe contener

Las cinco secciones ya definidas en `A5_CASE_BLUEPRINT_SPECIFICATION_V1.md` (Identidad/Gobernanza, Estratégica, Probatoria, Argumentativa, Operativa) — este documento no las repite, las referencia como la fuente de verdad de la forma.

## Responsabilidades — qué nunca debe contener

- **Nunca** una re-evaluación de si un criterio está satisfecho (exclusivo de Criterion Assessment — ADR-002).
- **Nunca** estructura literal de documento — capítulos numerados, índices de Exhibits (ADR-008).
- **Nunca** predicción de riesgo de RFE ni evaluación desde la perspectiva del oficial revisor — reservado al futuro RFE Prediction Engine.
- **Nunca** contenido redactado listo para insertar en un documento final — el Blueprint dirige la redacción, no la sustituye. Siempre es instrucción/dirección que A3/A4 deben *ejecutar* mediante su propio proceso de redacción, nunca texto que deban copiar literalmente.
- **Nunca** datos que solo existen después de la generación documental ni después del resultado del caso.

## Contrato de entrada

- `Criterion Assessment` en su versión vigente para el caso (obligatorio).
- Contenido completo de evidencia del caso (hoy vía Module9/Module10; futuro vía Evidence Item).
- La elección humana de `petition_strategy` (multiCriteria/singleAchievement) — si no existe todavía, A5 puede producir el Blueprint igualmente, dejando `petition_strategy_alignment` vacío hasta que el abogado la defina.

## Contrato de salida

Remite íntegramente a `A5_CASE_BLUEPRINT_SPECIFICATION_V1.md` — Secciones A-E. No se repiten aquí para evitar divergencia entre ambos documentos con el tiempo.

**Restricción adicional:** un Blueprint con `status: "approved"` es inmutable en su contenido sustantivo — cualquier corrección posterior crea una nueva versión, nunca edita la fila existente.

## Reglas de Versionado

- **Compatibilidad:** cualquier consumidor debe poder leer un Blueprint de versión N sin fallar catastróficamente ante un campo desconocido de una versión N+1.
- **Breaking changes:** eliminar o cambiar el tipo de un campo existente requiere un ADR nuevo y una nueva versión de la especificación (v1 → v2), no una edición silenciosa.
- **Versiones futuras:** este contrato mismo se versiona igual — cualquier cambio a Contract Owner, Productor, o Consumidores requiere un ADR explícito.

## Estados

`proposed → edited → approved → locked → superseded` — remite a `A5_CASE_BLUEPRINT_SPECIFICATION_V1.md`, Sección A.

## Reglas de Integridad

Un Blueprint es válido para consumo por Document Generation Layer solo si, simultáneamente:

1. `status = "approved"`.
2. `criterion_assessment_version_id` referencia una versión de Criterion Assessment que sigue siendo la vigente (si fue superseded después de la aprobación, el Blueprint queda "stale" y no debe consumirse sin revisión humana explícita, aunque su `status` técnico siga en `approved`).
3. Los campos obligatorios de las cinco secciones están presentes y no vacíos.

## Reglas de Consumo

| Consumidor | Puede | Nunca puede |
|---|---|---|
| A3 | Leer, ejecutar directivas específicas del caso, citar evidencia referenciada. | Modificar cualquier campo; contradecir dominant_criteria/cross_references; ignorar attorney_instructions. |
| A4 | Igual que A3, más: convertir argument_sequence en estructura real de documento (única excepción, su responsabilidad explícita). | Modificar cualquier campo; producir un outline distinto al que resulta de ejecutar fielmente argument_sequence. |
| QA Engine | Leer, comparar Generated Document contra el Blueprint, señalar discrepancias. | Modificar el Blueprint ni los documentos; corregir automáticamente. |
| Learning Engine | Leer versiones históricas junto con Case Outcome. | Modificar Blueprints históricos; escribir directamente en Knowledge Layer. |
| Abogado (humano) | Editar cualquier campo antes de aprobar; aprobar; rechazar y solicitar regeneración. | Aprobar un Blueprint con campos obligatorios vacíos. |

**Regla que unifica esta tabla:** ningún consumidor reinterpreta el Blueprint. Ejecutar no es lo mismo que interpretar. **Esta regla es la implementación específica, para el Blueprint, del Architectural Invariant #11 de `AUCIS_PLATFORM_ARCHITECTURE.md`** ("ningún componente fuera del Core Legal Engine puede alterar, reinterpretar, sustituir o reconstruir una decisión jurídica previamente aprobada, salvo mediante una nueva versión producida por el propio Core Legal Engine") — no se define aquí como un principio nuevo y separado, para evitar duplicidad de jerarquía arquitectónica.

## Regla de Ingeniería: Contract First Development

**Ningún componente nuevo de AUCIS puede implementarse antes de que exista un contrato formal aprobado para la información que consume y produce.**

Esta regla no es específica del Blueprint — aplica a cualquier información que cruce la frontera entre dos componentes de la plataforma. El Blueprint Contract v1 es la primera aplicación concreta de esta regla, no su única aplicación.

**Justificación:** un contrato escrito después de la implementación tiende a describir lo que el código ya hace, no lo que debería hacer. Un contrato aprobado antes de escribir código obliga a que las decisiones de forma se tomen deliberadamente.

**Consecuencia práctica para la Fase 2:** Stage 0 (Contract Freeze) en `AUCIS_IMPLEMENTATION_ROADMAP_PHASE_2.md` existe precisamente para cumplir esta regla.

## Referencias

- `AUCIS_CORE_DOMAIN_MODEL.md` — define Case Blueprint como entidad.
- `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md` — define la cascada de invalidación que afecta la validez de un Blueprint aprobado.
- `A5_CASE_BLUEPRINT_SPECIFICATION_V1.md` — define la forma exacta del contrato de salida.
- `AUCIS_ARCHITECTURE_DECISIONS.md` — ADR-002, ADR-008.
- `AUCIS_ARCHITECTURE_PRINCIPLES.md` — Principios 1, 2, 3, 4, 5.
- `AUCIS_PLATFORM_ARCHITECTURE.md` — Core Legal Engine como productor único; Architectural Invariants #1, #2, #4, #11.
