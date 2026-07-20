# Data Model: Claridad y estados

**Date**: 2026-07-20
**Feature**: specs/051-claridad-estados/spec.md

---

## Data Model Changes

**None.**

Este spec es puramente de interfaz de usuario y copy. No se crean, modifican ni eliminan entidades, tablas, índices ni relaciones.

---

## Rationale

- Los componentes de estado (`EmptyState`, `ErrorState`) son componentes de presentación y no requieren persistencia.
- Los cambios de microcopy son textos estáticos en componentes React y páginas.
- Las mejoras de jerarquía visual se aplican mediante clases de Tailwind CSS sin alterar estructura de datos.

---

## Impact on Existing Entities

| Entity | Impact | Notes |
|--------|--------|-------|
| All existing entities | None | No schema, migration, or seed changes |

---

## Validation

- No migrations required.
- No seed updates required.
- No contract/API changes required.

