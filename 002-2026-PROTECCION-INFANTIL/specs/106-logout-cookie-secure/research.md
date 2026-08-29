# Research — SPEC-106

**Date**: 2026-07-27

## Verificado en fuente

- `src/lib/auth.ts` (`setSessionCookie`, ~L157-166): crea `getCookieName(secure)` con
  `{ httpOnly: true, secure, sameSite: secure ? "strict" : "lax", maxAge: 86400, path: "/" }`.
- `src/app/api/auth/logout/route.ts`: `cookieStore.delete("__Host-token")` y
  `cookieStore.delete("token")` — sin atributos. El Set-Cookie resultante de
  `__Host-token` no trae `Secure` → el navegador lo rechaza entero (regla del prefijo
  `__Host-`: exige `Secure`, `Path=/`, sin `Domain`) → la sesión sobrevive con 200.
- `src/components/modules/NavHeader.tsx` (~L64-84): `logoHref` por rol se aplica en TODAS
  las rutas; en público secuestra al ADMIN hacia el panel.

## Decisiones

- **Decisión: helper compartido de atributos en `auth.ts` usado por crear y borrar.**
  Rationale: elimina la asimetría de raíz y garantiza que futura divergencia sea imposible
  (una sola fuente). La creación queda bit a bit igual (mismo objeto de opciones).
  Alternativas consideradas: duplicar los atributos en el logout (misma clase de error a
  futuro); `delete(name, { ... })` (la API de Next permite pasar opciones a delete, pero el
  contrato explícito de `set` con `maxAge: 0` es más legible y testeable en la cabecera).

- **Decisión: borrado con `set(name, "", { ...attrs, maxAge: 0 })`.**
  Rationale: emite `Set-Cookie` con `Expires` en el pasado y todos los atributos → cumple
  el prefijo `__Host-` (`Secure` + `Path=/`) y el navegador destruye la cookie.

- **Decisión: esquema determinado con `isSecureRequest(request)` igual que al crear.**
  Rationale: el borrado debe corresponder al esquema en que vive la cookie real;
  además se borra SIEMPRE también la legacy `token` con atributos no-seguros (cubre el
  caso de sesiones creadas antes del esquema `__Host-`).

- **Decisión: `logoHref` por rol solo si `pathname.startsWith("/dashboard")`.**
  Rationale: es el ajuste pedido (FR-004) con la mínima superficie; el home del rol sigue
  funcionando dentro del panel (SPEC-100/I-25 intactos).

- **Test sobre la cabecera, no sobre el status** (FR-003): el servidor siempre respondió
  200; el bug era invisible sin inspeccionar Set-Cookie.

## Referencias

- Regla del prefijo `__Host-` (MDN/RFC 6265bis): requiere `Secure`, `Path=/`, sin `Domain`.
- SPEC-100 (I-25): `esRutaPermitidaSchoolAdmin`, `ColegioNav` + `ColegioLogoutButton` —
  no se tocan.
