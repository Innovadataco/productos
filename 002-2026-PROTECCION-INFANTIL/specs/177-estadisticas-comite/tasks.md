# Tasks: SPEC-177 — Estadísticas del comité más útiles

**Input**: `specs/177-estadisticas-comite/{spec,plan}.md` · **Modo**: autónomo (cola 002-PI-074).

- [ ] **T001** `comite-convivencia-solicitudes.ts`: métodos `tendenciaSemanal`, `cumplimientoSla`, `tiempoMedioPorCategoria` (tenant-first, agregados JS sobre select mínimo).
- [ ] **T002** `comite-convivencia-bandeja.ts` + `src/lib/dal/types/comite-convivencia.ts`: DTO extendido (tendenciaSemanal, sla, tiempoMedioPorCategoria, pct en porEstado).
- [ ] **T003** Tests integration del endpoint (tendencia, SLA 3 vías, tiempo medio por categoría, % por estado, aislamiento 2 colegios, assert sin PII).
- [ ] **T004** `ComiteEstadisticas.tsx`: 4 bloques nuevos con tokens + tooltips criollos.
- [ ] **T005** arch:check + gate completo + commit + PR.
- [ ] **T006** `cierre.md` + fila en `specs/README.md` (2 tablas).
