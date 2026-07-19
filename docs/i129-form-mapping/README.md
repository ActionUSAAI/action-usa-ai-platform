# Mapeo I-129 ↔ Modelo de Datos AUCIS

**Estado:** Investigación inicial. No implementado.
**Fuente del formulario:** https://www.uscis.gov/sites/default/files/document/forms/i-129.pdf
**Edición confirmada:** 02/27/26 — vigente desde 01/04/26, edición anterior (20/01/25) rechazada por USCIS desde esa fecha. Verificado por búsqueda web (no contra el archivo PDF descargado ni contra uscis.gov directamente desde este entorno de Claude Code) en la sesión de diseño del 2026-07-18. Re-verificar contra uscis.gov antes de cualquier implementación futura, ya que USCIS actualiza ediciones periódicamente y esta verificación tiene fecha de caducidad implícita.
**Alcance:** Solo páginas 1-8 (Parts 1-9, cuerpo base) y 28-30 (O and P Classifications Supplement) — decisión explícita de Alex, no las 38 páginas completas del formulario.

## Naturaleza técnica del formulario

El I-129 es un formulario **XFA dinámico de Adobe LiveCycle Designer**, no un AcroForm plano. Confirmado por la convención de nombres jerárquicos de contenedor (`form1[0].#subform[N].CampoX[0]`). A pesar de ser XFA, el PDF expone un AcroForm de respaldo con nombres de campo semánticos y legibles (no genéricos) — 980 campos con página resuelta, extraídos y guardados en `i129-field-info-2026-02-27-edition.json` (adjunto en este directorio).

**[VERIFICADO 2026-07-18] Prueba de confiabilidad del AcroForm de respaldo — resultado positivo.** Se escribió un valor de prueba (`PRUEBA-XFA-TEST@example.com`) en el campo `Line9_EmailAddress[0]` (página 1, Part 1) usando `pypdf.PdfWriter.update_page_form_field_values()`, y se abrió el PDF resultante en Adobe Acrobat Reader real (no un visor alternativo). El valor apareció correctamente en el campo — confirma que Adobe Reader prioriza el AcroForm de respaldo sobre cualquier paquete XFA original al renderizar este formulario específico. Conclusión práctica: es seguro construir el llenado automático usando `pypdf`/AcroForm estándar sobre este documento, sin necesidad de manipular el paquete XFA XML (mucho más complejo). Pendiente de re-verificar si USCIS cambia de edición del formulario en el futuro, ya que el comportamiento XFA/AcroForm puede variar entre versiones del PDF generadas por LiveCycle.

## Gaps de datos confirmados (campos reales del I-129 que el intake no captura hoy)

1. **Dirección física del peer group / labor organization / management organization** (`Part7Line10b_EmpCity/State/ZipCode/StreetName` y equivalentes para los bloques 11/12/13) — `Module15` solo captura `peerGroupName`, no dirección.
2. **Fecha de envío de la consulta** (`Part7Line10c_Emp1FromDate` y equivalentes) — no capturado en `Module15`.
3. **Teléfono diurno del contacto de la organización de consulta** — no capturado en `Module15`.
4. **SSN/ITIN del peticionario persona natural** — confirmado ausente en la rama "Persona natural" del intake (Module1), verificado visualmente en la UI real por Alex. El EIN sí se captura para la rama "Empresa estadounidense".
5. **Granularidad de clasificación** — el I-129 tiene 10 checkboxes independientes de clasificación (O-1A, O-1B, O-2, P-1, P-1S, P-2, P-2S, P-3, P-3S, y sus variantes) en el ítem 3 del O/P Supplement. `Module1.visaType` es un string libre con solo 5 valores documentados en comentario (O-1A/O-1B/EB-1A/EB-1B/no_se) — no distingue O-2 ni ninguna variante P.
6. **Basis for Classification** (`new`/`change`/`concurrent`/`amended`/`continuation`/`previouschange`) — checkboxes del ítem 2 de Part 2, sin representación alguna en el modelo actual.
7. **[AMPLIADO 2026-07-18] Nombre y dirección sin desglosar — confirmado en Module1 y Module14.** El I-129 exige componentes separados en varios lugares que el intake captura como strings únicos:
   - **Nombre**: `Module1.fullName` (beneficiario), `Module14.representativeName` (representante autorizado de la empresa), `Module14.petitionerFullName` (persona natural) — el I-129 exige Family Name/Given Name/Middle Name por separado en cada uno de los puntos donde aparece un nombre de persona (Part 1 ítem 1, Part 3 ítem 2, Part 7 ítem 1).
   - **Dirección**: `Module1` no tiene dirección estructurada del beneficiario más allá de `cityOfResidence`/`countryOfResidence`; `Module14.companyAddress`/`petitionerAddress` son strings únicos — el I-129 exige Street Number and Name, Apt/Ste/Flr, City, State, ZIP Code como campos independientes en Part 1.

   Confirmado además: no existe campo SSN/ITIN en ninguna rama de `Module14` (ni `empresa` ni `persona_natural`) — refuerza el gap #4 (SSN/ITIN del peticionario persona natural), ahora visto también desde el módulo del peticionario, no solo desde la ausencia general.
8. **[VERIFICADO 2026-07-18] Requisito de organización(es) de consulta — depende de la sub-rama específica, no de la clasificación O-1B como tal.** El O/P Supplement (páginas 29-30) tiene tres sub-secciones mutuamente excluyentes, correspondientes a texto literal del formulario:
   - **"O-1 Extraordinary Ability"** → bloque 10.a-d (una sola organización — peer group o labor organization). Aplica a O-1A y a O-1B/"extraordinary ability in the arts".
   - **"O-1 Extraordinary achievement in motion pictures or television"** → bloques 11.a-d (Labor Organization) + 12.a-d (Management Organization), ambos requeridos. Aplica únicamente a la sub-rama O-1B/cine-TV (confirmado cruzando con el ítem 3.b de la página 28: "O-1B Alien of extraordinary ability in the arts **or** extraordinary achievement in the motion picture or television industry" — dos sub-poblaciones bajo un mismo checkbox).
   - **"O-2 or P alien"** → bloque 13.a-d (una sola organización).

   El hallazgo original (dicotomía simple "O-1A = 1 organización, O-1B = 2 organizaciones") era impreciso — el requisito dual depende de si el caso O-1B es específicamente de cine/TV, no de la clasificación O-1B en general. Esto refuerza el gap #5 (granularidad de clasificación): `Module1.visaType` no distingue hoy la sub-rama "arts" de "motion picture/TV" dentro de O-1B, y sería necesario para determinar automáticamente qué bloque de organización(es) corresponde.

## Pendiente de próxima sesión

- Verificar el hallazgo #8 (requisito dual O-1B) contra el texto real de instrucciones del I-129, no solo contra field_id de checkboxes.
- Decidir alcance de implementación: ¿rellenar el AcroForm completo automáticamente, o generar primero una hoja de resumen/checklist de datos para transcripción manual (opción intermedia de menor riesgo)?
- Diseñar el/los campo(s) nuevos necesarios en `Module1`/`Module15` para cerrar los gaps 1-4 y 7.
- Confirmar con una prueba real de llenado + apertura en Adobe Reader si el AcroForm de respaldo es fiable para XFA, antes de construir el pipeline de generación.

## Estado de implementación (2026-07-18)

Los 26 campos nuevos de intake diseñados para cerrar los gaps #1-4, #6, #7 están implementados y commiteados en `main`:

- **Gap #7** (nombre/dirección sin desglosar) — cerrado en `Module1` (beneficiario), y ambas ramas de `Module14` (representante de empresa, peticionario persona natural). Commits `8707123`, `b209d13`, `1deabc3`.
- **Gap #4** (SSN/ITIN) — cerrado en `Module14`, rama persona natural. Commit `09b6e41`.
- **Gap #6** (Basis for Classification) — cerrado en `Module14`, sección común. Commit `c269d20`.
- **Gaps #1-3** (dirección/fecha/teléfono de la organización de consulta) — cerrado en `Module15` Sección A. Commit `acd7b19`.

**Fuera de alcance por decisión explícita:** solo se implementó para O-1A, la única clasificación completamente validada en el pipeline de generación de cartas hasta la fecha. El **gap #5** (granularidad de clasificación de visa — O-2, variantes P, sub-rama arts/motion-picture-TV dentro de O-1B) queda pendiente de forma deliberada: no es necesario para O-1A, y tocaría `Module1.visaType`, campo consumido por los tres motores de generación de cartas ya validados en producción — cambio de mayor riesgo que merece su propia sesión de diseño.

**Pendiente para desbloquear el llenado real del PDF (siguiente fase, no iniciada):** con el modelo de datos ya completo para O-1A, la siguiente pieza sería la ruta/script que tome un caso real, lea estos campos, y use `pypdf` para rellenar el AcroForm del I-129 (edición 02/27/26) con los `field_id` reales documentados en `i129-field-info-2026-02-27-edition.json`, generando el PDF final. No se ha diseñado ni empezado esta pieza.
