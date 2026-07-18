# Reporte de cierre — Spec 012 Baja/Desactivación de reportes

> **Documentado retroactivamente el 2026-07-18** derivado de [`IMPLEMENTATION-REPORT.md`](IMPLEMENTATION-REPORT.md).

## Estado

**CERRADA** — fecha de cierre: 2026-07-16.

## Resumen ejecutivo

Se implementó soft-delete del modelo `Reporte` con motivo, cascada atómica de score/visibilidad, purga condicional del dataset RAG, reversibilidad mediante reactivación y exclusión de eliminados en ráfagas y estadísticas.

## Alcance entregado

- Nuevo enum `MotivoBajaReporte`: `RETIRO_LIMPIEZA`, `REPORTE_FALSO`, `ORDEN_LEGAL`.
- Campos de baja en `Reporte`: `eliminado`, `motivoBaja`, `notaBaja`, `eliminadoEn`, `eliminadoPorId`.
- Extensión de `AccionAudit` con `REPORT_DEACTIVATE` y `REPORT_REACTIVATE`.
- Endpoints admin: `PATCH /api/admin/reportes/[id]/baja` y `PATCH /api/admin/reportes/[id]/reactivar`.
- Recálculo de `IdentificadorReportado` con contadores (`totalReportes`, `reportesAutenticados`, `reportesAnonimos`).
- Eliminación de fila `EmbeddingReporte` para quitar del dedup.
- Conservación o purga de `DatasetEntrenamiento` / `EmbeddingDataset` según motivo.
- Exclusión de eliminados en listados públicos, stats y consultas (con opción `incluirEliminados` en admin).
- UI admin: diálogos de baja/reactivación, badge "Eliminado", banner de detalle.
- Tests unitarios de cada cascada por motivo.

## Migraciones

- `20260717011303_add_reporte_baja`

## Verificaciones de cierre

| Verificación | Comando | Resultado |
|---|---|---|
| Lint | `npm run lint` | ✅ sin errores |
| TypeScript | `npx tsc --noEmit` | ✅ sin errores |
| Tests | `npm test` | ✅ 125/125 pasando |
| Build | `npm run build` | ✅ exit 0 |
| Smoke E2E | `node --env-file=.env --import tsx scripts/smoke-e2e.ts` | ✅ SMOKE TEST PASÓ |

## Decisiones clave

- **Soft-delete** en lugar de tabla separada para mantener relaciones existentes y simplificar queries.
- **Reactivación regenera embedding** vía Ollama pero no restaura ejemplos purgados del dataset RAG.
- **Atomicidad:** toda la cascada de baja/reactivación corre dentro de `prisma.$transaction`.

## Pendientes derivados

- Ver [`docs/deuda-tecnica.md`](../../docs/deuda-tecnica.md): N4 (hard-delete/purga física), N8 (restauración de dataset), N9 (notificaciones automáticas).
