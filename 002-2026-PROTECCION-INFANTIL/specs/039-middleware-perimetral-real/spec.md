# Feature Specification: Middleware perimetral real

**Feature Branch**: `[039-middleware-perimetral-real]`

**Created**: 2026-07-19

**Status**: IMPLEMENTADO

**Input**: El guard perimetral del spec 035 US4 quedó implementado en archivos `src/proxy.ts` / `src/lib/proxy.ts`, pero la convención correcta en Next.js 16.10 es `src/proxy.ts` con export `proxy`, no `src/middleware.ts` con export `middleware`. El objetivo es asegurar que el middleware perimetral realmente corra como `Proxy (Middleware)` de Next.js, manteniendo la defensa en profundidad con `verifyAuth` en endpoints y layouts.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Middleware perimetral real (Priority: P1)

El sistema debe tener un middleware de Next.js que intercepte peticiones antes de llegar a handlers o layouts, verifique la sesión por cookie y redirija o responda según la ruta y el rol. En Next.js 16.2.10 el entrypoint es `src/proxy.ts` exportando una función `proxy`. Hoy `src/proxy.ts` re-exporta `src/lib/proxy.ts` con la lógica, pero debemos confirmar que la convención es la correcta y que el proxy se ejecuta realmente.

**Why this priority**: Sin un middleware perimetral real, las protecciones dependen exclusivamente de guards en layouts y endpoints. Una ruta olvidada o un asset dinámico puede quedar expuesto. Además, el middleware unifica el comportamiento de autenticación/autorización antes de renderizar.

**Independent Test**: Con `src/proxy.ts` activo, una petición sin sesión a `/dashboard/admin` es redirigida a `/login` por el proxy (antes de que se ejecute el layout admin). Los 5 roles (ADMIN, SCHOOL_ADMIN, OPERADOR, PARENT, COMITE_VALIDACION) acceden a sus rutas permitidas sin lockout.

**Acceptance Scenarios**:

1. **Given** una petición sin sesión a `/dashboard/admin`, **When** el proxy la intercepta, **Then** redirige a `/login` antes de renderizar el layout.
2. **Given** una petición sin sesión a `/api/admin/reportes-revision`, **When** el proxy la intercepta, **Then** responde con 401.
3. **Given** un usuario `COMITE_VALIDACION` con sesión, **When** accede a `/dashboard/admin/comite`, **Then** el middleware lo deja pasar.
4. **Given** un usuario `OPERADOR` con sesión, **When** accede a `/mis-reportes`, **Then** el middleware lo redirige a `/dashboard/admin`.
5. **Given** un usuario `PARENT` con sesión, **When** accede a `/dashboard/admin`, **Then** el middleware lo redirige a `/mis-reportes` o `/`.
6. **Given** el proxy activo, **When** se accede a una ruta pública como `/consulta`, **Then** permite el tráfico anónimo.
7. **Given** los cinco roles (`ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`, `PARENT`), **When** se prueba cada uno en sus rutas permitidas y prohibidas, **Then** el comportamiento es consistente y no hay lockout.

---

## Edge Cases

- **US1**: ¿Qué pasa si `JWT_SECRET` no está definido o es corto? El middleware rechaza toda sesión como inválida (redirige a login / 401). Esto es seguro.
- **US1**: ¿Qué pasa con requests a archivos estáticos (`/_next/static/*`, `favicon.ico`, imágenes)? El matcher las excluye para no romper assets.
- **US1**: ¿Qué pasa si el middleware lanza un error? Debe caer en un `try/catch` que devuelva `NextResponse.next()` en rutas públicas o redirija a login en rutas protegidas, nunca un 500 crudo.
- **US1**: ¿Qué pasa con una ruta API pública que empieza con `/api/admin` pero no debería requerir admin? El matcher debe ser específico: proteger `/api/admin/*` y `/dashboard/admin/*`, no todo `/api/*`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Debe existir `src/proxy.ts` como entrypoint de convención Next.js 16, exportando una función `proxy` con `config.matcher`. No se usa `src/middleware.ts` porque Next.js 16.2.10 deprecó esa convención y exige `proxy`.
- **FR-002**: `src/middleware.ts` debe reutilizar la lógica de guard (cookies, verificación JWT con `jose`, redirecciones) de `src/lib/proxy.ts`, refactorizando si es necesario para que sea invocable desde el middleware.
- **FR-003**: `src/middleware.ts` debe ser edge-safe: solo usar `jose`, `Headers`, `Cookies`, `NextResponse` y APIs de runtime edge. No usar Prisma, `fs`, ni APIs de Node.
- **FR-004**: La matriz de roles internos debe incluir `ADMIN`, `SCHOOL_ADMIN`, `OPERADOR` y `COMITE_VALIDACION`, con acceso a `/dashboard/admin/*` y `/api/admin/*`.
- **FR-005**: Los roles internos que accedan a rutas de usuario final (`/dashboard/*`, `/mis-reportes`) deben ser redirigidos a su área (`/dashboard/admin` o `/dashboard/admin/comite` para `COMITE_VALIDACION`).
- **FR-006**: Los usuarios `PARENT` y anónimos que accedan a rutas admin deben ser redirigidos a `/login` o a `/mis-reportes` (según esté autenticado).
- **FR-007**: Las rutas públicas definidas en la lista actual deben seguir permitiendo tráfico anónimo.
- **FR-008**: Debe consolidarse la lógica en una sola fuente de verdad: `src/lib/proxy.ts` como helper de lógica y `src/proxy.ts` como entrypoint que satisface la convención Next.js 16. No debe existir `src/middleware.ts` ni otro entrypoint de middleware.
- **FR-009**: `verifyAuth` debe seguir usándose en endpoints y layouts como defensa en profundidad.
- **FR-010**: El matcher debe cubrir `/dashboard/admin/:path*`, `/api/admin/:path*`, `/dashboard/:path*`, `/mis-reportes`, y excluir estáticos (`/_next/static`, `/_next/image`, `favicon.ico`, archivos con extensión).

### Key Entities

- **Middleware**: `src/middleware.ts` de Next.js (edge runtime).
- **Helper compartido**: `src/lib/proxy.ts` (función de guard reutilizable).
- **Usuario**: roles relevantes `ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`, `PARENT`.
- **Rutas protegidas**: `/dashboard/admin/*`, `/api/admin/*`.
- **Rutas de usuario final**: `/dashboard/*`, `/mis-reportes`.
- **Rutas públicas**: landing, login, registro, consulta, reportar, apelaciones, etc.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Existe `src/proxy.ts` que exporta `proxy` y `config.matcher`, Next.js 16 lo ejecuta (se observa `"ƒ Proxy (Middleware)"` en el arranque) y se puede verificar interceptando una petición sin sesión.
- **SC-002**: Petición sin sesión a `/dashboard/admin` → redirect a `/login` proveniente del middleware, no solo del layout.
- **SC-003**: Petición sin sesión a `/api/admin/*` → 401 proveniente del middleware.
- **SC-004**: Los 5 roles probados acceden a sus rutas permitidas y son redirigidos en rutas prohibidas sin lockout.
- **SC-005**: Rutas públicas permiten tráfico anónimo.
- **SC-006**: `npm run test` continúa pasando con 0 tests nuevos fallidos.
- **SC-007**: `src/middleware.ts` no existe; `src/proxy.ts` y `src/lib/proxy.ts` forman la única fuente de verdad.

---

## Assumptions

- El runtime de Next.js 16.2.10 requiere `src/proxy.ts` con export `proxy` en lugar de `src/middleware.ts` con export `middleware`.
- El código de verificación JWT es edge-safe (usa `jose` y solo APIs de runtime edge).
- No se requieren cambios en el modelo de datos de Prisma.
- El layout admin y los endpoints mantendrán `verifyAuth` como defensa en profundidad.
- El matcher de Next.js middleware soporta arrays de patrones y excepciones por regex.

---

## Implementación

### Objetivo alcanzado

El guard perimetral corre realmente como `Proxy (Middleware)` de Next.js 16.2.10. Se verificó que:

- `src/proxy.ts` es el entrypoint válido en Next.js 16.2.10; `src/middleware.ts` fue descartado porque el build rechazó la convención `middleware` con el mensaje `middleware file convention deprecated; please use proxy instead`.
- `src/lib/proxy.ts` mantiene la lógica edge-safe (jose + APIs de runtime edge) y `src/proxy.ts` solo la re-exporta con `config.matcher`.
- `COMITE_VALIDACION` está en `INTERNAL_ROLES` y accede a `/dashboard/admin/*`; desde rutas PARENT es redirigido a `/dashboard/admin/comite`.
- Los 5 roles fueron probados: ADMIN, SCHOOL_ADMIN, OPERADOR, COMITE_VALIDACION y PARENT acceden a sus rutas permitidas y son redirigidos en las prohibidas, sin lockout.
- Las rutas públicas (incluyendo `POST /api/reportes` anónimo) no son bloqueadas por el proxy; el endpoint devuelve error de validación de negocio, no de autenticación.

### Componentes y archivos afectados

- `src/proxy.ts` — entrypoint de convención Next.js 16 (export `proxy` + `config`).
- `src/lib/proxy.ts` — helper con lógica edge-safe de autenticación/autorización perimetral.
- `src/app/dashboard/admin/layout.tsx` — conserva `verifyAuth` como defensa en profundidad.
- Endpoints `/api/admin/**` — conservan `verifyAuth`.

### Decisiones de diseño

- Se mantuvo `src/proxy.ts` como entrypoint en lugar de `src/middleware.ts` porque Next.js 16.2.10 deprecó la convención `middleware` y exige `proxy`.
- Se conservó `src/lib/proxy.ts` como fuente de verdad de la lógica para evitar duplicación y mantener la misma función testeable.
- Se conservó `verifyAuth` en layouts y endpoints; el proxy no reemplaza esas defensas, las complementa.
- El matcher excluye `/_next/static`, `/_next/image`, `favicon.ico` y archivos con extensión para no romper assets.

### Tests y validación

- `npx tsc --noEmit`: OK.
- `npm run lint`: OK (1 warning preexistente en `src/app/dashboard/admin/comite/gestion/page.tsx`).
- `npm run test`: OK (sin tests nuevos fallidos).
- `rm -rf .next && npm run build`: OK; en el arranque se observa `"ƒ Proxy (Middleware)"`.
- Pruebas manuales con curl para los 5 roles y rutas anónimas: resultados en `docs/cierre-039.md`.

### Migraciones

- No requirió migraciones de Prisma.

### Deuda técnica

- Ninguna nueva. El proxy perimetral está operativo y los 5 roles pasan sus pruebas.

