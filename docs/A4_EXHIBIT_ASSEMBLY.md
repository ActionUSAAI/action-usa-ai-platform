# A4 — Ensamblaje de Exhibits

**Estado:** Diseño completo. No implementado.
**Versión:** 1.1
**Última actualización:** 2026-07-11

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
3. El orden de los Exhibits entre sí sigue el mismo orden en que A1 determina y prioriza los criterios activos del caso — no hay un criterio de ordenamiento adicional (cronológico, alfabético) más allá de ese.
4. Dentro de un Exhibit, el orden interno de los documentos no es normativo — no afecta la validez de la evidencia ante USCIS. Por defecto: cartas del Motor Testimonial primero, luego cartas del Motor Institucional, luego documentos de Módulo 10 que no son cartas. El abogado puede reordenar manualmente sin restricción.

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
3. Confirmar que A1 expone los criterios activos en un orden determinístico y estable entre llamadas — el ensamblaje depende de que ese orden no cambie arbitrariamente entre una ejecución y otra para el mismo caso.
4. Con este documento, el diseño de contrato de salida y ensamblaje de los tres motores de generación de cartas (A3 Testimonial, A3 Institucional, A4 Abogado) queda completo, incluyendo el mecanismo de numeración de Exhibits y el manejo de discrepancias por reordenamiento manual. Falta implementación real: builders de `.docx`, la lógica de ensamblaje como función ejecutable (incluyendo la lógica de fusión), la migración de la tabla `case_exhibits` en sí (el SQL de este documento está diseñado pero no aplicado a producción), la UI del banner de discrepancias, y las rutas API correspondientes.
