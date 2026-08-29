# Cierre: SPEC-169 — Onboarding + cobertura + notificaciones in-app

**Estado**: IMPLEMENTADO  
**Fecha de cierre**: 2026-08-13  
**Rama de trabajo**: `work/002-pi-062`  
**PR**: pendiente → `feature/001-scaffolding`

---

## Resumen

Se entregó la Fase G del módulo Colegio: onboarding "Activa tu protección" para el rector, anillos de cobertura de sujetos en el Inicio y centro de notificaciones in-app. Todo está acotado por `colegioId`; las notificaciones nunca incluyen texto de reporte ni datos del denunciante; las migraciones son aditivas y no tocan `Curso` ni `Estudiante.cursoId`.

---

## Cambios integrados

### Modelo de datos

- `prisma/schema.prisma`:
  - `OnboardingColegio`: fila única por colegio (`estado`, `pasoActual`, `completadoEn`).
  - `NotificacionInApp`: mensajes dirigidos al `SCHOOL_ADMIN` del colegio (`leidaEn`, `archivadaEn`).
  - `AccionAudit` añade `COLEGIO_ONBOARDING_OMITIDO`, `COLEGIO_ONBOARDING_REACTIVADO`, `COLEGIO_ONBOARDING_COMPLETADO`, `COLEGIO_NOTIFICACION_CREADA`, `COLEGIO_NOTIFICACION_LEIDA`, `COLEGIO_NOTIFICACION_ARCHIVADA`.
- `prisma/migrations/20260812230823_add_onboarding_notificaciones_fase_g/migration.sql`: migración aditiva con tablas, enums, relaciones, índices y backfill de `OnboardingColegio` para colegios existentes.

### Backend

- `src/lib/dal/repositories/onboarding-colegio.ts`: CRUD tenant-first, transiciones de estado y auditoría.
- `src/lib/dal/repositories/onboarding-requisitos.ts`: cálculo de pasos del onboarding a partir de datos reales del colegio.
- `src/lib/dal/repositories/cobertura.ts`: agregados eficientes de cobertura por estudiante, profesor y acudiente.
- `src/lib/dal/repositories/notificacion-in-app.ts`: listado paginado, marcar leída, marcar todas, archivar y conteo.
- `src/lib/colegio/onboarding.ts`: servicio de pasos calculados.
- `src/lib/colegio/cobertura.ts`: agregaciones de cobertura.
- `src/lib/colegio/notificaciones.ts`: disparadores de notificaciones in-app desde alertas y eventos de sistema.
- `src/app/api/admin/colegios/route.ts`: crea fila `OnboardingColegio` en estado `activo` al dar de alta un colegio.
- `src/lib/colegio/alertas.ts`: integra creación de notificación in-app al generar/actualizar alertas.
- `src/lib/permisos-catalogo.ts` y `prisma/seed-modulos-grants.ts`: módulos `colegios_onboarding`, `colegios_cobertura` y `colegios_notificaciones`.
- `src/lib/nav-items.ts` y `src/app/dashboard/colegio/layout.tsx`: puntos de entrada al onboarding, configuración y notificaciones.

### API

- `src/app/api/colegio/onboarding/route.ts` (GET / PATCH)
- `src/app/api/colegio/cobertura/route.ts` (GET)
- `src/app/api/colegio/notificaciones/route.ts` (GET)
- `src/app/api/colegio/notificaciones/resumen/route.ts` (GET)
- `src/app/api/colegio/notificaciones/marcar-leidas/route.ts` (PATCH)
- `src/app/api/colegio/notificaciones/[id]/route.ts` (PATCH leída / DELETE archivar)

### Frontend

- `src/app/dashboard/colegio/page.tsx`: añade `AnillosCobertura` al Inicio.
- `src/app/dashboard/colegio/onboarding/page.tsx`: página para reactivar el onboarding.
- `src/components/modules/colegio/OnboardingModal.tsx`: wizard con pasos calculados y CTAs.
- `src/components/modules/colegio/AnillosCobertura.tsx`: tres anillos con color según % y CTA.
- `src/components/modules/colegio/CentroNotificaciones.tsx`: campana, badge, dropdown y acciones.

### Tests

- `src/lib/dal/repositories/onboarding-colegio.test.ts`
- `src/lib/dal/repositories/cobertura.test.ts`
- `src/lib/dal/repositories/notificacion-in-app.test.ts`
- `src/app/api/colegio/onboarding/route.test.ts`
- `src/app/api/colegio/cobertura/route.test.ts`
- `src/app/api/colegio/notificaciones/route.test.ts`

### Arquitectura

- `docs/architecture/01-modelo-datos.md`, `02-roles-capacidades.md` y `03-pantallas.md` regenerados (`npm run arch:check` verde).

---

## Gate de calidad

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ (0 errores, 45 warnings preexistentes) |
| `npm run test` | ✅ 351 test files passed / 1 skipped; 2083 tests passed / 1 skipped |
| `npm run test:coverage` | ✅ All files: statements 49.88 %, branches 76.06 %, functions 83.99 %, lines 49.88 % (umbrales: 45 / 75 / 83 / 45) |
| `npm run tokens:check` | ✅ |
| `npm run arch:check` | ✅ |
| `npm run build` | ✅ |

---

## Notas

- No se tocó `src/lib/ai/**`.
- No se modificó `Curso` ni `Estudiante.cursoId`.
- Las migraciones son aditivas.
- El commit incluye el fix de aislamiento de BD en tests (`src/lib/test-setup.ts`, `src/lib/test-utils.ts`, `vitest.config.ts`) para estabilizar la suite bajo vitest 3.2.x: mutex en PostgreSQL (`TestMutex`) con columna `lockedAt`, liberación forzada de locks huérfanos, `cleanup()` de `@testing-library/react`, `TRUNCATE CASCADE` de reset, `hookTimeout: 60s`, `pool: forks` con `singleFork`.
