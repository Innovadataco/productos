# Contratos de endpoints: SPEC-189

## `GET /api/admin/operadores/[id]/metricas`

**Auth**: ADMIN, módulo `operadores`.

### Response 200

```json
{
  "casosAbiertos": [
    {
      "id": "rep_xxx",
      "numeroSeguimiento": "RPT-123456",
      "identificador": "+573001234567",
      "plataformaClave": "whatsapp",
      "plataformaNombre": "WhatsApp",
      "categoria": "grooming",
      "estado": "REVISION_MANUAL",
      "asignadoEn": "2026-08-19T10:00:00.000Z",
      "tiempoDesdeAsignacionMs": 3600000
    }
  ],
  "casosResueltos24h": 2,
  "casosResueltos7d": 8,
  "casosResueltos30d": 25,
  "tiempoMedioResolucionMs": 5400000,
  "casosPorCategoria": [
    { "categoria": "grooming", "total": 12 },
    { "categoria": "ciberacoso", "total": 8 }
  ],
  "tasaEscalamientoComite": 0.12
}
```

### Response 404

```json
{ "error": { "message": "Operador no encontrado", "code": "NOT_FOUND" } }
```

### Response 400 (rol no OPERADOR)

```json
{ "error": { "message": "La ficha de operador solo aplica a usuarios con rol OPERADOR", "code": "ROL_INVALIDO" } }
```

## `GET /api/admin/operadores/[id]/casos?estado=&page=`

**Auth**: ADMIN, módulo `operadores`.

### Response 200

```json
{
  "items": [
    {
      "id": "rep_xxx",
      "numeroSeguimiento": "RPT-123456",
      "identificador": "+573001234567",
      "plataformaClave": "whatsapp",
      "plataformaNombre": "WhatsApp",
      "estado": "REVISION_MANUAL",
      "categoria": "grooming",
      "asignadoEn": "2026-08-19T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 42,
    "totalPages": 2
  }
}
```
