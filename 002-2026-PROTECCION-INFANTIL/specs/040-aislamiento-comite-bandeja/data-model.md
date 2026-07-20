# Data Model — Spec 040: Aislamiento del comité a su Bandeja

**Date**: 2026-07-19
**Feature**: specs/040-aislamiento-comite-bandeja/spec.md

---

## Active Entities

No hay cambios en el modelo de datos de Prisma para este spec. Los cambios son exclusivamente de UI (componente `ComiteSubNav`) y de protección perimetral (proxy `src/lib/proxy.ts`).

### Entidades existentes que se utilizan

- **Usuario**: atributo `rol` (`ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`, `PARENT`). El filtro de `ComiteSubNav` y la protección perimetral se basan en este campo.
- **CasoEval**: representa los casos escalados al comité. Se usa en el flujo de negocio de US2 (escalar → tomar → finalizar).
- **AuditLog**: registros de auditoría sobre acciones del comité. Se consume en la pestaña Auditoría, que es admin-only.
- **IntegranteComite**: integrantes de la cuenta del comité. Se gestiona en la pestaña Gestión, que es admin-only.

---

## Entity Relationships

```
Usuario ||--o{ CasoEval : "revisa y finaliza (rol COMITE_VALIDACION)"
Usuario ||--o{ AuditLog : "genera acciones auditadas"
Usuario ||--o{ IntegranteComite : "cuenta del comité gestionada por ADMIN/SCHOOL_ADMIN"
```

---

## Seed Data

No se requieren datos de seed nuevos.

---

## Indexes

No se requieren índices nuevos.
