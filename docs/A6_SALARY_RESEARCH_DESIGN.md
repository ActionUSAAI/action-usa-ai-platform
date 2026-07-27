# A6 — Salary Research Agent — Diseño

**Estado:** Diseño inicial, no implementado. Registrado 2026-07-24.

## Propósito

Genera evidencia comparativa de salario para el criterio "Alta remuneración relativa a los pares del campo" (8 CFR 214.2(o)(3)(iii)(B)(8) para O-1A; equivalente en EB-1A), usando datos reales de la Occupational Employment and Wage Statistics (OEWS) del Bureau of Labor Statistics (BLS) de EE.UU.

**Verificado 2026-07-24:** OEWS sigue siendo una fuente vigente y pública — API en `api.bls.gov/publicAPI/v2/timeseries/data/`, requiere clave de registro gratuita, organiza datos por código ocupacional (SOC) y área geográfica (estado/MSA), con percentiles de salario.

**Advertencia importante a preservar en cualquier documento generado:** algunas fuentes estatales de OEWS aclaran explícitamente que sus datos "no cumplen los requisitos legales para determinaciones de salario prevaleciente de certificación laboral" (proceso PERM). A6 debe presentar sus resultados siempre como evidencia comparativa de apoyo para el criterio de alta remuneración de O-1A/EB-1A — nunca como una determinación oficial de salario prevaleciente, que es un concepto legal distinto.

## Flujo completo

1. Staff/abogado selecciona el código SOC correcto para el caso, de una lista fija predefinida (sin sugerencia automática de IA — decisión explícita de Alex, para evitar mala clasificación).
2. El sistema lee la compensación del beneficiario (campo nuevo, ver abajo) y el área geográfica del empleo (`Module14.companyState`/`companyCity`, ya existentes).
3. Llamada a la API de BLS OEWS con el código SOC + área geográfica para obtener percentiles de salario reales.
4. Claude redacta un reporte comparativo en inglés — no solo una tabla de datos, sino texto explicativo listo para usarse como Exhibit independiente.
5. Se genera el PDF, se sube a Storage, se registra en una tabla nueva.
6. Botón nuevo en el panel de caso (mismo patrón que los demás motores), con descarga.

## Campo nuevo de intake

En `Module14`, junto a `offeredPosition`/`businessNature`:

```typescript
beneficiaryOfferedSalary: string;
beneficiarySalaryPeriod: "hourly" | "annual" | "";
```

## Selección de código SOC

Lista fija predefinida, curada inicialmente para los campos más comunes en la base de clientes actual (veterinaria, entrenamiento ecuestre, ciencias equinas), expandible con el tiempo. No usa IA para sugerir el código — decisión deliberada para evitar mala clasificación, dado que ocupaciones parecidas pueden tener datos salariales muy distintos.

## Tabla nueva — `agent_salary_research`

Mismo patrón que `i129_form_drafts` (sin `run_id`, ya que la única parte con IA es la redacción del reporte final, no una decisión de negocio compleja) — a confirmar en la sesión de implementación si de todas formas conviene registrar el `run_id` dado que sí hay una llamada a Claude involucrada.

## Preguntas de diseño pendientes, para la sesión de implementación

- ¿La lista de códigos SOC vive en el código (como `canonical-criteria.ts`) o en una tabla de base de datos editable por staff?
- ¿Qué pasa si el caso es EB-1A en vez de O-1A — cambia algo del criterio de alta remuneración, o es equivalente?
- ¿Se permite generar el reporte más de una vez por caso (ej. si cambia la oferta salarial), y cómo se maneja el historial?
- Verificar el proceso exacto de registro para obtener la clave de API de BLS antes de implementar.

## Integración con la Attorney Petition Letter — bloqueada, dependencia documentada

**Decisión de Alex (2026-07-24):** A6 no debe quedarse como un documento aislado — sus datos reales de BLS deben alimentar directamente el argumento del criterio `high_salary` en la Attorney Petition Letter, no solo existir como Exhibit adjunto sin conexión narrativa.

**Bloqueador real encontrado:** el Motor Abogado (estrategia multi-criterio) no tiene hoy ningún mecanismo para recibir contenido real de evidencia por criterio — ver `docs/A4_ATTORNEY_EVIDENCE_GAP.md` para el hallazgo completo. Esta integración queda explícitamente pendiente hasta que ese gap se resuelva, alineado con el diseño del Case Strategy Engine (`docs/AUCIS_V2_STRATEGY_LAYER.md`) — no se implementará como un parche aislado.

**Código SOC — aclaración importante de Alex:** el código SOC del beneficiario se determina por el **puesto ofrecido** (`Module14.offeredPosition`), no por la profesión de base del beneficiario (`Module1.profession`) — pueden ser distintos. Ejemplo real discutido: un beneficiario veterinario de profesión, pero cuyo puesto ofrecido y comparación salarial correspondiente es como entrenador de caballos ("Horse Trainer"), no como veterinario.
