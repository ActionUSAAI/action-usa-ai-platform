# AUCIS — Platform Architecture

**Estado:** Congelado (v1). Aprobado 2026-07-28. Documento arquitectónico de más alto nivel del proyecto — organiza AUCIS como plataforma SaaS de inteligencia jurídica, clasificando los componentes existentes y futuros dentro de un modelo de capas + planos.

**No redefine** entidades del dominio (`AUCIS_CORE_DOMAIN_MODEL.md`), reglas de interacción (`AUCIS_DOMAIN_INTERACTION_ARCHITECTURE.md`), la especificación del Blueprint (`A5_CASE_BLUEPRINT_SPECIFICATION_V1.md`), decisiones (`AUCIS_ARCHITECTURE_DECISIONS.md`), ni principios (`AUCIS_ARCHITECTURE_PRINCIPLES.md`). Los usa como fundamento y los organiza espacialmente.

**Cambio de lenguaje que motiva este documento:** de aquí en adelante, AUCIS se describe primero por capa/plano ("esto pertenece al Core Legal Engine", "esto es responsabilidad del Workflow Orchestration Service"), no por nombre de agente numerado (A0, A1...). Los motores numerados siguen existiendo internamente, pero dejan de ser la unidad principal de conversación sobre la arquitectura.

---

## Dos planos, no una pila de capas homogénea

AUCIS se organiza en dos planos de naturaleza distinta — no todas las "capas" son iguales entre sí:

- **Data Plane:** las capas que transforman información del dominio — reciben datos, los procesan, producen resultados nuevos. Presentation, Application, Evidence, Core Legal Engine, Document Generation, Integration, y en el futuro Validation, Prediction, Knowledge, Learning.
- **Control Plane:** el Workflow Orchestration Service, en solitario. No transforma información del dominio — observa el estado de todo el Data Plane y decide si/cuándo cada transición puede ocurrir. Corresponde al patrón Process Manager/Saga de Domain-Driven Design.

Tratar a Workflow como "una capa más" (incluso "transversal") fue una clasificación intermedia descartada durante el diseño — ver nota al final de este documento. La distinción de planos, no de capas, es la que refleja con precisión su naturaleza.

---

## Diagrama conceptual de flujo — de punta a punta

```
Cliente se registra
    │
    ▼
PRESENTATION LAYER          (Client Portal + Staff Console)
    │
    ▼
APPLICATION LAYER           (recepción de solicitudes, autenticación, persistencia)
    │
    ▼
EVIDENCE LAYER              (captura y normalización de hechos del caso)
    │
    ▼
CORE LEGAL ENGINE           (evaluación objetiva → decisión estratégica)
    │            ╲
    │              ╲── consulta ──▶ KNOWLEDGE LAYER (futuro)
    ▼
DOCUMENT GENERATION LAYER    (ejecuta el Blueprint, sin reinterpretarlo)
    │
    ▼
INTEGRATION LAYER            (radicación y seguimiento ante la agencia externa)
    │
    ├──▶ VALIDATION LAYER (futuro)  ──▶  PREDICTION LAYER (futuro)
    │
    ▼
LEARNING LAYER (futuro)       (Case Blueprint + Case Outcome → Knowledge Layer)
```

Este es el **Data Plane** — el flujo secuencial de datos del caso. Por encima y observando todo este flujo, sin ser un paso más de él:

```
┌─────────────────────────────────────────────────────────────────┐
│  CONTROL PLANE — Workflow Orchestration Service                   │
│  Observa el estado de cada capa del Data Plane. Aplica la          │
│  cascada de invalidación (AUCIS_DOMAIN_INTERACTION_ARCHITECTURE). │
│  Gatea qué transición puede ocurrir y cuándo — nunca transforma    │
│  información del dominio, nunca decide contenido, solo permite     │
│  o bloquea el paso de una capa a la siguiente.                    │
└─────────────────────────────────────────────────────────────────┘
```

Todo corre sobre **Infrastructure Layer** (Vercel, Supabase, Anthropic API) — base técnica, no parte del flujo de negocio.

---

## Las capas del Data Plane

### 1. Presentation Layer
- **Objetivo:** único punto de contacto humano con el sistema — sin lógica de negocio.
- **Responsabilidad:** renderizar el formulario de intake (Client Portal) y el panel de staff (Staff Console); capturar interacción, nunca decidir.
- **Componentes:** formulario de intake multi-módulo, paneles del caso (a1-panel, a5-panel, a3a4-panel, a2-panel).
- **Consume:** exclusivamente Application Layer.
- **Produce:** solicitudes HTTP hacia Application Layer.
- **Dependencias:** Application Layer únicamente.
- **Principios que respeta:** Human-in-the-Loop, Explainable AI.
- **Evolución aislada:** rediseño visual completo sin afectar capas inferiores, mientras respete el contrato de las rutas API.

### 2. Application Layer
- **Objetivo:** tejido conector — recibe solicitudes, valida, orquesta llamadas, persiste.
- **Responsabilidad:** autenticación/autorización (scoping por Organization), validación de entrada, invocación de motores. No razona legalmente ni genera documentos.
- **Componentes:** rutas API existentes (a1-intake-analyzer, a5-case-strategy, a3-testimonial-letters, a3-institutional-letters, a4-attorney-letters, a4-i129-form), A8 Concierge.
- **Consume:** Presentation Layer, Evidence Layer, Core Legal Engine, Document Generation Layer.
- **Produce:** respuestas HTTP, registros en Infrastructure Layer.
- **Dependencias:** todas las capas inferiores orquestadas.
- **Principios que respeta:** Multi-Tenant desde el Origen, Auditability by Design.
- **Evolución aislada:** rutas nuevas o cambio de framework HTTP sin afectar el Core Legal Engine.

### 3. Evidence Layer
- **Objetivo:** asegurar que la evidencia esté capturada y normalizada antes de que el Core Legal Engine razone.
- **Responsabilidad:** extraer y estructurar hechos del caso, sin razonar sobre su valor legal.
- **Componentes:** A0 (CV Extractor, futuro), A2 (Document Processor), la entidad Evidence Item (pendiente de implementación tipada).
- **Consume:** Application Layer.
- **Produce:** Evidence Item estructurada.
- **Dependencias:** Application Layer únicamente hacia arriba.
- **Principios que respeta:** Single Source of Truth, Version Everything.
- **Evolución aislada:** agregar A0 sin que A1 sepa el origen de la evidencia — A1 solo consume Evidence Item.
- **Por qué no es Core Legal Engine:** prepara los hechos, no decide sobre ellos.

### 4. Core Legal Engine
**Los componentes sin los cuales AUCIS deja de ser una plataforma de inteligencia jurídica y se convierte en un generador de documentos con plantillas.**
- **Objetivo:** única fuente de razonamiento jurídico de toda la plataforma.
- **Responsabilidad:** evaluar objetivamente (Criterion Assessment) y decidir estratégicamente (Case Blueprint).
- **Componentes:** **A1 (Criterion Assessment) y A5 (Case Strategy Engine) — únicamente estos dos.** "A1 mide. A5 decide."
- **Consume:** Evidence Item; en el futuro, Knowledge Layer (vía Reasoning Provenance).
- **Produce:** Criterion Assessment (versión vigente), Case Blueprint (versionado).
- **Dependencias:** Evidence Layer. Ninguna dependencia hacia capas de generación o presentación.
- **Principios que respeta:** todos, en particular Explainable AI y Single Source of Truth.
- **Evolución aislada:** rediseñar cómo A5 construye el Blueprint sin que Document Generation Layer cambie, mientras el contrato de A5_CASE_BLUEPRINT_SPECIFICATION_V1.md se mantenga estable.

### 5. Document Generation Layer
- **Objetivo:** ejecutar, sin reinterpretar, lo que el Core Legal Engine decidió.
- **Responsabilidad:** convertir el Case Blueprint en documentos reales.
- **Componentes:** A3 (Testimonial, Institucional), A4 (Attorney Letter, I-129), Document Template.
- **Consume:** Case Blueprint (solo en estado approved — regla del Control Plane), Evidence Item referenciada.
- **Produce:** Generated Document.
- **Dependencias:** Core Legal Engine (vía gating del Control Plane).
- **Principios que respeta:** Human-in-the-Loop; nunca modifica decisiones del Blueprint, solo las ejecuta (ADR-008).
- **Evolución aislada:** nuevos tipos de documento (nueva categoría migratoria) sin tocar el Core Legal Engine — el Blueprint ya es genérico por diseño.

### 6. Integration Layer
- **Objetivo:** conectar AUCIS con el mundo exterior a la firma.
- **Responsabilidad:** todo lo que cruza la frontera entre lo que la organización controla y los hechos externos (Principio 9).
- **Componentes:** futuro Client Case Monitor (Case Status API oficial de USCIS, alimenta Case Event), Market Intelligence Engine (evolución de Salary Research, BLS OEWS), Resend, futuras integraciones (NVC, Departamento de Estado).
- **Consume:** Case Filing.receipt_number, solicitudes de evidencia externa.
- **Produce:** Case Event, datos de mercado para Evidence Layer.
- **Dependencias:** APIs de terceros — única capa con dependencias externas a AUCIS.
- **Principios que respeta:** Acciones vs. Hechos Externos (implementación directa de este principio), Auditability by Design.
- **Evolución aislada:** nueva integración = más filas de Case Event con source distinto, sin tocar otras capas.

### 7. Validation Layer *(futuro)*
- **Objetivo:** verificar consistencia del expediente completo antes de radicar.
- **Componentes:** QA Engine.
- **Consume:** conjunto de Generated Document + Case Blueprint que los gobernó (primera verificación real de que A3/A4 siguieron el Blueprint — cierra parcialmente la Brecha Técnica #3).
- **Produce:** señales de inconsistencia, nunca correcciones automáticas.
- **Dependencias:** Document Generation Layer.
- **Evolución aislada:** se construye después sin requerir cambios en capas anteriores.

### 8. Prediction Layer *(futuro)*
- **Objetivo:** anticipar riesgo de RFE, desde la perspectiva del oficial revisor.
- **Componentes:** RFE Prediction Engine.
- **Consume:** salida de Validation Layer — dependencia secuencial obligatoria.
- **Produce:** señales de riesgo para revisión humana.

### 9. Knowledge Layer *(futuro)*
- **Objetivo:** acumular conocimiento jurídico reutilizable — por firma (privado) y global (anonimizado).
- **Componentes:** Knowledge Layer.
- **Consume:** salida de Learning Layer.
- **Produce:** insumos de razonamiento para A5, reflejados como Reasoning Provenance (source_type: org_pattern/global_pattern).
- **Regla de aislamiento:** los patrones de una Organization nunca deben filtrarse a otra — pendiente de diseño detallado.
- **Evolución aislada:** el Core Legal Engine ya está preparado para consumirla (Reasoning Provenance existe desde el diseño del Blueprint) sin cambiar su estructura.
- **Nota para evolución futura:** "Knowledge Layer" nombra hoy tanto la capa como su único componente conceptual — riesgo de ambigüedad ya identificado. Cuando se diseñe en detalle, probablemente se descomponga en componentes propios (ej. Firm Knowledge Store, Global Knowledge Store, Embedding Index, Similarity Engine, Pattern Repository), cada uno con nombre distinto al de la capa que los contiene. No se diseña ahora — solo se anota para evitar la confusión de nombres cuando llegue el momento.

### 10. Learning Layer *(futuro)*
- **Objetivo:** convertir resultados reales en conocimiento reutilizable.
- **Componentes:** Learning Engine.
- **Consume:** Case Blueprint (versión que gobernó cada Filing) + Case Outcome.
- **Produce:** actualizaciones a Knowledge Layer.
- **Dependencias:** Control Plane (para saber cuándo hay un Case Outcome completo), Core Legal Engine (lectura histórica).
- **Evolución aislada:** por diseño (Case Outcome/Case Filing ya separados del Blueprint desde su concepción), no requiere cambios retroactivos a capas anteriores.

### 11. Infrastructure Layer
- **Objetivo:** sostener técnicamente todas las capas anteriores.
- **Componentes (por categoría abstracta, no por proveedor):** LLM Providers, Storage Providers, Hosting Providers, Identity Providers, Notification Providers. Nombrar esta capa por categoría de proveedor, no por proveedor específico, evita acoplar el documento a decisiones de infraestructura que pueden cambiar (mismo principio aplicado en ADR-005 a Case Event/source).
- **Implementación actual:** Anthropic (LLM Providers), Supabase (Storage Providers + Identity Providers, vía Postgres/Auth/Storage/RLS — implementación técnica de Multi-Tenant desde el Origen), Vercel (Hosting Providers), Resend (Notification Providers).
- **Dependencias:** ninguna interna.
- **Evolución aislada:** en teoría migrable sin que ninguna capa de negocio lo note (ej. sustituir el LLM Provider actual por otro); en la práctica, la capa de mayor fricción de cambio.

---

## El Control Plane

### Workflow Orchestration Service
- **Objetivo:** gobernar transversalmente el ciclo de vida del caso completo — no procesar datos, decidir cuándo cada capa de procesamiento puede actuar.
- **Responsabilidad:** hacer cumplir la cascada de invalidación y las reglas de gating en cualquier punto donde una entidad del dominio cambie de estado.
- **Componentes:** la entidad Workflow/Case Stage, el disparo automático A1→A5 (waitUntil), las transiciones de Case Blueprint.status y Case Filing.status.
- **Consume:** eventos de cambio de estado de todas las capas del Data Plane.
- **Produce:** decisiones de gating (¿puede generarse un documento ahora?), señales de invalidación ("stale").
- **Dependencias:** visibilidad bidireccional sobre Evidence Layer, Core Legal Engine, Document Generation Layer, Integration Layer — no depende de ellas en el sentido de una pila de capas, las observa.
- **Principios que respeta:** Human-in-the-Loop (la cascada nunca regenera automáticamente, solo señala), Version Everything.
- **Patrón de referencia (DDD):** Process Manager / Saga — coordina una secuencia de negocio de larga duración a través de múltiples contextos, sin poseer lógica de dominio propia.
- **Evolución aislada:** se pueden agregar etapas nuevas al ciclo de vida del caso sin tocar cómo A1 o A5 razonan — el Control Plane solo observa y gatea.

---

## Clasificación completa de componentes

| Componente | Plano / Capa | Estado |
|---|---|---|
| Client Portal, Staff Console | Data Plane — Presentation Layer | Existe |
| Rutas API (a1, a3×2, a4×2, a5, a8) | Data Plane — Application Layer | Existe |
| A8 — Concierge | Data Plane — Application Layer | Existe |
| A0 — CV Extractor | Data Plane — Evidence Layer | Diseñado, no implementado |
| A2 — Document Processor | Data Plane — Evidence Layer | Existe |
| Evidence Item (tipada) | Data Plane — Evidence Layer | No implementada (Brecha Técnica #1) |
| **A1 — Criterion Assessment** | **Data Plane — Core Legal Engine** | Existe |
| **A5 — Case Strategy Engine** | **Data Plane — Core Legal Engine** | Existe (pendiente de actualizar al nuevo Blueprint Spec) |
| A3 — Letter Generator | Data Plane — Document Generation Layer | Existe |
| A4 — Petition Builder | Data Plane — Document Generation Layer | Existe |
| Document Template | Data Plane — Document Generation Layer | No implementada |
| QA Engine | Data Plane — Validation Layer | No implementado |
| RFE Prediction Engine | Data Plane — Prediction Layer | No implementado |
| Client Case Monitor | Data Plane — Integration Layer | No implementado |
| Market Intelligence Engine | Data Plane — Integration Layer | Diseñado, no implementado |
| Knowledge Layer | Data Plane — Knowledge Layer | No implementado |
| Learning Engine | Data Plane — Learning Layer | No implementado |
| Workflow Orchestration Service | **Control Plane** | Parcialmente existe (gating de A5-panel construido; máquina de estados formal, no) |
| Vercel, Supabase, Anthropic API | Infrastructure Layer | Existe |

---

## Nota de proceso: por qué "capa transversal" fue descartada como clasificación de Workflow

Durante el diseño de este documento se consideraron tres alternativas para representar a Workflow: (1) capa secuencial dentro del flujo, (2) capa transversal que observa todas las demás, (3) plano de control independiente, distinto en naturaleza de cualquier capa. Las opciones 1 y 2 fueron descartadas: ambas seguían tratando a Workflow como una "capa", lo cual invita a ubicarlo dentro de una pila de dependencias direccionales — pero Workflow no transforma datos del dominio (a diferencia de toda capa real) y necesita visibilidad simultánea y bidireccional sobre múltiples capas a la vez, no una posición fija en una secuencia. La clasificación como Control Plane, distinto del Data Plane, resuelve esta ambigüedad de raíz.

---

## Architectural Invariants

Estas reglas no deben romperse salvo aprobación explícita mediante un ADR nuevo en `AUCIS_ARCHITECTURE_DECISIONS.md`. Cada invariante cita su documento de origen — esta lista es un índice de verificación rápida, no una fuente de verdad paralela.

| # | Invariante | Origen |
|---|---|---|
| 1 | El Core Legal Engine es la única fuente de razonamiento jurídico de la plataforma. | Sección "Core Legal Engine" de este documento |
| 2 | Ningún componente fuera del Core Legal Engine puede reinterpretar el Case Blueprint — solo ejecutarlo. | ADR-008, `A5_CASE_BLUEPRINT_SPECIFICATION_V1.md` |
| 3 | Workflow pertenece al Control Plane, no al Data Plane. | Sección "Dos planos" de este documento |
| 4 | El Data Plane nunca gobierna al Control Plane — la relación de observación/gating es unidireccional desde Workflow hacia las demás capas. | Sección "El Control Plane" de este documento |
| 5 | Ningún sistema de IA modifica automáticamente decisiones jurídicas ya aprobadas. | Principio 3 (Human-in-the-Loop), `AUCIS_ARCHITECTURE_PRINCIPLES.md` |
| 6 | Todo aprendizaje ocurre después de que existe un Case Outcome — nunca antes. | ADR-004, relación Case Blueprint/Case Outcome |
| 7 | Ningún componente escribe directamente en Knowledge Layer. | Sección "Knowledge Layer" de este documento — solo Learning Layer produce actualizaciones a Knowledge Layer |
| 8 | Todo conocimiento nuevo en Knowledge Layer debe originarse en Learning Layer. | Sección "Learning Layer" de este documento |
| 9 | Toda decisión jurídica relevante debe ser explicable — qué información usó, qué la influenció, qué razonamiento siguió. | Principio 4 (Explainable AI), `AUCIS_ARCHITECTURE_PRINCIPLES.md` |
| 10 | Toda modificación relevante de una entidad estratégica queda auditada — quién, cuándo, por qué. | Principio 8 (Auditability by Design), `AUCIS_ARCHITECTURE_PRINCIPLES.md` |
