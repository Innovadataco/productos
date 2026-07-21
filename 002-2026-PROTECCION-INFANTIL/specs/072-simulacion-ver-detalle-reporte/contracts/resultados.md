# Contract: GET /api/admin/ia/simulaciones/[id]/resultados

**Status**: Existing endpoint, no changes required for Spec 072.

**Auth**: Requires `ADMIN` role via `verifyAuth(RolUsuario.ADMIN)`.

**Rate limit**: `admin_read` (per `checkRateLimit`).

---

## Request

```http
GET /api/admin/ia/simulaciones/{id}/resultados?page=1&pageSize=50
```

**Query parameters**:

| Name | Type | Default | Max | Description |
|------|------|---------|-----|-------------|
| `page` | integer | 1 | — | Page number (1-based) |
| `pageSize` | integer | 50 | 100 | Items per page |

---

## Response 200

```json
{
  "items": [
    {
      "indice": 1,
      "identificador": "SIM-xxx-1",
      "reporteId": "reporte-uuid",
      "estado": "CLASIFICADO",
      "categoriaEsperada": "SOLICITUD_MATERIAL",
      "categoriaAsignada": "SOLICITUD_MATERIAL",
      "confianza": 0.92,
      "latenciaMs": 120,
      "modeloUsado": "ornith:9b",
      "acierto": true
    }
  ],
  "pagination": {
    "page": 1,
    "totalPages": 1,
    "total": 1
  }
}
```

**Field notes**:

- `reporteId` is the foreign key to `Reporte.id` and is already exposed by the endpoint. The UI uses it to open `AdminReporteDetalle`.
- `categoriaEsperada` may be `null` if the uploaded case set did not include expected categories.
- `acierto` may be `null` if `categoriaEsperada` is missing or cannot be canonized.

---

## Errors

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid simulation id |
| 401 | `AUTH_INVALID` | User not authenticated |
| 403 | `FORBIDDEN` | User not `ADMIN` |
| 404 | `NOT_FOUND` | Simulation not found |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## No changes for Spec 072

This contract is included for completeness. The implementation of Spec 072 only consumes the existing `reporteId` field; it does not modify the endpoint, request shape, or response shape.
