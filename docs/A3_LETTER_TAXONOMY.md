# A3 — Taxonomía de Cartas (Letter Generator)

**Estado:** Fase de diseño arquitectónico. No implementado.
**Versión:** 1.0
**Última actualización:** 2026-07-09

## Propósito

A3 genera borradores `.docx` limpios (sin membrete — el cliente imprime, firma manualmente, y re-sube) para los distintos tipos de carta que sustentan una petición O-1A/O-1B/EB-1A. Cada tipo de carta tiene una voz retórica distinta, una fuente de datos distinta en el intake, y —en algunos casos— un motor de generación distinto.

**Principio rector heredado de METHODOLOGY.md §12:** el peso probatorio ante USCIS correlaciona con el cumplimiento del mínimo regulatorio, no con la sofisticación del lenguaje. A3 no debe optimizar por prosa elaborada; debe optimizar por completitud de los elementos que el criterio regulatorio exige.

**Riesgo de diseño activo:** reutilización casi verbatim de párrafos (especialmente de cierre) entre firmantes y casos distintos. A3 debe variar deliberadamente la construcción léxica y sintáctica de cada carta, preservando el patrón retórico subyacente.

## Motores de generación

A3 no es un motor único — son tres motores especializados que comparten infraestructura pero difieren en voz y estructura:

| Motor | Voz | Tipos de carta que cubre |
|---|---|---|
| **Motor Abogado** | Preparador del caso (Alex) | Tipo 0 (Attorney Petition Letter), Tipo 0b (Consultation Exception Letter) |
| **Motor Testimonial Personal** | Colega, supervisor, cliente, mentor | Cartas de referencia individual (Módulo 9) |
| **Motor Institucional** | Organización, asociación, experto reconocido | Opinión consultiva / no-objection, cartas de certificación |

## Catálogo de tipos de carta

| Tipo | Voz / Motor | Obligatoria | Condición de activación | Fuente de datos (intake) |
|---|---|---|---|---|
| **Tipo 0 — Attorney Petition Letter** | Motor Abogado | Sí, en todo caso | Siempre | A1 (análisis de caso), todos los módulos |
| **Tipo 0b — Consultation Exception Letter** | Motor Abogado (mismo engine que Tipo 0, prompt condicional) | Condicional | `hasPeerGroup = "no"` y no hay organización en el índice oficial de USCIS | Módulo 13 §A: `noAssociationJustification` |
| **Testimonial personal** | Motor Testimonial Personal | Recomendada (mínimo 3) | Siempre disponible como opción | Módulo 9: `relationshipType`, `relationshipDuration`, `signerCredentials`, `specificAchievements` |
| **Advisory Opinion / No-Objection (institucional)** | Motor Institucional | Condicional | `hasPeerGroup = "si"` (organización en el índice de USCIS o alternativa) | Módulo 13 §A: `peerGroupName`, `peerGroupLetterType`, `alternativeContactName/Org/Relation` |
| **Carta de certificación de terceros** | Motor Institucional (mismo engine, propósito distinto: certificar hecho objetivo, no emitir juicio) | Opcional, según evidencia disponible | Cuando existe evidencia verificable por un tercero (membresía, salario promedio del sector, participación en evento) | Módulo 10 (evidencia existente) |
| **Resumen de acuerdo verbal** | N/A — documento estructurado, no carta narrativa | Condicional | `hasWrittenContract = false` | Módulo 12: `contractVerbalTerms`. Estructura obligatoria: (1) términos ofrecidos por el empleador, (2) términos aceptados por el beneficiario. No requiere firma de ambas partes (USCIS Policy Manual Vol. 2, Part M, Ch. 7). |

## Tipos explícitamente descartados del alcance

- **"Letter from Petitioner" como tipo de carta estándar.** Investigado contra caso real (Arroyo, O-1A): resultó ser una corrección puntual por un error de intake previo (itinerario innecesariamente adjuntado en un empleo de tiempo completo con un solo empleador), no un componente estructural del caso. No se diseña motor de generación para esto.

## Pendientes antes de implementación (no bloqueantes para este documento, sí para el desarrollo)

1. Confirmar lógica de enrutamiento de direcciones USCIS por tipo de formulario/petición.
2. Completar el mapeo de los siete bloques retóricos por tipo de carta al esquema de datos definitivo (pendiente de sesión de diseño dedicada).
3. Confirmar comportamiento cuando `hasItinerary` se marca innecesariamente en un empleo de tiempo completo/un solo empleador (posible mejora de UX en Módulo 12 para prevenir el error que motivó el caso Arroyo).
