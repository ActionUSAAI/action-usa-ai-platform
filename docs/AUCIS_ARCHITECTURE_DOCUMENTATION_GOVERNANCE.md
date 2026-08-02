# AUCIS — Architecture Documentation Governance

**Estado:** Vigente. Aprobado 2026-08-02.

Este documento define cómo se administra y evoluciona la documentación arquitectónica de AUCIS — no qué decisiones se tomaron (eso vive en `AUCIS_ARCHITECTURE_DECISIONS.md`), sino las reglas de proceso que gobiernan cuándo y cómo esa documentación cambia.

## Alcance

Esta política aplica a toda la documentación arquitectónica mantenida dentro del repositorio oficial de AUCIS, incluyendo Architecture Principles, Architecture Decisions (ADRs), Contract Specifications, Architecture Documents, Governance Documents y Roadmaps.

---

## Principio Rector

La documentación arquitectónica de AUCIS evoluciona únicamente cuando existe una necesidad verificable del dominio o de la implementación. La documentación nunca se sincroniza preventivamente ni se modifica por razones estéticas o de consistencia aparente. Cada cambio debe corresponder a una decisión arquitectónica, una evidencia observada o una implementación real.

## Jerarquía documental

Cuando dos documentos parezcan entrar en conflicto, prevalece el de mayor nivel dentro de la siguiente jerarquía:

1. Architecture Principles
2. Architecture Decisions (ADR)
3. Contract Specifications
4. Architecture Documents
5. Governance Documents
6. Roadmaps

Un documento de nivel inferior puede ampliar o especializar un documento de nivel superior, pero nunca contradecirlo. Si aparece una contradicción aparente, debe resolverse modificando el documento correspondiente de mayor autoridad mediante el proceso de gobernanza definido por esta política.

## Ciclo de vida de un contrato

`Draft → Review → Approved → Frozen → Deprecated → Superseded` — ya establecido en `AUCIS_CONTRACT_CATALOG.md`. Este documento formaliza las reglas de transición:

- **Frozen → Superseded** ocurre cuando nace una versión nueva del mismo contrato (v1 → v2). El documento anterior nunca se borra ni se edita — permanece como referencia histórica, con su `Contract Status` actualizado a `Superseded`.
- **Frozen → Deprecated** ocurre cuando un contrato deja de tener implementación vigente, sin que exista todavía un reemplazo directo.

## Cuándo crear una nueva versión de un contrato (v1 → v2)

Una nueva versión de un contrato solo se crea cuando existe una necesidad verificable del dominio o de la implementación. Esto ocurre, entre otros casos, cuando:

1. **Existe evidencia real de que el contrato actual no representa correctamente el dominio** — un bug en producción, un dato inconsistente, una violación observada de un principio ya congelado.
2. **Contract First Development está activo** — se está a punto de implementar o modificar en código un componente cuyo contrato necesita cambiar para reflejar esa implementación.

Un ADR transversal que identifique un patrón aplicable a varios contratos **no dispara automáticamente** una nueva versión de todos ellos. Cada contrato evoluciona bajo demanda, no por sincronización preventiva.

## Aplicación diferida de un ADR transversal

Cuando un ADR transversal aplica conceptualmente a un contrato que no se actualiza de inmediato, ese contrato recibe una nota breve en su sección de Referencias señalando el ADR aplicable y que la actualización queda diferida hasta que exista necesidad real — nunca una alteración de sus campos o invariantes ya congelados. Esta nota es una adición pura y no constituye un breaking change bajo la Compatibility Policy del contrato.

## Qué significa cada estado de `Contract Status`

- **Draft:** en discusión, no consumible por ningún componente.
- **Review:** en validación, próximo a congelarse.
- **Approved:** aprobado conceptualmente, pendiente de redacción final.
- **Frozen:** congelado y vigente — la versión activa que todo consumidor debe respetar.
- **Deprecated:** ya no representa la implementación real, sin reemplazo directo todavía.
- **Superseded:** reemplazado por una versión más nueva del mismo contrato — conservado como referencia histórica, nunca borrado.

## Compatibilidad hacia atrás

Heredada de la Compatibility Policy ya definida en cada contrato individual: cambios aditivos (campo opcional nuevo) no requieren nueva versión; cambios que eliminan o alteran la semántica de un campo existente sí la requieren.

## Relación con ADRs

Este documento presupone la existencia de los ADRs. Los ADRs explican por qué se tomó una decisión arquitectónica; este documento únicamente define cómo esa decisión se refleja y evoluciona dentro de la documentación del proyecto.

## No objetivos

Este documento no:

- reemplaza un ADR;
- modifica la arquitectura;
- introduce nuevas entidades del dominio;
- autoriza breaking changes;
- sustituye la Compatibility Policy de los contratos.

## Ownership

La responsabilidad de mantener esta política corresponde al Architecture Owner de AUCIS.

Toda modificación a este documento debe preservar la estabilidad del proceso de gobernanza y nunca utilizarse para eludir las reglas establecidas en los Architecture Principles, Architecture Decisions (ADRs) o Contract Specifications.

## Aplicación

Los contratos individuales aplican esta política cuando evolucionan entre versiones.

## References

- `AUCIS_ARCHITECTURE_DECISIONS.md`
- `AUCIS_ARCHITECTURE_PRINCIPLES.md`
- `AUCIS_CONTRACT_CATALOG.md`
