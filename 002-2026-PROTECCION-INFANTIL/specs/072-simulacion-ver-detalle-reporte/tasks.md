# Tasks: Simulación — Ver detalle del reporte (Spec 072)

**Input**: Design documents from `/specs/072-simulacion-ver-detalle-reporte/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Component test (Vitest + jsdom + Testing Library) per constitution §5.1

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

---

## Phase 1: UI modification (US1)

**Purpose**: Add the "Ver detalle" button to the simulation results table and wire it to the existing detail modal.

**⚠️ CRITICAL**: No implementation can begin until the plan is approved.

### Tests for User Story 1

- [ ] T001 [P] [US1] Component test: `src/components/modules/ia/simulacion/TablaResultadosSimulacion.test.tsx` — renders the button per row, opens `AdminReporteDetalle` on click, closes modal with Escape/overlay/button.
- [ ] T002 [P] [US1] Component test: verify that `reporteId` is passed correctly to `AdminReporteDetalle`.
- [ ] T003 [P] [US1] Integration test: `src/app/api/admin/ia/simulaciones/[id]/resultados/route.test.ts` — assert that each item includes `reporteId` (already true; add explicit assertion to prevent regression).

### Implementation for User Story 1

- [ ] T004 [US1] Modify `src/components/modules/ia/simulacion/TablaResultadosSimulacion.tsx`:
  - Add local state `selectedReporteId: string | null`.
  - Add a column "Acciones" with a button/link "Ver detalle" per row.
  - On click, set `selectedReporteId` to the row's `reporteId`.
  - Render `AdminReporteDetalle` conditionally when `selectedReporteId` is set, passing `reporteId`, `onClose={() => setSelectedReporteId(null)}`, and `onRefresh` to reload the results if the state changes.
- [ ] T005 [US1] Ensure the button is accessible: use `aria-label="Ver detalle del reporte {identificador}"` or visible text.
- [ ] T006 [US1] Apply the same change to the comparison table if it reuses `TablaResultadosSimulacion`; otherwise, document that the comparison view needs a separate but identical wrapper.

**Checkpoint**: User Story 1 functional — clicking "Ver detalle" opens the existing report detail modal.

---

## Phase 2: Polish & Validation

**Purpose**: Confirm no regressions and documentation is complete.

- [ ] T007 [P] Run `quickstart.md` validation scenario end-to-end in the UI.
- [ ] T008 [P] Verify `npx tsc --noEmit` passes.
- [ ] T009 [P] Verify `npm run lint` passes.
- [ ] T010 [P] Verify `npm run test` passes with the new tests.
- [ ] T011 [P] Verify `npm run build` compiles successfully.
- [ ] T012 [P] Update `spec.md` with Implementation section and Status `CERRADA` after approval and merge.
- [ ] T013 [P] Create `cierre.md` with evidence (git log, files touched, test results, deploy status).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (UI)**: Depends on approved plan.
- **Phase 2 (Polish)**: Depends on Phase 1.

### Within User Story 1

1. T004 (component modification) must happen before T001-T002 tests can run meaningfully, but tests can be written in parallel (TDD).
2. T003 (endpoint assertion) is independent and can be done in parallel.
3. T005 (accessibility) is part of T004.
4. T006 (comparison table) depends on inspecting the comparison view.

### Parallel Opportunities

- T001, T002, T003: parallel once T004 is drafted.
- T007-T011: parallel after Phase 1 is stable.

---

## Implementation Strategy

### MVP First (US1)

1. Add state and button to `TablaResultadosSimulacion.tsx`.
2. Render `AdminReporteDetalle` inside the same component when a row is selected.
3. Write component tests.
4. Run full test suite, lint, typecheck, build.
5. Update docs and close.

---

## Notes

- All file paths follow the project conventions: `src/components/modules/ia/simulacion/` for simulation-specific UI, `src/components/modules/` for shared admin modules, `src/components/ui/` for shared UI primitives.
- No Prisma schema changes.
- No new API routes.
- The `Modal` from Spec 054 already handles focus trap, Escape, and overlay click; no additional logic needed.
- If the comparison view uses a different table component, it should be updated in the same PR to keep parity.
