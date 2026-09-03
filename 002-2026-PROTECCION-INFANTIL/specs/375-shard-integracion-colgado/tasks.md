# SPEC-375 · Tasks

- [X] T001 Diagnóstico 15v5: ci.yml, logs de runs 33675000950 y 33656371511, vitest.config
- [X] T002 Rastrear causa raíz: singleton pg-boss en `src/lib/queue.ts` sin cierre
- [X] T003 [FR-001] `timeout-minutes: 35` en el job `test-integration`
- [X] T004 [FR-002] `disposeBoss()` idempotente en `queue.ts` con registro en `globalThis.__pi_test_disposers`
- [X] T005 [FR-003] `afterAll` en `test-setup.ts` que dispara disposers registrados
- [X] T006 [FR-004] `disposeBoss` traga errores del `stop`
- [X] T007 5 tests unitarios: nunca inicializado no llama stop; tras start llama con {graceful:false, close:true}; idempotente; error del stop no propaga; auto-registro al importar
- [X] T008 Prueba de humo: `queue-reconciliacion.test.ts` (integración con queue real) — wall time 2s (antes: proceso colgado)
- [X] T009 Gate: tsc, lint 0, unit 2001, arch:check
- [ ] T010 [Post-merge] verificación viva: el próximo run de CI con integración corriendo debe cerrar limpio, sin `Terminate orphan process` en el log
