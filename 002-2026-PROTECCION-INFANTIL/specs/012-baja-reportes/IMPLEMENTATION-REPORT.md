# Spec 012 — Baja/Desactivación de reportes — Implementation Report

Fecha de cierre: 2026-07-16

## Resumen de cambios

Se implementó soft-delete del modelo `Reporte` con motivo, cascada atómica de score/visibilidad, purga condicional de dataset RAG, reversibilidad (reactivación) y exclusión de eliminados en ráfagas y estadísticas.

### Schema y migración

- Migración `20260717011303_add_reporte_baja`:
  - Nuevo enum `MotivoBajaReporte`: `RETIRO_LIMPIEZA`, `REPORTE_FALSO`, `ORDEN_LEGAL`.
  - Valores `REPORT_DEACTIVATE` y `REPORT_REACTIVATE` en `AccionAudit`.
  - Campos en `Reporte`: `eliminado`, `motivoBaja`, `notaBaja`, `eliminadoEn`, `eliminadoPorId` + relación `eliminadoPor`.
  - Índices `Reporte_eliminado_idx` y `Reporte_eliminadoPorId_idx`.
  - Recreación de índices hnsw al final de la migración.

### Backend

- `src/lib/scoring.ts`:
  - `recalcularYGuardarScore` ahora actualiza `totalReportes`, `reportesAutenticados` y `reportesAnonimos` en la rama `update`.
  - `calcularScore` filtra explícitamente `eliminado: false`.
  - Ambas funciones aceptan `Prisma.TransactionClient` para ejecución dentro de transacciones.
- `src/lib/visibility.ts`: acepta `Prisma.TransactionClient`.
- `src/lib/audit.ts`: `logAudit` acepta `Prisma.TransactionClient`.
- `src/lib/reporte-lifecycle.ts`:
  - `darDeBajaReporte`: toda la cascada dentro de `prisma.$transaction` (A1).
  - `reactivarReporte`: genera embedding fuera de la transacción y luego desmarca eliminado, inserta embedding, recalcula score/visibilidad y auditlog dentro de `prisma.$transaction` (A2).
- `src/app/api/admin/reportes/[id]/baja/route.ts`: endpoint PATCH admin con rate limit `admin_write`.
- `src/app/api/admin/reportes/[id]/reactivar/route.ts`: endpoint PATCH admin con rate limit `admin_write`.
- Queries actualizadas para excluir `eliminado: true`:
  - `src/app/api/admin/reportes-revision/route.ts` (con parámetro opcional `incluirEliminados`).
  - `src/app/api/admin/estadisticas/route.ts` (totales, distribuciones, `precisionObservada`).
  - `src/app/api/consulta/route.ts`.
  - `src/app/api/estadisticas-publicas/route.ts`.
  - `src/app/api/reportes/procesar/route.ts` (detección de ráfagas).
- Validaciones de seguridad:
  - Confirmar, corregir y anonimizar rechazan reportes eliminados.

### Frontend

- `src/components/modules/AdminReporteDetalle.tsx`:
  - Diálogo de baja con selector de motivo y nota obligatoria.
  - Diálogo de reactivación con nota obligatoria.
  - Banner de reporte eliminado con motivo, nota y fecha.
  - Acciones de confirmar/corregir/anonimizar deshabilitadas si está eliminado.
- `src/components/modules/AdminReportesTable.tsx`:
  - Badge "Eliminado" en filas eliminadas.
  - Checkbox "Incluir dados de baja" para listar eliminados.

### Tests

- `src/app/api/admin/reportes/[id]/baja/route.test.ts`:
  - Baja `RETIRO_LIMPIEZA` conserva dataset, recalcula contadores, borra embedding, crea `AuditLog`.
  - Baja `REPORTE_FALSO` purga dataset y embedding RAG.
  - 409 si ya está eliminado.
  - 403 si no es admin.
- `src/app/api/admin/reportes/[id]/reactivar/route.test.ts`:
  - Reactivación regenera embedding, recalcula score, crea `AuditLog`.
  - 409 si no está eliminado.
  - 403 si no es admin.
- `src/app/api/reportes/procesar/route.test.ts`: reportes eliminados no cuentan para ráfagas.
- `src/app/api/admin/estadisticas/route.test.ts`: reportes eliminados no cuentan en totales ni `precisionObservada`.

## Verificaciones de cierre

| Verificación | Comando | Resultado |
|---|---|---|
| Lint | `npm run lint` | ✅ sin errores |
| TypeScript | `npx tsc --noEmit` | ✅ sin errores |
| Tests | `npm test` | ✅ 125/125 pasando |
| Build | `npm run build` | ✅ exit 0 |
| Smoke E2E | `node --env-file=.env --import tsx scripts/smoke-e2e.ts` | ✅ SMOKE TEST PASÓ |

## Decisiones y notas

- **Atomicidad (A1):** toda la cascada de baja y reactivación corre dentro de `prisma.$transaction`. Si falla el recálculo de score o el auditlog, el reporte no queda a media.
- **Reversibilidad (A2):** la reactivación regenera el embedding vía Ollama. Si el motivo de baja purgó el dataset (`REPORTE_FALSO`/`ORDEN_LEGAL`), ese ejemplo no se restaura automáticamente.
- **Ráfagas y stats (A3):** los reportes eliminados se excluyen de la detección de ráfagas y del cálculo de `precisionObservada`, además de listados y estadísticas públicas.
- El campo `eliminado` tiene default `false`, por lo que los reportes existentes permanecen activos.
