# Tasks — Spec 095: Default seguro, JWT parametrizado y banco gobernado

- [x] T001 US1: `ia.rubrica.enabled=false` en seed + fallback loader a legacy + flip en BD dev + tests (3/3).
- [x] T002 US2: JWT TTL desde `security.jwt_ttl_hours` (fallback 24h) + tests (3/3).
- [x] T003 US2: `security.password_min_length` CABLEADO en cambiar-password; `system.maintenance_mode`, `reportes.worker.max_retries`, `reportes.worker.stalled_threshold_minutes` RETIRADOS del seed.
- [x] T004 US3a: `seedBancoGobernado()` (200 casos → CasoEval v2, 110 subordinado) + `exportar-banco-simulacion.ts`.
- [x] T005 US3b: hoja de adjudicación de los 42 casos con votos por modelo (`docs/adjudicacion-095-casos-disputa.md`).
- [x] T006 US3c: runner dual legacy+rúbrica (`eval-dual-banco.ts`, verificado 4/4 en submuestra).
- [x] T007 Gates por US + dev-restart + cierre + commit/push (staging explícito 002).
