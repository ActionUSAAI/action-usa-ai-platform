# Propuesta de rediseño — Motor Testimonial: Testimonio → Carta

**Estado:** Propuesta, no implementada. Registrada 2026-07-22, a partir de retroalimentación de Alex tras evaluar el Motor Testimonial contra un caso real aprobado (Neira Rincón, O-1A).

## El problema de fondo

El Motor Testimonial actual persigue el objetivo de "redactar la mejor carta posible" — genera directamente el documento legal final, con los 7 bloques estructurados (identidad, relación, originalidad, significancia, conexión regulatoria, declaración, cierre) en una sola pasada del modelo.

**Diagnóstico de Alex:** un oficial de USCIS que revisa cientos de cartas desarrolla instinto para detectar cuándo una carta "suena demasiado bien escrita" — es decir, cuándo suena a que la redactó un abogado de inmigración, no la persona que dice firmarla. El fix aplicado hoy (commit siguiente a este documento) corrigió el síntoma más obvio (citas textuales del CFR), pero el patrón de fondo persiste de forma más sutil: el texto sigue teniendo más conclusiones que descripciones, más interpretación autoral ("institutional judgment", "conceptual framework", "methodological departure") que experiencia personal narrada en primera persona.

## La propuesta

Cambiar el objetivo del sistema de **"redactar la mejor carta posible"** a **"redactar una carta que parezca escrita por [esta persona específica]"**.

**Arquitectura de dos etapas, en vez de una pasada única:**

1. **Etapa 1 — Generar el testimonio auténtico.** Un primer paso (posiblemente un prompt/llamada separada) que produce el relato del firmante en su voz natural — hechos, observaciones personales, lo que vio y cuándo, sin ninguna instrucción de estructura legal ni de conexión regulatoria. El objetivo aquí es maximizar autenticidad y especificidad narrativa, no completitud legal.

2. **Etapa 2 — Validación/conversión jurídica.** Un segundo paso que toma ese testimonio auténtico y confirma/organiza que contiene los elementos que el criterio USCIS requiere — sin reescribir la voz del testigo, solo verificando cobertura y, si acaso, reorganizando en el formato de carta esperado (encabezado, cierre formal) sin tocar el núcleo narrativo.

**Principio guía citado por Alex:** "Las mejores cartas no intentan convencer. Simplemente describen hechos." — en vez de conclusiones autorales ("his contribution reshaped field-wide standards"), preferir observaciones concretas y verificables en primera persona ("after those seminars I began receiving requests from universities and practitioners asking whether Dr. Neira's methodology could be incorporated into additional educational activities").

## Riesgos y preguntas abiertas, a resolver en la sesión de diseño

- ¿Dos llamadas a Claude en cadena (mayor costo/latencia/complejidad de manejo de errores) o un solo prompt con instrucciones de dos fases explícitas?
- ¿Cómo se verifica en la Etapa 2 que no falta ningún elemento del criterio, sin que ese proceso termine reintroduciendo el mismo lenguaje legal que se quiere evitar?
- ¿El mecanismo de variación entre cartas del mismo lote (Capas 1-3 del prompt actual) se mantiene igual, o también necesita rediseñarse bajo el nuevo enfoque?
- ¿Aplica este mismo rediseño al Motor Institucional, o su diseño actual (checklist por sub-tipo) ya logra un resultado suficientemente auténtico sin necesitar el cambio de arquitectura?

## Evidencia de referencia

Carta real del caso Neira Rincón (Andrés Ricardo Forero, testimonio real) usada como vara de medir en la evaluación de Alex — disponible en el historial de esta sesión, no adjunta a este documento por contener datos de un cliente real.

---

# Anexo — Mismo patrón detectado en el Motor Institucional (2026-07-22)

Evaluando una carta real generada por el Motor Institucional contra el mismo caso de prueba (FEDEQUINAS, rol crítico de Andrés Neira Rincón), Alex identificó un problema equivalente pero con el signo invertido: mientras el Motor Testimonial hacía sonar a un *individuo* como abogado, el Motor Institucional hace sonar a una *institución* como su propio departamento legal en vez de como una oficina que certifica hechos con autoridad oficial.

**Estructura evaluada como correcta y a preservar:** el orden de la carta (reputación de la organización → naturaleza del cargo → por qué es crítico/no duplicable → impacto medible) es el correcto y USCIS-alineado. No tocar el orden ni el contenido factual.

**Tres observaciones de tono, específicas y corregibles:**

1. **Lenguaje litigioso en vez de institucional.** Ejemplo real: "...binding institutional policy..." suena a argumento legal. Alternativa propuesta: "Within our federation, this position advises the Board on matters affecting national welfare standards..." — más institucional, menos litigioso.

2. **Argumentación en vez de certificación.** Ejemplo real: "...critical and non-duplicable..." es una afirmación evaluativa. Alternativa propuesta: "The federation maintains only one Technical Advisor in this specialty." — mismo hecho, formato de certificado en vez de escrito de apelación.

3. **Intento de convencer en vez de simplemente certificar.** Palabras a evitar identificadas: "exceptionally rare", "sector-wide outcome" — lenguaje persuasivo. Alternativa propuesta: anclar cada afirmación a una fuente de registro institucional explícita ("According to our institutional records...", "During his tenure...", "The Board assigned him responsibility...").

**Principio unificador con el hallazgo del Motor Testimonial:** en ambos motores, el problema de fondo es el mismo — el sistema está optimizando por "el argumento legal más persuasivo posible" en vez de por "el documento más auténtico a la voz/naturaleza de quien lo firma" (persona individual en un caso, institución oficial en el otro). La solución de arquitectura de dos etapas (testimonio/certificación auténtica primero, validación de cobertura del criterio después, sin reintroducir lenguaje argumentativo) propuesta arriba para el Motor Testimonial aplica, con ajustes de tono específicos por tipo de firmante, también al Motor Institucional.

**Hallazgo adicional de Alex sobre reutilización de evidencia:** la carta de FEDEQUINAS evaluada podría servir como evidencia principal para el criterio de rol crítico (`critical_role_4a`), y como evidencia *complementaria* (no principal) para contribuciones originales (`original_contributions`), dado que menciona la incorporación de su trabajo en la Resolución 00136 de 2020. Esto sugiere una capacidad futura no explorada: que una misma carta/evidencia pueda registrarse como respaldo secundario de más de un criterio, no solo del criterio para el que fue generada — fuera de alcance de este documento, anotado para consideración futura.
