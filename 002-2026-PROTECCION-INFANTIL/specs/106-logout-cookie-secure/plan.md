# Implementation Plan: SPEC-106 — Cerrar sesión de verdad (cookie `__Host-` y logo público)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/106-logout-cookie-secure/spec.md`

## Summary

El logout borra la cookie con `cookieStore.delete()` a secas, sin repetir los atributos de
creación: el navegador rechaza entero el Set-Cookie de `__Host-token` (prefijo `__Host-`
exige `Secure`) y la sesión sobrevive en silencio con un 200. Fix: borrar con los MISMOS
atributos con que se crea (misma función de atributos que el login, expiración pasada),
para `__Host-token` (esquema seguro) y `token` (legacy). Test de regresión sobre la
CABECERA Set-Cookie (no sobre el status). Segundo ajuste: el enrutado por rol del logo del
NavHeader aplica SOLO dentro de /dashboard/**; en rutas públicas el logo va al home
público. I-25 intacto: panel de colegio y enrutado dentro de /dashboard/** sin cambios.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22

**Primary Dependencies**: Next.js 16 (`next/headers` cookies), `src/lib/auth.ts`
(`setSessionCookie`, `getCookieName`, `isSecureRequest` — se reutilizan, no se tocan)

**Storage**: N/A (cookie de sesión JWT httpOnly)

**Testing**: Vitest (`src/app/api/auth/logout/route.test.ts` nuevo; NavHeader test si existe)

**Target Platform**: Linux server / macOS dev

**Constraints**: no tocar login ni creación de cookie (auth.ts:157-166); I-25 no se reabre;
sin secrets en logs.

**Scale/Scope**: `logout/route.ts`, `NavHeader.tsx`, tests nuevos.

## Constitution Check

*GATE: verificado antes de Fase 0 y tras el diseño (2026-07-27).*

- **Cookies httpOnly, secure en HTTPS, SameSite; JWT 24h** (constitution/AGENTS): el fix
  hace cumplir exactamente ese principio en el borrado. CUMPLE (lo repara).
- **Presunción de inocencia / canales oficiales / PII**: no aplica (sin cambios de dominio).

Sin violaciones que justificar.

## Diseño

### 1. Borrado simétrico de la cookie (FR-001/FR-002)

- Extraer en `src/lib/auth.ts` un helper SOLO de atributos (sin tocar la creación):
  `sessionCookieAttributes(secure: boolean)` → `{ httpOnly: true, secure, sameSite:
  secure ? "strict" : "lax", path: "/" }`, reutilizado por `setSessionCookie` (mismo objeto
  de opciones actual) y por el nuevo borrado. La lógica de creación queda bit a bit igual
  (mismo helper, mismos valores).
- `src/app/api/auth/logout/route.ts`: en vez de `delete()`, emitir para cada nombre el
  borrado explícito con atributos completos y expiración pasada:
  `cookieStore.set(getCookieName(secure), "", { ...sessionCookieAttributes(secure), maxAge: 0 })`
  — y para el legacy: `cookieStore.set("token", "", { ...sessionCookieAttributes(false),
  maxAge: 0 })`. El esquema se determina con `isSecureRequest(request)` igual que al crear.
- Nota de compatibilidad: `cookieStore.set(name, "", { maxAge: 0, ...attrs })` emite
  `Set-Cookie: name=; Expires=<pasado>; <attrs>` — aceptado por el navegador porque el
  prefijo `__Host-` queda satisfecho (`Secure` + `Path=/`).

### 2. Test de regresión sobre la cabecera (FR-003)

- `src/app/api/auth/logout/route.test.ts` (nuevo, patrón del proyecto: llamar al handler
  con `Request` nativo): inspecciona `response.headers.get("set-cookie")` y afirma que el
  borrado de `__Host-token` incluye `Secure`, `Path=/` y `Expires` en el pasado; y que el
  de `token` lleva `Path=/` y expiración pasada sin exigir `Secure` (esquema legacy). El
  test NO se limita al status (el servidor siempre dijo 200).

### 3. Logo: enrutado por rol solo dentro de /dashboard/** (FR-004/FR-005)

- `NavHeader.tsx`: el `logoHref` por rol aplica únicamente cuando la ruta actual empieza
  por `/dashboard` (via `usePathname()`); en cualquier otra ruta, `logoHref = "/"`.
- Guarda I-25: NO se toca `ColegioNav`/`ColegioLogoutButton` ni el `dashboardHref` por rol
  usado dentro del área autenticada. El ajuste es solo del destino del logo en rutas
  públicas. **Declaración explícita: el plan NO toca el panel de colegio ni el enrutado
  dentro de /dashboard/** (cumple FR-005).
- Test: si existe test de NavHeader, se ajusta/agrega caso (admin en "/" → logo a "/";
  admin en "/dashboard/admin" → logo al panel). Si no existe, se crea el mínimo.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| El borrado con `set` no emita expiración pasada en algún runtime | `maxAge: 0` (Expires en el pasado por contrato de Next cookies) + test sobre la cabecera real |
| Reabrir I-25 al tocar el header | El cambio se limita al `logoHref` en rutas no-dashboard; test de los dos contextos |
| Romper el login al extraer el helper | `setSessionCookie` usa el mismo helper con los mismos valores; suite completa en gate |
| Cookie legacy en dev (http) | Borrado sin `Secure` para `token`, coherente con su creación |

## Project Structure

### Documentation (this feature)

```text
specs/106-logout-cookie-secure/
├── plan.md              # Este archivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── checklists/
│   └── requirements.md  # Validación de la spec
└── cierre.md            # Al cerrar (pendiente)
```

### Source Code (repository root)

```text
src/lib/auth.ts                              # helper de atributos compartido (creación intacta)
src/app/api/auth/logout/route.ts             # borrado simétrico (reemplaza delete() a secas)
src/app/api/auth/logout/route.test.ts        # NUEVO: test de la cabecera Set-Cookie
src/components/modules/NavHeader.tsx         # logoHref por rol solo bajo /dashboard/**
```

**Structure Decision**: proyecto único Next.js; cambio mínimo en tres archivos + un test.
Sin contratos externos (no aplica `contracts/`).
