# Cierre — Spec 084: Fix timeout multi-modelo de simulación (I-07)

**Fecha**: 2026-07-23
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/084-fix-timeout-multimodelo/`
**Incidencia**: I-07
**Estado**: FINALIZADO — pendiente ACTA-VALIDACION de ZEUS para marcar CERRADA

## Cambios realizados

1. **`src/lib/simulacion/executor.ts`** (fix I-07): el update a `EN_PROGRESO` en `runSimulacionBatchCreator` ahora fija `fechaInicio: new Date()`. El timeout (que mide desde `fechaInicio` en `progreso.ts`) queda anclado al arranque real de cada run, no a la creación del lote. `createdAt` intacto. Sin migración.
2. **`src/lib/queue.ts`** (bloqueante encontrado en validación): `drainPending` ya no re-encola reportes que ya tienen un job en cola (`SELECT DISTINCT data->>'reporteId' FROM pgboss.job ... state IN ('created','retry','active')`). Sin este filtro, el drenaje inundaba la cola con duplicados del mismo reporte (99-100 jobs, backpressure permanente, procesamiento efectivo casi nulo) e imposibilitaba la validación.
3. **Tests**: `executor.test.ts` (+1: `fechaInicio` se fija al pasar a EN_PROGRESO), `progreso.test.ts` (+1: run creada hace 2 h pero arrancada hace 5 min NO cae en FALLIDA — el hueco multi-modelo), `queue.test.ts` (+1: drenaje no re-encola lo ya encolado; mocks ajustados).

## Validación en vivo (lote de 3 modelos × 10 casos, timeout 15 min)

Set: primeros 10 casos de `simulacion-50-casos-eval.json`. Timeout temporal 10→15 min para hacer observable el escenario del bug (restaurado a 60 al final).

**Hallazgo ambiental durante la validación**: la cola estaba saturada por 91 reportes `PENDIENTE` zombis del lote histórico FALLIDO de ZEUS (runs `cmrwpfhg*`: qwen2.5:32b COMPLETADA, aya/gemma/ornith FALLIDA) que el drenaje re-encolaba sin deduplicar (76 jobs duplicados de un mismo reporte). Se marcaron `REVISION_MANUAL` (evidencia de las runs intacta) y se corrigió `drainPending` (punto 2).

**Lote final (`cmrwu40z*`)**: 3/3 COMPLETADA × 10/10. Las 3 runs comparten `createdAt` (01:30:27, creación del lote) y cada `fechaInicio` quedó anclado a su propio arranque:

| Modelo | createdAt | fechaInicio | fechaFin | Estado |
|--------|-----------|------------|----------|--------|
| ornith:9b | 01:30:27 | 01:30:29 | 01:32:54 | COMPLETADA 10/10 |
| qwen2.5:14b | 01:30:27 | 01:32:59 (> fin ornith) | 01:35:40 | COMPLETADA 10/10 |
| llama-guard3:8b | 01:30:27 | 01:35:49 (> fin qwen) | 01:36:48 | COMPLETADA 10/10 |

`fechaInicio(run N+1) > fechaFin(run N)` en todos los casos; ninguna FALLIDA por el reloj del lote. Timeout restaurado a 60 tras la validación.

### Evidencia intermedia (primer lote tras el fix, `cmrwsx4*`)

| Modelo | fechaInicio | fin | Estado | Lectura |
|--------|------------|-----|--------|---------|
| ornith:9b | 00:57:06 | 00:59:32 | COMPLETADA 10/10 | reloj propio |
| qwen2.5:14b | 00:59:36 (> fin ornith) | 01:14:37 | FALLIDA 2/10 | FALLIDA exactamente 15:01 min desde SU arranque: el reloj propio funciona; murió por la congestión del drenaje (ya corregida) |
| llama-guard3:8b | 01:14:37 (17.5 min tras creación del lote) | 01:27:47 | COMPLETADA 10/10 | con el bug viejo habría muerto al instante (17.5 > 15); prueba directa del fix |

## Gate de calidad

- `npm run lint`: 0 errores (1 warning heredado). `npx tsc --noEmit`: OK.
- `npm run test`: 742/742 (741 + 1 test de drenaje).
- `rm -rf .next && npm run build`: OK. `./scripts/dev-restart.sh`: healthcheck OK, un solo worker.

## Deuda técnica registrada

- El drenaje sigue re-encolando reportes `PENDIENTE` de runs FALLIDA/CANCELADA (con dedupe ya no inunda, pero procesa trabajo inútil). Candidato a I-08: excluir reportes de simulación en estado terminal del `drainPending`.
- `progreso.ts` lee el timeout en cada evaluación (`obtenerTimeoutMinutos`): correcto pero podría cachearse si se vuelve cuello de botella.

## Commit

- `fix(simulacion): timeout por arranque propio de cada run + dedupe de drenaje (spec 084, I-07)`
