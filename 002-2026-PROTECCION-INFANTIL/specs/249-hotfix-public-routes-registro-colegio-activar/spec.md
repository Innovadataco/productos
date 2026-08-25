# Feature Specification: Hotfix — PUBLIC_ROUTES debe incluir /registro-colegio y /activar

**Feature Branch**: `work/002-PI-152`
**SPEC**: 249
**Created**: 2026-08-25
**Status**: DESARROLLO
**Input**: INSTRUCTIVO-002-PI-152 · SPEC-240 US1/US2 (rutas públicas de registro y activación de colegio) · D-37

Impacto en arquitectura: modifica únicamente `src/lib/proxy.ts` para extender `PUBLIC_ROUTES` con `/registro-colegio` y `/activar`, y agrega test de regresión en `src/lib/e2e/journeys/aislamiento.test.ts` (o `src/lib/proxy.test.ts`) para garantizar que un usuario anónimo alcanza ambas rutas sin redirect. Sin cambios de schema, sin migraciones, sin tocar `src/lib/ai/**`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Anónimo accede a /registro-colegio (Priority: P1)

Un rector que aún no tiene cuenta debe poder abrir `/registro-colegio` sin ser redirigido a `/login`, tal como lo exige SPEC-240 FR-001.

**Why this priority**: Es el punto de entrada autogestionado para colegios; el deploy `8730b1d1` lo rompió y bloquea onboarding institucional.

**Independent Test**: `proxy(new NextRequest('http://localhost:5005/registro-colegio'))` devuelve `undefined` (no redirect) para sesión anónima.

**Acceptance Scenarios**:

1. **Given** un usuario anónimo, **When** accede a `/registro-colegio`, **Then** el proxy NO redirige a `/login`.
2. **Given** un usuario autenticado con cualquier rol, **When** accede a `/registro-colegio`, **Then** el proxy NO lo devuelve a `/login` (puede seguir al flujo).
3. **Given** un usuario anónimo, **When** accede a `/registro-colegio/paso-2`, **Then** el proxy NO redirige a `/login` (el prefijo queda protegido por `PUBLIC_ROUTES`).

### User Story 2 — Anónimo accede a /activar con token (Priority: P1)

Un rector invitado debe poder abrir `/activar?token=XYZ` sin autenticación previa para definir su contraseña, tal como lo exige SPEC-240 US2.

**Why this priority**: Es el consumo del link de invitación enviado por admin; sin esta ruta pública el pre-registro admin queda roto.

**Independent Test**: `proxy(new NextRequest('http://localhost:5005/activar?token=TOKEN'))` devuelve `undefined` para sesión anónima.

**Acceptance Scenarios**:

1. **Given** un usuario anónimo con un token válido en la query string, **When** accede a `/activar?token=XYZ`, **Then** el proxy NO redirige a `/login`.
2. **Given** un usuario anónimo sin token, **When** accede a `/activar`, **Then** el proxy NO redirige a `/login` (la página valida el token y muestra link expirado).
3. **Given** un token ya consumido o inexistente, **When** se accede a `/activar`, **Then** la página sigue alcanzable para mostrar el estado de link expirado.

---

## Edge Cases

- **Prefijos de PUBLIC_ROUTES**: `/registro-colegio` debe preceder a cualquier sub-ruta estática; el matching es por prefijo en `proxy.ts`, por lo que `/registro-colegio` cubre `/registro-colegio/paso-2`.
- **Token manipulado**: el proxy solo decide acceso; la validez del token se verifica server-side en la página `/activar`.
- **D-37 — rutas huérfanas**: al aplicar el fix se barrerán las rutas `src/app/**/page.tsx` (o `route.ts`) nuevas del Lote 1 (240–243) para asegurar que no quede ninguna otra ruta pública sin incluir en `PUBLIC_ROUTES`.
- **No regresión en aislamiento**: las rutas privadas (`/dashboard`, `/mis-reportes`, `/api/admin/**`) siguen bloqueadas para anónimos.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE incluir `/registro-colegio` en `PUBLIC_ROUTES` de `src/lib/proxy.ts`.
- **FR-002**: El sistema DEBE incluir `/activar` en `PUBLIC_ROUTES` de `src/lib/proxy.ts`.
- **FR-003**: El sistema DEBE agregar un test de regresión que verifique que `proxy()` no redirige a `/login` para `/registro-colegio` y `/activar` con sesión anónima.
- **FR-004**: El sistema DEBE ejecutar un barrido D-37 sobre `src/app/**` para detectar rutas públicas recientes no incluidas en `PUBLIC_ROUTES`.
- **FR-005**: El sistema NO DEBE modificar ningún otro mecanismo de autorización ni agregar middleware global.

### Key Entities

- `src/lib/proxy.ts`: lista `PUBLIC_ROUTES`.
- `src/lib/e2e/journeys/aislamiento.test.ts` (y/o `src/lib/proxy.test.ts`): cobertura de regresión.

---

## Success Criteria *(mandatory)*

- **SC-001**: `curl -I /registro-colegio` sin cookie devuelve `200` (no `307` a `/login`).
- **SC-002**: `curl -I /activar?token=DUMMY` sin cookie devuelve `200` (no `307` a `/login`).
- **SC-003**: `npm run test -- aislamiento.test.ts` (o `proxy.test.ts`) pasa el nuevo caso de regresión.
- **SC-004**: El barrido D-37 no reporta rutas huérfanas públicas del Lote 1.
- **SC-005**: CI verde 11/11 tras el fix.

---

## Assumptions

- SPEC-240 ya creó las páginas `/registro-colegio` y `/activar`; este hotfix solo corrige su clasificación en `PUBLIC_ROUTES`.
- La validación del token de activación sigue siendo responsabilidad de la página `/activar` (no del proxy).
- El fix se aplica directamente sobre `feature/001-scaffolding` (HEAD `8730b1d1`) sin dependencias adicionales.
