# Implementation Plan: SPEC-137 — Creación de reporte ATÓMICA (E-5)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/137-creacion-reporte-atomica/spec.md` (002-PI-056, E-5)

## Summary

Cerrar los dos huecos de atomicidad de `POST /api/reportes`: (1) dedup + create +
upsert del identificador en UNA transacción (`withUnitOfWork`, D2 ya lo soporta en
servicio y repos) con la carrera de deduplicación cerrada; (2) encolado garantizado:
pg-boss no puede unirse a la tx de Prisma (pool propio) → reconciliación periódica que
re-encola `PENDIENTE` sin job, con el filtro anti-reencolado existente. La fuente
anti-abuso conserva su semántica best-effort actual (fuera de la tx).

## Technical Context

**Language/Version**: TypeScript 5 (strict maximal), Node.js >= 22
**Primary Dependencies**: Prisma `$transaction` (via `withUnitOfWork`), pg-boss. Nada nuevo.
**Storage**: PostgreSQL 16 — sin cambios de schema
**Testing**: Vitest — route tests existentes (red) + tests nuevos: rollback, carrera,
reconciliación (idemopotencia incluida)
**Target Platform**: Next.js standalone + worker (jobs de mantenimiento)
**Project Type**: hardening de integridad (comportamiento observable preservado)
**Performance Goals**: la tx es corta (3-4 escrituras); reconciliación cada N min (parámetro)
**Constraints**: reglas 1/2/7 del prompt único; FR-004 (fuente best-effort como hoy);
sin cambios de schema
**Scale/Scope**: 1 servicio + 1 ruta + 1 job de reconciliación + tests

## Constitution Check

- **No modificar el texto original**: OK — no se toca el pipeline ni el cifrado.
- **Colas pg-boss sobre la misma BD**: OK — la reconciliación reusa `sendReporte`.
- **Migraciones aditivas**: N/A — sin schema.

Sin violaciones que justificar.

## Project Structure

```text
src/app/api/reportes/route.ts              # envuelve crear() en withUnitOfWork
src/lib/dal/services/reporte-creation.ts   # recibe tx (D2); firma pública intacta
src/lib/queue.ts                           # + reencolarPendientesSinJob() (usa el
                                           #   filtro anti-reencolado existente)
scripts/worker-reportes.mjs                # + job periódico reportes-reconciliacion
src/lib/queue-reconciliacion.test.ts       # NUEVO: pendiente sin job → encolado; idempotente
src/app/api/reportes/route-atomicidad.test.ts # NUEVO: rollback + carrera
```

## Data Model

N/A — no cambia schema ni entidades; es transaccionalidad + un job de mantenimiento.

## Contracts

N/A — las respuestas de `POST /api/reportes` son idénticas (201/429/500 mismos códigos).

## Decisiones de diseño

1. **Unidad de trabajo**: la ruta abre `withUnitOfWork(tx => …)` y pasa `tx` al
   `ReporteCreationService` (constructor ya la acepta). Dentro: dedup-check → create →
   upsert identificador. La deduplicación queda en la MISMA tx → con el aislamiento por
   defecto de Postgres (read committed) la carrera sigue abierta en teoría; se cierra
   con `SELECT … FOR UPDATE` sobre la fila del agregado del identificador (lock por
   identificador: la segunda tx espera y ve el reporte de la primera) — mecanismo
   exacto a fijar en implementación con el test de carrera como prueba.
2. **Fuente anti-abuso FUERA de la tx** (FR-004): su fallo no aborta creación (hoy).
3. **Reconciliación**: `reencolarPendientesSinJob()` — SQL sobre `Reporte` (estado
   PENDIENTE, `creadoEn` > ventana de gracia de 1 min para no correr contra la request
   en curso) LEFT JOIN `pgboss.job` activo → `sendReporte` por cada uno (respeta el
   backpressure existente). Job del worker cada 15 min (mismo patrón que
   `carga-roster-limpieza` con `ensureQueue`). El `catch` de la ruta se conserva (la
   request no falla por la cola) — la reconciliación es la garantía, no el reintento
   síncrono.
4. **Outbox (insert directo en `pgboss.job` dentro de la tx)**: descartado — el formato
   interno de pg-boss no es contrato público; frágil ante upgrades. La reconciliación
   es robusta y simple.

## Fases de implementación (resumen para tasks)

1. **Tx en la creación** (FR-001/FR-002) + tests de rollback y carrera.
2. **Reconciliación** (FR-003) + tests (encola, idempotente, no toca spam/revisión).
3. **Gates + cierre**: suite completa, tsc, lint, build, arch:check.
