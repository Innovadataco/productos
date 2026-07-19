# Feature Specification: Middleware perimetral real

**Feature Branch**: `[039-middleware-perimetral-real]`

**Created**: 2026-07-19

**Status**: EN PLANIFICACIÓN

**Input**: El guard perimetral del spec 035 US4 quedó implementado en archivos `src/proxy.ts` / `src/lib/proxy.ts`, pero Next.js nunca lo ejecutó porque no existe un `src/middleware.ts` real que exporte una función `middleware`. El objetivo es hacer que el middleware perimetral realmente corra como middleware de Next.js, manteniendo la defensa en profundidad con `verifyAuth` en endpoints y layouts.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Middleware perimetral real (Priority: P1)

El sistema debe tener un middleware de Next.js que intercepte peticiones antes de llegar a handlers o layouts, verifique la sesión por cookie y redirija o responda según la ruta y el rol. Hoy no existe `src/middleware.ts` y la lógica en `src/proxy.ts`/`src/lib/proxy.ts` no se ejecuta porque el export no se llama `middleware`.

**Why this priority**: Sin un middleware perimetral real, las protecciones dependen exclusivamente de guards en layouts y endpoints. Una ruta olvidada o un asset dinámico puede quedar expuesto. Además, el middleware unifica el comportamiento de autenticación/autorización antes de renderizar.

**Independent Test**: Con `src/middleware.ts` activo, una petición sin sesión a `/dashboard/admin` es redirigida a `/login` por el middleware (antes de que se ejecute el layout admin). Los 5 roles (ADMIN, SCHOOL_ADMIN, OPERADOR, PARENT, COMITE_VALIDACION) acceden a sus rutas permitidas sin lockout.

**Acceptance Scenarios**:

1. **Given** una petición sin sesión a `/dashboard/admin`, **When** el middleware la intercepta, **Then** redirige a `/login` antes de renderizar el layout.
2. **Given** una petición sin sesión a `/api/admin/reportes-revision`, **When** el middleware la intercepta, **Then** responde con 401.
3. **Given** un usuario `COMITE_VALIDACION` con sesión, **When** accede a `/dashboard/admin/comite`, **Then** el middleware lo deja pasar.
4. **Given** un usuario `OPERADOR` con sesión, **When** accede a `/mis-reportes`, **Then** el middleware lo redirige a `/dashboard/admin`.
5. **Given** un usuario `PARENT` con sesión, **When** accede a `/dashboard/admin`, **Then** el middleware lo redirige a `/mis-reportes` o `/`.
6. **Given** el middleware activo, **When** se accede a una ruta pública como `/consulta`, **Then** permite el tráfico anónimo.
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

- **FR-001**: Debe crearse `src/middleware.ts` que exporte una función `middleware` (o export default) con `config.matcher`. No puede depender de un export llamado `proxy`.
- **FR-002**: `src/middleware.ts` debe reutilizar la lógica de guard (cookies, verificación JWT con `jose`, redirecciones) de `src/lib/proxy.ts`, refactorizando si es necesario para que sea invocable desde el middleware.
- **FR-003**: `src/middleware.ts` debe ser edge-safe: solo usar `jose`, `Headers`, `Cookies`, `NextResponse` y APIs de runtime edge. No usar Prisma, `fs`, ni APIs de Node.
- **FR-004**: La matriz de roles internos debe incluir `ADMIN`, `SCHOOL_ADMIN`, `OPERADOR` y `COMITE_VALIDACION`, con acceso a `/dashboard/admin/*` y `/api/admin/*`.
- **FR-005**: Los roles internos que accedan a rutas de usuario final (`/dashboard/*`, `/mis-reportes`) deben ser redirigidos a su área (`/dashboard/admin` o `/dashboard/admin/comite` para `COMITE_VALIDACION`).
- **FR-006**: Los usuarios `PARENT` y anónimos que accedan a rutas admin deben ser redirigidos a `/login` o a `/mis-reportes` (según esté autenticado).
- **FR-007**: Las rutas públicas definidas en la lista actual deben seguir permitiendo tráfico anónimo.
- **FR-008**: Debe consolidarse la lógica en una sola fuente de verdad: `src/middleware.ts` como entrypoint, y `src/lib/proxy.ts` como helper compartido; `src/proxy.ts` debe eliminarse para evitar duplicación.
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

- **SC-001**: Existe `src/middleware.ts` que exporta `middleware` y `config.matcher`, y Next.js lo ejecuta (se puede verificar con un log temporal o un header inyectado en respuesta).
- **SC-002**: Petición sin sesión a `/dashboard/admin` → redirect a `/login` proveniente del middleware, no solo del layout.
- **SC-003**: Petición sin sesión a `/api/admin/*` → 401 proveniente del middleware.
- **SC-004**: Los 5 roles probados acceden a sus rutas permitidas y son redirigidos en rutas prohibidas sin lockout.
- **SC-005**: Rutas públicas permiten tráfico anónimo.
- **SC-006**: `npm run test` continúa pasando con 0 tests nuevos fallidos.
- **SC-007**: `src/proxy.ts` queda eliminado; `src/lib/proxy.ts` sigue como helper.

---

## Assumptions

- El runtime de Next.js soporta `src/middleware.ts` con export `middleware` (confirmado en documentación oficial).
- El código de verificación JWT es edge-safe (usa `jose` y solo APIs de runtime edge).
- No se requieren cambios en el modelo de datos de Prisma.
- El layout admin y los endpoints mantendrán `verifyAuth` como defensa en profundidad.
- El matcher de Next.js middleware soporta arrays de patrones y excepciones por regex.

---

## Implementación

*(Se documentará tras completar el trabajo, siguiendo el formato de cierre del Spec-Kit.)*
