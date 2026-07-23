# Contracts — 019-permisos-modulos

> Contratos verificados contra `src/app/api/admin/permisos-modulos/route.ts` y
> `src/lib/permisos-modulos.ts`.

## GET /api/admin/permisos-modulos

Matriz completa de permisos. Solo `ADMIN`. Rate limit `admin_read`.

**Response 200**:

```jsonc
{
  "roles": ["ADMIN", "SCHOOL_ADMIN", "OPERADOR", "COMITE_VALIDACION", "PARENT", "..."], // enum ∪ datos
  "rolesProtegidos": ["ADMIN"],           // de seguridad.permisos_roles_protegidos
  "modulos": [                             // raíces con sus submódulos, orden asc
    {
      "id": "...", "clave": "colegios", "nombre": "Colegios",
      "descripcion": null, "padreId": null, "categoria": "colegio",
      "esCritico": false, "orden": 60,
      "submodulos": [{ "id": "...", "clave": "colegios_auditoria", "padreId": "...", "...": "..." }]
    }
  ],
  "permisos": [{ "rol": "ADMIN", "moduloId": "...", "activo": true }]
}
```

Errores: 401 sin sesión · 403 no-ADMIN · 429 rate limit.

## PATCH /api/admin/permisos-modulos

Aplica cambios de permisos por rol. Solo `ADMIN`. Rate limit `admin_write`.

**Request**:

```jsonc
{
  "cambios": [
    { "rol": "OPERADOR", "moduloId": "...", "activo": false }  // 1..100 items
  ]
}
```

**Response 200**: `{ "actualizados": 1 }`

**Errores**:

| Status | Condición |
|---|---|
| 400 | Body inválido (Zod) |
| 400 | Rol desconocido: `"Roles desconocidos: ADMN. Roles válidos: ..."` — no crea fila fantasma |
| 400 | `moduloId` inexistente |
| 401/403 | Sin sesión / no-ADMIN |
| 409 | Anti-lockout: dejaría a todos los roles protegidos sin un módulo `esCritico` |
| 429 | Rate limit |

Efectos: upsert por `(rol, moduloId)` en transacción; `actualizadoPorId` = admin;
`AuditLog` acción `PERMISOS_MODULO_ACTUALIZADOS` con `valorAnterior` (snapshot de filas
afectadas) y `valorNuevo` (cambios aplicados).

## Guard de módulo (contrato interno)

```ts
assertModulo(user, clave): Promise<user>   // src/lib/permisos-modulos.ts
requireModulo(request, clave): Promise<user>
puedeAccederAModulo(rol, clave): Promise<boolean>
```

- Sin fila o `activo=false` → `AppError("Sin acceso al módulo", FORBIDDEN, 403)`.
- Submódulo: exige `activo` propio AND `activo` del padre.
- Clave inexistente en catálogo → denegado.

## Guardado implícito de compatibilidad

Los endpoints protegidos conservan su `verifyAuth(rol)` previo: el permiso de módulo es
capa ADICIONAL. Un rol sin filas en `PermisoModulo` queda denegado por defecto en las
rutas con guard.
