# Contrato API — Planes (`/api/admin/pagos/planes`)

**Autenticación**: cookie `token` con JWT de usuario `ADMIN`.  
**Permiso de módulo**: `pagos_admin`.

---

## GET /api/admin/pagos/planes

Listado paginado de planes. Filtros opcionales por `tipoTitular` y `anio`.

### Query params

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `page` | integer | 1 | Página |
| `pageSize` | integer (1-100) | 25 | Tamaño de página |
| `tipoTitular` | `"COLEGIO"` \| `"PADRE"` | — | Filtrar por rol destino |
| `anio` | integer | — | Filtrar por año |

### Respuesta 200

```json
{
  "items": [
    {
      "id": "cmt...",
      "nombre": "Plan Padre 3 meses",
      "tipoTitular": "PADRE",
      "duracion": "MES_3",
      "anio": 2026,
      "precioBaseUSD": 0,
      "precioBaseCOP": 39900,
      "esFreemium": false,
      "usosMaximosPorCliente": null,
      "activo": true,
      "descuentoAnualPct": null,
      "descripcion": "..."
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 8,
    "totalPages": 1
  }
}
```

---

## POST /api/admin/pagos/planes

Crea un nuevo plan.

### Body

```json
{
  "nombre": "Plan Padre 3 meses",
  "precioBaseCOP": 39900,
  "precioBaseUSD": 10,
  "duracion": "MES_3",
  "tipoTitular": "PADRE",
  "anio": 2026,
  "descripcion": "Opcional",
  "activo": true,
  "usosMaximosPorCliente": null,
  "esFreemium": false,
  "descuentoAnualPct": null
}
```

### Validaciones

- `nombre`: 2-120 caracteres.
- `precioBaseCOP`: >= 0. Si `esFreemium` es `true`, debe ser `0`; si es falso, debe ser > 0.
- `precioBaseUSD`: > 0 (legacy requerido por BD).
- `duracion`: `MES_1`, `MES_2`, `MES_3`, `MES_6`, `MES_12`.
- `tipoTitular`: `COLEGIO` o `PADRE`.
- `anio`: 2020-2100, default año actual.
- `usosMaximosPorCliente`: entero >= 1 cuando `esFreemium` es `true`.

### Respuestas

- `201 Created` → `{ plan }`.
- `400 Bad Request` → payload inválido.
- `409 Conflict` → nombre duplicado para el rol o clave (rol, duración, año) duplicada.
- `401/403/429` → auth/module/rate limit.

### Auditoría

Registra `AuditLog` con `accion = PLAN_CREATE`.

---

## PATCH /api/admin/pagos/planes/:id

Edita un plan existente.

### Body

Objeto parcial con cualquier subconjunto de los campos del POST (excepto `anio`, `duracion`, `tipoTitular`).

```json
{
  "precioBaseCOP": 44900,
  "descripcion": "Actualizado"
}
```

### Respuestas

- `200 OK` → `{ plan }`.
- `400 Bad Request` → payload inválido o vacío.
- `404 Not Found` → plan no existe.
- `409 Conflict` → nombre duplicado para el rol.

### Auditoría

Registra `AuditLog` con `accion = PLAN_UPDATE` y `valorAnterior`/`valorNuevo`.

---

## DELETE /api/admin/pagos/planes/:id

Desactiva lógicamente un plan (`activo = false`).

### Respuestas

- `200 OK` → `{ plan }`.
- `404 Not Found` → plan no existe.
- `409 Conflict` → el plan tiene suscripciones activas; se sugiere desactivar en su lugar.

### Auditoría

Registra `AuditLog` con `accion = PLAN_TOGGLE`.

---

## Errores canónicos

Todos los errores usan el formato:

```json
{
  "error": {
    "message": "...",
    "code": "VALIDATION_ERROR | CONFLICT | NOT_FOUND | ...",
    "details": [ ... ]
  }
}
```
