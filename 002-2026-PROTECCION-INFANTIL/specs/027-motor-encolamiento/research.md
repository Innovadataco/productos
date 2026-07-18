> # Research — Motor de encolamiento

**Date**: 2026-07-18
**Feature**: specs/027-motor-encolamiento/spec.md

---

## Decisión D1: Mantener pg-boss, usar capacidades nativas

**Versión**: `pg-boss@^12.26.0` (ya en producción).

### Priority nativo

pg-boss soporta `priority` en `send()`:
- Mayor número = mayor prioridad.
- Default = 0.
- Se puede pasar al crear el job.

```typescript
await boss.send("reporte-procesamiento", { reporteId }, { priority: 10 });
```

**Decisión**: usar `priority = 10` para autenticados y anónimos con keyword de alto riesgo; `priority = 1` para anónimos base.

### Retry nativo

pg-boss soporta en `send()`:
- `retryLimit`: cuántas veces reintentar tras el primer intento.
- `retryDelay`: segundos base entre reintentos.
- `retryBackoff`: true activa backoff exponencial (delay × 2 por intento).

**Decisión**: leer `worker.max_reintentos` y `worker.retry_delay_segundos` de `ParametroSistema` y aplicarlos dinámicamente en `send()`.

### Concurrencia nativa

pg-boss v12 soporta en `work()`:
- `teamSize`: cuántos jobs pedir de la cola por iteración.
- `teamConcurrency`: cuántos jobs procesar en paralelo.
- `batchSize`: cuántos jobs entregar por llamada (usaremos 1).

**Decisión**: `teamSize = teamConcurrency = worker.concurrencia` para controlar paralelismo según GPU.

### Backpressure

pg-boss no tiene límite nativo de jobs pendientes configurable. Implementaremos backpressure a nivel aplicación:
- Antes de `send()`, contar jobs pendientes de `reporte-procesamiento` en `pgboss.job`.
- Si `pendientes >= worker.max_pendientes`, no encolar; dejar reporte en `PENDIENTE`.
- Un job de "drenaje" o el hook `onComplete` del worker encola pendientes cuando baja la carga.

---

## Decisión D2: Historial de intentos en tabla propia

pg-boss guarda jobs fallidos en `pgboss.job` con `state = 'failed'`, pero no ofrece un historial limpio de intentos con errores detallados para mostrar al operador.

**Decisión**: tabla `ReintentoReporte` propia. El worker escribe una fila al finalizar cada intento (éxito o fracaso). Esto da control total sobre retención y presentación.

---

## Decisión D3: No agregar otra herramienta de cola

Se evaluó si `bullmq` o `sqs` aportaban algo que pg-boss no tuviera. Dado que:
- pg-boss ya está en uso y probado.
- PostgreSQL ya es dependencia obligatoria.
- priority, retry y concurrencia cubren los requisitos.

**Decisión**: no agregar nueva herramienta de cola.

---

## Open questions

1. ¿El backpressure aplica también a evaluaciones del laboratorio? Por ahora solo a reportes.
2. ¿Se requiere alerta cuando `jobs pendientes > umbral crítico`? Se puede agregar en fase de monitoreo.
