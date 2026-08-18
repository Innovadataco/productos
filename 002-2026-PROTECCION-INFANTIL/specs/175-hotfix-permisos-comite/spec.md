# Feature Specification: SPEC-175 — Hotfix I-57: permiso padre faltante del rol Comité de Convivencia

**Feature Branch**: `work/002-pi-072`

**Created**: 2026-08-18

**Status**: IMPLEMENTADO

**Implementación** (2026-08-18): ver plan.md y esta nota. **HALLAZGO de alcance (a la atención de ZEUS)**: el guard estructural nuevo atrapó una SEGUNDA instancia del mismo bug — `COMITE_VALIDACION` (comité de plataforma) recibía `comite_bandeja` sin su padre `comite` → su bandeja también estaba inoperante en prod. Misma clase, mismo fix (grant del padre), mismo candado verificado en fuente: las rutas de `comite` son ADMIN_ONLY en el proxy y los endpoints que exigen el módulo `comite` (`/api/admin/comite/integrantes/**`) verifican `verifyAuth("ADMIN")` ANTES de `assertModulo` — conceder el padre no abre nada al comité de plataforma. Test D-43 de `seed-security.test.ts` actualizado para fijar la lista nueva con la razón documentada.

Impacto en arquitectura: mínimo — una línea en `prisma/seed-modulos-grants.ts` (grant del rol) + tests que fijan el candado. Sin cambios de schema, sin migración, sin endpoints nuevos.

**Input**: Instructivo 002-PI-072 (hotfix I-57, bug en prod). Contexto: el rol COMITE_CONVIVENCIA tiene el menú vacío y su bandeja de casos responde "Sin acceso al módulo". Causa raíz verificada por ZEUS: la jerarquía de módulos es AND (padre ∧ hijo) — `colegios_comite_bandeja` tiene padre `colegios` (`permisos-catalogo.ts:40`), pero el grant del rol es solo `["colegios_comite_bandeja"]` (`seed-modulos-grants.ts:49`): sin el padre activo, el hijo nunca se concede.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El comité de convivencia ve su menú y su bandeja (Priority: P1)

Como integrante del comité de convivencia de un colegio quiero entrar a mi bandeja de casos, para atender lo que el rector escaló.

**Why this priority**: bug en producción — el rol está inoperante hoy.

**Independent Test**: con el grant corregido, un usuario COMITE_CONVIVENCIA obtiene el módulo `colegios_comite_bandeja` permitido y la bandeja responde 200.

**Acceptance Scenarios**:

1. **Given** el mapa de grants, **When** se lee `clavesPorRol.COMITE_CONVIVENCIA` en `prisma/seed-modulos-grants.ts`, **Then** contiene `["colegios", "colegios_comite_bandeja"]` (padre + hijo).
2. **Given** el sync corrido contra una BD, **Then** existen `PermisoModulo` activos para COMITE_CONVIVENCIA en los módulos `colegios` y `colegios_comite_bandeja` (idempotente: correrlo dos veces no duplica).
3. **Given** un usuario COMITE_CONVIVENCIA, **When** el sistema resuelve `modulosPermitidosParaRol`, **Then** el set incluye `colegios_comite_bandeja` (la jerarquía AND se satisface).

---

### User Story 2 — El candado de aislamiento del comité queda fijado por tests (Priority: P1)

Como plataforma quiero garantizar que conceder el módulo padre `colegios` al comité NO le abre rutas ni endpoints del rector, para que el hotfix no cree un agujero de permisos.

**Why this priority**: es el candado explícito del instructivo — permisos es zona sensible.

**Independent Test**: los tests de proxy/permisos verifican que COMITE_CONVIVENCIA sigue limitado a su subárbol `/dashboard/colegio/comite` y que ningún endpoint del rector le responde.

**Acceptance Scenarios**:

1. **Given** el proxy con el grant corregido, **Then** `esDestinoPermitidoPorRol("COMITE_CONVIVENCIA", ruta)` sigue devolviendo false para rutas del rector (`/dashboard/colegio/cursos`, `/dashboard/colegio/profesores`, `/dashboard/colegio/configuracion`, `/dashboard/colegio` raíz, etc.).
2. **Given** los endpoints del área colegio, **Then** ninguno exige el módulo `colegios` a secas (verificado en fuente con grep) — conceder el padre no abre NINGÚN endpoint.
3. **Given** un test nuevo/ajustado en `src/lib/proxy.test.ts` (o el de permisos), **Then** fija que tras el grant `colegios` el comité puede su bandeja y NO las rutas del rector.

---

### Edge Cases

- Sync corrido dos veces: idempotente (upsert por `rol_moduloId`).
- Colegio sin comité creado: sin efecto (el grant es por rol, no por instancia).
- El comité intenta la raíz `/dashboard/colegio`: el predicado del proxy lo sigue bloqueando (el menú también filtra por predicado, no solo por módulo).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `clavesPorRol.COMITE_CONVIVENCIA` DEBE ser `["colegios", "colegios_comite_bandeja"]` en `prisma/seed-modulos-grants.ts` (fuente única; `scripts/sync-modulos-grants.ts` importa de ahí, verificado — no duplica el mapa).
- **FR-002**: El sync DEBE quedar idempotente (upsert), y la tarea DEBE entregar el comando exacto para aplicarlo en prod sin re-desplegar la app: `node --env-file=.env.production --import tsx scripts/sync-modulos-grants.ts` (o `docker exec` en el contenedor, según el runbook del VPS).
- **FR-003**: Un test DEBE fijar que con el grant corregido el comité obtiene `colegios_comite_bandeja` en `modulosPermitidosParaRol` y que el proxy lo sigue limitando a su subárbol (candado de no-acceso a rutas del rector).
- **FR-004**: El hotfix NO DEBE tocar el proxy, los endpoints, ni el catálogo de módulos — solo el grant y sus tests.

### Key Entities

- **PermisoModulo**: grant (rol, módulo, activo); la jerarquía AND exige padre activo + hijo activo.
- **ModuloPermisible**: catálogo; `colegios_comite_bandeja` tiene `padre: colegios`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras el sync en prod, un usuario COMITE_CONVIVENCIA ve su menú y la bandeja responde 200 (valida el CEO en prod).
- **SC-002**: El test del candado pasa: el comité no accede a ninguna ruta del rector.
- **SC-003**: Gate local completo verde y CI del PR verde.

## Assumptions

- La fuente única del mapa es `prisma/seed-modulos-grants.ts`; el script de sync lo importa (verificado en fuente: `scripts/sync-modulos-grants.ts:13`).
- Ningún endpoint exige el módulo `colegios` a secas (verificado con grep en `src/app/api/**`) y ninguna página hace `verificarAccesoPagina("colegios")` — conceder el padre solo satisface la jerarquía.
- El menú del comité filtra por módulo AND predicado del proxy (D-41): con el padre concedido, el predicado sigue limitando las rutas visibles al subárbol del comité.
- Este hotfix es independiente de SPEC-173 (que redefine el menú del comité en otra rama); se integra primero porque prod está roto hoy.
