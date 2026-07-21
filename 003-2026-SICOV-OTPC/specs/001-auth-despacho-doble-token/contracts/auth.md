# Contrato — Autenticación (P1)

> Diseño de la API de auth del 003 sobre **Next.js App Router**. Paridad funcional con el legacy (`POST /api/v1/autenticacion/inicio-sesion`, `cambiar-clave`, `envio-email`), con una **desviación deliberada de arquitectura**: la sesión se maneja con **cookie httpOnly** (estándar de fábrica 002), no con múltiples claves en `localStorage` como el Angular legacy. Los tokens externos (integradora) no se exponen al cliente.

## Roles
`1` Administrador · `2` Cliente/empresa vigilada · `3` Operador/subusuario · `9` Especial (ve todas las placas).

---

## POST /api/auth/login
Login único usuario/contraseña. **No existe login por token de "vigía"** (desviación del demo, eliminada).

**Request** `application/json`
```json
{ "usuario": "string", "contrasena": "string" }
```

**Proceso**
1. Rate-limit / verificación de bloqueo por `tbl_bloqueo_usuarios` (`blu_identificacion`, `blu_intentos_fallidos`, `blu_bloqueado`).
2. Buscar usuario por `usn_usuario` (o `usn_identificacion`); verificar `usn_estado = true`.
3. `bcrypt.compare(contrasena, usn_clave)`.
4. En fallo: incrementar `blu_intentos_fallidos`; al superar umbral → `blu_bloqueado = true`. Respuesta genérica (no revelar si falló usuario o clave).
5. En éxito: resetear contador; si `usn_rol_id = 3` → resolver `administrador` (`usn_administrador`) y calcular **contexto efectivo** `{ nitEfectivo = admin.usn_identificacion, tokenAutorizadoEfectivo = admin.usn_token_autorizado }`; en otros roles, los propios.
6. Firmar JWT interno (jose HS256) con payload `{ sub: usn_id, rol: usn_rol_id, nit: nitEfectivo }` y set cookie httpOnly.
7. Cargar módulos habilitados (`roles_modulos` + `usuarios_modulos`) para el menú.

**Response 200** `application/json` (el `tokenExterno`/`tokenAutorizado` NO viajan al cliente)
```json
{
  "usuario": { "id": 1, "nombre": "…", "usuario": "…", "rol": 2, "identificacion": "900…" },
  "claveTemporal": false,
  "modulos": [ { "id": 1, "nombre": "Inicio", "ruta": "/dashboard", "icono": "bi-house-door", "submodulos": [] } ]
}
```
- `Set-Cookie: token=<jwt>; HttpOnly; SameSite=…; Path=/` (secure según `COOKIE_SECURE`).

**Errores**
| Status | Caso |
|---|---|
| 400 | falta `usuario` o `contrasena` |
| 401 | credenciales inválidas / usuario inactivo (mensaje genérico "Usuario o clave incorrectos") |
| 423 | cuenta bloqueada por intentos fallidos |
| 429 | rate limit |
| 500 | error interno (**nunca** cae a "login demo"; corrige Bug 3) |

**Regla anti-bug:** ante 5xx del backend, el cliente propaga el error real; **jamás** inicia sesión con datos demo.

---

## POST /api/auth/cambiar-clave
Cambio de contraseña (obligatorio si `claveTemporal = true`; también voluntario).

**Request**
```json
{ "claveActual": "string", "nuevaClave": "string" }
```
(el `identificacion` se toma de la sesión, no del body)

**Política de contraseña (confirmada del legacy)** — regex:
`^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$`
Mínimo 8, al menos una minúscula, una mayúscula, un dígito y un carácter especial. El cliente muestra checklist en vivo (5 criterios).

**Proceso:** verificar sesión → `bcrypt.compare(claveActual, usn_clave)` → validar política → `usn_clave = bcrypt.hash(nuevaClave, 12)`, `usn_clave_temporal = false`.

**Response 200** `{ "ok": true }`
**Errores:** 400 (política no cumplida), 401 (no autenticado / clave actual incorrecta), 500.

---

## POST /api/auth/recuperar
Genera clave temporal y la envía por correo (paridad con `envio-email`). En P1 el envío de correo puede quedar **tras interfaz stub** (no bloquea el core).

**Request** `{ "usuario": "string", "correo": "string" }`
**Proceso:** validar usuario+correo → generar clave temporal → `usn_clave = hash(temporal)`, `usn_clave_temporal = true` → enviar correo (stub/real).
**Response 200** `{ "ok": true }` (respuesta genérica; no revela si el usuario existe).
**Errores:** 400, 429, 500.

---

## POST /api/auth/logout
Invalida la sesión borrando la cookie.
**Response 200** `{ "ok": true }` + `Set-Cookie` con `Max-Age=0`.

---

## GET /api/me
Devuelve el usuario de sesión + módulos (para hidratar el cliente).
**Proceso:** `verifyAuth()` → 401 si no hay sesión válida.
**Response 200** `{ "usuario": {…}, "rol": 2, "modulos": [...] }`
**Error 401:** el cliente **redirige a /login**; nunca muestra datos demo (corrige Bug 4).

---

## Middleware / guardas (equivalencias legacy → Next.js)
| Legacy (Adonis) | Next.js 003 |
|---|---|
| `AutenticacionJWT` | `verifyAuth()` en cada route protegida (cookie httpOnly) |
| `Autorizacion` / `roleGuard` | `verifyAuth(rolesPermitidos)` — 403 si el rol no está |
| `VerificarModulo` | comprobación de módulo habilitado (`roles_modulos`/`usuarios_modulos`) |
| `AutenticacionVigia` | **eliminado** (no hay login vigía) |
| `ValidacionProveedor` | ver `contracts/integracion-despachos.md` (token+NIT+contrato vigente) |
