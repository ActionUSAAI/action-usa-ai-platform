# Criterio de Clasificación del Conocimiento de AUCIS

**Naturaleza de este documento:** Conocimiento organizacional/metodológico. No pertenece al corpus de gobernanza (`docs/governance/`). No posee Estado de Autoridad Documental. No gobierna ningún comportamiento del sistema AUCIS. Describe el método ya aplicado durante la construcción del corpus de gobernanza, para su reutilización futura.

## Contexto

Durante la construcción del corpus de gobernanza de AUCIS (Levels 0 a 4, más el ADR-GOVERNANCE-001 sobre Level 5), se sometieron repetidamente distintas hipótesis de conocimiento a un proceso de Discovery y refutación formal. De esa cadena emergió, sin haberse buscado explícitamente, un criterio general para clasificar cualquier conocimiento futuro del proyecto.

## El Árbol de Decisión

1. **¿Gobierna comportamiento del sistema?**
   Si no, no pertenece al corpus constitucional.

2. **Si gobierna, ¿posee jurisdicción exclusiva e irreducible?**
   Si no, no merece un documento propio.

3. **Si posee jurisdicción, ¿ya está absorbida por un documento Frozen existente?**
   Si sí, no crear un documento nuevo.

4. **Si no está absorbida, ¿su ausencia rompe una garantía constitucional, o solo aumenta la incertidumbre del diseño?**
   Si solo aumenta la incertidumbre, pertenece al conocimiento organizacional.

5. **Solo si rompe una garantía constitucional**, puede iniciarse un nuevo Discovery para evaluar si debe incorporarse al corpus de gobernanza.

## Cambio Metodológico

Antes: "Encontramos conocimiento importante → probablemente necesitamos un documento."

Después: "Encontramos conocimiento importante → primero determinamos su naturaleza → solo después decidimos si requiere autoridad constitucional."

## Las Dos Pruebas

Cada intento de nueva abstracción durante la construcción del corpus fue sometido a dos pruebas distintas:

- **Prueba ontológica:** ¿existe realmente este concepto?
- **Prueba constitucional:** aunque exista, ¿debe gobernarse?

Conceptos como Entidad Única, Objeto + Relación, Representación Gobernable, Modelo Conceptual, Level 5 (Protocols), y la correspondencia estructural entre responsabilidades conceptuales y componentes técnicos, fueron descartados no porque fueran ficticios, sino porque no superaron la segunda prueba — describían algo real sin requerir autoridad normativa.

## Aplicación Futura

Este criterio, al no gobernar el sistema AUCIS, no requiere Estado de Autoridad Documental ni proceso de Discovery-refutación-Frozen para su propia modificación. Puede evolucionar libremente según las necesidades organizacionales del proyecto — su valor es orientar la clasificación de conocimiento futuro, no gobernar ningún comportamiento.
