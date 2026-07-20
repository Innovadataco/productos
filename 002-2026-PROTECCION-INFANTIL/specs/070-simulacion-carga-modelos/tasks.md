# Tasks: Simulación de carga y comparación de modelos (Spec 070)

## Phase 1 — Preparación: migración y validación de casos

| ID | Tarea | Archivo(s) | Dependencias |
|---|---|---|---|
| T001 | Crear migración aditiva con `SimulacionRun` y `SimulacionReporte` y actualizar `Usuario`. | `prisma/migrations/YYYYMMDDHHMMSS_add_simulacion_tables/migration.sql`, `prisma/schema.prisma` | — |
| T002 | Definir schema Zod para caso de simulación (`texto`, `plataforma`, `identificador`, `categoriaEsperada` opcional). | `src/lib/schemas/simulacion.ts` | — |
| T003 | Implementar parser y validador de CSV/JSON con errores por línea/índice. | `src/lib/simulacion/parser.ts`, `src/lib/simulacion/parser.test.ts` | T002 |
| T004 | Implementar endpoint `POST /api/admin/ia/simulaciones` (carga de archivo + validación + creación de run). | `src/app/api/admin/ia/simulaciones/route.ts`, `route.test.ts` | T001, T003 |
| T005 | Implementar endpoint `GET /api/admin/ia/simulaciones`. | `src/app/api/admin/ia/simulaciones/route.ts` (GET), `route.test.ts` | T001 |

## Phase 2 — Ejecución y monitoreo en vivo

| ID | Tarea | Archivo(s) | Dependencias |
|---|---|---|---|
| T006 | Diseñar e implementar batch creator de reportes anónimos (override de modelo, prefijo SIM-). | `src/lib/simulacion/executor.ts`, `src/lib/simulacion/executor.test.ts` | T004 |
| T007 | Implementar lógica de un solo run en progreso (rechazo de segunda corrida). | `src/lib/simulacion/executor.ts` | T006 |
| T008 | Implementar endpoint `POST /api/admin/ia/simulaciones/[id]/cancelar`. | `src/app/api/admin/ia/simulaciones/[id]/cancelar/route.ts`, `route.test.ts` | T006 |
| T009 | Implementar endpoint `GET /api/admin/ia/simulaciones/[id]` con polling. | `src/app/api/admin/ia/simulaciones/[id]/route.ts`, `route.test.ts` | T001, T006 |
| T010 | Crear servicio de actualización de progreso. | `src/lib/simulacion/progreso.ts`, `progreso.test.ts` | T001, T006 |

## Phase 3 — Resultados y análisis agregado

| ID | Tarea | Archivo(s) | Dependencias |
|---|---|---|---|
| T011 | Implementar endpoint `GET /api/admin/ia/simulaciones/[id]/resultados` (paginado). | `src/app/api/admin/ia/simulaciones/[id]/resultados/route.ts`, `route.test.ts` | T001, T006 |
| T012 | Implementar endpoint `GET /api/admin/ia/simulaciones/[id]/analisis` (métricas agregadas). | `src/app/api/admin/ia/simulaciones/[id]/analisis/route.ts`, `route.test.ts` | T011 |
| T013 | Crear calculador de métricas: aciertos, precisión/recall, matriz de confusión, falsos negativos, latencia p50/p95. | `src/lib/simulacion/metricas.ts`, `metricas.test.ts` | T011 |

## Phase 4 — Comparación y exportación

| ID | Tarea | Archivo(s) | Dependencias |
|---|---|---|---|
| T014 | Implementar endpoint `POST /api/admin/ia/simulaciones/comparar`. | `src/app/api/admin/ia/simulaciones/comparar/route.ts`, `route.test.ts` | T013 |
| T015 | Implementar endpoint `GET /api/admin/ia/simulaciones/[id]/export?formato=csv|json`. | `src/app/api/admin/ia/simulaciones/[id]/export/route.ts`, `route.test.ts` | T011, T012 |

## Phase 5 — UI

| ID | Tarea | Archivo(s) | Dependencias |
|---|---|---|---|
| T016 | Agregar pestaña "Simulación" en `IaEvalManager`. | `src/components/modules/ia/IaEvalManager.tsx` | — |
| T017 | Crear `SimulacionTab` (router list/new/detail/compare) replicando `LaboratorioTab`. | `src/components/modules/ia/simulacion/SimulacionTab.tsx` | T016 |
| T018 | Crear `SimulacionCard` (listado) reutilizando patrón de `ExperimentCard`. | `src/components/modules/ia/simulacion/SimulacionCard.tsx` | T017 |
| T019 | Crear `NuevaSimulacionForm` (carga de archivo + selector de modelo + notas). | `src/components/modules/ia/simulacion/NuevaSimulacionForm.tsx` | T003, T004 |
| T020 | Crear `SimulacionDashboard` (detalle con progreso, polling, cancelar, resultados, análisis). | `src/components/modules/ia/simulacion/SimulacionDashboard.tsx` | T009, T011, T012 |
| T021 | Crear `ComparadorSimulaciones` (comparación lado a lado) reutilizando `ComparadorExperimentos`. | `src/components/modules/ia/simulacion/ComparadorSimulaciones.tsx` | T014, T020 |
| T022 | Crear `MetricasSimulacion` (p50/p95, aciertos, matriz, falsos negativos). | `src/components/modules/ia/simulacion/MetricasSimulacion.tsx` | T012, T020 |
| T023 | Crear `TablaResultadosSimulacion` (resultados por caso con exportación). | `src/components/modules/ia/simulacion/TablaResultadosSimulacion.tsx` | T011, T015 |

## Phase 6 — Validación y cierre

| ID | Tarea | Archivo(s) | Dependencias |
|---|---|---|---|
| T024 | Ejecutar `quickstart.md` de punta a punta. | — | T023 |
| T025 | Ejecutar `tsc`, `lint`, `test`, `build`, `dev-restart.sh`. | — | T024 |
| T026 | Actualizar `spec.md` sección Implementación, crear `cierre.md`, Status `CERRADA`. | `specs/070-simulacion-carga-modelos/spec.md`, `cierre.md` | T025 |
| T027 | Commit por User Story + uno de docs; push a `feature/001-scaffolding`. | — | T026 |

## Tareas plan-only / post-cierre

- En la implementación se debe validar si se requiere ajustar `docs/PRE-PRODUCCION.md` (no se espera; el spec 070 no es pre-producción, es funcionalidad de desarrollo).
- Dejar abierto a futuro: comparación de N corridas, SSE/WebSocket para progreso, paginación de exportación masiva.

