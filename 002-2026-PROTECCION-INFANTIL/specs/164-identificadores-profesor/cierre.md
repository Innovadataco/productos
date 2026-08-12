# Cierre: SPEC-164 — Identificadores de profesor + estadísticas

**Fecha**: 2026-08-12 · **Radicado**: 002-PI-062 · **Spec**: [spec.md](./spec.md)

## Evidencia

- **Rama de trabajo**: `work/002-pi-062`.
- **Commits en `work/002-pi-062`**: `ff0f4a0a` implementación de Fase B · `ead8f8f9` cierre.
- **PR #47 a `feature/001-scaffolding`**: mergeado en `872e36d0`.
- **CI PR #47 / gate**: run `31597622205` — success.
- **CI PUSH `feature/001-scaffolding`**: run `31599374167` — success.
- **Gate local** (verificado previo al push):
  - `npx tsc --noEmit` ✅
  - `npm run lint` ✅ (0 errores, warnings preexistentes)
  - `npm run tokens:check` ✅
  - `npm run arch:check` ✅
  - `npm run test` ✅ (2018 passed, 1 skipped)
  - `npm run build` ✅

## Qué se entregó (FR → evidencia)

- **FR-001/FR-002**: `IdentificadorProfesorRepository` en `src/lib/dal/repositories/identificador-profesor.ts` con CRUD, normalización/inferencia de tipo, detección de duplicados, validación de profesor activo y búsqueda cross-tenant para alertas futuras; tests en `identificador-profesor.test.ts`.
- **FR-003**: endpoints en `src/app/api/colegio/profesores/[id]/identificadores/route.ts` (GET/POST) y `src/app/api/colegio/identificadores-profesor/[id]/route.ts` / `[id]/estado/route.ts` (PATCH) con tests en `src/app/api/colegio/profesores/[id]/identificadores/route.test.ts`.
- **FR-004**: helpers `verificarPropiedadProfesor` e `verificarPropiedadIdentificadorProfesor` en `src/lib/colegio/permisos.ts`.
- **FR-005**: ficha de profesor en `src/app/dashboard/colegio/profesores/[id]/ProfesorDetallePageClient.tsx` con listado, alta, edición y activación/desactivación de identificadores; enlace desde `ProfesoresPageClient.tsx`.
- **FR-006**: KPI de profesores activos en estadísticas (`src/lib/colegio/estadisticas.ts` + `ColegioEstadisticasPageClient.tsx`).
- **FR-007**: auditoría con acciones `COLEGIO_IDENTIFICADOR_PROFESOR_*`.
- **FR-008**: fixture `crearIdentificadorProfesor` en `src/lib/reporte-test-utils.ts` y orden de limpieza en `src/lib/test-utils.ts`.
- **FR-009**: sin cambios en `src/lib/ai/**`.

## Migración y modelo

- Migración aditiva: `prisma/migrations/20260812113000_spec_164_identificador_profesor/`.
- Schema: tabla nueva `IdentificadorProfesor` con FKs a `Profesor`, `Colegio` y `Plataforma`; valores de `AccionAudit` para operaciones de identificador de profesor.
- Oráculo de modelos actualizado a **62** (`scripts/arch/schema-prisma.test.ts`).

## Infraestructura de tests

- `src/lib/test-utils.ts`: orden de limpieza incluye `identificadorProfesor` antes de `profesor`.
- Tests de API cubren propiedad cross-tenant, duplicados, validación de plataforma y cambio de estado.

## Deuda técnica

- Ninguna desviación funcional. El motor (`src/lib/ai/**`) no se tocó.
- `dev-restart.sh` pendiente de ejecución por el CEO/ops al desplegar.
