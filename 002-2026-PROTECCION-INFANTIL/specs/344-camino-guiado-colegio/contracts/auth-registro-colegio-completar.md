# Contract · POST /api/auth/registro-colegio/completar

**Purpose**: consumir el token de enlace, fijar contraseña, crear
Tenant+Colegio+Usuario(SCHOOL_ADMIN), sembrar 11 cursos, sellar cookie de
estado y enviar bienvenida.

## Request

```
POST /api/auth/registro-colegio/completar
Content-Type: application/json

{
  "token":     "<opaco 64 chars>",
  "password":  "<8+ chars, ambas condiciones>",
  "nombreColegio": "Colegio Sagrado Corazón",
  "nit":       "901.455.302-7"
}
```

Nota: `nombreColegio` y `nit` se pasan aquí también porque el token solo
guarda `email` (no confía en el cliente del solicitar). El servidor
re-verifica anti-colisión: si otro colegio ya reclamó el NIT entre
`solicitar` y `completar` → 409 `nit_ya_registrado` (raro pero posible).

## Response

**201 Created**:

```json
{
  "ok": true,
  "usuario": { "id": "cmt…", "rol": "SCHOOL_ADMIN", "email": "…" },
  "colegio": { "id": "cmt…", "nombre": "…", "nit": "…" },
  "redirectTo": "/camino/colegio/rector"
}
```

Además:
- Cookies: `token`, `__Host-token` (JWT sesión) y `sesion_estado` (firmada
  con `pasoCamino: "rector"`) — sellado vía `sellarCookieSesionEstado`.
- Motor: emite `colegio.bienvenida_rector` (plantilla nueva).
- Auditoría: `AuditLog { accion: "colegio.registro_completado", entidad:
  "Colegio", entidadId, actorId }`.

## Errores

- 400 `datos_invalidos` — password no cumple ambas condiciones.
- 409 `email_existente` — el email del token ya tiene cuenta (race).
- 409 `nit_ya_registrado` — el NIT lo reclamó otro colegio entre solicitar
  y completar.
- 410 `enlace_invalido` — token no existe, ya usado o vencido; incluye
  `{urlSolicitar: "/registro-colegio"}` para el mensaje sereno.

## Efectos secundarios (todos en una `withUnitOfWork`)

1. Marca `TokenRegistro.usado = true` (single-use).
2. Crea `Tenant`, `Colegio`, `Usuario`(SCHOOL_ADMIN) — reusa
   `crearColegioMinimo`.
3. Siembra 11 cursos por defecto (`crearCursosPorDefecto`).
4. Siembra 15 materias por defecto (`seedMateriasPorDefecto`, ya existente).
5. Crea fila `OnboardingColegio` (compatibilidad; queda inactiva).
6. Fuera de la transacción (fail-tolerant): emite bienvenida.

## Contrato inalterado del padre

`/api/auth/registro/completar` NO se toca. `RegistroEnlaceService.completar`
gana un parámetro `rol?: RolUsuario` con default `"PARENT"` — el padre no
cambia.
