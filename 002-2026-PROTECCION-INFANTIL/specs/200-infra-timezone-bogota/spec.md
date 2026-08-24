# Feature Specification: SPEC-200 — INFRA · Timezone Bogotá (002-PI-097)

**Feature Branch**: `work/002-PI-motor-notif-lote1`

**Created**: 2026-08-22

**Status**: `PLANEADO`

**Input**: 002-PI-097. Bug real reportado por CEO 2026-08-21: fechas "raras" cerca de medianoche. Auditoría en fuente confirmó que los contenedores Docker corren en UTC y `src/lib/colegio/fechas-humano.ts` usa `getDay()`/`getMonth()` sin fijar timezone, por lo que muestra el día equivocado cuando la hora local del contenedor ya pasó a medianoche pero Bogotá aún no. **Grave cuando el sistema calcule T+3 corte de acceso** ([D-69](../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/03-EJECUCION/05-DECISIONES.md)). Esta SPEC es infraestructura previa a SPEC-201..204 (motor de notificaciones) y transversal a toda lógica de fechas del producto.

Objetivo: hardcodear `America/Bogota` como timezone único de presentación y aritmética de fechas, almacenar todos los momentos en Postgres con tz-info (`@db.Timestamptz(6)`), introducir `date-fns-tz` como única librería de aritmética temporal con timezone, y forzar `timeZone: "America/Bogota"` en todo formateo del frontend. Cero cambios de comportamiento de negocio salvo corrección del bug de día.

Impacto en arquitectura: `docker-compose.prod.yml` (4 servicios), `package.json` (nueva dependencia), `prisma/schema.prisma` + migración aditiva (todos los `DateTime` de momento), `src/lib/colegio/fechas-humano.ts` + tests, revisión de `new Date()`/`toLocaleString`/`Intl.DateTimeFormat` en `src/`. No se toca `src/lib/ai/**` ni se modifica `SHOW TIME ZONE` de Postgres.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — TZ en contenedores Docker (Priority: P1)

Como operador de infraestructura quiero que los contenedores de la app, worker, monitor y simulador vean `America/Bogota` como timezone del sistema, para que `new Date()` formatee en hora local correcta sin depender de la configuración del host.

**Why this priority**: elimina la causa raíz del bug de medianoche y es prerequisito de SPEC-201..204.

**Independent Test**: `docker exec <container> printenv TZ` devuelve `America/Bogota` y `date` muestra hora Bogotá.

**Acceptance Scenarios**:

1. **Given** `docker-compose.prod.yml`, **When** se inspeccionan los servicios `app`, `worker`, `monitor` y `simulador-abuso`, **Then** cada uno declara `TZ: America/Bogota` en `environment`.
2. **Given** un contenedor levantado con la nueva composición, **When** se ejecuta `printenv TZ`, **Then** devuelve `America/Bogota`.
3. **Given** la base de datos, **When** se ejecuta `SHOW TIME ZONE`, **Then** sigue devolviendo `Etc/UTC` (no se cambió).

### User Story 2 — Helpers de fecha con timezone fijo (Priority: P1)

Como desarrollador quiero que `src/lib/colegio/fechas-humano.ts` use `date-fns-tz` con `America/Bogota`, para que ni el día de la semana ni el mes dependan de la TZ del ejecutor.

**Why this priority**: corrige el bug observable del CEO y establece el patrón para futuros cálculos (T+3, T-5, etc.).

**Independent Test**: `fechaLargaES` con fechas 23:59 y 00:01 cerca del cambio de día en Bogotá imprime el día correcto incluso si el sistema operativo está en UTC.

**Acceptance Scenarios**:

1. **Given** una fecha UTC equivalente a 2026-08-21 23:59 en Bogotá, **When** se llama `fechaLargaES`, **Then** devuelve "viernes 21 de agosto de 2026".
2. **Given** una fecha UTC equivalente a 2026-08-22 00:01 en Bogotá, **When** se llama `fechaLargaES`, **Then** devuelve "sábado 22 de agosto de 2026".
3. **Given** `relativoHumano`, **When** se compara fechas a menos de 24 h, **Then** el cálculo de días usa el día calendario Bogotá (no el día UTC).
4. **Given** `etiquetaPeriodo`, **When** recibe una fecha ISO, **Then** interpreta el periodo en `America/Bogota` para mensual/semanal.

### User Story 3 — Timestamptz en Prisma (Priority: P1)

Como DBA quiero que todos los `DateTime` que representan momentos en el schema usen `@db.Timestamptz(6)`, para que Postgres almacene la información de timezone y no haya ambigüedad en lecturas/escrituras.

**Why this priority**: evita que Postgres interprete timestamps sin tz según la sesión del cliente.

**Independent Test**: migración aditiva aplica sin destruir datos; `prisma migrate deploy` termina en verde.

**Acceptance Scenarios**:

1. **Given** `prisma/schema.prisma`, **When** se buscan campos `DateTime` de momento (no `@db.Date`), **Then** tienen `@db.Timestamptz(6)`.
2. **Given** una migración aditiva generada, **When** se aplica sobre datos existentes, **Then** no se pierden filas ni se altera el significado de los timestamps.
3. **Given** campos `DateTime` que ya usaban `@db.Timestamptz(3)`, **When** se revisa el schema, **Then** se unifican a `@db.Timestamptz(6)`.

### User Story 4 — Frontend siempre renderiza Bogotá (Priority: P1)

Como usuario quiero ver todas las fechas de la interfaz en hora de Bogotá, incluso si mi navegador o sistema operativo está en otra timezone.

**Why this priority**: consistencia operativa para admins que viajan o prueban desde otras regiones.

**Independent Test**: DevTools → cambiar timezone del navegador a `Pacific/Auckland` → refresh → fechas siguen mostrándose en Bogotá.

**Acceptance Scenarios**:

1. **Given** cualquier llamada a `new Date(...).toLocaleString` o `toLocaleDateString` en `src/`, **When** se inspecciona, **Then** incluye explícitamente `timeZone: "America/Bogota"`.
2. **Given** cualquier `new Intl.DateTimeFormat` en `src/`, **When** se inspecciona, **Then** incluye `timeZone: "America/Bogota"`.
3. **Given** el navegador configurado en `Pacific/Auckland`, **When** se carga una pantalla con fechas, **Then** el día/hora mostrados corresponden a Bogotá.

### User Story 5 — Aritmética de días con timezone (Priority: P1)

Como sistema quiero que "hace N días", "faltan N días" y cálculos similares usen `date-fns-tz` sobre el día calendario Bogotá, para que no sesguen con la timezone del ejecutor.

**Why this priority**: T+3 de corte de acceso y T-5/T-1/T+2 del motor de notificaciones requieren precisión de día calendario.

**Independent Test**: grep de `new Date(` en `src/`: todo uso para aritmética temporal usa `date-fns-tz` o tiene justificación documentada.

**Acceptance Scenarios**:

1. **Given** una función que calcule "hace N días" para ventanas de reportes, **When** corre en un contenedor UTC a las 04:00 UTC (23:00 Bogotá del día anterior), **Then** considera correctamente si ya cambió el día en Bogotá.
2. **Given** `src/lib/apelaciones.ts` y otros helpers con aritmética de días, **When** se revisan, **Then** usan helpers centralizados con `date-fns-tz` o `America/Bogota`.

---

## Functional Requirements

FR-001: Los servicios `app`, `worker`, `monitor` y `simulador-abuso` en `docker-compose.prod.yml` DEBEN declarar `TZ: America/Bogota` en su sección `environment`.

FR-002: `package.json` DEBE incluir `date-fns-tz` en `dependencies` (versión estable compatible con `date-fns` si se agrega esta última; de lo contrario la versión standalone).

FR-003: Todo campo Prisma `DateTime` que represente un momento (no fecha sola) DEBE usar `@db.Timestamptz(6)`. Los campos `@db.Date` se mantienen sin cambios.

FR-004: `src/lib/colegio/fechas-humano.ts` DEBE usar `date-fns-tz` para obtener año/mes/día/día-semana en `America/Bogota` y no depender de `Date.getDay()`/`getMonth()`/`getDate()`/`getFullYear()` del sistema.

FR-005: `src/lib/colegio/fechas-humano.test.ts` DEBE incluir tests con fechas a las 23:59 y 00:01 en Bogotá.

FR-006: Toda llamada a `toLocaleString`, `toLocaleDateString`, `toLocaleTimeString` o `new Intl.DateTimeFormat` en `src/` DEBE incluir explícitamente `timeZone: "America/Bogota"`.

FR-007: Toda aritmética de días/hoy/inicio-fin de periodo en `src/` DEBE usar `date-fns-tz` o helpers centralizados con `America/Bogota`; los usos residuales de `new Date()` DEBEN estar justificados en comentario.

FR-008: La migración de Prisma DEBE ser aditiva y no destructiva; no debe usar `prisma migrate reset` ni alteraciones que borren datos.

FR-009: No se DEBE modificar `src/lib/ai/**` ni el `SHOW TIME ZONE` de Postgres.

FR-010: Se DEBE agregar un helper reutilizable para formateo con timezone (ej. `src/lib/fechas/formato-bogota.ts`) si múltiples módulos lo requieren, evitando duplicar `Intl.DateTimeFormat`.

---

## Success Criteria

- `docker-compose.prod.yml` tiene `TZ: America/Bogota` en `app`, `worker`, `monitor` y `simulador-abuso`.
- `date-fns-tz` figura en `dependencies`.
- `prisma/schema.prisma` usa `@db.Timestamptz(6)` en todos los `DateTime` de momento; migración aplica sin pérdida de datos.
- `fechas-humano.ts` pasa tests incluyendo 23:59 y 00:01 Bogotá.
- Grep confirma que todo `toLocaleString`/`Intl.DateTimeFormat` en `src/` incluye `timeZone: "America/Bogota"`.
- CI verde 6/6.

---

## Assumptions

- Postgres se mantiene en `Etc/UTC`; solo cambian los clientes (Node container TZ) y la representación tz-aware de los datos.
- `America/Bogota` no tiene horario de verano (UTC-5 todo el año), por lo que el día calendario es estable.
- Los campos de "solo fecha" (`@db.Date`) no requieren `@db.Timestamptz(6)` porque representan un día calendario sin hora.
- El bug actual solo afecta presentación/aritmética, no la integridad de los timestamps almacenados; la migración a `Timestamptz(6)` los conserva.
- No se implementan aún las tablas del motor de notificaciones (SPEC-201), pero su schema respetará `@db.Timestamptz(6)` por esta SPEC.

---

## Implementación

Ver `plan.md` y `tasks.md`. Se completará tras aprobación de ZEUS.
