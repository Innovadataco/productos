# Tasks · SPEC-803 · 00/01/06 fuera del gate byte-exacto

- [x] T001 `artefactos.ts`: flag `fueraDelGatePorPR` + marcar 00/01/06.
- [x] T002 `arch-check.ts`: salto por `fueraDelGatePorPR` tras la representabilidad; log de (a) actualizado.
- [x] T003 `generados-post-merge.yml`: regenera + commitea también 00/01/06.
- [x] T004 Candado `docs-globales-fuera-del-gate.candado.test.ts` + registro en `vitest.unit.includes.ts`.
- [x] T005 Control positivo operacional verificado (01 drifteado → arch:check verde + regen lo arregla).
- [ ] T006 Gates: tsc + eslint + arch:check + test:unit completo.
- [ ] T007 Commit + push + PR + reporte.
