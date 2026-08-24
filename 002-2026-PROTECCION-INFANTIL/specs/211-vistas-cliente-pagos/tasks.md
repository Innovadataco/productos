# Tasks — SPEC-211 (002-PI-111)

> Planificado. No se ejecutan hasta aprobación de ZEUS.

## Fase 1 — Especificación y diseño

- [x] T001 [P1] Redactar artefactos.
- [x] T002 [P1] Commit "docs(SPEC-211/002-PI-111): vistas cliente suscripción".

## Fase 2 — Verificación de dependencias UI

- [x] T003 [P1] Confirmar existencia de `ColegioSideNav` y layout `/dashboard/colegio/*`.
- [x] T004 [P1] Confirmar existencia de layout `/dashboard/padre/*` (SPEC-231) o documentar riesgo.

## Fase 3 — Backend

- [x] T005 [P1] Crear `GET /api/pagos/suscripcion`.
- [x] T006 [P1] Crear `POST /api/pagos/renovacion`.
- [x] T007 [P1] Crear `POST /api/pagos/suscripcion/cancelar`.
- [x] T008 [P1] Servicio de storage de comprobantes + SHA256.
- [x] T009 [P1] Tests de integración de endpoints (escritos; los corre el coordinador contra la BD compartida).

## Fase 4 — Frontend

- [x] T010 [P1] Crear componentes de los 7 bloques.
- [x] T011 [P1] Crear formulario de renovación con upload.
- [x] T012 [P1] Crear páginas rector y padre.
- [x] T013 [P1] Responsive y contraste AA.

## Fase 5 — Gate y cierre

- [x] T014 [P1] Gate local (alcance subagente): `tsc --noEmit` VERDE, ESLint 0 errores, `tokens:check` VERDE, 47 tests unitarios VERDES. Pendiente para el coordinador: `npm run build`, tests de integración y `dev-restart.sh`.
- [ ] T015 [P1] Actualizar `specs/README.md` estado a IMPLEMENTADO. *(lo hace el coordinador del mega-lote)*
- [ ] T016 [P1] Redactar `cierre.md`. *(lo hace el coordinador del mega-lote)*

## Dependencias y orden

- T003/T004 → T012.
- T005/T006/T007 → T009.
- T010/T011 → T012.
