# AUCIS v2.0 — Capa de Estrategia por Encima de la Generación Documental

**Estado:** Visión de producto, no implementada. Registrada 2026-07-22, a partir de una propuesta de Alex tras evaluar el pipeline completo contra un caso real aprobado (Neira Rincón, O-1A).

## Diagnóstico de fondo

AUCIS v1 tiene un motor de generación documental sólido y validado (A1 Intake Analyzer, A3 Testimonial/Institucional, A4 Attorney Letter/I-129) — pero genera documentos **ejecutando** una estrategia que un humano define manualmente (`petitionStrategy`: multi-criterio vs. logro único), no **decidiendo** esa estrategia por sí mismo. Los hallazgos de la sesión del 2026-07-22 evaluando la Attorney Letter contra el caso Neira Rincón (ver `docs/A3_TESTIMONIAL_VOICE_REDESIGN.md`) son síntomas directos de esta ausencia: la carta "no conecta criterios" y "no construye narrativa" porque no existe una capa previa que decida cuál es la teoría del caso antes de redactar.

## Los cuatro módulos de v2.0

### 1. Case Strategy Engine
Define la teoría jurídica del caso antes de generar cualquier documento — cuáles criterios son el núcleo del caso, cuál es el ángulo narrativo central, y en qué secuencia lógica se cuenta la historia del beneficiario (ej.: "identificó un problema → desarrolló una metodología → la publicó → fue invitado a presentarla → fue contratado con mejor remuneración → terminó regulando el sector"). Hoy no existe — el A1 evalúa criterios individuales, pero no construye una narrativa unificadora entre ellos.

**Insight de Alex, sesión 2026-07-22:** no todos los criterios tienen el mismo peso; una estrategia real asignaría énfasis relativo (ej. "35% Original Contributions, 25% Critical Capacity, 20% Published Material...") en vez de tratar los cinco criterios como igualmente centrales.

### 2. Evidence Gap Analyzer
Identifica qué evidencia falta para fortalecer un criterio `DESARROLLABLE` o rescatar uno `AUSENTE`. Existe parcialmente en el esquema (`agent_petition_drafts.evidence_checklist`, `criteria_covered`, `criteria_missing`, `completeness_pct`), pero ningún código puebla esas columnas hoy — pendiente ya identificado en sesiones anteriores, nunca implementado.

### 3. RFE Prediction Engine
Estima qué criterios son más susceptibles de generar un Request for Evidence y por qué, antes de radicar. No existe en absoluto hoy — es el módulo más ausente de los cuatro. Podría fundamentarse en los mismos casos RFE reales que ya sirven de contexto a los prompts actuales (ej. el caso Neira citado como FUNDAMENTO en el Motor Testimonial).

### 4. Document Generation Engine
Ya existe y está validado (A3/A4) — en v2.0, pasa de generar documentos de forma relativamente autónoma a **ejecutar** la estrategia ya definida por el Case Strategy Engine, incorporando los hallazgos de los otros dos módulos (qué evidencia usar, qué riesgos de RFE mitigar explícitamente en el texto).

## Relación con hallazgos ya documentados el mismo día

Este documento es la extensión lógica de dos hallazgos de la sesión 2026-07-22:
- `docs/A3_TESTIMONIAL_VOICE_REDESIGN.md` — el problema de que las cartas "argumentan" en vez de "narrar"/"certificar" es, en parte, un síntoma de la ausencia del Case Strategy Engine: sin una narrativa central definida, cada criterio se redacta de forma aislada.
- El hallazgo de reutilización de evidencia (una misma carta como evidencia principal de un criterio y complementaria de otro) es una capacidad que un Evidence Gap Analyzer real podría gestionar de forma sistemática, no ad-hoc.

## Alcance y prioridad

No se ha decidido el orden de implementación de los cuatro módulos, ni si deben construirse antes o después de completar el rediseño de voz del Motor Testimonial/Institucional (documentos separados). Pendiente de decisión en una sesión de planificación dedicada.
