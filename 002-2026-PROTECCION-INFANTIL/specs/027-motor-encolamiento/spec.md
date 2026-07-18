> # Spec 027 — Motor de encolamiento

> Estado: **EN DISEÑO**.
> Plan: [`plan.md`](plan.md).

## Alcance

Rediseñar la infraestructura de cola de procesamiento de reportes. Hoy `src/lib/queue.ts` + `scripts/worker-reportes.mjs` usan pg-boss de forma básica: FIFO, concurrencia default, `retryLimit:3` hardcodeado, sin prioridad ni backpressure. Esta spec hace el motor configurable, con prioridad, reintentos y comportamiento bajo saturación.

## Decisiones

- **pg-boss nativo**: se mantiene. Se usará `priority` nativo de pg-boss, `retryLimit`/`retryDelay` dinámicos y `teamConcurrency`/`teamSize` configurables.
- **Prioridad**:
  - Reporte autenticado (`esAnonimo=false`) = ALTA.
  - Reporte anónimo = BAJA.
  - Anónimo con keyword de alto riesgo (`src/lib/ai/keywords-riesgo.ts`) = ALTA.
- **Reintentos**: máximo `N` configurable (`worker.max_reintentos` en `ParametroSistema`) + delay `worker.retry_delay_segundos`.
- **Historial de intentos**: tabla propia `ReintentoReporte` con contador, error y fecha/hora de cada intento. El operador debe verlo.
- **Concurrencia**: configurable (`worker.concurrencia`) según capacidad de GPU.
- **Saturación**: bajo N reportes de golpe, pg-boss acumula jobs. Se agrega límite de jobs pendientes (`worker.max_pendientes`) para backpressure; si se supera, nuevos reportes quedan en `PENDIENTE` sin encolar hasta que baje la carga.
- Todo parametrizable desde `/dashboard/admin/configuracion`.

## Requisitos

1. Refactorizar `src/lib/queue.ts` para soportar priority, retry dinámico y concurrencia configurable.
2. Refactorizar `scripts/worker-reportes.mjs` para respetar configuración.
3. Crear `ReintentoReporte` y registrar cada intento.
4. Parámetros en `ParametroSistema`: `worker.max_reintentos`, `worker.retry_delay_segundos`, `worker.concurrencia`, `worker.max_pendientes`.
5. Si se agotan reintentos, el reporte pasa a `REVISION_MANUAL` con historial visible.
6. Registrar transiciones en Spec 022.

## Riesgos mitigados

- Pérdida de reportes por fallos transitorios.
- Saturación de GPU por ráfagas.
- Injusticia entre reportes autenticados y anónimos.

## R7

No aplica: no toca el pipeline de clasificación; solo la infraestructura de ejecución.
