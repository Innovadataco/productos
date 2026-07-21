# Tasks: Módulo Colegios — Fase 0: Ubicación (País → Departamento → Ciudad) (Spec 073)

**Input**: Design documents from `/specs/073-ubicacion-departamentos/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Vitest integration tests per constitution §5.1

**Organization**: Tasks grouped by user story. No code implementation until human approval.

---

## Phase 1: Backup & Migration (Prerequisites)

**Purpose**: Protect data and add the `Departamento` model aditively.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete and verified.

- [ ] T001 [US1] Generate DB dump before any migration/seed change (`scripts/backup-pre-073.sh` or manual `pg_dump`).
- [ ] T002 [US1] Create additive Prisma migration `add_departamento`:
  - Create `departamentos` table.
  - Add `departamentoId` nullable column to `ciudades`.
  - Add FKs and indexes (`Departamento.paisId`, `Ciudad.departamentoId`, `unique(nombre, paisId)` on `Departamento`).
- [ ] T003 [US1] Update `prisma/schema.prisma`:
  - Add `model Departamento`.
  - Add `departamentoId String?` to `Ciudad`.
  - Add `departamentos` relation to `Pais`.
- [ ] T004 [US1] Verify migration applies with `npx prisma migrate deploy` on a copy of the DB (no data loss).

**Checkpoint**: Schema migrated, DB backed up, no data loss.

---

## Phase 2: User Story 1 — Modelo Departamento (Priority: P1) 🎯 MVP

**Goal**: `Departamento` exists and can hold `Ciudad` references without breaking existing data.

**Independent Test**: Query `Departamento` table; it has correct columns and relations.

### Tests for User Story 1

- [ ] T005 [P] [US1] Integration test: `prisma/departamento.test.ts` (or equivalent) — verify `Departamento` CRUD and `Ciudad.departamentoId` nullable behavior.
- [ ] T006 [P] [US1] Migration test: verify existing `Ciudad` rows still have `paisId` and nullable `departamentoId` after migration.

### Implementation for User Story 1

- [ ] T007 [US1] Write `Departamento` model in `schema.prisma` (already in T003).
- [ ] T008 [US1] Generate migration with `npx prisma migrate dev --name add_departamento` (after plan approval).

**Checkpoint**: `Departamento` table exists and is queryable.

---

## Phase 3: User Story 2 — Carga real de Colombia (Priority: P1)

**Goal**: Seed Colombia with 33 departments and principal cities, linking existing cities to their departments.

**Independent Test**: After seed, Colombia has 33 departments and existing cities have correct `departamentoId`.

### Tests for User Story 2

- [ ] T009 [P] [US2] Integration test: after seed, Colombia has 33 departments.
- [ ] T010 [P] [US2] Integration test: existing 10 Colombian cities have `departamentoId` not null.
- [ ] T011 [P] [US2] Idempotency test: running seed twice does not duplicate departments or cities.
- [ ] T012 [P] [US2] City-to-department mapping test: verify each existing city is linked to the correct department (Bogotá → Cundinamarca/Bogotá D.C., Medellín → Antioquia, etc.).

### Implementation for User Story 2

- [ ] T013 [US2] Add Colombia department data to `prisma/seed.ts` or `scripts/seed-colombia.ts`.
- [ ] T014 [US2] Add city mapping for the 10 existing Colombian cities and principal capitals.
- [ ] T015 [US2] Implement upsert logic: country by `codigo`, department by `(nombre, paisId)`, city by `(nombre, paisId)` with `departamentoId` update.
- [ ] T016 [US2] Verify coordinates remain intact for existing cities.

**Checkpoint**: Seed runs idempotently and links existing cities to departments.

---

## Phase 4: User Story 3 — No regresión (Priority: P1)

**Goal**: Existing components, endpoints, and tests continue to work unchanged.

**Independent Test**: Full test suite passes; report flow and `/api/ciudades` work as before.

### Tests for User Story 3

- [ ] T017 [P] [US3] Run full `npm run test` and confirm ≥ 600 tests pass with no modifications.
- [ ] T018 [P] [US3] API test: `/api/ciudades?paisId=CO` returns same shape and cities as before.
- [ ] T019 [P] [US3] API test: create a report with Colombia + Bogotá; verify `pais`, `ciudad`, `paisId`, `ciudadId` stored correctly and `departamentoId` not required.
- [ ] T020 [P] [US3] Smoke test: public dashboard and admin dashboard still render city-based aggregations.

### Implementation for User Story 3

- [ ] T021 [US3] Confirm no changes to `src/components/modules/ReporteStepUbicacion.tsx`, `ReporteStepDetalle.tsx`, or `ReporteWizard.tsx`.
- [ ] T022 [US3] Confirm no changes to `/api/paises` and `/api/ciudades` endpoints.
- [ ] T023 [US3] Confirm no changes to `crearReporteSchema` or report creation routes.

**Checkpoint**: All existing tests pass, endpoints unchanged, UI unchanged.

---

## Phase 5: Polish & Documentation

**Purpose**: Finalize docs, run validations, and close spec.

- [ ] T024 [P] Run `quickstart.md` steps end-to-end on a fresh DB copy.
- [ ] T025 [P] Verify `npx tsc --noEmit` passes.
- [ ] T026 [P] Verify `npm run lint` passes.
- [ ] T027 [P] Verify `npm run test` passes.
- [ ] T028 [P] Verify `npm run build` compiles successfully.
- [ ] T029 [P] Update `spec.md` with Implementation section and Status `CERRADA`.
- [ ] T030 [P] Create `cierre.md` with evidence (git log, files touched, test results, deploy status).
- [ ] T031 [P] Deploy clean with `./scripts/dev-restart.sh` and verify healthcheck.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Backup & Migration)**: No dependencies; blocks all user stories.
- **Phase 2 (US1)**: Depends on Phase 1.
- **Phase 3 (US2)**: Depends on Phase 2 (model exists).
- **Phase 4 (US3)**: Depends on Phase 3 (seed done).
- **Phase 5 (Polish)**: Depends on Phase 4.

### Parallel Opportunities

- T001 can be done in parallel with T002/T003 drafting, but must happen before `migrate deploy`.
- T005-T006 (US1 tests) can be written in parallel with T007-T008.
- T009-T012 (US2 tests) can be written in parallel with T013-T016.
- T017-T020 (US3 tests) can be written in parallel with T021-T023.

---

## Implementation Strategy

### MVP First

1. Backup DB.
2. Add `Departamento` model and migration.
3. Seed Colombia departments and link cities.
4. Run full test suite.
5. Update docs, deploy, close.

---

## Notes

- All paths follow project conventions: `prisma/` for schema/migrations, `scripts/` for seed helpers.
- No raw SQL in application code; raw SQL only in migrations if Prisma cannot express it.
- `prisma migrate reset` is prohibited; use `migrate deploy` only.
- If the seed file becomes too large, split Colombia data into `scripts/seed-colombia.ts` and import it from `prisma/seed.ts`.
- No UI changes in this phase; future phases may add a department selector.
