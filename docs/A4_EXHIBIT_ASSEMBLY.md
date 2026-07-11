# A4 — Ensamblaje de Exhibits

**Estado:** Diseño completo. No implementado.
**Versión:** 1.0
**Última actualización:** 2026-07-10

## Propósito

Este documento especifica el paso de ensamblaje que construye la numeración de Exhibits de un caso, resolviendo el Pendiente #6 de `A4_ENGINE_ABOGADO.md` v1.2. Es un paso **determinístico, no generativo** — no invoca al modelo de lenguaje. Su función es producir el mapa `letterId/documento → exhibitNumber` que Tipo 0 necesita como dato de entrada ya resuelto antes de generar su Bloque 5.

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

`letterId` aquí es el mismo identificador ya unificado en los tres motores de generación de cartas: `A3_ENGINE_TESTIMONIAL_PERSONAL.md` v1.2 y `A3_ENGINE_INSTITUCIONAL.md` v1.3 usan ambos el campo `letterId` con idéntica semántica desde su unificación de nomenclatura — no hay mapeo de nombres distintos que resolver entre motores.

## Contrato de entrada al ensamblaje

El paso de ensamblaje recibe:

- `caseId`
- Los criterios activos del caso, en el orden determinado por A1 (incluye `criterionCitation`, `criterionLabel`)
- El conjunto de cartas ya generadas por los dos motores de A3 para el caso, cada una con su `letterId` y el criterio al que fue dirigida
- Los documentos de Módulo 10 marcados como evidencia de un criterio específico, que no son cartas generadas por A3 (fotos, certificados, contratos, etc.)

Y produce: una fila de `case_exhibits` por criterio activo, con `document_refs` poblado según la regla de agrupación de la sección anterior.

## Regla de estabilidad ante regeneración

Si una carta de A3 se regenera (por ejemplo, el abogado pide una nueva versión de una carta testimonial), su `letterId` se preserva — el ensamblaje no necesita re-ejecutarse solo porque el contenido de una carta cambió, ya que la entrada en `document_refs` sigue siendo válida por identificador, no por contenido. El ensamblaje sí debe re-ejecutarse si cambia el conjunto de criterios activos del caso (A1 determina un criterio adicional o descarta uno existente), o si se agrega/elimina una carta completa del caso.

Si `manually_reordered = true` para un Exhibit, el sistema no debe sobrescribir automáticamente su `document_refs` en una re-ejecución del ensamblaje — debe señalarse al abogado que existe una discrepancia entre el estado manual y el estado que el ensamblaje automático produciría, sin resolverla unilateralmente.

## Pendiente antes de implementación

1. Confirmar que `cases` es efectivamente el nombre correcto de tabla a referenciar para el contexto de este diseño (verificado contra `supabase/schema.sql` al momento de esta revisión — `public.cases`, `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`).
2. Definir el mecanismo de notificación al abogado cuando el ensamblaje detecta una discrepancia con un Exhibit `manually_reordered = true` (UI, no solo lógica de backend).
3. Confirmar que A1 expone los criterios activos en un orden determinístico y estable entre llamadas — el ensamblaje depende de que ese orden no cambie arbitrariamente entre una ejecución y otra para el mismo caso.
4. Con este documento, el diseño de contrato de salida y ensamblaje de los tres motores de generación de cartas (A3 Testimonial, A3 Institucional, A4 Abogado) queda completo, incluyendo el mecanismo de numeración de Exhibits que faltaba. Falta implementación real: builders de `.docx`, la lógica de ensamblaje como función ejecutable, la migración de la tabla `case_exhibits` en sí (el SQL de este documento está diseñado pero no aplicado a producción), y las rutas API correspondientes.
