# Feature Specification: Hotfix — evitar loop infinito en /consentimiento

**Feature Branch**: `work/002-PI-153`
**SPEC**: 250
**Created**: 2026-08-25
**Status**: DESARROLLO
**Input**: INSTRUCTIVO-002-PI-153 · I-111 · SPEC-241 (guard consentimiento en layouts autenticados)

Impacto en arquitectura: modifica únicamente `src/lib/proxy.ts` para extender `SESION_ROUTES` con `/consentimiento` y `/api/consentimiento`, de modo que cualquier rol autenticado pueda aterrizar en la página de consentimiento informado sin que el proxy lo redirija a `/login` y dispare el loop `home → guard → /consentimiento → login → home`. Agrega tests de regresión en `src/lib/proxy.test.ts`. Sin cambios de schema, sin migraciones, sin tocar `src/lib/ai/**`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — SCHOOL_ADMIN acepta el convenio institucional sin bucle (Priority: P1)

Un rector autenticado que aún no ha aceptado el consentimiento institucional debe poder abrir `/consentimiento` para aceptarlo. Sin este hotfix, el proxy niega `/consentimiento` a `SCHOOL_ADMIN` y entra en `ERR_TOO_MANY_REDIRECTS`.

**Why this priority**: Bloquea el onboarding de colegios en producción tras el deploy `d070e8c7`.

**Independent Test**: `proxy(new NextRequest('/consentimiento'))` con token `SCHOOL_ADMIN` devuelve `200` (no `307`).

**Acceptance Scenarios**:

1. **Given** un `SCHOOL_ADMIN` autenticado con consentimiento pendiente, **When** accede a `/consentimiento`, **Then** el proxy NO redirige.
2. **Given** un `SCHOOL_ADMIN` autenticado con consentimiento vigente, **When** accede a `/consentimiento`, **Then** la página misma lo redirige a `/dashboard/colegio` (sin intervención del proxy).
3. **Given** un `SCHOOL_ADMIN` autenticado, **When** el modal acepta el consentimiento vía `POST /api/consentimiento/aceptar`, **Then** el proxy permite la llamada.

### User Story 2 — PARENT y COMITE_CONVIVENCIA acceden a /consentimiento (Priority: P1)

El guard de consentimiento aplica a todos los roles autenticados; por tanto `/consentimiento` y su API deben ser alcanzables para `PARENT`, `COMITE_CONVIVENCIA` y roles internos sin disparar el loop.

**Why this priority**: El guard de SPEC-241 está en layouts compartidos (`/dashboard/padre`, `/dashboard/colegio`, `/dashboard/admin`, `/dashboard/colegio/comite`).

**Independent Test**: `proxy(new NextRequest('/consentimiento'))` con tokens de `PARENT` y `COMITE_CONVIVENCIA` devuelve `200`.

**Acceptance Scenarios**:

1. **Given** un `PARENT` autenticado con consentimiento pendiente, **When** accede a `/consentimiento`, **Then** el proxy NO redirige.
2. **Given** un `COMITE_CONVIVENCIA` autenticado con consentimiento pendiente, **When** accede a `/consentimiento`, **Then** el proxy NO redirige.
3. **Given** un `ADMIN` o `OPERADOR` autenticado, **When** accede a `/consentimiento`, **Then** el proxy NO redirige.

---

## Edge Cases

- **Anónimo en /consentimiento**: la página `/consentimiento` ya redirige a `/login` server-side; el proxy no necesita tratarla como pública. El fix la incluye en `SESION_ROUTES` (rutas de cualquier rol autenticado), no en `PUBLIC_ROUTES`.
- **/api/consentimiento/aceptar**: el POST de aceptación debe estar permitido para cualquier rol autenticado; se protege con `SESION_ROUTES` usando el prefijo `/api/consentimiento`.
- **No se abre el árbol completo del colegio ni del admin**: `SESION_ROUTES` solo abre `/consentimiento` y `/api/consentimiento`, no introduce nuevas rutas de negocio.
- **D-37**: se barrerán rutas recientes similares (`/cambiar-password` ya está en `SESION_ROUTES`) para confirmar que no hay otras huérfanas post-login.
- **Loop similar con /cambiar-password**: este patrón ya fue resuelto en I-35/I-35b incluyendo la ruta y su API en `SESION_ROUTES`; se replica el mismo tratamiento.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE incluir `/consentimiento` en `SESION_ROUTES` de `src/lib/proxy.ts`.
- **FR-002**: El sistema DEBE incluir `/api/consentimiento` en `SESION_ROUTES` de `src/lib/proxy.ts`.
- **FR-003**: El sistema DEBE agregar tests de regresión que verifiquen que `SCHOOL_ADMIN`, `PARENT` y `COMITE_CONVIVENCIA` alcanzan `/consentimiento` y `/api/consentimiento/aceptar` sin redirect del proxy.
- **FR-004**: El sistema DEBE ejecutar un barrido D-37 sobre `src/app/**` para detectar rutas post-login recientes no incluidas en `SESION_ROUTES` u otra allowlist apropiada.
- **FR-005**: El sistema NO DEBE modificar los guards de consentimiento ni agregar middleware global.

### Key Entities

- `src/lib/proxy.ts`: lista `SESION_ROUTES` y funciones `esRutaPermitida*`.
- `src/lib/proxy.test.ts`: cobertura de regresión.

---

## Success Criteria *(mandatory)*

- **SC-001**: `proxy()` con sesión `SCHOOL_ADMIN` sobre `/consentimiento` devuelve `200` (no `307`).
- **SC-002**: `proxy()` con sesión `PARENT` sobre `/consentimiento` devuelve `200`.
- **SC-003**: `proxy()` con sesión `COMITE_CONVIVENCIA` sobre `/consentimiento` devuelve `200`.
- **SC-004**: `proxy()` con sesión de cualquier rol autenticado sobre `/api/consentimiento/aceptar` devuelve `200` (la API valida sesión y devuelve error de negocio, no redirect).
- **SC-005**: `npm run test -- src/lib/proxy.test.ts` pasa los nuevos casos de regresión.
- **SC-006**: CI verde 11/11 tras el fix.

---

## Assumptions

- SPEC-241 ya creó la página `/consentimiento` y el endpoint `POST /api/consentimiento/aceptar`; este hotfix solo corrige la clasificación en el proxy.
- La redirección post-aceptación y la redirección de anónimos a `/login` siguen siendo responsabilidad de la página y de la API, no del proxy.
- El fix se aplica directamente sobre `feature/001-scaffolding` (HEAD `d070e8c7`) sin dependencias adicionales.
