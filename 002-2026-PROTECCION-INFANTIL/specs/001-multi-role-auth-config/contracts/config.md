# Contract: Configuration API

**Base Path**: `/api/config/parametros`

---

## GET /api/config/parametros

List all configuration parameters. Filterable by category. Admin only.

**Query Parameters**:
- `categoria` (optional): `VISIBILITY | SECURITY | LEGAL | EMAIL | SYSTEM`
- `page` (optional): number, default 1
- `pageSize` (optional): number, default 25, max 100

**Response 200**:
```json
{
  "items": [
    {
      "id": "string",
      "clave": "visibility.report_threshold",
      "valor": "3",
      "tipo": "INTEGER",
      "categoria": "VISIBILITY",
      "esPublico": true,
      "esSecreto": false,
      "descripcion": "string"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 6,
    "totalPages": 1
  }
}
```

**Response 401**: Not authenticated.  
**Response 403**: Not ADMIN.

---

## GET /api/config/parametros/publicos

Read public parameters without authentication. Used by frontend before login.

**Response 200**:
```json
{
  "visibility.report_threshold": {
    "valor": 3,
    "tipo": "INTEGER",
    "descripcion": "Mínimo de reportes independientes..."
  },
  "system.maintenance_mode": {
    "valor": false,
    "tipo": "BOOLEAN"
  }
}
```

---

## GET /api/config/parametros/:clave

Get a single parameter by key. Admin only (secreto values decrypted).

**Response 200**:
```json
{
  "id": "string",
  "clave": "visibility.report_threshold",
  "valor": 3,
  "tipo": "INTEGER",
  "categoria": "VISIBILITY",
  "esPublico": true,
  "esSecreto": false,
  "descripcion": "string",
  "reglasValidacion": "{\"min\":1,\"max\":100}",
  "historial": [
    {
      "valorAnterior": "5",
      "valorNuevo": "3",
      "actualizadoPor": "admin@example.com",
      "actualizadoEn": "2026-07-10T15:30:00Z"
    }
  ]
}
```

**Response 404**: Parameter not found.

---

## PATCH /api/config/parametros/:clave

Update a parameter value. Admin only. Creates audit log entry.

**Request Body**:
```json
{
  "valor": "5",
  "motivo": "Ajuste tras análisis de falsos positivos"
}
```

**Validation**:
- Must match parameter `tipo`
- Must satisfy `reglasValidacion` if present
- `esSecreto` parameters accept encrypted values

**Response 200**:
```json
{
  "id": "string",
  "clave": "visibility.report_threshold",
  "valor": 5,
  "tipo": "INTEGER",
  "actualizadoEn": "2026-07-11T22:00:00Z"
}
```

**Response 400**: Validation error (wrong type, out of range).  
**Response 403**: Not ADMIN.  
**Response 409**: Concurrent modification detected.

---

## DELETE /api/config/parametros/:clave

Delete a parameter. Admin only. Cannot delete system-critical parameters.

**Response 204**: Deleted successfully.

**Response 403**: Not ADMIN.  
**Response 409**: Parameter is system-critical and cannot be deleted.