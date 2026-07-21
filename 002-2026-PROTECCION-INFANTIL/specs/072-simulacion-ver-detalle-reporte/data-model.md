# Data Model: Simulación — Ver detalle del reporte (Spec 072)

**Date**: 2026-07-20
**Feature**: specs/072-simulacion-ver-detalle-reporte/spec.md

---

## Active Entities

No hay cambios de modelo en este spec. Se utilizan las entidades existentes:

### `SimulacionReporte` (existente)

| Field | Type | Notes |
|-------|------|-------|
| `id` | String | `@id @default(cuid())` |
| `simulacionRunId` | String | FK → `SimulacionRun.id` |
| `reporteId` | String | FK → `Reporte.id` — campo ya disponible para abrir el detalle |
| `indice` | Int | Posición del caso en el set cargado |
| `categoriaEsperada` | String | Opcional, para medir acierto |

### `Reporte` (existente)

Entidad cuyo detalle se muestra mediante `AdminReporteDetalle`. No se modifican sus campos.

---

## Entity Relationships

```
SimulacionRun ||--o{ SimulacionReporte : "contiene"
SimulacionReporte }|--|| Reporte : "reporteId"
```

---

## Data Access

### Endpoint existente: `GET /api/admin/ia/simulaciones/[id]/resultados`

Ya devuelve `reporteId` por cada ítem. No requiere cambios.

**Response shape** (confirmado):
```json
{
  "items": [
    {
      "indice": 1,
      "identificador": "SIM-xxx-1",
      "reporteId": "reporte-id-uuid",
      "estado": "CLASIFICADO",
      "categoriaEsperada": "SOLICITUD_MATERIAL",
      "categoriaAsignada": "SOLICITUD_MATERIAL",
      "confianza": 0.92,
      "latenciaMs": 120,
      "modeloUsado": "ornith:9b",
      "acierto": true
    }
  ],
  "pagination": { "page": 1, "totalPages": 1, "total": 1 }
}
```

### Endpoint existente: `GET /api/admin/reportes/[id]`

Usado internamente por `AdminReporteDetalle` para cargar el detalle. No requiere cambios.

---

## Indexes

No se agregan índices. Los índices existentes en `SimulacionReporte.simulacionRunId` y `Reporte.id` son suficientes.

---

## Seed Data

No se requiere seed adicional. El quickstart usa las cuentas de trabajo y la simulación del Spec 070.
