# Contract: Seguimiento de reporte por código

**Feature**: specs/023-estados-usuario-sla
**Base Path**: `/api/reportes/seguimiento`

---

## GET /api/reportes/seguimiento/[numero]

Consultar estado visual de un reporte por su número de seguimiento. Sin autenticación.

### Request

- **Path param**: `numero` (string, formato `RPT-XXXXXX`)

### Response 200

```json
{
  "numeroSeguimiento": "RPT-ABC123",
  "estadoVisual": "En proceso | Procesado",
  "estadoInterno": "PENDIENTE",
  "mensaje": "Tu reporte está en proceso — puede tardar hasta 24 horas",
  "slaHoras": 24,
  "creadoEn": "2026-07-18T10:00:00Z",
  "actualizadoEn": "2026-07-18T10:05:00Z"
}
```

**Campos**:
- `estadoVisual`: estado reducido que ve el usuario.
- `estadoInterno`: estado técnico del reporte (solo informativo para diagnóstico, no mostrado en UI pública).
- `mensaje`: mensaje amigable incluyendo SLA.
- `slaHoras`: valor del parámetro `ui.sla_horas_procesamiento`.

### Response 404

```json
{
  "error": {
    "message": "Número de seguimiento no encontrado",
    "code": "NOT_FOUND"
  }
}
```

Se retorna también cuando el reporte existe pero está `eliminado = true`.
