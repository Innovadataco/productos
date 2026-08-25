# Tareas SPECKIT — SPEC-243 (002-PI-146)

**Feature**: CRUD admin de Planes + parámetros IVA/freemium desde UI + seed  
**Branch**: `work/002-PI-146`  
**Estado**: IMPLEMENTADO

---

## Fase 1 — Modelo de datos aditivo

- [x] T001 Extender `prisma/schema.prisma`:
  - Agregar a `Plan` los campos `precioBaseCOP Float?`, `esFreemium Boolean @default(false)` y `usosMaximosPorCliente Int?`.
  - Agregar a `AccionAudit` los valores `PLAN_CREATE`, `PLAN_UPDATE`, `PLAN_TOGGLE`.
- [x] T002 Crear migración SQL aditiva manual `prisma/migrations/20260825004336_crud_admin_planes/migration.sql` (solo `ADD COLUMN IF NOT EXISTS` y `ALTER TYPE ... ADD VALUE IF NOT EXISTS`).
- [x] T003 Actualizar `prisma/seed.ts`:
  - `seedPlanesPagos` con 8 planes (4 PADRE + 4 COLEGIO), `upsert({ create, update: {} })` y año actual en Bogotá.
  - Parámetros globales de §6.3 con `upsert(update: {})` para no pisar ediciones manuales.

## Fase 2 — DAL y validación

- [x] T004 Extender `src/lib/schemas/pagos.ts` con `pagosPlanesQuerySchema`, `pagosPlanCreateSchema`, `pagosPlanUpdateSchema` y `pagosParametrosUpdateSchema`.
- [x] T005 Extender `src/lib/dal/repositories/pagos-repository.ts`:
  - `desactivarPlan`, `existeSuscripcionActivaPorPlan`, `obtenerPlanPorNombreYTipoTitular`.
  - Ampliar `PlanResumen` con los nuevos campos.
- [x] T006 Crear `src/lib/dal/services/pagos-parametros.service.ts` para actualizar en batch los 7 parámetros globales dentro de una transacción.

## Fase 3 — API routes

- [x] T007 Modificar `src/app/api/admin/pagos/planes/route.ts`: GET paginado con filtros + POST crear plan + `AuditLog` (`PLAN_CREATE`).
- [x] T008 Crear `src/app/api/admin/pagos/planes/[id]/route.ts`: PATCH editar plan con `AuditLog` (`PLAN_UPDATE`) + DELETE lógico con `AuditLog` (`PLAN_TOGGLE`) y validación de suscripciones activas (`409`).
- [x] T009 Crear `src/app/api/admin/pagos/parametros/route.ts`: PATCH batch de parámetros globales + `AuditLog` (`PARAM_UPDATE`).

## Fase 4 — Tests de integración

- [x] T010 Crear `src/app/api/admin/pagos/planes/route.test.ts`:
  - Autenticación y guard ADMIN.
  - POST crea plan y audit.
  - POST rechaza freemium inválido y nombre duplicado.
  - PATCH edita y guarda antes/después.
  - DELETE desactiva o retorna `409` con suscripción activa.
  - GET paginado con filtros.
- [x] T011 Crear `src/app/api/admin/pagos/parametros/route.test.ts`:
  - Guard ADMIN.
  - Batch actualiza valores y audit.
  - Rechaza IVA > 100 y días freemium < 1.

## Fase 5 — UI

- [x] T012 Crear `src/components/modules/PlanesAdminCRUD.tsx` (tabla + form crear/editar, reutiliza `Input`, `Select`, `Textarea`, `GlassCard`, `Button`, `Alerta`).
- [x] T013 Crear `src/components/modules/ParametrosPagosForm.tsx` (form batch de parámetros globales).
- [x] T014 Crear `src/components/modules/PlanesPagosTabs.tsx` y modificar `src/app/dashboard/admin/pagos/planes/page.tsx` para montar tabs (catálogo / configuración global).

## Fase 6 — Documentación

- [x] T015 Crear `specs/243-crud-admin-planes/data-model.md`.
- [x] T016 Crear `specs/243-crud-admin-planes/quickstart.md`.
- [x] T017 Crear `specs/243-crud-admin-planes/contracts/planes.md`.
- [x] T018 Crear `specs/243-crud-admin-planes/contracts/parametros.md`.
- [x] T019 Crear `specs/243-crud-admin-planes/checklists/requirements.md`.
- [x] T020 Actualizar `specs/243-crud-admin-planes/spec.md` con sección de implementación y estado `IMPLEMENTADO`.
- [x] T021 Crear `specs/243-crud-admin-planes/cierre.md`.

## Fase 7 — Gates

- [x] T022 `npx prisma generate`.
- [x] T023 `npx tsc --noEmit`.
- [x] T024 `npm run lint` (0 errores).
- [x] T025 `npm run test:unit`.
- [x] T026 `npm run test:integration` para tests nuevos.
- [x] T027 `npm run build`.
- [x] T028 `npm run arch:check`.
