# Tasks: Corrección de fidelidad de la simulación (Spec 071)

**Input**: Design documents from `/specs/071-correccion-fidelidad-simulacion-070/`

**Prerequisites**: spec.md, plan.md, research.md, data-model.md, quickstart.md, contracts/simulacion.md

**Tests**: Vitest para parser y executor; tests de integración de endpoints del 070 deben seguir pasando.

**Organization**: Tasks grouped by user story. No user story work can begin until the shared schema change is complete.

---

## Phase 1: Setup (Shared Schema Change)

**Purpose**: Ampliar el schema de entrada de simulación para que coincida con el reporte anónimo real.

**⚠️ CRITICAL**: This phase blocks all user stories. No parser, executor or UI change can proceed until the schema is defined.

- [ ] T001 [P] Update `src/lib/schemas/simulacion.ts`: redefine `casoSimulacionSchema` as `crearReporteSchema.omit({ paisId: true, ciudadId: true, otraPlataforma: true }).extend({ categoriaEsperada: z.string().max(100).optional() })`
- [ ] T002 [P] Update `src/lib/schemas/simulacion.ts`: export `CasoSimulacion` type derived from the new schema
- [ ] T003 [P] Add constants to `src/lib/schemas/simulacion.ts` if needed (reuse existing limits from `crearReporteSchema` or keep `CASO_MAXIMO`)
- [ ] T004 [P] Verify `crearReporteSchema` in `src/lib/validators.ts` already covers `fechaIncidente`, `ciudad`, `pais`, `edadVictima`; document any discrepancy in research.md

**Checkpoint**: `tsc --noEmit` passes for the schema file; `CasoSimulacion` type includes all real fields.

---

## Phase 2: User Story 1 — Entrada idéntica a la de un reporte anónimo (Priority: P1) 🎯 MVP

**Goal**: El parser acepta y valida los campos reales de un reporte anónimo, reporta errores por línea, y rechaza archivos legacy.

**Independent Test**: Cargar un CSV/JSON con todos los campos reales → aceptado; cargar uno con fecha futura o ciudad vacía → error por línea.

### Tests for User Story 1

- [ ] T005 [P] [US1] Unit test: `src/lib/simulacion/parser.test.ts` — valid CSV with all fields passes
- [ ] T006 [P] [US1] Unit test: `src/lib/simulacion/parser.test.ts` — valid JSON with all fields passes
- [ ] T007 [P] [US1] Unit test: `src/lib/simulacion/parser.test.ts` — missing `fechaIncidente` rejects with line-level error
- [ ] T008 [P] [US1] Unit test: `src/lib/simulacion/parser.test.ts` — `fechaIncidente` in the future rejects with the same message as `crearReporteSchema`
- [ ] T009 [P] [US1] Unit test: `src/lib/simulacion/parser.test.ts` — empty `ciudad` or `pais` rejects with line-level error
- [ ] T010 [P] [US1] Unit test: `src/lib/simulacion/parser.test.ts` — `edadVictima` 0 accepted; 121 rejected; missing accepted
- [ ] T011 [P] [US1] Unit test: `src/lib/simulacion/parser.test.ts` — legacy CSV (only `texto,plataforma,identificador`) rejected with clear message listing missing fields
- [ ] T012 [P] [US1] Unit test: `src/lib/simulacion/parser.test.ts` — multiple errors in one file reported per line/index
- [ ] T013 [P] [US1] Unit test: `src/lib/simulacion/parser.test.ts` — `categoriaEsperada` optional and preserved in parsed result

### Implementation for User Story 1

- [ ] T014 [US1] Update `src/lib/simulacion/parser.ts`: parse `fechaIncidente`, `ciudad`, `pais`, `edadVictima` from CSV columns
- [ ] T015 [US1] Update `src/lib/simulacion/parser.ts`: parse `fechaIncidente`, `ciudad`, `pais`, `edadVictima` from JSON objects
- [ ] T016 [US1] Update `src/lib/simulacion/parser.ts`: validate each row/object with the new `casoSimulacionSchema`
- [ ] T017 [US1] Update `src/lib/simulacion/parser.ts`: reject legacy files with a clear error listing required fields `fechaIncidente`, `ciudad`, `pais`
- [ ] T018 [US1] Update `src/lib/simulacion/parser.ts`: ensure `edadVictima` is parsed as number when it comes from CSV string
- [ ] T019 [US1] Update `src/lib/simulacion/parser.ts`: preserve `categoriaEsperada` in parsed result but strip it from the payload sent to report creation
- [ ] T020 [US1] Update UI help text in `NuevaSimulacionForm` (or wherever the file example is shown) to display the new required columns

**Checkpoint**: User Story 1 functional — parser accepts real fields, rejects legacy, reports errors per line.

---

## Phase 3: User Story 2 — Pipeline real completo, sin atajos ni omisiones (Priority: P1)

**Goal**: El executor crea reportes con los campos reales del caso y continúa si un caso falla.

**Independent Test**: Lanzar una simulación y verificar en BD que los campos `fechaIncidente`, `ciudad`, `pais`, `edadVictima` coinciden con el archivo; forzar un fallo y verificar que la corrida continúa.

### Tests for User Story 2

- [ ] T021 [P] [US2] Unit test: `src/lib/simulacion/executor.test.ts` — `crearReporteSimulacion` creates a `Reporte` with the exact `fechaIncidente`, `ciudad`, `pais`, `edadVictima` from the case
- [ ] T022 [P] [US2] Unit test: `src/lib/simulacion/executor.test.ts` — `crearReporteSimulacion` does NOT pass `categoriaEsperada` to the `Reporte` creation
- [ ] T023 [P] [US2] Unit test: `src/lib/simulacion/executor.test.ts` — `crearReporteSimulacion` stores `categoriaEsperada` only in `SimulacionReporte`
- [ ] T024 [P] [US2] Unit test: `src/lib/simulacion/executor.test.ts` — `runSimulacionBatchCreator` continues when one case fails, and reports the failure count
- [ ] T025 [P] [US2] Unit test: `src/lib/simulacion/executor.test.ts` — `runSimulacionBatchCreator` does not mark the whole run as `FALLIDA` because of a single case failure
- [ ] T026 [P] [US2] Unit test: `src/lib/simulacion/executor.test.ts` — `runSimulacionBatchCreator` still calls `sendReporte` with `modeloClasificacion` override

### Implementation for User Story 2

- [ ] T027 [US2] Update `src/lib/simulacion/executor.ts`: in `crearReporteSimulacion`, use `caso.fechaIncidente`, `caso.ciudad`, `caso.pais`, `caso.edadVictima` instead of `new Date()`, `"Simulación"`, etc.
- [ ] T028 [US2] Update `src/lib/simulacion/executor.ts`: do not pass `categoriaEsperada` to `prisma.reporte.create`; only use it in `prisma.simulacionReporte.create`
- [ ] T029 [US2] Update `src/lib/simulacion/executor.ts`: convert `fechaIncidente` string to `Date` when creating the report
- [ ] T030 [US2] Update `src/lib/simulacion/executor.ts`: in `runSimulacionBatchCreator`, catch errors per case, log them, and continue with the rest
- [ ] T031 [US2] Update `src/lib/simulacion/executor.ts`: track failed cases (in memory or via `SimulacionReporte` metadata) without modifying the run state to `FALLIDA`
- [ ] T032 [US2] Update `src/lib/simulacion/executor.ts`: only set `FALLIDA` for run-level errors (e.g., missing run, empty `casosJson`)
- [ ] T033 [US2] Update `src/lib/simulacion/executor.ts`: ensure `BATCH_SIZE` and `setImmediate` behavior remain unchanged
- [ ] T034 [US2] Update metrics calculation to include `casosFallidos` or count failures from `Reporte.estado` / error logs

**Checkpoint**: User Story 2 functional — reportes se crean con datos reales, fallos individuales no detienen la corrida.

---

## Phase 4: User Story 3 — Verificación de fidelidad (Priority: P1)

**Goal**: El `quickstart.md` incluye una verificación reproducible de que un reporte de simulación es equivalente a uno real.

**Independent Test**: Ejecutar el quickstart paso a paso y comparar los reportes en BD.

### Tests for User Story 3

- [ ] T035 [P] [US3] Integration test: `src/app/api/admin/ia/simulaciones/route.test.ts` — create a simulation, wait for processing, and verify the created report has the same input fields as the original case
- [ ] T036 [P] [US3] Integration test: `src/app/api/admin/ia/simulaciones/route.test.ts` — verify `categoriaEsperada` is stored only in `SimulacionReporte`, not in `Reporte` or `ClasificacionIA`

### Implementation for User Story 3

- [ ] T037 [US3] Write `quickstart.md` verification steps: create real report via `POST /api/reportes`, create simulation with identical data, compare fields in DB
- [ ] T038 [US3] Document the exact SQL/Prisma queries to compare `Reporte` fields and `TransicionReporte` sequences
- [ ] T039 [US3] Document how to identify the simulation report (prefix `SIM-` or `FuenteReporte.origen = "SIMULACION"`)
- [ ] T040 [US3] Update the UI example file in the simulation form to show the new CSV format

**Checkpoint**: User Story 3 functional — quickstart verification can be reproduced manually and passes.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Ensure the correction integrates cleanly with the existing 070 implementation.

- [ ] T041 [P] Run `npx tsc --noEmit` and fix any type errors caused by the new `CasoSimulacion` shape
- [ ] T042 [P] Run `npm run lint` and fix any lint errors
- [ ] T043 [P] Run `npm run test` and ensure all existing tests still pass (target: ≥ 577 tests, no regressions)
- [ ] T044 [P] Run `npm run build` and verify it compiles successfully
- [ ] T045 [P] Update `specs/070-simulacion-carga-modelos/spec.md` with a short note: "Corrección de fidelidad documentada en specs/071-correccion-fidelidad-simulacion-070/"
- [ ] T046 [P] Update `specs/070-simulacion-carga-modelos/quickstart.md` if it references the old CSV format
- [ ] T047 [P] Review all references to `CasoSimulacion` in the codebase to ensure they use the new fields correctly
- [ ] T048 [P] Verify that the metrics calculation for `casosFallidos` is displayed in the UI (if applicable) or documented as a known limitation

---

## Phase 6: Spec-Kit Closure

**Purpose**: Complete documentation and commit evidence.

- [ ] T049 Update `spec.md` Implementación section with summary of changes
- [ ] T050 Create `cierre.md` with evidence: git log, files touched, test results, deploy status
- [ ] T051 Commit per user story + one docs commit, push to `feature/001-scaffolding`
- [ ] T052 Run deploy limpio with `./scripts/dev-restart.sh` and confirm healthcheck
- [ ] T053 Run quickstart.md verification end-to-end
- [ ] T054 Update Status to `CERRADA`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Schema)**: No dependencies — can start immediately. Blocks all user stories.
- **Phase 2 (US1)**: Depends on Phase 1.
- **Phase 3 (US2)**: Depends on Phase 1 and Phase 2 (parser must produce the new shape).
- **Phase 4 (US3)**: Depends on Phase 2 and Phase 3 (real reports must be created correctly).
- **Phase 5 (Polish)**: Depends on all user stories.
- **Phase 6 (Closure)**: Depends on Phase 5.

### User Story Dependencies

- **US1 (Entrada)**: Can start after Phase 1. No dependency on US2 or US3.
- **US2 (Pipeline)**: Can start after Phase 1 + US1. Requires the parser to output the new `CasoSimulacion` shape.
- **US3 (Verificación)**: Can start after US2. Requires the executor to create real reports correctly.

### Parallel Opportunities

- T001-T004 (Phase 1): All parallel.
- T005-T013 (US1 tests) + T021-T026 (US2 tests): Can be drafted in parallel after Phase 1, but US2 tests will need US1 implementation to pass.
- T014-T020 (US1 impl) + T027-T034 (US2 impl): Best done sequentially because executor depends on parser output.
- T037-T040 (US3 quickstart) can be drafted in parallel with US2 implementation.

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1: Schema change.
2. Complete Phase 2: US1 — parser accepts real fields and validates.
3. Complete Phase 3: US2 — executor uses real fields and continues on failure.
4. **STOP and VALIDATE**: Run parser and executor tests.

### Incremental Delivery

1. Phase 1 → Schema ready.
2. US1 → Parser tests pass.
3. US2 → Executor tests pass.
4. US3 → Quickstart verification documented and tested.
5. Polish → All tests pass, build succeeds, 070 updated with note.
6. Closure → Commit, deploy, status update.

---

## Notes

- No new endpoints are created. The existing `/api/admin/ia/simulaciones` endpoint does not change its interface; it only receives files with more columns.
- No database migration is required for this correction. If a `casosFallidos` counter is added to `SimulacionRun`, it must be an additive, nullable column.
- The `categoriaEsperada` field remains optional and only affects metrics; it is never passed to the classification pipeline.
- The override of the model via pg-boss job remains unchanged (Spec 070, Option A).
