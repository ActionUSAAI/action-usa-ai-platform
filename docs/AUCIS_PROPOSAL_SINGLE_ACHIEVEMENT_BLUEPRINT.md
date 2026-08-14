# AUCIS_PROPOSAL_SINGLE_ACHIEVEMENT_BLUEPRINT.md

## Estado

Proposal — No Normative Authority

## Authority

Este documento no modifica, sustituye ni interpreta ningún contrato, especificación, ADR o principio arquitectónico vigente.

Su único propósito es registrar una hipótesis de evolución arquitectónica respaldada por la evidencia disponible al momento de su redacción.

Ninguna implementación podrá justificarse únicamente con base en este documento.

## Problema

`a4-attorney-letters/route.ts`, ruta `petitionStrategy: "singleAchievement"`, decide internamente qué premio del beneficiario "califica como logro único mayor" — el estándar de *major, internationally recognized award*. Esta es una decisión jurídica de fondo, no una decisión de redacción.

Según `AUCIS_BLUEPRINT_EXECUTION_CONTRACT.md`, Sección 1, ejecutar "no es... evaluar, priorizar, decidir". Esta ruta viola esa distinción: A4 evalúa y decide, en vez de ejecutar una decisión ya tomada por el Core Legal Engine (A5).

`A5_CASE_BLUEPRINT_SPECIFICATION_V2.md` no contiene ningún campo, en ninguna sección, que permita a A5 declarar cuál premio documentado considera el logro único ancla. `foundational_evidence` fue considerado como candidato natural durante el diseño de la solución de `multiCriteria` (commits `fe6b4d4`–`52b6e05`), pero nunca se verificó ni se implementó para este propósito.

Confirmado mediante grep directo sobre `a5-case-strategy/route.ts` (2026-08-14): el prompt de A5 no contiene ninguna instrucción relacionada con identificar un premio ancla; trata `awards` como cualquier otro criterio de la lista (confirmado/no confirmado, con puntaje), sin tratamiento diferenciado para el caso donde existen varios premios y se necesita elegir uno.

## Hypothesis

La extensión más natural, sin introducir una entidad nueva, sería que A5 declare el premio ancla dentro de `foundational_evidence` (ya existe, ya se usa para anclar la teoría del caso a hechos específicos) o mediante un campo nuevo y acotado — p. ej. `single_achievement_candidate: { description: string, why_qualifies: string } | null` — poblado únicamente cuando `awards` es el criterio dominante del caso.

A4 dejaría de decidir y pasaría a leer ese campo, aplicando exactamente el mismo patrón ya implementado para `multiCriteria`: si el campo existe, se ejecuta; si no existe o es ambiguo, se escala según la Sección 4/5 del Execution Contract, en vez de decidir por inferencia propia.

Esta hipótesis no ha sido diseñada en detalle ni validada contra los ocho documentos de arquitectura — es una dirección posible, no una especificación.

## Evidencia disponible

- Un caso real (Neira Rincón) donde se descubrió la brecha durante la implementación de `multiCriteria` — sin premios múltiples, no ejerce la ruta `singleAchievement` directamente.
- Un caso sintético (Juan Lopez, `443bf280-ec96-4b8f-b9bd-c3809b5a1787`), diseñado deliberadamente sin ambigüedad (un premio claramente calificante vs. uno claramente no calificante), donde el modelo identificó y justificó correctamente el premio ancla sin ningún anclaje al Blueprint — evidencia de robustez del modelo en casos bien diferenciados, no de que la arquitectura actual sea correcta.
- El mismo experimento reveló que el modelo complementó su análisis con contexto real sobre la organización otorgante (FIDIC) no incluido en los datos proporcionados — señal de que, ante un vacío de información, el modelo recurre a su propio conocimiento de trasfondo en vez de escalar, el mismo patrón de riesgo que el Execution Contract prohíbe para el resto de la evidencia del caso.

## Evidencia faltante

- Ningún caso real en producción con `petitionStrategy: singleAchievement` y más de un premio documentado.
- Ningún caso con premios genuinamente ambiguos en mérito relativo (el caso sintético fue diseñado a propósito para evitar esa ambigüedad).
- Ningún RFE real, propio o de referencia, que documente una petición rechazada o cuestionada por selección incorrecta del logro único.
- Ninguna confirmación de si el patrón de "contexto de trasfondo no solicitado" (observado con FIDIC) se repite con organizaciones otorgantes menos documentadas públicamente, donde el riesgo de invención sería mayor.

## Activation Threshold

Cualquiera de las siguientes condiciones, verificada con evidencia real (no sintética):

- Tres casos reales independientes donde la ruta `singleAchievement` reciba más de un premio documentado, permitiendo observar el comportamiento del modelo ante variación real de datos.
- Un RFE real, propio o de referencia pública, atribuible a una selección incorrecta o insuficientemente fundamentada del logro único mayor.
- Evidencia equivalente que demuestre, con datos reales, que el riesgo teórico descrito en este documento se manifestó en producción.

## Activation Procedure

Cuando se alcance el umbral:

1. Abrir un discovery formal, con el mismo rigor aplicado al Blueprint Field Audit y al `AUCIS_BLUEPRINT_EXECUTION_CONTRACT.md`.
2. Verificar que la evidencia que activó el umbral sigue siendo válida al momento del discovery (no ha quedado obsoleta por otros cambios de arquitectura).
3. Decidir, con esa evidencia, si el problema amerita una extensión formal de Blueprint v2 hacia v3, o si se resuelve en otra capa (p. ej., una validación adicional dentro de A4 que no requiera tocar el contrato del Blueprint).
4. La superación del umbral no autoriza automáticamente una implementación.

## References

- `A5_CASE_BLUEPRINT_SPECIFICATION_V2.md`
- `AUCIS_BLUEPRINT_CONTRACT_V2.md`
- `AUCIS_BLUEPRINT_EXECUTION_CONTRACT.md`
- `AUCIS_ARCHITECTURE_DOCUMENTATION_GOVERNANCE.md`
- `AUCIS_ARCHITECTURE_DECISIONS.md` — ADR-008
- Commits `fe6b4d4`, `b4fd9f4`, `52b6e05`, `4367038`, `f4f7c7b`
