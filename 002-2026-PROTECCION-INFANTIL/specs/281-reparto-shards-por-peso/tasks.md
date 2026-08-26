# Tasks — SPEC-281 · Reparto de shards por peso

## Estado: IMPLEMENTADO

| # | Tarea | Estado |
|---|-------|--------|
| 1 | `scripts/ci/reparto-shards.mjs` — LPT greedy con fallback a `--shard=N/4` | ✅ Hecho |
| 2 | `scripts/ci/reparto-shards.test.mjs` — 5 tests (reparto real §4.5, determinismo, vacío, un archivo, orden) | ✅ Hecho |
| 3 | `scripts/ci/actualizar-duraciones.mjs` — media móvil 0.4×corrida + 0.6×histórico | ✅ Hecho |
| 4 | `test-durations.json` — seed inicial con los 8 archivos §4.5 (corrida `33000563200`) | ✅ Hecho |
| 5 | `ci.yml` — test-integration usa reparto por peso con fallback | ✅ Hecho |
| 6 | `ci.yml` — actualizar-duraciones solo en rama base + artifact `test-durations-actualizado` | ✅ Hecho |
| 7 | Registrado en `vitest.unit.includes.ts` | ✅ Hecho |

## Verificación manual local

- `for s in 1 2 3 4; do node scripts/ci/reparto-shards.mjs --shard=$s/4 --durations test-durations.json > /tmp/shard-$s.txt; done` → 4 shards con 98-99 archivos cada uno, pesos 6142-6187 s (diff < 1%).
- 397 archivos totales, 0 duplicados, cobertura completa.
- Fallback: JSON inexistente → stdout vacío + warning stderr + exit 0.
