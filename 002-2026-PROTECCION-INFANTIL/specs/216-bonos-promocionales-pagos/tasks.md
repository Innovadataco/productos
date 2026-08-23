# Tasks — SPEC-216 (002-PI-116)

> Planificado. No se ejecutan hasta aprobación de ZEUS.

## Fase 1 — Especificación y diseño

- [x] T001 [P1] Redactar `spec.md` con US/AS/FR/NFR/SC y deuda.
- [x] T002 [P1] Redactar `plan.md` con fases, estructura y cambios de código.
- [x] T003 [P1] Crear artefactos auxiliares: `data-model.md`, `research.md`, `quickstart.md`, `contracts/216-bonos-promocionales.md`, `checklists/requirements.md`.
- [x] T004 [P1] Commit "docs(SPEC-216/002-PI-116): bonos promocionales".

## Fase 2 — Servicio de aplicación de bonos

- [ ] T005 [P1] Crear `src/lib/pagos/pagos-calculos.service.ts` con cálculo de descuentos y combinabilidad.
- [ ] T006 [P1] Crear `src/lib/pagos/bono-aplicacion.service.ts` con validaciones y lógica de negocio.
- [ ] T007 [P1] Extender `PagosRepository` con métodos de bonos y aplicaciones.
- [ ] T008 [P1] Tests unitarios de `bono-aplicacion.service.ts` y `pagos-calculos.service.ts`.

## Fase 3 — Endpoint API

- [ ] T009 [P1] Crear `src/app/api/pagos/aplicar-bono/route.ts` con Zod + auth.
- [ ] T010 [P1] Crear `src/app/api/pagos/aplicar-bono/route.test.ts` con escenarios de éxito y rechazo.
- [ ] T011 [P1] Integrar emisión de evento `bono.aplicado` al motor notif (o stub documentado).

## Fase 4 — Gate y cierre

- [ ] T012 [P1] Gate local completo: `tsc --noEmit`, `lint --no-cache`, `arch:check`, `test`, `build`.
- [ ] T013 [P1] Actualizar `specs/README.md` estado SPEC-216 a IMPLEMENTADO (post-aprobacional).
- [ ] T014 [P1] Redactar `cierre.md` con evidencia y deuda técnica.

## Dependencias y orden

- T005 → T006 → T008.
- T007 → T006.
- T006 → T009 → T010 → T012.
