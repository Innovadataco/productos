# Contract: API de Reportes

**Feature**: Módulo de Reportes Comunitarios (fase 2)  
**Base URL**: `http://localhost:5005`  
**Date**: 2026-07-12

---

## POST /api/reportes

Crear un nuevo reporte. Auth opcional (anónimo o autenticado).

### Request

```json
{
  "identificador": "+573001234567",
  "plataforma": "whatsapp",
  "texto": "Este número me contactó por WhatsApp ofreciendo regalos a mi hija de 12 años si enviaba fotos.",
  "fechaIncidente": "2026-07-10T14:30:00Z",
  "ciudad": "Bogotá",
  "pais": "Colombia"
}
```

**Headers**:
- `Content-Type: application/json`
- Cookie `token` (opcional, si autenticado)

**Validaciones**:
- `identificador`: 3–100 caracteres
- `texto`: mínimo 20 caracteres, máximo 5000
- `fechaIncidente`: no futura, no anterior a 5 años
- `plataforma`: debe existir en tabla Plataforma
- Rechazo de multipart/form-data (no se aceptan archivos)

### Response 201 — Created

```json
{
  "reporte": {
    "id": "cmr...",
    "numeroSeguimiento": "RPT-ABC123",
    "estado": "PENDIENTE"
  },
  "mensaje": "Reporte recibido. Tu número de seguimiento es RPT-ABC123."
}
```

### Response 400 — Validation Error

```json
{
  "error": {
    "message": "El texto debe tener al menos 20 caracteres",
    "code": "VALIDATION_ERROR"
  }
}
```

### Response 429 — Duplicado detectado (autenticado)

```json
{
  "error": {
    "message": "Ya reportaste este identificador recientemente",
    "code": "DUPLICATE_REPORT",
    "reporteExistenteId": "cmr..."
  }
}
```

### Response 429 — Rate limit

```json
{
  "error": {
    "message": "Límite de reportes excedido",
    "code": "RATE_LIMITED"
  }
}
```

---

## GET /api/admin/reportes

Listado paginado de reportes para el panel de administrador. Requiere rol ADMIN.

### Request

**Query params**:
- `estado` (opcional): `PENDIENTE`, `PROCESANDO`, `CLASIFICADO`, `REVISION_MANUAL`, `POSIBLE_SPAM`
- `categoria` (opcional): filtrar por categoría de clasificación
- `plataforma` (opcional): filtrar por plataforma
- `page` (opcional): número de página, default 1
- `limit` (opcional): items por página, default 20, max 100
- `orden` (opcional): `recientes`, `antiguos`, `confianza_asc`, `confianza_desc`

**Headers**:
- Cookie `token` (requerido, rol ADMIN)

### Response 200

```json
{
  "reportes": [
    {
      "id": "cmr...",
      "identificador": "+573001234567",
      "plataforma": "WhatsApp",
      "texto": "Este número me contactó...",
      "fechaIncidente": "2026-07-10T14:30:00Z",
      "ciudad": "Bogotá",
      "pais": "Colombia",
      "estado": "CLASIFICADO",
      "esAnonimo": true,
      "clasificacion": {
        "categoria": "OFRECIMIENTO_REGALOS",
        "confianza": 0.87,
        "modeloUsado": "ornith:9b"
      },
      "creadoEn": "2026-07-12T10:00:00Z"
    }
  ],
  "paginacion": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

### Response 403 — Forbidden

```json
{
  "error": {
    "message": "Permisos insuficientes",
    "code": "FORBIDDEN"
  }
}
```

---

## PATCH /api/admin/reportes/[id]/clasificacion

Corregir la clasificación de un reporte. Requiere rol ADMIN.

### Request

```json
{
  "categoria": "SUPLANTACION_IDENTIDAD",
  "motivo": "El texto describe claramente suplantación de identidad, no ofrecimiento de regalos"
}
```

**Headers**:
- `Content-Type: application/json`
- Cookie `token` (requerido, rol ADMIN)

### Response 200

```json
{
  "reporteId": "cmr...",
  "clasificacionOriginal": "OFRECIMIENTO_REGALOS",
  "clasificacionCorregida": "SUPLANTACION_IDENTIDAD",
  "adminId": "cmr...",
  "datasetRegistrado": true
}
```

### Response 404 — Not Found

```json
{
  "error": {
    "message": "Reporte no encontrado",
    "code": "NOT_FOUND"
  }
}
```

---

## POST /api/reportes/procesar

Webhook interno para el worker pg-boss. No expuesto públicamente.

### Request

```json
{
  "reporteId": "cmr...",
  "jobId": "boss-uuid-123"
}
```

**Headers**:
- `Content-Type: application/json`
- `X-Worker-Secret` (validación interna)

### Response 200

```json
{
  "reporteId": "cmr...",
  "estado": "CLASIFICADO",
  "clasificacion": {
    "categoria": "CONTACTO_INSISTENTE",
    "confianza": 0.91
  },
  "latenciaMs": 12450
}
```

### Response 500 — Processing Error

```json
{
  "error": {
    "message": "Error en procesamiento de IA",
    "code": "PROCESSING_ERROR",
    "retryable": true
  }
}
```

---

## PATCH /api/admin/reportes/[id]/anonimizar

El administrador edita el texto de un reporte para eliminar PII de menores. El sistema guarda el texto original en un campo de auditoría de acceso restringido y el texto anonimizado como el texto operativo. Requiere rol ADMIN.

### Request

```json
{
  "textoAnonimizado": "Este número contactó a mi hija ofreciendo regalos si enviaba fotos."
}
```

**Headers**:
- `Content-Type: application/json`
- Cookie `token` (requerido, rol ADMIN)

**Validaciones**:
- `textoAnonimizado`: mínimo 20 caracteres, máximo 5000
- El reporte debe estar en estado `REQUIERE_ANONIMIZACION`
- El admin no puede agregar nueva información personal al texto

### Response 200

```json
{
  "reporteId": "cmr...",
  "estadoAnterior": "REQUIERE_ANONIMIZACION",
  "estadoNuevo": "CLASIFICADO",
  "textoAnonimizado": "Este número contactó a mi hija ofreciendo regalos si enviaba fotos.",
  "piiEliminada": ["María", "colegio San José"]
}
```

**Business rules**:
- `textoOriginal` se preserva en el campo de auditoría (nunca expuesto en APIs públicas)
- `texto` se actualiza con el valor anonimizado
- El reporte pasa a estado `CLASIFICADO`
- Solo el texto anonimizado alimenta `DatasetEntrenamiento` y las consultas

### Response 400 — Invalid state

```json
{
  "error": {
    "message": "El reporte no requiere anonimización",
    "code": "INVALID_STATE"
  }
}
```

### Response 404 — Not Found

```json
{
  "error": {
    "message": "Reporte no encontrado",
    "code": "NOT_FOUND"
  }
}
```

---

## GET /api/reportes/seguimiento/[numero]

Consultar estado de un reporte por número de seguimiento. Sin autenticación.

### Response 200

```json
{
  "numeroSeguimiento": "RPT-ABC123",
  "estado": "CLASIFICADO",
  "creadoEn": "2026-07-12T10:00:00Z",
  "mensaje": "Tu reporte ha sido procesado y clasificado."
}
```

### Response 404

```json
{
  "error": {
    "message": "Número de seguimiento no encontrado",
    "code": "NOT_FOUND"
  }
}