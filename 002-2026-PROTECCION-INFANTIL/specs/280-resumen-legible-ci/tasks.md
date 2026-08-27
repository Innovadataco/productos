# Tasks — SPEC-280 · Resumen legible al final de cada corrida

## Estado: IMPLEMENTADO

| # | Tarea | Estado |
|---|-------|--------|
| 1 | `scripts/ci/resumen.mjs` — constructor puro del bloque Markdown | ✅ Hecho |
| 2 | `scripts/ci/resumen.test.mjs` — 5 tests unitarios (verde, rojo, cancelado, skipped, parcial) | ✅ Hecho |
| 3 | Registrar el test en `vitest.unit.includes.ts` | ✅ Hecho |
| 4 | `ci.yml` — `test-integration-coverage` emite `vitest-summary.json` + `coverage-summary.json` como artifact | ✅ Hecho |
| 5 | `ci.yml` — nuevo job `resumen` con `if: always()` que descarga artifacts + `gh api jobs` + escribe a `$GITHUB_STEP_SUMMARY` | ✅ Hecho |
