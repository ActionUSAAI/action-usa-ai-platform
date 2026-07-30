# AUCIS — Contract Catalog

**Estado:** Congelado (Stage 0). Aprobado 2026-07-29. Índice de referencia rápida de todos los contratos internos formales de la plataforma — no una fuente de verdad paralela. Cada fila remite al documento que gobierna ese contrato; en caso de cualquier discrepancia, el documento individual prevalece sobre esta tabla.

**Propósito:** dar visibilidad de conjunto a los contratos que cruzan fronteras entre componentes de AUCIS, antes de iniciar la implementación de la Fase 2 (regla Contract First Development, `AUCIS_BLUEPRINT_CONTRACT_V1.md`).

---

## Contratos registrados (Stage 0)

| Contract ID | Nombre | Versión | Contract Status | Contract Owner | Producer | Scope |
|---|---|---|---|---|---|---|
| `BP-CONTRACT-V1` | Blueprint Contract | v1 | Frozen | Core Legal Engine | Case Strategy Engine (A5) | Case-scoped |
| `CA-CONTRACT-V1` | Criterion Assessment Contract | v1 | Frozen (Stage 0) | Core Legal Engine | Criterion Assessment Engine (A1) | Case-scoped |
| `EI-CONTRACT-V1` | Evidence Item Contract | v1 | Frozen (Stage 0) | Evidence Layer | Intake (hoy) / CV Extractor A0 (futuro) | Case-scoped |
| `WF-CONTRACT-V1` | Workflow State Machine Contract | v1 | Frozen (Stage 0) | Control Plane | Workflow Orchestration Service | Platform-scoped (reglas) / Case-scoped (ejecución) |

**Nota de nomenclatura:** `BP-CONTRACT-V1` es el identificador corto asignado retroactivamente por este catálogo a `AUCIS_BLUEPRINT_CONTRACT_V1.md` — ese documento, aprobado antes de que existiera el formato `Contract Metadata` con campo `Contract ID` explícito, no contiene esta cadena en su propio texto. Ver hallazgo correspondiente en la revisión arquitectónica del cierre de Stage 0.

---

## Cadena de consumo entre contratos

```
Evidence Item Contract (EI-CONTRACT-V1)
    │  consumido por
    ▼
Criterion Assessment Contract (CA-CONTRACT-V1)
    │  consumido por (input directo, nunca recalculado — ADR-002)
    ▼
Blueprint Contract (BP-CONTRACT-V1)
    │  consumido por (lectura/ejecución, nunca reinterpretación — Invariant #2, #11)
    ▼
Document Generation Layer (A3 / A4) — fuera del alcance de Stage 0, consumidor terminal
```

El **Workflow State Machine Contract (WF-CONTRACT-V1)** no participa de esta cadena secuencial — la observa transversalmente desde el Control Plane, leyendo únicamente el campo `status` de `CA-CONTRACT-V1` y `BP-CONTRACT-V1` para decisiones de gating, sin consumir su contenido sustantivo (`AUCIS_PLATFORM_ARCHITECTURE.md`, Architectural Invariant #4).

---

## Reglas transversales a todos los contratos de este catálogo

Estas reglas no se repiten en cada contrato individual — se declaran aquí una sola vez y aplican a los cuatro:

1. **Compatibilidad hacia adelante:** todo consumidor debe tolerar campos desconocidos de una versión posterior sin fallar catastróficamente.
2. **Breaking changes:** eliminar o cambiar el tipo de un campo existente en cualquier contrato de este catálogo requiere un ADR nuevo en `AUCIS_ARCHITECTURE_DECISIONS.md` y una nueva versión de ese contrato — nunca una edición silenciosa.
3. **Ningún consumidor reinterpreta lo que consume** — ejecutar, evaluar o gatear no es lo mismo que reinterpretar o modificar (Architectural Invariant #11, `AUCIS_PLATFORM_ARCHITECTURE.md`).
4. **Todo contrato tiene un único Producer** — ningún contrato de este catálogo admite más de un componente con permiso de escritura simultáneo.

---

## Fuera de alcance de este catálogo

- Contratos futuros no pertenecientes a Stage 0 (ej. Document Template Contract, Case Filing Contract, QA Engine output contract) — se agregarán a este catálogo si y cuando se congelen formalmente, siguiendo el mismo Contract Metadata mínimo.
- La infraestructura de gestión centralizada de contratos (`Contract Registry`/`Contract Catalog` como componente de software) — este documento es el catálogo en su forma más simple posible (una tabla Markdown), no la implementación de esa idea. Ver "Contract Registry / Contract Catalog (evolución futura, sin fase asignada)" en `AUCIS_IMPLEMENTATION_ROADMAP_PHASE_2.md`, sección Decisiones Diferidas.

---

## References

- `AUCIS_BLUEPRINT_CONTRACT_V1.md`
- `AUCIS_CRITERION_ASSESSMENT_CONTRACT_V1.md`
- `AUCIS_EVIDENCE_ITEM_CONTRACT_V1.md`
- `AUCIS_WORKFLOW_STATE_MACHINE_CONTRACT_V1.md`
- `AUCIS_PLATFORM_ARCHITECTURE.md` — Architectural Invariants, Architectural Observation sobre Scope.
- `AUCIS_ARCHITECTURE_DECISIONS.md`, `AUCIS_ARCHITECTURE_PRINCIPLES.md`
- `AUCIS_IMPLEMENTATION_ROADMAP_PHASE_2.md` — Stage 0 (Contract Freeze), Decisiones Diferidas.
