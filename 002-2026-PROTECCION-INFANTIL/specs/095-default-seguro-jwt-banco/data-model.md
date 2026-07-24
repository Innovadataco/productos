# Data Model — 095-default-seguro-jwt-banco

> Sin migraciones de schema. Cambios de datos vía seed y de contrato de configuración.

## CasoEval (unificación del banco)

- `fixtureVersion=2`: los 200 casos del banco gobernado (`scripts/simulacion/simulacion-50-casos-eval.json`), sembrados por `seedBancoGobernado()` con upsert por (texto, fuente=SEMILLA, fixtureVersion=2), preservando `categoriaEsperada` y `secundariaEsperada`.
- `fixtureVersion=1`: los 110 casos del eval-runner original — SUBORDINADOS (no se borran; historia del eval-runner).
- El JSON de simulación pasa a ser un EXPORT (`scripts/exportar-banco-simulacion.ts` regenera desde CasoEval v2). La gobernanza vive en BD.

## Parámetros

| Clave | Estado |
|---|---|
| `ia.rubrica.enabled` | `false` (seed + dev) — legacy por defecto (D-19); la rúbrica se activa explícitamente |
| `security.jwt_ttl_hours` | LEÍDO por `auth.ts` (fallback 24h) |
| `security.password_min_length` | LEÍDO por `cambiar-password` (fallback 8) |
| `system.maintenance_mode` | RETIRADO del seed (sin feature) |
| `reportes.worker.max_retries` | RETIRADO del seed (duplicado de `worker.max_reintentos`) |
| `reportes.worker.stalled_threshold_minutes` | RETIRADO del seed (sin feature) |

## Artefactos (no tablas)

- `docs/adjudicacion-095-casos-disputa.md`: hoja de adjudicación (42 casos, votos por modelo, columnas vacías).
- `scripts/simulacion/resultados-dual-095.json`: salida del runner dual.
