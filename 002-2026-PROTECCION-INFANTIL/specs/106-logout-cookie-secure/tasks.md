# Tasks — SPEC-106: Cerrar sesión de verdad (cookie `__Host-` y logo público)

**Input**: plan.md (con corrección ZEUS 002-PI-023), spec.md, research.md, data-model.md,
quickstart.md de `/specs/106-logout-cookie-secure/` | **Branch**: `feature/001-scaffolding`

## Fase 1: US1 (P1) — Borrado simétrico de la cookie de sesión

**Goal**: el Set-Cookie de borrado es aceptado por el navegador (prefijo `__Host-`
satisfecho siempre); login y creación intactos.
**Independent Test**: quickstart pasos 1–2.

- [x] T001 [US1] Helper compartido en `src/lib/auth.ts`: `sessionCookieAttributes(secure: boolean)` (`{ httpOnly: true, secure, sameSite: secure ? "strict" : "lax", path: "/" }`); `setSessionCookie` lo reutiliza con los MISMOS valores (creación bit a bit igual).
- [x] T002 [US1] `src/app/api/auth/logout/route.ts`: reemplazar `delete()` por borrado explícito con expiración pasada — `__Host-token` SIEMPRE `{ ...sessionCookieAttributes(true), maxAge: 0 }` (secure y path fijos, SIN consultar isSecureRequest — corrección ZEUS) y `token` legacy `{ ...sessionCookieAttributes(false), maxAge: 0 }`.
- [x] T003 [P] [US1] Test nuevo `src/app/api/auth/logout/route.test.ts` sobre la CABECERA Set-Cookie: borrado de `__Host-token` incluye `Secure` + `Path=/` + `Expires` pasado; borrado de `token` incluye `Path=/` + `Expires` pasado (sin exigir `Secure`).
- [x] T004 [P] [US1] Test adicional (corrección ZEUS): con `x-forwarded-proto` AUSENTE en la petición, el borrado de `__Host-token` sigue incluyendo `Secure` y `Path=/`.

## Fase 2: US2 (P2) — Logo: enrutado por rol solo dentro de /dashboard/**

**Goal**: en rutas públicas el logo va a `/` aunque haya sesión; dentro del panel, sin cambios (I-25 intacta).
**Independent Test**: quickstart paso 3.

- [x] T005 [US2] `src/components/modules/NavHeader.tsx`: `logoHref` por rol solo si `usePathname()` empieza por `/dashboard`; en cualquier otra ruta `"/"`. Sin tocar `ColegioNav`/`ColegioLogoutButton` ni el `dashboardHref` del área autenticada.
- [x] T006 [P] [US2] Test de NavHeader (nuevo o ajuste del existente): admin en `/` → logo a `/`; admin en `/dashboard/admin` → logo al panel del rol.

## Fase 3: Cierre

- [x] T007 Gate: `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build` (todo verde).
- [x] T008 `cierre.md` + `specs/README.md` (106 → Finalizada, SIN desplegar) + commits convencionales + push. **NO desplegar** (lo autoriza el CEO/ZEUS).

## Dependencias

- T001 → T002 → T003/T004 · T005 → T006 (Fases 1 y 2 en cualquier orden) · T007–T008 al final.
