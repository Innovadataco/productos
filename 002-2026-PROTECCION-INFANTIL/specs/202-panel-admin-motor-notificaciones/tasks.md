> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Tareas: SPEC-202 — Panel Admin del Motor de Notificaciones (002-PI-099)

## Fase 1: Preparación

- [x] T001 [P1] Actualizar `specs/README.md` con fila de SPEC-202.

## Fase 2: Repositorios

- [x] T002 [P1] `src/lib/dal/repositories/notificacion.ts`: queries paginadas, filtros, métricas de salud e idempotencia de timestamps.
- [x] T003 [P1] `src/lib/dal/repositories/notificacion-plantilla.ts`: listado y CRUD.
- [x] T004 [P1] `src/lib/dal/repositories/notificacion-regla.ts`: listado y CRUD.
- [x] T005 [P1] Métricas de salud integradas en `src/lib/notificaciones/admin-service.ts` y `src/lib/dal/services/notificacion-admin.ts`.

## Fase 3: API Routes

- [x] T006 [P1] `src/app/api/admin/notificaciones/bandeja/route.ts` y `[id]/reenviar/route.ts`.
- [x] T007 [P1] `src/app/api/admin/notificaciones/plantillas/route.ts` y `[clave]/route.ts`.
- [x] T008 [P1] `src/app/api/admin/notificaciones/plantillas/[clave]/preview/route.ts`.
- [x] T009 [P1] `src/app/api/admin/notificaciones/reglas/route.ts` y `[id]/route.ts`.
- [x] T010 [P1] `src/app/api/admin/notificaciones/reglas/[id]/recalcular/route.ts` y `[id]/recalcular-preview/route.ts`.
- [x] T011 [P1] `src/app/api/admin/notificaciones/parametros/route.ts` y `[clave]/route.ts`.
- [x] T012 [P1] `src/app/api/admin/notificaciones/salud/route.ts`.
- [x] T013 [P1] `src/app/api/webhooks/resend/route.ts` (HMAC Svix + idempotencia).

## Fase 4: Componentes UI

- [x] T014 [P1] Tabs de notificaciones dentro de `/dashboard/admin/configuracion` (`BandejaTab`, `PlantillasTab`, `ReglasTab`, `ParametrosNotificacionesTab`).
- [x] T015 [P1] `BandejaTab.tsx`.
- [x] T016 [P1] `PlantillasTab.tsx` con preview por email.
- [x] T017 [P1] `ReglasTab.tsx` con confirmación de recálculo.
- [x] T018 [P1] `ParametrosNotificacionesTab.tsx`.
- [x] T019 [P1] `SaludMotorBloque.tsx` y página `/dashboard/admin/estadisticas/salud-motor`.

## Fase 5: Navegación

- [x] T020 [P1] Actualizar `ConfiguracionTabs.tsx` y `EstadisticasSubNav.tsx`.
- [x] T021 [P1] Verificar `proxy()` y permisos (`permisos-catalogo.ts`).

## Fase 6: Tests

- [x] T022 [P1] Tests de API routes (`bandeja`, `salud`, `plantillas`, `reglas`, `parámetros`).
- [x] T023 [P1] Tests de webhook Resend.
- [x] T026 [P1] Aplicar migración pendiente `20260822030000_spec_202_notificaciones_admin_audit` a BD de test y regenerar Prisma Client.

## Fase 7: Gate y cierre

- [x] T024 [P1] Gate local: `tsc --noEmit`, `lint`, `build`.
- [x] T025 [P1] Completar sección Implementación en `spec.md` y crear/actualizar `cierre.md`.
- [x] T027 [P1] Gate `npm run test` completo y `./scripts/dev-restart.sh`.
