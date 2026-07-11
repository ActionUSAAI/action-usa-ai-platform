# A4 — Ensamblaje de Exhibits

**Estado:** Diseño completo. No implementado.
**Versión:** 1.2
**Última actualización:** 2026-07-11

## Qué cambió respecto a 1.1

Se resuelve por completo el Pendiente #3 (orden determinístico y estable de criterios activos entre llamadas de A1).

**Hallazgo:** A1 (`src/app/api/agents/a1-intake-analyzer/route.ts`) expone los criterios como tres objetos `Record<string, ...>` (`criteria_scores`, `criteria_met`, `criteria_gaps`), producidos directamente por el modelo de lenguaje y persistidos sin normalización de orden. No hay array con orden semántico controlado por código, y el orden de claves que emite el modelo no está garantizado entre llamadas para el mismo caso.

**Decisión adoptada — orden canónico en el consumidor, no en A1.** El paso de ensamblaje no depende del orden en que A1 devuelve `criteria_met`. En su lugar, ordena los criterios activos según una lista de referencia fija por clasificación de visa, verificada contra el USCIS Policy Manual (8 CFR 214.2(o)(3)(iii)(B) para O-1A, 8 CFR 214.2(o)(3)(iv)(B) para O-1B, 8 CFR 204.5(h)(3) para EB-1A/EB-1B). Esto resuelve el problema sin requerir ningún cambio en A1, y además da coherencia natural con `A4_ENGINE_ABOGADO.md`, cuyo Bloque 3 ("Marco legal y estándar de prueba") ya enumera los criterios en este mismo orden regulatorio.

**Hallazgo relacionado, fuera de alcance de este documento.** Al investigar el Pendiente #3, se identificó un problema más amplio: no solo el orden de `criteria_met` es inestable — el propio *conjunto* de criterios que A1 marca como cumplidos puede variar entre llamadas para los mismos datos de intake, porque la llamada al modelo no usa `temperature: 0` ni ningún mecanismo de determinismo. Esto excede el alcance del ensamblaje de Exhibits (afecta a A1 en su totalidad, y a cualquier agente río abajo que consuma `criteria_met`). Mitigación actual: un humano revisa el análisis de A1 antes de que se use para generar cartas, lo cual reduce el riesgo práctico de que una inestabilidad silenciosa llegue a producción sin detectarse. Registrado como hallazgo pendiente de investigación en `CHANGELOG_A3_A4.md` — no se resuelve en este documento ni se bloquea el diseño de A3/A4 por él.

## Qué cambió respecto a 1.0

Se resuelve el Pendiente #2 (mecanismo de notificación al abogado ante discrepancia con un Exhibit `manually_reordered = true`).

**Decisión de producto:** la notificación aparece como banner en la vista del caso/expediente (no bloqueo duro, no lista de notificaciones separada). El abogado tiene ambas acciones disponibles desde el banner: ver el diff, o aplicar la sugerencia con un clic.

**Decisión de mecanismo — fusión, no recálculo completo.** La primera versión de este diseño contemplaba que el ensamblaje recalculara el Exhibit completo desde cero y lo comparara contra el orden manual. Se descartó: un recálculo completo descarta el criterio de orden del abogado en cuanto cambia un solo documento, obligándolo a reconstruir manualmente cualquier reordenamiento cada vez que se agrega o quita evidencia. En su lugar, el ensamblaje calcula una **fusión** — el orden manual existente, con los documentos nuevos añadidos al final y los documentos removidos eliminados, sin alterar el orden relativo de lo que permanece.

Esto cambia el nombre del campo de comparación: `auto_computed_refs` (descartado, nunca implementado) pasa a ser `suggested_merge_refs`, reflejando que contiene una sugerencia de fusión sobre el orden manual, no un recálculo independiente.

Como la tabla `case_exhibits` no está aplicada a producción (solo diseñada), este cambio se incorpora directamente al esquema original en este documento, sin necesidad de una migración de seguimiento.

## Propósito

Este documento especifica el paso de ensamblaje que construye la numeración de Exhibits de un caso, resolviendo el Pendiente #6 de `A4_ENGINE_ABOGADO.md` v1.3. Es un paso **determinístico, no generativo** — no invoca al modelo de lenguaje. Su función es producir el mapa `letterId/documento → exhibitNumber` que Tipo 0 necesita como dato de entrada ya resuelto antes de generar su Bloque 5.

Este paso se ejecuta en A4, después de que A3 haya completado la generación de sus dos motores (Testimonial, Institucional) para el caso, y antes de invocar el prompt de Tipo 0.

## Fundamento — validado contra tres casos reales, con una convención descartada

Se revisaron los patrones de numeración de Exhibits en tres Attorney Petition Letters reales: Arroyo (I-129 O-1A), Rodríguez (I-129 O-1A), y Neira (I-140 EB-1A).

**Rodríguez y Neira convergen en el mismo patrón: un Exhibit por criterio, agrupando todos los documentos que sustentan ese criterio.** En Rodríguez, el Exhibit B agrupa tres cartas de membresía distintas (PQHA/AQHA, ACRICAMDE, APHA); el Exhibit F agrupa cinco cartas testimoniales de firmantes distintos (Mora, Wolf, Gilson, Rivera Peña, Berard). En Neira, el Exhibit 2 agrupa cuatro cartas testimoniales más un libro publicado, todos bajo el criterio de "contribuciones de importancia mayor".

**Arroyo sigue un patrón distinto — casi un Exhibit por documento individual**, sin agrupación por criterio (Exhibits 1 a 5 corresponden a cinco membresías distintas dentro de un solo criterio). Este patrón se descarta como convención del sistema: es el caso donde se documentó el RFE que motivó la corrección del Motor Institucional, y no se replica en los dos casos exitosos posteriores.

**Decisión adoptada:** el sistema estandariza hacia el patrón Rodríguez/Neira — un Exhibit por criterio satisfecho, agrupando dentro de él todos los documentos (cartas de A3 + evidencia de Módulo 10) que sustentan ese criterio.

## Regla de ensamblaje

1. El número de Exhibits de un caso es igual al número de criterios activos determinados por A1 para ese caso — una relación 1:1.
2. Dentro de cada Exhibit, los documentos se agrupan sin numeración interna adicional — el Bloque 5 de Tipo 0 los referencia colectivamente por el número de Exhibit, no por posición dentro de él (consistente con cómo Rodríguez y Neira los citan: "see Exhibit F", no "see Exhibit F, item 3").
3. El orden de los Exhibits entre sí sigue un **orden canónico fijo por clasificación de visa** (ver tabla siguiente), no el orden en que A1 devuelve `criteria_met` — que no está garantizado estable entre llamadas para el mismo caso (ver "Qué cambió respecto a 1.1").
4. Dentro de un Exhibit, el orden interno de los documentos no es normativo — no afecta la validez de la evidencia ante USCIS. Por defecto: cartas del Motor Testimonial primero, luego cartas del Motor Institucional, luego documentos de Módulo 10 que no son cartas. El abogado puede reordenar manualmente sin restricción.

## Orden canónico de criterios por clasificación de visa

Verificado contra el USCIS Policy Manual. El paso de ensamblaje asigna `exhibit_number` siguiendo este orden — el primer criterio activo de la lista recibe el Exhibit más bajo, y así sucesivamente, saltando los criterios que el caso no documenta.

### O-1A — 8 CFR 214.2(o)(3)(iii)(B)

| Orden | Criterio |
|---|---|
| 1 | Premios nacional/internacionalmente reconocidos |
| 2 | Membresía en asociaciones que exigen logros destacados |
| 3 | Material publicado sobre el beneficiario |
| 4 | Participación como juez del trabajo de otros |
| 5 | Contribuciones originales de importancia mayor |
| 6 | Autoría de artículos académicos |
| 7 | Rol crítico/esencial en organización de reputación distinguida |
| 8 | Salario alto o remuneración comparativamente alta |

### O-1B — 8 CFR 214.2(o)(3)(iv)(B)

Aplica por igual a ambas sub-variantes de O-1B (Arts y Motion Picture/Television) — comparten el mismo listado y orden de 6 criterios; MPTV se distingue únicamente en que no admite evidencia comparable, lo cual no afecta el orden de Exhibits.

| Orden | Criterio |
|---|---|
| 1 | Rol principal o protagónico en producciones/eventos de reputación distinguida |
| 2 | Reconocimiento nacional/internacional evidenciado por reseñas críticas o material publicado |
| 3 | Rol principal, protagónico o crítico en organización de reputación distinguida |
| 4 | Récord de éxitos comerciales o de crítica mayores |
| 5 | Reconocimiento significativo de logros por organizaciones/críticos/expertos |
| 6 | Salario alto o remuneración sustancial comparativa |

### EB-1A / EB-1B — 8 CFR 204.5(h)(3)

| Orden | Criterio |
|---|---|
| 1 | Premios/galardones menos reconocidos nacional/internacionalmente |
| 2 | Membresía en asociaciones que exigen logros destacados |
| 3 | Material publicado sobre el beneficiario |
| 4 | Participación como juez del trabajo de otros |
| 5 | Contribuciones de importancia notable (científicas/artísticas/académicas/deportivas/comerciales) |
| 6 | Autoría de artículos académicos |
| 7 | Exhibición del trabajo en exposiciones o muestras |
| 8 | Rol principal o de suma importancia en organizaciones distinguidas |
| 9 | Salario alto o remuneración notablemente alta |
| 10 | Éxitos comerciales en las artes escénicas |

## Esquema — tabla dedicada `case_exhibits`

Se eligió tabla dedicada, no un campo JSONB dentro de `agent_petition_drafts`, porque el mapeo de Exhibits necesita ser consultable y editable independientemente del ciclo de vida del draft de Tipo 0 — en particular, para soportar reordenamiento manual del abogado antes de radicar, sin depender de que exista ya un intento de generación de la carta. Es una tabla separada, no relacionada con la migración 008 (`agent_petition_drafts.petition_type`) — esta última distingue Tipo 0 de Tipo 0b como tipo de documento, mientras que `case_exhibits` existe independientemente de qué tipo de carta de abogado se esté redactando.

```sql
BEGIN;

CREATE TABLE case_exhibits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  exhibit_number INTEGER NOT NULL,
  criterion_citation TEXT NOT NULL,
  criterion_label TEXT NOT NULL,
  document_refs JSONB NOT NULL DEFAULT '[]',
  manually_reordered BOOLEAN NOT NULL DEFAULT false,
  suggested_merge_refs JSONB NULL,
  auto_recomputed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, exhibit_number)
);

CREATE INDEX idx_case_exhibits_case_id ON case_exhibits(case_id);

COMMIT;
```

Verificado contra el esquema real antes de este diseño: `public.cases.id` es `UUID` (`DEFAULT uuid_generate_v4()`), y la convención estándar de FK en el resto del esquema es `case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE` — el DDL de arriba sigue esa misma convención exacta.

**Forma de `document_refs`** (array JSONB, sin tabla hija — el volumen por Exhibit es bajo, del orden de unidades, no justifica normalización adicional):

```json
[
  {
    "sourceType": "a3_testimonial | a3_institutional | module10_upload",
    "letterId": "string | null — presente si sourceType es a3_testimonial o a3_institutional",
    "documentPath": "string | null — presente si sourceType es module10_upload",
    "documentLabel": "string — texto legible para el Bloque 5, p.ej. 'Letter from Andrés Ricardo Forero'"
  }
]
```

`letterId` aquí es el mismo identificador ya unificado en los tres motores de generación de cartas: `A3_ENGINE_TESTIMONIAL_PERSONAL.md` v1.3 y `A3_ENGINE_INSTITUCIONAL.md` v1.4 usan ambos el campo `letterId` con idéntica semántica desde su unificación de nomenclatura — no hay mapeo de nombres distintos que resolver entre motores.

`suggested_merge_refs` tiene la misma forma que `document_refs`, y es `NULL` en el estado normal (sin discrepancia pendiente).

## Contrato de entrada al ensamblaje

El paso de ensamblaje recibe:

- `caseId`
- Los criterios activos del caso, en el orden determinado por A1 (incluye `criterionCitation`, `criterionLabel`)
- El conjunto de cartas ya generadas por los dos motores de A3 para el caso, cada una con su `letterId` y el criterio al que fue dirigida
- Los documentos de Módulo 10 marcados como evidencia de un criterio específico, que no son cartas generadas por A3 (fotos, certificados, contratos, etc.)

Y produce: una fila de `case_exhibits` por criterio activo, con `document_refs` poblado según la regla de agrupación de la sección anterior.

## Mecanismo de notificación de discrepancias — fusión sobre orden manual

Cuando el ensamblaje se re-ejecuta para un caso que ya tiene Exhibits con `manually_reordered = true`, no sobrescribe `document_refs` directamente. En su lugar:

1. Calcula el conjunto de documentos que le corresponden hoy a ese Exhibit, según el estado actual del caso (mismas fuentes que el contrato de entrada: cartas de A3 + evidencia de Módulo 10 para el criterio).
2. Compara ese conjunto contra `document_refs` (el orden manual vigente), identificando por `letterId`/`documentPath`:
   - **Documentos nuevos**, ausentes del orden manual → se añaden al final de una copia del orden manual, sin alterar la posición relativa de los documentos existentes.
   - **Documentos removidos**, presentes en el orden manual pero ya no vigentes en el caso (p. ej. una carta fue eliminada) → se quitan de esa copia, sin alterar la posición relativa de los que permanecen.
3. Si el resultado de la fusión es idéntico a `document_refs`, no hay discrepancia — no se pobla `suggested_merge_refs`, no aparece banner.
4. Si el resultado difiere, se guarda en `suggested_merge_refs` junto con `auto_recomputed_at`, y el banner se activa en la vista del caso.

**Presentación al abogado:** banner en la vista del caso/expediente, visible mientras exista al menos un Exhibit de ese caso con `suggested_merge_refs` no nulo. El banner ofrece:

- **Ver diferencia** — qué documentos se añadirían/quitarían respecto al orden manual actual.
- **Aplicar fusión sugerida** — `document_refs` se reemplaza por `suggested_merge_refs`; se limpia `suggested_merge_refs`; `manually_reordered` permanece `true` (sigue siendo un orden curado por el abogado, con el parche aplicado, no el orden por defecto del sistema).
- **Descartar por ahora** — se limpia `suggested_merge_refs` sin tocar `document_refs`; el documento nuevo queda fuera del Exhibit hasta que el abogado lo incluya manualmente o el ensamblaje vuelva a detectar la misma diferencia en una ejecución futura.

**Ejemplo — Exhibit F del caso Rodríguez.** Orden manual vigente: `[Gilson, Mora, Wolf, Rivera Peña, Berard]` (el abogado priorizó a Gilson). Se agrega un sexto firmante al criterio. El ensamblaje calcula la fusión: `[Gilson, Mora, Wolf, Rivera Peña, Berard, NuevoFirmante]` — el orden curado se preserva íntegro, el documento nuevo se añade al final. Si en cambio se elimina la carta de Wolf del caso, la fusión calcula `[Gilson, Mora, Rivera Peña, Berard]`, preservando que Gilson sigue en primer lugar.

## Regla de estabilidad ante regeneración

Si una carta de A3 se regenera (por ejemplo, el abogado pide una nueva versión de una carta testimonial), su `letterId` se preserva — el ensamblaje no necesita re-ejecutarse solo porque el contenido de una carta cambió, ya que la entrada en `document_refs` sigue siendo válida por identificador, no por contenido. El ensamblaje sí debe re-ejecutarse si cambia el conjunto de criterios activos del caso (A1 determina un criterio adicional o descarta uno existente), o si se agrega/elimina una carta completa del caso — en cuyo caso, para Exhibits con `manually_reordered = true`, se aplica el mecanismo de fusión de la sección anterior en lugar de sobrescribir.

## Pendiente antes de implementación

1. ~~Confirmar que `cases` es efectivamente el nombre correcto de tabla a referenciar...~~ **Resuelto** — verificado contra `supabase/schema.sql`, `public.cases`, `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`.
2. ~~Definir el mecanismo de notificación al abogado cuando el ensamblaje detecta una discrepancia...~~ **Resuelto en esta revisión** — ver "Mecanismo de notificación de discrepancias".
3. ~~Confirmar que A1 expone los criterios activos en un orden determinístico y estable entre llamadas...~~ **Resuelto en esta revisión** — ver "Qué cambió respecto a 1.1" y "Orden canónico de criterios por clasificación de visa". El ensamblaje ya no depende de A1 para el orden.
4. Con este documento, el diseño de contrato de salida y ensamblaje de los tres motores de generación de cartas (A3 Testimonial, A3 Institucional, A4 Abogado) queda completo, incluyendo el mecanismo de numeración de Exhibits y el manejo de discrepancias por reordenamiento manual. Falta implementación real: builders de `.docx`, la lógica de ensamblaje como función ejecutable (incluyendo la lógica de fusión), la migración de la tabla `case_exhibits` en sí (el SQL de este documento está diseñado pero no aplicado a producción), la UI del banner de discrepancias, y las rutas API correspondientes.
