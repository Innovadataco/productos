# Contratos de API — SPEC-206

## Autenticación y permisos

- `POST /api/session/ping` requiere cookie `token` con JWT válido (cualquier rol activo).
- `GET /api/admin/sesiones` y `POST /api/admin/sesiones/[id]/cerrar` requieren:
  - JWT de usuario con `rol=ADMIN`.
  - Permiso de módulo `sesiones_admin` (`assertModulo`).
  - Rate-limit `admin_read`.

## POST /api/session/ping

Actualiza `ultimaActividadEn` de la sesión activa del usuario.

### Request
```http
POST /api/session/ping
Cookie: token=<jwt>
```

### Response 200
```json
{ "ok": true }
```

### Response 401
```json
{ "error": { "message": "Sesión cerrada o inválida", "code": "AUTH_INVALID" } }
```

### Response 429
```json
{ "error": { "message": "Demasiados pings", "code": "RATE_LIMITED" } }
```

## GET /api/admin/sesiones

Listado paginado de sesiones activas (`cerradaEn IS NULL`).

### Query params
- `page`: número (default 1)
- `pageSize`: número (default 25, máx 100)

### Response 200
```json
{
  "items": [
    {
      "id": "cm0...",
      "usuarioId": "usr...",
      "email": "admin@example.com",
      "nombre": "Jelkin",
      "rol": "ADMIN",
      "iniciadaEn": "2026-08-22T08:00:00Z",
      "ultimaActividadEn": "2026-08-22T08:25:00Z",
      "duracionMin": 25,
      "ipHash": "a3f...7c2",
      "ipHashCorto": "7c2"
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 3, "totalPages": 1 }
}
```

## POST /api/admin/sesiones/[id]/cerrar

Fuerza el cierre de una sesión activa.

### Response 200
```json
{ "ok": true, "sesionId": "cm0..." }
```

### Response 404
```json
{ "error": { "message": "Sesión no encontrada", "code": "NOT_FOUND" } }
```

### Response 403
```json
{ "error": { "message": "Sin permisos para gestionar sesiones", "code": "FORBIDDEN" } }
```
