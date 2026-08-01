# Feature Specification: SPEC-134 — DAL del módulo colegio con tenant obligatorio (E-1)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-01

**Status**: PLANEADO

**Input**: Instructivo 002-PI-056 (BANDA 2, ítem E-1; radica ZEUS). `api/colegio/**`
maneja PII de menores (nombres de alumnos, identificadores) y hoy habla con Prisma
directamente: **20 archivos** verificados 2026-08-01 en
`scripts/arch/prisma-directo-allowlist.json` — 14 rutas (`api/colegio/**` +
`api/me/colegio`) y 6 módulos de `src/lib/colegio/` (alertas, estadisticas, permisos,
vigencia, carga/importer, carga/sesion-roster). El dominio NO tiene repositorios DAL
(no existe `curso`, `alumno`, `identificador-alumno`, `alerta-colegio` ni `colegio` en
`src/lib/dal/repositories/`). El aislamiento multi-tenant depende hoy de que cada query
recuerde filtrar por `colegioId` a mano. E-1: mover el dominio a repos DAL donde el
`where` de tenant sea OBLIGATORIO por construcción.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Repositorios del dominio colegio con tenant obligatorio (Priority: P1)

Como responsable de ingeniería, quiero repositorios DAL para `Colegio`, `Curso`,
`Alumno`, `IdentificadorAlumno`, `AlertaColegio` (y la sesión de carga) donde TODA
función exija `colegioId` como parámetro requerido y el `where` lo incluya siempre, de
modo que olvidar el filtro de tenant sea un error de tipos, no un incidente de
seguridad.

**Why this priority**: Es PII de menores y el aislamiento multi-tenant es el negativo
central del producto (SPEC-133 lo testeó a nivel handler; esto lo hace estructural).

**Independent Test**: los repos existen con la firma tenant-first; un intento de llamar
una función sin `colegioId` NO compila (`tsc --noEmit` lo prueba); el ratchet Q-3 baja
en 20 archivos.

**Acceptance Scenarios**:

1. **Given** cualquier función de los repos nuevos, **When** se inspecciona su firma,
   **Then** `colegioId: string` es parámetro requerido y el `where` interno lo aplica en
   lectura Y escritura (update/delete incluidos).
2. **Given** una actualización por id (`curso.update`), **When** el id es de otro
   colegio, **Then** el repo no toca la fila (update con `where: { id, colegioId }` →
   cero filas, error controlado), no un update ciego por PK.
3. **Given** los 20 archivos migrados, **When** se corre el ratchet Q-3,
   **Then** `prisma-directo-allowlist.json` ya no contiene ninguno (baja de 70 a 50).

---

### User Story 2 — Las 14 rutas y 6 módulos migran sin cambiar comportamiento (Priority: P1)

Como responsable de calidad, quiero que las rutas `api/colegio/**` y los módulos de
`src/lib/colegio/` consuman los repos nuevos con EXACTAMENTE el mismo comportamiento
observable, de modo que la suite completa (route tests + journeys SPEC-133) siga verde
sin tocar una expectativa.

**Why this priority**: Es un refactor de acceso a datos; la red de tests ya existe
(route tests por endpoint + journey colegio con carga masiva, alertas y auditoría +
negativos multi-tenant A/B). Si algo cambia, la red lo canta.

**Independent Test**: suite completa verde sin modificar ningún test existente;
los negativos multi-tenant A/B de `negativos-handler.test.ts` siguen verdes.

**Acceptance Scenarios**:

1. **Given** la suite actual, **When** corre tras la migración, **Then** pasa sin
   cambiar expectativas (comportamiento preservado).
2. **Given** `negativos-handler.test.ts`, **When** corre, **Then** el multi-tenant A/B
   sigue en 404/403 exactamente como antes.
3. **Given** una ruta migrada, **When** se lee su código, **Then** no importa
   `@/lib/prisma` (la frontera Q-3 lo impone por lint).

---

### Edge Cases

- `sesion-roster.ts` e `importer.ts` (carga masiva, SPEC-132): la sesión ya liga
  `colegioId`; el repo mantiene la purga single-use en la MISMA transacción del import
  (patrón `tx?: Prisma.TransactionClient`, D2 de SPEC-053).
- `vigencia.ts` y `permisos.ts` se usan también desde layouts/páginas (server
  components): la migración no cambia sus firmas públicas, solo su acceso a datos.
- Queries con `include`/`select` específicos por ruta: se conservan tal cual (D1: el
  repo devuelve el DTO que la ruta ya usa; nada de "mejoras" de campos).
- `alertas.ts` (284 L) mezcla lógica de negocio y datos: el repo absorbe SOLO el acceso
  a datos; la lógica queda en el módulo (E-2 es quien rompe god-modules, no esta spec).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEBEN existir repositorios DAL para el dominio colegio (`curso`, `alumno`,
  `identificador-alumno`, `alerta-colegio`, `colegio`, `carga-roster-sesion` según
  corresponda), con `tx?: Prisma.TransactionClient` opcional (D2) y selects/DTOs como en
  SPEC-053 (D1).
- **FR-002**: TODA función de estos repos DEBE exigir `colegioId` requerido y aplicarlo
  en el `where` de lectura y escritura; las escrituras por id DEBEN ser
  `where: { id, colegioId }` (o `updateMany` equivalente con conteo verificado), nunca
  update por PK desnuda.
- **FR-003**: Las 14 rutas (`api/colegio/**` + `api/me/colegio`) y los 6 módulos de
  `src/lib/colegio/` DEBEN dejar de importar `@/lib/prisma` y consumir los repos.
- **FR-004**: Los 20 archivos DEBEN salir de `scripts/arch/prisma-directo-allowlist.json`
  EN EL MISMO commit que su migración (regla E-8/Q-3).
- **FR-005**: Comportamiento idéntico: suite completa verde SIN modificar expectativas
  existentes; se añaden tests unitarios de los repos nuevos (patrón SPEC-053).
- **FR-006**: NO se toca lógica de negocio, ni `proxy.ts`, ni componentes, ni el schema.
  Si la migración descubre una query que HOY no filtra por tenant donde debería, es un
  hueco real: se PARA y se reporta a ZEUS (mismo protocolo O-1 de SPEC-133), no se
  "arregla" en silencio dentro del refactor.

### Key Entities *(include if feature involves data)*

N/A — no cambia schema ni entidades; misma BD, mismo modelo (`Colegio`, `Curso`,
`Alumno`, `IdentificadorAlumno`, `AlertaColegio`, `CargaRosterSesion`). Es un cambio de
CAPA de acceso, no de datos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `grep -r "@/lib/prisma" src/app/api/colegio src/app/api/me src/lib/colegio`
  vacío; allowlist Q-3 en 50 archivos (70 − 20).
- **SC-002**: Suite completa + `tsc --noEmit` + lint + build + `arch:check` verdes, sin
  tocar expectativas de tests existentes.
- **SC-003**: Tests nuevos de repos afirman: (a) update/delete por id de otro tenant no
  toca la fila, (b) toda firma exige `colegioId`.
- **SC-004**: Piso de cobertura Q-2 no baja (los repos nuevos traen sus tests).

## Assumptions

- El diseño D1/D2/D5 de SPEC-053 rige (repos + tx opcional + sin cambios de schema).
- La migración es del dominio completo de una vez (20 archivos, ~1.5k líneas de
  superficie): son un solo bounded context y dejar la mitad rompería la promesa de
  "tenant obligatorio" en el dominio de PII más sensible.
- Los route tests y journeys existentes son la red suficiente; no se reescriben.
- `auditLog` y `usuario` ya tienen repo DAL (SPEC-053): las rutas que los usan los
  reusan.

## Impacto en arquitectura

Impacto en arquitectura: DAL puro — añade repos en `src/lib/dal/repositories/` y cambia
imports en `api/colegio/**` + `src/lib/colegio/**`. NO toca schema, proxy, navegación ni
stack; `arch:check` no debería requerir regeneración (la frontera Q-3 ya contempla la
allowlist encogiendo; `06-stack.md` no lista repos individuales).
