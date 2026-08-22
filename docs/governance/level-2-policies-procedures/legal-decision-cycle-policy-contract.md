---
document: "Legal Decision Cycle Policy Contract"
level: 2
status: Frozen
governed_by: "Architectural Constitution"
---

# Legal Decision Cycle Policy Contract v1

## Estado

Frozen

## Alcance

Este contrato define exclusivamente:

1. Qué condiciones deben cumplirse para que un caso esté autorizado a ejecutar un ciclo de evaluación jurídica.
2. Qué garantías mínimas debe cumplir el resultado de ese ciclo para considerarse jurídicamente válido.

No define: cómo se implementa el procedimiento técnico (Legal Decision Procedure, diseño separado), qué hace A1 o A5 internamente, ni ningún detalle de UI, autenticación, o infraestructura.

## Principio Rector

Ningún procedimiento de evaluación jurídica puede ejecutarse sobre un caso cuya identidad jurídica (Initial/Active Legal Petition) no esté confirmada. La autorización es siempre previa a la ejecución, nunca implícita en ella.

---

## 1. Precondiciones de Autorización

La política autoriza la ejecución de un ciclo si y solo si:

- `Case.initial_legal_petition IS NOT NULL`
- `Case.active_legal_petition IS NOT NULL`

Ambas condiciones deben cumplirse simultáneamente — no existe autorización parcial.

## 2. Independencia respecto del Invocador

La Legal Decision Cycle Policy no define quién está autorizado a solicitar una evaluación jurídica. Su única responsabilidad consiste en determinar si un caso cumple las condiciones de dominio necesarias para autorizar la ejecución de un Legal Decision Procedure. La autenticación, autorización y permisos del invocador pertenecen a una capa distinta del sistema y quedan fuera del alcance de este contrato.

En consecuencia, la respuesta de la Política debe ser determinística e independiente del actor que la consulte.

## 3. Garantías de Autorización

Una vez autorizado el procedimiento, esta Política garantiza únicamente que dicho procedimiento se inicia sobre un caso cuya identidad jurídica cumple las condiciones de dominio establecidas en este contrato:

- El Criterion Assessment producido queda vinculado a la `Active Legal Petition` vigente en el momento de la ejecución (via `classification_used`, ya existente).
- El Blueprint producido queda vinculado a ese Criterion Assessment específico (via `criterion_assessment_id`, ya existente).
- Ninguna fila anterior (Criterion Assessment o Blueprint previos) se modifica — solo pueden pasar a `superseded` por la aparición de estas nuevas filas, conforme a ADR-010 y Architecture Principle 11.

## 4. Qué NO garantiza esta Política

- No garantiza que el Procedimiento tenga éxito técnico — eso es responsabilidad del Procedimiento.
- No garantiza ningún resultado sustantivo del análisis — sigue siendo responsabilidad exclusiva de A1/A5.
- No reemplaza ni modifica el Blueprint Contract ni el Blueprint Execution Contract — opera en una capa anterior.

## 5. Relación con el Procedimiento y la Infraestructura

Este contrato no dicta ninguna implementación técnica del Procedimiento, ni de la infraestructura que lo ejecuta (`waitUntil`, colas, workers, o cualquier otro mecanismo futuro) — deliberadamente. La única exigencia de esta Política es: el Procedimiento nunca puede ejecutarse sin que la Política lo haya autorizado primero.

## 6. Invariantes

- La Política nunca modifica el estado del caso.
- La Política nunca ejecuta agentes.
- La Política nunca produce Blueprint.
- La Política nunca persiste datos.
- La Política nunca reemplaza decisiones del abogado.
- La Política únicamente autoriza o rechaza el inicio del procedimiento.

## 7. Principio de Estabilidad

La validez de esta Política es independiente del procedimiento técnico utilizado para ejecutar un ciclo de evaluación jurídica.

En consecuencia, cualquier evolución futura del Core Legal Engine, de la infraestructura de ejecución o de los componentes de inteligencia artificial no requerirá modificar este contrato mientras las condiciones de autorización definidas aquí permanezcan invariantes.

---

## Verification Checklist

✓ No define implementación técnica, solo condiciones y garantías.

✓ No menciona A1, A5, Claude, IA, ni ningún mecanismo técnico en ningún punto normativo.

✓ Independiente del invocador.

✓ Separación explícita entre autorización y ejecución, ahora también en el título de la Sección 3.

✓ Sección de Invariantes protege contra expansión de alcance.

✓ Principio de Estabilidad protege contra reapertura injustificada por evolución tecnológica futura.

✓ Consistente con ADR-010 y Architecture Principle 11.

✓ No contradice Blueprint Contract ni Blueprint Execution Contract.

**Legal Decision Cycle Policy Contract v1 queda oficialmente congelado.**
