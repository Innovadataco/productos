# Contracts — SPEC-606

## POST /api/padre/step-up/codigo

Solicita el código de 6 dígitos (lo envía al correo del padre autenticado).

- Auth: sesión `PARENT` (cookie JWT). Sin sesión → 401.
- Rate limit: scope `stepup_codigo` (default 5/h por usuario) → 429 + headers `X-RateLimit-*`/`Retry-After`.
- Body: ninguno.

### 200 OK

```json
{
  "enviado": true,
  "vigenciaMinutos": 10,
  "cooldownSegundos": 60,
  "correoEnmascarado": "j•••••@gmail.com"
}
```

### 429 (cooldown de reenvío, < 60 s desde el último código)

```json
{
  "error": {
    "message": "Ya te enviamos un código. Puedes pedir otro en 42 segundos.",
    "code": "RATE_LIMITED",
    "reintentaEnSegundos": 42,
    "correoEnmascarado": "j•••••@gmail.com"
  }
}
```

La UI NO trata este 429 como error fatal: el código ya enviado sigue sirviendo; muestra las casillas con el reenvío en cooldown.

### 502 (sin regla de correo activa — fail-closed)

```json
{ "error": { "message": "No pudimos enviar el código. Intenta de nuevo.", "code": "BAD_GATEWAY" } }
```

## POST /api/padre/step-up/verificar

Canjea el código. Éxito → emite la cookie `stepup_sello` (httpOnly, sameSite strict, maxAge = `padre.texto.stepup_minutos`) — idéntica a la de siempre.

- Auth: sesión `PARENT`. Sin sesión → 401.
- Rate limit: scope `stepup_verificar` (default 15/10 min por usuario).
- Body: `{ "codigo": "123456" }` — 6 dígitos; otro formato → 400.

| Caso | Status | Body `error.message` |
|---|---|---|
| Correcto | 204 | — (Set-Cookie `stepup_sello`) |
| Incorrecto (quedan N) | 401 | `Código incorrecto. Te quedan N intentos.` |
| 5º fallo (código muere) | 429 | `Superaste los intentos permitidos. Solicita un código nuevo.` |
| Vencido | 403 | `El código venció. Solicita uno nuevo.` |
| Sin código vigente / reusado | 401 | `Código incorrecto o vencido. Solicita uno nuevo.` |
| Formato inválido | 400 | `Escribe el código de 6 dígitos` |

## GET /api/padre/reportes/{id}/texto (sin cambios de autoridad)

- 403 STEP_UP_REQUERIDO ahora siempre con `metodos: ["codigo_email"]` y mensaje «Por tu seguridad, te enviamos un código a tu correo para ver este texto.»
- 200 `{ "texto": "…" }` con sesión joven o sello fresco — intacto.

## Eliminado

- `POST /api/padre/step-up` (contraseña): devuelve 404 de Next (ruta inexistente). Único consumidor era la UI, migrada en este PR.
