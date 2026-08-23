# SPC-001 — Session Protocol Convention

**Naturaleza de este documento:** No pertenece al corpus de gobernanza. No posee Estado de Autoridad Documental en el sentido de la Architectural Constitution. Es convención organizacional, consistente con el Criterio de Clasificación del Conocimiento ya materializado — no gobierna el comportamiento de AUCIS como sistema; gobierna la disciplina de trabajo del equipo durante la construcción del proyecto.

## Principio Rector — Session Truth Principle

Cada sesión de trabajo admite un único criterio de verdad. Nunca coexisten dos criterios de verdad dentro de la misma sesión.

Este principio es independiente de cuántos tipos de sesión existan o puedan existir en el futuro. Sobrevive a la aparición de nuevos tipos de sesión, y explica por qué cada tipo, tal como se define a continuación, prohíbe exactamente las operaciones que introducirían un segundo criterio de verdad.

## Session Classification

Toda conversación del proyecto AUCIS comienza con una declaración explícita de tipo de sesión (`SESSION TYPE: ...`). Esa declaración determina el objetivo permitido, las operaciones permitidas y prohibidas, el criterio de terminación, y el criterio de verdad admitido. Nunca se mezclan dos tipos en la misma sesión.

### SESSION TYPE: LKA

**Objetivo:** adquirir conocimiento desde una fuente oficial.
**Criterio de verdad:** fidelidad absoluta a la fuente oficial.
**Permitido:** extraer, copiar, estructurar, registrar metadatos, mantener trazabilidad.
**Prohibido:** interpretar, inferir, resumir, explicar, clasificar, descubrir patrones.
**Criterio de terminación:** toda la unidad oficialmente delimitada ha sido extraída.

### SESSION TYPE: LKV

**Objetivo:** verificar una extracción ya realizada.
**Criterio de verdad:** coincidencia exacta con la fuente oficial.
**Permitido:** comparar, detectar errores, detectar omisiones, validar trazabilidad.
**Prohibido:** corregir mediante memoria, reinterpretar, completar información.
**Criterio de terminación:** la extracción coincide exactamente con la fuente.

### SESSION TYPE: DISCOVERY

**Objetivo:** descubrir conocimiento nuevo únicamente a partir del corpus existente.
**Criterio de verdad:** resistencia a la refutación.
**Permitido:** formular hipótesis, destruir hipótesis, comparar, abstraer, generalizar.
**Prohibido:** consultar memoria para completar vacíos, introducir conocimiento externo no incorporado al corpus, mezclar implementación.
**Criterio de terminación:** convergencia o refutación.

### SESSION TYPE: IMPLEMENTATION

**Objetivo:** materializar conocimiento previamente aprobado.
**Criterio de verdad:** conformidad con las instrucciones aprobadas.
**Permitido:** escribir documentos, modificar arquitectura, escribir código, generar modelos.
**Prohibido:** abrir Discoveries, reinterpretar el dominio, cambiar decisiones ya aprobadas.
**Criterio de terminación:** la implementación reproduce fielmente lo aprobado.

## Aplicación

Al iniciar cualquier sesión del proyecto, declarar `SESSION TYPE: [LKA|LKV|DISCOVERY|IMPLEMENTATION]` como primera línea. Esa declaración activa automáticamente el criterio de verdad, las operaciones permitidas y prohibidas, y el criterio de terminación correspondientes, sin necesitar repetir las reglas completas en cada sesión.

## Extensión

Un quinto tipo de sesión puede incorporarse en el futuro sin modificar el Principio Rector — únicamente debe definir su propio objetivo, criterio de verdad, operaciones permitidas/prohibidas, y criterio de terminación, siguiendo la misma estructura ya establecida.
