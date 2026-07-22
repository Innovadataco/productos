# Implementation Plan: Spec 083 — Simulación: completitud/métricas + multi-modelo (I-06)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/083-simulacion-completitud-multimodelo/spec.md`

## Summary

Arreglar el ciclo de vida de `SimulacionRun`: el batch creator deja de marcar `COMPLETADA` al encolar; el progreso se actualiza por caso clasificado mediante un hook en `POST /api/reportes/procesar`; la transición a `COMPLETADA` (con persistencia de métricas ampliadas: accuracy, latencia promedio/p50/p95, uso de desempate) ocurre solo cuando `progreso + noEncolados >= totalCasos`, con `FALLIDA` por timeout configurable. Encima de esa completitud, multi-modelo: el POST acepta `modelos[]`, crea un run por modelo y un job `simulacion-lote` que el worker ejecuta en secuencia esperando el fin de cada run.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Next.js 16, React 19
**Primary Dependencies**: pg-boss (colas), Prisma 5.22, Zod, worker `scripts/worker-reportes.mjs`
**Storage**: PostgreSQL — `SimulacionRun`, `SimulacionReporte`, `ClasificacionIA` (sin migraciones: no se requieren columnas nuevas)
**Testing**: Vitest (unitario: métricas, progreso, secuenciador; integración: POST simulaciones, detalle) + validación manual con JSON de 50 casos
**Constraints**:
- Migraciones aditivas (objetivo: cero migraciones en esta spec).
- No modificar texto original de reportes (constitución) — la simulación solo lee.
- Un solo worker activo (advisory lock); el secuenciador vive en el worker.
- TypeScript estricto, sin `any`.

## Constitution Check

| Regla | Evaluación |
|-------|------------|
| IA local (Ollama) | Sin cambios: la simulación usa el pipeline existente. |
| No modificar texto original de reportes | Cumplido: solo lectura de `ClasificacionIA`/`Reporte.estado`. |
| Spec Kit obligatorio | Cumplido. |
| Un solo worker | El secuenciador corre dentro del worker existente (handler pg-boss), no crea procesos nuevos. |

Sin violaciones que justificar.

## Diseño (Phase 1)

### Cambio 1 — Completitud del ciclo (US1)

**a) `src/lib/simulacion/executor.ts`** (`runSimulacionBatchCreator`):
- Eliminar el cierre `COMPLETADA` al encolar. Al terminar la creación:
  - `creados === 0` → `FALLIDA` + `fechaFin` (como hoy).
  - `creados > 0` → queda `EN_PROGRESO`; persistir `metricasJson: { ...actual, casosFallidos: fallidos }` (clave conservada por compatibilidad).
- Reanudabilidad: antes de crear el reporte del índice N, verificar si ya existe `SimulacionReporte(runId, indice)` y saltarlo (protege reintentos del job de secuencia además del `@unique` de `reporteId`).

**b) Hook por caso — `src/app/api/reportes/procesar/route.ts`**:
- Tras `finalizarReporte` (línea ~143) y antes de `respuestaExito`: buscar `SimulacionReporte` por `reporteId`; si existe, llamar `actualizarProgresoYEstado(runId)` en try/catch (fail-open con log; la clasificación nunca falla por el hook).
- Esto actualiza `progreso` en tiempo real aunque nadie consulte la UI, y dispara la transición a `COMPLETADA` en cuanto se clasifica el último caso.

**c) `src/lib/simulacion/progreso.ts`** (`actualizarProgresoYEstado`):
- Total efectivo: `totalCasos - casosFallidos` (leído de `metricasJson.casosFallidos ?? 0`). Completitud: `progreso >= totalEfectivo && totalEfectivo > 0` → `COMPLETADA` + `fechaFin` + disparar `refrescarMetricasSimulacion`.
- Timeout: si `EN_PROGRESO` y `now - fechaInicio > timeoutMinutos` → `FALLIDA` + `fechaFin`. Timeout desde `ParametroSistema` clave `ia.simulacion_timeout_minutos` (default 60; registrar en seed).
- Mantener el early-return para estados finales.
- `GET [id]/route.ts`: cambiar la condición de backfill a `estado === "COMPLETADA" && !tieneMetricasCompletas` (p. ej. falta `accuracy` en `metricasJson`), cubriendo runs históricas con `{casosFallidos}` solamente (FR-005).

### Cambio 2 — Métricas ampliadas (US2)

**`src/lib/simulacion/metricas.ts`** (`calcularMetricasSimulacion`):
- Añadir al retorno: `latenciaPromedioMs` (media de `latenciaMs`) y `usoDesempate: { casos: number; porcentaje: number }` (conteo de `ClasificacionIA.usoCascada = true`). Incluir `usoCascada` en el `select` de clasificaciones.
- Conservar todo lo existente (`porCategoria`, `matrizConfusion`, `falsosNegativos`, `distribucionEstados`).
- `refrescarMetricasSimulacion`: merge con `casosFallidos` previo (no pisarlo).

**UI**: `SimulacionCard` y `MetricasSimulacion` ya leen `accuracy`/`latenciaP50Ms`; añadir tarjeta/línea para latencia promedio y desempate (cambio mínimo de presentación, no rediseño).

### Cambio 3 — Multi-modelo en secuencia (US3)

**a) Contrato — `src/lib/schemas/simulacion.ts`**: `crearSimulacionSchema`: `modelo: string` → `modelos: z.array(z.string().min(1)).min(1).max(5)`. (max 5 por corrida, documentado.)

**b) `POST /api/admin/ia/simulaciones/route.ts`**:
- Validar cada modelo con `isEmbeddingModel`.
- Parsear el archivo UNA vez; crear N `SimulacionRun` (mismo `casosJson`, `totalCasos`), estados `PENDIENTE`, en orden del array.
- Encolar UN job `simulacion-lote` con `{ runIds: string[] }` (nuevo `sendSimulacionLote` en `src/lib/queue.ts`).
- Respuesta 202: `{ runIds, estado: "PENDIENTE", totalCasos }`.
- El 409 de "simulación en curso" no cambia: cualquier run `PENDIENTE`/`EN_PROGRESO` bloquea nuevos lanzamientos (cubre el lote completo, FR-008).

**c) Worker — `scripts/worker-reportes.mjs`**:
- Nuevo handler `simulacion-lote`: para cada `runId` en orden:
  1. Releer el run; si `CANCELADA`/estado final → saltar al siguiente (FR-008).
  2. Ejecutar `runSimulacionBatchCreator(runId, run.modelo)` (idempotente por índice).
  3. Esperar completitud: poll a BD cada 10 s hasta estado final o timeout (`ia.simulacion_timeout_minutos` + margen); el estado final lo fija el hook de Cambio 1 — aquí solo se observa.
- Mantener el handler `simulacion-run` (compat con jobs ya encolados); el POST deja de usarlo.
- Cancelar: el endpoint existente por run sigue igual; el secuenciador lo respeta al saltar runs cancelados.

**d) UI — `NuevaSimulacionForm.tsx` paso 2**:
- Multi-selección: lista de checkboxes con los modelos de clasificación (excluye embeddings, como hoy).
- Estimación agregada: suma de la estimación por modelo.
- `lanzar` envía `{ modelos, archivo, formato }`; paso 3 muestra los N runs creados (o redirige al dashboard).
- Dashboard: sin cambios estructurales — una `SimulacionCard` por run/modelo ya muestra progreso/accuracy/latencia (FR-009).

### Alternativas consideradas

| Alternativa | Decisión | Motivo |
|-------------|----------|--------|
| Hook de progreso en `procesar` + transición en `progreso.ts` | **Elegida** | Progreso real sin depender de la UI; reutiliza la transición ya escrita. |
| Progreso solo por polling del GET detalle | Rechazada | Sin watcher no hay COMPLETADA → la secuencia multi-modelo no podría esperar de forma fiable. |
| Secuenciador en el worker con job `simulacion-lote` + poll de estado | **Elegida** | Sin migraciones, reanudable, respeta cancelación; el estado final lo produce el Cambio 1. |
| Encadenamiento por evento (al completar run N encolar N+1) con `loteId` en BD | Rechazada | Requiere migración y reparte la lógica del lote; más piezas móviles para el mismo resultado. |
| Espera activa en la API (HTTP bloqueado) | Rechazada | Timeouts de request; la secuencia es trabajo de worker. |

## Project Structure

### Documentation (this feature)

```text
specs/083-simulacion-completitud-multimodelo/
├── spec.md · plan.md · research.md · quickstart.md
├── checklists/requirements.md
├── contracts/simulaciones-api.md   # cambio POST (modelos[]) + detalle
└── tasks.md
```

### Source Code (repository root)

```text
src/lib/simulacion/executor.ts          # no COMPLETADA al encolar + reanudable
src/lib/simulacion/progreso.ts          # total efectivo, timeout, disparo de métricas
src/lib/simulacion/metricas.ts          # latenciaPromedioMs + usoDesempate
src/lib/queue.ts                        # sendSimulacionLote
src/lib/schemas/simulacion.ts           # modelos: string[]
src/app/api/reportes/procesar/route.ts  # hook de progreso (fail-open)
src/app/api/admin/ia/simulaciones/route.ts        # POST multi-modelo
src/app/api/admin/ia/simulaciones/[id]/route.ts   # backfill de métricas corregido
scripts/worker-reportes.mjs             # handler simulacion-lote
src/components/modules/ia/simulacion/NuevaSimulacionForm.tsx  # multi-select
src/components/modules/ia/simulacion/MetricasSimulacion.tsx   # +promedio/desempate
prisma/seed.ts                          # param ia.simulacion_timeout_minutos (default 60)
```

Tests: `executor.test.ts` (existente, ajustar), nuevos `progreso.test.ts`, ampliar `metricas` tests, `route.test.ts` de simulaciones (POST multi + detalle backfill), test del form si existe patrón aplicable.

## Plan de ejecución (tras aprobación de ZEUS)

1. Cambio 1 (executor + hook + progreso) con tests unitarios/integración.
2. Cambio 2 (métricas + UI de lectura) con tests.
3. Cambio 3 (schema, POST, queue, worker lote, form) con tests.
4. Validación manual quickstart: 2 modelos × 50 casos; progreso real, COMPLETADA al final, métricas en BD/UI, secuencia verificada por fechas.
5. Gate completo + `dev-restart.sh` (deja UN worker con el handler nuevo).
6. Docs de cierre + índice + commit.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| El hook enlentece `procesar` | Best-effort, una query por `reporteId` indexada; try/catch fail-open. |
| Runs históricas EN_PROGRESO "zombi" (anteriores al fix) | El timeout las cierra como `FALLIDA`; documentado en quickstart. |
| Worker viejo sin handler `simulacion-lote` | `dev-restart.sh` garantiza un solo worker con código nuevo; validación manual lo confirma. |
| Race: dos polls de completitud cierran el run a la vez | La transición es idempotente (early-return en estados finales + update condicional). |

## Complexity Tracking

Sin violaciones de constitución que justificar.
