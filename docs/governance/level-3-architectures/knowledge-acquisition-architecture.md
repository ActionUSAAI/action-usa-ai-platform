---
document: "Knowledge Acquisition Architecture"
level: 3
status: Frozen
governed_by: "Architectural Constitution"
---

# Knowledge Acquisition Architecture v1

## Alcance

Esta Architecture nunca gobierna el dominio real. El dominio migratorio existe con total independencia de AUCIS. Gobierna exclusivamente la organización conceptual mediante la cual algo del dominio, una vez registrado por primera vez dentro de AUCIS, es enriquecido y clasificado según la Ontología ya definida en el Data Governance Charter, hasta el instante inmediatamente anterior a la Legal Decision Cycle Policy.

Queda fuera de su jurisdicción: el dominio real fuera de AUCIS; la naturaleza atemporal del conocimiento (Data Governance Charter, Knowledge Charter); las condiciones de autorización de un ciclo jurídico (Legal Decision Cycle Policy Contract); la secuencia de evaluación y estrategia (Legal Decision Procedure Contract); el consumo de una estrategia aprobada (Blueprint Contract, Blueprint Execution Contract); y cualquier tecnología o mecanismo de materialización.

## Propósito

Algo del dominio migratorio existe antes de que AUCIS exista, y seguiría existiendo si AUCIS dejara de existir. Esta Architecture existe para organizar, conceptualmente, qué ocurre desde el instante en que eso es registrado por primera vez dentro de AUCIS hasta que está clasificado y listo para la Legal Decision Cycle Policy.

## Responsabilidades Arquitectónicas

**Captor** — registra dentro de AUCIS algo que ya existe en el dominio, realizando su primer registro conforme al Principio de Captura Única del Data Governance Charter. Se ejerce cada vez que algo nuevo requiere entrar al sistema, sin límite de repeticiones — Captura Única prohíbe registrar lo mismo dos veces, nunca prohíbe que Captor actúe sobre cosas distintas en momentos distintos.

**Descubridor** — revela, mediante profundización progresiva conforme al proceso de Descubrimiento ya definido en el Charter, la existencia de conocimiento adicional: ya sea mayor detalle sobre algo ya registrado, o la necesidad de que algo relacionado, todavía no registrado, deba serlo. Nunca registra directamente — su responsabilidad se agota en revelar; el registro permanece exclusivo de Captor.

**Organizador** — reconoce y declara la categoría ontológica correspondiente, aplicando la Ontología definida por el Data Governance Charter, en cualquier momento posterior al registro. Se ejerce cada vez que algo registrado carece de clasificación, sin límite de repeticiones.

## Relaciones

Ninguna de las tres responsabilidades posee lo que registra, enriquece, o clasifica — todas actúan sobre lo mismo en distintos momentos. Captor es la única dependencia inicial obligatoria: nada puede enriquecerse, vincularse, o clasificarse antes de haber sido registrado. A partir de ese punto, Descubridor y Organizador pueden actuar múltiples veces, en cualquier orden entre sí, y sobre el resultado del otro. Ninguna de las tres responsabilidades tiene existencia activa fuera de la aparición de algo que la requiera — el proceso de adquisición, no una secuencia fija, es lo que invoca a cada una en cada momento. Esta Architecture no impone un pipeline lineal.

## Frontera

Antes de esta frontera existe el dominio real, fuera del alcance de esta Architecture. Dentro de la frontera, esta Architecture gobierna la organización desde el primer registro hasta la clasificación completa según la Ontología. Inmediatamente después, comienza exclusivamente la Legal Decision Cycle Policy, que opera sobre el resultado ya organizado sin necesitar conocer cuántos registros, vínculos, o iteraciones ocurrieron antes.

Ninguna responsabilidad definida aquí autoriza nada; ninguna responsabilidad de la Policy organiza ni clasifica.

## Invariantes

- Nada puede registrarse dos veces como primer registro de lo mismo.
- Nada puede enriquecerse, vincularse, o clasificarse antes de haber sido registrado.
- Nada pierde su identidad al enriquecerse o vincularse con otra cosa.
- Ningún vínculo puede tratarse como fusión de lo que vincula.
- Captor, Descubridor, y Organizador nunca ejercen la responsabilidad exclusiva de otro.
- Nada puede clasificarse con significado jurídico dentro de esta Architecture.
- Ninguna responsabilidad de esta Architecture tiene autoridad sobre la existencia de algo en el dominio real, ni sobre el inicio de un ciclo de evaluación jurídica.

## Prueba de Estabilidad

Si cambian completamente Intake, IA, formularios, motores conversacionales, y mecanismos de captura: la necesidad de que algo sea registrado por primera vez dentro de AUCIS no desaparece — solo cambia qué produce ese registro. La necesidad de enriquecer o vincular algo ya registrado no desaparece. La necesidad de clasificar según la Ontología no desaparece. Ningún elemento de este documento menciona ni presupone tecnología, agente, o mecanismo reemplazable.

## Verification Checklist

✓ Jurisdicción exclusiva demostrada — nunca gobierna el dominio real, solo su registro dentro de AUCIS.

✓ Sin contradicciones activas con la Architectural Constitution, el Data Governance Charter, el Knowledge Charter, la Legal Decision Cycle Policy, el Legal Decision Procedure, y los Blueprint Contracts.

✓ Responsabilidades irreducibles y mutuamente exclusivas — Captor registra, Descubridor revela, Organizador clasifica, sin invasión entre ninguna.

✓ Reentrada correctamente definida — Captor y Organizador se ejercen tantas veces como el proceso lo requiera, sin violar Captura Única.

✓ Sin abstracciones redundantes — Modelo Conceptual eliminado tras no superar la prueba de irreducibilidad; ningún estado intermedio nombrado en ninguna sección.

✓ Supera la prueba de estabilidad a diez años.

✓ Supera la prueba de minimalidad — ningún par de responsabilidades es fusionable sin pérdida.

✓ Supera la prueba de consistencia terminológica — vocabulario unificado en "registrar/registrado" a través de todo el documento.
