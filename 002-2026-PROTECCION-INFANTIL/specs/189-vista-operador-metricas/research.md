# Research: SPEC-189 — Vista de operador con métricas

## Código base consultado

- `src/app/dashboard/admin/operadores/asignar/page.tsx` — tabla de asignación donde se enganchará el link.
- `src/app/api/admin/operadores/asignacion/route.ts` — patrón de endpoint admin (auth, rate-limit, servicio).
- `src/lib/dal/services/operadores.ts` — `OperadorService`, `panelAsignacion`, conteos de casos abiertos.
- `src/lib/dal/repositories/reporte.ts` — selects de bandeja, paginación, conteos.
- `src/lib/dal/repositories/audit-log.ts` — queries de acciones por rango y por operador.
- `src/lib/dal/repositories/usuario.ts` — `findOperadorById`.
- `src/lib/dal/services/estadisticas.ts` — `ACCIONES_CIERRE` y `CASO_ESCALADO` (patrón reutilizable).
- `src/lib/reportes-acceso.ts` — `whereReporteEnEstado`, `whereReporteVigente`.
- `prisma/schema.prisma` — enums `EstadoReporte`, `AccionAudit`, modelos `Reporte`, `AuditLog`, `Usuario`, `PerfilOperador`.

## Hallazgos

- El conteo de casos abiertos ya existe en `OperadorService.panelAsignacion`: `whereReporteEnEstado("REVISION_MANUAL", { operadorId })`.
- `AuditLogRepository` ya tiene los métodos necesarios para conteos y cruces de fechas.
- `ACCIONES_CIERRE` en `estadisticas.ts` define el mismo conjunto de acciones que se propone usar aquí.
- No hay endpoint existente que exponga métricas individuales de operador.

## Decisions pendientes de ZEUS

Ver [spec.md](./spec.md) sección "Decisiones de compuerta §4".
