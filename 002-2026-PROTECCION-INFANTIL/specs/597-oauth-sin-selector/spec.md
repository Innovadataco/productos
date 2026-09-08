# SPEC-597 · Quitar selector de cuenta del OAuth de Google

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-08 · **Origen**: orden CEO (Jelkin), 08-09-2026. Rama `work/pi-SPEC-597-oauth-sin-selector`.

## Impacto en arquitectura: no

Cambio de un parámetro de la URL de autorización de Google en `src/lib/auth-oauth.ts` (introducido en SPEC-587). No hay endpoints, rutas, modelo ni migraciones nuevas.

## El problema

Al hacer clic en «Continúa con Google» en `/login`, Google muestra la pantalla intermedia de selección de cuenta («Accede a tu cuenta», pidiendo digitar el correo) antes de entrar, aunque el usuario tenga una sesión de Google activa. Causa: la URL de autorización construida en el backend incluye `prompt=select_account` (agregado en SPEC-587), que obliga a Google a pedir cuenta siempre.

Decisión EXACTA del CEO (Jelkin, 08-09-2026): **entrar DIRECTO con la sesión de Google ya activa** (como antes). Se quita `prompt=select_account` para que Google use la sesión recordada por defecto.

## Alcance

- **Solo** `buildGoogleAuthUrl` en `src/lib/auth-oauth.ts`: se elimina el parámetro `prompt=select_account`. No se reemplaza por `prompt=none` (fallaría sin sesión activa); simplemente sin `prompt`, que es el comportamiento por defecto de Google: sesión activa + consentimiento ya dado → redirige directo al callback; sin sesión → Google pide credenciales normalmente.
- Callback, intercambio code→token, userinfo y cookie de state: sin cambios.

## Functional Requirements

- **FR-001**: El sistema DEBE construir la URL de autorización de Google SIN el parámetro `prompt`, de modo que una sesión de Google activa con consentimiento previo entre directo sin pantalla intermedia de selección de cuenta.
- **FR-002**: El sistema DEBE conservar en la URL de autorización los parámetros `client_id`, `redirect_uri`, `response_type=code`, `scope=openid email profile` y `state` firmado.
- **FR-003**: El test de la auth URL DEBE afirmar que `prompt` está ausente (candado contra regresión) y que los demás parámetros siguen presentes.

## Criterios de aceptación

- [x] `prompt=select_account` eliminado de `buildGoogleAuthUrl`; ningún otro lugar del código lo agrega.
- [x] Test actualizado en verde: la URL no contiene `prompt` ni `select_account`, y sigue conteniendo `client_id`, `redirect_uri`, `response_type`, `scope` y `state`.
- [x] `tsc --noEmit` verde; ESLint verde; `npm run test` verde; `npm run build` verde.

## Implementación

- `src/lib/auth-oauth.ts` — `buildGoogleAuthUrl` sin `prompt`; docstring actualizado (SPEC-597).
- `src/lib/auth-oauth.test.ts` — caso de la auth URL renombrado y reforzado: `params.get("prompt")` es `null`, la URL no contiene `select_account`, y se conservan los asertos de `client_id`, `redirect_uri`, `response_type`, `scope` y `state`.

## Deuda / notas

- Si en el futuro se quiere forzar la elección de cuenta (p. ej. kioscos compartidos), el parámetro vive en un solo lugar (`buildGoogleAuthUrl`) y el test candado lo hará visible de inmediato.
- Los valores `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` siguen solo en variables de entorno; ningún doc ni commit los toca.
