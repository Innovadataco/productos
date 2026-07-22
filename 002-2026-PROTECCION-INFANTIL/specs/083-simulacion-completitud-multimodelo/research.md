# Research — Spec 083 (I-06)

**Fecha**: 2026-07-22 · **Autor**: ODIN

## Cadena causal verificada (con archivo:línea)

1. `src/lib/simulacion/executor.ts:118` — `runSimulacionBatchCreator` marca `COMPLETADA`
   al terminar de CREAR/encolar reportes (`creados > 0 ? "COMPLETADA" : "FALLIDA"`), no al clasificar.
2. `src/lib/simulacion/progreso.ts:24` — `actualizarProgresoYEstado` retorna temprano si el
   estado ya es final (`COMPLETADA/FALLIDA/CANCELADA`) → `progreso` congelado en 0.
3. `src/app/api/admin/ia/simulaciones/[id]/route.ts:41` — el refresco de métricas exige
   `!run.metricasJson`, pero el batch creator ya escribió `{ casosFallidos: N }` → nunca refresca.
4. `SimulacionCard.tsx:43-47` — la UI lee `metricas.accuracy ?? 0` y `latenciaP50Ms ?? 0` → ceros.
5. Datos crudos presentes: `ClasificacionIA` (categoria, confianza, latenciaMs, usoCascada)
   por reporte; `SimulacionReporte.categoriaEsperada`. `calcularMetricasSimulacion`
   (`metricas.ts`) ya calcula accuracy/porCategoria/matriz/falsosNegativos/p50/p95.

## Piezas reutilizables encontradas

- Transición `EN_PROGRESO → COMPLETADA` cuando `progreso >= totalCasos` (`progreso.ts:32`).
- `refrescarMetricasSimulacion` (`progreso.ts:50`) lista para persistir métricas.
- Cancelación entre batches (`executor.ts:95-99`) y endpoint `cancelar` (solo desde PENDIENTE/EN_PROGRESO).
- Job `simulacion-run` + handler del worker (`worker-reportes.mjs:398`).
- Idempotencia de creación: `SimulacionReporte.reporteId @unique` (schema línea 1047).
- Punto de hook: `src/app/api/reportes/procesar/route.ts:143-152` (tras `finalizarReporte`).

## Gaps detectados

- `metricas.ts` no incluye `usoCascada` en el select → falta `usoDesempate`; tampoco hay promedio de latencia (solo p50/p95).
- Sin timeout: un run `EN_PROGRESO` con worker caído nunca cierra.
- `crearSimulacionSchema` acepta un solo `modelo` (`src/lib/schemas/simulacion.ts`); el form paso 2 es single-select (`NuevaSimulacionForm.tsx:189`).
- Sin agrupación de lote: no existe `loteId`; se evita migración con el job `simulacion-lote`.

## Decisión

Ver `plan.md` (3 cambios: completitud, métricas, multi-modelo secuencial con polling de estado en el worker).
