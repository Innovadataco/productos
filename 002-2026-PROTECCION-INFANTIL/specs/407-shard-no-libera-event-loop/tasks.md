# Tasks · SPEC-407 · I-282 — instrumentación

**Status**: DESARROLLO
**Fecha**: 2026-09-03 · **Dev**: Infra (idc-c0)

- [x] T001 Verificar la evidencia dura del run 33777723622 (shard 1 rojo vs shard 3 verde: mismo `Cleaning up orphan processes`).
- [x] T002 Descartar sospechosos con medición local de 3 archivos pesados (webhook resend + embedding + procesar-lote) con wtfnode + `--trace-exit`.
- [x] T003 Añadir `wtfnode` como devDep (`npm install --save-dev wtfnode`).
- [x] T004 Instrumentar `test-setup.ts` en el `afterAll` global, protegido por `VITEST_DEBUG_HANDLES=1`.
- [x] T005 Añadir env condicional en `.github/workflows/ci.yml` step "Correr shard" que sólo se activa en ramas `work/pi-SPEC-407-*`.
- [x] T006 Escribir `spec.md`, `plan.md`, `tasks.md` en `specs/407-shard-no-libera-event-loop/` con Status DESARROLLO.
- [x] T007 Fila 407 en `specs/README.md`.
- [ ] T008 Correr `src/lib/specs-discipline.test.ts` local — verde.
- [ ] T009 Correr `src/lib/notificaciones/motivo-error.test.ts` + `senales/route.test.ts` con y sin flag para confirmar que sin flag el comportamiento es idéntico (no aparece dump).
- [ ] T010 Commit + push `work/pi-SPEC-407-shard-no-libera-event-loop` + abrir PR draft.
- [ ] T011 Esperar CI del shard 1 con la flag; extraer la lista de handles del log; adjuntar al reporte al CEO.
