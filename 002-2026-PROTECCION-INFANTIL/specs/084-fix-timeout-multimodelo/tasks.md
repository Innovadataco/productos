# Tasks — Spec 084: Fix timeout multi-modelo (I-07)

**Spec**: `specs/084-fix-timeout-multimodelo/spec.md` · **Fecha**: 2026-07-23 (completada post-cierre, spec 087-US3)

- [x] T001 Fix `executor.ts`: `fechaInicio = now()` al pasar a `EN_PROGRESO`.
- [x] T002 Test executor: `fechaInicio` se fija al arrancar (I-07).
- [x] T003 Test progreso: creación antigua + arranque reciente NO cae en FALLIDA (hueco multi-modelo).
- [x] T004 Fix bloqueante encontrado en validación: dedupe en `drainPending` + test.
- [x] T005 Saneo del entorno: cola drenada, zombis de runs FALLIDA a `REVISION_MANUAL`.
- [x] T006 Validación en vivo: lote 3 modelos × 10 casos con timeout 15 min → 3/3 COMPLETADA, `fechaInicio(run N+1) > fechaFin(run N)`; evidencia de FALLIDA exactamente 15 min desde el arranque propio. Timeout restaurado a 60.
- [x] T007 Gate: lint 0 errores · tsc OK · 742/742 · build · dev-restart healthcheck OK.
- [x] T008 Docs: spec, plan, quickstart, cierre, índice. Commit `e6553f0e`.
