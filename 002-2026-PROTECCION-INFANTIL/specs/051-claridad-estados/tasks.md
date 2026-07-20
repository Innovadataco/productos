# Tasks: Claridad y estados

**Input**: Design documents from `/specs/051-claridad-estados/`

**Prerequisites**: spec.md, plan.md, research.md, data-model.md, quickstart.md

**Tests**: Vitest + jsdom + `@testing-library/react` per constitution §5.1

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

---

## Phase 1: Setup (Shared Components)

**Purpose**: Create the reusable Empty/Error state components used by all user stories.

- [ ] T001 [P] Create `src/components/ui/EmptyState.tsx` — standard empty state with title, description, optional icon and action
- [ ] T002 [P] Create `src/components/ui/ErrorState.tsx` — standard error state with title, description and retry action
- [ ] T003 [P] Add unit tests: `src/components/ui/EmptyState.test.tsx` and `src/components/ui/ErrorState.test.tsx`

**Checkpoint**: Shared components render, accept props and pass tests.

---

## Phase 2: User Story 1 — Componente estándar de estado vacío/error (Priority: P1) 🎯 MVP

**Goal**: Replace scattered loading/error messages with the standard components.

**Independent Test**: Manual test on `/mis-reportes`, `/dashboard/admin/operadores/gestion`, `ComiteSolicitudDetalle`, `AdminReporteDetalle`, `IaEvalManager`.

### Implementation for User Story 1

- [ ] T004 [US1] Replace error state in `src/app/mis-reportes/page.tsx` with `ErrorState`
- [ ] T005 [US1] Replace error state in `src/components/modules/DashboardUsuarioClient.tsx` with `ErrorState`
- [ ] T006 [US1] Replace error state in `src/components/modules/ComiteSolicitudDetalle.tsx` with `ErrorState`
- [ ] T007 [US1] Replace not-found state in `src/components/modules/AdminReporteDetalle.tsx` with `ErrorState`
- [ ] T008 [US1] Replace error state in `src/components/modules/ia/IaEvalManager.tsx` with `ErrorState`
- [ ] T009 [US1] Replace empty state in `src/components/modules/AdminReportesTable.tsx` with `EmptyState`
- [ ] T010 [US1] Replace empty states in `src/components/modules/ComiteBandeja.tsx` with `EmptyState`
- [ ] T011 [US1] Replace empty states in `src/components/modules/SpamRevisionPanel.tsx` with `EmptyState`
- [ ] T012 [US1] Replace empty states in `src/components/modules/AdminAntiAbusoSimulacion.tsx` and `AuditLogViewer.tsx` with `EmptyState`
- [ ] T013 [US1] Replace empty states in `src/components/modules/ia/IaEvalManager.tsx` and `IaDocsPanel.tsx` with `EmptyState`

**Checkpoint**: User Story 1 functional — no stray "Error al cargar" messages remain; empty states use standard component.

---

## Phase 3: User Story 2 — Microcopy empático (Priority: P2)

**Goal**: Improve copy in report, consult and tracking flows to be clear, respectful and non-judgmental.

**Independent Test**: Visual/manual review of `/reportar`, `/consulta`, `/seguimiento` and relevant components.

### Implementation for User Story 2

- [ ] T014 [US2] Update copy in `src/app/reportar/page.tsx` title and subtitle
- [ ] T015 [US2] Update copy in `src/components/modules/ReporteStepPlataforma.tsx` heading, label and placeholder
- [ ] T016 [US2] Update copy in `src/components/modules/ReporteStepDetalle.tsx` heading, labels and helper text
- [ ] T017 [US2] Update copy in `src/components/modules/ReporteStepDescripcion.tsx` heading, label and placeholder
- [ ] T018 [US2] Update copy in `src/components/modules/ReporteStepConfirmar.tsx` heading, labels and warning text
- [ ] T019 [US2] Update copy in `src/components/modules/ConfirmacionReporte.tsx` title, body and warning
- [ ] T020 [US2] Update copy in `src/components/modules/ConsultaForm.tsx` label, placeholder and validation message
- [ ] T021 [US2] Update copy in `src/components/modules/ConsultaPublicaClient.tsx` title, subtitle, empty state and CTA
- [ ] T022 [US2] Update copy in `src/components/modules/SeguimientoForm.tsx` label, placeholder and validation message
- [ ] T023 [US2] Update copy in `src/components/modules/SeguimientoClient.tsx` title, subtitle, error and result messages

**Checkpoint**: User Story 2 functional — copy reads empathetically and passes constitution §1.3 review.

---

## Phase 4: User Story 3 — Jerarquía visual en pantallas densas (Priority: P3)

**Goal**: Improve visual hierarchy on operator/committee/admin dense screens without redesigning flows.

**Independent Test**: Visual/manual review of `/dashboard/admin`, `/dashboard/admin/operadores/asignar`, `/dashboard/admin/operadores/gestion`, `/dashboard/admin/comite/gestion`.

### Implementation for User Story 3

- [ ] T024 [US3] Add section headings and spacing in `src/components/modules/AdminDashboard.tsx`
- [ ] T025 [US3] Improve heading hierarchy in `src/app/dashboard/admin/operadores/asignar/page.tsx`
- [ ] T026 [US3] Improve heading hierarchy in `src/app/dashboard/admin/operadores/gestion/page.tsx`
- [ ] T027 [US3] Improve heading hierarchy in `src/app/dashboard/admin/comite/gestion/GestionPageClient.tsx`
- [ ] T028 [US3] Review and adjust spacing in `src/components/modules/AdminReportesTable.tsx` page wrapper

**Checkpoint**: User Story 3 functional — dense screens have clear section headings and consistent spacing.

---

## Phase 5: Validate & Close

**Purpose**: Ensure all changes pass quality gates and document the result.

- [ ] T029 [P] Run `npx tsc --noEmit`
- [ ] T030 [P] Run `npm run lint`
- [ ] T031 [P] Run `npm run test`
- [ ] T032 [P] Run `npm run build`
- [ ] T033 [P] Execute `quickstart.md` manual validation scenarios
- [ ] T034 [P] Deploy clean with `./scripts/dev-restart.sh`
- [ ] T035 [P] Update `spec.md` Implementation section and create `cierre.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Shared Components)**: No dependencies — must complete before Phase 2.
- **Phase 2 (US1)**: Depends on Phase 1.
- **Phase 3 (US2)**: Depends on Phase 1; no dependency on US1 or US3.
- **Phase 4 (US3)**: Depends on Phase 1; no dependency on US1 or US2.
- **Phase 5 (Validate)**: Depends on all prior phases.

### Parallel Opportunities

- T001-T003 can run in parallel.
- T004-T013 (US1 replacements) can run in parallel after Phase 1.
- T014-T023 (US2 copy) can run in parallel after Phase 1.
- T024-T028 (US3 spacing) can run in parallel after Phase 1.
- T029-T035 (validation) are mostly sequential but T033/T034 can run after T032.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: shared components.
2. Complete Phase 2: replace error/empty states.
3. **STOP and VALIDATE**: run tests and build.

### Incremental Delivery

1. US1 → Test independently → no stray error messages.
2. US2 → Test independently → copy review.
3. US3 → Test independently → visual hierarchy review.
4. Validate → All tests, lint, build, quickstart and deploy clean.

---

## Notes

- All file paths follow constitution §3.3 and existing project conventions.
- No schema changes; no endpoint changes; no business logic changes.
- One commit per user story + one documentation commit, per AGENTS.md rules.

