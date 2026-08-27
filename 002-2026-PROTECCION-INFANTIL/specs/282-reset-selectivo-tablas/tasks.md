# Tasks — SPEC-282 · `resetDatabase()` selectivo por tablas

## Estado: IMPLEMENTADO

| # | Tarea | Estado |
|---|-------|--------|
| 1 | `src/lib/test-utils.ts` — firma extendida `resetDatabase(tablas?: string[])` retro-compatible | ✅ Hecho |
| 2 | Helpers `truncateAtomic()` y `obtenerTablasDePGTables()` extraídos para claridad | ✅ Hecho |
| 3 | `src/lib/test-utils.test.ts` — 4 tests con BD real (sin args, lista, inexistente, vacío) | ✅ Hecho |
| 4 | Warning a stderr si se pasa tabla en `EXCLUDED_TABLES` | ✅ Hecho |
| 5 | Error si se pasa tabla que no existe en `pg_tables` | ✅ Hecho |

## Verificación

- `node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run src/lib/test-utils.test.ts` → 4/4 verde.
- 0 archivos de la suite existente migrados. Los 364 archivos que llaman `resetDatabase()` sin args siguen exactamente igual.
