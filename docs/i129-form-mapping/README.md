# Mapeo I-129 ↔ Modelo de Datos AUCIS

**Estado:** Investigación inicial. No implementado.
**Fuente del formulario:** https://www.uscis.gov/sites/default/files/document/forms/i-129.pdf
**Edición confirmada:** 02/27/26 — vigente desde 01/04/26, edición anterior (20/01/25) rechazada por USCIS desde esa fecha. Verificado por búsqueda web (no contra el archivo PDF descargado ni contra uscis.gov directamente desde este entorno de Claude Code) en la sesión de diseño del 2026-07-18. Re-verificar contra uscis.gov antes de cualquier implementación futura, ya que USCIS actualiza ediciones periódicamente y esta verificación tiene fecha de caducidad implícita.
**Alcance:** Solo páginas 1-8 (Parts 1-9, cuerpo base) y 28-30 (O and P Classifications Supplement) — decisión explícita de Alex, no las 38 páginas completas del formulario.

## Naturaleza técnica del formulario

El I-129 es un formulario **XFA dinámico de Adobe LiveCycle Designer**, no un AcroForm plano. Confirmado por la convención de nombres jerárquicos de contenedor (`form1[0].#subform[N].CampoX[0]`). A pesar de ser XFA, el PDF expone un AcroForm de respaldo con nombres de campo semánticos y legibles (no genéricos) — 980 campos con página resuelta, extraídos y guardados en `i129-field-info-2026-02-27-edition.json` (adjunto en este directorio).

**[CORREGIDO 2026-07-19 — la verificación anterior era inválida] Prueba de confiabilidad del AcroForm de respaldo — resultado NEGATIVO.**

La entrada original del 2026-07-18 marcaba este punto como verificado positivamente, pero esa verificación se hizo abriendo el PDF con una aplicación llamada "PDF Editor", no con Adobe Acrobat Reader real — a pesar de que el protocolo pedía explícitamente Adobe Reader. Al repetir la prueba el 2026-07-19 con Adobe Acrobat Reader genuino (recién instalado), el resultado es negativo: el campo de email rellenado con `pypdf` aparece completamente vacío en Adobe Reader real, a pesar de que el `/V` del campo está correctamente poblado a nivel de estructura de bytes (confirmado por separado).

Esto invalida la conclusión práctica original ("es seguro construir el llenado automático usando pypdf/AcroForm estándar"). El problema de fondo persiste: Adobe Reader parece estar renderizando desde el paquete XFA original embebido, no desde el AcroForm de respaldo que las herramientas modifican — independientemente de qué herramienta se use para escribir.

**Herramientas probadas el 2026-07-19, todas con resultado negativo en Adobe Reader real:**
- `pypdf` (Python) — el campo aparece vacío.
- `pdf-lib` (Node.js) — no detecta ningún campo (0 de 1,121).
- `pdf-lib` + PDF normalizado con `qpdf` — mismo fallo, no detecta campos.
- `muhammara` (Node.js) — instalación fallida (build nativo incompatible con la versión de Node del sistema), nunca se llegó a probar.
- `pdftk-java` (CLI) — detecta y escribe el campo correctamente a nivel de bytes, pero Adobe Reader lo ignora por completo: ni siquiera respeta el nombre del archivo, mostrando el título original "Form I-129 Petition..." — señal fuerte de que Adobe está renderizando exclusivamente desde el paquete XFA interno para este documento.

**Conclusión real, sin ambigüedad:** ninguna herramienta probada hasta ahora (Python o Node) logra que un valor escrito programáticamente sea visible en Adobe Acrobat Reader para este formulario específico. El AcroForm de respaldo, aunque técnicamente presente y escribible, parece ser cosmético/ignorado por el visor real que USCIS espera que se use. Esto es un hallazgo mucho más serio que "pdf-lib no es viable" — sugiere que el llenado programático de este documento vía manipulación de AcroForm, con cualquier herramienta estándar, podría no ser viable en absoluto.

**Pendiente de investigar antes de continuar con cualquier implementación:** (a) si existe alguna forma de forzar a Adobe Reader a priorizar el AcroForm sobre el XFA (posiblemente relacionado con la bandera `NeedAppearances` o con eliminar/deshabilitar el paquete XFA del PDF antes de rellenarlo), (b) si herramientas comerciales especializadas en XFA (Adobe LiveCycle Designer, o SDKs de pago) son la única vía real, (c) si el enfoque debería abandonarse por completo en favor de superposición de texto por coordenadas sobre una versión "aplanada" (flattened) del PDF, renderizada como imagen fija sin depender de ningún campo de formulario interactivo.

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

**Pendiente para desbloquear el llenado real del PDF (siguiente fase, no iniciada):** el modelo de datos está completo para O-1A, pero la pieza de llenado real del PDF sigue bloqueada — ver la corrección de 2026-07-19 más abajo. Ninguna herramienta probada hasta ahora produce un resultado visible en Adobe Acrobat Reader real. No se ha diseñado ni empezado el pipeline de generación hasta que se resuelva esta limitación técnica de fondo.

## [VERIFICADO 2026-07-19] pdf-lib (Node.js) no es viable — investigación posterior invalidó también a pypdf (ver corrección arriba)

Se repitió la prueba de confiabilidad ya validada con `pypdf` (campo `Line9_EmailAddress[0]`), esta vez con `pdf-lib` en Node.js, motivado por la necesidad de ejecutar el llenado desde una ruta API de Next.js/TypeScript en vez de un script de Python manual.

**Resultado: fallo total.** `pdf-lib` no detectó ningún campo de formulario (`form.getFields().length === 0`, contra los 1,121 que `pypdf` sí detecta), reportó cientos de advertencias de "Invalid object ref" durante el parseo, y la operación de guardado terminó en una excepción fatal (`Expected instance of PDFDict, but got instance of undefined`) sin producir ningún archivo de salida.

**Implicación arquitectónica:** el llenado real del I-129 no puede implementarse como una ruta API de Next.js pura usando `pdf-lib`. Las opciones para la siguiente fase son:
1. Un microservicio o función serverless separada que ejecute Python (`pypdf`), invocada desde la ruta API de Next.js — introduce una pieza de infraestructura nueva que el resto del proyecto no tiene.
2. Investigar si otra librería de Node.js (ej. `pdf-parse` combinado con manipulación manual de bytes, o herramientas de línea de comandos como `pdftk` invocadas vía `child_process` desde la ruta API) maneja este PDF específico mejor que `pdf-lib`. No probado.
3. Mantener el llenado como un script de Python ejecutado manualmente por el staff (no automatizado desde la UI), al menos para una primera versión — el proceso ya está probado y funciona, aunque no esté integrado en el flujo del panel.

Ninguna de las tres opciones ha sido decidida. Pendiente de sesión de diseño dedicada antes de escribir cualquier código de la ruta de llenado.

## Plan de siguiente fase (2026-07-19) — investigar conversión XFA→AcroForm antes de construir motor de coordenadas

Tras el hallazgo negativo de que ninguna herramienta estándar logra que un valor escrito en el AcroForm sea visible en Adobe Reader (ver corrección anterior), se define el siguiente orden de investigación, en vez de seguir probando más librerías de relleno de campos:

**Corrección de contexto importante:** el backend real de AUCIS es Next.js/TypeScript (los tres motores de generación de cartas ya en producción lo confirman) — no Python. Python se usó únicamente para los experimentos puntuales de esta investigación del PDF, corridos manualmente en terminal. Cualquier pieza de Python que termine siendo necesaria (por ejemplo, si la única vía de conversión XFA→AcroForm requiere herramientas de ese ecosistema) sería una pieza aislada y pequeña, no el núcleo de la aplicación.

**Prioridad 1 — Investigar si el I-129 XFA puede convertirse de forma automatizada y confiable a un AcroForm estándar.** Si es viable, todo el trabajo ya hecho (mapeo de 980 campos, `pypdf`/herramientas equivalentes) se reutiliza directamente — solo cambiaría el PDF de entrada, no la lógica de relleno. Vías a explorar: Adobe Acrobat Pro (conversión manual/scriptable), herramientas de línea de comandos que soporten "flatten" o "remove XFA", SDKs comerciales con función de conversión. No investigado todavía.

**Prioridad 2 (si la 1 falla o no es viable/legal para uso en un SaaS) — Motor de renderizado por coordenadas.** En vez de rellenar "campos" del PDF, el sistema dibuja el texto directamente encima de una plantilla del I-129, en las coordenadas exactas donde USCIS espera cada dato — el resultado es un PDF final donde el contenido es visual, no depende de ningún mecanismo de formulario interactivo, y por tanto es inmune al problema de XFA. Más trabajo de diseño inicial (hay que determinar la posición exacta de cada uno de los ~40-50 campos relevantes de páginas 1-8/28-30), pero garantiza el resultado y es reutilizable para futuros formularios (I-140, I-765, I-539).

**Herramientas comerciales de pago** (Apryse PDF SDK, iText pdfXFA, Adobe AEM Forms) quedan anotadas como alternativa futura si el proyecto genera ingresos suficientes — no deben bloquear el desarrollo actual de ninguna de las dos prioridades anteriores.

**Principio de diseño acordado:** el PDF es únicamente la capa de presentación final. La fuente de verdad del caso vive en la base de datos de AUCIS (Supabase/Postgres), no en el PDF — coherente con cómo ya funcionan los tres motores de cartas, que generan `.docx` a partir de los datos del intake, nunca al revés.

## [VERIFICADO 2026-07-19] Conversión XFA→AcroForm exitosa — eliminar /XFA resuelve el problema por completo

Siguiendo la Prioridad 1 del plan de siguiente fase, se probó eliminar la entrada `/XFA` del diccionario `AcroForm` del PDF original, usando `pikepdf` (más apropiado que `pypdf` para manipular estructura interna de bajo nivel):

```python
import pikepdf
pdf = pikepdf.open('i-129-full.pdf')
del pdf.Root.AcroForm['/XFA']
pdf.save('i-129-no-xfa.pdf')
```

El `AcroForm` original tenía 5 claves (`/Fields`, `/DA`, `/XFA`, `/DR`, `/SigFlags`); tras la eliminación, quedan 4, sin `/XFA`. El PDF resultante pasa de 2,296,144 bytes a 912,400 bytes — el paquete XFA (el XML completo de LiveCycle con toda la lógica dinámica del formulario) representaba aproximadamente el 60% del peso del archivo original.

Se rellenó el mismo campo de prueba de siempre (`Line9_EmailAddress[0]`) con `pypdf` sobre este PDF sin XFA, y se verificó en Adobe Acrobat Reader real, con confirmación explícita de Alex en los tres puntos del protocolo (aplicación correcta, valor visible, título del archivo conservado): **el valor aparece correctamente, y el nombre del archivo se conserva** (a diferencia de todas las pruebas anteriores, donde Adobe ignoraba el archivo y mostraba el título interno "Form I-129 Petition...", señal inequívoca de que estaba renderizando desde XFA).

**Conclusión: la hipótesis de la Prioridad 1 queda confirmada.** Todo el trabajo ya realizado es reutilizable sin cambios — los 980 campos mapeados (`i129-field-info-2026-02-27-edition.json`), `pypdf` como herramienta de escritura, el modelo de datos completo para O-1A. Solo se agrega un paso previo obligatorio: eliminar `/XFA` del PDF antes de rellenarlo.

**Pendiente de verificar antes de construir el pipeline completo:**
1. Confirmar que eliminar `/XFA` no rompe nada visualmente en las páginas que **no** se van a rellenar — es decir, que el formulario se siga viendo correctamente en las secciones sin datos de prueba, no solo en el campo que probamos.
2. Confirmar el mismo comportamiento en al menos 2-3 campos adicionales de tipos distintos (checkbox, choice/dropdown, no solo texto libre) — el campo de email es un `/Tx` (texto) simple; los checkboxes de clasificación (`a_O1A`, etc.) y los combos de estado podrían comportarse distinto.
3. Confirmar que la conversión es legal/aceptable para radicación real ante USCIS — eliminar `/XFA` cambia la naturaleza del documento; vale la pena confirmar que un I-129 sin su paquete XFA sigue siendo un documento válido para USCIS y no genera problemas de procesamiento en su sistema (que podría, en teoría, esperar la estructura XFA original). No es un problema técnico sino de cumplimiento — pendiente de verificar antes de usar esto en un caso real.

## [VERIFICADO 2026-07-19] Puntos 1 y 2 cerrados — múltiples tipos de campo e integridad visual confirmados

Prueba ampliada sobre el PDF sin `/XFA`, rellenando simultáneamente los tres tipos de campo presentes en el alcance del proyecto (páginas 1-8, 28-30):

- **Texto** (`Line9_EmailAddress[0]`) — `PRUEBA-AMPLIADA-TEST@example.com`.
- **Checkbox** (`a_O1A[0]`, ítem 3 de la página 28) — marcado con `/V` y `/AS` ambos en `/1`, verificado contra el único estado de apariencia real disponible en el widget (`/AP /N`), no un valor arbitrario asumido.
- **Choice/dropdown** (`P1_Line3_State[0]`, página 1) — `CA`.

Verificado en Adobe Acrobat Reader real por Alex, con confirmación explícita en los 5 puntos del protocolo: los tres campos se muestran correctamente — el checkbox de O-1A aparece marcado junto a su etiqueta completa ("O-1A Alien of extraordinary ability in sciences, education, business or athletics..."), confirmando que el mecanismo de checkbox (que depende de `/AS`, no solo de `/V`) también sobrevive la eliminación de `/XFA`.

**Punto 1 (integridad visual) también confirmado:** Alex revisó páginas del documento no tocadas por el relleno y las confirmó visualmente normales, sin texto faltante ni formato dañado — la eliminación de `/XFA` (que redujo el archivo en ~60% de su peso) no afecta la renderización de las secciones sin datos de prueba.

**Nota técnica para la implementación del pipeline:** el nombre del estado "activado" de un checkbox no sigue una convención universal (`/1` en este caso, no `/Yes` u `/On` como es común en otros PDFs) — el código de relleno real deberá leer el estado de apariencia correcto desde cada widget individualmente (vía `/AP /N`), no asumir un valor fijo para todos los checkboxes del formulario.

**Estado de los tres pendientes originales:**
1. ✅ Integridad visual — confirmado.
2. ✅ Tipos de campo variados — confirmado (texto, checkbox, choice).
3. ⏳ Aceptación de USCIS del documento sin `/XFA` — sigue pendiente, es una pregunta de cumplimiento legal, no técnica, fuera del alcance de lo que se puede verificar con pruebas de software.

Con los puntos 1 y 2 cerrados, el camino técnico para construir el pipeline real de llenado (eliminar `/XFA` → rellenar con `pypdf` usando el mapeo de `i129-field-info-2026-02-27-edition.json` → entregar el PDF) queda validado. Falta solo resolver el punto 3 antes de usarlo en un caso de radicación real, y diseñar/construir la ruta de orquestación (probablemente un microservicio Python o una función serverless con runtime Python, dado que esta lógica depende de `pypdf`/`pikepdf`, no reproducible en el Node.js/TypeScript del resto de la aplicación).

## [VERIFICADO 2026-07-19] Punto 3 cerrado — radicación electrónica del I-129 solo existe para H-1B, y AUCIS es exclusivamente de radicación física

**Corrección de proceso:** un primer intento de esta entrada (mismo día) se basó en fuentes de terceros que resultaron contradictorias entre sí, sin verificación contra la fuente oficial — fue señalado y descartado antes de comitear, sin llegar a documentarse como verificado. Se repite la verificación correctamente a continuación.

**Fuente primaria, verificada directamente por Alex en su navegador** (la página bloquea el acceso automatizado tanto de Claude como de Claude Code): `uscis.gov/file-online/forms-available-to-file-online`. Las únicas entradas relacionadas con el Formulario I-129 en la lista oficial de formularios disponibles para radicación en línea son:
- "USCIS acepta el Formulario I-129 para las peticiones H-1B que no están sujetas a la cantidad máxima reglamentaria."
- "USCIS acepta el Formulario I-129 para las peticiones H-1B que están sujetas a la cantidad máxima reglamentaria para peticionarios cuyos registros fueron seleccionados."

Ninguna clasificación O (O-1A, O-1B, O-2) aparece en la lista — la radicación electrónica del I-129 hoy está limitada exclusivamente a H-1B.

**Decisión de producto confirmada por Alex:** independientemente de qué clasificaciones tengan o no radicación electrónica disponible en el futuro, AUCIS está diseñada exclusivamente para radicación física (impresa y enviada por correo) — no para radicación en línea. Esto hace que la pregunta de si USCIS "acepta" la estructura digital de un PDF sea, en la práctica, irrelevante: el documento se imprime y se envía por correo, y USCIS recibe tinta sobre papel, nunca el archivo digital ni su estructura interna (presencia o ausencia de `/XFA`).

**Requisitos reales que sí aplican a la radicación física**, según la guía oficial de USCIS: páginas de una sola cara, tamaño carta estándar (8½ x 11 pulgadas), y que todas las páginas correspondan a la misma edición del formulario — ninguno de estos depende de la estructura interna del PDF.

**Estado final de los tres pendientes originales:**
1. ✅ Integridad visual — confirmado.
2. ✅ Tipos de campo variados — confirmado.
3. ✅ Cumplimiento de USCIS — confirmado como no aplicable, verificado con fuente primaria directa (no de terceros) y con la decisión de producto de radicación exclusivamente física.

Con los tres pendientes cerrados, el camino técnico y de cumplimiento para el llenado real del I-129 queda completamente validado. Queda pendiente únicamente la pieza de implementación: diseñar y construir la ruta/pipeline de generación real (probablemente un microservicio o función con runtime Python, dado que la lógica depende de `pypdf`/`pikepdf`).

## [VERIFICADO 2026-07-19] Vercel soporta funciones Python conviviendo con Next.js en el mismo proyecto

Antes de diseñar el pipeline real de generación del I-129, se verificó si Vercel permite desplegar una función serverless en Python (necesaria porque `pypdf`/`pikepdf` son las únicas herramientas confirmadas capaces de rellenar el formulario de forma visible en Adobe Reader) en el mismo proyecto donde vive la aplicación Next.js/TypeScript existente — sin necesidad de un servicio de hosting externo separado.

**Prueba:** un archivo mínimo `api/hello-python.py` (convención de Vercel: un directorio `api/` en la raíz del repo, distinto de `src/app/api/` que es exclusivo de las rutas de Next.js App Router), con `requirements.txt` duplicado en la raíz y dentro de `api/` para cubrir ambas convenciones posibles del builder.

**Resultado:** desplegado exitosamente (estado "Ready" en Vercel), y verificado en el navegador real de Alex contra `https://actionusaai.com/api/hello-python` — responde correctamente el JSON de prueba.

**Conclusión:** la arquitectura de pipeline puede construirse como una función Python serverless dentro del mismo proyecto/despliegue, sin infraestructura externa adicional. El archivo de prueba (`api/hello-python.py`) se elimina en este mismo commit, reemplazado más adelante por la función real de relleno del I-129.

## Estado del mapeo Part 1-3 (2026-07-21) — pausa por límite de saldo, decisiones tomadas

Mapeo campo-por-campo de Part 1 (Petitioner Information, páginas 1-2) completado con descripciones reales de USCIS (`FieldNameAlt` vía `pdftk`).

**Gaps cerrados en esta sesión:** `requestedAction` (commit `a5b5b6e`), contacto del peticionario — teléfono/móvil/email en ambas ramas (commit `0b38aad`).

**Decisiones tomadas para campos sin fuente en el intake — reglas fijas, sin campo nuevo:**
1. **Tipo de entidad** (`P1Line6_Yes/No`) — regla fija: siempre `No` (no sin fines de lucro). Si un caso real es distinto, el abogado lo ajusta manualmente en el PDF generado — caso poco común en la práctica de Alex.
2. **Número de recibo de petición previa** (`Line1_ReceiptNumber`) — regla fija: dejar vacío. Normal en peticiones nuevas; se completa manualmente en casos excepcionales.
3. **Dirección extranjera del peticionario** (`P1_Line3_Province/PostalCode/Country`, Part 1) — regla fija: dejar vacío. El peticionario de AUCIS está en EE.UU. por diseño del intake.

**Pendiente para el jueves 2026-07-23 (tras reset de saldo):**
- **Resto de Part 3** (información del beneficiario) — mapeo campo-por-campo detallado, no hecho todavía más allá del nombre.
- **Importante para ese mapeo:** a diferencia de la dirección extranjera del peticionario (regla fija, caso raro), la dirección actual/extranjera del **beneficiario** en Part 3 SÍ es relevante en prácticamente todos los casos — el beneficiario es extranjero por definición, a diferencia del peticionario. Verificar qué campos de `Module1` (`countryOfResidence`, `cityOfResidence`) cubren esto y si hace falta estructurarlos más (dirección completa, no solo país/ciudad).
- Continuar el mapeo de Part 4 en adelante (Processing Information) y confirmar Part 5-9.

**Esta sesión avanza con la construcción de la función Python real de relleno** (`api/i129_fill.py`), usando el mapeo de Part 1 ya confirmado — más valioso que seguir cerrando gaps menores con el saldo restante.

## [VERIFICADO 2026-07-21] Función Python real (`api/i129_fill.py`) validada de punta a punta

Se creó la función serverless real de relleno (`api/i129_fill.py`), implementando exactamente la lógica ya validada en pruebas manuales: eliminar `/XFA` del PDF base (`api/i-129-base.pdf`, copia idéntica del PDF oficial ya confirmado con Adobe Reader) y rellenar con `pypdf`.

**Prueba de la lógica interna** (sin pasar por el servidor HTTP): se invocó `remove_xfa_and_fill()` directamente con un campo de prueba — generó un PDF de 1,817,013 bytes (consistente con las pruebas manuales previas, ~1,817,020 bytes), con el valor confirmado a nivel de bytes (`/V`).

**Verificación visual final en Adobe Acrobat Reader real por Alex, con confirmación explícita en ambos puntos del protocolo:** `PRUEBA-PIPELINE@example.com` aparece correctamente en el campo de email de la página 1, generado por el código real que se desplegará, no solo por scripts de prueba manuales en terminal.

**Pendiente antes de desplegar a producción:** desplegar `api/i129_fill.py` a Vercel (mismo patrón ya confirmado con `api/hello-python.py`) y probar el endpoint HTTP real vía `curl`/fetch, no solo la función Python de forma aislada.

## [VERIFICADO 2026-07-21] Endpoint real desplegado en producción — pipeline técnico completo

Se probó `https://actionusaai.com/api/i129_fill` en producción (no localmente), vía `curl` con `POST` real:

```bash
curl -s -X POST https://actionusaai.com/api/i129_fill \
  -H "Content-Type: application/json" \
  -d '{"fieldValues": {"campo": "valor"}}' \
  -o salida.pdf
```

**Resultado:** HTTP 200, PDF válido de 38 páginas (1,817,026 bytes, consistente con las pruebas anteriores), con el campo de prueba correctamente escrito a nivel de bytes.

**Verificación visual final en Adobe Acrobat Reader real por Alex, con confirmación explícita:** `PRUEBA-ENDPOINT-REAL@example.com` aparece correctamente en el campo de email de la página 1 del PDF descargado del endpoint real de producción.

**Estado del pipeline técnico:** completo y validado de punta a punta — desde la eliminación de `/XFA`, pasando por la función Python real, hasta el endpoint de Vercel en producción sirviendo el resultado correctamente. Los tres eslabones (lógica → función → despliegue) están confirmados con evidencia visual real, no solo con verificación de bytes.

**Pendiente para continuar el pipeline completo (no bloqueante para lo ya construido):**
1. La ruta TypeScript orquestadora que llame a este endpoint con los datos reales de un caso (hoy el endpoint recibe `fieldValues` ya armado manualmente en la prueba).
2. Completar el mapeo campo-por-campo del resto del formulario (Part 3 en adelante) para poder construir ese `fieldValues` real a partir de `Module1`/`Module14`/`Module15`.
3. La tabla `i129_form_drafts` y la integración con el panel de UI (botón "Generar I-129").
4. Implementar las reglas fijas ya decididas (tipo de entidad, número de recibo, checkbox de clasificación O-1A) dentro de la lógica de construcción de `fieldValues`.

## [VERIFICADO 2026-07-21] Ruta orquestadora TypeScript validada de punta a punta con datos reales de negocio

Se construyó `src/app/api/agents/a4-i129-form/route.ts` — primera versión de prueba de arquitectura, alcance intencionalmente parcial (Part 1 completo + nombre del beneficiario + checkbox O-1A + basis for classification). Sigue el mismo patrón de las otras tres rutas de agentes (`adminDb()`, lectura de `intake_submissions`, `module1`/`module14`).

**Prueba real de punta a punta:** caso sintético creado con datos de negocio completos (empresa, dirección estructurada, contacto, EIN) → `POST /api/agents/a4-i129-form` con solo `case_id` → la ruta lee los datos, construye `fieldValues`, llama al endpoint Python en producción (`actionusaai.com/api/i129_fill`), sube el PDF resultante a Storage.

**Verificación visual completa en Adobe Acrobat Reader real por Alex:** confirmado que aparecen correctamente — nombre de la empresa, dirección completa (calle, número de suite, ciudad, estado, ZIP), teléfono, email, FEIN (página 1), checkbox de clasificación O-1A marcado con su etiqueta completa (página 28), y el checkbox "New employment" de Basis for Classification (página 2). A diferencia de las pruebas anteriores (un solo campo de texto aislado), esta prueba valida múltiples tipos de dato (texto, dirección estructurada, dos checkboxes distintos) generados automáticamente desde datos reales de un caso, no escritos a mano en un script.

**Alcance explícito de esta versión, no bloqueante:** no genera un I-129 completo (el resto del formulario, Part 3 en adelante salvo el nombre, queda en blanco); no persiste registro en base de datos (pendiente: tabla `i129_form_drafts`); no tiene botón en el panel de UI todavía.

**Estado del pipeline:** la arquitectura completa (intake → TypeScript → función Python → Storage) queda validada de punta a punta con datos reales. Las piezas pendientes (completar el mapeo de campos, tabla de registro, UI) son ahora trabajo de ampliación sobre una base ya demostrada, no de validación de diseño.

## [VERIFICADO 2026-07-21] Botón "Generar I-129" funcional en la UI real, de punta a punta

Se agregó la cuarta sección al panel `A3A4Panel` (Testimonial, Institucional, Abogado, ahora I-129) — mismo patrón visual y de estados que las tres anteriores. Verificado en el navegador real por Alex contra un caso de prueba con datos de negocio completos: clic en "Generar I-129" → PDF generado → descarga confirmada visualmente en Adobe Reader, con los mismos datos ya validados en la prueba de la ruta directa (empresa, dirección estructurada, FEIN, contacto, nombre del beneficiario, checkbox O-1A, basis for classification).

**Diagnóstico de un problema real encontrado en el camino, no relacionado con la lógica de negocio:** el primer intento del botón no produjo ninguna petición de red visible. Se descartaron progresivamente: (a) el botón deshabilitado por `submissionId` faltante — visualmente idéntico a los otros botones funcionales, descartado; (b) fallo del backend — descartado al confirmar con `curl` directo que la ruta funciona perfectamente (insertó fila real en `i129_form_drafts` y archivo en Storage). La causa real: **caché de compilación de Next.js (`.next/`) corrupta**, con el navegador solicitando un chunk JavaScript (`main-app.js`) que el servidor ya no reconocía (`404 Not Found`), dejando el frontend en un estado roto sin errores visibles obvios más allá de ese 404 en la consola. Resuelto con `rm -rf .next` + reinicio del servidor + recarga completa del navegador (`Cmd+Shift+R` y cierre/reapertura de la pestaña) — mismo patrón de incidente que ya se había documentado en sesiones anteriores del pipeline de cartas (2026-07-17/18).

**Con esto, los cuatro motores de generación de documentos de AUCIS (Testimonial, Institucional, Abogado, I-129) están completamente integrados en la UI del panel de caso, cada uno validado con evidencia visual real en Adobe Reader/navegador.**

**Recordatorio para sesiones futuras:** si un botón del panel "no responde" sin error visible aparente, verificar primero la consola del navegador por errores `404` de chunks de Next.js antes de asumir un bug de lógica — es un patrón de incidente recurrente en este proyecto durante desarrollo local, no específico de esta pieza.

## [VERIFICADO 2026-07-22] Part 3 (Beneficiario) completo — dirección extranjera y dirección en EE.UU. validadas con datos reales

Prueba de punta a punta con un caso sintético que ejercita ambas ramas: `willChangeStatusInUSA: true`, con dirección extranjera (Colombia) y dirección en EE.UU. (Orlando, FL) pobladas simultáneamente.

**Verificado en Adobe Acrobat Reader real por Alex:** todos los campos del PDF generado aparecen correctamente llenos, incluyendo página 3 (fecha de nacimiento, país de nacimiento, dirección en EE.UU. — calle, apartamento, ciudad, estado, ZIP) y página 4 (dirección extranjera completa — calle, ciudad, provincia, código postal, país).

**Con esto, el mapeo de Part 3 completo (nombre, fecha de nacimiento, país de nacimiento/ciudadanía, dirección extranjera siempre, dirección en EE.UU. condicional) queda validado de punta a punta: intake → base de datos → ruta orquestadora → función Python → PDF → confirmación visual real.**

## Decisión — Part 4 §2-§11 quedan sin mapear (2026-07-22)

Los 11 campos de Part 4 más allá de la dirección extranjera del beneficiario (§2 pasaporte válido, §3 otras peticiones, §4 I-94 de reemplazo, §5 dependientes, §6 removal proceedings, §7 petición de inmigrante previa, §8A/§8B clasificación previa otorgada/denegada, §9 petición no inmigrante previa, §10 grupos de entretenimiento, §11A/§11B historial J-1/J-2) quedan explícitamente sin mapear en `buildI129FieldValues`, por decisión de Alex.

**Razón:** son preguntas de naturaleza legal delicada (antecedentes migratorios, procesos de remoción, historial de peticiones previas) — automatizarlas con una regla fija tipo "asumir No" sería riesgoso si algún caso real tiene una respuesta "Sí" que el sistema omitiera silenciosamente. Ninguna tiene fuente en el intake actual.

**Patrón notable:** casi todas las preguntas que podrían responderse "Sí" enrutan a una explicación de texto libre en Part 9 (no mapeado todavía) — no son solo un checkbox aislado, sino que implican contenido narrativo adicional si aplican.

**Estado:** el PDF generado hoy deja estos 11 campos completamente en blanco (ningún checkbox marcado). El preparador debe revisar y completar manualmente esta sección antes de radicar cualquier caso real. Pendiente de revisar en una futura sesión, posiblemente como parte de un flujo de revisión manual explícito en la UI, no como reglas fijas automáticas.

**Siguiente pieza del mapeo:** Part 5 (Basic Information About the Proposed Employment and Employer).

## [VERIFICADO 2026-07-22] Bug sistemático de checkboxes corregido y validado con datos reales

Durante la prueba de punta a punta de Part 5, se detectó que el checkbox de itinerario (`P5Line4_Yes`) no se marcaba visualmente en Adobe Reader a pesar de `hasItinerary: true` en el caso de prueba. Diagnóstico con `pikepdf` inspeccionando `/AP /N` de cada widget reveló que la asunción de `"/1"` universal (documentada como riesgo aceptado hace varios días) era incorrecta en 15 de los 22 checkboxes mapeados hasta ese momento — solo `a_O1A` y el mapa de `basisForClassification` usaban realmente `/1`; el resto usa `/Y`, letras `/A`-`/D` (para las 4 opciones de `requestedAction`), o strings con espacios literales (`" APT "`, `" STE "`, `" FLR "` para los checkboxes de tipo de unidad).

**Corrección aplicada (commit `992c5cb`):** cada uno de los 15 checkboxes corregido individualmente con su valor real, verificado con `repr()` para los casos con espacios (eliminando cualquier ambigüedad de transcripción).

**Verificado en Adobe Acrobat Reader real por Alex, regenerando el mismo caso de prueba de Part 5:** el checkbox de itinerario ahora aparece correctamente marcado en "Yes", y las dos reglas fijas de Part 5 (§5 trabajo fuera de sitio, §6 exclusivo CNMI) aparecen correctamente en "No".

**Lección para el resto del mapeo (Part 6 en adelante):** nunca asumir el valor "on" de un checkbox sin verificar su `/AP /N` real primero — el patrón no es consistente ni siquiera dentro del mismo formulario. Cualquier checkbox nuevo que se mapee de aquí en adelante debe pasar por esta verificación antes de escribirse en `buildI129FieldValues`.

**Nota operativa:** durante el desarrollo local, si un cambio reciente no se refleja visualmente después de regenerar, limpiar el caché de Next.js (`rm -rf .next` + reinicio del servidor) — mismo patrón de incidente ya documentado el 2026-07-21.

## Alcance final del mapeo automático — decisión de Alex (2026-07-22)

Se decide cerrar el alcance del mapeo automático de `buildI129FieldValues` en lo ya construido. El resto del formulario (Part 4 §2-§11, Part 6 en adelante) se completa manualmente por el preparador antes de radicar.

**Cubierto automáticamente (verificado con datos reales en Adobe Reader):**
- Part 1 — Petitioner Information (completo)
- Part 2 — Information About This Petition (completo: clasificación, basis, requested action, total de trabajadores)
- Part 3 — Beneficiary Information (nombre, fecha de nacimiento, país de nacimiento/ciudadanía, dirección extranjera, dirección en EE.UU. condicional)
- Part 5 — Employment (parcial, por decisión explícita: título del puesto, itinerario, fechas de empleo, tipo de negocio — sin salario, tiempo completo/parcial, ni datos financieros de la empresa)
- O/P Supplement — checkbox de clasificación O-1A

**Queda para completar manualmente por el preparador:**
- Part 4 §2-§11 — preguntas de antecedentes migratorios y peticiones previas (naturaleza legal delicada, decisión ya documentada arriba)
- Part 5 — campos financieros/operativos no mapeados (salario, tiempo completo/parcial, año de establecimiento, # empleados, ingresos)
- Part 6 — Certificación de tecnología controlada (EAR/ITAR) — aplica a O-1A, requiere juicio legal caso por caso
- Part 7-9 — Declaraciones, firmas, y espacio adicional

**Justificación:** el valor real del PDF pre-llenado está en las secciones de datos estructurados y objetivos (identidad, dirección, empleo básico) — donde la automatización reduce trabajo repetitivo sin riesgo. Las secciones restantes son declaraciones legales, certificaciones bajo pena de perjurio, y preguntas de antecedentes donde la revisión humana caso por caso es apropiada y necesaria, no un obstáculo a eliminar.

**Estado del proyecto I-129:** el pipeline técnico (eliminación de XFA, función Python, ruta orquestadora, tabla de registro, botón en el panel) está completo y en producción. El mapeo de campos está completo según el alcance aquí definido. No quedan tareas de desarrollo activas para el I-129 salvo bugs que surjan en uso real.
