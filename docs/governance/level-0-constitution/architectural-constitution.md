---
document: "Architectural Constitution"
level: 0
status: Frozen
governed_by: "none"
---

# Architectural Constitution v1

## 1. Propósito y Alcance

La Architectural Constitution existe para preservar la coherencia arquitectónica del sistema documental de AUCIS. No gobierna el dominio jurídico migratorio, no gobierna el conocimiento, no gobierna decisiones jurídicas — gobierna la jurisdicción, autoridad relativa, y reglas de evolución de las categorías documentales mediante las cuales AUCIS se diseña y se construye. Este documento constituye el techo del sistema documental: ningún otro documento tiene autoridad sobre él, y él no depende de ningún dominio, tecnología, o implementación específica para ser válido.

## 2. Jerarquía de Niveles

Todo documento arquitectónico de AUCIS ubica en exactamente uno de los siguientes niveles:

- **Level 0 — Constitution.** Gobierna la jurisdicción, autoridad, y evolución del propio sistema documental.
- **Level 1 — Charters.** Verdades fundamentales del dominio. No dependen de implementación, de un dominio de negocio específico, ni de tecnología.
- **Level 2 — Policies & Procedures.** Gobiernan procesos. No mencionan componentes ni tecnología por nombre.
- **Level 3 — Architectures.** Diseño conceptual de cómo se organizan responsabilidades en componentes, sin descender a implementación.
- **Level 4 — Contracts.** Definen la interacción entre componentes ya identificados por una Architecture.
- **Level 5 — Protocols.** Metodología de trabajo — cómo se investiga, audita, o valida.
- **Level 6 — Implementation.** Tecnología concreta.

Ningún documento puede pertenecer simultáneamente a más de un nivel. Ningún nivel puede contener el tipo de conocimiento reservado a otro.

## 3. Estado de Autoridad Documental

Todo documento sujeto a esta Constitution posee, en cada momento, uno de dos estados: **Proposal** o **Frozen**. Un documento en Proposal puede discutirse y refinarse, pero no gobierna nada — no puede redefinir otros documentos ni autorizar implementación real. Un documento autoriza — cruza a Frozen — cuando ha sido sometido al proceso de validación definido por la organización, y dicho proceso concluye que puede ejercer autoridad. Frozen no significa inmutable, ni terminado, ni perfecto: significa que el documento ha cruzado el umbral desde el cual puede empezar a gobernar. El Estado de Autoridad es independiente del contenido y de la evolución del documento — un documento puede evolucionar conservando su Estado de Autoridad activo.

## 4. Regla de Propagación de Autoridad

Entre documentos de niveles distintos, el de nivel superior prevalece siempre. Ningún documento de un nivel inferior puede redefinir, reinterpretar, o contradecir un documento de un nivel superior. Si nueva evidencia parece exigir un cambio, ese cambio debe evolucionar primero en el documento del nivel superior correspondiente, y solo después propagarse hacia los niveles inferiores. La evidencia producida en un nivel inferior puede motivar la evolución de un nivel superior, pero nunca ejecutarla automáticamente — la evolución siempre requiere un acto deliberado en el nivel superior mismo.

## 5. Resolución entre Documentos del Mismo Nivel

Dos documentos del mismo nivel pueden coexistir válidamente siempre que sus jurisdicciones no se solapen. Si dos documentos del mismo nivel reclaman jurisdicción superpuesta, ninguno de los dos podrá adquirir Estado de Autoridad Frozen mientras la superposición permanezca sin resolver. El mecanismo mediante el cual se resuelve dicha superposición no es materia de esta Constitution.

## 6. Extensión del Sistema

Un nivel o categoría documental no contemplada en esta Constitution puede incorporarse al sistema únicamente cuando demuestre poseer jurisdicción propia, no cubierta por ninguno de los niveles ya existentes, y haya sido validada mediante el proceso correspondiente. La incorporación de un nivel nuevo no modifica la autoridad de los niveles ya existentes, y debe ubicarse dentro de la Jerarquía siguiendo los principios de esta Constitution.
