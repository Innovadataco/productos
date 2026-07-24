# Cierre — Spec 095: Default seguro, JWT parametrizado y banco gobernado

**Fecha**: 2026-07-24
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/095-default-seguro-jwt-banco/`
**Estado**: FINALIZADO — pendiente ACTA-VALIDACION de ZEUS

## Resumen por US

| US | Resultado |
|---|---|
| US1 Default seguro (D-19) | `ia.rubrica.enabled=false` en seed + BD dev + fallback del loader (sin clave → legacy). La rúbrica y toda su configuración se conservan (activable por parámetro). Tests del loader 3/3. |
| US2 JWT parametrizado (D-21) | `auth.ts` lee `security.jwt_ttl_hours` con fallback 24h (tests 3/3: param 1h, ausente, inválido). |
| US3 Banco gobernado (D-20) | CasoEval unificado: 200 casos fixtureVersion=2 (gobernado) + 110 fixtureVersion=1 (subordinado). Export reproducible. Hoja de adjudicación generada. Runner dual verificado. |

## Qué quedó cableado / retirado / pendiente

**Cableados (2)**: `security.jwt_ttl_hours` (auth.ts, fallback 24h) · `security.password_min_length` (cambiar-password, fallback 8).

**Retirados del seed (3)**: `system.maintenance_mode` (sin feature) · `reportes.worker.max_retries` (duplicado de `worker.max_reintentos`) · `reportes.worker.stalled_threshold_minutes` (sin detector de estancamiento). Las filas viejas en dev quedan inertes (no se borran).

**Pendiente de adjudicación (D-20)**: `docs/adjudicacion-095-casos-disputa.md` — 42 casos con texto, etiqueta actual, veredicto del motor (3/3) y **voto de cada modelo**, con "Etiqueta adjudicada" y "Razón" vacías para ZEUS+CEO+experto. Al llegar: `npx tsx scripts/eval-dual-banco.ts 200` da la comparación limpia (`resultados-dual-095.json`, ya verificado el arnés: 4/4 ambos motores en submuestra).

## Validación

- Tests: loader default (3/3), JWT TTL (3/3), suite completa **838/838**, lint 0 errores (1 warning heredado), tsc OK, build limpio, healthcheck OK tras dev-restart.
- Verificado en BD: `CasoEval` = 110 (v1) + 200 (v2); `ia.rubrica.enabled=false`.
- Hoja de adjudicación: 42/42 casos con votos reales por modelo.

## Commit

- `feat(seguridad): default legacy, JWT y parámetros cableados, banco gobernado y arnés de adjudicación (spec 095)`
