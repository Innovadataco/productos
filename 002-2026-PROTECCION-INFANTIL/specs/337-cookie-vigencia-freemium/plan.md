# Implementation Plan: SPEC-337 · re-sello sesion_estado en freemium (I-227)

**Branch**: `work/pi-SPEC-337-cookie-vigencia-freemium` | **Spec**: [spec.md](spec.md)

## Cambios
- `src/lib/routing/sellar-sesion-estado.ts` (nuevo): `sellarCookieSesionEstado(res, userId)` — `buildSesionEstadoValue` + `res.cookies.set(NOMBRE_COOKIE, …, {httpOnly, sameSite lax, secure, maxAge=TTL_SEG, path:/})`, fallo silencioso. Centraliza el patrón inline de login/consentimiento/vigencia-refresh (clase I-211/222/224/227).
- `src/app/api/padre/suscripcion/activar-freemium/route.ts`: construir la respuesta en `res`, `await sellarCookieSesionEstado(res, usuario.id)`, `return res`.
- `route.test.ts`: aserción `Set-Cookie: sesion_estado=` en el happy path.

## Enumeración (candado 22v5): en el spec.md. Solo activar-freemium requiere el fix; el resto son PENDIENTE_AUTORIZACION o cambian la vigencia de otro usuario.

## Verificación
`tsc·lint·tokens·arch·ratchets` + `specs-discipline` + el route.test (verde local, BD real). Evidencia navegador post-deploy (CEO).
