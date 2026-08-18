# Tasks: SPEC-172 — Pilar D.5 · Deriva del motor en producción

**Input**: `specs/172-deriva-motor-prod/{spec,plan}.md`
**Compuerta §4**: PENDIENTE de ZEUS. Borrador derivado del plan; se ajusta con el veredicto (snapshot tabla vs JSON, definición de brecha, navegación, email "siempre").

## Phase 1: Baseline verificado + parámetros

- [ ] **T001** Verificar formato real de `SimulacionRun.metricasJson` en una corrida COMPLETADA (BD de test o fixture) → parser defensivo + test.
- [ ] **T002** `prisma/seed.ts`: 6 parámetros `motor.deriva.*` (upsert idempotente, labels criollo).
- [ ] **T003** Según decisión de compuerta: (A) migración aditiva `DerivaMotorSnapshot` (semanaInicio, categoria, total, correcciones, tasaCorreccion, accuracyBanco, brechaPp, alertada; índice (semanaInicio, categoria)) + `AccionAudit` += `MOTOR_DERIVA_RECALCULO`; o (B) snapshot JSON en ParametroSistema.

## Phase 2: Servicio de deriva

- [ ] **T004** `src/lib/motor/deriva.ts` (NUEVO): `calcularDerivaSemanal(desde, hasta)` por categoría (groupBy ClasificacionIA + CorreccionAdmin confirmadas) + brecha vs baseline + `muestraInsuficiente` + persistencia del snapshot (upsert por semana+categoría).
- [ ] **T005** Tests integration: correcciones confirmadas vs no confirmadas, min_muestra excluye, sin baseline → null + aviso, brecha correcta.
- [ ] **T006** `src/lib/email.ts`: `enviarAlertaDerivaMotor()` (tabla por categoría desviada + enlace Simulación; gate `motor.deriva.enabled`; sin textos ni personas).

## Phase 3: Cron + endpoints

- [ ] **T007** `scripts/worker-reportes.mjs`: `ensureQueue("motor-deriva-semanal")` + `boss.schedule("0 7 * * 1", tz America/Bogota)` + handler (semana anterior completa; email si hay categorías sobre umbral o si `email.siempre`).
- [ ] **T008** `GET /api/admin/motor/deriva` (último snapshot + metadatos baseline) + test.
- [ ] **T009** `POST /api/admin/motor/deriva/recalcular` (auditado) + test.

## Phase 4: UI + ConfigPanel + cierre

- [ ] **T010** `src/app/dashboard/admin/estadisticas/motor/page.tsx` + `DerivaProdBloque.tsx` (tabla por categoría con semáforo, banner baseline, CTA Simulación, botón Recalcular) + test unit.
- [ ] **T011** `config-panel/types.ts`: sección "Motor › Deriva" (prefix `motor.deriva.`).
- [ ] **T012** Regenerar `docs/architecture/` si hay rutas/modelo nuevos → arch:check verde.
- [ ] **T013** Gate local completo + `cierre.md` (evidencia: deriva calculada con datos sembrados + email de prueba) + sección Implementación en spec.md.
