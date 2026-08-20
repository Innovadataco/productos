# Plan de implementación: SPEC-188 — Visibilidad del operador en la bandeja (002-PI-083)

## Resumen

Tres bloques de cambio:
1. Bandeja con columna Operador y filtro dropdown.
2. Timeline enriquecido con eventos de asignación desde `AuditLog`.
3. Tests de integración/unitarios.

## Cambios de código

### 1. Backend — DTO de bandeja

En `src/lib/dal/repositories/reporte.ts`, método `findBandejaRevision`: asegurar que el select incluya `operadorId` y `operador { id, email, nombre }`. Si ya lo incluye, solo confirmar.

### 2. Backend — `/api/admin/reportes-revision`

El endpoint ya soporta `operadorId` vía `reportesRevisionQuerySchema`. Verificar que la respuesta incluya `operadorId` y `operadorEmail` en cada fila.

### 3. Frontend — `AdminReportesTable.tsx`

- Extender `ReporteListItem` con `operadorId?: string | null` y `operadorEmail?: string | null`.
- Añadir estado `operadorId` y actualizar `buildQueryString`.
- Cargar operadores activos desde `/api/admin/operadores` (nuevo `useEffect`).
- Añadir `<Select label="Operador" ... />` en el panel de filtros.
- Añadir columna "Operador" en `TablaHead` y renderizado en filas:
  - Si `operadorEmail` → truncado con tooltip.
  - Si null → `<span className="text-subtle">Sin asignar</span>`.
- Actualizar `colSpan` de estados vacíos/cargando.

### 4. Backend — `AuditLogRepository`

Añadir método:

```ts
findAsignacionesReporte(reporteId: string) {
    return this.db.auditLog.findMany({
        where: {
            tipoRecurso: "Reporte",
            recursoId: reporteId,
            accion: { in: ["OPERADOR_ASIGNADO", "OPERADOR_REASIGNADO", "OPERADOR_DESASIGNADO"] },
        },
        orderBy: { creadoEn: "asc" },
        include: {
            usuario: { select: { email: true, nombre: true } },
        },
    });
}
```

### 5. Backend — `src/lib/reportes/timeline-proceso.ts`

- Nuevo tipo `EventoAsignacionOperador` con `tipo: "ASIGNACION_OPERADOR"`.
- Extender `EventoProceso` y `TipoEventoProceso`.
- En `obtenerTimelineProceso`, consultar asignaciones vía `AuditLogRepository`.
- Parsear `valorNuevo` (o usar relación si existe) para obtener el email del operador afectado. Decisión: si `valorNuevo` contiene el email, usarlo; si no, dejar "Desconocido" o parsear según formato.
- Ordenar cronológicamente con el resto de eventos.

### 6. Frontend — UI "Ver proceso"

En el componente que renderiza el timeline (probablemente `src/components/modules/AdminReporteExpediente.tsx` o similar):
- Añadir render para `EventoAsignacionOperador` con icono distinto.
- Textos:
  - `OPERADOR_ASIGNADO`: "Asignado a `<operador>` por `<actor>`".
  - `OPERADOR_REASIGNADO`: "Reasignado a `<operador>` por `<actor>`".
  - `OPERADOR_DESASIGNADO`: "Desasignado por `<actor>`".

## Tareas

Ver [tasks.md](./tasks.md).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| `valorNuevo` no contiene email del operador | Usar `Usuario` join por `valorNuevo` si es un ID; dejar fallback "Desconocido". |
| Filtro dropdown para OPERADOR/COMITE | Ocultar/deshabilitar el select porque su bandeja ya está filtrada. |
| Cambio en DTO rompe otros consumidores | Campos opcionales; solo `AdminReportesTable` los usa inicialmente. |

## Migración

Se requirió una migración aditiva mínima no prevista en la compuerta:

- `prisma/migrations/20260820020000_spec_188_operador_desasignado/migration.sql`
- `ALTER TYPE "AccionAudit" ADD VALUE 'OPERADOR_DESASIGNADO';`

Razón: el diseño asumía que `OPERADOR_DESASIGNADO` ya existía en el enum, pero el schema solo tenía `OPERADOR_ASIGNADO` y `OPERADOR_REASIGNADO`. La migración es aditiva, no destructiva, y se aplicó a dev y test.

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde (no cambian rutas ni permisos).
- No tocar `src/lib/ai/**`.
