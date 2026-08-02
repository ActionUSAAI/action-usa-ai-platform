# AUCIS — Architecture Principles

**Estado:** Vigente. Aprobado 2026-07-28.

Este documento no describe entidades ni componentes. Describe las reglas que gobiernan cualquier decisión de diseño futura en AUCIS. Cuando una decisión nueva entre en conflicto con uno de estos principios, el principio prevalece — o la excepción se documenta explícitamente como ADR con su justificación, en `AUCIS_ARCHITECTURE_DECISIONS.md`.

---

### 1. Single Responsibility
Cada entidad del dominio tiene un único propósito, un único owner, y una única razón para cambiar. Ninguna entidad debe absorber una responsabilidad que ya pertenece a otra, incluso si parece conveniente agruparlas.

### 2. Single Source of Truth
Para cada tipo de información existe exactamente un lugar oficial donde vive. Ningún dato se duplica entre entidades. Los consumidores leen; solo el owner modifica.

### 3. Human-in-the-Loop
Las decisiones jurídicas críticas nunca se modifican automáticamente. El sistema puede sugerir, priorizar, analizar, y aprender — pero la aprobación final y cualquier regeneración importante permanecen bajo control humano explícito.

### 4. Explainable AI
Toda decisión relevante del sistema debe poder explicar qué información utilizó, qué la influenció, qué razonamiento siguió, y qué componentes participaron. La explicabilidad no es una función añadida — es un requisito de diseño desde el origen de cada componente.

### 5. Version Everything (que importe)
Toda entidad estratégica del dominio (Beneficiary, Petitioner, Criterion Assessment, Case Blueprint, Generated Document) es versionable. En cualquier momento debe ser posible reconstruir exactamente qué información existía, qué versión se usó, y qué gobernó cada resultado.

### 6. Evolution Without Refactoring
La arquitectura debe permitir incorporar componentes futuros (Knowledge Layer, QA Engine, RFE Prediction Engine, Learning Engine, nuevos motores especializados) sin necesidad de rediseñar las entidades principales del dominio ya aprobadas.

### 7. Canonical Catalogs
Los tipos, categorías, y clasificaciones del dominio (criterios, tipos de evento, y análogos futuros) pertenecen a catálogos canónicos con identificadores estables y semántica consistente — nunca texto libre inventado sobre la marcha. Esto previene ambigüedad y deriva del modelo con el tiempo.

### 8. Auditability by Design
Todo cambio relevante queda registrado: quién lo hizo, cuándo, y por qué. La auditoría no se agrega después — es una propiedad de cómo se diseña cada entidad desde el principio.

### 9. Acciones vs. Hechos Externos
El sistema distingue explícitamente entre acciones que la organización ejecuta (bajo su control, modeladas como lifecycle de una entidad) y hechos que ocurren fuera de su control (observados y registrados, nunca como transición de estado de una entidad cuyo owner es la organización).

### 10. Multi-Tenant desde el Origen
Ninguna decisión de diseño asume un único usuario final. Toda entidad de datos de caso queda, directa o indirectamente, aislada por Organization.

### 11. Independencia de las Dimensiones de Estado
En entidades de tipo artefacto discreto versionado, la madurez intrínseca y la vigencia representan dimensiones independientes del estado. La madurez describe transiciones causadas por acciones directas sobre la propia entidad; la vigencia describe transiciones causadas por la aparición de una versión posterior de la misma identidad. Un estado candidato que represente realmente un hecho perteneciente a otra entidad debe modelarse como una relación hacia esa entidad, nunca como un estado propio. Este principio aplica exclusivamente a artefactos discretos versionados; las entidades de conocimiento acumulativo requieren su propio modelo de evolución.

---

Estos once principios son la referencia final para evaluar cualquier cambio arquitectónico futuro en AUCIS.
