---
document: "Blueprint Execution Contract"
level: 4
status: Frozen
governed_by: "legal-decision-procedure-contract.md (docs/governance/level-2-policies-procedures/)"
---

# AUCIS — Blueprint Execution Contract v1

**Estado:** Frozen. Aprobado 2026-08-13.

Este documento no redefine las reglas de consumo del Blueprint. Presupone íntegramente `blueprint-contract.md (docs/governance/level-4-contracts/)` y únicamente documenta el comportamiento interno de ejecución de Document Generation Layer cuando esas reglas ya han sido satisfechas.

## Alcance

Este documento cubre exclusivamente:

1. Qué significa ejecutar un Blueprint.
2. Qué libertad de redacción conserva Document Generation Layer durante la ejecución de un Blueprint.
3. Qué debe hacer un generador cuando el Blueprint es ambiguo.
4. Qué debe hacer un generador cuando el Blueprint no contiene información suficiente para completar una decisión.
5. Cuándo debe detener la generación y escalar a revisión humana en lugar de inferir.

No cubre: consumidores, permisos, reglas de consumo, reglas de integridad, versionado, ni responsabilidades del productor del Blueprint — todo eso pertenece exclusivamente a `blueprint-contract.md (docs/governance/level-4-contracts/)`.

## Principio Rector

Document Generation Layer ejecuta decisiones jurídicas; nunca las reconstruye.

Toda libertad concedida por este contrato existe únicamente para expresar con mayor claridad una decisión ya tomada por el Core Legal Engine. Si una decisión necesita ser reinterpretada, modificada o completada, la ejecución debe detenerse y la responsabilidad retorna al Core Legal Engine mediante una nueva versión del Blueprint.

---

## 1. Qué significa ejecutar un Blueprint

Ejecutar es el acto de producir texto que exprese, sin alterar, una decisión ya tomada. Ejecutar consume el *contenido* de una decisión (qué se decidió) y produce *forma lingüística* (cómo se dice) — nunca produce nueva sustancia jurídica. Una ejecución correcta es aquella donde, si se revirtiera el texto generado a su decisión original, esa decisión sería idéntica a la que el Blueprint ya contenía.

Ejecutar no es: evaluar, priorizar, decidir, corregir, ni completar con juicio jurídico propio. Es la misma distinción que ya separa a A1 de A5 (medir vs. decidir), aplicada un nivel más abajo en la cadena, entre decidir (A5) y expresar (Document Generation Layer).

## 2. Límites de la libertad de redacción durante la ejecución de un Blueprint

Document Generation Layer conserva libertad exclusivamente sobre la forma lingüística de una decisión ya tomada: elección de palabras, sintaxis, orden de las oraciones dentro de un párrafo, cohesión, fluidez, tono, y estilo de voz apropiado al tipo de documento.

Esta libertad tiene un límite estructural claro: puede cambiar *cómo* se dice algo, nunca *qué* se dice. Dos redacciones distintas de la misma instrucción del Blueprint son ambas válidas si, y solo si, un lector no podría inferir de ninguna de las dos una decisión distinta a la que el Blueprint contiene.

Esta libertad no incluye estructura documental (capítulos, orden de secciones, conversión de `argument_sequence` en outline) — esa responsabilidad ya está asignada exclusivamente a A4 por `blueprint-contract.md (docs/governance/level-4-contracts/)`.

## 3. Qué debe hacer un generador cuando el Blueprint es ambiguo

Un Blueprint es ambiguo cuando, siendo técnicamente válido según las Reglas de Integridad del Blueprint Contract, su contenido admite más de una interpretación razonable sobre qué decir o cómo conectarlo con la evidencia disponible.

Ante ambigüedad genuina, el generador no elige la interpretación que le parezca más razonable — la ambigüedad en la decisión jurídica no es responsabilidad de quien ejecuta, es una señal de que la decisión necesita más precisión de quien la tomó. El comportamiento correcto es el descrito en la Sección 5.

## 4. Qué debe hacer un generador cuando el Blueprint no contiene información suficiente

Una carencia de información es distinta de una ambigüedad: no es que el Blueprint admita dos lecturas, es que el Blueprint simplemente no cubre algo que el documento necesita para completarse (ej. un dato factual que ningún campo del Blueprint ni de la evidencia referenciada contiene).

El generador nunca origina ese dato faltante — ni por inferencia razonable, ni por patrón típico de documentos similares, ni por generalización desde otros casos. Un vacío de información se trata igual que una ambigüedad: no se resuelve internamente, se escala.

Esto es distinto, y no sustituye, a las Brechas Técnicas ya documentadas en `A5_CASE_BLUEPRINT_SPECIFICATION_V2.md` (ej. Brecha #1, Evidence Item no tipada) — aquellas describen limitaciones estructurales del lado de producción del Blueprint; esta sección describe el comportamiento correcto del lado de ejecución cuando esas limitaciones, u otras, producen un vacío real.

## 5. Cuándo debe detener la generación y escalar a revisión humana

El generador detiene su ejecución y escala a revisión humana, en vez de completar por inferencia, en cualquiera de estos dos casos: (a) ambigüedad genuina según la Sección 3, o (b) información insuficiente según la Sección 4.

Escalar significa: producir el documento hasta el punto exacto donde la ambigüedad o el vacío ocurre, marcar explícitamente esa sección como pendiente de decisión humana, y continuar generando el resto del documento donde el Blueprint sí es suficiente y claro — nunca detener la generación completa por un vacío parcial, y nunca rellenar el vacío con una inferencia razonable para evitar la interrupción.

Este comportamiento es la aplicación directa, a nivel de ejecución de documentos, del principio de Human-in-the-Loop ya establecido para toda la plataforma — la ambigüedad y la carencia de información son, por naturaleza, terreno de juicio humano, no de ejecución.

---

## References

- `blueprint-contract.md (docs/governance/level-4-contracts/)` — reglas de consumo, permisos, e integridad del Blueprint; documento del que este depende íntegramente.
- `A5_CASE_BLUEPRINT_SPECIFICATION_V2.md` — Brechas Técnicas relacionadas con el origen de vacíos de información.
- `AUCIS_ARCHITECTURE_PRINCIPLES.md` — Principio de Human-in-the-Loop, base de la Sección 5.
- `AUCIS_ARCHITECTURE_DECISIONS.md` — ADR-008, base de la distinción entre decisión y ejecución.
