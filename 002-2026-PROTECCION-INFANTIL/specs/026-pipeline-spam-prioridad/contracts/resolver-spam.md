# Contract: Resolver spam

**Feature**: specs/026-pipeline-spam-prioridad
**Base Path**: `/api/admin/spam`

---

## POST /api/admin/spam/[id]/resolver

Operador resuelve si un reporte marcado como posible spam es realmente spam o es un reporte válido.

### Request

```json
{
  "esSpam": true,
  "motivo": "Contenido promocional sin relación con protección infantil"
}
```

o

```json
{
  "esSpam": false,
  "categoria": "OTRO",
  "motivo": "El texto es ambiguo pero describe una interacción sospechosa"
}
```

**Headers**:
- Cookie `token` (rol OPERADOR, COMITE_VALIDACION o ADMIN)

### Response 200 — Confirmado spam

```json
{
  "reporteId": "cmr...",
  "estado": "DADO_DE_BAJA",
  "motivoBaja": "RETIRO_LIMPIEZA",
  "datasetRegistrado": true
}
```

### Response 200 — Reporte válido

```json
{
  "reporteId": "cmr...",
  "estado": "CLASIFICADO",
  "categoria": "OTRO"
}
```

### Response 403

```json
{
  "error": {
    "message": "Solo el operador asignado o un admin puede resolver",
    "code": "FORBIDDEN"
  }
}
```

### Response 400 — Estado inválido

```json
{
  "error": {
    "message": "El reporte no está en revisión de spam",
    "code": "INVALID_STATE"
  }
}
```
