# Contracts: Colegios · Fase 5 — Estadísticas e informe PDF institucional

## GET /api/colegio/estadisticas

Obtiene el resumen estadístico del colegio del SCHOOL_ADMIN autenticado.

### Auth

- Requiere rol `SCHOOL_ADMIN`.
- El colegio debe estar vigente (validado por `verifyAuth` / proxy).

### Request

```http
GET /api/colegio/estadisticas
```

### Response 200

```json
{
  "colegioId": "string",
  "colegioNombre": "string",
  "totales": {
    "cursos": 0,
    "alumnos": 0,
    "identificadores": 0,
    "alertas": 0
  },
  "porCurso": [
    {
      "cursoId": "string",
      "nombre": "string",
      "alumnos": 0,
      "identificadores": 0,
      "alertas": 0
    }
  ]
}
```

### Response 403

```json
{
  "error": { "message": "No autorizado", "code": "UNAUTHORIZED" }
}
```

---

## GET /api/colegio/estadisticas/pdf

Genera y descarga un PDF con el resumen estadístico del colegio.

### Auth

- Requiere rol `SCHOOL_ADMIN`.

### Request

```http
GET /api/colegio/estadisticas/pdf
```

### Response 200

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="estadisticas-{colegio}-{fecha}.pdf"`

El cuerpo es el archivo PDF en bytes.

### Response 403

```json
{
  "error": { "message": "No autorizado", "code": "UNAUTHORIZED" }
}
```

### Response 500

```json
{
  "error": { "message": "Error interno", "code": "INTERNAL_ERROR" }
}
```

---

## Notas

- Ambos endpoints usan runtime Node (`export const runtime = "nodejs"`).
- El endpoint de PDF registra auditoría `COLEGIO_ESTADISTICAS_PDF_DESCARGADO`.
- No se incluye PII en ninguna respuesta.
