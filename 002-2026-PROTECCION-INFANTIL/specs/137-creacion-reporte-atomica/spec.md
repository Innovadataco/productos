# Feature Specification: SPEC-137 — Creación de reporte ATÓMICA (E-5)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-01

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-056 (BANDA 2, ítem E-5; radica ZEUS). Reverificado en
fuente 2026-08-01: `POST /api/reportes` NO es atómico. (a) `ReporteCreationService.crear()`
hace dedup-check → `reporte.create` → `identificador.upsert` SIN transacción (la ruta
instancia el servicio sin `tx`: `route.ts:67`) — un fallo a mitad deja reporte sin
agregado, y dos creaciones concurrentes del mismo usuario+identificador pasan ambas la
deduplicación. (b) Los efectos post-creación (`crearFuenteReporte`, `sendReporte` a
pg-boss) van fuera de cualquier tx con `try/catch` que TRAGA el error (`route.ts:146-164`):
un reporte puede quedar persistido pero NUNCA encolado → clavado en `PENDIENTE` para
siempre. Existe infraestructura parcial: `withUnitOfWork` (D2), `ReintentoReporte`, y
una consulta anti-reencolado en `queue.ts:106-111`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — La creación es UNA unidad de trabajo (Priority: P1)

Como responsable de integridad, quiero que dedup + create + upsert del identificador +
registro de fuente se ejecuten en UNA transacción (`withUnitOfWork`), de modo que no
existan estados a medias (reporte sin agregado, fuente sin reporte) ni duplicados por
carrera.

**Why this priority**: Es el punto de ingreso de TODO el dato del producto; un estado a
medias aquí contamina agregados, visibilidad pública y estadísticas.

**Independent Test**: tests que fuerzan fallo en cada paso intermedio afirman rollback
total (no existe reporte, ni agregado incrementado, ni fuente); dos creaciones
concurrentes del mismo usuario+identificador → una gana, la otra recibe DUPLICADO.

**Acceptance Scenarios**:

1. **Given** un fallo en el upsert del identificador, **When** termina la request,
   **Then** no existe el reporte (rollback), y la respuesta es error controlado.
2. **Given** dos requests concurrentes idénticas (mismo usuario+identificador),
   **When** ambas terminan, **Then** solo existe UN reporte y una respuesta es 429
   DUPLICATE_REPORT.
3. **Given** el camino feliz actual, **When** se crea un reporte, **Then** la respuesta
   y el estado final en BD son idénticos a hoy (route tests verdes sin tocar).

---

### User Story 2 — Un reporte persistido NUNCA se pierde de la cola (Priority: P1)

Como responsable de operación, quiero que el encolado del reporte sea garantizado —
dentro de la tx si es viable, o con un job de reconciliación que re-encole los
`PENDIENTE` sin job — de modo que un fallo de pg-boss en la request no deje un reporte
huérfano para siempre.

**Why this priority**: Hoy el `catch` de `sendReporte` solo loguea: el reporte queda
invisible para el pipeline (nunca se clasifica, nunca se anonimiza, PII sin procesar).

**Independent Test**: simular fallo de `sendReporte` en la request → el reporte queda
`PENDIENTE`; al correr la reconciliación, el reporte se encola y procesa (test de la
reconciliación: encuentra solo PENDIENTE sin job, re-encola, es idempotente).

**Acceptance Scenarios**:

1. **Given** pg-boss caído en la request, **When** el reporte se persiste, **Then** la
   reconciliación posterior lo detecta y encola (idempotente: no duplica jobs si ya hay
   uno — reusa el filtro anti-reencolado de `queue.ts`).
2. **Given** reportes en `POSIBLE_SPAM`/`REVISION_MANUAL` inicial, **When** corre la
   reconciliación, **Then** NO los toca (solo `PENDIENTE`, igual que la ruta).
3. **Given** la reconciliación, **When** corre dos veces seguidas, **Then** la segunda
   no encola nada (idempotencia).

---

### Edge Cases

- El rate-limit se consulta ANTES de la tx (ya era así): no entra en la unidad de
  trabajo (sus contadores son ventanas, no invariantes del reporte).
- `crearFuenteReporte` dentro de la tx: si la fuente falla hoy NO se aborta la creación
  (decisión de producto existente) — al meterla en la tx, un fallo suyo haría rollback;
  DECISIÓN explícita: preservar el comportamiento actual (fuente best-effort FUERA de
  la tx, con log) o hacerla parte de la invariante. Propuesta: FUERA, igual que hoy.
- `sendReporte` dentro de una tx Prisma no es posible con pg-boss (conexión propia);
  alternativa outbox (insert en `pgboss.job` vía SQL en la tx) se evalúa en research y
  se descarta si es frágil → reconciliación periódica (worker-supervisor, ya existe el
  patrón de jobs de mantenimiento).
- El número de seguimiento con reintentos (`MAX_INTENTOS_NUMERO`) queda dentro de la tx
  sin cambio de lógica.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `ReporteCreationService.crear()` (dedup + create + upsert identificador)
  DEBE ejecutarse en UNA transacción vía `withUnitOfWork` (la ruta la inicia; el
  servicio y repos la reusan — D2 ya lo soporta).
- **FR-002**: La carrera de deduplicación DEBE quedar cerrada (tx con aislamiento
  suficiente o mecanismo equivalente documentado: dos concurrentes → una sola crea).
- **FR-003**: DEBE existir reconciliación que encuentre reportes `PENDIENTE` sin job en
  `pgboss.job` y los re-encole (idempotente, con el filtro anti-reencolado existente);
  registrada como job de mantenimiento del worker (patrón `carga-roster-limpieza`).
- **FR-004**: `crearFuenteReporte` DEBE preservar su semántica actual (best-effort con
  log, no aborta la creación) — fuera de la tx, como hoy.
- **FR-005**: Comportamiento observable preservado: mismas respuestas (201/429/500),
  route tests y journeys verdes SIN tocar expectativas.
- **FR-006**: NO se toca el pipeline de procesamiento, ni el schema, ni la cola de
  pg-boss (salvo la reconciliación que reusa `sendReporte`). Defecto real → PARA y
  reporta.

### Key Entities *(include if feature involves data)*

N/A — no cambia schema. `Reporte`, `IdentificadorReportado`, `pgboss.job` (externa) y
`ReintentoReporte` se usan como están.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Test de rollback: fallo inyectado en upsert → cero filas (reporte y
  agregado intactos).
- **SC-002**: Test de carrera: 2 concurrentes → 1 reporte + 1 DUPLICADO.
- **SC-003**: Test de reconciliación: `PENDIENTE` sin job → encolado; segunda corrida
  no-op; spam/revisión intactos.
- **SC-004**: Suite completa + tsc + lint + build + arch:check verdes sin tocar
  expectativas existentes.

## Assumptions

- pg-boss no puede participar en una transacción de Prisma (pool propio): el encolado
  garantizado se resuelve con reconciliación, no con outbox (salvo que research
  demuestre que el insert directo en `pgboss.job` es estable y simple — se decide en
  plan con evidencia).
- El worker-supervisor ya corre jobs de mantenimiento (`carga-roster-limpieza`): la
  reconciliación se registra con el mismo patrón.
- La deduplicación es ventana de 30 días (no constraint única): la carrera se cierra
  con aislamiento de la tx, no con índice único (que cambiaría schema — fuera).

## Impacto en arquitectura

Impacto en arquitectura: transaccionalidad de `reporte-creation` + un job de
mantenimiento nuevo en el worker. NO toca schema, pipeline, proxy ni rutas (salvo el
bloque de creación de `api/reportes/route.ts`). `arch:check` no debería requerir
regeneración.

## Implementación (cierre)

Implementada el 2026-08-01 en `feature/001-scaffolding` (APROBADA por ZEUS con la
condición de carrera probada por test de concurrencia real).

- **Tx (`route.ts`)**: dedup + create + upsert del identificador en UNA
  `withUnitOfWork`; fuente anti-abuso y encolado FUERA de la tx como hoy (FR-004).
- **Carrera cerrada con advisory lock** (`pg_advisory_xact_lock` por hash
  usuario+identificador, vía `$executeRaw` — `$queryRaw` no deserializa `void`):
  FOR UPDATE sobre el agregado tenía hueco estructural cuando la fila no existe
  (primer reporte del identificador, el caso dominante). **Evidencia del test de
  concurrencia real**: 2 POST simultáneas → `[201, 429]`, `prisma.reporte.count() = 1`;
  sin el lock la misma prueba daba `[201, 201]`.
- **Reconciliación**: `reencolarPendientesSinJob()` (gracia 1 min, solo PENDIENTE,
  filtro anti-reencolado, backpressure) + job `reportes-reconciliacion` cada 15 min en
  el worker. Tests: encola huérfanos, segunda corrida no-op, spam/revisión intactos,
  reciente saltado por gracia.
- **Regla 1**: cero tests existentes tocados; respuestas de la ruta idénticas. Los
  tests nuevos purgan `pgboss.job` en beforeEach (resetDatabase no la limpia —
  documentado).
- **Gates**: suite 223 archivos / 1367 tests, tsc, lint, build, arch:check verdes.
