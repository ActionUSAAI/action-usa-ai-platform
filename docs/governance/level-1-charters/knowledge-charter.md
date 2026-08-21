---
document: "Knowledge Charter"
level: 1
status: Frozen
governed_by: "Architectural Constitution"
---

# Knowledge Charter v1

## Alcance

Este documento consolida las propiedades fundamentales del conocimiento jurídico migratorio, demostradas con evidencia durante la auditoría del Intake, los contratos ya congelados, y la Validación Operacional End-to-End 001. No define implementación. Describe la naturaleza del conocimiento; el Data Governance Charter define cómo debe tratarse.

## Principio Rector

Toda afirmación de este documento debe ser rastreable a evidencia verificada. Ninguna hipótesis sin esa verificación se incluye aquí.

## Parte I — Propiedades Fundamentales del Conocimiento

### Naturaleza

1. **Validación de la Ontología.** El conocimiento observado fue completamente clasificable utilizando la Ontología ya congelada en el Data Governance Charter, sin requerir nuevas categorías.
2. **Fuente de Verdad.** Todo conocimiento del dominio tiene una única fuente de verdad identificable, sin duplicación.
3. **Independencia del Consumo.** El conocimiento existe independientemente de quién lo consuma. Los consumidores aparecen posteriormente; su presencia o ausencia no es propiedad del conocimiento mismo.

### Comportamiento

4. **Ciclo de Vida.** El conocimiento posee un ciclo de vida verificable: nace en captura, puede permanecer inerte o activarse según exista un consumidor, y su valor puede ser constante, transformarse, o agotarse en un único uso.
5. **Evolución.** El conocimiento nunca se destruye al evolucionar el expediente; puede adquirir nuevas representaciones conservando su identidad.
6. **Valor Latente.** El conocimiento conserva su potencial de generar valor independientemente del momento en que fue capturado. La ausencia de un consumidor inmediato no disminuye su importancia.
7. **Momentos de Activación.** La existencia temporal de un conocimiento y su desbloqueo lógico son propiedades distintas y separables.

### Relaciones

8. **Dependencias.** Existen relaciones de dependencia real entre piezas de conocimiento. Toda dependencia debe demostrarse mediante evidencia.
9. **Propósitos.** Un mismo propósito puede ser servido por múltiples dominios distintos; un mismo dominio puede servir múltiples propósitos simultáneamente.
10. **Captura vs. Consumo.** El acto de capturar conocimiento y el acto de consumirlo con valor real son eventos distintos.
11. **Reutilización.** El conocimiento puede reutilizarse múltiples veces sin necesidad de volver a capturarse.
12. **Pérdida de Granularidad.** El conocimiento puede transformarse en una representación resumida antes de llegar a etapas posteriores de razonamiento, sin que su forma original se propague más allá de esa transformación.

## Parte II — Límites de la Evidencia

**Ciclo de Vida (4):** verificado desde Captura hasta Document Generation. Sin evidencia sobre Presentación ante USCIS o RFE.

**Dependencias (8):** el estándar de "debe demostrarse" existe porque al menos un caso examinado no confirmó una dependencia inicialmente asumida.

**Independencia del Consumo (3):** confirmado en quince módulos con disciplina explícita de "no verificado mediante evidencia" donde correspondía.

## Parte III — Hallazgos de la Auditoría (Informe, no Principios)

- Clasificación de reutilización sobre los diecisiete dominios auditados (9 universales, 3 parcialmente compartidos, 4 específicos, 1 ajeno).
- Mezcla de conocimiento jurídico y comercial observada en un caso específico (Module12).
- Siete instancias de dependencia hacia `module1.visaType` en vez de `active_legal_petition`, en cinco módulos.
- Seis módulos con pérdida de granularidad hacia A5.
- Cinco Anchor Domains confirmados con evidencia estructural.
- Dos implementaciones primitivas de Descubrimiento ya presentes en el sistema actual.
