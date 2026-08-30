# Feature Specification: Fix reset password no limpia `debeCambiarPassword` (SPEC-315)

**Feature Branch**: `work/pi-SPEC-315-fix-reset-password-flag`
**SPEC**: 315
**Created**: 2026-08-29
**Status**: PLANEADO
**Input**: INSTRUCTIVO-002-PI-215 · bug prod cazado por Jelkin 2026-08-29 23:40 COT

Impacto en arquitectura: cambio de 1 línea en `src/lib/dal/services/autenticacion.ts` (método `restablecerPassword`). Cierra la asimetría entre los 2 caminos de cambio de clave: `cambiarPassword` (:157) ya limpia `debeCambiarPassword`; `restablecerPassword` (reset por email con token propio) no lo hacía. Cero migración (el campo `Usuario.debeCambiarPassword` ya existe), cero librería, cero cambio de schema, cero cambio a rutas o guards. Los 8 callsites que escriben `true` (altas administrativas · clave temporal) se conservan intactos por diseño.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Usuario con flag de cambio obligatorio hace reset por email y entra directo (Priority: P1)

Un usuario dado de alta administrativamente tiene `debeCambiarPassword = true` (debe cambiar su clave temporal al entrar). Olvida su clave y pide un reset por email. Recibe el enlace, abre `/recuperar/<token>`, ingresa su nueva clave definitiva (el formulario NO pide la anterior) y confirma. Antes del fix: `restablecerPassword` guarda el hash pero NO limpia el flag → al hacer login, el guard lo redirige a `/cambiar-password`, que pide contraseña ACTUAL + nueva → el usuario percibe un loop ("ya cambié mi clave, ¿por qué me la pide otra vez?"). Después del fix: el flag se limpia en el reset, el login lleva al usuario directo al dashboard.

**Why this priority**: Bug crítico en producción que bloquea a usuarios reales (Jelkin lo reportó en vivo). Es la razón de ser de la SPEC.

**Independent Test**: sembrar un usuario con `debeCambiarPassword = true` + un token de recuperación válido. Invocar `restablecerPassword(token, nuevaClave)`. Verificar en BD que `debeCambiarPassword` quedó en `false`.

**Acceptance Scenarios**:

1. **Given** un usuario con `debeCambiarPassword = true` y un token de recuperación activo, **When** se invoca `restablecerPassword(token, nuevaClave)`, **Then** el usuario queda con `debeCambiarPassword = false` y `passwordHash` actualizado.
2. **Given** el mismo escenario, **When** el reset completa, **Then** el token queda marcado como usado y los campos `intentosFallidos=0`, `estado="activo"`, `bloqueadoHasta=null` se actualizan como antes (sin regresión).
3. **Given** un token inválido o expirado, **When** se invoca `restablecerPassword`, **Then** devuelve `{ ok: false, tipo: "invalido" }` y NO modifica ningún usuario (comportamiento preservado).

---

### Edge Cases

- **Usuario con `debeCambiarPassword = false` que hace reset**: el fix pone `false` sobre `false` — idempotente, sin efecto adverso.
- **Reset administrativo** (`api/admin/padres/[id]/restablecer-password/route.ts:53`): camino DISTINTO, escribe `debeCambiarPassword = true` a propósito (el admin genera clave temporal). NO se toca — el fix solo afecta `restablecerPassword` del servicio (reset por email con token propio).
- **Token válido pero usuario borrado**: `restablecerPassword` ya maneja `{ ok: false, tipo: "sin_usuario" }` antes de tocar la BD. Sin cambio.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El método `restablecerPassword` en `src/lib/dal/services/autenticacion.ts` DEBE incluir `debeCambiarPassword: false` en el `actualizar` del usuario dentro de la transacción, junto a los campos existentes (`passwordHash`, `intentosFallidos`, `estado`, `bloqueadoHasta`).
- **FR-002**: El fix NO DEBE modificar ningún otro callsite de `debeCambiarPassword`. Los 8 sitios que escriben `true` (altas administrativas) y el reset administrativo de padres se conservan intactos.
- **FR-003**: El comportamiento de error (`token inválido`, `sin usuario`) DEBE preservarse sin cambios: no se modifica ningún usuario cuando el token no resuelve.

### Key Entities

- **`Usuario.debeCambiarPassword`** (campo booleano existente): `true` obliga al guard a redirigir a `/cambiar-password`. Se limpia (`false`) cuando el usuario elige su clave definitiva, ya sea vía `cambiarPassword` o (con este fix) vía `restablecerPassword`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras un reset por email de un usuario con `debeCambiarPassword=true`, una consulta a BD (`SELECT "debeCambiarPassword"`) devuelve `false`. Verificable en test de integración y en prod post-deploy.
- **SC-002**: Los 4 campos que el reset ya actualizaba (`passwordHash`, `intentosFallidos`, `estado`, `bloqueadoHasta`) siguen con los mismos valores esperados tras el fix (sin regresión). Verificable en test.
- **SC-003**: Un reset con token inválido no modifica ningún usuario ni marca ningún token (comportamiento preservado). Verificable en test.

---

## Assumptions

- El worktree parte de `origin/main @ ce03c2bdf` (post SPEC-313). El campo `debeCambiarPassword` ya existe en el schema.
- El patrón correcto ya está en `cambiarPassword` (:157) — se replica la misma clave en `restablecerPassword`.
- Candado 22 v5 de Fábrica confirmó que este es el único sitio a modificar (27 callsites enumerados en el instructivo).
- El reset administrativo de padres (que escribe `true`) es un camino distinto y correcto por diseño.
