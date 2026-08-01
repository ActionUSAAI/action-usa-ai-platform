# AUCIS — Capability Model

**Estado:** Congelado. Aprobado 2026-08-01. Primer y más alto nivel de la jerarquía documental de AUCIS (Capability Model → Platform Architecture → Domain Contracts), descubierto y validado durante el proceso de discovery de Case Packet.

**Propósito:** responder qué capacidades de negocio ofrece AUCIS, independientemente de cómo estén construidas. Este documento no menciona Data Plane, Control Plane, ni ningún patrón técnico de implementación — esa información vive en `AUCIS_PLATFORM_ARCHITECTURE.md` y en los Domain Contracts individuales.

**Audiencia:** liderazgo de producto, negocio, futuros inversionistas — cualquiera que necesite entender qué hace la plataforma sin necesitar entender cómo está construida.

**Gobierna:** decisiones de priorización, inversión, y roadmap. No gobierna ubicación de componentes ni patrones de implementación — eso pertenece a los niveles inferiores de esta jerarquía.

---

## Principio de este documento

Cada componente de AUCIS sirve a exactamente una de cuatro capacidades de negocio, o actúa como coordinación transversal entre ellas. Ninguna capacidad de este documento determina cómo se organiza el software — esa es una pregunta completamente distinta, respondida en `AUCIS_PLATFORM_ARCHITECTURE.md`.

---

## Capacidad 1 — Producto Legal: Razonamiento

**Qué es:** la capacidad de evaluar objetivamente la elegibilidad de un caso y construir la estrategia jurídica que lo sustenta.

**Por qué existe:** es el diferenciador central de AUCIS frente a cualquier software de gestión de casos migratorios existente en el mercado — ningún competidor conocido evalúa elegibilidad ni construye estrategia razonada antes de generar documentos.

**Componentes que la sirven:**

| Componente | Estado |
|---|---|
| CV Extractor (A0) | Diseñado, no implementado |
| Criterion Assessment Engine (A1) | Implementado |
| Case Strategy Engine (A5) | Implementado |
| Document Processor (A2, extracción) | Implementado |
| QA Engine | No implementado |
| RFE Prediction Engine | No implementado |
| Learning Engine | No implementado |
| Knowledge Engine | No implementado |

## Capacidad 2 — Producto Legal: Entrega

**Qué es:** la capacidad de producir y entregar el deliverable jurídico final — el expediente completo, coherente, listo para presentarse.

**Por qué existe:** es lo que un cliente real compra cuando contrata la firma — no un análisis, no una estrategia, sino un producto legal completo y presentable.

**Componentes que la sirven:**

| Componente | Estado |
|---|---|
| Testimonial / Institutional Letter Generator (A3) | Implementado |
| Attorney Document Generator (A4) | Implementado |
| Case Packet (ensamblaje del expediente final) | Diseñado, no implementado |
| Radicación del expediente | Diseñado, no implementado |

## Capacidad 3 — Relación Comercial

**Qué es:** la capacidad de gestionar la relación de negocio y comunicación con el cliente — facturación, cobro, coordinación.

**Por qué existe:** una firma de inmigración necesita cobrar y comunicarse con sus clientes independientemente de la calidad de su producto legal — es una función de negocio real, aunque no sea el diferenciador de AUCIS.

**Componentes que la sirven:**

| Componente | Estado |
|---|---|
| A8 — Concierge (comunicación con el cliente) | Implementado |
| Facturación/Cobro | No implementado |
| CRM | No implementado |
| Calendario/Coordinación | No implementado |

## Capacidad 4 — Operación de Plataforma

**Qué es:** la capacidad de observar y mantener la salud técnica y operativa de la plataforma misma.

**Por qué existe:** ninguna de las tres capacidades anteriores puede sostenerse de forma confiable sin visibilidad sobre cómo se está comportando el sistema — pero esta capacidad no le agrega valor al cliente final, solo protege la operación.

**Componentes que la sirven:**

| Componente | Estado |
|---|---|
| Registro de auditoría | Parcial (agent_runs) |
| Métricas de uso | No implementado |
| Monitoreo de errores | Parcial (logging manual) |

---

## Coordinación Transversal

**Workflow Orchestration Service** no pertenece a ninguna de las cuatro capacidades — sirve a las cuatro simultáneamente, garantizando que cada una respete las precondiciones de las demás (ej. que no se genere un documento sin estrategia aprobada, que no se radique sin pago confirmado). No es una quinta capacidad de negocio — es la función de coordinación que hace posible que las cuatro operen de forma consistente entre sí.

---

## Qué este documento nunca debe contener

- Nombres de capas técnicas (Data Plane, Control Plane, Infrastructure Layer).
- Patrones de implementación (Aggregate, Event, Process Manager, Application Service).
- Decisiones de ubicación de código o de despliegue.

Cualquier pregunta de esa naturaleza pertenece a `AUCIS_PLATFORM_ARCHITECTURE.md` o a los Domain Contracts individuales — nunca a este documento.

## References

- `AUCIS_PLATFORM_ARCHITECTURE.md` — cómo se organiza estructuralmente cada una de estas capacidades.
- `AUCIS_CORE_DOMAIN_MODEL.md` — entidades del dominio que sustentan estas capacidades.
- Contratos individuales (`*_CONTRACT_V1.md`) — patrones técnicos de cada Aggregate.
