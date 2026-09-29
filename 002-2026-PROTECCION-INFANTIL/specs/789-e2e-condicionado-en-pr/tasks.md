# Tasks · SPEC-789

## Fase 1 — Módulo de decisión (TDD)

- [x] T001 `scripts/ci/should-run-e2e-pi.mjs`: `puedeRomperArnesE2E(path)` + `deberCorrerE2E(files)` + CLI.
- [x] T002 `scripts/ci/should-run-e2e-pi.test.mjs`: casos de arnés (true) y no-arnés (false), mixtos, vacío.
- [x] T003 Registrar el test en `vitest.unit.includes.ts` (al lado de `should-skip-pi.test.mjs`).

## Fase 2 — Cableado en CI

- [x] T004 `ci.yml` · job `should-skip`: nuevo output `e2e` con el mismo `files_changed`.
- [x] T005 `ci.yml` · job `test-e2e`: `if:` = `skip != 'true' && (event != 'pull_request' || e2e == 'true')`.
- [x] T006 `ci.yml` · comentario de racionalidad al lado de la condición (no borrar por completitud).

## Fase 3 — Verificación

- [x] T007 `should-run-e2e-pi.test.mjs` verde (unit config).
- [x] T008 Smoke CLI: schema→true, solo-src→false, este PR→false.
- [x] T009 Job `test-unit` completo verde (incluye `specs-discipline`).
- [x] T010 Candado `trigger-push-main` verde (push a main intacto).

## Fase 4 — Cierre

- [x] T011 Commit + push a `work/pi-SPEC-789-e2e-condicionado-en-pr` + PR.
