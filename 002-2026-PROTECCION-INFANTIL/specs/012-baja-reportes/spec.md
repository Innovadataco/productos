# Spec 012 — Baja/Desactivación de reportes

**Status**: CERRADA (inferida de reporte-cierre.md, spec 087-US1)

> **Nota:** este `spec.md` se creó retroactivamente el 2026-07-18 a partir de `012-spec.md` y [`IMPLEMENTATION-REPORT.md`](IMPLEMENTATION-REPORT.md) para mantener la convención de nombre `spec.md` del Spec-Kit.

## Estado
**CERRADA** — fecha de cierre: 2026-07-16.

## Contexto
Hoy no existe forma de eliminar o desactivar un reporte. Un administrador necesita dar de baja reportes por dos motivos principales:
- **Retiro/limpieza:** el reporte ya no debe considerarse activo, pero el ejemplo anonimizado puede seguir siendo útil para el dataset RAG.
- **Reporte falso u orden legal:** el reporte debe desaparecer completamente del sistema, incluyendo su huella en embeddings y dataset.

En ambos casos se debe conservar trazabilidad de auditoría.

## Objetivo
Permitir a un administrador dar de baja un reporte mediante soft-delete, registrando motivo y nota, aplicando una cascada diferenciada según el motivo y recalculando el score/visibilidad del identificador afectado.

## Alcance

### Incluido
- Nuevo enum `MotivoBajaReporte` con valores `RETIRO_LIMPIEZA`, `REPORTE_FALSO`, `ORDEN_LEGAL`.
- Soft-delete en modelo `Reporte`: `eliminado`, `motivoBaja`, `notaBaja`, `eliminadoEn`, `eliminadoPorId`.
- Extensión de `AccionAudit` con `REPORT_DEACTIVATE` y `REPORT_REACTIVATE`.
- Endpoints admin `PATCH /api/admin/reportes/[id]/baja` y `PATCH /api/admin/reportes/[id]/reactivar`.
- Recálculo correcto de `IdentificadorReportado` incluyendo contadores (`totalReportes`, `reportesAutenticados`, `reportesAnonimos`).
- Eliminación de fila `EmbeddingReporte` para quitar del dedup.
- Conservar o purgar `DatasetEntrenamiento` / `EmbeddingDataset` según motivo.
- Exclusión de reportes eliminados en listados públicos, stats y consultas.
- Detalle admin mostrando reportes eliminados marcados.
- UI admin: acción "Dar de baja" con confirmación, selector de motivo y campo de nota obligatorio.
- Tests unitarios de cada cascada por motivo.

### Excluido
- Hard-delete desde la UI (se mantiene soft-delete para auditoría).
- Reversión de baja (fuera de alcance inicial; la reactivación se agregó durante la implementación).
- Notificación automática al reportante o al identificador reportado.

## Requisitos funcionales
1. Un admin puede dar de baja un reporte no ya eliminado.
2. El motivo de baja es obligatorio y se elige de un enum.
3. La nota de baja es obligatoria y se guarda en texto libre.
4. Según el motivo se aplica la cascada definida en la tabla de decisión.
5. Se genera `AuditLog` `REPORT_DEACTIVATE` con admin, motivo, nota, categoría y estado anterior.
6. Los reportes eliminados no afectan score, visibilidad pública ni deduplicación.
7. Los reportes eliminados no aparecen en listados públicos ni estadísticas.

## Requisitos no funcionales
- **R1 — Inmutabilidad:** no se borra físicamente el reporte; solo se marca como eliminado.
- **R2 — Privacidad:** la nota de baja no debe contener texto del reporte; si es necesario referirse, usar solo metadata.
- **A1 — Atomicidad:** toda la cascada corre dentro de `prisma.$transaction`.
- **A2 — Reactivación:** la reactivación regenera el embedding vía Ollama y recalcula score/visibilidad.
- **R6 — Calidad:** lint, tsc, build y tests verdes.
- **R7 — No regresión:** el flujo de baja no debe alterar el comportamiento del clasificador.

## Tabla de decisión de cascada

| Motivo | Score + visibilidad | EmbeddingReporte (dedup) | DatasetEntrenamiento / EmbeddingDataset | AuditLog |
|---|---|---|---|---|
| `RETIRO_LIMPIEZA` | Recalcular (contadores incluidos) | Eliminar fila | Conservar | `REPORT_DEACTIVATE` |
| `REPORTE_FALSO` / `ORDEN_LEGAL` | Recalcular (contadores incluidos) | Eliminar fila | Purgar | `REPORT_DEACTIVATE` |

## Endpoints y componentes afectados
- Endpoints: `PATCH /api/admin/reportes/[id]/baja`, `PATCH /api/admin/reportes/[id]/reactivar`.
- Librerías: `src/lib/reporte-lifecycle.ts`, `src/lib/scoring.ts`, `src/lib/visibility.ts`, `src/lib/audit.ts`.
- Componentes: `AdminReporteDetalle`, `AdminReportesTable`.
- Queries actualizadas: `/api/admin/reportes-revision`, `/api/admin/estadisticas`, `/api/consulta`, `/api/estadisticas-publicas`, `/api/reportes/procesar`.

## Tests
- `src/app/api/admin/reportes/[id]/baja/route.test.ts`
- `src/app/api/admin/reportes/[id]/reactivar/route.test.ts`
- `src/app/api/reportes/procesar/route.test.ts` (ráfagas excluyen eliminados)
- `src/app/api/admin/estadisticas/route.test.ts` (estadísticas excluyen eliminados)

## Migraciones relevantes
- `20260717011303_add_reporte_baja`

## Verificaciones de cierre
- `npm run lint` ✅
- `npx tsc --noEmit` ✅
- `npm test` 125/125 ✅
- `npm run build` ✅
- `scripts/smoke-e2e.ts` ✅

## Decisiones de diseño
- Soft-delete en `Reporte` en lugar de tabla separada para mantener relaciones existentes y simplificar queries.
- `recalcularYGuardarScore` se corrigió para actualizar todos los contadores del agregado.
- Eliminación explícita de `EmbeddingReporte` en lugar de depender solo de `onDelete: Cascade`, para asegurar limpieza inmediata.
