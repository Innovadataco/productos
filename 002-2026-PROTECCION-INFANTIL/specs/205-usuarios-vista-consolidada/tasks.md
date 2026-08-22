# Tasks — SPEC-205 (002-PI-102)

## Fase 1 — Especificación y diseño
- [x] T001 [P1] Redactar `spec.md` con US/AS/FR/NFR/SC.
- [x] T002 [P1] Redactar `plan.md` con fases, estructura y cambios de código.
- [x] T003 [P1] Crear artefactos auxiliares: `data-model.md`, `research.md`, `quickstart.md`, `contracts/endpoints.md`, `checklists/requirements.md`.
- [x] T004 [P1] Actualizar `specs/README.md` con SPEC-205 en estado PLANEADO.
- [ ] T005 [P1] Push de spec+plan a `work/002-pi-102` y señal a ZEUS.

## Fase 2 — Backend KPI y agregados
- [ ] T006 [P1] Crear DTOs `UsuariosConsolidadoDto` en `src/lib/dal/types/usuarios-consolidado.ts`.
- [ ] T007 [P1] Implementar `UsuarioDashboardService.resumenPorRol()` (agregado único por rol/estado).
- [ ] T008 [P2] Implementar `UsuarioDashboardService.alertasDashboard()` (sobrecarga, comité vacío, colegios sin rector).
- [ ] T009 [P1] Crear `GET /api/admin/usuarios/dashboard` + test de integración.

## Fase 3 — Backend listados por rol
- [ ] T010 [P1] Extender `GET /api/admin/usuarios` para devolver DTO por rol (Padres, Rectores, Operadores, Comité convivencia, Comité validación, Admins).
- [ ] T011 [P1] Para `rol=OPERADOR`, reutilizar `OperadorService.panelAsignacion()` y enriquecer con métricas 30d.
- [ ] T012 [P2] Implementar filtros `q`, `estado` en cada listado.
- [ ] T013 [P1] Tests de integración para listados por rol.
- [ ] T014 [P1] Test de coincidencia de conteos entre `/api/admin/usuarios?rol=OPERADOR` y `/api/admin/operadores/asignacion`.

## Fase 4 — Backend detalle consolidado
- [ ] T015 [P1] Implementar `UsuarioDashboardService.detallePorRol(id)` cruzando fuentes según rol.
- [ ] T016 [P1] Crear `GET /api/admin/usuarios/[id]` + test de integración.
- [ ] T017 [P2] Tests de detalle para al menos 3 roles representativos (OPERADOR, SCHOOL_ADMIN, COMITE_VALIDACION).

## Fase 5 — Frontend dashboard + sub-tabs
- [ ] T018 [P1] Actualizar `UsuariosSubNav.tsx` a 6 tabs y activo por `startsWith`.
- [ ] T019 [P1] Crear `UsuariosKpiCards.tsx` con 5 tarjetas y alertas visuales.
- [ ] T020 [P1] Refactorizar `UsuariosAdminClient.tsx` para cargar KPI, renderizar sub-tab activo y tabla por rol.
- [ ] T021 [P1] Crear 6 componentes de tabla por rol en `src/components/modules/admin/tables/`.
- [ ] T022 [P2] Añadir tests de componente para KPI y SubNav.

## Fase 6 — Frontend detalle por rol
- [ ] T023 [P1] Crear página `/dashboard/admin/usuarios/[id]/page.tsx` (Server Component).
- [ ] T024 [P1] Crear `UsuarioDetalleClient.tsx` + 6 componentes de render por rol.
- [ ] T025 [P1] Incluir acciones útiles en cada detalle: bloquear, reasignar, ver bandeja filtrada, editar cupo, ver ficha colegio.
- [ ] T026 [P2] Tests de componente para detalle de operador y rector.

## Fase 7 — Cierre
- [ ] T027 [P1] Gate local completo: `tsc --noEmit`, `lint --no-cache`, `arch:check`, `test`, `build`.
- [ ] T028 [P1] Actualizar `specs/README.md` estado SPEC-205 a IMPLEMENTADO.
- [ ] T029 [P1] Commit único + push a `origin/work/002-pi-102`.
- [ ] T030 [P1] Abrir PR a `feature/001-scaffolding` y esperar CI verde.
- [ ] T031 [P2] Redactar `cierre.md` con evidencia y deuda técnica.
