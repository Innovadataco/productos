# Tasks — SPEC-213 (002-PI-113)

> Planificado. No se ejecutan hasta aprobación de ZEUS.

## Fase 1 — Especificación y diseño

- [x] T001 [P1] Redactar `spec.md` con US/AS/FR/NFR/SC y deuda.
- [x] T002 [P1] Redactar `plan.md` con fases, estructura y cambios de código.
- [x] T003 [P1] Crear artefactos auxiliares.
- [x] T004 [P1] Commit "docs(SPEC-213/002-PI-113): motor vigencia y estados".

## Fase 2 — Servicio de vigencia

- [ ] T005 [P1] Crear `src/lib/pagos/vigencia.service.ts` con lógica de transiciones y programación de eventos.
- [ ] T006 [P1] Extender `PagosRepository` con métodos de consulta de candidatas y transición.
- [ ] T007 [P1] Tests unitarios/integración de `vigencia.service.ts`.

## Fase 3 — Worker

- [ ] T008 [P1] Crear `scripts/worker-vigencia-pagos.mjs` con advisory lock y scheduling.
- [ ] T009 [P1] Agregar servicio `pi-vigencia` a `docker-compose.yml` y `docker-compose.prod.yml`.
- [ ] T010 [P1] Tests del worker: transiciones, idempotencia, lock.

## Fase 4 — Seed y parámetros

- [ ] T011 [P1] Sembrar `pagos.vigencia.hora_corrida` en seed de pagos.
- [ ] T012 [P1] Verificar catálogo de eventos del motor notif; documentar faltantes.

## Fase 5 — Gate y cierre

- [ ] T013 [P1] Gate local completo.
- [ ] T014 [P1] Actualizar `specs/README.md` estado a IMPLEMENTADO (post-aprobacional).
- [ ] T015 [P1] Redactar `cierre.md`.

## Dependencias y orden

- T005 → T007.
- T006 → T005.
- T008 → T005/T009.
- T010 → T008.
- T011 → T012 → T013.
