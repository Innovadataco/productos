# Tasks — SPEC-211 (002-PI-111)

> Planificado. No se ejecutan hasta aprobación de ZEUS.

## Fase 1 — Especificación y diseño

- [x] T001 [P1] Redactar artefactos.
- [x] T002 [P1] Commit "docs(SPEC-211/002-PI-111): vistas cliente suscripción".

## Fase 2 — Verificación de dependencias UI

- [ ] T003 [P1] Confirmar existencia de `ColegioSideNav` y layout `/dashboard/colegio/*`.
- [ ] T004 [P1] Confirmar existencia de layout `/dashboard/padre/*` (SPEC-231) o documentar riesgo.

## Fase 3 — Backend

- [ ] T005 [P1] Crear `GET /api/pagos/suscripcion`.
- [ ] T006 [P1] Crear `POST /api/pagos/renovacion`.
- [ ] T007 [P1] Crear `POST /api/pagos/suscripcion/cancelar`.
- [ ] T008 [P1] Servicio de storage de comprobantes + SHA256.
- [ ] T009 [P1] Tests de integración de endpoints.

## Fase 4 — Frontend

- [ ] T010 [P1] Crear componentes de los 7 bloques.
- [ ] T011 [P1] Crear formulario de renovación con upload.
- [ ] T012 [P1] Crear páginas rector y padre.
- [ ] T013 [P1] Responsive y contraste AA.

## Fase 5 — Gate y cierre

- [ ] T014 [P1] Gate local completo.
- [ ] T015 [P1] Actualizar `specs/README.md` estado a IMPLEMENTADO.
- [ ] T016 [P1] Redactar `cierre.md`.

## Dependencias y orden

- T003/T004 → T012.
- T005/T006/T007 → T009.
- T010/T011 → T012.
