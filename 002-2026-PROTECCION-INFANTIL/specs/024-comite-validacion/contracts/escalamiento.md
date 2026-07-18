# Contract: Escalamiento al comité

**Feature**: specs/024-comite-validacion
**Base Path**: `/api/admin/reportes`

---

## POST /api/admin/reportes/[id]/escalar

Operador escala un caso al comité. Requiere rol OPERADOR y que el reporte esté asignado al operador.

### Request

```json
{
  "motivo": "Contenido ambiguo; necesita segunda opinión especializada"
}
```

**Headers**:
- Cookie `token` (rol OPERADOR)

### Response 201

```json
{
  "solicitudId": "cmr...",
  "numero": "SOL-ABC123",
  "reporteId": "cmr...",
  "estado": "PENDIENTE"
}
```

### Response 403

```json
{
  "error": {
    "message": "Solo el operador asignado puede escalar este caso",
    "code": "FORBIDDEN"
  }
}
```

---

## POST /api/admin/comite/[id]/asignar

Miembro del comité se auto-asigna (o admin asigna) una solicitud pendiente.

### Request

```json
{
  "comiteId": "cmr..."  // opcional si es auto-asignación del usuario autenticado
}
```

**Headers**:
- Cookie `token` (rol COMITE_VALIDACION o ADMIN)

### Response 200

```json
{
  "solicitudId": "cmr...",
  "numero": "SOL-ABC123",
  "estado": "ASIGNADA",
  "comiteId": "cmr..."
}
```

---

## POST /api/admin/comite/[id]/resolver

Comité resuelve una solicitud asignada.

### Request

```json
{
  "accion": "CLASIFICAR | CORREGIR",
  "categoria": "SOLICITUD_ENCUENTRO",
  "resolucion": "El contenido es claramente una solicitud de encuentro con un menor"
}
```

### Response 200

```json
{
  "solicitudId": "cmr...",
  "numero": "SOL-ABC123",
  "estado": "RESUELTA",
  "reporte": {
    "id": "cmr...",
    "estado": "CLASIFICADO",
    "categoria": "SOLICITUD_ENCUENTRO"
  }
}
```

### Response 403

```json
{
  "error": {
    "message": "Solo el miembro del comité asignado puede resolver",
    "code": "FORBIDDEN"
  }
}
```
