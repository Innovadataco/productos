# Feature Specification: Hotfix — link-bi redirect usa host público real

**Feature Branch**: `work/pi-SPEC-313-hotfix-link-bi-host`

**Created**: 2026-08-29

**Status**: PLANEADO

**Input**: User description: "Hotfix post-deploy SPEC-310: el redirect a /login de /api/auth/link-bi devuelve Location con https://0.0.0.0:3000 (bind interno Docker) en vez del host público, porque request.url en Next.js dentro de Docker refleja el bind interno, no el host real del cliente que llega por el proxy. Fix: usar x-forwarded-host con fallback a PI_BASE_URL con fallback a hardcode https://pi.innovadataco.com. Compuerta §4 ligera, hotfix express autorizado por CEO IDC."

**Impacto en arquitectura:** Fix quirúrgico de 1 archivo (`route.ts`), sin cambio de contrato ni de modelo de datos. Agrega una variable de entorno opcional (`PI_BASE_URL`) con fallback seguro. No toca el segundo redirect (a BI, ya correcto) ni el payload del JWT efímero.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El redirect a /login siempre apunta a un host público resoluble (Priority: P1)

Un usuario sin sesión PI llega a `/api/auth/link-bi` (desde el guard de BI o directamente). Hoy en producción (Docker detrás de proxy), el redirect a `/login` usa `request.url`, que dentro del contenedor refleja el bind interno (`0.0.0.0:3000`), no el host público (`pi.innovadataco.com`) — el navegador no puede resolverlo y el flujo SSO-like se rompe.

**Why this priority**: Bloquea completamente el flujo E2E de I-30 (puente PI→BI) para cualquier usuario sin sesión PI activa — exactamente el caso más común (primera visita).

**Independent Test**: Llamar el endpoint sin sesión válida simulando un proxy real (header `x-forwarded-host`) y verificar que el `Location` del redirect usa ese host, no `request.url`. Sin el header, verificar fallback a `PI_BASE_URL` y luego a un valor hardcodeado — nunca `0.0.0.0`.

**Acceptance Scenarios**:

1. **Given** una petición sin sesión válida con header `x-forwarded-host: pi.innovadataco.com` (y `x-forwarded-proto`), **When** se llama el endpoint, **Then** el `Location` del redirect a `/login` usa `https://pi.innovadataco.com` como base.
2. **Given** una petición sin sesión válida, sin `x-forwarded-host`, con `PI_BASE_URL` configurada, **When** se llama el endpoint, **Then** el `Location` usa esa variable de entorno como base.
3. **Given** una petición sin sesión válida, sin `x-forwarded-host` ni `PI_BASE_URL`, **When** se llama el endpoint, **Then** el `Location` usa el fallback hardcodeado `https://pi.innovadataco.com` — nunca el host interno de `request.url`.

### Edge Cases

- El segundo redirect del endpoint (sesión válida → BI) no se toca: ya usa `BI_BASE_URL` de entorno correctamente, sin este bug.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE construir la base del redirect a `/login` usando, en orden de prioridad: (1) header `x-forwarded-host` + `x-forwarded-proto` (o `https` si no viene), (2) variable de entorno `PI_BASE_URL`, (3) valor hardcodeado `https://pi.innovadataco.com`.
- **FR-002**: El sistema NUNCA DEBE usar `request.url` como base de ese redirect (causa raíz del bug: refleja el bind interno de Docker, no el host público).
- **FR-003**: El sistema NO DEBE modificar el redirect a BI (ya usa `BI_BASE_URL` correctamente) ni el contrato del JWT efímero.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El `Location` del redirect a `/login` nunca contiene `0.0.0.0`, en ningún escenario de entrada (con/sin header forwarded, con/sin env).
- **SC-002**: Con `x-forwarded-host` presente (caso real de producción tras el proxy), el `Location` usa ese host exacto.
- **SC-003**: Cero regresión: el redirect a BI (sesión válida) y el resto del endpoint se comportan exactamente igual que en SPEC-310.

## Assumptions

- El proxy de producción (Cloudflare/Traefik) ya envía `x-forwarded-host`/`x-forwarded-proto` — no se verifica en este hotfix (fuera de alcance; si no los envía, el fallback a `PI_BASE_URL` cubre el caso).
- `login/route.ts` puede tener el mismo patrón de bug con `request.url`, pero está fuera de alcance de este hotfix (candado explícito del instructivo) — se reporta como hallazgo aparte si se confirma, no se corrige aquí.
