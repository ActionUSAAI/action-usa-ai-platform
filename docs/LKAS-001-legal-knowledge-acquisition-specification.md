# LKAS-001 — Legal Knowledge Acquisition Specification

**Naturaleza de este documento:** No pertenece al corpus de gobernanza (`docs/governance/`). No posee Estado de Autoridad Documental en el sentido de la Architectural Constitution. Es especificación organizacional, consistente con el Criterio de Clasificación del Conocimiento — gobierna un método de trabajo, no el comportamiento de AUCIS como sistema.

## Objetivo

Especificar cómo debe extraerse conocimiento jurídico desde fuentes oficiales para producir un corpus consistente, trazable, y libre de interpretación. No extrae conocimiento — especifica el método.

## Fuentes Autorizadas

INA, 8 CFR, USCIS Policy Manual, formularios oficiales USCIS, instrucciones oficiales de formularios, decisiones AAO.

## 1. Unidad Mínima de Extracción

La unidad mínima es la **unidad oficialmente delimitada por la propia fuente** — el fragmento más pequeño que la fuente misma trata como bloque distinguible, mediante numeración, encabezado, marcador de lista, límite de tabla, o cualquier otro mecanismo de delimitación explícito que la fuente use.

En INA, 8 CFR, y Policy Manual, esta delimitación típicamente coincide con numeración jerárquica. En formularios, coincide con el límite de un Item o Part. En instrucciones, coincide con el límite de una sección temática marcada por encabezado, incluso si se extiende por varios párrafos sin numeración interna adicional — en ese caso, la sección completa bajo ese encabezado es la unidad.

Dos equipos independientes producen la misma unidad porque ambos identifican el límite que la fuente ya trazó — nunca un límite decidido por criterio propio del extractor.

## 2. Identidad

Identificador compuesto y determinista: `{fuente}:{jerarquía-completa}`, reproduciendo exactamente la numeración o delimitación oficial de la fuente. Ejemplos: `8CFR:214.2(o)(3)(iv)`, `INA:101(a)(15)(O)(i)`, `I-129:Part1-Item3`, `I-129-INSTRUCTIONS:Evidence`.

## 3. Metadatos Obligatorios

- Fuente (nombre oficial completo).
- Jerarquía normativa (reproduciendo la numeración oficial en cada nivel).
- Ubicación exacta (el identificador del punto 2).
- Versión / edición de la fuente consultada.
- Fecha de publicación oficial (cuando la fuente la declare).
- Fecha de extracción.
- URL o referencia de acceso verificable.

## 4. Estructura del Registro

- **Texto literal** — copia exacta, palabra por palabra, sin paráfrasis.
- **Conceptos explícitamente mencionados** — únicamente términos que el texto nombra literalmente.
- **Relaciones explícitamente expresadas** — únicamente cuando el texto declara una relación con palabras propias; se registra la referencia literal, nunca una relación inferida.
- **Condiciones explícitas** — únicamente con lenguaje condicional explícito ("if," "provided that," "unless"); texto literal completo.
- **Consecuencias explícitas** — únicamente cuando el texto declara literalmente un efecto; texto exacto.
- **Definiciones explícitas** — únicamente cuando el fragmento define un término; definición completa y literal.
- **Excepciones explícitas** — únicamente con lenguaje de excepción; texto literal completo.
- **Referencias cruzadas explícitas** — cualquier cita literal a otra sección o documento, registrada tal cual, sin resolver.

Todo campo sin elemento correspondiente en el fragmento se deja vacío o "no aplica" — nunca se infiere su presencia.

## 5. Reglas de Extracción

**Puede copiarse:** el texto oficial completo, con numeración y puntuación originales.

**No puede copiarse:** ninguna paráfrasis, resumen, ni reformulación en ningún campo.

**Cuándo dividir:** únicamente cuando la fuente ya lo subdivide (punto 1) — nunca por decisión del extractor.

**Cuándo mantener íntegro:** cualquier unidad oficialmente delimitada se extrae completa, incluso con múltiples oraciones o ideas.

## 6. Reglas de Trazabilidad

Todo registro debe permitir reconstruir su ubicación exacta mediante su identificador y metadatos. Ningún registro se incorpora sin trazabilidad completa. Si la trazabilidad no puede establecerse con certeza, el fragmento no se incorpora hasta resolverse por referencia directa a la fuente oficial.

## 7. Manejo de Referencias

Referencias internas, externas, definiciones reutilizadas, excepciones, y remisiones normativas se registran siempre como cita textual literal en su propio campo — nunca se resuelven ni se sustituyen por el contenido referenciado dentro del mismo registro.

## 8. Criterios de Neutralidad

Prohibido: interpretar significado, inferir relaciones/condiciones/consecuencias no declaradas literalmente, clasificar fragmentos según categorías ontológicas de Discoveries previos, deduplicar conceptos repetidos, reorganizar por tema, explicar el contenido jurídico.

## 9. Versionado del Registro

Cuando una fuente oficial modifica un fragmento ya extraído, el registro anterior nunca se sobrescribe ni se elimina — se marca `superseded` y se crea un nuevo registro con: el mismo identificador base sujeto a marca de versión temporal explícita (ej. `8CFR:214.2(o)(3)(iv)@2024-01-15`); un campo `supersedes` apuntando al identificador anterior; su propia fecha de extracción y de publicación oficial.

## 10. Alcance de Uso y Copyright

LKAS-001 gobierna exclusivamente la extracción y estructuración interna del conocimiento jurídico para uso dentro de AUCIS. No gobierna, autoriza, ni valida la redistribución pública del texto extraído. Cualquier uso externo, comercial, o de cara al cliente del contenido capturado bajo esta especificación deberá evaluarse independientemente contra las restricciones legales y de copyright aplicables a cada fuente oficial correspondiente.

## Verification Checklist

✓ Unidad mínima reproducible en las seis fuentes autorizadas, incluyendo formularios e instrucciones sin numeración densa.
✓ Sin campo de observación subjetiva — cada campo exige presencia literal verificable.
✓ Versionado explícito, coherente con el precedente `superseded` ya usado en el corpus de gobernanza.
✓ Alcance de copyright declarado sin bloquear extracción interna ni comprometer usos externos futuros.
✓ Ningún concepto de arquitectura, ontología, o ventaja computacional introducido en el documento.
