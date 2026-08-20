# Tareas: SPEC-189 — Vista de operador con métricas

## Fase 1: DTOs y servicio

- [ ] T001 [P1] `src/lib/dal/types/operador.ts`: añadir `MetricasOperadorDto` y `CasoOperadorListItemDto`.
- [ ] T002 [P1] `src/lib/dal/services/operador-metricas.ts`: implementar `obtenerMetricas` y `listarCasos`.
- [ ] T003 [P1] `src/lib/dal/services/operador-metricas.test.ts`: tests unitarios de métricas.

## Fase 2: API Routes

- [ ] T004 [P1] `src/app/api/admin/operadores/[id]/metricas/route.ts`: endpoint de métricas.
- [ ] T005 [P1] `src/app/api/admin/operadores/[id]/metricas/route.test.ts`: tests de integración.
- [ ] T006 [P1] `src/app/api/admin/operadores/[id]/casos/route.ts`: endpoint de casos paginados.
- [ ] T007 [P1] `src/app/api/admin/operadores/[id]/casos/route.test.ts`: tests de integración.

## Fase 3: Frontend

- [ ] T008 [P1] `src/app/dashboard/admin/operadores/[id]/page.tsx`: ficha de operador.
- [ ] T009 [P2] `src/app/dashboard/admin/operadores/[id]/page.test.tsx`: renderizado con mock.
- [ ] T010 [P2] `src/app/dashboard/admin/operadores/asignar/page.tsx`: añadir botón "Ver detalle".

## Fase 4: Cierre

- [ ] T011 [P1] Actualizar `specs/README.md` y `.specify/feature.json`.
- [ ] T012 [P1] Gate local completo: tsc, lint, arch:check, tests, build.
- [ ] T013 [P1] Push único a `work/002-pi-084` y crear PR.
