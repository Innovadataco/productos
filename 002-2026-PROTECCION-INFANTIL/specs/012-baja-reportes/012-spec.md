# Spec 012 — Baja/Desactivación de reportes

## Estado
APROBADA — pendiente de plan de implementación.

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
- Soft-delete en modelo `Reporte`: `eliminado`, `motivoBaja`, `notaBaja`, `elimadoEn`, `eliminadoPorId`.
- Extensión de `AccionAudit` con `REPORT_DEACTIVATE`.
- Endpoint admin `PATCH /api/admin/reportes/[id]/baja`.
- Recálculo correcto de `IdentificadorReportado` incluyendo contadores (`totalReportes`, `reportesAutenticados`, `reportesAnonimos`).
- Eliminación de fila `EmbeddingReporte` para quitar del dedup.
- Conservar o purgar `DatasetEntrenamiento` / `EmbeddingDataset` según motivo.
- Exclusión de reportes eliminados en listados públicos, stats y consultas.
- Detalle admin mostrando reportes eliminados marcados.
- UI admin: acción "Dar de baja" con confirmación, selector de motivo y campo de nota obligatorio.
- Tests unitarios de cada cascada por motivo.

### Excluido
- Hard-delete desde la UI (se mantiene soft-delete para auditoría).
- Reversión de baja (fuera de alcance inicial).
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
- **R6 — Calidad:** lint, tsc, build y tests verdes.
- **R7 — No regresión:** el flujo de baja no debe alterar el comportamiento del clasificador.

## Criterios de aceptación
- [ ] Schema migrado con campos de baja y enum de motivo.
- [ ] Endpoint admin protegido y con rate limit `admin_write`.
- [ ] Cascada `RETIRO_LIMPIEZA` recalcula score/visibilidad, elimina `EmbeddingReporte` y conserva dataset RAG.
- [ ] Cascada `REPORTE_FALSO`/`ORDEN_LEGAL` recalcula score/visibilidad, elimina `EmbeddingReporte` y purga dataset RAG.
- [ ] `AuditLog` `REPORT_DEACTIVATE` se crea siempre con motivo y nota.
- [ ] Listados públicos y estadísticas excluyen eliminados.
- [ ] UI admin permite dar de baja con motivo y nota.
- [ ] Tests de cada motivo pasan.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run build` y `npm test` verdes.

## Tabla de decisión de cascada

| Motivo | Score + visibilidad | EmbeddingReporte (dedup) | DatasetEntrenamiento / EmbeddingDataset | AuditLog |
|---|---|---|---|---|
| `RETIRO_LIMPIEZA` | Recalcular (contadores incluidos) | Eliminar fila | Conservar | `REPORT_DEACTIVATE` |
| `REPORTE_FALSO` / `ORDEN_LEGAL` | Recalcular (contadores incluidos) | Eliminar fila | Purgar | `REPORT_DEACTIVATE` |

## Decisiones de diseño
- Soft-delete en `Reporte` en lugar de tabla separada para mantener relaciones existentes y simplificar queries.
- `recalcularYGuardarScore` se corrige para actualizar todos los contadores del agregado.
- Eliminación explícita de `EmbeddingReporte` en lugar de depender solo de `onDelete: Cascade`, para asegurar limpieza inmediata.
