# Tasks: Dividir archivos grandes

**Input**: Design documents from `/specs/052-dividir-archivos-grandes/`

**Prerequisites**: spec.md, plan.md, research.md, data-model.md, quickstart.md

**Tests**: Tests existentes (`npm run test`) más validación manual por `quickstart.md`.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar estructura de carpetas y validar estado base.

- [ ] T001 Crear carpetas: `src/components/modules/ia/eval/`, `src/components/modules/reporte-detalle/`, `src/app/api/reportes/procesar/helpers/`
- [ ] T002 Ejecutar tests base y confirmar que todos pasan antes de cualquier cambio
- [ ] T003 Ejecutar `npx tsc --noEmit` y `npm run lint` como línea base

**Checkpoint**: Estado base verde — tests, tsc y lint pasan.

---

## Phase 2: User Story 1 — Dividir `IaEvalManager.tsx` (Priority: P1) 🎯

**Goal**: Reducir `IaEvalManager.tsx` a menos de 400 líneas extrayendo tabs y sub-componentes en `src/components/modules/ia/eval/`.

**Independent Test**: Navegar por los tabs, crear experimento, ver detalle y comparador. `npm run test` pasa.

### Tests for User Story 1

- [ ] T004 [P] [US1] Ejecutar suite completa `npm run test` tras extracción
- [ ] T005 [US1] Verificar manualmente tabs y flujo de nuevo experimento

### Implementation for User Story 1

- [ ] T006 [P] [US1] Extraer tipos compartidos (`Caso`, `Experimento`, `ExperimentoDetalle`, `RunMetrics`, `PerCategoryMetrics`, `OperationalMetrics`, `OllamaModel`, `CompareResult`) a `src/components/modules/ia/eval/types.ts`
- [ ] T007 [P] [US1] Extraer helpers de formato (`formatPct`, `formatMs`, `formatDuration`, `classForDelta`) a `src/components/modules/ia/eval/format.ts`
- [ ] T008 [P] [US1] Extraer `ExperimentCard` a `src/components/modules/ia/eval/ExperimentCard.tsx`
- [ ] T009 [P] [US1] Extraer `NuevoExperimentoForm` a `src/components/modules/ia/eval/NuevoExperimentoForm.tsx`
- [ ] T010 [P] [US1] Extraer `ExperimentoDashboard` a `src/components/modules/ia/eval/ExperimentoDashboard.tsx`
- [ ] T011 [P] [US1] Extraer `MetricCard` a `src/components/modules/ia/eval/MetricCard.tsx`
- [ ] T012 [P] [US1] Extraer `ComparadorExperimentos` a `src/components/modules/ia/eval/ComparadorExperimentos.tsx`
- [ ] T013 [P] [US1] Extraer `LaboratorioTab`, `CasosTab`, `HistorialTab` a archivos propios
- [ ] T014 [US1] Simplificar `IaEvalManager.tsx` para que solo orqueste tabs y delegue en los sub-componentes
- [ ] T015 [US1] Commit: `SPEC-052 US1: dividir IaEvalManager.tsx en sub-componentes`

**Checkpoint**: `IaEvalManager.tsx` < 400 líneas, tests verdes, commit realizado.

---

## Phase 3: User Story 2 — Dividir `AdminReporteDetalle.tsx` (Priority: P1) 🎯

**Goal**: Reducir `AdminReporteDetalle.tsx` a menos de 400 líneas extrayendo secciones de UI y el hook de estado en `src/components/modules/reporte-detalle/`.

**Independent Test**: Abrir detalle de reporte y ejecutar todas las acciones. `npm run test` pasa.

### Tests for User Story 2

- [ ] T016 [P] [US2] Ejecutar suite completa `npm run test` tras extracción
- [ ] T017 [US2] Verificar manualmente acciones del detalle de reporte

### Implementation for User Story 2

- [ ] T018 [P] [US2] Extraer tipos `DetalleReporte` y helpers `formatCategoria`, `formatEstado` a `src/components/modules/reporte-detalle/types.ts`
- [ ] T019 [P] [US2] Extraer hook `useReporteDetalle` (carga + acciones) a `src/components/modules/reporte-detalle/useReporteDetalle.ts`
- [ ] T020 [P] [US2] Extraer `ReporteDetalleHeader` (título + cerrar) a `src/components/modules/reporte-detalle/ReporteDetalleHeader.tsx`
- [ ] T021 [P] [US2] Extraer `ReporteInfoGrid` (datos básicos) a `src/components/modules/reporte-detalle/ReporteInfoGrid.tsx`
- [ ] T022 [P] [US2] Extraer `ClasificacionPanel` (datos de IA) a `src/components/modules/reporte-detalle/ClasificacionPanel.tsx`
- [ ] T023 [P] [US2] Extraer `ReporteAccionesPanel` (todos los formularios de acción) a `src/components/modules/reporte-detalle/ReporteAccionesPanel.tsx`
- [ ] T024 [US2] Simplificar `AdminReporteDetalle.tsx` para que solo ensamble los sub-componentes
- [ ] T025 [US2] Commit: `SPEC-052 US2: dividir AdminReporteDetalle.tsx en sub-componentes`

**Checkpoint**: `AdminReporteDetalle.tsx` < 400 líneas, tests verdes, commit realizado.

---

## Phase 4: User Story 3 — Dividir `procesar/route.ts` (Priority: P1) 🎯

**Goal**: Reducir `procesar/route.ts` a menos de 400 líneas extrayendo helpers en `src/app/api/reportes/procesar/helpers/`.

**Independent Test**: `npm run test -- src/app/api/reportes/procesar/route.test.ts` pasa.

### Tests for User Story 3

- [ ] T026 [P] [US3] Ejecutar `npm run test -- src/app/api/reportes/procesar/route.test.ts` tras cada extracción
- [ ] T027 [US3] Ejecutar suite completa `npm run test` al finalizar

### Implementation for User Story 3

- [ ] T028 [P] [US3] Extraer `esErrorTransitorio` y `ESTADOS_FINALES` a `src/app/api/reportes/procesar/helpers/errors.ts`
- [ ] T029 [P] [US3] Extraer validación de request (`validarWorkerSecret`, `validarReporte`, `obtenerReporte`) a `src/app/api/reportes/procesar/helpers/validar-request.ts`
- [ ] T030 [P] [US3] Extraer embedding (`guardarEmbedding`) a `src/app/api/reportes/procesar/helpers/embedding.ts`
- [ ] T031 [P] [US3] Extraer deduplicación (`detectarDuplicado`) a `src/app/api/reportes/procesar/helpers/deduplicacion.ts`
- [ ] T032 [P] [US3] Extraer carga de parámetros de clasificación a `src/app/api/reportes/procesar/helpers/parametros-clasificacion.ts`
- [ ] T033 [P] [US3] Extraer lógica de ráfagas (`detectarRafaga`) a `src/app/api/reportes/procesar/helpers/rafagas.ts`
- [ ] T034 [P] [US3] Extraer clasificación + PII (`clasificarReporte`) a `src/app/api/reportes/procesar/helpers/clasificar-reporte.ts`
- [ ] T035 [P] [US3] Extraer anonimización (`anonimizarReporte`) a `src/app/api/reportes/procesar/helpers/anonimizar-reporte.ts`
- [ ] T036 [P] [US3] Extraer guardas de seguridad (`aplicarGuardasSeguridad`) a `src/app/api/reportes/procesar/helpers/guardas-seguridad.ts`
- [ ] T037 [P] [US3] Extraer transición final y alertas a `src/app/api/reportes/procesar/helpers/finalizar.ts`
- [ ] T038 [US3] Simplificar `route.ts` para que solo valide, ejecute helpers y responda
- [ ] T039 [US3] Commit: `SPEC-052 US3: dividir procesar/route.ts en helpers`

**Checkpoint**: `procesar/route.ts` < 400 líneas, tests verdes, commit realizado.

---

## Phase 5: User Story 4 — Dividir los demás archivos > 400 líneas (Priority: P2)

**Goal**: Reducir deuda técnica restante si el tiempo y los tests lo permiten.

**Independent Test**: `npm run test`, `npm run lint`, `npx tsc --noEmit` pasan tras cada archivo.

### Implementation for User Story 4

- [ ] T040 [P] [US4] Evaluar `src/lib/circulo-confianza.ts` y extraer helpers si es seguro
- [ ] T041 [P] [US4] Evaluar `src/app/dashboard/admin/comite/gestion/GestionPageClient.tsx` y extraer sub-componentes
- [ ] T042 [P] [US4] Evaluar `src/app/dashboard/circulo-confianza/page.tsx` y extraer sub-componentes
- [ ] T043 [P] [US4] Evaluar `src/app/dashboard/admin/operadores/gestion/page.tsx` y extraer sub-componentes
- [ ] T044 [P] [US4] Evaluar `src/components/modules/ConfigPanel.tsx` y extraer sub-componentes
- [ ] T045 [P] [US4] Evaluar `src/lib/ai/eval-runner.ts` y extraer helpers
- [ ] T046 [P] [US4] Evaluar `src/components/modules/AuditLogViewer.tsx` y extraer sub-componentes
- [ ] T047 [P] [US4] Evaluar `src/lib/ai/classifier.ts` y extraer helpers
- [ ] T048 [US4] Commit: `SPEC-052 US4: dividir archivos grandes restantes`

**Checkpoint**: Todos los archivos P2 abordados o documentados como deuda técnica si no se alcanzaron.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validación final y documentación.

- [ ] T049 [P] Ejecutar `npx tsc --noEmit`
- [ ] T050 [P] Ejecutar `npm run lint`
- [ ] T051 [P] Ejecutar `npm run test`
- [ ] T052 [P] Ejecutar `npm run build`
- [ ] T053 [P] Ejecutar `./scripts/dev-restart.sh` y verificar healthcheck
- [ ] T054 [P] Ejecutar escenarios de `quickstart.md`
- [ ] T055 [P] Commit de documentación: `SPEC-052 docs: artefactos Spec-Kit, cierre y sección Implementación`
- [ ] T056 Push de todos los commits a `feature/001-scaffolding`
- [ ] T057 Escribir `cierre.md` con evidencia: git log, archivos tocados, resultados de pruebas/deploy
- [ ] T058 Actualizar sección `Implementación` en `spec.md` y marcar Status `CERRADA`

**Checkpoint**: Spec cerrado, código en rama, deploy limpio, pruebas verdes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencias — debe estar verde antes de tocar código.
- **Phase 2 (US1)**: Depende de Phase 1. No modifica data layer.
- **Phase 3 (US2)**: Depende de Phase 2. Puede ejecutarse en secuencia porque no comparten archivos.
- **Phase 4 (US3)**: Depende de Phase 3. No comparte archivos con US1/US2.
- **Phase 5 (US4)**: Depende de Phase 4. Opcional según tiempo y pruebas.
- **Phase 6 (Polish)**: Depende de todas las fases anteriores.

### Within Each User Story

1. Extraer tipos y helpers compartidos primero.
2. Extraer sub-componentes que no dependen de otros.
3. Extraer sub-componentes que dependen de los anteriores.
4. Simplificar archivo padre.
5. Validar y commitear.

### Parallel Opportunities

- T006-T007, T008-T012 y T013 pueden trabajarse en paralelo si los tipos y helpers están primero.
- T018-T024 de US2 pueden planificarse en paralelo, pero la ejecución debe ser secuencial para facilitar rollback.
- T028-T037 de US3 deben ser secuenciales para no romper el handler.

---

## Notes

- No se modifica el schema de Prisma ni se ejecutan migraciones.
- Si un test falla tras un refactor, se revierte el cambio y se continúa con otro archivo.
- El orden de commits es: un commit por User Story + uno de documentación.
- `src/app/api/reportes/procesar/helpers/` debe contener solo funciones puras o transacciones autocontenidas; no dependencias circulares con `route.ts`.
