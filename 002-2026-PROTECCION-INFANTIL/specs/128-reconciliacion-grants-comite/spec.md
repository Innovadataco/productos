# Feature Specification: SPEC-128 — Reconciliación de grants del comité

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-29

**Status**: PLANEADO

**Input**: Instructivo 002-PI-043 (radica ZEUS). Decisión vinculante **D-43** (CEO,
2026-07-29; **supersede la cláusula "no reconciliar" de D-41**): el seed concede a
COMITE_VALIDACION módulos cuyas rutas la puerta le niega —
`clavesPorRol.COMITE_VALIDACION = ["comite", "comite_bandeja", "comite_auditoria"]`
(`prisma/seed.ts:1265`), donde `comite` y `comite_auditoria` mapean a las tabs
"Gestión"/"Auditoría" (`nav-items.ts:29-30`) sobre rutas ADMIN_ONLY (`proxy.ts:163`).
Desde D-41 ya no se pintan, pero el default distribuido sigue contradictorio: el seed dice
SÍ donde la puerta dice NO. Fix: `clavesPorRol.COMITE_VALIDACION` queda en
`["comite_bandeja"]`. D-41 queda intacta en su núcleo (módulo ∧ `esDestinoPermitidoPorRol`
en toda navegación; Aserción B sin allowlist).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El default distribuido no contradice a la puerta (Priority: P1)

Como responsable técnico de la plataforma, quiero que una base de datos fresca (seed) no
conceda al rol COMITE_VALIDACION módulos cuyas rutas la puerta le niega, de modo que el eje
de módulos (`PermisoModulo`) y el eje de rutas (proxy) digan lo mismo para ese rol y no
haya grants muertos distribuidos por defecto.

**Why this priority**: Es limpieza + defensa en profundidad del rol que vigila casos
sensibles de menores. Hoy el default contradice a la puerta: cualquier consumidor futuro
del eje de módulos que olvide el predicado (exactamente el fallo que D-41 corrigió en
`ComiteSubNav`) volvería a ofrecer al comité pantallas que no puede usar.

**Independent Test**: Ejecutar el seed sobre una BD vacía y consultar los `PermisoModulo`
del rol COMITE_VALIDACION: exactamente uno (`comite_bandeja`), y ADMIN conserva todos.

**Acceptance Scenarios**:

1. **Given** una BD fresca, **When** corre el seed, **Then** los `PermisoModulo` activos de
   COMITE_VALIDACION son exactamente `["comite_bandeja"]` — ni `comite` ni `comite_auditoria`.
2. **Given** una BD fresca, **When** corre el seed, **Then** ADMIN conserva grants activos
   para TODOS los módulos del catálogo (incluidos `comite` y `comite_auditoria`).
3. **Given** el catálogo de módulos, **When** corre el seed, **Then** los módulos `comite` y
   `comite_auditoria` SIGUEN existiendo en `Modulo` (no se borran: ADMIN los usa).
4. **Given** el backfill del seed (solo crea faltantes), **When** corre sobre una BD que YA
   tiene los grants viejos del comité, **Then** NO los revoca (comportamiento actual,
   documentado) — el tratamiento de BD existentes es la decisión de la US2.

---

### User Story 2 — Decisión explícita sobre las BD existentes (Priority: P1)

Como responsable de despliegue, quiero que la spec se pronuncie sobre qué pasa con las BD
ya creadas (desarrollo y producción), que conservan los grants muertos del comité, de modo
que no quede una divergencia silenciosa entre el seed nuevo y los datos vivos.

**Why this priority**: El cambio del seed gobierna solo BD fresca; producción conserva los
grants `comite`/`comite_auditoria` del comité. La D-43 exige que la spec proponga el
mecanismo y que ZEUS decida en la compuerta — sin pronunciamiento, la reconciliación queda
a medias y nadie lo ve.

**Independent Test**: La spec/plan documentan el mecanismo propuesto (script puntual de
revocación, paso manual documentado u otro), marcado como PROPUESTA pendiente de la
decisión de ZEUS; nada se ejecuta contra BD existente sin esa aprobación.

**Acceptance Scenarios**:

1. **Given** el plan aprobado, **When** ZEUS decida el mecanismo en la compuerta, **Then**
   existe un paso ejecutable y verificable (con consulta de verificación antes/después)
   para cada entorno con BD viva.
2. **Given** cualquier mecanismo elegido, **When** se aplique a una BD existente, **Then**
   el comité conserva `comite_bandeja` y ADMIN no pierde ningún grant.

---

### Edge Cases

- El backfill del seed solo crea faltantes y nunca revoca: tras el cambio, re-correr el
  seed en una BD existente NO produce revocación accidental (comportamiento preservado).
- Los grants son datos editables en runtime: si un entorno necesitara temporalmente el
  acceso, un ADMIN puede re-conceder el módulo por la vía normal — el cambio solo fija el
  DEFAULT, no una prohibición de datos.
- El test E2E `aislamiento.test.ts` ("el comité no se autogestiona") verifica la PUERTA,
  no los grants: debe seguir verde sin tocarse — si fallara tras el cambio, sería un
  hallazgo real (se reporta y se para, no se reconcilia).
- SCHOOL_ADMIN y OPERADOR tienen sus propias listas en `clavesPorRol`: NO se revisan ni se
  tocan en esta spec (fuera del alcance de D-43).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `clavesPorRol.COMITE_VALIDACION` (`prisma/seed.ts:1265`) DEBE quedar en
  `["comite_bandeja"]`; salen `comite` y `comite_auditoria`.
- **FR-002**: Los módulos `comite` y `comite_auditoria` NO DEBEN eliminarse del catálogo
  (`modulosSeed`); ADMIN DEBE conservar grants para todos los módulos.
- **FR-003**: La modificación de `prisma/seed.ts` DEBE limitarse a la línea
  `COMITE_VALIDACION` de `clavesPorRol` (y su comentario si aplica). El resto del seed —
  incluida la semántica del backfill (crear faltantes, nunca revocar) — queda intacto.
- **FR-004**: La spec/plan DEBE proponer el mecanismo para las BD existentes (producción
  incluida): script puntual de revocación, paso manual documentado u otro. La decisión es
  de ZEUS en la compuerta §4. NO se implementa ni se ejecuta sin esa aprobación.
- **FR-005**: NO se tocan `src/lib/nav-items.ts`, `src/lib/permisos-catalogo.ts` ni ningún
  componente de navegación. D-41 queda intacta: módulo ∧ `esDestinoPermitidoPorRol` en toda
  navegación, Aserción B sin allowlist nueva.
- **FR-006**: Tras el cambio, los artefactos generados que reflejan el seed
  (`docs/architecture/02-roles-capacidades.md`) DEBEN regenerarse y `npm run arch:check`
  DEBE quedar VERDE.
- **FR-007**: Suite completa (`npm run test`) + `npx tsc --noEmit` + `npm run build` DEBEN
  quedar verdes; `src/lib/e2e/journeys/aislamiento.test.ts` ("el comité no se
  autogestiona") sigue verde sin debilitarse.

### Key Entities *(include if feature involves data)*

- **`Modulo`**: entrada del catálogo de módulos permisibles (clave, nombre, jerarquía).
  `comite` y `comite_auditoria` permanecen; solo cambian los grants por defecto.
- **`PermisoModulo`**: grant (rol, moduloId, activo). Es dato editable en runtime; el seed
  solo crea los faltantes del default (`clavesPorRol`), nunca revoca.
- **`clavesPorRol`**: tabla del seed que reproduce el acceso por defecto por rol. Es el
  único punto que cambia.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En BD fresca, la consulta de `PermisoModulo` por rol devuelve: COMITE_VALIDACION
  = exactamente 1 grant (`comite_bandeja`); ADMIN = todos los módulos del catálogo.
- **SC-002**: `comite` y `comite_auditoria` siguen presentes en `Modulo` tras el seed
  (catálogo intacto).
- **SC-003**: Suite completa + `tsc --noEmit` + `build` + `arch:check` verdes, con
  `02-roles-capacidades.md` regenerado en el mismo commit.
- **SC-004**: Aserción A y Aserción B verdes sin allowlist ni excepciones nuevas;
  `aislamiento.test.ts` verde sin modificaciones.
- **SC-005**: El plan registra la propuesta de mecanismo para BD existentes y la decisión
  de ZEUS queda documentada antes de cualquier ejecución sobre datos vivos.

## Assumptions

- Las BD existentes (dev y producción) conservan los grants muertos creados por seeds
  anteriores; el cambio del seed no las toca.
- Los grants son datos editables en runtime por un ADMIN: el default nuevo no impide una
  concesión excepcional futura si el negocio la decidiera.
- Esta reconciliación es limpieza + defensa en profundidad (registro honesto de la D-43):
  no cambia lo que un usuario ve ni alcanza hoy, porque D-41 ya filtra la navegación y la
  puerta ya niega las rutas.
- La verificación de BD fresca se hace en la PostgreSQL de pruebas del repo (misma que usa
  la suite), sin tocar producción.

## Impacto en arquitectura

Impacto en arquitectura: TOCA `prisma/seed.ts` SOLO en `clavesPorRol.COMITE_VALIDACION`
(D-43) y REGENERA `docs/architecture/02-roles-capacidades.md` (la tabla módulo → rol deja
de mostrar `comite`/`comite_auditoria` para el comité). No toca schema, proxy, navegación
ni catálogo de módulos; las BD existentes quedan pendientes del mecanismo que ZEUS decida
en la compuerta (FR-004).

## Implementación (cierre)

*(Se completa al cerrar la spec.)*
