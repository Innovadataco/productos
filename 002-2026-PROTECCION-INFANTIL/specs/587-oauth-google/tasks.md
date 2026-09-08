# SPEC-587 · Tasks — «Continúa con Google» (flujo PADRE)

Fases en orden de dependencia. TDD donde aplica.

## Fase 1 — Núcleo OAuth (lib)

- [x] T001 [P] `src/lib/auth-oauth.ts` — `firmarState`/`verificarState` (HMAC-SHA256 con `JWT_SECRET`, payload `{nonce, exp}`, 10 min, `timingSafeEqual`).
- [x] T002 [P] `src/lib/auth-oauth.ts` — `buildGoogleAuthUrl` (scope `openid email profile`, `prompt=select_account`) y `callbackUriDe`.
- [x] T003 [P] `src/lib/auth-oauth.ts` — `intercambiarCodePorToken` y `obtenerInfoUsuarioGoogle` (fetch nativo, `AbortSignal.timeout(10s)`, AppError 502 con `safeErrorMessage`).
- [x] T004 [P] `src/lib/errors.ts` — código canónico `BAD_GATEWAY`.
- [x] T005 [P] `src/lib/rate-limit.ts` — scope `oauth_google` (600 s / 30).
- [x] T006 [P] `src/lib/auth-oauth.test.ts` (unit) — state válido/expirado/tampered/mal formado + auth URL. Agregado a `vitest.unit.includes.ts`.

## Fase 2 — Endpoints

- [x] T007 `src/app/api/auth/oauth/google/route.ts` — rate limit, state firmado, cookie httpOnly 10 min, 302 a Google.
- [x] T008 `src/app/api/auth/oauth/google/callback/route.ts` — validación state (400), userinfo, `email_verified` (403), resolución de cuenta (crear PARENT con password aleatoria bcrypteada + AuditLog `USER_CREATE`; existente con sesión registrada y vigencia como login; inactiva 401), JWT + redirect `homeParaRol`, cookie state borrada, `sesion_estado` sellada en cuenta nueva.
- [x] T009 `src/app/api/auth/oauth/google/route.test.ts` (integración) — 302 + cookie.
- [x] T010 `src/app/api/auth/oauth/google/callback/route.test.ts` (integración, fetch mockeado) — cuenta nueva (Usuario + JWT cookie + AuditLog + sesion_estado + 302), existente case-insensitive, otro rol, 403, 400 ×3, 502.

## Fase 3 — UI

- [x] T011 `src/components/modules/BotonContinuaConGoogle.tsx` — botón con SVG «G» multicolor inline, separador «o», navegación a `/api/auth/oauth/google`.
- [x] T012 `src/app/registro/page.tsx` — botón debajo del campo de correo (flujo por enlace intacto).
- [x] T013 `src/app/login/page.tsx` — botón debajo del formulario.

## Fase 4 — Config y artefactos

- [x] T014 `.env.example` + `.env.test.example` — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` con `(provisionar)`.
- [x] T015 `specs/587-oauth-google/spec.md` + `specs/README.md` (vía `generar-readme.ts`).

## Compuertas

- [x] `tsc --noEmit` 0 · `npm run lint` sin errores nuevos · `npm run test:unit` verde · `vitest run src/app/api/auth/oauth` verde · `npm run build` verde · `npm run arch:check` verde.
