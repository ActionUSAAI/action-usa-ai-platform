---
document: "Legal Decision Procedure Contract"
level: 2
status: Frozen
governed_by: "Architectural Constitution"
---

# Legal Decision Procedure Contract v1

## Estado

Frozen

## Alcance

Este contrato define exclusivamente la secuencia canónica mediante la cual se ejecuta un ciclo de evaluación jurídica una vez que la Legal Decision Cycle Policy ha autorizado su ejecución. Gobierna el comportamiento del dominio durante la ejecución del ciclo.

No define:

- las condiciones de autorización (Legal Decision Cycle Policy);
- la implementación técnica del procedimiento;
- la infraestructura de ejecución;
- el funcionamiento interno de los componentes de inteligencia;
- autenticación, autorización o permisos.

## Principio Rector

El Procedure comienza únicamente después de que la Legal Decision Cycle Policy haya autorizado la ejecución. Su responsabilidad consiste exclusivamente en definir la secuencia canónica del dominio, nunca las condiciones que permiten iniciarla ni la forma técnica en que se implementa.

---

## 1. Objetivo del Procedure

El Procedure define la secuencia canónica mediante la cual un caso autorizado es sometido a una nueva evaluación jurídica y, sobre ella, a la construcción de una nueva estrategia jurídica.

## 2. Punto de Entrada

El Procedure recibe un caso cuya autorización ya fue determinada por la Legal Decision Cycle Policy. Asume como precondición ya satisfecha que:

- `Case.initial_legal_petition IS NOT NULL`
- `Case.active_legal_petition IS NOT NULL`

El Procedure nunca vuelve a verificar estas condiciones, porque pertenecen exclusivamente a la Legal Decision Cycle Policy.

## 3. Secuencia Canónica

1. Se produce una nueva evaluación jurídica del caso, bajo la clasificación vigente al momento de iniciar el Procedure.
2. Sobre esa evaluación, se produce una nueva estrategia jurídica.

Esta secuencia es estrictamente ordenada: la segunda etapa depende de la existencia de la primera; nunca ocurre de forma independiente ni anticipada a ella.

Qué forma concreta toma "evaluación" y "estrategia" en la implementación actual del Core Legal Engine es definido por otro contrato, no por este. Este contrato permanece válido aunque esa correspondencia evolucione en el futuro.

## 4. Condiciones de Terminación

**Terminación correcta:** el Procedure concluye exitosamente cuando ambas etapas de la Secuencia Canónica se completaron.

**Terminación prematura:** ocurre si la primera etapa no logra completarse, en cuyo caso la segunda etapa nunca se inicia.

Este contrato no define qué ocurre con los artefactos parcialmente producidos en caso de terminación prematura. Esa decisión pertenece a una política transaccional independiente.

Este contrato tampoco define el comportamiento del Procedure ante un cambio de contexto del caso durante su propia ejecución. Esa decisión pertenece a una política de concurrencia independiente.

## 5. Artefactos Producidos

Produce:

- una nueva evaluación jurídica;
- una nueva estrategia jurídica construida sobre dicha evaluación.

La forma concreta de ambos artefactos es definida por otro contrato.

Nunca produce:

- documentos generados;
- modificaciones sobre `Initial Legal Petition`;
- modificaciones sobre `Active Legal Petition`.

## 6. Invariantes

- El Procedure nunca modifica `Initial Legal Petition`.
- El Procedure nunca modifica `Active Legal Petition`; únicamente la consulta.
- El Procedure nunca modifica artefactos ya existentes de ejecuciones anteriores; únicamente puede provocar que pierdan vigencia por la aparición de nuevos artefactos, conforme a ADR-010 y Architecture Principle 11.
- El Procedure nunca produce la segunda etapa de la Secuencia Canónica sin que la primera se haya completado.
- El Procedure nunca decide, por sí mismo, si debe ejecutarse.

## 7. Relación con la Infrastructure

La Infrastructure determina cómo se ejecuta el Procedure. El Procedure determina únicamente qué secuencia lógica de dominio debe ejecutarse. La selección de mecanismos técnicos de ejecución pertenece exclusivamente a la Infrastructure y queda fuera del alcance de este contrato.

## 8. Relación con la Policy

La Legal Decision Cycle Policy determina si un caso puede iniciar un ciclo jurídico. El Legal Decision Procedure define exclusivamente la secuencia que debe seguir un caso una vez que dicha autorización ya fue concedida.

La Policy termina su responsabilidad en el momento en que autoriza o rechaza la ejecución. El Procedure comienza únicamente después de esa autorización.

---

## Verification Checklist

✓ No introduce decisiones de implementación.

✓ No invade responsabilidades de la Policy.

✓ No invade responsabilidades de Infrastructure.

✓ No contradice ningún contrato congelado.

✓ No menciona nombres concretos de artefactos del Core Legal Engine en ningún punto normativo.

✓ No introduce garantía transaccional ni política de concurrencia no aprobadas.

✓ No promete resultados; únicamente define la secuencia canónica del dominio.

✓ Supera la prueba de estabilidad a cinco años aun cuando cambien los componentes de inteligencia o la infraestructura de ejecución.

**Legal Decision Procedure Contract v1 queda oficialmente congelado.**
