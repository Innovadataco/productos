# Contract: Spam pendientes

**Feature**: specs/026-pipeline-spam-prioridad
**Base Path**: `/api/admin/spam`

---

## GET /api/admin/spam/pendientes

Lista reportes clasificados como posible spam esperando revisión humana.

### Request

**Headers**:
- Cookie `token` (rol OPERADOR, COMITE_VALIDACION o ADMIN)

**Query params** (opcional):
- `page`, `limit`
- `asignadoAMi`: boolean (filtrar solo los asignados al operador autenticado)

### Response 200

```json
{
  "reportes": [
    {
      "id": "cmr...",
      "identificador": "3009998888",
      "plataforma": "whatsapp",
      "texto": "Compra relojes baratos viagra cripto dinero fácil 100% gratis",
      "estado": "POSIBLE_SPAM",
      "confianzaSpam": 0.92,
      "creadoEn": "2026-07-18T10:00:00Z",
      "asignadoA": null
    }
  ],
  "paginacion": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

### Response 403

```json
{
  "error": {
    "message": "Requiere rol OPERADOR, COMITE_VALIDACION o ADMIN",
    "code": "FORBIDDEN"
  }
}
```

**Nota**: la respuesta no incluye datos del denunciante ni `textoOriginal`.
