# Tasks: SPEC-182 — Reconciliación de reportes huérfanos (I-60)

**Input**: `specs/182-reconciliacion-huerfanos/{spec,plan}.md`
**Compuerta §4**: PENDIENTE de ZEUS.

- [ ] **T001** Sembrar parámetros `operadores.reconciliacion_intervalo_min` (default 15) y `operadores.reconciliacion_enabled` (default true) en seed/migración aditiva.
- [ ] **T002** Crear `src/lib/operadores/reconciliacion-huerfanos.ts` con `reconciliarHuerfanos()`: busca huérfanos, llama `asignarOperadorAReporte`, maneja resultados/excepciones, registra `AuditLog` agregado.
- [ ] **T003** Enganchar job en `scripts/worker-reportes.mjs`: `ensureQueue("operadores-reconciliacion-huerfanos")`, `boss.schedule("*/15 * * * *", tz="America/Bogota")`, `boss.work` que importa T002.
- [ ] **T004** Crear `scripts/reasignar-huerfanos-legacy.mjs` one-shot que reutilice T002.
- [ ] **T005** Test de integración `src/lib/operadores/reconciliacion-huerfanos.test.ts`: huérfano → asignado; huérfano con operadores al cupo → no asignado + razón.
- [ ] **T006** Gate local completo verde + commit + PR a `feature/001-scaffolding`.
- [ ] **T007** `specs/README.md` fila 182 (las DOS tablas) + `cierre.md` al cerrar.
