# Data Model — 083-simulacion-completitud-multimodelo (I-06)

> **Sin cambios de schema.** Se documenta el uso operativo de las entidades existentes y el nuevo parámetro.

## Entidades (existentes)

### `SimulacionRun`

| Columna | Uso en esta spec |
|---|---|
| `progreso` | Se actualiza por cada caso clasificado (hook en `POST /api/reportes/procesar`), no solo al encolar. |
| `estado` | Ciclo corregido: `PENDIENTE → EN_PROGRESO → COMPLETADA/FALLIDA/CANCELADA`. COMPLETADA solo con `progreso + casosFallidos >= totalCasos`; FALLIDA por timeout. |
| `metricasJson` | Al completar: `accuracy`, `aciertos`, `fallos`, `omitidos`, `latenciaPromedioMs`, `latenciaP50Ms`, `latenciaP95Ms`, `usoDesempate {casos, porcentaje}`, `porCategoria`, `matrizConfusion`, `falsosNegativos`, `distribucionEstados`, `casosFallidos`. |
| `casosJson` | Set de casos; un run por modelo en modo multi-modelo (mismo set). |

### `SimulacionReporte`

- `categoriaEsperada`: referencia para accuracy (canonizada).
- `reporteId @unique`: idempotencia de creación (reintentos del job).
- Identificadores `SIM-<shortRunId>-NNN`: `shortRunId = runId.slice(-6)` (sufijo aleatorio del cuid; el prefijo colisiona entre runs del mismo lote y activaba la deduplicación — bug corregido en esta spec).

### `ClasificacionIA`

- Fuente de métricas: `categoria`, `confianza`, `latenciaMs`, `usoCascada` (uso de desempate).

## Parámetro nuevo (seed)

- `ia.simulacion_timeout_minutos` (INTEGER, default 60): estancamiento máximo de una run `EN_PROGRESO` antes de `FALLIDA`.

## Cola pg-boss

- Job nuevo `simulacion-lote { runIds: string[] }`: ejecución estrictamente secuencial (un run por modelo, en orden).
- Job `simulacion-run` conservado por compatibilidad con jobs ya encolados.
