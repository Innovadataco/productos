# Cierre — SPEC-106: Cerrar sesión de verdad (cookie `__Host-` y logo público)

**Fecha**: 2026-07-27 · **Rama**: `feature/001-scaffolding` · **Estado**: IMPLEMENTADA, **SIN DESPLEGAR** (lo autoriza el CEO/ZEUS).

## Lo hecho (por US)

- **US1 (P1) — borrado simétrico (I-32)**: `src/lib/auth.ts` expone
  `sessionCookieAttributes(secure)` como fuente única de atributos; `setSessionCookie` la
  reutiliza con los MISMOS valores (creación bit a bit intacta, verificable en el diff).
  `logout/route.ts` reemplaza `delete()` por borrado explícito con `maxAge: 0`:
  `__Host-token` SIEMPRE `secure: true` + `path: "/"` (**corrección ZEUS 002-PI-023**: sin
  consultar `isSecureRequest` — si `x-forwarded-proto` no llega en prod devuelve false y el
  borrado saldría sin `Secure`, reintroduciendo el bug solo visible en prod) y legacy
  `token` con su esquema no-seguro.
- **US2 (P2) — logo por contexto**: `NavHeader.tsx` aplica el `logoHref` por rol SOLO si
  `pathname` empieza por `/dashboard`; en rutas públicas va a `/` aunque haya sesión (el
  ADMIN puede navegar la app pública y reportar anónimo sin que el header lo secuestre).
  **I-25 intacta**: `ColegioNav`/`ColegioLogoutButton` y el enrutado dentro de
  `/dashboard/**` sin cambios (declarado en el plan, cumplido en el diff).

## Pruebas

- `logout/route.test.ts` (3 nuevos, sobre los atributos del borrado — equivalente cabecera
  Set-Cookie, NO sobre el status): `__Host-token` con `Secure`+`HttpOnly`+`SameSite=strict`+
  `Path=/`+`maxAge:0`; legacy `token` con su esquema; y el test de la corrección ZEUS (sin
  `x-forwarded-proto`, `__Host-token` sigue con `Secure`+`Path=/`).
- `NavHeader.test.tsx` (2 nuevos): admin en `/` → logo a `/`; admin en `/dashboard/admin` →
  logo al panel.

## Gate

tsc ✅ · lint ✅ (0 errores) · **930/930 tests** ✅ (5 nuevos) · build ✅.

## Deuda

- Ninguna nueva. (El despliegue a prod — que es donde el bug era visible — queda para el
  lote que autorice el CEO.)
