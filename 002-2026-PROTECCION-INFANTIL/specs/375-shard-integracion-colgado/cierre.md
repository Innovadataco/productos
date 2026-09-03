# SPEC-375 · Cierre — el shard colgado

**Fecha**: 2026-09-02 · **Dev**: PI-2 · **Rama**: `work/pi-SPEC-375-shard-integracion-colgado`

## Diagnóstico (antes de tocar nada)

Cuatro runs cancelados a los 40+ min: siempre UN solo shard colgado, mientras
los otros 3 pasaban. Los logs terminaban con `Terminate orphan process: pid
(…) (node (vitest 1))` y un bucle infinito de `FATAL: database "proteccion"
does not exist` (nombre distinto de la BD de test, señal de un pool sin
cerrar).

Dos causas separadas — una del **síntoma**, una del **origen**:

- **Síntoma**: el job `test-integration` no declaraba `timeout-minutes`;
  GitHub aplica el default de **360 min**. Por eso la cancelación era manual.
- **Origen**: `src/lib/queue.ts` crea un singleton `boss = new PgBoss(...)`
  a nivel de módulo. Muchos tests lo importan transitivamente; cuando el
  fork termina, los schedulers internos de pg-boss mantienen handles activos
  y Node no puede salir. Nunca hubo `boss.stop()` en el código.

## Qué cambió

### Cierre limpio de pg-boss (`src/lib/queue.ts`)
- `disposeBoss()`: idempotente, silencioso, sólo llama `boss.stop({graceful:
  false, close:true})` si `ensureStarted()` corrió.
- Auto-registro: al importar el módulo, `disposeBoss` se agrega a
  `globalThis.__pi_test_disposers` — nada global para el runtime de
  producción, sólo un set que el setup de tests consume.

### `afterAll` del setup (`src/lib/test-setup.ts`)
Dispara los disposers registrados por los módulos que el fork realmente usó.
Idempotente: los forks que no importan `queue.ts` encuentran el `Set` vacío
y no hacen nada.

### Tope duro por shard (`.github/workflows/ci.yml`)
`timeout-minutes: 35` en el job `test-integration`. Los shards verdes cierran
en <10 min; 20 min deja margen para el más pesado y corta rápido cualquier
fuga futura. Se acabaron las cancelaciones manuales.

## Evidencia

- **Tests unitarios**: 5 casos del `disposeBoss` (nunca inicializado no llama
  stop; tras start llama con `{graceful:false, close:true}`; idempotente;
  error del stop no propaga; auto-registro al importar).
- **Prueba de humo**: `queue-reconciliacion.test.ts` (integración con `queue`
  real). Wall time medido: **2s**. Sin el fix, el fork habría quedado vivo
  hasta el `hookTimeout` (60s) o más — se comprueba mirando el
  reloj-de-pared, no el JSON del run.

## Gate

`tsc` limpio · lint 0 errores · unit **2001/2001** · `arch:check` VERDE.

## Verificación post-merge (T010)

El próximo run que ejercite integración debe cerrar limpio, sin
`Terminate orphan process: pid (…) (node (vitest N))` en los logs. Y si
alguna vez aparece una fuga nueva de otro módulo, el `timeout-minutes: 35`
lo corta antes de los 40 min y sin cancelación manual.
