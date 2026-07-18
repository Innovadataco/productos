# Contract: Revelar texto original

**Feature**: specs/025-anonimizacion-reforzada
**Base Path**: `/api/admin/reportes`

---

## POST /api/admin/reportes/[id]/revelar-original

Revela el texto original cifrado de un reporte. Requiere permiso explícito y deja audit log.

### Request

**Headers**:
- Cookie `token` (rol ADMIN)

**Body**: vacío o `{ "motivo": "Investigación interna autorizada" }`

### Response 200

```json
{
  "reporteId": "cmr...",
  "textoOriginal": "Mi hija María estudia en el colegio San José y recibió mensajes de este número.",
  "reveladoEn": "2026-07-18T10:35:00Z",
  "auditLogId": "cmr..."
}
```

### Response 403

```json
{
  "error": {
    "message": "No autorizado para revelar el texto original",
    "code": "FORBIDDEN"
  }
}
```

### Response 404

```json
{
  "error": {
    "message": "Reporte no encontrado o sin texto original",
    "code": "NOT_FOUND"
  }
}
```

**Nota**: cada llamada exitosa genera `AuditLog` con `accion = TEXTO_ORIGINAL_REVELADO`.
