# Tasks: Disciplina y reconciliación Spec-Kit

**Input**: Design documents from `/specs/044-disciplina-spec-kit/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`

**Tests**: Manual verification per `quickstart.md`

**Organization**: Tasks grouped by phase to enable independent execution.

---

## Phase 1: Research & Snapshot

**Purpose**: Audit existing specs and capture the historical snapshot.

- [ ] T001 [P] Read `specs/001-multi-role-auth-config/spec.md` and `.specify/memory/constitution.md` to confirm Spec-Kit format
- [ ] T002 [P] Audit status and artifacts of specs `022-043` in `specs/0NN-*/spec.md`
- [ ] T003 Identify commit `a449bbe` metadata via `git show a449bbe`
- [ ] T004 Document audit findings in `specs/044-disciplina-spec-kit/research.md`

**Checkpoint**: Audit table in `research.md` covers all specs 022-043 and the commit snapshot.

---

## Phase 2: Reconcile Status

**Purpose**: Align spec headers with real state.

- [ ] T005 [P] Reconcile spec headers of specs `022-043` to canonical status values
- [ ] T006 [P] Add missing `Status` line to `specs/030-circulo-confianza-multiples-identificadores/spec.md` and `specs/031-mejoras-ui-agrupacion-categorias/spec.md`
- [ ] T007 Normalize non-canonical statuses in `specs/035-correcciones-034-blindaje-critico/spec.md` and `specs/036-consistencia-limpieza/spec.md` to `PLANEADO`
- [ ] T008 Verify that status reconciliation does not require application code changes

**Checkpoint**: All specs 022-043 show a canonical `Status` value in their header.

---

## Phase 3: Generate Index & Document Debt

**Purpose**: Create the master index and record Spec-Kit debt.

- [ ] T009 [P] Generate master index of specs `022-043` in `specs/044-disciplina-spec-kit/research.md`
- [ ] T010 [P] Document missing `tasks.md` and `checklists/requirements.md` debt for specs `022-031` in `specs/044-disciplina-spec-kit/research.md`
- [ ] T011 [P] Document missing `cierre.md` debt for closed/finalized specs `033-043` in `specs/044-disciplina-spec-kit/research.md`

**Checkpoint**: `research.md` contains the index and both debt tables.

---

## Phase 4: Convention, Validation & Closure

**Purpose**: Establish the closure convention and validate the spec.

- [ ] T012 Define canonical `Status` values and closure convention in `AGENTS.md`
- [ ] T013 Formalize `clarify` and `analyze` workflow steps in `AGENTS.md`
- [ ] T014 Validate all spec headers and artifacts against the new convention
- [ ] T015 [P] Execute verification steps from `specs/044-disciplina-spec-kit/quickstart.md`
- [ ] T016 Update `specs/044-disciplina-spec-kit/spec.md` status to `CERRADA` and complete `Implementación` section
- [ ] T017 Create `specs/044-disciplina-spec-kit/cierre.md` with closure evidence

**Checkpoint**: Convention is in `AGENTS.md`, `quickstart.md` passes, and spec 044 is closed.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies — can start immediately
- **Phase 2**: Depends on Phase 1
- **Phase 3**: Depends on Phase 2
- **Phase 4**: Depends on Phase 3

### Parallel Opportunities

- T001 and T002 can run in parallel.
- T005, T006 and T007 can run in parallel after Phase 1.
- T009, T010 and T011 can run in parallel after Phase 2.
- T015 can run in parallel with T014 once the convention is written.

---

## Implementation Strategy

1. Complete Phase 1: Research & Snapshot.
2. Complete Phase 2: Reconcile Status.
3. Complete Phase 3: Generate Index & Document Debt.
4. Complete Phase 4: Convention, Validation & Closure.
5. **STOP and VALIDATE**: Run `quickstart.md` verification.
6. Close spec 044.
