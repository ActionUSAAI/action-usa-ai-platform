# AUCIS — Core Domain Model

**Estado:** Congelado (v1). Aprobado 2026-07-28, a partir de una sesión de diseño arquitectónico con Alex, posterior al rediseño de A5 (Case Strategy Engine). Ver `AUCIS_ARCHITECTURE_DECISIONS.md` para el razonamiento detrás de cada decisión estructural.

**Propósito de este documento:** fuente oficial de referencia sobre las entidades del dominio de AUCIS, su responsabilidad, relaciones, y reglas de ciclo de vida. Toda implementación futura debe construirse sobre este modelo, no contradecirlo — ver `AUCIS_ARCHITECTURE_PRINCIPLES.md` para los principios transversales que gobiernan cualquier extensión futura.

**Contexto de origen:** este modelo nace de una reflexión explícita de Alex: convertir AUCIS de "un conjunto de agentes independientes pensados para el uso interno de ACTION USA" a "una plataforma SaaS de inteligencia jurídica multi-tenant, escalable a múltiples firmas y categorías migratorias". Cada entidad aquí definida fue evaluada bajo ese criterio, no solo bajo las necesidades actuales de O-1A/EB-1A.

---

## Principio rector

Una sola fuente de verdad por tipo de información. Ninguna entidad duplica la responsabilidad de otra. Cada entidad tiene un único propósito claramente definido, un único owner, y consumidores que solo leen (nunca modifican) lo que no les pertenece.

---

## Nivel 1 — Multi-tenencia

### Organization (Tenant)
- **Propósito:** representa una firma de abogados de inmigración cliente del SaaS.
- **Responsabilidad:** raíz de aislamiento de datos — todo lo demás en el sistema cuelga, directa o indirectamente, de una Organization.
- **Almacena:** nombre de la firma, información de facturación, plan de suscripción, configuración (tipos de visa que maneja, plantillas propias).
- **Relaciones:** tiene muchos User, Client, Case.
- **Owner:** proceso de onboarding (no un motor de IA).
- **Consumers:** todos los motores, indirectamente, vía scoping de cada consulta.
- **Lifecycle:** Active → Suspended → Archived.
- **Versionado:** no — configuración viva, se actualiza in place.
- **Auditoría:** sí (cambios de plan, facturación).

### User
- **Propósito:** una persona con acceso al sistema.
- **Responsabilidad:** identidad y autenticación.
- **Almacena:** nombre, email, credenciales (Supabase Auth), organization_id.
- **Relaciones:** pertenece a una Organization; tiene un Role; puede estar asignado a varios Case.
- **Owner:** onboarding/invitación.
- **Consumers:** todo el sistema, para permisos y atribución.
- **Lifecycle:** Invited → Active → Suspended → Removed.
- **Versionado:** no.
- **Auditoría:** sí (login, cambios de rol).

### Role
- **Propósito:** nivel de permisos dentro de una Organization.
- **Responsabilidad:** define qué puede hacer un User.
- **Almacena:** nombre del rol, lista de permisos.
- **Relaciones:** asignado a User.
- **Nota abierta:** hoy el sistema tiene admin/supervisor/agent como enum simple. Para multi-firma real, probablemente necesita ser configurable por firma (socio, asociado, paralegal), no un enum fijo global. **No resuelto en este documento.**
- **Owner:** admin de la Organization.
- **Consumers:** todo el sistema.
- **Lifecycle:** N/A (configuración).
- **Versionado:** no.
- **Auditoría:** sí.

---

## Nivel 2 — Las personas del caso

### Client
- **Propósito:** la relación comercial — quién le paga a la firma. Ya existe como tabla `clients`.
- **Responsabilidad:** datos de contacto y facturación del cliente de la firma. No es necesariamente el beneficiario de la visa (ej. una empresa puede ser el cliente, y el beneficiario su empleado extranjero).
- **Almacena:** nombre, email, teléfono, organization_id.
- **Relaciones:** pertenece a una Organization; tiene uno o más Case.
- **Owner:** staff, al crear una nueva invitación.
- **Consumers:** A8 (Concierge), facturación futura.
- **Lifecycle:** Active → Inactive.
- **Versionado:** no — se actualiza in place.
- **Auditoría:** sí.

### Beneficiary
- **Propósito:** la persona que busca la visa. Hoy vive como JSON sin tipar dentro de `intake_submissions.module1`/`module2`.
- **Responsabilidad:** datos biográficos y migratorios del extranjero.
- **Almacena:** lo que hoy captura Module1 + Module2, como campos tipados en el modelo objetivo (no como JSON).
- **Relaciones:** pertenece a un Case.
- **Owner:** intake del cliente; en el futuro, también A0 (CV Extractor) como fuente secundaria alimentando el mismo owner.
- **Consumers:** A1, A3, A4, A5 — lectura únicamente. Ningún motor puede modificar esta entidad; si detecta un dato faltante o inconsistente, debe señalarlo vía Workflow, nunca corregirlo directamente.
- **Lifecycle:** Draft (en llenado) → Complete → Locked (tras radicar).
- **Versionado:** sí, obligatorio — cada cambio sustantivo crea una nueva versión, no sobreescribe (necesario para que Case Blueprint y Generated Document puedan referenciar "la versión del beneficiario tal como existía cuando se generó este documento").
- **Auditoría:** sí.

### Petitioner
- **Propósito:** la entidad legal que presenta la petición ante USCIS. Hoy vive como JSON sin tipar dentro de Module14. Puede ser una empresa o el propio beneficiario (auto-petición, común en EB-1A).
- **Responsabilidad:** datos de la empresa/persona peticionaria.
- **Almacena:** lo que hoy captura Module14, tipado.
- **Relaciones:** pertenece a un Case.
- **Owner:** intake.
- **Consumers:** A4 (I-129, Attorney Letter), A5.
- **Lifecycle:** igual que Beneficiary.
- **Versionado:** sí (el puesto ofrecido o la dirección de la empresa pueden cambiar antes de radicar).
- **Auditoría:** sí.

---

## Nivel 3 — El caso

### Case
- **Propósito:** la unidad central del sistema. Ya existe como tabla `cases`.
- **Responsabilidad:** agrupa todo lo relacionado con una petición migratoria específica de un Beneficiary.
- **Almacena:** tipo de caso, clasificación de visa, estado, fechas.
- **Relaciones:** pertenece a Organization y Client; tiene un Beneficiary, un Petitioner; tiene muchos Evidence Item, Criterion Assessment (uno vigente a la vez), Case Blueprint, Generated Document.
- **Owner:** creación manual (nueva invitación).
- **Consumers:** todos los motores.
- **Lifecycle:** ver Workflow, que formaliza esto.
- **Versionado:** no directamente — su estado cambia pero no requiere historial de versiones completo (Workflow ya cumple ese rol).
- **Auditoría:** sí (ya existe como `case_status_history`).

### Workflow (Case Stage)
- **Propósito:** formaliza el "estado" del caso, hoy implícito.
- **Responsabilidad:** define en qué etapa está el caso (intake → análisis → estrategia propuesta → estrategia aprobada → generación de documentos → revisión legal → listo para radicar → radicado).
- **Almacena:** etapa actual, historial de transiciones.
- **Relaciones:** pertenece a un Case.
- **Owner:** transiciones automáticas (ej. A1 completa → avanza etapa) y manuales (abogado marca "listo para radicar").
- **Consumers:** UI del panel, futuro Client Case Monitor.
- **Lifecycle:** es en sí mismo un lifecycle formalizado.
- **Versionado:** el historial de transiciones ya es una forma de versionado.
- **Auditoría:** sí.

---

## Nivel 4 — Evidencia

### Evidence Item
- **Propósito:** cada pieza individual de evidencia — premio, membresía, artículo, carta de referencia. Hoy vive como elementos de arrays dentro de JSON de Module9/Module10, sin identificador estable.
- **Responsabilidad:** representar un hecho verificable con su documentación de soporte.
- **Almacena:** tipo, criterio(s) al que aplica, descripción, fecha, organización relacionada, estado de verificación, archivo adjunto.
- **Relaciones:** pertenece a un Case; puede vincularse a uno o más Criterion Assessment; puede ser referenciada por un Generated Document.
- **Por qué es crítica:** es la entidad que permite que Case Blueprint produzca referencias verificables (`evidence_item_id`) en vez de texto en prosa que otros motores deben reinterpretar. **No implementada todavía — es la brecha técnica #1 señalada en A5_CASE_BLUEPRINT_SPECIFICATION_V1.md.**
- **Owner:** intake (Module9/Module10 hoy), o A0 (CV Extractor) en el futuro.
- **Consumers:** A1 (evalúa), A5 (prioriza y referencia), A3/A4 (citan directamente).
- **Lifecycle:** Reported → Documented (archivo adjunto) → Verified (staff confirmó) → Used (referenciado en un Generated Document).
- **Versionado:** sí — actualizar el documento de soporte crea una nueva versión, no reemplaza silenciosamente.
- **Auditoría:** sí.

### Criterion Assessment
- **Propósito:** el veredicto de A1 sobre un criterio específico. Hoy vive como fila JSON dentro de `agent_intake_analysis.criteria_scores`/`criteria_met`.
- **Responsabilidad:** registrar, para un criterio dado, si está satisfecho, con qué puntaje, y por qué.
- **Almacena:** criterion_key, estado, puntaje, notas, lista de Evidence Item que lo respaldan (referencia real).
- **Relaciones:** pertenece a un Case; referencia uno o más Evidence Item; consumido por Case Blueprint.
- **Owner:** A1, único y exclusivo. Ningún otro motor (ni siquiera A5) puede crear o modificar esta entidad.
- **Consumers:** A5 (input directo, nunca recalculado — "A1 mide, A5 decide").
- **Lifecycle:** Generated → Current (versión vigente) → Superseded (al re-ejecutar A1).
- **Versionado:** sí, obligatorio — cada ejecución de A1 crea una nueva versión completa, nunca sobreescribe.
- **Auditoría:** sí.

---

## Nivel 5 — Estrategia

### Case Blueprint
- **Propósito:** el contrato estratégico que gobierna el expediente. Producido por A5.
- **Responsabilidad:** especificación completa en `A5_CASE_BLUEPRINT_SPECIFICATION_V1.md`.
- **Relaciones:** pertenece a un Case; depende de la versión vigente de Criterion Assessment; referencia Evidence Item; consumido por Generated Document.
- **Owner:** A5, único y exclusivo.
- **Consumers:** A3, A4 — lectura únicamente, ejecutan sin reinterpretar.
- **Lifecycle:** Proposed → Edited → Approved → Locked → Superseded.
- **Versionado:** sí, obligatorio — cada aprobación crea una versión inmutable.
- **Auditoría:** sí.

---

## Nivel 6 — Generación documental

### Document Template
- **Propósito:** define la estructura/bloques que un tipo de documento debe seguir, independiente del contenido de un caso específico. No existe hoy — cada tipo de documento tiene su estructura hardcodeada en el prompt de su ruta.
- **Responsabilidad:** estructura reutilizable de documento.
- **Almacena:** tipo de documento, clasificación de visa aplicable, bloques/secciones requeridas.
- **Por qué importa para multi-tenencia:** si firmas distintas quieren personalizar formato, debe ser configurable por Organization, no fijo en código.
- **Relaciones:** pertenece a Organization (con versión por defecto del sistema, sobreescribible).
- **Owner:** configuración de sistema/firma, no un motor de IA.
- **Consumers:** A3, A4, al construir sus prompts.
- **Lifecycle:** Draft → Active → Deprecated.
- **Versionado:** sí.
- **Auditoría:** sí.

### Generated Document
- **Propósito:** unifica lo disperso hoy en `agent_recommendation_letters`, `agent_petition_drafts`, `i129_form_drafts`.
- **Responsabilidad:** el resultado final generado — carta, petición, formulario.
- **Almacena:** tipo, contenido/ruta, criterio(s) que cubre, qué versión de Case Blueprint lo gobernó, estado.
- **Relaciones:** pertenece a un Case; producido por un Generation Job; gobernado por una versión específica de Case Blueprint.
- **Owner:** A3 o A4, según el tipo — nunca A5.
- **Consumers:** staff, futuro Quality Assurance Engine.
- **Lifecycle:** Draft → Under Review → Approved by Attorney → Filed → Superseded.
- **Versionado:** sí — cada regeneración es una nueva versión, con historial conservado.
- **Auditoría:** sí.

### Generation Job
- **Propósito:** registro de ejecución de un motor. Ya existe como `agent_runs`.
- **Responsabilidad:** trazabilidad de cada ejecución.
- **Relaciones:** cada Criterion Assessment, Case Blueprint, y Generated Document tiene un Generation Job asociado que lo produjo.
- **Owner:** cada motor, al ejecutarse.
- **Consumers:** todo el sistema, para trazabilidad.
- **Lifecycle:** Running → Completed / Failed.
- **Versionado:** no aplica — cada ejecución es su propia fila inmutable.
- **Auditoría:** es en sí mismo el registro de auditoría de ejecución.

### Case Packet
- **Propósito:** el deliverable jurídico ensamblado, versionado y determinista que representa el expediente completo de un caso antes de radicarse — un snapshot inmutable, no el expediente en evolución continua.
- **Responsabilidad:** componer y congelar — nunca generar contenido, nunca validar consistencia, nunca decidir cuándo o si se radica.
- **Almacena:** lista ordenada de referencias `{generated_document_id, version}`, versión de Case Blueprint gobernante, referencia al Case Packet anterior en la cadena (si existe), estado.
- **Relaciones:** pertenece a un Case; referencia el conjunto de Generated Document ya aprobados (por ID y versión, nunca copia contenido); referencia la versión de Case Blueprint que gobernó el conjunto; es referenciado por Case Filing como la unidad que se radica.
- **Owner:** Document Generation Layer — único y exclusivo. Nunca editable manualmente por ningún humano ni por ningún otro componente.
- **Consumers:** Case Filing, Workflow Orchestration Service (solo lee `status` para gating), Presentation Layer, el abogado (revisión y confirmación de validación).
- **Lifecycle:** Assembling → Ready → Superseded. Sin estado de edición humana intermedia — cualquier corrección pasa por regenerar desde la fuente, nunca por editar directamente.
- **Versionado:** sí, obligatorio — versionado secuencial simple, con cadena por referencia (`previous_packet_id`) al Packet anterior, mismo patrón que Case Filing.
- **Auditoría:** sí, crítico — reconstruye exactamente qué versión de cada documento se incluyó, en qué orden, en qué momento.
- **Nota:** especificación completa en `CASE_PACKET_CONTRACT_V1.md`.

---

## Nivel 7 — Radicación y resultado

### Case Filing
- **Propósito:** representa el acto oficial, ejecutado por la firma, de presentar un conjunto de documentos ante USCIS.
- **Responsabilidad:** capturar los hechos logísticos del acto de radicación en sí — no la estrategia (Blueprint), no el resultado (Outcome), no lo que ocurre después en USCIS (Case Event).
- **Almacena:** submitted_at, receipt_number (nullable), receipt_confirmed_at, centro de servicio, modalidad de procesamiento, abogado responsable, tipo de filing (inicial/enmienda/respuesta a RFE/extensión).
- **Nota de proceso real:** el receipt_number normalmente no está disponible al momento de envío — llega aproximadamente 7-10 días después. Por eso es nullable y submitted_at/receipt_confirmed_at son campos independientes.
- **Relaciones:** pertenece a un Case; referencia el Case Packet (en estado Ready) que constituye la unidad radicada — no referencia Generated Document directamente, esa mediación ahora vive en Case Packet.
- **Owner:** staff/abogado, al radicar — acción humana explícita, nunca generada por un motor de IA.
- **Consumers:** Case Event (los eventos posteriores referencian este Filing), futuro Client Case Monitor, futuro Learning Engine.
- **Lifecycle:** Prepared → Submitted → Superseded. **Termina aquí** — todo lo posterior (recibo asignado, RFE, decisión) es responsabilidad de la firma solo en cuanto acción de radicar, no de seguimiento; eso vive en Case Event.
- **Versionado:** no en el mismo sentido que Blueprint — cada Filing es un evento propio; múltiples Filings del mismo Case se relacionan entre sí (uno de respuesta a RFE referencia al original), no se versionan unos sobre otros.
- **Auditoría:** sí, crítico.

### Case Event
- **Propósito:** registro inmutable, ordenado en el tiempo, de acontecimientos relevantes del expediente — independientemente de quién los origine. Reemplaza el concepto inicialmente propuesto de "USCIS Event", generalizado para no acoplar el modelo a una sola agencia.
- **Responsabilidad:** capturar hechos externos (USCIS asigna recibo, emite RFE, agenda biometría, decide) y, potencialmente, hechos internos relevantes de timeline, sin forzarlos como transiciones de estado de otra entidad.
- **Almacena:** event_type (de un futuro catálogo canónico — no texto libre), occurred_at, recorded_at, source (uscis/attorney/client/system, extensible a otras agencias), related_entity (típicamente Case Filing), data (payload flexible según el tipo).
- **Relaciones:** pertenece a un Case Filing (típicamente); puede referenciar otras entidades según el tipo de evento.
- **Owner:** staff (registro manual) o, en el futuro, el Client Case Monitor (vía APIs oficiales como la USCIS Case Status API).
- **Consumers:** Case Outcome (el evento terminal se resume ahí), futuro Client Case Monitor, futuro Learning Engine.
- **Lifecycle:** no tiene lifecycle propio de transiciones — es un log append-only de hechos inmutables.
- **Versionado:** no aplica (cada evento es su propia fila inmutable).
- **Auditoría:** es en sí mismo un mecanismo de auditoría.

### Case Outcome
- **Propósito:** el resultado final del caso ante USCIS, como síntesis derivada del log de Case Event, no como contenedor de campos dispersos.
- **Responsabilidad:** registrar el resultado terminal (aprobado/negado/retirado), fecha de decisión, y cualquier detalle estratégicamente relevante para consumo futuro del Learning Engine.
- **Relaciones:** pertenece a un Case Filing específico (no directamente al Case, para soportar múltiples Filings con resultados distintos — ej. RFE → re-filing → aprobación).
- **Owner:** staff, al recibir la notificación real de USCIS — nunca un motor de IA (es un hecho del mundo, no una inferencia).
- **Consumers:** hoy, nadie. En el futuro, exclusivamente el Learning Engine (no diseñado todavía).
- **Lifecycle:** Pending → Decided (approved/denied/withdrawn).
- **Versionado:** no en el mismo sentido que Blueprint — es un registro de hechos que se completa incrementalmente.
- **Auditoría:** sí, crítico — es el dato de mayor valor futuro para toda la plataforma.

---

## Entidades evaluadas y explícitamente descartadas por ahora

- **Filing** como parte de Generated Document o Case Outcome — descartado; ver ADR correspondiente en `AUCIS_ARCHITECTURE_DECISIONS.md`.
- **USCIS Event** como nombre de entidad — descartado en favor de Case Event; ver ADR correspondiente.
- **Immigration Classification** como entidad de catálogo separada — evaluado, no resuelto. Hoy cubierto conceptualmente por `canonical-criteria.ts`. Podría formalizarse si el sistema necesita soportar clasificaciones configurables por firma. **Pregunta abierta, no bloqueante.**

## Preguntas abiertas heredadas, no resueltas en este documento

1. ¿Role debe ser un enum fijo del sistema, o completamente configurable por Organization?
2. ¿Vale la pena separar "Petition" de "Case" para soportar múltiples peticiones sobre el mismo beneficiario a través del tiempo (ej. O-1A inicial + extensión)?
3. ¿Classification (tipo de visa) debe formalizarse como entidad de catálogo separada?
