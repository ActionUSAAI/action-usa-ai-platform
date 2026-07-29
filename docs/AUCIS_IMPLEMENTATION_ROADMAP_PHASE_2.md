# AUCIS — Implementation Roadmap: Fase 2 (Core Legal Engine Implementation)

**Estado:** Congelado. Aprobado 2026-07-29. Organizado por capacidades del sistema, no por componentes individuales. Se apoya completamente en los seis documentos de `aucis-architecture-v1` y en `AUCIS_BLUEPRINT_CONTRACT_V1.md` — no redefine ninguna decisión ya aprobada.

## Objetivo general

Al finalizar la Fase 2, AUCIS debe demostrar, con un caso real, cinco capacidades del sistema — no cinco componentes implementados.

## Stage 0 — Contract Freeze

**Objetivo único:** congelar los contratos internos que todo componente posterior consumirá, antes de que exista una sola línea de código que dependa de su forma. Aplicación directa de la regla Contract First Development (`AUCIS_BLUEPRINT_CONTRACT_V1.md`).

**Contratos a congelar:**
- **Criterion Assessment Contract** — forma exacta de la entrada que A5 consume de A1.
- **Case Blueprint Contract** — ya completado (`AUCIS_BLUEPRINT_CONTRACT_V1.md`).
- **Evidence Item Contract** — forma de la entidad tipada, antes de migrar ningún dato real.
- **Workflow State Machine** — estados y transiciones válidas del Control Plane, antes de escribir su primera línea de código.

**Por qué esta etapa reduce refactorizaciones futuras:** cada uno de los componentes de la Fase 2 depende de la forma de al menos uno de estos cuatro contratos. Si un contrato cambia después de que varios componentes ya lo consumen, el costo de corrección se multiplica por cada consumidor ya construido. Congelar primero convierte cada implementación posterior en "construir contra una forma ya fija", no en "construir y descubrir después que la forma estaba mal".

## Las cinco capacidades (Milestones)

### Capacidad 1 — Core Legal Decision Pipeline
*El sistema puede evaluar objetivamente y decidir estratégicamente, con contratos versionados y trazables.*
- **Componentes:** versionado de Criterion Assessment y Case Blueprint; actualización de A5 a la especificación v1.
- **Adquirida cuando:** un caso de prueba genera un Criterion Assessment versionado y un Case Blueprint conforme al Blueprint Contract v1, aprobado por Alex con calidad igual o superior a la versión anterior.

### Capacidad 2 — Governed Document Generation
*Ningún documento puede generarse sin que el Core Legal Decision Pipeline lo haya autorizado primero.*
- **Componentes:** Workflow Orchestration Service (Control Plane) — MVP, contra la Workflow State Machine congelada en Stage 0.
- **Adquirida cuando:** una llamada directa a cualquier ruta de generación documental, sin pasar por el panel, es rechazada explícitamente si no existe un Blueprint approved vigente.

### Capacidad 3 — Blueprint-Driven Generation
*Los documentos generados reflejan fielmente las decisiones del Blueprint — sin reinterpretarlas, sin marcadores sin completar.*
- **Componentes:** A3 y A4 como Blueprint Executors, contra el Blueprint Contract v1. A3 antes que A4 (validar el patrón en el componente más simple primero).
- **Adquirida cuando:** la Attorney Petition Letter generada para el caso Neira Rincón (o equivalente) ya no contiene marcadores sin completar para ningún criterio con evidencia disponible — prueba directa de que A4_ATTORNEY_EVIDENCE_GAP.md quedó cerrado.

### Capacidad 4 — Structured Evidence
*La evidencia del caso es una entidad propia, versionada, referenciable por identidad estable.*
- **Componentes:** Evidence Item, contra su Contract congelado en Stage 0, con migración aditiva de datos reales existentes.
- **Adquirida cuando:** el mismo caso de prueba de la Capacidad 1, regenerado, produce un Blueprint cuyo evidence_dependencies usa evidence_item_id real en vez de description — cerrando la Brecha Técnica #1.

### Capacidad 5 — Automated Consistency Validation
*El sistema puede detectar, antes de que un humano lo haga, vacíos o inconsistencias respecto al Blueprint.*
- **Componentes:** QA Engine (MVP), acotado a cobertura documental de dominant_criteria/supporting_criteria.
- **Adquirida cuando:** corrido contra un caso con un criterio deliberadamente sin cobertura documental, el QA Engine lo identifica correctamente.

## Riesgos técnicos y mitigación

| Riesgo | Mitigación |
|---|---|
| Los 5 clientes reales activos podrían verse afectados por el gating de la Capacidad 2 sin transición cuidadosa. | Regla de "grandfather" explícita; nunca activar el bloqueo sin verificar el estado real de cada caso activo primero. |
| Regresión de calidad al actualizar A5 — la versión anterior ya está validada con buenos resultados reales. | Ningún cambio de prompt se da por bueno sin comparación directa contra un caso ya evaluado. |
| Migración de Evidence Item sobre datos reales de producción. | Migración estrictamente aditiva, período de convivencia, sin borrado del JSON original hasta verificación exhaustiva. |
| Rigidez de los Blueprint Executors ante casos atípicos. | attorney_instructions como escape hatch humano, nunca deshabilitado. |
| Scope creep en QA Engine. | Definition of Done estrictamente acotada al MVP de cobertura de criterios. |
| Contratos de Stage 0 mal diseñados, descubierto solo después de construir varios componentes encima. | Riesgo que Stage 0 existe para mitigar — cada contrato se revisa explícitamente contra los seis documentos de arquitectura congelada antes de darse por cerrado. |

## Criterios para declarar terminada la Fase 2

1. Las cinco capacidades están adquiridas, verificadas con evidencia real, no solo con build limpio.
2. Al menos un caso real (o sintético rico) recorrió el pipeline completo bajo el modelo nuevo, de punta a punta.
3. Ningún camino de código en producción sigue produciendo el formato de Blueprint anterior.
4. Los diez Architectural Invariants (once, tras el ajuste del 2026-07-29) están verificablemente aplicados en al menos un caso real, no solo documentados.
5. Los 5 clientes reales activos no sufrieron ninguna interrupción de servicio atribuible a los cambios de esta fase.
6. Los cuatro contratos de Stage 0 no sufrieron ningún breaking change durante la implementación de las cinco capacidades — si alguno lo sufrió, es una señal de que Stage 0 no se hizo con suficiente rigor.

## Decisiones diferidas

Decisiones identificadas durante el diseño de la Fase 2, deliberadamente no resueltas aquí — registradas para trazabilidad, no para bloquear el inicio de la implementación.

### Versioning Policy (para Fase 3)

Antes de iniciar la Fase 3, será necesario diseñar una política formal de versionado de la plataforma que defina, como mínimo:

- Evolución de contratos internos (más allá del Blueprint Contract — cualquier contrato futuro).
- Compatibilidad entre versiones.
- Breaking changes — proceso formal, no solo la regla ya establecida en el Blueprint Contract.
- Convivencia de múltiples versiones del sistema simultáneamente.
- Estrategia de migración para organizaciones (tenants) — relevante una vez que exista más de una Organization real en producción.
- Políticas de deprecación.

**Esta política no forma parte de la Fase 2.** Se registra únicamente como decisión diferida, para mantener trazabilidad arquitectónica y evitar que se diseñe de forma improvisada más adelante sin este contexto.

### Contract Registry / Contract Catalog (evolución futura, sin fase asignada)

Durante el diseño de la Fase 2 se identificó un patrón repetido: `Blueprint Contract`, `Criterion Assessment Contract`, `Evidence Item Contract`, y `Workflow State Machine` son todos instancias del mismo concepto — un contrato interno de integración entre componentes de la plataforma. Cuando AUCIS madure, es probable que surja la necesidad de un `Contract Registry`/`Contract Catalog` que gestione de forma uniforme la versión, compatibilidad, consumidores autorizados, y breaking changes de todos los contratos existentes, en vez de que cada uno se documente y versione de forma aislada como hoy.

**No se diseña ahora.** Cuatro contratos son señal de un patrón, no evidencia suficiente para justificar la construcción de infraestructura de gestión alrededor de ellos todavía. Se registra aquí únicamente para que, si en una fase futura el número de contratos internos crece significativamente, exista trazabilidad de que este patrón ya fue identificado con antelación.
