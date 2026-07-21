# Cierre: Colegios · Fase 2 — Cursos, Alumnos e Identificadores

**Spec**: `075-colegios-cursos-alumnos`  
**Rama**: `feature/001-scaffolding`  
**Fecha de cierre**: 2026-07-21

## Resumen

Se implementó la Fase 2 del módulo Colegios: gestión de cursos, alumnos e identificadores de alumnos/allegados por parte de un `SCHOOL_ADMIN`, con aislamiento estricto por colegio, auditoría, normalización de identificadores y tema visual verde.

## Archivos principales

- `prisma/schema.prisma`
- `prisma/migrations/20260721060000_add_colegio_cursos_alumnos/migration.sql`
- `src/lib/schemas/index.ts`
- `src/lib/colegio/permisos.ts`
- `src/lib/colegio/normalizacion.ts`
- `src/lib/proxy.ts`
- `src/lib/test-utils.ts`
- `src/lib/reporte-test-utils.ts`
- `src/app/api/colegio/cursos/route.ts`
- `src/app/api/colegio/cursos/[id]/route.ts`
- `src/app/api/colegio/cursos/[id]/estado/route.ts`
- `src/app/api/colegio/cursos/[id]/alumnos/route.ts`
- `src/app/api/colegio/alumnos/[id]/route.ts`
- `src/app/api/colegio/alumnos/[id]/estado/route.ts`
- `src/app/api/colegio/alumnos/[id]/identificadores/route.ts`
- `src/app/api/colegio/identificadores/[id]/route.ts`
- `src/app/api/colegio/identificadores/[id]/estado/route.ts`
- `src/app/dashboard/colegio/page.tsx`
- `src/app/dashboard/colegio/cursos/page.tsx`
- `src/app/dashboard/colegio/cursos/nuevo/page.tsx`
- `src/app/dashboard/colegio/cursos/[id]/page.tsx`
- `src/app/dashboard/colegio/alumnos/[id]/page.tsx`
- `src/app/dashboard/colegio/alertas/page.tsx`
- `src/app/dashboard/colegio/estadisticas/page.tsx`
- `src/components/modules/colegio/ColegioNav.tsx`
- `src/app/api/colegio/cursos/route.test.ts`
- `src/app/api/colegio/cursos/[id]/alumnos/route.test.ts`
- `src/app/api/colegio/alumnos/[id]/identificadores/route.test.ts`
- `src/lib/colegio/permisos.test.ts`
- `specs/075-colegios-cursos-alumnos/spec.md`

## Backup de base de datos

- `/tmp/backup-pre-075.dump` (proteccion_infantil)
- `/tmp/backup-pre-075-test.dump` (proteccion_infantil_test)

## Resultados de validación

| Comando / Prueba | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ sin errores |
| `npm run lint` | ✅ sin errores |
| `npm run test` | ✅ 643 tests verdes |
| `npm run build` | ✅ exitoso |
| `./scripts/dev-restart.sh` | ✅ healthcheck ok, un worker |
| Smoke test quickstart (curso → alumno → identificador + duplicado + aislamiento) | ✅ ok |

## Commits

- US1: Cursos, modelos y UI base.
- US2: Alumnos y detalle de curso.
- US3: Identificadores y tests de permisos.
- Docs: `spec.md` y `cierre.md`.

## Notas

- No se conectaron identificadores con matching ni alertas (reservado para Fase 4).
- No se modificó el modelo `Reporte` ni el modelo de IA.
- Todos los endpoints nuevos filtran por `colegioId` del `SCHOOL_ADMIN` autenticado y devuelven 404/403 según corresponda.
