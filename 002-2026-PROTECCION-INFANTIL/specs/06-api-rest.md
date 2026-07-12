# 06 — API REST

## 6.1 Principios Generales

1. **Versionado:** Todas las URLs incluyen versión mayor (`/api/v1/...`). La versión se incrementa solo en cambios breaking.
2. **Formato:** JSON para requests y responses. Charset UTF-8.
3. **Paginación:** Cursor-based para listados grandes, offset-based para listados pequeños (< 1000 registros).
4. **Filtrado:** Query params con notación `campo[operador]=valor` (ej. `status[eq]=ACTIVE`, `createdAt[gte]=2026-01-01`).
5. **Ordenamiento:** Query param `sort=campo:asc` o `sort=campo:desc`. Múltiples campos separados por coma.
6. **Selección de campos:** Query param `fields=campo1,campo2` para reducir payload.
7. **Idioma:** Headers `Accept-Language: es-CO` para localización de mensajes de error.

---

## 6.2 Convenciones HTTP

| Código | Uso |
|--------|-----|
| `200 OK` | Operación exitosa (GET, PUT, PATCH). |
| `201 Created` | Recurso creado exitosamente. Header `Location` con URL del recurso. |
| `202 Accepted` | Solicitud aceptada pero requiere acción adicional (ej. MFA pendiente). |
| `204 No Content` | Operación exitosa sin cuerpo de respuesta (DELETE). |
| `400 Bad Request` | Error de validación del cliente. Body con detalles. |
| `401 Unauthorized` | Falta token o token inválido/expirado. |
| `403 Forbidden` | Token válido pero permisos insuficientes. |
| `404 Not Found` | Recurso no existe. |
| `409 Conflict` | Conflicto de estado (ej. email ya existe, recurso ya modificado). |
| `422 Unprocessable Entity` | Semántica válida pero lógica de negocio rechaza (ej. umbral inválido). |
| `429 Too Many Requests` | Rate limit excedido. Header `Retry-After`. |
| `500 Internal Server Error` | Error inesperado del servidor. |

---

## 6.3 Formato de Errores

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La solicitud contiene errores de validación",
    "details": [
      {
        "field": "email",
        "code": "EMAIL_INVALID",
        "message": "El formato del correo electrónico no es válido"
      },
      {
        "field": "password",
        "code": "PASSWORD_TOO_WEAK",
        "message": "La contraseña debe tener al menos 12 caracteres"
      }
    ],
    "requestId": "req_abc123xyz",
    "timestamp": "2026-07-11T22:15:00Z"
  }
}
```

### Códigos de Error por Dominio

| Prefijo | Dominio |
|---------|---------|
| `AUTH_*` | Autenticación |
| `USR_*` | Usuarios |
| `ROL_*` | Roles y permisos |
| `CFG_*` | Configuración |
| `AUD_*` | Auditoría |
| `VAL_*` | Validación general |
| `RATE_*` | Rate limiting |
| `SEC_*` | Seguridad |

---

## 6.4 Endpoints de Autenticación

### POST /api/v1/auth/register

**Request:**
```json
{
  "email": "padre@ejemplo.com",
  "password": "Segura123!456",
  "name": "Juan Pérez"
}
```

**Response 201:**
```json
{
  "message": "Cuenta creada. Por favor verifica tu correo electrónico.",
  "userId": "cuid_abc123"
}
```

---

### POST /api/v1/auth/login

**Request:**
```json
{
  "email": "padre@ejemplo.com",
  "password": "Segura123!456",
  "totpCode": "123456"
}
```

**Response 200 (sin MFA o con TOTP):**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "uuid-refresh-token-123",
  "expiresIn": 900,
  "tokenType": "Bearer",
  "user": {
    "id": "cuid_abc123",
    "email": "padre@ejemplo.com",
    "name": "Juan Pérez",
    "roles": ["PARENT"],
    "mfaEnabled": true
  }
}
```

**Response 202 (MFA requerido):**
```json
{
  "mfaRequired": true,
  "mfaToken": "eyJhbGciOiJSUzI1NiIs...",
  "message": "Se requiere código de autenticación de doble factor"
}
```

---

### POST /api/v1/auth/refresh

**Request:**
```json
{
  "refreshToken": "uuid-refresh-token-123"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "uuid-refresh-token-456",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

---

### POST /api/v1/auth/logout

**Headers:** `Authorization: Bearer {accessToken}`

**Response 204**

---

### POST /api/v1/auth/logout-all

**Headers:** `Authorization: Bearer {accessToken}`

**Request:**
```json
{
  "password": "Segura123!456"
}
```

**Response 204**

---

### POST /api/v1/auth/forgot-password

**Request:**
```json
{
  "email": "padre@ejemplo.com"
}
```

**Response 202:**
```json
{
  "message": "Si el correo existe, recibirás instrucciones para recuperar tu contraseña."
}
```

---

### POST /api/v1/auth/reset-password

**Request:**
```json
{
  "token": "uuid-reset-token-789",
  "newPassword": "NuevaSegura789!ABC"
}
```

**Response 200:**
```json
{
  "message": "Contraseña actualizada exitosamente."
}
```

---

## 6.5 Endpoints de Usuario

### GET /api/v1/me

**Headers:** `Authorization: Bearer {accessToken}`

**Response 200:**
```json
{
  "id": "cuid_abc123",
  "email": "padre@ejemplo.com",
  "name": "Juan Pérez",
  "emailVerifiedAt": "2026-07-10T14:30:00Z",
  "mfaEnabled": true,
  "roles": ["PARENT"],
  "permissions": ["user:read", "user:write", "report:write", "report:read"],
  "status": "ACTIVE",
  "lastLoginAt": "2026-07-11T20:00:00Z",
  "createdAt": "2026-07-01T10:00:00Z",
  "updatedAt": "2026-07-11T20:00:00Z"
}
```

---

### GET /api/v1/me/capabilities

**Headers:** `Authorization: Bearer {accessToken}`

**Response 200:**
```json
{
  "user": {
    "id": "cuid_abc123",
    "email": "padre@ejemplo.com",
    "roles": ["PARENT"]
  },
  "permissions": {
    "user": ["read", "write"],
    "report": ["read", "write"]
  },
  "features": {
    "canReport": true,
    "canSearch": true,
    "canManageSchool": false,
    "canAdminPlatform": false
  }
}
```

---

### PATCH /api/v1/me

**Headers:** `Authorization: Bearer {accessToken}`

**Request:**
```json
{
  "name": "Juan Antonio Pérez",
  "preferences": {
    "language": "es-CO",
    "timezone": "America/Bogota"
  }
}
```

**Response 200:**
```json
{
  "id": "cuid_abc123",
  "email": "padre@ejemplo.com",
  "name": "Juan Antonio Pérez",
  "preferences": {
    "language": "es-CO",
    "timezone": "America/Bogota"
  },
  "updatedAt": "2026-07-11T22:30:00Z"
}
```

---

### POST /api/v1/me/password

**Headers:** `Authorization: Bearer {accessToken}`

**Request:**
```json
{
  "currentPassword": "Segura123!456",
  "newPassword": "NuevaSegura789!ABC"
}
```

**Response 204**

---

## 6.6 Endpoints de Usuarios (Admin)

### GET /api/v1/users

**Headers:** `Authorization: Bearer {accessToken}`  
**Requiere:** `user:read`

**Query params:**
- `page`, `perPage` (default: 20, max: 100)
- `status[eq]=ACTIVE`
- `role[eq]=PARENT`
- `search=juan` (búsqueda en email y name)
- `sort=createdAt:desc`

**Response 200:**
```json
{
  "data": [
    {
      "id": "cuid_abc123",
      "email": "padre@ejemplo.com",
      "name": "Juan Pérez",
      "status": "ACTIVE",
      "roles": ["PARENT"],
      "createdAt": "2026-07-01T10:00:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "perPage": 20,
    "totalPages": 8
  }
}
```

---

### GET /api/v1/users/:id

**Requiere:** `user:read`

**Response 200:**
```json
{
  "id": "cuid_abc123",
  "email": "padre@ejemplo.com",
  "name": "Juan Pérez",
  "status": "ACTIVE",
  "emailVerifiedAt": "2026-07-10T14:30:00Z",
  "mfaEnabled": false,
  "roles": ["PARENT"],
  "createdAt": "2026-07-01T10:00:00Z",
  "updatedAt": "2026-07-11T20:00:00Z",
  "auditHistory": [
    {
      "action": "USER_LOGIN",
      "createdAt": "2026-07-11T20:00:00Z",
      "ipAddress": "181.143.12.34"
    }
  ]
}
```

---

### PATCH /api/v1/users/:id

**Requiere:** `user:write`

**Request:**
```json
{
  "name": "Juan Pérez Actualizado",
  "status": "ACTIVE",
  "roles": ["PARENT", "SCHOOL_ADMIN"]
}
```

**Response 200**

---

### DELETE /api/v1/users/:id

**Requiere:** `user:delete`

**Comportamiento:** Soft delete. Marca `deletedAt` y cambia `status` a `INACTIVE`.

**Response 204**

---

## 6.7 Endpoints de Roles

### GET /api/v1/roles

**Requiere:** `role:read`

**Response 200:**
```json
{
  "data": [
    {
      "id": "cuid_role1",
      "name": "PLATFORM_ADMIN",
      "description": "Administrador de la plataforma",
      "isSystem": true,
      "permissions": [
        { "resource": "user", "action": "admin" },
        { "resource": "config", "action": "admin" },
        { "resource": "audit", "action": "admin" }
      ]
    },
    {
      "id": "cuid_role2",
      "name": "PARENT",
      "description": "Padre o tutor",
      "isSystem": true,
      "permissions": [
        { "resource": "user", "action": "read" },
        { "resource": "user", "action": "write" }
      ]
    }
  ]
}
```

---

### POST /api/v1/roles

**Requiere:** `role:write`

**Request:**
```json
{
  "name": "MODERATOR",
  "description": "Moderador de reportes",
  "permissions": ["report:read", "report:write"]
}
```

**Response 201**

---

### PUT /api/v1/roles/:id

**Requiere:** `role:write`

**Restricción:** Los roles `isSystem = true` no pueden renombrarse ni eliminarse. Solo se pueden modificar sus permisos.

**Request:**
```json
{
  "description": "Nueva descripción",
  "permissions": ["report:read", "report:write", "report:delete"]
}
```

**Response 200**

---

### DELETE /api/v1/roles/:id

**Requiere:** `role:delete`

**Restricción:** No se pueden eliminar roles `isSystem = true` ni roles que tengan usuarios asignados.

**Response 204**

---

## 6.8 Endpoints de Configuración

*(Ver documento 05-configuracion.md para detalle completo)*

| Método | Endpoint | Auth | Permiso |
|--------|----------|------|---------|
| GET | `/api/v1/config/public` | No | Ninguno |
| GET | `/api/v1/config` | Sí | `config:read` |
| GET | `/api/v1/config/:key` | Sí | `config:read` |
| PUT | `/api/v1/config/:key` | Sí | `config:write` |
| DELETE | `/api/v1/config/:key` | Sí | `config:delete` |
| POST | `/api/v1/config/:key/reset` | Sí | `config:write` |

---

## 6.9 Endpoints de Auditoría

### GET /api/v1/audit/logs

**Requiere:** `audit:read`

**Query params:**
- `userId`, `action`, `resourceType`, `from`, `to`
- `page`, `perPage`

**Response 200:**
```json
{
  "data": [
    {
      "id": "cuid_audit1",
      "userId": "cuid_abc123",
      "userEmail": "padre@ejemplo.com",
      "action": "USER_LOGIN",
      "resourceType": "user",
      "resourceId": "cuid_abc123",
      "metadata": { "method": "password" },
      "ipAddress": "181.143.12.34",
      "userAgent": "Mozilla/5.0...",
      "sessionId": "sess_xyz789",
      "createdAt": "2026-07-11T20:00:00Z"
    }
  ],
  "meta": {
    "total": 5234,
    "page": 1,
    "perPage": 50
  }
}
```

---

### GET /api/v1/audit/logs/export

**Requiere:** `audit:admin`

**Query params:** Mismos filtros que lista.

**Response 200:** `Content-Type: text/csv` con headers:
```csv
id,userId,userEmail,action,resourceType,resourceId,metadata,ipAddress,userAgent,createdAt
```

---

## 6.10 Health Checks

### GET /health

**Auth:** No requiere.

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2026-07-11T22:45:00Z",
  "version": "1.0.0-fundacion"
}
```

### GET /health/ready

**Auth:** No requiere. Usado por orquestador (ECS/K8s) para determinar si aceptar tráfico.

**Response 200:** Si BD y Redis conectados.  
**Response 503:** Si alguna dependencia no responde.

```json
{
  "status": "ready",
  "checks": {
    "database": { "status": "up", "latencyMs": 12 },
    "redis": { "status": "up", "latencyMs": 3 }
  }
}
```

### GET /health/live

**Auth:** No requiere. Usado por orquestador para determinar si reiniciar el pod.

**Response 200:** Siempre que el proceso esté vivo.

```json
{
  "status": "alive"
}
```

---

## 6.11 Métricas

### GET /metrics

**Auth:** No requiere (expuesto en puerto interno, no accesible desde internet).

**Formato:** Prometheus text format.

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/v1/me",status="200"} 1024

# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1",method="GET",route="/api/v1/me"} 950
...
```

---

## 6.12 Headers Requeridos en Todas las Peticiones

| Header | Requerido | Descripción |
|--------|-----------|-------------|
| `Content-Type: application/json` | Sí (POST/PUT/PATCH) | Formato del body. |
| `Accept: application/json` | Sí | Formato de respuesta esperado. |
| `Accept-Language: es-CO` | No | Idioma para mensajes de error. Default: `es-CO`. |
| `X-Request-ID` | No | ID de trazabilidad. Si no se envía, el servidor genera uno. |
| `Authorization: Bearer {token}` | Sí (endpoints protegidos) | Access token JWT. |