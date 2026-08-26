# Feature Specification: Barrido de permisos — operador limpio, revelación auditada

**Feature Branch**: `work/002-PI-ciclo-operador`
**SPEC**: 263
**Radicado**: 002-PI-166
**Created**: 2026-08-26
**Status**: DESARROLLO
**Input**: INSTRUCTIVO-002-PI-164 · BRIEF-CICLO-OPERADOR-Y-SPAM v1.0 §4.3 §4.4 §4.5 §4.6 §5.3 §5.4 §5.5 · I-118 · I-119 · I-120 · I-121

Impacto en arquitectura: cuatro cambios de permisos coordinados, todos declarativos y auditables:

1. `expediente_revelar_original` se otorga a `OPERADOR` y `COMITE_VALIDACION` (hoy solo `ADMIN`). El endpoint `POST /api/admin/reportes/[id]/revelar-original` y el registro `AuditLog TEXTO_ORIGINAL_REVELADO` **no cambian** — la regla dura sigue siendo: botón explícito + auditoría.
2. `pagos_admin` se **quita** de `OPERADOR` en `seed-modulos-grants.ts` y se emite **script de revocación explícita SQL** (patrón SPEC-128) porque `sync-modulos-grants.ts` es aditivo y nunca revoca (candado del INSTRUCTIVO §5.5).
3. El guard `requiereConsentimientoActual` en `src/app/dashboard/admin/layout.tsx` deja de aplicarse a `OPERADOR`, `COMITE_VALIDACION` y demás roles internos. Solo aplica al `PARENT` (que ya lo maneja `dashboard/layout.tsx`).
4. `AdminReportesTable` oculta el botón "Ver proceso" cuando el rol pertenece a `OPERADOR_ROLES` (usa `esRolConBandejaPropia`, ya presente en el mismo componente).

Además, la SPEC entrega un pequeño script idempotente que **audita y depura** registros de `AuditConsentimiento` firmados por roles internos (§5.4). Sin migraciones.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Operador y comité pueden revelar el original — con registro (Priority: P1)

Un OPERADOR asignado a un caso pulsa "Ver texto original". Se muestra el original y se registra en `AuditLog` con `TEXTO_ORIGINAL_REVELADO`, usuario y hora. Igual para `COMITE_VALIDACION` en casos escalados. `PARENT` autenticado sobre sus reportes NO tiene ese botón y NO puede llegar al endpoint sin permiso.

**Why this priority**: sin este permiso, el operador no puede validar spam o dudas de contexto y el ciclo queda cerrado.

**Independent Test**:
- Seed: 1 OPERADOR con `expediente_revelar_original` activo, 1 reporte `POSIBLE_SPAM` asignado a él.
- `GET /api/admin/reportes-revision/:id` con OPERADOR devuelve `puedeRevelarOriginal: true`.
- `POST /api/admin/reportes/:id/revelar-original` responde 200 con el texto y crea `AuditLog { accion: "TEXTO_ORIGINAL_REVELADO", usuarioId, tipoRecurso: "Reporte", recursoId }`.

**Acceptance Scenarios**:

1. **Given** OPERADOR con grant `expediente_revelar_original` y caso asignado, **When** revela el original, **Then** el texto se muestra y queda `AuditLog TEXTO_ORIGINAL_REVELADO`.
2. **Given** COMITE_VALIDACION con caso escalado, **When** revela el original, **Then** mismo comportamiento.
3. **Given** PARENT autenticado, **When** intenta llamar al endpoint sobre su propio reporte, **Then** responde 403 y NO se muestra el texto ni se sube el flag.
4. **Given** cualquier superficie de padre (`/dashboard/mis-reportes/:num`, ficha de reporte del padre), **When** se renderiza, **Then** NO aparece control alguno que muestre el original sin pasar por el endpoint auditado.

### User Story 2 — Pagos desaparece del menú del operador — verificado en BD (Priority: P1)

Un OPERADOR entra al panel; el módulo "Pagos" no aparece en el menú ni en la BD (`PermisoModulo` inactivo). El cambio persiste tras el próximo `sync-modulos-grants.ts` porque también se editó la fuente única.

**Why this priority**: la revocación en semilla NO revoca en prod. Sin script explícito, el CEO seguirá viendo Pagos.

**Independent Test**:
- Seed prod-like con `PermisoModulo { rol: "OPERADOR", modulo: "pagos_admin", activo: true }`.
- Ejecutar `scripts/revocar-grants-pagos-operador.ts` deja el grant en `activo: false`.
- `modulosPermitidosParaRol("OPERADOR")` no incluye `pagos_admin`.

**Acceptance Scenarios**:

1. **Given** BD con grant OPERADOR→pagos_admin activo, **When** corre el script, **Then** el grant queda `activo: false` y el script reporta `{ revocados: 1, yaInactivos: 0 }`.
2. **Given** BD ya limpia, **When** corre el script otra vez, **Then** `{ revocados: 0, yaInactivos: 1 }` (idempotente).
3. **Given** el seed nuevo (`clavesPorRol.OPERADOR = ["bandeja_reportes"]`), **When** se ejecuta `sync-modulos-grants.ts` después, **Then** el grant de pagos NO se recrea (sync es aditivo, no revoca).

### User Story 3 — Consentimiento solo se pide al titular (Priority: P1)

Un OPERADOR o COMITE_VALIDACION entra al panel; NO es enviado a `/consentimiento`. Un PARENT sí lo sigue siendo (guard vigente en `dashboard/layout.tsx`).

**Independent Test**: mock `verifyToken` devuelve `{ rol: "OPERADOR" }` → `AdminLayout` renderiza sin redirect. Mismo con `COMITE_VALIDACION`, `SCHOOL_ADMIN`, `COMITE_CONVIVENCIA`.

**Acceptance Scenarios**:

1. **Given** OPERADOR sin firma de consentimiento, **When** entra a `/dashboard/admin/reportes-revision`, **Then** carga la bandeja (no redirect a `/consentimiento`).
2. **Given** PARENT sin firma, **When** entra a `/dashboard`, **Then** el layout del padre lo redirige a `/consentimiento` (comportamiento vigente, no cambia).
3. **Given** un ADMIN sin firma, **When** entra al panel, **Then** carga sin redirect (los admins son personal interno, no titulares).

### User Story 4 — "Ver proceso" desaparece para operador y comité (Priority: P2)

En `AdminReportesTable`, el botón "Ver proceso" no se renderiza cuando el rol es OPERADOR o COMITE_VALIDACION. Se conserva para ADMIN.

**Independent Test**: renderizar `<AdminReportesTable rol="OPERADOR" .../>` con seed de 1 reporte → el DOM no contiene el botón "Ver proceso"; sí contiene "Ver detalle". Con `rol="ADMIN"` sí lo contiene.

**Acceptance Scenarios**:

1. **Given** rol OPERADOR, **When** la tabla renderiza, **Then** el botón "Ver proceso" NO aparece.
2. **Given** rol COMITE_VALIDACION, **When** la tabla renderiza, **Then** el botón "Ver proceso" NO aparece.
3. **Given** rol ADMIN, **When** la tabla renderiza, **Then** el botón sí aparece.

### User Story 5 — Depuración de firmas indebidas (Priority: P3)

Un script de auditoría cuenta y opcionalmente marca como inválidas las filas de `AuditConsentimiento` firmadas por roles internos, para que la evidencia legal quede limpia.

**Independent Test**: seed con 3 firmas: 1 PARENT, 2 OPERADOR → el script reporta `{ dePadres: 1, deRolesInternos: 2, marcadasComoInvalidas: 2 }` en modo `--apply`, o solo el conteo en modo `--dry-run` (default).

### Edge Cases

- OPERADOR sin el grant `expediente_revelar_original` (si un ADMIN lo revocó a mano): el endpoint sigue devolviendo 403. La SPEC otorga el grant por defecto vía `seed-modulos-grants.ts`; no fuerza el uso.
- COMITE_VALIDACION viendo caso escalado: `puedeRevelarOriginal: true` cuando `comiteId === user.id`.
- El texto ORIGINAL cifrado con `PARAM_ENCRYPTION_KEY` rotada: fuera de alcance; comportamiento actual se preserva.
- Firma de consentimiento **existente** de un OPERADOR (creada durante el loop I-118): se mantiene, se etiqueta con motivo `firma_previa_a_barrido`, y no se le pide de nuevo.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `prisma/seed-modulos-grants.ts` DEBE quedar así en la clave `OPERADOR`: `["bandeja_reportes", "expediente_revelar_original"]`. Se **quita** `pagos_admin`.
- **FR-002**: `prisma/seed-modulos-grants.ts` DEBE otorgar `expediente_revelar_original` también a `COMITE_VALIDACION`. Grant final para el comité: `["comite", "comite_bandeja", "comite_guias_accion", "bandeja_reportes", "denuncia_formal", "expediente_revelar_original"]`.
- **FR-003**: `src/app/api/admin/reportes-revision/[id]/route.ts:77` DEBE cambiar a `puedeRevelarOriginal: esAdminRol(user.rol) || user.rol === "OPERADOR" || esComiteRol(user.rol)`. El endpoint `POST /api/admin/reportes/[id]/revelar-original` ya autoriza vía `assertModulo("expediente_revelar_original")` — se verifica que su `AuditLog TEXTO_ORIGINAL_REVELADO` siga activo (no cambia).
- **FR-004**: DEBE crearse `scripts/revocar-grants-pagos-operador.ts` siguiendo el patrón de `scripts/revocar-grants-comite-muertos.ts` (`updateMany` a `activo: false`, idempotente, NO borra filas ni módulos; log de "antes/después"; salida `{ revocados, yaInactivos }`). NO lo corre ODIN — lo ejecuta el responsable del despliegue tras el deploy.
- **FR-005**: El paso de ejecución del script en producción DEBE documentarse en `specs/263-permisos-operador/quickstart.md` **y** en `cierre.md`, para que el CEO/ODIN lo corra en el orden correcto (después de `prisma migrate deploy` y del `sync-modulos-grants.ts`).
- **FR-006**: `src/app/dashboard/admin/layout.tsx` líneas 29–32 DEBE eliminar el bloque `requiereConsentimientoActual` (o acotarlo con `if (rol === "PARENT") { … }`, pero el PARENT nunca llega a este layout, así que se elimina). El guard del `PARENT` en `src/app/dashboard/layout.tsx:22` se conserva sin cambios.
- **FR-007**: `src/components/modules/AdminReportesTable.tsx` líneas 392–395 DEBEN condicionar el botón "Ver proceso" a `!esRolConBandejaPropia` (la constante ya existe en línea 120).
- **FR-008**: DEBE crearse `scripts/depurar-consentimientos-internos.ts` que:
  - Consulta `AuditConsentimiento` join `Usuario` y agrupa por rol.
  - En `--dry-run` (default) reporta conteos por rol.
  - En `--apply` marca las filas de roles internos con un campo aditivo (p. ej. actualiza un JSON `metadata.invalidadoPorBarrido: true` si el modelo lo admite; si no, deja solo el reporte de conteos y una nota en `cierre.md`).
  - Idempotente y NO destructivo.

### Key Entities

- `PermisoModulo` (Prisma): `{ rol, moduloId, activo }`. La revocación pone `activo: false`.
- `AuditLog { accion: "TEXTO_ORIGINAL_REVELADO", usuarioId, tipoRecurso: "Reporte", recursoId }`: preservado.
- `AuditConsentimiento`: se **lee** para depurar; no se modifica su schema.

---

## Success Criteria *(mandatory, measurable)*

- **SC-007**: revelar el original desde OPERADOR/COMITE deja `AuditLog TEXTO_ORIGINAL_REVELADO` (test + verificación BD post-deploy).
- **SC-008**: OPERADOR y COMITE_VALIDACION NO reciben redirect a `/consentimiento` (test + verificación en vivo).
- **SC-009**: consulta a la BD de producción tras deploy `SELECT rol, m.clave, activo FROM "PermisoModulo" p JOIN "ModuloPermisible" m ON p."moduloId"=m.id WHERE m.clave='pagos_admin' AND rol='OPERADOR'` devuelve `activo=false` o cero filas — **no aparece Pagos para OPERADOR**.
- **SC-010**: `AdminReportesTable` con `rol="OPERADOR"` o `rol="COMITE_VALIDACION"` NO renderiza el botón "Ver proceso" (test).
- **SC-013**: ODIN entra en vivo como operador y admin post-deploy y confirma SC-007, SC-008, SC-009, SC-010 pantalla por pantalla.

---

## Assumptions

- El endpoint `revelar-original` ya existe y ya está protegido por `assertModulo("expediente_revelar_original")`. Se **verifica**, no se reimplementa.
- El módulo `expediente_revelar_original` está marcado `esCritico: true` (verificado en `permisos-catalogo.ts:32`) — el otorgamiento por defecto sigue siendo reversible por ADMIN vía panel de permisos.
- El script de revocación es de responsabilidad del despliegue (mismo patrón SPEC-128).
- Para depurar `AuditConsentimiento`, si el modelo no tiene un campo de metadata mutable seguro, se limita a reportar conteos; ODIN reporta el número exacto de firmas de roles internos halladas.

---

## Dependencies

- Independiente de 261, 262, 264. Merges secuenciales tras 002-PI-157.
