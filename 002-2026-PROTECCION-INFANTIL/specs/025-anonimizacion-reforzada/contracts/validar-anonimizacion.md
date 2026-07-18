# Contract: Validar anonimización

**Feature**: specs/025-anonimizacion-reforzada
**Base Path**: `/api/admin/reportes`

---

## POST /api/admin/reportes/[id]/validar-anonimizacion

Operador valida o rechaza la anonimización de un reporte en estado `REQUIERE_ANONIMIZACION`.

### Request

```json
{
  "valida": true,
  "observaciones": "La anonimización es correcta"
}
```

**Headers**:
- Cookie `token` (rol OPERADOR o ADMIN)

### Response 200 — Validada

```json
{
  "reporteId": "cmr...",
  "estado": "CLASIFICADO",
  "anonimizacionValidadaPorId": "cmr...",
  "anonimizacionValidadaEn": "2026-07-18T10:30:00Z"
}
```

### Response 200 — Rechazada

```json
{
  "reporteId": "cmr...",
  "estado": "REQUIERE_ANONIMIZACION",
  "observaciones": "Aún aparece el nombre del colegio"
}
```

### Response 400 — Estado inválido

```json
{
  "error": {
    "message": "El reporte no requiere anonimización",
    "code": "INVALID_STATE"
  }
}
```

### Response 403

```json
{
  "error": {
    "message": "Requiere rol OPERADOR o ADMIN",
    "code": "FORBIDDEN"
  }
}
```
