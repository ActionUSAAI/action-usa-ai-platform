---
document: "Data Governance Charter"
level: 1
status: Frozen
governed_by: "Architectural Constitution"
---

# Data Governance Charter v1

## Alcance

Este documento gobierna la arquitectura de información de AUCIS — captura, propiedad, consumo, y evolución de datos — independientemente de cualquier implementación, módulo jurídico, o tecnología específica.

## Principios Rectores

1. Todo dato tiene una única fuente de verdad.
2. La responsabilidad sobre un dato se determina por su naturaleza, no por quién lo capturó.
3. Ningún componente consume un dato sin que su consumo esté identificado.
4. La captura de información y la decisión jurídica ocurren en capas distintas y nunca se fusionan.
5. Captura Única — un hecho objetivo solo se captura una vez; toda interacción posterior profundiza, enriquece o valida, nunca recaptura.
6. Carga de la Prueba de Necesidad — ningún campo nuevo se crea sin demostrar que la información no puede obtenerse reutilizando, profundizando, o derivando un dato existente.
7. El conocimiento nunca se destruye; únicamente evoluciona. Ningún Hecho, Evidencia, Evidencia Derivada, o Decisión Jurídica se pierde como consecuencia de la evolución del expediente. Nueva información complementa, refina, o sustituye interpretaciones anteriores sin eliminar la historia que las originó.

## Ontología del Conocimiento de AUCIS

Hecho → Descubrimiento (proceso) → Evidencia → Evidencia Derivada → Decisión Jurídica

- **Hecho** — lo que ocurrió. Objetivo, existe independientemente de si se ha documentado.
- **Descubrimiento** (proceso, no dato) — la actividad de extraer hechos nuevos a partir de una conversación sobre hechos ya conocidos, mediante profundización progresiva.
- **Evidencia** — lo que permite demostrar que un hecho ocurrió. Relación de demostración, no de transformación.
- **Evidencia Derivada** — información construida automáticamente a partir de hechos o evidencia ya existentes, sin juicio profesional.
- **Decisión Jurídica** — juicio profesional sobre qué significa la evidencia y cómo debe usarse.

## Responsabilidades

- **Cliente:** aporta exclusivamente Hechos.
- **IA:** puede producir Evidencia Derivada a partir de Hechos ya capturados. Nunca decide Decisiones Jurídicas de forma autónoma.
- **Abogado:** posee exclusivamente las Decisiones Jurídicas.
- **Sistema:** custodia la Fuente de Verdad de cada dato.

## Fuente de Verdad

Ser Fuente de Verdad de un dato significa: ser el único lugar donde ese dato puede escribirse de forma autoritativa; cualquier otro lugar que lo muestre debe leerlo desde ahí, nunca mantener su propia copia editable.

## Invariantes

- El cliente nunca produce Evidencia Derivada ni Decisiones Jurídicas.
- Ningún dato existe en más de una Fuente de Verdad simultáneamente.
- Ninguna Decisión Jurídica se genera sin supervisión humana final.
- Ningún consumidor puede mover, eliminar, o reclasificar un dato sin que sus consumidores actuales hayan sido identificados primero.
- La captura de información y el Core Legal Engine permanecen arquitectónicamente separados.
