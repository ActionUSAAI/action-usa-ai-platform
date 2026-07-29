# AUCIS — Arquitectura de Interacción del Dominio

**Estado:** Congelado (v1). Aprobado 2026-07-28. Depende de `AUCIS_CORE_DOMAIN_MODEL.md` — este documento no redefine entidades, define cómo fluye la información entre ellas.

**Propósito:** eliminar cualquier duplicidad de responsabilidad entre entidades, definiendo con precisión quién produce, quién consume, y qué ocurre cuando algo cambia.

---

## Diagrama funcional de alto nivel

Organization
↓
Client ──────────────┐
↓                │
Case ←────────────────┘
↓
Beneficiary + Petitioner  (datos base, versionados)
↓
Evidence Items  (intake, o A0 en el futuro)
↓
Criterion Assessment (A1)  ← ÚNICO que evalúa
↓
Case Blueprint (A5)  ← ÚNICO que decide estrategia
↓
├──→ Generated Documents — Testimonial/Institucional (A3)  ← ejecutan
└──→ Generated Documents — Attorney Letter/I-129 (A4)      ← ejecutan
↓
Case Filing  (la firma radica — acción, no evaluación)
↓
Case Event  (log append-only de hechos externos)
↓
Case Outcome  (síntesis derivada del log)
↓
[futuro] Quality Assurance Engine
↓
[futuro] RFE Prediction Engine
↓
[futuro] Learning Engine  (consume Case Blueprint + Case Outcome)

**Regla de flujo unidireccional:** la información fluye hacia abajo. Ninguna entidad de un nivel inferior puede modificar una de nivel superior — solo puede señalar, vía Workflow o marcado de estado, que algo de nivel superior necesita revisión.

---

## Tabla de interacción por entidad

### Organization
- **Owner:** proceso de onboarding.
- **Consumers:** todos los motores (scoping).
- **Lifecycle:** Active → Suspended → Archived.
- **Versioning:** no se versiona.
- **Regeneration Rules:** no aplica.
- **Single Source of Truth:** tabla `organizations`. Modificable por admin de plataforma.

### User / Role
- **Owner:** Supabase Auth + admin de Organization.
- **Consumers:** todo el sistema (permisos, atribución).
- **Lifecycle:** Invited → Active → Suspended → Removed.
- **Versioning:** no.
- **Regeneration Rules:** no aplica.
- **Single Source of Truth:** `profiles`/`auth.users`. Modificable por el propio usuario (perfil) o admin (rol).

### Client
- **Owner:** staff, al crear invitación.
- **Consumers:** A8, facturación futura.
- **Lifecycle:** Active → Inactive.
- **Versioning:** no — actualización in place.
- **Regeneration Rules:** cambios administrativos (ej. corrección de email) no disparan regeneración aguas abajo.
- **Single Source of Truth:** tabla `clients`. Modificable por staff.

### Beneficiary / Petitioner
- **Owner:** intake; A0 en el futuro como fuente secundaria del mismo owner.
- **Consumers:** A1, A3, A4, A5 — lectura únicamente. Ninguno puede modificar; solo señalar inconsistencias vía Workflow.
- **Lifecycle:** Draft → Complete → Locked (tras radicar).
- **Versioning:** sí, obligatorio.
- **Regeneration Rules:** si cambia después de que existe un Criterion Assessment o Case Blueprint vigente, ambos se marcan **"potentially stale"** — no se invalidan automáticamente (un cambio de teléfono no invalida una estrategia; un cambio de país de residencia podría). Requiere revisión humana explícita para decidir si dispara re-evaluación.
- **Single Source of Truth:** tablas tipadas del modelo objetivo (hoy, `intake_submissions.module1`/`module14`). Modificable por cliente (intake) o staff en su nombre.

### Evidence Item
- **Owner:** intake (Module9/Module10), o A0 en el futuro. Su contenido factual no lo modifica ningún motor de IA.
- **Consumers:** A1 (evalúa), A5 (prioriza, referencia), A3/A4 (citan).
- **Lifecycle:** Reported → Documented → Verified → Used.
- **Versioning:** sí — nueva versión al actualizar/agregar documento de soporte.
- **Regeneration Rules:** si un Evidence Item cambia después de que Criterion Assessment ya lo evaluó, ese Criterion Assessment se marca **"stale"** automáticamente — no se recalcula solo, requiere disparo explícito de A1. Si el criterio afectado es dominant dentro de un Case Blueprint ya aprobado, el Blueprint completo se marca "stale" (ver cascada completa más abajo).
- **Single Source of Truth:** tabla `evidence_items` (nueva, no existe hoy). Modificable por cliente/staff únicamente.

### Criterion Assessment
- **Owner:** A1, único y exclusivo. Ni siquiera A5 puede modificarlo.
- **Consumers:** A5 — input directo, nunca recalculado.
- **Lifecycle:** Generated → Current → Superseded.
- **Versioning:** sí, obligatorio — cada ejecución de A1 crea versión completa nueva.
- **Regeneration Rules:** ver cascada completa.
- **Single Source of Truth:** tabla `agent_intake_analysis` (necesita campo de versión explícito). Modificable únicamente por la ejecución de A1.

### Case Blueprint
- **Owner:** A5, único y exclusivo.
- **Consumers:** A3, A4 — lectura únicamente, ejecutan sin reinterpretar.
- **Lifecycle:** Proposed → Edited → Approved → Locked → Superseded.
- **Versioning:** sí, obligatorio — cada aprobación crea versión inmutable.
- **Regeneration Rules:** ver cascada completa. Adicionalmente: si el abogado edita manualmente un campo del Blueprint ya aprobado, eso crea una nueva versión Locked, no una edición silenciosa de la versión que ya gobernó documentos existentes.
- **Single Source of Truth:** tabla `case_strategy` (necesita versión explícita). Modificable por A5 (creación) y abogado (edición explícita antes de aprobar).

### Document Template
- **Owner:** configuración de sistema/firma.
- **Consumers:** A3, A4 (construcción de prompts).
- **Lifecycle:** Draft → Active → Deprecated.
- **Versioning:** sí.
- **Regeneration Rules:** cambios de plantilla no afectan documentos ya generados, solo futuros.
- **Single Source of Truth:** tabla nueva `document_templates` (no existe hoy). Modificable por admin de Organization o de plataforma.

### Generated Document
- **Owner:** A3 o A4, según tipo — nunca A5.
- **Consumers:** staff, futuro QA Engine.
- **Lifecycle:** Draft → Under Review → Approved by Attorney → Filed → Superseded.
- **Versioning:** sí — cada regeneración es nueva versión, historial conservado.
- **Regeneration Rules:** si el Case Blueprint que lo gobernó queda Superseded, el documento se marca **"stale — based on outdated strategy"**, sin borrarlo — requiere revisión humana para decidir regenerar.
- **Single Source of Truth:** unifica `agent_recommendation_letters`, `agent_petition_drafts`, `i129_form_drafts` (modelo de unificación a decidir en implementación). Modificable únicamente por su motor productor.

### Generation Job
- **Owner:** cada motor, al ejecutarse.
- **Consumers:** todo el sistema (trazabilidad).
- **Lifecycle:** Running → Completed / Failed.
- **Versioning:** no aplica — cada ejecución es su propia fila inmutable.
- **Regeneration Rules:** no aplica — es el registro mismo de qué se regeneró y cuándo.
- **Single Source of Truth:** tabla `agent_runs`. Solo el motor que la crea escribe en su fila (vía runId).

### Case Filing
- **Owner:** staff/abogado, acción humana explícita.
- **Consumers:** Case Event, futuro Client Case Monitor, futuro Learning Engine.
- **Lifecycle:** Prepared → Submitted → Superseded.
- **Versioning:** no en el sentido de Blueprint — Filings múltiples se relacionan entre sí, no se versionan unos sobre otros.
- **Regeneration Rules:** no aplica — es un acto, no una entidad que se regenera.
- **Single Source of Truth:** tabla nueva `case_filings` (no existe hoy). Modificable por staff.

### Case Event
- **Owner:** staff (registro manual), o futuro Client Case Monitor (vía API oficial de la agencia correspondiente).
- **Consumers:** Case Outcome, futuro Client Case Monitor, futuro Learning Engine.
- **Lifecycle:** ninguno propio — log append-only.
- **Versioning:** no aplica.
- **Regeneration Rules:** no aplica — es un hecho registrado, no se regenera.
- **Single Source of Truth:** tabla nueva `case_events` (no existe hoy). Insertado por staff o sistema; nunca modificado tras su creación (append-only real).

### Case Outcome
- **Owner:** staff, al recibir notificación real de la agencia — nunca un motor de IA.
- **Consumers:** hoy, nadie. Futuro: exclusivamente Learning Engine.
- **Lifecycle:** Pending → Decided.
- **Versioning:** no en sentido de Blueprint — se completa incrementalmente.
- **Regeneration Rules:** no aplica.
- **Single Source of Truth:** tabla nueva `case_outcomes` (no existe hoy), referenciando un Case Filing específico. Modificable por staff.

---

## Cascada completa de invalidación

Evidence Item cambia
→ Criterion Assessment que lo usaba: marcado "stale"
→ si Case Blueprint vigente depende de ese Criterion Assessment: marcado "stale"
→ si Generated Document depende de ese Case Blueprint: marcado "stale"
→ nada se borra ni regenera automáticamente en ningún nivel;
cada nivel requiere confirmación humana explícita antes de
propagar la regeneración al siguiente nivel.

**Principio de la cascada:** la invalidación se propaga automáticamente como *señal*, pero la regeneración real siempre requiere acción humana explícita en cada nivel — nunca es automática de punta a punta. Esto evita que un cambio menor dispare una cascada completa de regeneración de documentos legales ya aprobados, sin que nadie lo decidiera conscientemente. Ver `AUCIS_ARCHITECTURE_PRINCIPLES.md`, principio de Human-in-the-Loop.

---

## Distinción fundamental: acciones de la firma vs. hechos externos

Esta arquitectura separa explícitamente dos categorías de acontecimientos, que no deben mezclarse dentro de una misma entidad:

1. **Acciones ejecutadas por la firma** — bajo control de la organización (preparar el expediente, presentarlo, responder un RFE). Se modelan como lifecycle de la entidad correspondiente (ej. Case Filing: Prepared → Submitted).
2. **Eventos ocurridos en agencias externas** — fuera del control de la firma, solo observados y registrados (recibo asignado, RFE emitido, decisión final). Se modelan como Case Event — un log inmutable, nunca como transición de estado de una entidad cuyo owner es la firma.

Confundir ambas categorías dentro de una sola entidad viola la responsabilidad única: una entidad no puede ser dueña de transiciones que en realidad decide un tercero externo.
