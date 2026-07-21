# Contracts — Spec 079: Colegio acceso y auditoría

## Parte 2 — Gestión de acceso

### POST /api/admin/colegios/[id]/regenerar-password

**Auth**: ADMIN only.

**Request**: `POST /api/admin/colegios/{id}/regenerar-password`
- Sin body.

**Response 200**:
```json
{
  "adminColegio": {
    "id": "cm...",
    "email": "admin@colegio.edu",
    "nombre": "Admin Colegio",
    "estado": "activo",
    "debeCambiarPassword": true
  },
  "passwordTemporal": "a1b2c3d4e5f6",
  "mensaje": "Contraseña temporal regenerada. Muéstrela una vez al administrador del colegio."
}
```

**Response 404**: Colegio no encontrado o sin SCHOOL_ADMIN.
**Response 403**: Usuario no es ADMIN.
**Response 429**: Rate limit.

---

### POST /api/admin/colegios/[id]/reenviar-email

**Auth**: ADMIN only.

**Request**: `POST /api/admin/colegios/{id}/reenviar-email`
- Sin body.

**Response 200**:
```json
{
  "adminColegio": {
    "id": "cm...",
    "email": "admin@colegio.edu",
    "nombre": "Admin Colegio",
    "estado": "activo",
    "debeCambiarPassword": true
  },
  "passwordTemporal": "a1b2c3d4e5f6",
  "emailEnviado": true,
  "mensaje": "Email de bienvenida reenviado al administrador del colegio."
}
```

Si el envío falla:
```json
{
  "adminColegio": { ... },
  "passwordTemporal": "a1b2c3d4e5f6",
  "emailEnviado": false,
  "mensaje": "No se pudo reenviar el email. Copie la contraseña temporal mostrada arriba."
}
```

**Response 404**: Colegio no encontrado o sin SCHOOL_ADMIN.
**Response 403**: Usuario no es ADMIN.
**Response 429**: Rate limit.

---

## Parte 3 — Auditoría del colegio

### GET /api/colegio/auditoria

**Auth**: SCHOOL_ADMIN only.

**Query params** (mismo schema que `/api/admin/audit-logs`):
- `page` (number, default 1)
- `pageSize` (number, default 20, max 100)
- `acciones` (array de AccionAudit, opcional)
- `recursoId` (string, opcional)
- `q` (string, opcional)
- `fechaDesde` (YYYY-MM-DD, opcional)
- `fechaHasta` (YYYY-MM-DD, opcional)

**Response 200**:
```json
{
  "items": [
    {
      "id": "cm...",
      "accion": "COLEGIO_CURSO_CREADO",
      "tipoRecurso": "Curso",
      "recursoId": "cm...",
      "usuarioId": "cm...",
      "colegioId": "cm...",
      "creadoEn": "2026-07-21T12:00:00.000Z",
      "usuario": { "nombre": "Admin Colegio", "email": "admin@colegio.edu" }
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

**Response 403**: Usuario no es SCHOOL_ADMIN o no tiene colegio asignado.
**Response 429**: Rate limit.

### Filtro implícito

El endpoint siempre filtra `accion` a `COLEGIO_*` y `colegioId` al colegio del usuario autenticado, sin importar los parámetros enviados.
