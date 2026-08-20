# Cierre: SPEC-188 — Visibilidad del operador en la bandeja (002-PI-083)

## Estado

- Rama: `work/002-pi-083`
- Base: `origin/feature/001-scaffolding` (incluye SPEC-187 en `54fb1463`)
- PR: pendiente de apertura tras este commit

## Resumen

Se implementó la visibilidad del operador asignado en la bandeja de reportes del admin, el filtro por operador y el enriquecimiento del timeline "Ver proceso" con eventos de asignación/reasignación/desasignación de operador.

## Archivos modificados

- `src/app/dashboard/admin/page.tsx`
- `src/components/modules/AdminReportesTable.tsx`
- `src/components/modules/AdminReporteProceso.tsx`
- `src/lib/dal/repositories/audit-log.ts`
- `src/lib/reportes/timeline-proceso.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260820020000_spec_188_operador_desasignado/migration.sql`
- `src/app/api/admin/reportes-revision/route.test.ts`
- `src/lib/reportes/timeline-proceso.test.ts`
- `src/components/modules/AdminReportesTable.test.tsx`
- `specs/188-visibilidad-operador-bandeja/spec.md`
- `specs/188-visibilidad-operador-bandeja/plan.md`
- `specs/188-visibilidad-operador-bandeja/tasks.md`
- `specs/188-visibilidad-operador-bandeja/cierre.md`
- `specs/README.md`

## Gate local

```text
npx tsc --noEmit          ✅
npm run lint -- --no-cache ✅ (0 errores, warnings preexistentes)
npm run test              ✅ (1352 passed, 1 skipped)
npm run arch:check        ✅
npm run build             ✅
```

## Hallazgo técnico

El enum `AccionAudit` no contenía `OPERADOR_DESASIGNADO`. El diseño aprobado asumía que sí. Se añadió mediante migración aditiva:

```sql
ALTER TYPE "AccionAudit" ADD VALUE 'OPERADOR_DESASIGNADO';
```

Esto es seguro en PostgreSQL, no borra datos y se aplicó a las BDs de dev y test.

## Decisiones de implementación

- Para `OPERADOR_ASIGNADO` (asignación automática), `actorEmail` es `null` y se muestra "por sistema" en la UI, porque el `AuditLog` de asignación automática no guarda un actor admin.
- Para `OPERADOR_REASIGNADO`, el actor es el admin que ejecutó la acción (`usuarioId` del AuditLog) y el operador afectado se extrae de `valorNuevo`.
- Para `OPERADOR_DESASIGNADO`, el actor es el admin y el operador afectado se extrae de `valorAnterior`.
- El dropdown de filtro por operador se oculta para roles `OPERADOR`/`COMITE_VALIDACION` porque su bandeja ya está filtrada por su propio ID.

## Pruebas añadidas

1. `src/app/api/admin/reportes-revision/route.test.ts`: filtro por `operadorId` y DTO con email del operador.
2. `src/lib/reportes/timeline-proceso.test.ts`: eventos `OPERADOR_ASIGNADO` y `OPERADOR_REASIGNADO` en el timeline.
3. `src/components/modules/AdminReportesTable.test.tsx`: columna operador, email asignado, filtro dropdown y ocultamiento para OPERADOR.
