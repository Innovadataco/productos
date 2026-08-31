# SPEC-036 · Login propio de BI (retira el SSO puente · una sola puerta)

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 036 |
| **Nombre** | login-propio |
| **Origen** | BI · INSTRUCTIVO-021 · F3C 2026-08-30 19:1x COT · orden de Jelkin |
| **Prioridad** | 🔴 Seguridad · Jelkin lo espera |
| **Estado** | ⏳ spec+plan LISTO · pendiente REVISO |

---

## Objetivo

Reemplazar el SSO puente PI→BI por una **puerta propia de BI**: un login usuario+contraseña, una sola puerta para toda la app. Cambiar la clave = editar `.env` + reiniciar contenedor, sin PR ni deploy.

## Reglas de alcance (de Jelkin · vinculantes)

**ENTRA:** usuario+contraseña en el `.env` que él edita · botón "cerrar sesión" visible en toda la app · login+sesión que cubre TODA la app.

**SALE (NO se hace):** ❌ rate limit (Jelkin lo sacó) · ❌ hash (la clave va **EN CLARO** en el `.env`, comparación directa `===` · concesión consciente de Jelkin, no un olvido) · ❌ recuperación / multiusuario / roles · ❌ tocar el SSO de PI de más.

**NO NEGOCIABLE:** cambiar la clave = editar `.env` + reiniciar contenedor. Sin PR/deploy. **Las env se leen en request time.**

---

## Decisiones clave (documentadas explícitas)

### "Reemplaza, NO convive"
El login propio **reemplaza** el SSO puente. NO conviven. Dejar vivos los dos caminos de auth es exactamente el bug de I-33 (dos puertas). Por eso:
- Se **RETIRA** `src/app/api/auth/link/route.ts` (`git rm`): era el endpoint que seteaba la cookie `session` desde un JWT emitido por PI. Vivo = segunda puerta.
- El guard (`guard-bi-sesion.ts`) deja de redirigir a `${PI_BASE_URL}/api/auth/link-bi` y pasa a redirigir a `/login?returnTo=<ruta>` de BI.
- El `link-bi` del lado PI (`002-*`) queda huérfano; lo limpia Fábrica PI-1 aparte, DESPUÉS de que 036 esté arriba (NO se toca acá).

### La clave va EN CLARO (concesión consciente de Jelkin)
`BI_AUTH_PASSWORD` se guarda en texto plano en el `.env` y se compara con `===`. Es una decisión explícita de Jelkin (no hash), documentada para que el auditor no lo lea como defecto. Trade-off aceptado para Fase 1: una sola credencial de admin, editable por SSH, sin infra de hashing.

### Env leídas en request time
`BI_AUTH_USER` / `BI_AUTH_PASSWORD` se leen de `process.env` DENTRO del handler POST (no en el top-level del módulo), para que cambiar el `.env` + reiniciar el contenedor tome efecto sin rebuild.

---

## Alcance

### Nombres de las 2 env vars

- `BI_AUTH_USER` — usuario admin.
- `BI_AUTH_PASSWORD` — contraseña en claro.

Las escribe Jelkin en el `.env.bi.production` del VPS (CEO las siembra antes del deploy). **NO van en código ni se mencionan con valor.** Se documentan en `.env.bi.example` como placeholders.

### Archivos

| Ruta | Qué |
|---|---|
| `src/app/login/page.tsx` (reemplaza) | Form usuario+contraseña+entrar · lee `?returnTo=` y lo manda al POST |
| `src/app/api/auth/login/route.ts` (nuevo · POST) | Lee `BI_AUTH_USER`/`BI_AUTH_PASSWORD` en request time · compara `===` · firma JWT `session` + cookie · 302 a returnTo validado |
| `src/app/api/auth/logout/route.ts` (nuevo · POST) | Borra cookie `session` (maxAge 0) · redirect `/login` |
| `src/components/bi/auth/CerrarSesion.tsx` (nuevo · client) | Botón "Cerrar sesión" · POST `/api/auth/logout` |
| `src/lib/auth/return-to.ts` (nuevo) | `sanitizeReturnTo` extraído de `/api/auth/link` (que se retira) · whitelist con `/operacion` incluida |
| `src/lib/auth/guard-bi-sesion.ts` (modificado) | Redirige a `/login?returnTo=<ruta>` en vez de a PI link-bi |
| `src/components/bi/layout/BiAppShell.tsx` (modificado) | `<CerrarSesion/>` en la sidebar (dashboard) |
| `src/components/bi/operacion/BarraOperacion.tsx` (modificado) | `<CerrarSesion/>` en la barra de /operacion |
| `src/app/chat/page.tsx` (modificado) | `<CerrarSesion/>` en el header de /chat |
| `src/app/api/auth/link/route.ts` (**git rm**) | Se retira (segunda puerta) |
| `.env.bi.example` (modificado) | Documentar `BI_AUTH_USER`/`BI_AUTH_PASSWORD` |

### `POST /api/auth/login`

1. Leer `BI_AUTH_USER` + `BI_AUTH_PASSWORD` de `process.env` (request time).
2. Leer `usuario` + `password` del body (form o JSON) + `returnTo`.
3. Comparar `===`. Si falta config o no coincide → error claro **sin decir cuál falló** (usuario o clave), sin cookie.
4. Coincide → firmar JWT `session` `{sub: BI_AUTH_USER, role: "ADMIN"}` con `JWT_SECRET`, TTL 24h, `SignJWT` HS256 (igual que `/api/auth/link` hoy) + Set-Cookie `session` (httpOnly · secure en prod · sameSite lax · path `/` · maxAge 24h) + 302 a `sanitizeReturnTo(returnTo)`.

### `POST /api/auth/logout`

Borra cookie `session` (set con maxAge 0) + redirect `/login`.

### Botón "Cerrar sesión" · visible en toda la app

`<CerrarSesion/>` (client · POST a `/api/auth/logout`) en:
- `BiAppShell` (cubre `/dashboard/**`).
- barra de `/operacion`.
- header de `/chat`.

### Guard

`guard-bi-sesion.ts`: sin sesión → `redirect(\`/login?returnTo=${encodeURIComponent(rutaBi)}\`)` (ruta relativa · no se construye URL absoluta, así no aplica el patrón x-forwarded-host). El helper sigue siendo el único lugar con la lógica.

---

## Fuera de alcance

- Rate limit, hashing, recuperación, multiusuario, roles (Jelkin los sacó).
- El `link-bi` de PI (`002-*`): queda huérfano, lo limpia PI-1 después.
- `/api/health`, `/login-error` siguen igual.

---

## Candados aplicables

| # | Candado | Aplicación |
|---|---|---|
| 22 | `sesion.ts`/`jwt.ts` SOLO LECTURA | Reutilizados (verifyToken sigue leyendo la cookie que firma el login) |
| — | Secretos NUNCA en código/chat | `BI_AUTH_USER`/`BI_AUTH_PASSWORD` solo en `.env` · placeholders en example |
| 25 | Evidencia (seguridad) pesa más | PASO 5 · 6 evidencias obligatorias |
| 14 | Verificación en vivo | curl + captura con `next build && next start` |
| 17 | spec+plan commiteado antes de implementar | Aplicado |

---

## Riesgos

- **Retiro de `/api/auth/link` deja huérfano el link-bi de PI:** intencional · documentado · PI-1 lo limpia después. Mientras tanto, el link-bi de PI redirige a `/api/auth/link` de BI que ya no existe → 404; no es un hueco de seguridad (404, no acceso). El deploy de 036 debe ir con ese entendimiento.
- **Clave en claro:** concesión de Jelkin. Documentada. `.env` con permisos 600 fuera de git es la única capa.
- **RAM del Mac:** el gate `next build` se escalona con Dev BI-1 (aviso antes); si hace swapear a Ollama en serio, se PARA (prioridad producción PI).

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-30 19:1x COT |
| **Autor** | Dev BI-2 |
| **Aprobado por** | pendiente REVISO Fábrica BI-2 |
