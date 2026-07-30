# AUCIS — Workflow State Machine Contract v1

## Contract Metadata

| Campo | Valor |
|---|---|
| Contract ID | `WF-CONTRACT-V1` |
| Version | v1 |
| Contract Status | Frozen (Stage 0) |
| Implementation Status | Parcialmente existe — gating manual construido en A5-panel (botón "Aprobar" condicionado a `status`); máquina de estados formal como componente propio del Control Plane no implementada (`AUCIS_PLATFORM_ARCHITECTURE.md`, tabla de clasificación de componentes). |
| Scope | Platform-scoped (reglas) / Case-scoped (ejecución) — ver `AUCIS_PLATFORM_ARCHITECTURE.md`, Architectural Observation sobre Scope como dimensión combinada, registrada 2026-07-29. |

## Contract Owner

**Control Plane (Workflow Orchestration Service)** — caso particular donde el Contract Owner coincide con el propio Producer, porque este contrato describe el comportamiento del único componente del Control Plane, no una interfaz entre dos capas distintas del Data Plane.

## Producer

**Workflow Orchestration Service, único y exclusivo.** Ningún componente del Data Plane puede declarar ni forzar una transición de etapa por sí mismo — solo puede emitir un evento de cambio de estado que el Control Plane evalúa.

## Primary Consumers

| Consumidor | Permiso |
|---|---|
| Application Layer (rutas API) | Consulta antes de permitir una acción (ej. generación documental) si el Case está en la etapa que la habilita. |
| Document Generation Layer (A3/A4) | Gateado — no puede ejecutar sin que el Control Plane confirme que el Case Blueprint vigente está `approved` y no `stale`. |
| Presentation Layer (paneles del caso) | Lee la etapa actual para renderizar el estado del caso al staff. |
| Todas las demás capas del Data Plane | Cuyo avance depende de una transición válida del Case. |

## Responsibilities — qué debe contener

El conjunto de etapas válidas del ciclo de vida del Case (a nivel Case, no el lifecycle individual de cada entidad — cada entidad ya tiene su propio lifecycle documentado en `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md`), las transiciones permitidas entre esas etapas, y las precondiciones de gating que debe cumplir cada transición.

## Responsibilities — qué nunca debe contener

- **Nunca** lógica de dominio propia — el patrón de referencia es Process Manager/Saga (DDD): coordina, no decide contenido (`AUCIS_PLATFORM_ARCHITECTURE.md`, sección Control Plane).
- **Nunca** reinterpretación del contenido sustantivo de una entidad — solo lee su `status` para gating (ej. lee `Case Blueprint.status`, nunca sus campos estratégicos).
- **Nunca** regeneración automática de una entidad — la cascada de invalidación se propaga como señal (`stale`), la regeneración siempre requiere acción humana explícita (Principio 3, Human-in-the-Loop).

## Input Contract

Eventos de cambio de estado emitidos por cualquier capa del Data Plane — ej. "Criterion Assessment generó una nueva versión Current", "Case Blueprint pasó a `approved`", "Evidence Item fue actualizado", "Case Filing fue `Submitted`".

## Output Contract

- Decisión de gating: permitir o bloquear una transición o una acción solicitada (booleano + razón, para Explainable AI).
- Señal de invalidación (`stale`) propagada según la cascada completa definida en `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md`.
- Etapa actual del Case y su historial de transiciones.

## States

Etapas del Case (`AUCIS_CORE_DOMAIN_MODEL.md`, Nivel 3 — Workflow/Case Stage):

`intake → análisis → estrategia propuesta → estrategia aprobada → generación de documentos → revisión legal → listo para radicar → radicado`

El historial de transiciones es en sí mismo una forma de versionado (no requiere un esquema de versionado adicional al ya descrito en `AUCIS_CORE_DOMAIN_MODEL.md`).

## Contract Invariants

1. Ninguna capa del Data Plane puede forzar una transición de etapa directamente — solo el Workflow Orchestration Service escribe el estado del Case.
2. Document Generation Layer no puede ejecutar sin que exista un Case Blueprint `approved` y no `stale` (Architectural Invariant #2 y #11, `AUCIS_PLATFORM_ARCHITECTURE.md`).
3. La cascada de invalidación nunca dispara regeneración automática — solo marca entidades como `stale`; la resolución requiere confirmación humana en cada nivel (Principio 3, Human-in-the-Loop).
4. Las transiciones automáticas (ej. A1 completa → avanza etapa) y las manuales (ej. abogado marca "listo para radicar") conviven bajo el mismo contrato — ninguna transición ocurre fuera de él, sin importar su origen.

## Compatibility Policy

- Agregar una etapa nueva al ciclo de vida del Case no rompe consumidores existentes si estos ya toleran etapas desconocidas como "no accionable por defecto".
- Eliminar o reordenar una etapa existente, o cambiar una precondición de gating ya vigente, requiere ADR + nueva versión de este contrato.

## Contract Governance

Contract Owner = Control Plane. Cambios a las etapas, transiciones, o precondiciones de gating requieren ADR explícito en `AUCIS_ARCHITECTURE_DECISIONS.md`.

## Dependencies

- Visibilidad bidireccional sobre Evidence Layer, Core Legal Engine, Document Generation Layer, Integration Layer — las observa, no depende de ellas en el sentido de una pila de capas (`AUCIS_PLATFORM_ARCHITECTURE.md`, sección Control Plane).
- `AUCIS_BLUEPRINT_CONTRACT_V1.md` — lee `status` para gating de Document Generation Layer.
- `AUCIS_CRITERION_ASSESSMENT_CONTRACT_V1.md` — lee versión vigente para gating de disparo de Case Strategy Engine.

## Out of Scope

- No evalúa criterios, no decide estrategia, no genera documentos — no posee lógica de dominio propia.
- No define el lifecycle individual de cada entidad (Beneficiary, Evidence Item, Criterion Assessment, Case Blueprint, Generated Document, Case Filing, Case Event, Case Outcome) — esos ya están definidos en `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md` y `AUCIS_CORE_DOMAIN_MODEL.md`; este contrato solo gatea las transiciones que dependen de ellos a nivel Case.

## Design Rationale

Workflow se modela como Control Plane, no como una capa más del Data Plane, precisamente porque no transforma datos del dominio y necesita visibilidad simultánea y bidireccional sobre múltiples capas a la vez — ver la nota de proceso en `AUCIS_PLATFORM_ARCHITECTURE.md` sobre por qué "capa transversal" fue descartada. Que el Contract Owner coincida con el Producer (a diferencia de los otros tres contratos de Stage 0) es consecuencia directa de esa misma naturaleza: no hay una capa "detrás" del Control Plane cuya autoridad conceptual sea distinta de quien lo implementa.

## References

- `AUCIS_CORE_DOMAIN_MODEL.md` — Nivel 3, entidad Workflow (Case Stage).
- `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md` — cascada completa de invalidación.
- `AUCIS_PLATFORM_ARCHITECTURE.md` — sección "El Control Plane", Architectural Invariants #2, #3, #4, #11, Architectural Observation sobre Scope.
- `AUCIS_ARCHITECTURE_PRINCIPLES.md` — Principio 3 (Human-in-the-Loop).
- `AUCIS_BLUEPRINT_CONTRACT_V1.md`, `AUCIS_CRITERION_ASSESSMENT_CONTRACT_V1.md` — contratos gateados por este Control Plane.
