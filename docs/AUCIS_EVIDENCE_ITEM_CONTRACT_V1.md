# AUCIS — Evidence Item Contract v1

## Contract Metadata

| Campo | Valor |
|---|---|
| Contract ID | `EI-CONTRACT-V1` |
| Version | v1 |
| Contract Status | Frozen (Stage 0) |
| Implementation Status | No implementado. Hoy la evidencia vive sin tipar, como elementos de arrays dentro de JSON en `intake_submissions.module9`/`module10`, sin identificador estable. Es la Brecha Técnica #1 señalada en `A5_CASE_BLUEPRINT_SPECIFICATION_V1.md`. |
| Scope | Case-scoped |

## Contract Owner

**Evidence Layer** — la capa, no un componente específico. Autoridad para proponer cambios a la forma de este contrato vía ADR.

## Producer

**Intake (Module9/Module10), hoy.** **CV Extractor (A0), en el futuro**, como fuente secundaria que alimenta al mismo owner (`AUCIS_CORE_DOMAIN_MODEL.md`, Nivel 4). El contenido factual de un Evidence Item no lo modifica ningún motor de IA — únicamente cliente o staff.

## Primary Consumers

| Consumidor | Permiso |
|---|---|
| Criterion Assessment Engine (A1) | Lee y evalúa contra el catálogo canónico de criterios. Nunca modifica. |
| Case Strategy Engine (A5) | Lee para priorizar y referenciar (`evidence_dependencies`, `foundational_evidence`). Nunca modifica. |
| Testimonial / Institutional Letter Generator (A3), Attorney Document Generator (A4) | Citan directamente al ejecutar un Case Blueprint aprobado. Nunca modifican. |

## Responsibilities — qué debe contener

Un hecho verificable del caso con su documentación de soporte: tipo (alineado al catálogo canónico — award, membership, media, article, judging, patent, reference, etc.), descripción, fecha, organización relacionada, criterio(s) al que potencialmente aplica, estado de verificación, archivo(s) adjunto(s).

## Responsibilities — qué nunca debe contener

- **Nunca** una evaluación de si el hecho satisface un criterio — eso es responsabilidad exclusiva de Criterion Assessment (`AUCIS_CRITERION_ASSESSMENT_CONTRACT_V1.md`).
- **Nunca** una decisión estratégica.
- **Nunca** contenido redactado para un documento final.

## Input Contract

- Captura humana directa (formulario de intake, Módulos 9/10 hoy).
- Extracción automatizada de CV/documentos del cliente (CV Extractor / A0, futuro) — siempre como fuente secundaria que alimenta el mismo owner, nunca como productor independiente.

## Output Contract

- `evidence_item_id` — identificador estable (hoy inexistente; requerido para cerrar la Brecha Técnica #1).
- `type`, `description`, `date`, `related_organization`, `applicable_criteria` (referencia al catálogo canónico), `verification_status`, `supporting_document_ref`.
- `version`, `created_at`.

## States

`Reported → Documented → Verified → Used` (`AUCIS_CORE_DOMAIN_MODEL.md`, Nivel 4).

## Contract Invariants

1. Modificable únicamente por cliente o staff — ningún motor de IA modifica el contenido factual de un Evidence Item.
2. Actualizar o agregar un documento de soporte crea una nueva versión — nunca reemplazo silencioso (Version Everything, Principio 5).
3. Si un Evidence Item cambia después de que un Criterion Assessment ya lo evaluó, ese Criterion Assessment se marca `stale` automáticamente (cascada de invalidación, `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md`) — la regeneración real requiere disparo explícito de A1, nunca automática.

## Compatibility Policy

- Consumidores deben tolerar campos desconocidos de versiones posteriores.
- Eliminar o cambiar el tipo de un campo existente requiere ADR + nueva versión de este contrato.

## Contract Governance

Contract Owner = Evidence Layer. Cambios a Producer, Consumers, o forma del contrato requieren ADR explícito en `AUCIS_ARCHITECTURE_DECISIONS.md`.

## Dependencies

- Catálogo canónico `canonical-criteria.ts`, para tipificación consistente (Principio 7, Canonical Catalogs).
- Presentation Layer / Application Layer, para la captura inicial.

## Out of Scope

- No evalúa criterios.
- No decide estrategia.
- No genera documentos.
- No define el catálogo de tipos de evidencia en sí — eso vive en `canonical-criteria.ts`.

## Design Rationale

Evidence Item se formaliza como entidad tipada propia — en vez de permanecer como JSON libre dentro de Module9/Module10 — precisamente para cerrar la Brecha Técnica #1 documentada en `A5_CASE_BLUEPRINT_SPECIFICATION_V1.md`: permitir que Case Blueprint referencie evidencia mediante `evidence_item_id` estable, en lugar de descripciones en prosa que cada consumidor debe reinterpretar. Esta es la Capacidad 4 (Structured Evidence) de `AUCIS_IMPLEMENTATION_ROADMAP_PHASE_2.md`.

## References

- `AUCIS_CORE_DOMAIN_MODEL.md` — Nivel 4, entidad Evidence Item.
- `AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md` — sección Evidence Item, cascada de invalidación.
- `A5_CASE_BLUEPRINT_SPECIFICATION_V1.md` — Brecha Técnica #1.
- `AUCIS_IMPLEMENTATION_ROADMAP_PHASE_2.md` — Capacidad 4 (Structured Evidence).
- `AUCIS_ARCHITECTURE_PRINCIPLES.md` — Principio 5 (Version Everything), Principio 7 (Canonical Catalogs).
- `AUCIS_CRITERION_ASSESSMENT_CONTRACT_V1.md` — consumidor directo.
- `AUCIS_BLUEPRINT_CONTRACT_V1.md` — consumidor indirecto (vía Case Strategy Engine).
