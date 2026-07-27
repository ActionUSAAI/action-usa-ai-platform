# AUCIS — Integración técnica del Coach de Hojas de Vida

**Estado:** Diseño inicial, no implementado. Registrado 2026-07-27, a partir de una conversación con Alex sobre el Coach de Hojas de Vida (construido como Custom GPT en ChatGPT, fuera de este repositorio — instrucciones completas del Coach en `docs/AUCIS_CV_COACH_GPT_INSTRUCTIONS.md`, si se decide incorporar ese archivo también).

## Objetivo

El aplicante sube su hoja de vida a un Custom GPT externo (el "Coach"), que lo entrevista y genera un PDF final en inglés, con estructura fija y predecible. Ese PDF se sube como **primer paso del intake de AUCIS**, y un motor extractor automatizado (A0) lo lee y pre-llena los campos correspondientes del formulario — quedando solo lo faltante para completar manualmente.

**Meta cuantitativa:** al menos 70% de los campos relevantes de `Module1` y de la evidencia de criterios en `Module10` pre-llenados automáticamente.

## Cambios necesarios en el intake

### 1. Nuevo primer paso — carga de hoja de vida

Antes de `Module1`, se necesita un paso nuevo (`Module0`, o similar) donde el aplicante sube el PDF generado por el Coach.

**Decisión pendiente:** ¿este paso es obligatorio u opcional? Recomendación inicial: opcional al principio, para no bloquear a clientes que ya tienen su información lista.

### 2. Nuevo motor extractor — A0 (CV Extractor)

Primer motor de la Capa 1 (Evidence Intelligence) en `docs/AUCIS_V2_STRATEGY_LAYER.md`.

**Funcionamiento:**
1. Recibe el PDF generado por el Coach.
2. Extrae el texto.
3. Como el PDF tiene estructura fija y predecible, la extracción puede ser mucho más confiable que un parser de CV genérico — llamada a Claude con un prompt que conoce las 13 secciones esperadas y sus encabezados exactos.
4. Mapea cada sección extraída a los campos correspondientes de `Module1`/`Module10`.
5. Devuelve un objeto con los valores extraídos, más un listado explícito de qué campos no se pudieron llenar.

### 3. Tabla de mapeo — sección del PDF del Coach → campo de AUCIS

| Sección del PDF del Coach | Campo(s) de AUCIS |
|---|---|
| Personal & Contact Information | `Module1.familyName/givenName/middleName`, `dateOfBirth`, `nationalities`, `countryOfResidence/cityOfResidence`, `email`, `whatsapp` |
| Professional Summary | `Module1.profession`, `industry`, `yearsExperience` |
| Employment History | Contexto para `Module14.offeredPosition`/`businessNature` (no mapeo directo) |
| Education | Sin destino directo hoy en el modelo — gap a considerar |
| Awards & Recognition | Evidencia para el criterio `awards` (`Module10`) |
| Professional Memberships | Evidencia para el criterio `memberships` (`Module10`) |
| Media Coverage | Evidencia para el criterio `media_coverage` (`Module10`) |
| Judging & Evaluation Roles | Evidencia para el criterio `judging` (`Module10.judging[]`) |
| Original Contributions | Evidencia para el criterio `original_contributions` (`Module10`) |
| Scholarly Articles Authored | Evidencia para el criterio `scholarly_articles` (`Module10`) |
| Leadership & Critical Roles | Evidencia para `critical_role_4a`/`4b` (`Module10.criticalRole`) |
| Compensation Notes | Evidencia para el criterio `high_salary` (`Module10`) |
| Artistic/Performing Arts | Evidencia para `artistic_exhibitions`/`performing_arts_commercial_success` (solo EB-1A) |

**Nota importante:** esta tabla es un punto de partida conceptual — antes de implementar, hay que revisar la forma exacta de cada tipo de evidencia dentro de `Module10` (ej. `judging` es un array con campos específicos, no texto libre) para diseñar el mapeo campo por campo con la misma precisión que el resto del proyecto.

### 4. Manejo de confianza y campos pendientes

- Campos con alta confianza (nombre, email) se pre-llenan directamente.
- Campos de evidencia por criterio (más narrativos) se pre-llenan pero se marcan como "extraído automáticamente — revisar antes de continuar".
- Campos que el Coach marcó como "[Pendiente de verificar]" nunca se pre-llenan como evidencia lista.

### 5. Preguntas de diseño sin resolver

- ¿La extracción ocurre automáticamente al subir el PDF, o requiere disparo manual?
- ¿El aplicante ve los campos pre-llenados antes de enviarlos, o el staff los revisa primero?
- ¿Se conserva el PDF original del Coach como documento de respaldo, además de los datos extraídos?
- ¿Qué pasa si un aplicante sube una hoja de vida que NO viene del Coach (formato libre)?

## Relación con el resto del proyecto

Complementaria al pipeline ya construido (A1-A4) — no lo reemplaza. Reduce la fricción de la primera etapa del proceso, sin cambiar cómo A1 analiza criterios ni cómo A3/A4 generan documentos.
