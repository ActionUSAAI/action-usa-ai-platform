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

---

# Bug real corregido — encabezados de criterio en español dentro de documentos en inglés (2026-07-22)

Durante la evaluación de la Attorney Petition Letter contra el caso Neira Rincón, Alex detectó que los cinco encabezados de sección ("Material publicado sobre el solicitante...", etc.) aparecían en español dentro de un documento legal completamente en inglés — un bug objetivo, no una cuestión de tono.

**Causa raíz:** `canonical-criteria.ts` fue diseñado originalmente solo para consumo interno (UI de staff, prompts de A1) con labels únicamente en español. Ese mismo campo se propagaba, sin traducción, hacia `case_exhibits.criterion_label` (vía `assembleExhibits`) y hacia los prompts del Motor Testimonial — ambos terminando, directa o indirectamente, en texto visible dentro de documentos legales en inglés.

**Fix aplicado (commit `43afdff`):** se agregó `labelEn` a las 26 entradas de `CriterionDef` (O-1A, EB-1A, O-1B). Se conectó en dos puntos verificados como reales (Motor Abogado vía `assembleExhibits`, Motor Testimonial vía sus dos prompts), preservando explícitamente el label en español donde sí es necesario (metadata `criterion_covered`, mostrada en la UI de staff — `a3a4-panel.tsx`). El Motor Institucional se confirmó sin el mismo problema — su prompt nunca recibe el label en absoluto.

**Verificado con evidencia real:** se borraron los `case_exhibits` existentes del caso Neira Rincón (generados antes del fix, con labels en español ya persistidos) para forzar el re-ensamblaje, y se regeneró la Attorney Petition Letter. Confirmado por Alex: los cinco encabezados de criterio aparecen ahora completamente en inglés.

**Nota operativa importante para cualquier caso ya existente:** `assembleExhibits` solo se ejecuta automáticamente si `case_exhibits` no tiene filas para el caso — si un caso real ya tiene Exhibits ensamblados de antes del 2026-07-22, seguirá sirviendo labels en español hasta que esas filas se borren manualmente y se regeneren. No hay hoy un mecanismo de re-ensamblaje automático para casos ya existentes (mismo pendiente ya documentado: "re-assembly path... not-yet-implemented").

---

# Anexo — Hallazgos en la Consultation Exception Letter, Motor Abogado Tipo 0b (2026-07-22)

Evaluando la Consultation Exception Letter generada contra el caso Neira Rincón, Alex identificó un riesgo legal real (cita de "Matter of Garibay" no verificada — ver commit de fix separado) y cuatro observaciones adicionales de calidad, todas con mérito y pendientes de implementación futura:

**1. Matización de la afirmación de ausencia de peer group.** La carta afirma categóricamente que "no existe ninguna organización competente en EE.UU." — una afirmación fuerte y arriesgada si un oficial de USCIS conoce una organización relevante no contemplada. Propuesta de Alex: matizar con lenguaje tipo "After a diligent search, counsel was unable to identify a U.S.-based peer group whose scope and technical expertise specifically encompass the Beneficiary's interdisciplinary specialization..." — reduce el riesgo de que la afirmación absoluta sea refutada por una sola excepción.

**2. Justificar explícitamente por qué la organización sustituta (ej. FEDEQUINAS) es la mejor opción.** La carta asume que el oficial entenderá la relevancia de la organización propuesta como evidencia sustituta. Propuesta: dedicar un párrafo explícito a su autoridad regulatoria nacional, representación del sector, experiencia técnica, y relación directa con la especialidad del beneficiario — no asumir ese conocimiento.

**3. Cierre más estratégico, conectando el reglamento con la decisión solicitada.** El cierre actual es funcionalmente "por favor acepte esta evidencia". Propuesta de Alex: "Accordingly, the absence of an appropriate U.S. consulting entity should not prejudice the Petitioner's ability to establish eligibility where the record contains competent substitute evidence from the most authoritative organization in the Beneficiary's field."

**4. Validación positiva de la estructura general.** Alex confirmó que la lógica de tres pasos de la carta (declarar ausencia de peer group → justificar por qué el campo es demasiado especializado → proponer evidencia sustituta) es la correcta y no requiere cambios — el problema es de matiz y refuerzo argumental dentro de esa estructura, no de estructura en sí. También validó positivamente la investigación de organizaciones específicas mencionadas (American Horse Council, PATH Intl., Certified Horsemanship Association, Equine Science Society) como fortalecedora del argumento, en vez de solo afirmar la ausencia sin evidencia de búsqueda.

**Relación con el principio unificador de este documento:** estas observaciones refuerzan el mismo patrón de fondo ya documentado para los Motores Testimonial e Institucional — el sistema optimiza por argumento persuasivo genérico en vez de por precisión factual, matización legal apropiada, y conexión explícita con la decisión regulatoria solicitada. La corrección del riesgo de cita no verificada (fix separado, mismo día) es el ejemplo más concreto de este patrón: una afirmación con apariencia de autoridad, generada sin verificación real.

---

# Evaluación final del fix — Consultation Exception Letter post-corrección (2026-07-22)

Tras el fix de la cita no verificada (commit `826e269`), Alex evaluó la versión regenerada como una mejora real, no solo la eliminación de un riesgo: el argumento ahora descansa exclusivamente en el texto del reglamento, los hechos del caso, y la evidencia — lo cual, según Alex, hace el argumento *más* sólido, no más débil, al eliminar un punto de vulnerabilidad (una cita potencialmente cuestionable que un oficial podría usar para restar credibilidad a toda la petición).

**Estructura confirmada como correcta** (sin cambios necesarios): base reglamentaria → qué buscó el peticionario → por qué no existe un peer group adecuado → naturaleza especializada del campo → evidencia sustituta → solicitud de exención.

**Tres ajustes finales identificados, pendientes de implementación futura:**

1. **Suavizar afirmaciones absolutas ("no exists").** La carta repite variantes de "no appropriate peer group exists" — una afirmación categórica arriesgada en derecho migratorio. Propuesta: "...Petitioner has been unable to identify any U.S.-based peer group or labor organization whose scope, membership, and technical expertise specifically encompass the Beneficiary's highly specialized field..." — mismo mensaje, sin afirmación absoluta.

2. **Condensar el segundo párrafo (~20%).** Se identifica repetición conceptual entre "highly singular", "interdisciplinary", "specialized", "relatively nascent", "no peer group", "no qualifying entity" — varios términos comunican la misma idea. Un argumento más directo ganaría fuerza.

3. **Fortalecer la justificación de FEDEQUINAS con datos objetivos.** En vez de solo "the national governing body...", agregar 2-3 datos concretos: año de fundación, número de asociaciones agrupadas (24), autoridad técnica nacional, participación en regulación de bienestar animal — para que USCIS entienda de inmediato por qué es el sustituto más apropiado, sin asumir ese conocimiento previo.

**Frase destacada positivamente por Alex, a preservar en futuras iteraciones:** "The absence of such a peer group is therefore not a procedural gap but rather a structural reality of the field itself." — valorada como la mejor frase de la carta por reencuadrar la narrativa: no es "no encontramos quién firme", sino "la disciplina es tan especializada que el propio reglamento contempla esta situación exacta". Este reencuadre es el tipo de razonamiento legal genuino que el rediseño de "certificar/narrar en vez de argumentar" (documento principal, arriba) debería preservar y replicar en otros bloques.
