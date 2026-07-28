# Tasks — SPEC-109: Eliminar el módulo de apelación actual (D-34)

**Input**: plan.md (con inventario de huérfanos), spec.md, research.md (PASO 0 verificado),
data-model.md, quickstart.md de `/specs/109-eliminar-modulo-apelacion/` |
**Branch**: `feature/001-scaffolding`

> Nota de flujo: `tasks.md` se genera en compuerta para cumplir el gate de la SPEC-107.
> `speckit-implement` NO se corre hasta la aprobación de ZEUS (compuerta §4).

## Fase 1: US1 — superficie pública y admin

- [x] T001 [US1] Eliminar `src/app/apelar/`, `src/app/api/apelaciones/`, `src/app/api/admin/apelaciones/`, `src/app/dashboard/admin/apelaciones/` y `src/components/modules/AdminApelaciones.tsx` (con sus tests propios).
- [x] T002 [US1] `src/lib/nav-items.ts` y `src/components/modules/AdminNav.tsx`: retirar la entrada "Apelaciones" (y ScaleIcon si queda sin uso).

## Fase 2: US2 — dominio, datos y permisos

- [x] T003 [US2] Eliminar `src/lib/apelaciones.ts`, `scripts/job-apelaciones-vencimiento.ts`, `scripts/smoke-apelaciones.ts` y `src/lib/sms.ts` (verificado: solo lo usa el test de apelaciones).
- [x] T004 [US2] Migración: `DROP TABLE "ApelacionIdentificador"` + `DROP TYPE "EstadoApelacion"`; schema sin el modelo, el enum y las relaciones (`Usuario.apelaciones`, `Usuario.apelacionesAsignadas`, `IdentificadorReportado.apelaciones`, campos SMS).
- [x] T005 [US2] `prisma/seed.ts`: retirar `anti_abuso.apelacion_pausa_dias` y `ratelimit.apelacion.*`.
- [x] T006 [US2] `src/lib/proxy.ts` (sin `/api/apelaciones` en PUBLIC_ROUTES) y `src/lib/rate-limit.ts` (sin scopes `apelacion`, `apelacion_sms`).
- [x] T007 [US2] `src/lib/permisos-catalogo.ts` (sin módulo `apelaciones`; el backfill del seed lo deja de crear) y nota para limpieza del registro en prod.
- [x] T008 [US2] `src/lib/operadores/asignador.ts` (sin rama apelación) y `src/lib/operadores/permisos.ts` (sin `puedeGestionarApelacion`); ajustar `src/lib/operadores/integracion.test.ts`.
- [x] T009 [US2] `src/lib/test-utils.ts` y `src/lib/reporte-test-utils.ts`: retirar líneas del módulo.

## Fase 3: US3 + cierre

- [x] T010 [US3] Verificación `git grep apelac` en `src/` y `scripts/` sin referencias operativas; `actualizarVisibilidadPublica` con diff cero.
- [x] T011 Gate: `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build` + CI GitHub success.
- [x] T012 `cierre.md` (con inventario de huérfanos y su destino) + `specs/README.md` + commits + push. **NO desplegar** (lote del CEO; re-verificar COUNT(*)=0 antes de migrar en prod).

## Dependencias

- T001–T003 primero (borrados); T004–T009 después (referencias); T010–T012 al final.
