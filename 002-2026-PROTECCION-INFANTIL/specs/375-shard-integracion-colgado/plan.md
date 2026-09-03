# SPEC-375 · Plan

1. Leer el ci.yml, los logs de dos runs cancelados y el vitest.config para no
   tocar antes de entender (15v5).
2. Identificar el patrón (siempre UN shard, no siempre el mismo → causa no
   determinista) y la firma en el log ("orphan process: node (vitest 1)"
   + `database "proteccion" does not exist` en bucle).
3. Rastrear la fuente: `src/lib/queue.ts` singleton de pg-boss sin cierre.
4. Aplicar los 3 fixes complementarios:
   - `timeout-minutes: 35` (síntoma → cortado antes del limite en vez de esperar 40 min a cancelación manual; ancla numérica sobre el máximo real medido).
   - `disposeBoss()` en `queue.ts` con registro global.
   - `afterAll` en `test-setup.ts` que dispara los disposers.
5. Tests unitarios del disposer (idempotente, no falla sin start, registro).
6. Prueba de humo en local: un test de integración que use `queue.ts` real y
   MIDIR el wall time — si el proceso no se cerrara, el shell bloquearía.
