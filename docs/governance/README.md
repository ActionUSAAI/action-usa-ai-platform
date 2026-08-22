# Sistema Documental de Gobernanza — AUCIS

Este directorio contiene el corpus normativo que gobierna la arquitectura de AUCIS.

Este README no es un documento normativo. No gobierna ningún comportamiento. Es un punto de entrada.

## Documento raíz

Toda autoridad de este corpus deriva de un único documento:

**[Architectural Constitution](level-0-constitution/architectural-constitution.md)**

Ningún documento en este repositorio tiene autoridad sobre la Constitution. Todos los demás derivan su jurisdicción de ella.

## Niveles presentes en este repositorio

- `level-0-constitution/` — cómo se gobierna este corpus documental.
- `level-1-charters/` — verdades fundamentales del dominio.
- `level-2-policies-procedures/` — reglas que gobiernan procesos.
- `level-4-contracts/` — interacción entre componentes ya identificados.

## Relación entre niveles

Un documento de nivel inferior nunca puede redefinir, reinterpretar, o contradecir uno de nivel superior. Ver Sección 4 de la Architectural Constitution para la Regla de Propagación completa.

## Estado de los documentos

Cada archivo declara su propio estado (`Proposal` o `Frozen`) en su encabezado. Solo los documentos `Frozen` gobiernan.
