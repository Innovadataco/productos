# Contracts: Módulo Colegios — Fase 1: Fundación (Spec 074)

**Date**: 2026-07-21
**Feature**: specs/074-colegios-fundacion/spec.md

---

## Authentication & Session

### POST /api/auth/login

**Change**: vigencia del servicio para SCHOOL_ADMIN.

**Request** (sin cambios):
```json
{
  "email": "string",
  "password": "string"
}
```

**Response 200** (sin cambios para roles vigentes):
```json
{
  "user": {
    "id": "string",
    "email": "string",
    "nombre": "string",
    "rol": "SCHOOL_ADMIN",
    "debeCambiarPassword": true
  }
}
```

**Response 401** (servicio no vigente):
```json
{
  "error": {
    "message": "Servicio no vigente, contacte al administrador",
    "code": "SERVICIO_NO_VIGENTE"
  }
}
```

---

## Colegios (admin only)

### GET /api/admin/colegios

**Auth**: ADMIN only.

**Query params**:
- `page` (default 1)
- `pageSize` (default 25, max 100)
- `estado` (optional, `activo`/`inactivo`)
- `q` (optional, búsqueda por nombre)

**Response 200**:
```json
{
  "colegios": [
    {
      "id": "string",
      "nombre": "string",
      "paisId": "string",
      "departamentoId": "string?",
      "ciudadId": "string",
      "direccion": "string?",
      "representanteLegalNombre": "string",
      "representanteLegalIdentificacion": "string",
      "representanteLegalEmail": "string",
      "representanteLegalTelefono": "string?",
      "inicioServicio": "2026-01-01T00:00:00Z",
      "finServicio": "2026-12-31T00:00:00Z?",
      "tipoPeriodo": "MENSUAL|SEMESTRAL|ANUAL",
      "estado": "activo|inactivo",
      "tenantId": "string",
      "admin": {
        "id": "string",
        "email": "string",
        "nombre": "string"
      },
      "creadoEn": "2026-07-21T00:00:00Z",
      "actualizadoEn": "2026-07-21T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 100,
    "totalPages": 4
  }
}
```

---

### POST /api/admin/colegios

**Auth**: ADMIN only.

**Request**:
```json
{
  "nombre": "string",
  "paisId": "string",
  "departamentoId": "string?",
  "ciudadId": "string",
  "direccion": "string?",
  "representanteLegalNombre": "string",
  "representanteLegalIdentificacion": "string",
  "representanteLegalEmail": "string",
  "representanteLegalTelefono": "string?",
  "inicioServicio": "2026-01-01T00:00:00Z",
  "finServicio": "2026-12-31T00:00:00Z",
  "tipoPeriodo": "MENSUAL|SEMESTRAL|ANUAL",
  "emailAdmin": "string",
  "nombreAdmin": "string"
}
```

**Response 201**:
```json
{
  "colegio": { /* objeto Colegio */ },
  "admin": {
    "id": "string",
    "email": "string",
    "nombre": "string",
    "rol": "SCHOOL_ADMIN"
  },
  "passwordTemporal": "string",
  "emailEnviado": true,
  "mensaje": "Colegio creado. Se envió la contraseña temporal por email."
}
```

**Response 409** (email duplicado):
```json
{
  "error": { "message": "Ya existe un usuario con ese email", "code": "VALIDATION_ERROR" }
}
```

---

### GET /api/admin/colegios/[id]

**Auth**: ADMIN only.

**Response 200**: objeto Colegio con `admin` incluido.

---

### PATCH /api/admin/colegios/[id]

**Auth**: ADMIN only.

**Request** (todos opcionales):
```json
{
  "nombre": "string?",
  "departamentoId": "string?",
  "ciudadId": "string?",
  "direccion": "string?",
  "representanteLegalNombre": "string?",
  "representanteLegalIdentificacion": "string?",
  "representanteLegalEmail": "string?",
  "representanteLegalTelefono": "string?",
  "inicioServicio": "2026-01-01T00:00:00Z?",
  "finServicio": "2026-12-31T00:00:00Z?",
  "tipoPeriodo": "MENSUAL|SEMESTRAL|ANUAL?"
}
```

**Response 200**: objeto Colegio actualizado.

**Note**: no se permite cambiar `paisId` en esta fase para evitar inconsistencias de ubicación.

---

### PATCH /api/admin/colegios/[id]/activar

**Auth**: ADMIN only.

**Response 200**: objeto Colegio con `estado = activo`.

---

### PATCH /api/admin/colegios/[id]/desactivar

**Auth**: ADMIN only.

**Response 200**: objeto Colegio con `estado = inactivo`.

---

### PATCH /api/admin/colegios/[id]/regenerar-password

**Auth**: ADMIN only.

**Response 200**:
```json
{
  "passwordTemporal": "string",
  "emailEnviado": true,
  "mensaje": "Contraseña regenerada y enviada por email."
}
```

---

### POST /api/admin/colegios/[id]/reenviar-email

**Auth**: ADMIN only.

**Response 200**:
```json
{
  "emailEnviado": true,
  "mensaje": "Email de bienvenida reenviado."
}
```

---

## Me (SCHOOL_ADMIN)

### GET /api/me/colegio

**Auth**: SCHOOL_ADMIN only.

**Response 200**:
```json
{
  "colegio": { /* objeto Colegio */ }
}
```

**Response 403** (no es SCHOOL_ADMIN o no tiene colegio):
```json
{
  "error": { "message": "Permisos insuficientes", "code": "FORBIDDEN" }
}
```

**Response 403** (servicio no vigente):
```json
{
  "error": { "message": "Servicio no vigente, contacte al administrador", "code": "SERVICIO_NO_VIGENTE" }
}
```

---

## Reportes (restricción)

### POST /api/reportes

**Auth**: anónimo o PARENT. SCHOOL_ADMIN no permitido.

**Response 403** (SCHOOL_ADMIN):
```json
{
  "error": { "message": "La cuenta institucional no puede crear reportes. Use la vía anónima o una cuenta personal.", "code": "FORBIDDEN" }
}
```

---

## Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Datos inválidos |
| `AUTH_INVALID` | 401 | Credenciales inválidas o no autenticado |
| `FORBIDDEN` | 403 | Sin permisos |
| `SERVICIO_NO_VIGENTE` | 401/403 | Colegio fuera de vigencia o inactivo |
| `NOT_FOUND` | 404 | Colegio no encontrado |
| `CONFLICT` | 409 | Email duplicado o colegio con admin existente |
| `INTERNAL_ERROR` | 500 | Error interno |
| `RATE_LIMITED` | 429 | Demasiadas solicitudes |
