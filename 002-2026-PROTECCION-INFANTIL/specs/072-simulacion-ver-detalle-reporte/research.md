# Research: Simulación — Ver detalle del reporte (Spec 072)

**Date**: 2026-07-20
**Feature**: specs/072-simulacion-ver-detalle-reporte/spec.md

---

## Decisions

### D1: Reutilización de `AdminReporteDetalle` y `Modal`

**Decision**: Usar directamente `AdminReporteDetalle` desde `src/components/modules/AdminReporteDetalle.tsx` y el `Modal` desde `src/components/ui/Modal.tsx`.

**Rationale**: El Spec 054 creó un `Modal` reusable con cierre por Escape, overlay y botón Cerrar, y `AdminReporteDetalle` ya lo envuelve. No hay razón para duplicar la vista de detalle ni crear un modal nuevo. El patrón de reutilización es el mismo que usa la bandeja de admin.

**Components verified**:
- `AdminReporteDetalle` acepta props `reporteId: string`, `onClose: () => void`, `onRefresh: () => void`, `inline?: boolean`.
- `AdminReporteDetalle` renderiza el `Modal` internamente cuando `inline` es falso, con título "Detalle del reporte".
- `Modal` soporta `isOpen`, `onClose`, `title`, `showCloseButton` (default `true`), y focus trap.

### D2: Disponibilidad de `reporteId` en el endpoint de resultados

**Decision**: No se modifica el endpoint de resultados; `reporteId` ya está disponible.

**Rationale**: Tras inspeccionar `src/app/api/admin/ia/simulaciones/[id]/resultados/route.ts`, el endpoint ya incluye `reporteId: rel.reporteId` en cada ítem de salida (línea 76). Además, el tipo `ResultadoCaso` en `src/components/modules/ia/simulacion/types.ts` ya declara `reporteId: string`.

**Verification**:
```typescript
// src/app/api/admin/ia/simulaciones/[id]/resultados/route.ts
return {
    indice: rel.indice,
    identificador: rep?.identificador ?? "",
    reporteId: rel.reporteId,  // <-- ya expuesto
    estado: rep?.estado ?? "DESCONOCIDO",
    ...
};
```

```typescript
// src/components/modules/ia/simulacion/types.ts
export interface ResultadoCaso {
    indice: number;
    identificador: string;
    reporteId: string;  // <-- ya tipado
    ...
}
```

### D3: Sin cambios de modelo ni endpoints nuevos

**Decision**: El spec no requiere migraciones ni endpoints nuevos.

**Rationale**: La funcionalidad es UI + consumo de datos ya existentes. `SimulacionReporte.reporteId` ya existe y vincula la corrida con el `Reporte`. El endpoint de detalle de reporte (`/api/admin/reportes/[id]`) ya está implementado y usado por `AdminReporteDetalle`.

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Crear un modal de detalle simplificado para simulación | Duplicaría código y podría divergir del detalle real; viola FR-003 |
| Crear un endpoint nuevo `GET /api/admin/ia/simulaciones/[id]/resultados/[indice]/detalle` | Innecesario; `reporteId` ya permite usar el endpoint existente de reportes |
| Navegar a una página de detalle en lugar de modal | Rompe el flujo de análisis de la simulación; el modal mantiene el contexto |

---

## Open Questions (0 remaining)

All NEEDS CLARIFICATION resolved. `reporteId` está disponible y los componentes son reutilizables.
