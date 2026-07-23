# Spec 084 — Fix timeout multi-modelo de simulación (I-07)

**Status**: `FINALIZADO` (pendiente ACTA-VALIDACION de ZEUS → `CERRADA`)
**Rama**: `feature/001-scaffolding`
**Fase del programa**: Corrección de incidencias
**Creado**: 2026-07-22
**Incidencia**: I-07

**Input**: "El timeout (progreso.ts) se mide desde run.fechaInicio, pero fechaInicio se fija en la CREACIÓN y es igual para todas las runs de un lote multi-modelo. Como se ejecutan en secuencia, los modelos 2+ agotan el timeout contra el reloj del inicio del lote → FALLIDA injusta. Fix: setear fechaInicio = now() cuando el run pasa PENDIENTE→EN_PROGRESO. Sin migración."

## Contexto

Verificado en código (2026-07-22):

- `SimulacionRun.fechaInicio` tiene `@default(now())` (schema): se fija al crear el run. En un lote multi-modelo, el POST crea TODAS las runs en el mismo instante → mismo `fechaInicio`.
- El timeout de `actualizarProgresoYEstado` (`src/lib/simulacion/progreso.ts`) mide `now - fechaInicio > ia.simulacion_timeout_minutos` solo cuando el estado es `EN_PROGRESO`.
- Como el lote ejecuta en secuencia (spec 083), la run del modelo 2 arranca cuando termina la 1: su reloj de timeout ya lleva consumido todo el tiempo de la(s) run(s) anterior(es) → `FALLIDA` injusta (observado por ZEUS: qwen 50/50 OK; aya/gemma/ornith FALLIDA tras 1h13m con el mismo `fechaInicio`).
- `createdAt` conserva la fecha de creación real (no se toca). No hay migración.

## User Scenarios & Testing

### User Story 1 — Timeout medido desde el arranque propio de cada run (Priority: P1)

**Como** ADMIN que lanza un lote multi-modelo,
**quiero** que el timeout de cada run se mida desde que ESA run pasa a EN_PROGRESO,
**para** que los modelos 2+ no fallen por el tiempo consumido por los anteriores.

**Why this priority**: es la causa directa de FALLIDA injusta en lotes (I-07).

**Independent Test**: lote de 3 modelos sobre el JSON de 50 casos → cada run tiene `fechaInicio ≈` su propio arranque (distinto de `createdAt` para las runs 2 y 3) y ninguna cae en FALLIDA por el reloj del lote.

**Acceptance Scenarios**:

1. **Given** una run `PENDIENTE` creada hace 30 min, **When** el lote la inicia (pasa a `EN_PROGRESO`), **Then** `fechaInicio` se actualiza a ese instante y `createdAt` no cambia.
2. **Given** un lote de 3 modelos donde el modelo 1 tarda ~20 min, **When** arranca el modelo 2, **Then** su timeout se mide desde ese momento (no desde la creación del lote) y la run completa 50/50.
3. **Given** una run `EN_PROGRESO` estancada más allá del timeout medido desde SU propio arranque, **When** se evalúa, **Then** sigue cayendo en `FALLIDA` (el timeout sigue funcionando).

### Edge Cases

- **Reintento del batch creator** (job reintentado): `fechaInicio` se vuelve a fijar al re-entrar a `EN_PROGRESO` — aceptable, la creación de reportes es reanudable (spec 083).
- **Run histórica EN_PROGRESO** anterior al fix: conserva su `fechaInicio` viejo; si excede el timeout se marca FALLIDA y listo (comportamiento ya documentado en 083).

## Requirements

### Functional Requirements

- **FR-001**: Al pasar una run de `PENDIENTE` a `EN_PROGRESO` (en `runSimulacionBatchCreator`), el sistema DEBE actualizar `fechaInicio = now()`.
- **FR-002**: `createdAt` NO DEBE modificarse (conserva la fecha de creación del lote).
- **FR-003**: El timeout de `actualizarProgresoYEstado` DEBE seguir midiéndose desde `fechaInicio` (sin cambios de lógica); con FR-001 queda anclado al arranque real de la run.
- **FR-004**: NO DEBE haber migración de esquema ni de datos.
- **FR-005**: DEBE existir test que cubra el hueco multi-modelo: la actualización a `EN_PROGRESO` fija `fechaInicio` nuevo, y el timeout no se dispara para una run cuyo `fechaInicio` (arranque propio) es reciente aunque su creación sea antigua.

## Success Criteria

- **SC-001**: Lote de 3 modelos × 50 casos: `fechaInicio` de cada run ≈ su propio arranque (run2/run3 con `fechaInicio` posterior al `fechaFin` de la run anterior) y las 3 completan sin FALLIDA por reloj del lote.
- **SC-002**: Gate completo verde (lint, test, build, tsc) + `dev-restart.sh`.

## Assumptions

- El timeout por run (60 min default) es suficiente para los modelos en uso (observado ~13-40 s/caso → ≤ 35 min para 50 casos).
- La validación usa el JSON de 50 casos del laboratorio y 3 modelos disponibles en el Ollama local.

## Implementación

**Fecha**: 2026-07-23 · **Cierre completo**: [`cierre.md`](./cierre.md)

- Fix I-07: `runSimulacionBatchCreator` fija `fechaInicio = now()` al pasar a `EN_PROGRESO` (executor.ts). `createdAt` intacto, sin migración.
- Fix adyacente (bloqueante de la validación): `drainPending` ya no re-encola reportes con job en cola (`src/lib/queue.ts`); la cola se inundaba de duplicados (99-100 jobs, backpressure permanente).
- Tests nuevos: fechaInicio en EN_PROGRESO (executor), timeout no dispara con arranque reciente y creación antigua (progreso, el hueco multi-modelo), dedupe de drenaje (queue).
- Validación en vivo: lote 3 modelos × 10 casos con timeout 15 min → 3/3 COMPLETADA; `fechaInicio(run N+1) > fechaFin(run N)`; evidencia intermedia de una FALLIDA exactamente 15 min desde SU arranque (reloj propio correcto).
- Gate: lint 0 errores · tsc OK · 742/742 tests · build limpio · dev-restart healthcheck OK.
- Commit: `fix(simulacion): timeout por arranque propio de cada run + dedupe de drenaje (spec 084, I-07)`.
