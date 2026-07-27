# AUCIS v2.0 — Arquitectura de Motores Especializados (Sistema Experto Jurídico)

**Estado:** Visión de producto, actualizada 2026-07-27. Reemplaza la versión anterior de este documento (cuatro módulos sueltos: Case Strategy Engine, Evidence Gap Analyzer, RFE Prediction Engine, Document Generation Engine) con una arquitectura de tres capas, a partir de una conversación con Alex.

**Cambio de lenguaje deliberado:** de aquí en adelante, los componentes de AUCIS se llaman **motores (engines)**, no "agentes" — un agente implica autonomía de acción; lo que construye AUCIS son componentes especializados con responsabilidades claras que colaboran entre sí, no entidades que actúan de forma independiente.

## Diagnóstico de fondo

AUCIS v1 tiene un motor de generación documental sólido y validado (A1 Intake Analyzer, A3 Testimonial/Institucional, A4 Attorney Letter/I-129) — pero genera documentos sin una capa de razonamiento estratégico previo. El hallazgo de `docs/A4_ATTORNEY_EVIDENCE_GAP.md` (el Motor Abogado redacta sin acceso a contenido real de evidencia) es el síntoma concreto de esta ausencia.

## Las tres capas

### Capa 1 — Evidence Intelligence (el sistema entiende los hechos, sin estrategia todavía)

- **A0 — CV Extractor**: extrae datos de la hoja de vida generada por el Coach externo (ChatGPT) y pre-llena el intake. Diseñado en `docs/AUCIS_CV_COACH_INTEGRATION.md`.
- **A1 — Criteria Evaluation Engine** (ya existe, renombrado conceptualmente): determina, de forma independiente y objetiva, si cada criterio está satisfecho y con qué nivel de solidez probatoria. **A1 mide — nunca decide estrategia.**
- **A2 — Evidence Normalization** (ya existe como Document Processor): normaliza y traduce documentos de evidencia a formato utilizable.

### Capa 2 — Legal Intelligence (aparece el razonamiento del abogado)

- **A5 — Case Strategy Engine**: transforma los resultados de A1 en una teoría jurídica coherente, prioriza los criterios según su función dentro del caso, organiza la evidencia, y define la estrategia narrativa y probatoria que seguirán todos los documentos del expediente. **A5 decide — nunca vuelve a evaluar evidencia.** Es el cerebro de todo el expediente; todo lo demás trabaja para él. Diseño completo en `docs/A5_CASE_STRATEGY_ENGINE_DESIGN.md`.

### Capa 3 — Document Intelligence (el sistema ejecuta, ya no piensa)

- **A3 — Document Generation Engine** (Testimonial/Institucional, ya existe): ejecuta la estrategia definida por A5, ya no decide narrativa por su cuenta.
- **A4 — Petition Builder** (ya existe): ídem, incluyendo el I-129.

### Capa 4 — Validation Layer (nueva, prioridad inmediata después de A5)

- **Quality Assurance Engine**: lee el expediente completo ya generado y responde preguntas de consistencia antes de que se considere listo para radicar:
  - **Consistencia**: ¿todas las cartas dicen lo mismo sobre los mismos hechos?
  - **Fechas**: ¿hay inconsistencias cronológicas entre documentos?
  - **Cobertura**: ¿todo lo que afirma la Attorney Letter aparece probado en algún Exhibit?
  - **Evidencia huérfana**: ¿existe evidencia mencionada en el intake que nunca se usó en ningún documento?
  - **Contradicciones**: ¿alguna carta dice algo que contradice otra?
  - **Redundancia**: ¿varias cartas repiten exactamente el mismo argumento sin aportar nada nuevo?

  **Decisión de secuencia explícita de Alex:** el QA Engine se construye antes que el RFE Prediction Engine — no tiene sentido predecir qué preocupará a un oficial de USCIS sobre un expediente que no se ha verificado como internamente consistente primero.

### Capa 5 — Prediction Layer (después de QA, con expediente ya validado)

- **RFE Prediction Engine**: estima qué criterios son más susceptibles de generar un Request for Evidence y por qué — el sistema "cambia de personalidad": deja de pensar como abogado (A5) y empieza a pensar como oficial de USCIS revisando el expediente. Solo tiene sentido una vez que el expediente ya pasó por el QA Engine.

## A6 — de "Salary Research" a "Market Intelligence Engine"

**Decisión de Alex, 2026-07-27:** generalizar A6 más allá de un solo criterio. En vez de limitarse a investigación salarial (útil solo para el criterio de alta remuneración), se convierte en un motor de inteligencia de mercado reutilizable para múltiples tipos de evidencia: salarios (BLS OEWS, ya diseñado), premios, asociaciones, journals académicos, rankings, impacto económico, organizaciones relevantes, y regulaciones — cada criterio que necesite datos externos confiables consume esta misma inteligencia, en vez de construir un motor aislado por cada tipo de dato.

El diseño ya completo en `docs/A6_SALARY_RESEARCH_DESIGN.md` (BLS OEWS, selección manual de SOC, bloqueado por el gap de evidencia hasta que A5 exista) se conserva como la primera implementación concreta dentro de este motor más amplio — no se descarta, se reencuadra como el primer módulo del Market Intelligence Engine.

## A7 — de un solo módulo indefinido a dos motores distintos

**Decisión de Alex, 2026-07-27:** "A7" representaba en realidad dos problemas distintos, nunca separados con claridad:

- **Client Case Monitor**: seguimiento operativo del expediente — cronología, checklist, pendientes.
- **Learning Engine**: el más valioso de largo plazo, pero también el más difícil de construir pronto — cada vez que USCIS aprueba, niega, o emite un RFE sobre un caso real, el sistema debería aprender y ajustar automáticamente pesos, estrategias, prompts, y recomendaciones futuras. Requiere volumen real de resultados de USCIS a lo largo del tiempo antes de ser útil — no es una pieza que "funcione" de inmediato al construirse, a diferencia del resto de los motores.

## Orden de prioridad recomendado (Alex, 2026-07-27)

1. **A5 — Case Strategy Engine** (en implementación activa — ver `docs/A5_CASE_STRATEGY_ENGINE_DESIGN.md`).
2. **Quality Assurance Engine** — garantizar consistencia y trazabilidad antes de presentar el expediente.
3. **Market Intelligence Engine** (evolución de A6) — reutilizable en múltiples criterios y tipos de caso.
4. **RFE Prediction Engine** — cuando ya exista un expediente completo y validado por QA.
5. **Learning Engine** — retroalimentación continua basada en resultados reales de USCIS a lo largo del tiempo.

Cada motor nuevo se apoya en el anterior y aumenta la capacidad de razonamiento de AUCIS sin duplicar responsabilidades entre capas.

## Nota de alcance — sesión 2026-07-27

Esta arquitectura completa se documenta de una sola vez por su valor estructural, pero el trabajo activo de implementación continúa siendo exclusivamente **A5** — el resto queda como visión ordenada, no como trabajo en curso. Evitar la tentación de empezar varios motores a la vez; cada uno tiene la complejidad aproximada de A1-A4 combinados.
