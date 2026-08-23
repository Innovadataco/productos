> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo). Puede implementarse en paralelo con SPEC-202/203 si 201 está verde.

# Feature Specification: SPEC-204 — Piloto Migración Bienvenida Colegio (002-PI-101)

**Feature Branch**: `work/002-PI-motor-notif-lote1`

**Created**: 2026-08-22

**Status**: `PLANEADO`

**Input**: 002-PI-101. Piloto de migración del primer envío transaccional al motor de notificaciones: reemplazar `enviarEmailBienvenidaColegio` de `src/lib/email.ts` por una regla + plantilla del motor y llamada a `motor.programar(...)`. Fuente: [BRIEF-MOTOR-NOTIFICACIONES.md](../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-MOTOR-NOTIFICACIONES.md) §6, §7, §8.

Objetivo: validar en producción el uso real del motor con un caso transaccional simple, dejando de usar la función directa de `email.ts`. La regla debe ser obligatoria (`obligatoria: true`) y dispararse inmediatamente (`+0m`) al crear/restablecer un colegio.

Impacto en arquitectura: cambios en `prisma/seed.ts` (nueva regla/plantilla), `src/app/api/admin/colegios/route.ts`, `src/app/api/admin/colegios/[id]/reenviar-email/route.ts`, y tests. No se toca `src/lib/ai/**`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Regla y plantilla de bienvenida colegio (Priority: P1)

Como sistema quiero que el email de bienvenida institucional sea una regla del motor con plantilla editable.

**Why this priority**: primer paso de migración de alertas al motor.

**Independent Test**: seed crea regla `colegio.bienvenida` + plantilla; motor.programar la dispara.

**Acceptance Scenarios**:

1. **Given** `prisma/seed.ts`, **When** corre, **Then** crea plantilla `colegio.bienvenida.email` con asunto y cuerpo markdown con variables `{{email}}`, `{{password}}`, `{{url}}`.
2. **Given** el seed, **When** corre, **Then** crea regla `colegio.bienvenida` para rol `SCHOOL_ADMIN`, offset `+0m`, canal `EMAIL`, `obligatoria: true`.
3. **Given** la regla, **When** se dispara, **Then** el motor envía el email con las variables sustituidas.

### User Story 2 — Reemplazo de llamada directa (Priority: P1)

Como desarrollador quiero que las rutas de creación y reenvío de credenciales de colegio usen el motor en lugar de `enviarEmailBienvenidaColegio`.

**Why this priority**: desacopla el envío del proveedor y habilita tracking/auditoría.

**Independent Test**: tests de `POST /api/admin/colegios` y `POST /api/admin/colegios/:id/reenviar-email` verifican que se llama al motor.

**Acceptance Scenarios**:

1. **Given** `POST /api/admin/colegios` crea un colegio, **When** se genera contraseña temporal, **Then** llama `motor.programar({ evento: "colegio.bienvenida", destinatarios: [{ email, variables: { email, password, url } }] })`.
2. **Given** `POST /api/admin/colegios/:id/reenviar-email`, **When** se genera nueva contraseña, **Then** usa el motor para enviar bienvenida.
3. **Given** la migración, **When** se busca `enviarEmailBienvenidaColegio` en `src/`, **Then** solo aparece en `src/lib/email.ts` (función legacy conservada por compatibilidad) o se elimina si ningún otro código la usa.

### User Story 3 — Preservar comportamiento (Priority: P1)

Como usuario final quiero que el email recibido sea idéntico en contenido al anterior.

**Why this priority**: no regresión visible.

**Independent Test**: comparar texto renderizado con la función anterior.

**Acceptance Scenarios**:

1. **Given** la plantilla renderizada, **When** se compara con el texto de `enviarEmailBienvenidaColegio`, **Then** el asunto y cuerpo son equivalentes.
2. **Given** un envío real, **When** se recibe el email, **Then** contiene usuario, contraseña temporal y enlace al login.

---

## Functional Requirements

FR-001: El seed DEBE crear la plantilla `colegio.bienvenida.email` con asunto "Tu cuenta institucional está lista" y cuerpo markdown equivalente al texto actual de `enviarEmailBienvenidaColegio`.

FR-002: El seed DEBE crear la regla `colegio.bienvenida` para evento `colegio.bienvenida`, rol `SCHOOL_ADMIN`, offset `+0m`, canal `EMAIL`, `obligatoria: true`.

FR-003: `POST /api/admin/colegios` DEBE usar `motor.programar` en lugar de `enviarEmailBienvenidaColegio`.

FR-004: `POST /api/admin/colegios/[id]/reenviar-email` DEBE usar `motor.programar` en lugar de `enviarEmailBienvenidaColegio`.

FR-005: Los tests de ambas rutas DEBEN actualizarse para mockear/miden la llamada al motor.

FR-006: La función `enviarEmailBienvenidaColegio` en `src/lib/email.ts` DEBE marcarse como `@deprecated` o eliminarse si no quedan usos.

FR-007: No se DEBE tocar `src/lib/ai/**`.

---

## Success Criteria

- Regla y plantilla creadas por seed.
- Ambas rutas de colegio usan `motor.programar`.
- Email enviado conserva el mismo contenido.
- Tests pasan.
- CI verde 6/6.

---

## Assumptions

- SPEC-201 implementada y aprobada.
- El motor puede enviar emails inmediatamente (`+0m`) y el worker los procesa sin demora apreciable (o se envían síncronamente en v1 si el worker no corre).
- `SCHOOL_ADMIN` es el rol destinatario de la bienvenida institucional.

---

## Implementación

Ver `plan.md` y `tasks.md`. Se completará tras aprobación de ZEUS.
