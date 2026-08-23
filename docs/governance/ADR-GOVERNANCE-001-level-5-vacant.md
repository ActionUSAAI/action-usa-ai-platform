# ADR-GOVERNANCE-001 — Ausencia Constitucional de Jurisdicción para Level 5 (Protocols)

**Estado:** Aceptado.

## Contexto

Tras la materialización completa de Levels 0, 1, 2, 3, y 4 del corpus de gobernanza de AUCIS, se inició una cadena de Discovery formal para determinar si Level 5 (Protocols), ya definido en la Architectural Constitution v1 como "metodología de trabajo — cómo se investiga, audita, o valida", posee jurisdicción constitucional propia que justifique su materialización.

La hipótesis histórica del proyecto sostenía que debía existir un "Evidence Discovery Engine Protocol". Esa hipótesis, y otras tres derivadas de ella durante el propio proceso de Discovery, fueron sometidas a refutación formal siguiendo el mismo estándar aplicado a cada documento ya congelado del corpus.

## Decisión

En el estado actual del corpus de gobernanza, Level 5 no posee ninguna jurisdicción constitucional demostrada que justifique la materialización de un documento. En consecuencia, permanece deliberadamente vacío. Esta ausencia no constituye deuda técnica, trabajo pendiente, ni omisión — es una decisión arquitectónica positiva, sustentada por evidencia de Discovery formal, consistente con la Sección 6 de la Architectural Constitution.

## Evidencia — Hipótesis Exploradas y Refutadas

**Hipótesis 1 — Evidence Discovery Engine Protocol.**
La responsabilidad de descubrir ya pertenece exclusivamente a Descubridor (Knowledge Acquisition Architecture, Level 3). Un Protocol que gobernara el acto de descubrir invadiría directamente Level 3. No existe jurisdicción nueva.

**Hipótesis 2 — Protocol como auditoría del comportamiento del sistema.**
Las invariantes de cada documento ya congelado son verificables directamente por inspección. No requieren una metodología de verificación independiente.

**Hipótesis 3 — Protocol como metodología de construcción del corpus documental.**
La Architectural Constitution ya gobierna, en su Sección 3 (Estado de Autoridad Documental), el proceso mediante el cual un documento es sometido a validación antes de adquirir autoridad. No existe vacío constitucional que un Protocol adicional deba llenar.

**Hipótesis 4 — Protocol como auditoría de la suficiencia del conocimiento de un caso.**
Cada propiedad verificable relevante para determinar si un caso está listo ya posee dueño exclusivo en un documento distinto. La suficiencia general no es un objeto con conocimiento propio — es un resultado emergente de que cada documento ya existente cumpla su propia condición local. No existe jurisdicción transversal propia.

## Conclusión Arquitectónica

El corpus de gobernanza de AUCIS, en su estado actual, ya asigna toda jurisdicción constitucional demostrada relacionada con investigación, auditoría, y validación a los documentos existentes de Levels 0 a 4. En consecuencia, no permanece ninguna jurisdicción irreducible que justifique la materialización de un documento en Level 5.

## Consecuencia Constitucional

Mientras este ADR permanezca vigente, la carga de la prueba para cualquier documento futuro propuesto en el corpus de gobernanza cambia de la siguiente manera: ya no basta con proponer que un documento "debería existir". Quien lo proponga debe demostrar primero su jurisdicción, superando las mismas seis pruebas aplicadas durante este Discovery — jurisdicción exclusiva, irreducibilidad, no-emergencia, eliminación, independencia de implementación, y ausencia de invasión sobre cualquier documento ya Frozen. Ninguna intuición arquitectónica, por razonable que parezca, sustituye esa carga probatoria.

Esta consecuencia no describe únicamente Level 5 — gobierna la evolución de todo el corpus, en cualquier nivel donde se proponga un documento nuevo.

## Condición para Reabrir Level 5

Level 5 solamente podrá reabrirse cuando aparezca evidencia de una jurisdicción que satisfaga simultáneamente todas las condiciones siguientes:

- No pertenezca ya a ningún documento Frozen existente.
- Sobreviva la prueba de eliminación.
- Sobreviva la prueba de irreducibilidad.
- No sea un resultado emergente del resto del corpus.
- No pueda implementarse directamente en Level 6 sin necesitar organización conceptual previa.
- No invada Architecture, Policy, Procedure, Charter, ni Contract.

Hasta que esa evidencia exista, Level 5 permanece constitucionalmente vacío.

## Estado Arquitectónico Resultante

En el estado actual del corpus de gobernanza:

- Levels 0 a 4 poseen jurisdicción constitucional demostrada y documentos materializados.
- Level 5 permanece deliberadamente sin documentos materializados.
- Level 6 permanece reservado para decisiones de implementación y no requiere organización conceptual previa mientras no aparezca una jurisdicción propia.
