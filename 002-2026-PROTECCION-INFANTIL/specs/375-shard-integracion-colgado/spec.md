# SPEC-375 · El shard de integración se cuelga 40 min

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-2 · **Origen**: 4 runs ayer con un shard cancelado a los 40+ min (PRs #251 · #253 · #257 · #263).

## El problema

En ~4 PRs del último día un shard de `test-integration` quedó atascado ~40 min
mientras los otros 3 pasaban. Requirió cancelación manual. Los PRs afectados
(#251, #253, #257) no tocaban la superficie de integración. Comportamiento
inestable — cae ora en el shard 3, ora en el 4.

## Diagnóstico (candado 15v5, antes de tocar)

1. **Reparto SPEC-281**: OK, funciona; el reparto por peso no explica el
   cuelgue.
2. **Timeout por shard**: **FALTABA**. El job `test-integration` no declaraba
   `timeout-minutes`; se aplica el default de GitHub de **360 min**. Por eso
   la cancelación tenía que ser manual.
3. **Qué proceso queda colgado**: el log del runner terminaba con
   `Terminate orphan process: pid (…) (node (vitest 1))` — un fork de vitest
   vivo, y bucle infinito de intentos de conexión a la BD `proteccion`
   (nombre distinto de la de test, señal de un pool sin cerrar). Origen:
   `src/lib/queue.ts` crea un singleton `boss = new PgBoss(...)` a nivel de
   módulo y **nunca lo apaga**. Muchos tests lo importan transitivamente;
   cuando el fork termina, los schedulers internos de pg-boss dejan handles
   activos y Node no puede salir.

## Requisitos

- **FR-001 (cierra el síntoma)**: `test-integration` DEBE tener
  `timeout-minutes: 35`. Máximo real de shard sano medido sobre 6 corridas
  verdes recientes: 20.5 min (mediana 16). 35 min = mediana × 2 con aire
  para el más lento, y sigue cortando rápido las fugas de 40+ min que
  requerían cancelación manual.
- **FR-002 (cierra la causa)**: `src/lib/queue.ts` DEBE exponer
  `disposeBoss()` idempotente que apague pg-boss (`stop({graceful:false,
  close:true})`), y auto-registrarlo al ser importado.
- **FR-003**: El setup global de tests (`src/lib/test-setup.ts`) DEBE
  invocar los disposers registrados en `afterAll`, cerrando handles activos
  al final de cada fork.
- **FR-004**: `disposeBoss()` NUNCA propaga errores — el shutdown no puede
  reventar un fork que ya pasó los tests.

## Impacto en arquitectura:

Sin cambios de contrato ni de esquema. Un helper nuevo en `queue.ts` con
tests unitarios (mock del constructor de pg-boss), un `afterAll` en el
`test-setup.ts` global que dispara disposers registrados, y `timeout-minutes`
en el job del workflow.
