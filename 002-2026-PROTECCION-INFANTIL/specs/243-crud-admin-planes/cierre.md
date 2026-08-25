# Cierre — Spec 243: CRUD admin de Planes + parámetros IVA/freemium

## Resumen

Se implementó el catálogo administrable de planes de suscripción y la configuración global de pagos (IVA, freemium y recompensas) desde la UI de admin. Se sembraron 8 planes base (4 PADRE + 4 COLEGIO) y 7 parámetros globales de forma idempotente, preservando ediciones manuales.

## User Stories implementadas

### US1 — Admin gestiona el catálogo de planes (P1)

- `prisma/schema.prisma`: `Plan` se extiende con `precioBaseCOP`, `esFreemium` y `usosMaximosPorCliente`; `AccionAudit` se extiende con `PLAN_CREATE`, `PLAN_UPDATE`, `PLAN_TOGGLE`.
- Migración aditiva `prisma/migrations/20260825004336_crud_admin_planes/migration.sql`.
- `src/lib/schemas/pagos.ts`: schemas Zod para query, creación, edición y parámetros.
- `src/lib/dal/repositories/pagos-repository.ts`: métodos `desactivarPlan`, `existeSuscripcionActivaPorPlan`, `obtenerPlanPorNombreYTipoTitular`.
- `src/app/api/admin/pagos/planes/route.ts`: `GET` paginado y `POST`.
- `src/app/api/admin/pagos/planes/[id]/route.ts`: `PATCH` y `DELETE` lógico (409 si hay suscripciones activas).
- `src/components/modules/PlanesAdminCRUD.tsx`: tabla + formulario crear/editar/desactivar.
- Tests: `src/app/api/admin/pagos/planes/route.test.ts`.

### US2 — Admin edita parámetros globales de pagos (P1)

- `src/lib/dal/services/pagos-parametros.service.ts`: batch transaccional de los 7 parámetros globales.
- `src/app/api/admin/pagos/parametros/route.ts`: `PATCH` con `AuditLog` (`PARAM_UPDATE`).
- `src/components/modules/ParametrosPagosForm.tsx`: formulario de configuración global.
- Tests: `src/app/api/admin/pagos/parametros/route.test.ts`.

### US3 — Seed inicial idempotente de 4 planes por rol (P1)

- `prisma/seed.ts`: `seedPlanesPagos` con 8 planes y `seedParametrosPagos` con 7 parámetros globales, ambos con `upsert({ create, update: {} })`.
- Año actual calculado con timezone `America/Bogota`.

## Validación

- `npx prisma generate`: OK
- `npx tsc --noEmit`: OK
- `npm run lint`: OK (0 errores del spec; warnings heredados ajenos)
- `npm run test:unit`: 1511 tests passed
- `npm run test:integration` (suite completa): timed out a los 600 s; no se observaron tests fallidos antes del corte
- Tests focalizados del área de pagos: 8 archivos, 54 tests passed
- `rm -rf .next && npm run build`: OK
- `npm run arch:check`: OK (VERDE tras regenerar `docs/architecture/01-modelo-datos.md` y `docs/architecture/02-roles-capacidades.md`)
- `./scripts/dev-restart.sh`: OK, healthcheck OK, un solo worker

## Commits

1. `958254be` — `feat(pagos): extender modelo Plan y agregar migración aditiva para admin de planes`
2. `f3f39a73` — `feat(pagos): sembrar planes y parámetros globales de pagos idempotentemente`
3. `75c03b2f` — `feat(pagos): schemas, repositorio y servicio para admin de planes y parámetros`
4. `f20c9f97` — `feat(pagos): API routes admin para planes y parámetros globales con tests de integración`
5. `0bced082` — `feat(pagos): UI de administración de planes con tabs`
6. `5e306e6c` — `docs(spec-243): documentación Spec-Kit y artefactos de arquitectura`

## Deuda técnica

- El campo legacy `precio` sigue siendo requerido a nivel de BD; las rutas lo envían como `0` mientras el modelo comercial opera en `precioBaseCOP`.
- El `PATCH` de plan no permite cambiar `tipoTitular`, `duracion` ni `anio`; para esos cambios se recomienda crear un nuevo plan y desactivar el anterior.
- La UI no implementa drag-and-drop de ordenamiento; el orden visual se controla por `duracion`.

## Próximos pasos

- Continuar con SPEC-211 (vistas cliente de suscripción) y SPEC-212 (panel admin de pagos) del Lote 2.
