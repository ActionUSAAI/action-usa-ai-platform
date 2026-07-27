# Hallazgo — El Motor Abogado (multi-criterio) redacta sin acceso al contenido real de evidencia

**Estado:** Hallazgo documentado 2026-07-24, bloqueado intencionalmente hasta construir el Case Strategy Engine (`docs/AUCIS_V2_STRATEGY_LAYER.md`). No es una tarea de desarrollo inmediata.

## El hallazgo

Investigando cómo integrar A6 (Salary Research) con el Motor Abogado, se descubrió que la estrategia **multi-criterio** de `a4-attorney-letters/route.ts` nunca recibe el contenido real de la evidencia al redactar el argumento de cada criterio. El prompt (`buildTipo0UserPrompt`) solo recibe, por criterio: la cita legal, el label, y el número de Exhibit asignado — nunca el contenido de las cartas testimoniales/institucionales, ni de `Module10` (evidencia estructurada por criterio).

Confirmado con evidencia real: la consulta a `case_exhibits` solo selecciona `criterion_citation, criterion_label, exhibit_number` — el campo `document_refs` (que sí contiene las referencias a la evidencia real) nunca se lee ni se pasa al modelo.

**Explicación retroactiva de un patrón ya observado:** esto explica los marcadores entre corchetes sin completar (`[name of publication(s)]`, `[describe the specific nature of his role]`, etc.) vistos en la Attorney Petition Letter generada para el caso Neira Rincón (evaluación del 2026-07-22) — el modelo no estaba siendo impreciso por descuido, genuinamente no tenía la información real disponible para completar esos espacios.

**Excepción parcial:** la estrategia `singleAchievement` sí recibe contenido real, pero únicamente de `Module10.awards` — un solo tipo de evidencia entre varios posibles.

## Por qué se documenta y no se corrige de inmediato

Un fix aislado (conectar `document_refs` o `Module10` directamente al prompt actual) resolvería el síntoma, pero el **Case Strategy Engine** (primer módulo de `AUCIS_V2_STRATEGY_LAYER.md`) va a rediseñar de fondo cómo se decide qué evidencia respalda cada argumento y con qué narrativa — incluyendo, según los hallazgos de evaluación del 2026-07-22, conectar criterios entre sí en vez de tratarlos como compartimentos aislados. Corregir el gap de evidencia ahora, de forma aislada, arriesga tener que rediseñarlo de nuevo cuando se construya el Strategy Engine.

## Relación con A6 (Salary Research)

A6 fue el origen de este hallazgo — su valor completo (inyectar datos reales de BLS en el argumento del criterio de alta remuneración) depende de que el Motor Abogado tenga acceso a contenido real de evidencia, no solo metadata. Ver `docs/A6_SALARY_RESEARCH_DESIGN.md`, sección de integración con Attorney Letter, marcada como dependiente de este hallazgo.

## Alcance del fix futuro (cuando se aborde, vía Case Strategy Engine)

- Conectar `case_exhibits.document_refs` (o las fuentes de evidencia originales de `Module10`) al prompt del Motor Abogado, para las 5+ criterios de la estrategia multi-criterio, no solo `awards`.
- Diseñar cómo el Case Strategy Engine decide qué evidencia específica usar por criterio, con qué énfasis relativo (ver hallazgo de evaluación 2026-07-22 sobre peso desigual entre criterios).
- Evaluar si esto también resuelve la falta de conexión narrativa entre criterios, otro hallazgo de la misma evaluación.
