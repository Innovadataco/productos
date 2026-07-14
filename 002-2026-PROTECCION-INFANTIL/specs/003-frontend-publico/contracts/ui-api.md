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
      "estadoVisual": "Procesado",
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

### NEW: GET /api/plataformas

**Query**: `?activas=true` (opcional, default true)

**Response 200**:
```json
{
  "plataformas": [
    { "id": "cmr...", "clave": "whatsapp", "nombre": "WhatsApp", "categoria": "mensajeria" },
    { "id": "cmr...", "clave": "roblox", "nombre": "Roblox", "categoria": "juego" },
    { "id": "cmr...", "clave": "minecraft", "nombre": "Minecraft", "categoria": "juego" },
    { "id": "cmr...", "clave": "otro", "nombre": "Otra", "categoria": "otro" }
  ]
}
```

**Reglas**:
- Solo plataformas con `esActivo = true`
- Ordenadas alfabéticamente por `nombre`
- `"otro"` siempre incluido al final

---

### NEW: GET /api/paises

**Response 200**:
```json
{
  "paises": [
    { "id": "cmr...", "codigo": "CO", "nombre": "Colombia" },
    { "id": "cmr...", "codigo": "MX", "nombre": "México" }
  ]
}
```

**Reglas**:
- Solo países con `esActivo = true`
- Ordenados alfabéticamente por `nombre`

---

### NEW: GET /api/ciudades

**Query**: `?paisId={paisId}` (requerido)

**Response 200**:
```json
{
  "ciudades": [
    { "id": "cmr...", "nombre": "Bogotá", "paisId": "cmr..." },
    { "id": "cmr...", "nombre": "Medellín", "paisId": "cmr..." }
  ]
}
```

**Response 400**: Falta `paisId`

**Reglas**:
- Solo ciudades del país solicitado con `esActivo = true`
- Ordenadas alfabéticamente por `nombre`
- Incluye una ciudad virtual `"Otra ciudad o municipio"` con `id = "otra"` al final

---

### POST /api/reportes (ampliado)

**Request** (campos nuevos opcionales):
```json
{
  "identificador": "+573001234567",
  "plataforma": "whatsapp",
  "otraPlataforma": "Signal",
  "texto": "Descripción...",
  "fechaIncidente": "2026-07-10T14:30:00Z",
  "ciudad": "Bogotá",
  "pais": "Colombia",
  "ciudadId": "cmr...",
  "paisId": "cmr..."
}
```

**Reglas de mapeo**:
- Si `plataforma === "otro"`, `otraPlataforma` es obligatorio y se guarda en `Reporte.otraPlataforma`
- Si `ciudadId` es `"otra"` o no se envía, se usa el string `ciudad` (texto libre)
- `fechaIncidente` debe ser ≤ hoy (validación Zod en backend)

## State Mapping (Frontend-only)

No expone nuevas APIs al exterior; consume las existentes.
