# Tasks — SPEC-215 (002-PI-115)

> Planificado. No se ejecutan hasta aprobación de ZEUS.

## Fase 1 — Especificación y diseño

- [x] T001 [P1] Redactar artefactos de especificación.
- [x] T002 [P1] Commit "docs(SPEC-215/002-PI-115): código de referido".

## Fase 2 — Generación de códigos

- [ ] T003 [P1] Crear `src/lib/utils/referido-codigo.ts` con generador único.
- [ ] T004 [P1] Integrar generación en servicio de creación de `Suscripcion`.
- [ ] T005 [P1] Tests de generación y unicidad.

## Fase 3 — Aplicación de códigos

- [ ] T006 [P1] Crear `src/lib/pagos/referido.service.ts` con validaciones.
- [ ] T007 [P1] Crear `POST /api/pagos/aplicar-referido/route.ts`.
- [ ] T008 [P1] Tests de integración del endpoint.

## Fase 4 — Recompensas

- [ ] T009 [P1] Implementar `otorgarRecompensa()` llamado desde handler de `pago.autorizado`.
- [ ] T010 [P1] Tests de recompensa, tope anual y notificación al 4º uso.

## Fase 5 — Gate y cierre

- [ ] T011 [P1] Gate local completo.
- [ ] T012 [P1] Actualizar `specs/README.md` estado a IMPLEMENTADO.
- [ ] T013 [P1] Redactar `cierre.md`.

## Dependencias y orden

- T003 → T004 → T005.
- T006 → T007 → T008.
- T009 depende de SPEC-213 (evento `pago.autorizado`).
