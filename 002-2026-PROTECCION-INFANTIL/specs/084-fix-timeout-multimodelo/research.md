# Research — 084-fix-timeout-multimodelo (I-07)

> Fase 0 (documentada al completar la spec, 2026-07-23). Formato: Decisión / Racional / Alternativas.

## R1. El reloj del timeout se ancla al arranque de la run, no a su creación

- **Decisión:** `runSimulacionBatchCreator` fija `fechaInicio = now()` al pasar `PENDIENTE → EN_PROGRESO`; `createdAt` conserva la creación del lote.
- **Racional:** en un lote multi-modelo todas las runs nacen con el mismo `fechaInicio` (default del schema) y se ejecutan en secuencia: el modelo 2+ consumía su timeout contra el reloj del lote → FALLIDA injusta (observado por ZEUS: qwen OK, aya/gemma/ornith FALLIDA tras 1h13m con mismo `fechaInicio`).
- **Alternativas:** (a) añadir columna `inicioReal` — descartada: reutilizar `fechaInicio` cumple sin migración de schema y sin cambiar el significado visible (el "inicio" de una run ES cuando empieza a procesarse); (b) medir desde el primer caso clasificado — descartada: una run estancada sin casos nunca arrancaría el reloj.

## R2. `drainPending` no re-encola lo ya encolado (bloqueante de la validación)

- **Decisión:** filtro `SELECT DISTINCT data->>'reporteId' FROM pgboss.job WHERE state IN ('created','retry','active')` excluido del drenaje.
- **Racional:** sin dedupe, el drenaje inundaba la cola con duplicados del mismo reporte (observado: 76 jobs de un solo id; backpressure permanente 99-100) y la validación era imposible. Encontrado en vivo durante la validación de I-07.
- **Alternativas:** (a) subir `worker.max_pendientes` — descartada: trata el síntoma; (b) dedupe por `singletonKey` de pg-boss — rechazada: cambiaría el contrato de encolado de toda la app; el filtro SQL es local y explícito.

## R3. Zombis de runs FALLIDA fuera del ciclo

- **Decisión operativa (no código):** los reportes `PENDIENTE` de runs terminadas se marcan `REVISION_MANUAL` manualmente al sanear el entorno; queda como deuda candidata (I-08) que el drenaje excluya reportes de simulación en estado terminal.
- **Racional:** con dedupe ya no saturan, pero procesar trabajo de runs muertas es inútil.
