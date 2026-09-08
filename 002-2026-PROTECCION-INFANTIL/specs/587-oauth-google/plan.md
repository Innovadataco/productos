# SPEC-587 · Plan — «Continúa con Google» (flujo PADRE)

Ver `spec.md` (comportamiento, decisiones, endpoints) y `tasks.md` (fases T001–T015).

## Resumen técnico

- **Auth OAuth 2.0 web flow** contra Google, SOLO para el flujo PADRE (`/registro` y `/login`). Profesional/colegio intactos (verificación institucional).
- **State anti-CSRF**: HMAC-SHA256 con `JWT_SECRET`, payload `{nonce, exp}` (10 min), formato `<base64url(json)>.<base64url(hmac)>`, comparación con `timingSafeEqual`. Cookie `oauth_state` httpOnly, sameSite lax, 10 min, secure según env, de un solo uso (borrada en el callback).
- **Callback**: valida state → code→token (`oauth2.googleapis.com/token`, timeout 10 s) → userinfo (`oauth2/v3/userinfo`) → exige `email_verified`. Errores de proveedor: AppError 502 con código canónico nuevo `BAD_GATEWAY`.
- **Cuenta** (DAL `AutenticacionOauthService`, frontera Q-3): por email normalizado (minúsculas + trim). Existe → login (JWT 24 h vía helpers de `src/lib/auth.ts`, sesión registrada, vigencia como `POST /api/auth/login`). No existe → `PARENT` activo con password aleatorio bcrypteada (el schema exige `passwordHash` y no hay campo de proveedor) + `AuditLog` `USER_CREATE` sin PII. Rol distinto → login igual, el rol manda.
- **Destino**: `homeParaRol` (fuente única SPEC-319); cuenta nueva además sella `sesion_estado` (directo al Paso 1, como `/registro/completar`).
- **Rate limit**: scope nuevo `oauth_google` (600 s / 30) en ambos endpoints.
- **UI**: `BotonContinuaConGoogle` (SVG «G» inline, sin dependencias) debajo del campo de correo con separador «o»; el flujo por enlace queda intacto.
- **Env**: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` solo por entorno, sin defaults en runtime; placeholders `(provisionar)` en `.env.example` y `.env.test.example`.
- **Tests**: unitarios de state (válido/expirado/tampered) e integración del callback con fetch mockeado (creación, login case-insensitive, otro rol, 403, 400 ×3, 502).

## Riesgos y mitigaciones

- **Secreto de state**: HMAC con `JWT_SECRET` (misma raíz de confianza que los JWT de sesión); no se persiste nada en servidor.
- **Cuenta OAuth sin clave local**: la contraseña aleatoria de 72 chars hex bcrypteada no es adivinable; si en el futuro se quiere login por clave prohibido para cuentas OAuth, tocará migrar un campo `proveedorAuth` (deuda declarada en spec.md).
- **Provisionamiento**: las credenciales reales se crean en consola de Google (redirect URI `{PI_BASE_URL}/api/auth/oauth/google/callback`) y se entregan por canal seguro; nunca en git (I-22).
