# Tasks — Spec 083: Simulación completitud/métricas + multi-modelo (I-06)

**Spec**: `specs/083-simulacion-completitud-multimodelo/spec.md` · **Plan**: `plan.md` · **Fecha**: 2026-07-22

## Fase 1 — Completitud del ciclo (US1)

- [ ] T001 `src/lib/simulacion/executor.ts`: no marcar COMPLETADA al encolar (queda EN_PROGRESO; FALLIDA solo si 0 creados); persistir `casosFallidos`; reanudable (saltar índices ya creados).
- [ ] T002 `src/app/api/reportes/procesar/route.ts`: hook fail-open tras `finalizarReporte` → `actualizarProgresoYEstado(runId)` si el reporte pertenece a una simulación.
- [ ] T003 `src/lib/simulacion/progreso.ts`: total efectivo (`totalCasos - casosFallidos`), timeout → FALLIDA (`ia.simulacion_timeout_minutos`, default 60), disparar `refrescarMetricasSimulacion` al completar.
- [ ] T004 `src/app/api/admin/ia/simulaciones/[id]/route.ts`: backfill perezoso cuando falten métricas completas (no solo `metricasJson` nulo).
- [ ] T005 `prisma/seed.ts`: parámetro `ia.simulacion_timeout_minutos` (default 60).

## Fase 2 — Métricas ampliadas (US2)

- [ ] T006 `src/lib/simulacion/metricas.ts`: `latenciaPromedioMs` + `usoDesempate` (conteo/porcentaje de `usoCascada`); merge conservando `casosFallidos`.
- [ ] T007 UI: `MetricasSimulacion.tsx` + `SimulacionCard.tsx` muestran promedio y desempate (cambio mínimo).

## Fase 3 — Multi-modelo en secuencia (US3)

- [ ] T008 `src/lib/schemas/simulacion.ts`: `modelos: string[]` (1..5).
- [ ] T009 `src/app/api/admin/ia/simulaciones/route.ts`: POST crea N runs + encola `simulacion-lote`; valida embeddings por modelo.
- [ ] T010 `src/lib/queue.ts`: `sendSimulacionLote(runIds)`.
- [ ] T011 `scripts/worker-reportes.mjs`: handler `simulacion-lote` (secuencia, poll de estado cada 10 s, respeta cancelación/timeout).
- [ ] T012 `NuevaSimulacionForm.tsx`: multi-select paso 2 + estimación agregada + payload `modelos[]`.

## Fase 4 — Tests

- [ ] T013 Ajustar `executor.test.ts`; nuevo `progreso.test.ts`; ampliar tests de métricas.
- [ ] T014 Actualizar `src/app/api/admin/ia/simulaciones/route.test.ts` (POST multi-modelo) y `[id]/route.test.ts` (backfill).

## Fase 5 — Validación y cierre

- [ ] T015 Validación manual: 2 modelos × 50 casos (progreso real, COMPLETADA al final, métricas en BD/UI, secuencia por fechas).
- [ ] T016 Gate: `npm run lint && npm run test && npm run build && npx tsc --noEmit` + `./scripts/dev-restart.sh`.
- [ ] T017 Docs: `quickstart.md`, `cierre.md`, sección Implementación en `spec.md`, índice.
- [ ] T018 Commit: `fix(simulacion): completitud/métricas + selección multi-modelo (spec 083, I-06)`.
