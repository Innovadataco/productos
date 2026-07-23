# Data Model — 084-fix-timeout-multimodelo

> **Sin cambios de schema.** Esta spec no crea migraciones. Se documenta el uso de columnas existentes.

## `SimulacionRun` (existente, sin alterar)

| Columna | Uso en esta spec |
|---|---|
| `fechaInicio` | Re-definida operativamente: se fija con `now()` al pasar `PENDIENTE → EN_PROGRESO` (arranque real de la run). Antes: solo el default `now()` de creación. |
| `createdAt` | Conserva la creación (del lote). Es la referencia para distinguir creación vs arranque. |
| `estado` | El timeout convierte `EN_PROGRESO → FALLIDA` cuando `now - fechaInicio > ia.simulacion_timeout_minutos`. |
| `fechaFin` | Se fija al entrar a estado final (ya existía en spec 083). |

## Parámetro de sistema (existente, creado por la 083)

- `ia.simulacion_timeout_minutos` (INTEGER, default 60): ventana máxima de una run `EN_PROGRESO`, ahora medida desde su propio arranque.

## Cola pg-boss (sin cambios de contrato)

- `drainPending` filtra reportes con job activo en `pgboss.job` (`state IN ('created','retry','active')`) antes de re-encolar: elimina duplicados sin tocar `boss.send`.
