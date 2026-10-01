# Tasks · SPEC-804 · El temporal sale de `src/`

- [x] T001 `tokens-check.ts`: overrides `TOKENS_CHECK_SRC` / `TOKENS_CHECK_PISO` (default real; `--tension` intacto).
- [x] T002 `tokens-ratchet-sin-serializar.candado.test.ts`: fixture del caso rojo al tmpdir (fuera de `src/`) + control positivo del override; se quita `src/__spec466_tmp__`.
- [x] T003 Candado de barrido `ningun-test-escribe-en-src.candado.test.ts` + registro en `vitest.unit.includes.ts`.
- [ ] T004 Gates: tsc + eslint + candados + arch:check + test:unit completo.
- [ ] T005 Commit + push + PR + reporte.
