# Contract: Bandeja del comité

**Feature**: specs/024-comite-validacion
**Base Path**: `/api/admin/comite`

---

## GET /api/admin/comite/pendientes

Lista de solicitudes pendientes de asignación al comité.

### Request

**Headers**:
- Cookie `token` (rol COMITE_VALIDACION o ADMIN)

**Query params** (opcional):
- `page`, `limit`

### Response 200

```json
{
  "solicitudes": [
    {
      "id": "cmr...",
      "numero": "SOL-ABC123",
      "reporteId": "cmr...",
      "estado": "PENDIENTE",
      "motivo": "Contenido ambiguo",
      "creadoEn": "2026-07-18T10:00:00Z"
    }
  ],
  "paginacion": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```

---

## GET /api/admin/comite/mias

Solicitudes asignadas al miembro del comité autenticado.

### Request

**Headers**:
- Cookie `token` (rol COMITE_VALIDACION)

### Response 200

```json
{
  "solicitudes": [
    {
      "id": "cmr...",
      "numero": "SOL-ABC123",
      "reporteId": "cmr...",
      "estado": "ASIGNADA",
      "motivo": "Contenido ambiguo",
      "creadoEn": "2026-07-18T10:00:00Z"
    }
  ]
}
```

### Response 403

```json
{
  "error": {
    "message": "Requiere rol COMITE_VALIDACION",
    "code": "FORBIDDEN"
  }
}
```
