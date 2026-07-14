# UI-API Contracts: Frontend Público

**Date**: 2026-07-13
**Feature**: specs/003-frontend-publico/spec.md

## Contracts Consumed by Frontend

### GET /api/consulta

**Request**: Query params `identificador`, `plataforma`

**Response 200 — Visible**:
```json
{
  "identificador": "+573001234567",
  "plataforma": "WhatsApp",
  "tieneReportes": true,
  "totalReportes": 5,
  "reportesAutenticados": 3,
  "reportesAnonimos": 2,
  "ultimoReporte": "2026-07-10T14:30:00Z",
  "distribucion": {
    "porCiudad": { "Bogotá": 3, "Medellín": 2 },
    "porPais": { "Colombia": 5 },
    "porMes": { "2026-07": 5 }
  }
}
```

**Response 200 — No visible**:
```json
{
  "identificador": "+573001234567",
  "tieneReportes": false,
  "mensaje": "Sin reportes registrados para este identificador."
}
```

### POST /api/reportes

**Request**:
```json
{
  "identificador": "+573001234567",
  "plataforma": "whatsapp",
  "texto": "Descripción de la conducta...",
  "fechaIncidente": "2026-07-10T14:30:00Z",
  "ciudad": "Bogotá",
  "pais": "Colombia"
}
```

**Response 201**:
```json
{
  "reporte": {
    "id": "cmr...",
    "numeroSeguimiento": "RPT-XXXXXX",
    "estado": "PENDIENTE"
  },
  "mensaje": "Reporte recibido. Tu número de seguimiento es RPT-XXXXXX."
}
```

### GET /api/reportes/seguimiento/[numero]

**Response 200**:
```json
{
  "numeroSeguimiento": "RPT-XXXXXX",
  "estado": "CLASIFICADO",
  "creadoEn": "2026-07-10T14:30:00Z",
  "mensaje": "Tu reporte ha sido procesado y clasificado."
}
```

### POST /api/auth/login

**Request**:
```json
{ "email": "parent@ejemplo.com", "password": "Password123!" }
```

**Response 200**: Set cookie httpOnly `token`
```json
{ "user": { "id": "...", "email": "...", "nombre": "...", "rol": "PARENT" } }
```

### POST /api/auth/register

**Request**:
```json
{ "email": "...", "password": "...", "nombre": "..." }
```

### POST /api/auth/verificar/solicitar

**Request**: `{ "email": "..." }`
**Response 202**: Código enviado por email

### POST /api/auth/verificar/completar

**Request**: `{ "email": "...", "codigo": "123456", "password": "...", "nombre": "..." }`
**Response 201**: Cuenta creada

### POST /api/auth/logout

**Response 200**: Cookie `token` eliminada

### GET /api/me

**Response 200**:
```json
{ "id": "...", "email": "...", "nombre": "...", "rol": "PARENT" }
```

### NEW: GET /api/reportes/mis-reportes

**Query**: `?page=1&pageSize=25`

**Response 200**:
```json
{
  "items": [
    {
      "id": "cmr...",
      "identificador": "+573001234567",
      "plataforma": "WhatsApp",
      "estado": "CLASIFICADO",
      "estadoVisual": "Compartido con autoridades",
      "creadoEn": "2026-07-10T14:30:00Z",
      "esAnonimo": false
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 5, "totalPages": 1 }
}
```

**Mapping estado → estadoVisual**:
| Estado técnico | Texto UI |
|----------------|----------|
| PENDIENTE | Recibido |
| PROCESANDO | En procesamiento |
| CLASIFICADO | Procesado |
| REVISION_MANUAL | En revisión |
| POSIBLE_SPAM | En revisión |
| REQUIERE_ANONIMIZACION | En revisión de privacidad |
| CORREGIDO | Procesado |
| DUPLICADO | Vinculado a reporte existente |

## State Mapping (Frontend-only)

No expone nuevas APIs al exterior; consume las existentes.