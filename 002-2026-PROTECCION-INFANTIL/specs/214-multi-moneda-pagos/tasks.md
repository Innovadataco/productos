# Tasks · SPEC-214 · Multi-moneda + API tasas

## Fase 1 — Especificación (no code)

- [done] T001 · Redactar `spec.md` con alcance, US, AS, FR/NFR, SC, assumptions.
- [done] T002 · Redactar `data-model.md` confirmando reutilización de `TasaCambio`.
- [done] T003 · Redactar `research.md` con análisis de API y workers.
- [ ] T004 · Redactar `contracts/` con endpoints de tasas.
- [ ] T005 · Redactar `tasks.md` con dependencias (este archivo).
- [ ] T006 · Redactar `checklists/requirements.md` y `quickstart.md`.
- [ ] T007 · Commit docs: `docs(SPEC-214/002-PI-114): multi-moneda y API tasas`.

## Fase 2 — Implementación

- [ ] T101 · Extender `pagos-repository.ts` con métodos de `TasaCambio` (listar vigentes, desactualización).
- [ ] T102 · Crear servicio `src/lib/pagos/tasas.ts` con consulta a API externa (timeout 5s, 1 reintento, parseo).
- [ ] T103 · Agregar/actualizar parámetro `pagos.tasas.monedas_destino` en seed.
- [ ] T104 · Crear script/worker `scripts/worker-tasas.mjs` para refresco programado.
- [ ] T105 · Crear endpoint `POST /api/admin/pagos/tasas` para inyección manual + `AuditLog`.
- [ ] T106 · Crear endpoint `GET /api/admin/pagos/tasas` para listar tasas vigentes con flag desactualización.
- [ ] T107 · Exponer función pública `calcularMontoLocal(precioNetoUSD, monedaDestino)`.
- [ ] T108 · Tests unitarios e integración (fetch mockeado, worker, endpoint manual).
- [ ] T109 · Gate local exhaustivo.
- [ ] T110 · Commit feat: `feat(SPEC-214/002-PI-114): multi-moneda y API tasas`.

## Fase 3 — Integración y cierre

- [ ] T201 · Rebasear sobre `origin/feature/001-scaffolding` si hay cambios.
- [ ] T202 · Push único junto con SPEC-212.
- [ ] T203 · Verificar CI 6/6 verde.
- [ ] T204 · Documentar cierre y deuda técnica.
