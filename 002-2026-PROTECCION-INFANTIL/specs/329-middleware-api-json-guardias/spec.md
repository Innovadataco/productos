# Feature Specification: Middleware — JSON 403 en guardianes de estado para /api/ (SPEC-329)

**Feature Branch**: `work/pi-SPEC-329-middleware-api-json-guardias`

**Created**: 2026-08-30

**Status**: IMPLEMENTADO

**Radicado**: 002-PI-229 · SPEC-329 · 🔴 hotfix de producción · regresión destapada por A-56 (defecto latente de SPEC-287)

**Impacto en arquitectura:** Solo `middleware.ts` (raíz). Cero cambios de esquema, cero `src/lib/**`. Define el contrato de respuesta del middleware para rutas `/api/**` gateadas por estado: en vez de un `redirect()` 302 a una pantalla HTML, devuelven `NextResponse.json({ error: { message, code, redirectTo } }, { status: 403 })` — espejo del Paso 2 (que ya hacía JSON 401 para `/api/`). Las rutas de pantalla (no-api) conservan su redirect 302/307 sin cambios. No toca las listas de exención, el orden de los guardianes ni la lógica de estado.

**Input**: A-56 (002-PI-218) revivió tres guardianes de estado en `middleware.ts`. El Paso 2 (sesión) distingue rutas de API (JSON 401), pero los Pasos 4/5/6 (consentimiento, cambio-de-password, vigencia) hacen `redirect()` para CUALQUIER ruta, incluidas `/api/**`. Un `POST /api/**` gateado recibe 302 → el `fetch` lo sigue → 200 + HTML: el cliente no distingue éxito de bloqueo. Lo cazó Calidad con `activar-freemium`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un POST a una API gateada recibe un bloqueo legible por máquina (Priority: P1)

Cuando un cliente hace `POST /api/**` a una ruta gateada por consentimiento pendiente, cambio de contraseña obligatorio o vigencia vencida, el sistema responde con un error JSON 403 que incluye un `code` legible por máquina y un `redirectTo` (a dónde navegaría una pantalla), en vez de un redirect 302 a HTML que el `fetch` seguiría silenciosamente.

**Why this priority**: Está en producción ahora y rompe toda API del área del padre y del colegio detrás de un guardián de estado (el cliente cree que tuvo éxito cuando fue bloqueado).

**Independent Test**: `POST /api/<gateado>` con cada estado que dispara un guardián → 403 + JSON con `code`; el cuerpo no es HTML.

**Acceptance Scenarios**:

1. **Given** un usuario con consentimiento pendiente, **When** hace `POST /api/padre/…`, **Then** recibe 403 con `code: "CONSENTIMIENTO_REQUERIDO"` y `redirectTo: "/consentimiento"`.
2. **Given** un usuario con cambio de contraseña obligatorio, **When** hace `POST /api/…`, **Then** 403 con `code: "CAMBIO_PASSWORD_REQUERIDO"`.
3. **Given** un usuario sin vigencia (no ACTIVA ni EN_GRACIA), **When** hace `POST /api/…`, **Then** 403 con `code: "VIGENCIA_REQUERIDA"`.

### User Story 2 - Las pantallas siguen redirigiendo igual (Priority: P1)

Las rutas NO-API (`/dashboard/**`, etc.) gateadas por los mismos guardianes siguen recibiendo su redirect 302/307 a la pantalla correspondiente — el arreglo NO cambia el comportamiento de las pantallas.

**Why this priority**: Contraprueba obligatoria — romper el redirect de las pantallas sería una regresión inversa peor que el bug original.

**Acceptance Scenarios**:

1. **Given** un usuario con consentimiento pendiente, **When** hace `GET /dashboard/padre`, **Then** sigue recibiendo un redirect al `destino` de consentimiento (no un JSON).

### Edge Cases

- Rutas exentas de cada guardián (`/api/consentimiento`, `/api/auth/cambiar-password`, `/api/pagos`, etc.) siguen exentas — el fix no toca las listas de exención.
- Paso 2 (sesión sin JWT) no se toca: sigue devolviendo JSON 401 para `/api/`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Para una ruta `/api/**` gateada por el guardián de consentimiento, el middleware DEBE responder 403 JSON con `code: "CONSENTIMIENTO_REQUERIDO"` y `redirectTo` = el destino de consentimiento, sin redirect.
- **FR-002**: Para una ruta `/api/**` gateada por el guardián de cambio-de-password, 403 JSON con `code: "CAMBIO_PASSWORD_REQUERIDO"` y `redirectTo` = destino de cambio de password.
- **FR-003**: Para una ruta `/api/**` gateada por el guardián de vigencia, 403 JSON con `code: "VIGENCIA_REQUERIDA"` y `redirectTo` = destino de vigencia por rol.
- **FR-004**: Para una ruta NO-API gateada por cualquiera de los tres guardianes, el middleware DEBE conservar el `redirect()` a la pantalla exactamente como estaba (302/307).
- **FR-005**: El `message` de cada 403 DEBE ser legible para un humano, en español, sin tecnicismos (coherente con A-62).
- **FR-006**: El fix NO DEBE alterar el Paso 2 (401), las listas de exención, el orden de los guardianes ni la lógica de estado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los `POST /api/**` gateados por los tres guardianes devuelve 403 JSON con `code` (hoy: 302 → 200 + HTML).
- **SC-002**: El 100% de las rutas de pantalla gateadas conserva su redirect (sin regresión inversa).
- **SC-003**: `code` estable y legible por máquina para cada guardián, con `redirectTo` para clientes que quieran navegar.

## Assumptions

- El fix es puramente la ramificación api/no-api dentro de cada guardián (Pasos 4/5/6), espejo del Paso 2.
- No hay rollback de A-56 (arregla algo más grave); este hotfix es acotado.
- La evidencia §6b en vivo (curl contra prod tras el deploy, `activar-freemium` real) la cierra el CEO al desplegar.
