# Contract: Mis reportes

**Feature**: specs/023-estados-usuario-sla
**Base Path**: `/api/reportes/mis-reportes`

---

## GET /api/reportes/mis-reportes

Lista los reportes creados por el usuario autenticado, filtrando eliminados y mostrando estados visuales.

### Request

**Headers**:
- Cookie `token` (requerido, rol PARENT)

**Query params** (opcional):
- `page`: número de página, default 1
- `limit`: items por página, default 20, max 100

### Response 200

```json
{
  "reportes": [
    {
      "id": "cmr...",
      "numeroSeguimiento": "RPT-ABC123",
      "identificador": "+573001234567",
      "plataforma": "whatsapp",
      "estadoVisual": "En proceso",
      "estadoInterno": "REVISION_MANUAL",
      "mensaje": "Tu reporte está en proceso — puede tardar hasta 24 horas",
      "esAnonimo": false,
      "creadoEn": "2026-07-18T10:00:00Z"
    }
  ],
  "paginacion": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### Response 401

```json
{
  "error": {
    "message": "No autenticado",
    "code": "UNAUTHORIZED"
  }
}
```

### Response 403

```json
{
  "error": {
    "message": "Solo usuarios PARENT pueden ver sus reportes",
    "code": "FORBIDDEN"
  }
}
```

**Nota**: reportes con `eliminado = true` se excluyen siempre.
