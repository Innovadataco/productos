# Tasks · SPEC-800 · Fijar la versión de Node

- [x] T001 `.nvmrc` = 22 en la raíz del repo.
- [x] T002 `engines.node` = "22.x" en `package.json` de 002.
- [x] T003 Candado de paridad `scripts/ci/node-version-paridad.candado.test.ts` (barrido + mutación en memoria dos direcciones).
- [x] T004 Registrarlo en `vitest.unit.includes.ts` (corre y bloquea vía pi-gate).
- [x] T005 RED-first verificado (nvmrc=24 → rojo; revertido).
- [x] T006 Documentar activación del pin en `AGENTS.md` de 002.
- [ ] T007 Gates: tsc + eslint + test:unit completo + arch:check.
- [ ] T008 Commit + push + PR + reporte.
