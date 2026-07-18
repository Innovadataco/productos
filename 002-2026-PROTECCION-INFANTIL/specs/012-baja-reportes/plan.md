# Plan de implementación — Spec 012 Baja/Desactivación de reportes

> **Documentado retroactivamente el 2026-07-18** a partir de `IMPLEMENTATION-REPORT.md`, `prisma/schema.prisma` y el código de `src/lib/reporte-lifecycle.ts`.

## Condiciones de aprobación (R1-R7)

1. No se borra físicamente el reporte; solo se marca como eliminado (R1).
2. No se expone PII en las notas de baja (R2).
3. Toda la cascada corre dentro de `prisma.$transaction` (A1).
4. Las migraciones usan `prisma migrate dev` (R4).
5. La reactivación regenera el embedding y recalcula score/visibilidad (A2).
6. Los reportes eliminados se excluyen de ráfagas, stats y listados públicos (R7).
7. Lint, tsc, build y tests verdes al cerrar.

## Fases

### 1. Schema y migración
- Crear enum `MotivoBajaReporte` con valores `RETIRO_LIMPIEZA`, `REPORTE_FALSO`, `ORDEN_LEGAL`.
- Agregar a `Reporte`: `eliminado`, `motivoBaja`, `notaBaja`, `eliminadoEn`, `eliminadoPorId`.
- Extender `AccionAudit` con `REPORT_DEACTIVATE` y `REPORT_REACTIVATE`.
- Crear índices `Reporte_eliminado_idx` y `Reporte_eliminadoPorId_idx`.
- Recrear índices HNSW al final de la migración.

### 2. Backend: lógica de cascada
- Implementar `darDeBajaReporte` en `src/lib/reporte-lifecycle.ts`:
  - Recalcular contadores del identificador.
  - Eliminar fila `EmbeddingReporte`.
  - Conservar o purgar `DatasetEntrenamiento` / `EmbeddingDataset` según motivo.
  - Crear `AuditLog` `REPORT_DEACTIVATE`.
- Implementar `reactivarReporte`:
  - Regenerar embedding vía Ollama.
  - Desmarcar `eliminado` y recalcular score/visibilidad dentro de transacción.
  - Crear `AuditLog` `REPORT_REACTIVATE`.
- Actualizar `src/lib/scoring.ts` para filtrar `eliminado: false` y actualizar todos los contadores.

### 3. Endpoints admin
- `PATCH /api/admin/reportes/[id]/baja`.
- `PATCH /api/admin/reportes/[id]/reactivar`.
- Rate limit `admin_write` en ambos.

### 4. Queries y exclusiones
- Excluir eliminados en `/api/admin/reportes-revision`, `/api/admin/estadisticas`, `/api/consulta`, `/api/estadisticas-publicas`, `/api/reportes/procesar`.
- Soporte opcional `incluirEliminados` en listado admin.

### 5. Frontend
- Diálogo de baja con selector de motivo y nota obligatoria.
- Diálogo de reactivación con nota obligatoria.
- Badge "Eliminado" y checkbox para listarlos.

### 6. Tests
- Baja por cada motivo (conservar/purgar dataset, embedding, audit).
- Reactivación regenera embedding.
- Exclusión en ráfagas y estadísticas.

### 7. Cierre
- Actualizar `IMPLEMENTATION-REPORT.md`.
- Crear `specs/012-baja-reportes/reporte-cierre.md`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Cascada a media por fallo de score | Todo dentro de `prisma.$transaction`; si falla, no se persiste la baja. |
| Pérdida accidental de ejemplos RAG | Solo `REPORTE_FALSO`/`ORDEN_LEGAL` purgan dataset; `RETIRO_LIMPIEZA` conserva. |
| Confusión admin sobre qué está eliminado | Badge, banner y checkbox explícitos en la UI. |

## Definición de terminado

- Todos los criterios de aceptación del spec están cubiertos.
- Migración aplicada en dev y test.
- Lint, tsc, build y tests verdes.
- `smoke-e2e.ts` pasa.
