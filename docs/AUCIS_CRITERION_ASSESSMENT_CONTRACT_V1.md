# AUCIS — Criterion Assessment Contract v1

## Contract Metadata

| Campo | Valor |
|---|---|
| Contract ID | `CA-CONTRACT-V1` |
| Version | v1 |
| Contract Status | Frozen (Stage 0) |
| Implementation Status | Parcialmente implementado — A1 produce hoy `criteria_met`/`criteria_scores` dentro de `agent_intake_analysis`, sin campo de versión explícito. Falta el campo de versión requerido por este contrato (ver `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md`, sección Criterion Assessment). |
| Scope | Case-scoped |

## Contract Owner

El **Core Legal Engine** (la capa, no una implementación específica) — mismo patrón de ownership que `AUCIS_BLUEPRINT_CONTRACT_V1.md`. Autoridad para proponer cambios a la forma de este contrato vía ADR.

## Producer

**Criterion Assessment Engine (A1), único y exclusivo.** Ningún otro componente de la plataforma — ni siquiera Case Strategy Engine (A5) — puede crear ni modificar el contenido de un Criterion Assessment (ADR-002).

## Primary Consumers

| Consumidor | Permiso |
|---|---|
| Case Strategy Engine (A5) | Lee la versión vigente (Current) como input directo. Nunca recalcula ni ajusta los resultados — "A1 mide. A5 decide." (ADR-002). |
| Workflow Orchestration Service (Control Plane) | Lee `status`/versión vigente únicamente, para determinar si existe una base válida sobre la cual A5 puede generar o regenerar un Blueprint. No interpreta el contenido sustantivo. |
| QA Engine (futuro) | Lee, para verificar que el Case Blueprint referenciado corresponde a la versión vigente de Criterion Assessment (no a una superseded). |

## Responsibilities — qué debe contener

Por cada `criterion_key` del catálogo canónico vigente (`canonical-criteria.ts`) aplicable a la clasificación del caso: si el criterio está satisfecho, con qué nivel de confianza/puntaje, y la evidencia que lo respalda. Incluye `overall_strength` y `classification_used`, derivados de la evaluación conjunta de todos los criterios.

## Responsibilities — qué nunca debe contener

- **Nunca** una decisión estratégica — narrativa, priorización entre criterios, orden argumentativo (exclusivo de Case Blueprint — ADR-002).
- **Nunca** contenido redactado listo para insertar en un documento.
- **Nunca** predicción de riesgo de RFE.
- **Nunca** una re-evaluación disparada por otro componente que no sea la propia ejecución de A1.

## Input Contract

- Evidence Item del caso (hoy vía `Module9`/`Module10`; futuro vía Evidence Item tipada — ver `AUCIS_EVIDENCE_ITEM_CONTRACT_V1.md`).
- Catálogo canónico de criterios vigente (`canonical-criteria.ts`) para la clasificación aplicable al caso.

## Output Contract

Por cada `criterion_key` evaluado:
- `status` (satisfecho / no satisfecho / parcial).
- `score`.
- `evidence_used` — referencias a la evidencia que sustenta el veredicto (hoy en prosa; futuro `evidence_item_id` real, dependiente de `AUCIS_EVIDENCE_ITEM_CONTRACT_V1.md`).
- `reasoning` — explicación del veredicto (obligatorio, Explainable AI).

A nivel de todo el Assessment: `overall_strength`, `classification_used`, `version`, `created_at`.

| Campo | Tipo | Oblig. |
|---|---|---|
| `assessment_status` | enum (`generated` \| `current` \| `superseded`) | Sí |

## States

`Generated → Current → Superseded` (`AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md`, sección Criterion Assessment).

**Campo que almacena este lifecycle:** `assessment_status` (ver Output Contract). Nombrado explícitamente para que el Workflow Orchestration Service tenga un campo único y sin ambigüedad que consultar al verificar vigencia — resuelve el Hallazgo 3 identificado en la revisión cruzada de Stage 0 (2026-07-29): antes de esta corrección, el lifecycle se describía sin nombrar el campo real que lo almacena.

## Contract Invariants

1. Solo A1 puede escribir en Criterion Assessment (ADR-002).
2. Ninguna otra entidad, incluyendo Case Strategy Engine, puede recalcular o ajustar sus resultados.
3. Cada ejecución de A1 crea una versión completa nueva — nunca edita una fila existente (Version Everything, Principio 5).
4. Cuando un Evidence Item referenciado cambia, la versión de Criterion Assessment que lo usó se marca `stale` automáticamente — la regeneración real requiere disparo explícito de A1, nunca es automática (cascada de invalidación, `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md`).

## Compatibility Policy

- Cualquier consumidor debe tolerar un campo desconocido de una versión posterior sin fallar catastróficamente.
- Eliminar o cambiar el tipo de un campo existente requiere un ADR nuevo y una nueva versión de este contrato (v1 → v2), no una edición silenciosa.

## Contract Governance

Contract Owner = Core Legal Engine (capa). Cambios a Producer, Consumers, o forma del contrato requieren ADR explícito en `AUCIS_ARCHITECTURE_DECISIONS.md`.

## Dependencies

- Evidence Layer (Evidence Item — hoy `Module9`/`Module10`, futuro entidad tipada).
- Catálogo canónico `canonical-criteria.ts` (Principio 7, Canonical Catalogs).

## Out of Scope

- No decide estrategia de caso.
- No genera documentos.
- No predice riesgo de RFE.
- No versiona el catálogo de criterios en sí — eso es responsabilidad de `canonical-criteria.ts`, fuera de este contrato.

## Design Rationale

El versionado obligatorio existe para que Case Blueprint pueda anclarse a una versión específica (`criterion_assessment_version_id`, ver `A5_CASE_BLUEPRINT_SPECIFICATION_V1.md` Sección A) y para que la cascada de invalidación tenga un punto de referencia estable. El campo `reasoning` es obligatorio porque Explainable AI (Principio 4) exige que toda decisión relevante pueda explicar qué información usó y qué razonamiento siguió — un veredicto sin justificación no es auditable.

## References

- `AUCIS_CORE_DOMAIN_MODEL.md` — Nivel 4, entidad Criterion Assessment.
- `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md` — sección Criterion Assessment, cascada de invalidación.
- `AUCIS_ARCHITECTURE_DECISIONS.md` — ADR-002.
- `AUCIS_ARCHITECTURE_PRINCIPLES.md` — Principio 4 (Explainable AI), Principio 5 (Version Everything), Principio 7 (Canonical Catalogs).
- `AUCIS_BLUEPRINT_CONTRACT_V1.md` — consumidor directo de este contrato.
- `AUCIS_PLATFORM_ARCHITECTURE.md` — Criterion Assessment Engine (A1) como único productor dentro del Core Legal Engine.
