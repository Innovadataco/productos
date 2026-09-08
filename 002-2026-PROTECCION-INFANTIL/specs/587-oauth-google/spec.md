# SPEC-587 · «Continúa con Google» (OAuth 2.0 web flow, flujo PADRE)

**Status**: DESARROLLO
**Fecha**: 2026-09-07 · **Origen**: orden CEO (login/registro del padre). Rama `work/pi-SPEC-587-oauth-google`.

## Impacto en arquitectura: no

Endpoints nuevos bajo `src/app/api/auth/oauth/**`, lib nueva `src/lib/auth-oauth.ts` (fuera de la cadena de imports de los workers — arch:check (f) intacto), servicio DAL `autenticacion-oauth.ts` (frontera Q-3 respetada). Cero cambios de schema, cero migraciones, sin tocar el flujo por enlace ni los flujos institucionales.

## El problema

La puerta del padre pide correo + contraseña (o enlace de registro). Cada fricción en la entrada es un padre que no reporta: la mitad de las cuentas del mundo vive detrás de Google y espera un botón. Hoy no hay alternativa de identidad federada.

## Alcance

OAuth 2.0 de Google **solo para el flujo PADRE**: botón «Continúa con Google» en `/registro` (entrada de padres) y en `/login`, debajo del campo de correo con separador «o». El flujo por correo con enlace queda intacto. Profesional/colegio **NO** (requieren verificación institucional).

## Comportamiento

1. `GET /api/auth/oauth/google` → rate limit (`oauth_google`) → state firmado (HMAC-SHA256 con `JWT_SECRET`, payload `{nonce, exp}`, 10 min) en cookie httpOnly → 302 a accounts.google.com (scope `openid email profile`, `prompt=select_account`).
2. `GET /api/auth/oauth/google/callback?code&state` → rate limit → valida state contra la cookie (mismatch/tampered/expirado → 400) → intercambia code en `oauth2.googleapis.com/token` (timeout 10 s; fallo → 502 `BAD_GATEWAY`) → userinfo (`oauth2/v3/userinfo`; fallo → 502).
3. Exige `email_verified === true` (si no, 403).
4. Resolución por email (minúsculas + trim, mismo criterio que `AutenticacionService.login`):
   - **Existe** → login directo: JWT 24 h (mismo helper de `src/lib/auth.ts`), sesión registrada (`SessionLogService`, como el login) y redirect a su home según rol (`homeParaRol`, fuente única SPEC-319). Vigencia del servicio como `POST /api/auth/login` (SPEC-119). Cuenta inactiva → 401.
   - **No existe** → cuenta `PARENT` con email verificado. El schema exige `passwordHash` y el modelo no distingue proveedor de auth: se genera una contraseña aleatoria de 72 chars hex bcrypteada (cost 12) — imposible de adivinar, efectivamente «sin clave local». `AuditLog` `USER_CREATE` con metadatos `{origen: "oauth_google", proveedorSub}` (sin email ni nombre). Redirect a `/dashboard/padre` + cookie `sesion_estado` sellada (directo al Paso 1, como `/registro/completar`).
   - **Existe con OTRO rol** (p. ej. PROFESIONAL que entró por la pantalla de padre) → login igual: es su cuenta, el rol manda.

## Decisiones

- **Contraseña aleatoria, no nullable**: `passwordHash` es `String` no nullable y no hay campo de proveedor; una migración solo para marcar origen quedó descartada (la cuenta OAuth no tiene clave local usable y el hash aleatorio lo garantiza).
- **Sin cambio de schema**: cero migraciones.
- **State**: formato `<base64url(json)>.<base64url(hmac)>`, comparación con `timingSafeEqual`, cookie `oauth_state` (httpOnly, sameSite lax, 10 min, secure según env), borrada en el callback.
- **Secretos**: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` solo por entorno, sin defaults en runtime; documentados en `.env.example` (y `.env.test.example`) con `(provisionar)`. Nunca valores reales en git.
- **502 canónico**: se agregó `BAD_GATEWAY` a `ERROR_CODES` para los fallos del proveedor.

## Endpoints

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| GET | `/api/auth/oauth/google` | pública (rate limit) | 302 → accounts.google.com + cookie `oauth_state` |
| GET | `/api/auth/oauth/google/callback` | pública (rate limit) | 302 → home del rol · 400 state · 403 email no verificado / vigencia · 401 inactiva · 502 Google caído |

## Archivos

- `src/lib/auth-oauth.ts` — state, auth URL, intercambio code→token, userinfo.
- `src/lib/dal/services/autenticacion-oauth.ts` — resolución/creación de cuenta + AuditLog (frontera Q-3: la ruta no toca Prisma).
- `src/app/api/auth/oauth/google/route.ts` y `.../callback/route.ts`.
- `src/components/modules/BotonContinuaConGoogle.tsx` — botón + SVG «G» inline.
- `src/app/registro/page.tsx`, `src/app/login/page.tsx` — integración del botón.
- `src/lib/errors.ts` — `BAD_GATEWAY`; `src/lib/rate-limit.ts` — scope `oauth_google`.
- Tests: `src/lib/auth-oauth.test.ts` (unit), `src/app/api/auth/oauth/google/route.test.ts` y `.../callback/route.test.ts` (integración).

## Edge cases cubiertos

State expirado/tampered/mismatch/sin code → 400 · `email_verified=false` → 403 · token endpoint falla → 502 sin crear cuenta · email con mayúsculas resuelve la cuenta existente · existente con otro rol va a su panel · rate limit en ambos endpoints.

## Deuda técnica / pendientes

- Proveedor de la cuenta (local vs Google) no queda explícito en el modelo; si en el futuro se quiere «vincular/desvincular Google» o prohibir login por clave a cuentas OAuth, habrá que migrar un campo `proveedorAuth`.
- Onboarding de cuenta OAuth nueva no pide consentimiento explícito en la creación (igual que el registro por enlace: el consentimiento se recoge en el Paso 1 del camino).
- Provisionar las credenciales reales en consola de Google (redirect URI `{PI_BASE_URL}/api/auth/oauth/google/callback`) y en los `.env` de dev/prod — fuera de git.
