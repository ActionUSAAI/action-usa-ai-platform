# AUCIS — Case Packet Contract v1

## Contract Metadata

| Campo | Valor |
|---|---|
| Contract ID | CP-CONTRACT-V1 |
| Version | v1 |
| Contract Status | Frozen |
| Implementation Status | Documented |
| Scope | Case-scoped |
| Owner | Document Generation Layer |
| Producer | Document Generation Layer |
| Primary Consumers | Case Filing, Workflow Orchestration Service, Presentation Layer, Abogado (humano) |
| Related ADR | ADR-002, ADR-005, ADR-006, ADR-008 |
| First Approved | 2026-07-31 |
| Last Updated | 2026-07-31 |

## Objetivo

Define qué es un Case Packet: el deliverable jurídico ensamblado, versionado y determinista que representa el expediente completo de un caso antes de radicarse.

## Identity

Un Case Packet es un snapshot inmutable del expediente: una composición ordenada y versionada de referencias a documentos ya aprobados, congelada en un momento específico. No es el expediente en evolución continua — es una fotografía exacta de cómo se veía el expediente completo en el instante de su ensamblaje. Dos Case Packets del mismo Case son snapshots distintos, nunca el mismo objeto actualizado.

## Contract Owner

Document Generation Layer — propietario lógico del contrato, con autoridad para aprobar cambios a su forma, independientemente de qué componente específico lo implemente.

## Producer

Document Generation Layer, único y exclusivo. Ningún otro componente puede crear ni modificar un Case Packet.

## Consumers

| Consumidor | Permiso |
|---|---|
| Case Filing | Lee, referencia como unidad al radicar. Nunca modifica. |
| Workflow Orchestration Service | Lee `status` (`Assembling`/`Ready`/`Superseded`) únicamente, para gating. No interpreta contenido sustantivo. |
| Presentation Layer | Lee para mostrar al abogado el paquete ensamblado. |
| Abogado (humano) | Lee, confirma señal de validación, puede solicitar re-ensamblaje. Nunca edita directamente contenido u orden. |

## Responsibilities — qué debe contener

Referencias a cada `Generated Document` incluido (por ID y versión específica), el orden/índice definitivo, y metadatos de snapshot (versión de Case Blueprint gobernante, fecha de ensamblaje).

## Responsibilities — qué nunca debe contener

- Contenido de ningún documento (vive en `Generated Document`).
- Decisiones estratégicas (viven en `Case Blueprint`).
- Resultados de validación (viven en el proceso que confirma `Ready`).
- Información sobre el acto de radicar o su resultado (vive en `Case Filing`/`Case Outcome`).

## Out of Scope

No genera contenido documental. No valida consistencia del expediente. No decide cuándo o si radicar. No realiza razonamiento jurídico.

## Input Contract

- Conjunto de `Generated Document` requeridos, todos en estado `approved`.
- Orden sugerido de `Case Blueprint.recommended_exhibit_order`.
- Señal de validación satisfactoria (fuente no especificada por este contrato).

**Contexto organizacional:** hereda automáticamente el contexto organizacional del `Case` al que pertenece. No declara `organization_id` como campo propio.

## Output Contract

| Campo | Definición |
|---|---|
| `case_packet_id` | Identificador único de esta versión. |
| `version` | Entero secuencial. |
| `previous_packet_id` | Referencia al Case Packet anterior en la cadena, si existe. Null en la primera versión. |
| `generation_job_id` | Referencia al evento/ejecución que produjo esta versión. |
| `documents` | Lista ordenada de `{ generated_document_id, version }`. |
| `blueprint_version_id` | Referencia a la versión de Case Blueprint que gobernó el conjunto. |
| `status` | `assembling` \| `ready` \| `superseded`. |
| `assembled_at` | Timestamp de ensamblaje. |
| `validated_at` / `validation_reference` | Cuándo se confirmó la señal de validación, y una referencia abstracta a su origen (humano o automatizado, sin especificar cuál). |

## States

`Assembling → Ready → Superseded`. No existe estado `edited`.

## Contract Invariants

- Solo el Producer designado puede crear o modificar un Case Packet.
- No alcanza `Ready` si algún documento referenciado no está en `approved`.
- No alcanza `Ready` sin una señal de validación satisfactoria confirmada.
- El orden es siempre internamente consistente — sin huecos, sin duplicados.
- Cada referencia apunta a una versión específica y ya aprobada de `Generated Document`.
- Un Case Packet en estado `ready` es inmutable en su composición; cualquier cambio posterior lo marca `superseded`.

## Compatibility Policy

- **Compatible:** agregar un campo opcional nuevo al Output Contract.
- **Breaking change:** eliminar o cambiar el tipo de un campo existente, o alterar la semántica de `status`.
- **Requiere nueva versión del contrato:** cualquier breaking change (v1 → v2).

## Reglas de Integridad

Un Case Packet es válido para ser referenciado por `Case Filing` solo si: `status = "ready"`; todos los `Generated Document` referenciados siguen en `approved`; el `Case Blueprint` referenciado sigue vigente.

La señal de validación es hoy una confirmación manual del abogado; su fuente puede cambiar sin modificar este contrato.

## Reglas de Consumo

| Consumidor | Puede | Nunca puede |
|---|---|---|
| Case Filing | Referenciar un Case Packet `ready` como la unidad que se radica. | Modificar su composición; referenciar un Packet `assembling` o `superseded` sin verificación explícita. |
| Workflow Orchestration Service | Leer `status`, gatear transiciones dependientes. | Interpretar el contenido de `documents`; iniciar o comandar el ensamblaje. |
| Abogado (humano) | Revisar, confirmar la señal de validación, solicitar re-ensamblaje. | Editar directamente el orden o las referencias. |

Ningún consumidor reinterpreta el Case Packet.

## Governance

Cualquier modificación de este contrato requiere: (1) ADR aprobado en `AUCIS_ARCHITECTURE_DECISIONS.md`; (2) nueva versión de este documento; (3) validación de compatibilidad con todos los consumidores listados; (4) actualización de documentos relacionados.

## Dependencies

**Depends On:** Generated Document, Case Blueprint.

**Depended On By:** Case Filing.

## References

- `AUCIS_CORE_DOMAIN_MODEL.md`
- `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md`
- `A5_CASE_BLUEPRINT_SPECIFICATION_V1.md`
- `AUCIS_BLUEPRINT_CONTRACT_V1.md`
- `AUCIS_ARCHITECTURE_DECISIONS.md`
- `AUCIS_PLATFORM_ARCHITECTURE.md`
