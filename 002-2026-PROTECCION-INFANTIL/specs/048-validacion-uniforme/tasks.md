# Tasks: Validación uniforme (zod)

**Input**: Design documents from `/specs/048-validacion-uniforme/`

**Prerequisites**: plan.md, spec.md, research.md, contracts/admin-mutation-validation.md, quickstart.md

**Tests**: Unit tests included per constitution §5.1 (Vitest + jsdom)

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the shared validation layer and reusable schemas.

- [x] T001 [P] Create `src/lib/schemas/index.ts` with reusable zod schemas (`cuidIdSchema`, `parametroClaveSchema`, `emptyBodySchema`, `ollamaProbarBodySchema`, `sandboxBodySchema`, `operadorIdParamsSchema`, `parametroClaveParamsSchema`, `parametroPatchBodySchema`).
- [x] T002 Create `src/lib/validation.ts` with `ValidationError`, `parseBody`, `parseParams`, and `withValidation` helper (`body` and `params` methods).
- [x] T003 [P] Create `src/lib/validation.test.ts` with tests for `ValidationError`, `parseBody`, `parseParams`, and `withValidation`.
- [x] T004 [P] Create `src/lib/schemas/index.test.ts` with tests for each reusable schema (valid and invalid cases).

**Checkpoint**: Shared validation layer compiles and tests pass in isolation.

---

## Phase 2: User Story 1 — Validación uniforme en rutas admin de mutación (Priority: P1) 🎯 MVP

**Goal**: Apply zod validation to all admin mutation routes without a schema, without changing business logic.

**Independent Test**: `npm run test` passes; `quickstart.md` curl examples return `400` for invalid inputs.

### Tests for User Story 1

- [x] T005 [P] [US1] Verify `src/lib/validation.test.ts` covers body validation, params validation, and error serialization.
- [x] T006 [P] [US1] Verify `src/lib/schemas/index.test.ts` covers all domain schemas used in admin routes.

### Implementation for User Story 1

- [x] T007 [P] [US1] Apply `withValidation` to `src/app/api/admin/ia/evals/route.ts` (POST) — empty body schema.
- [x] T008 [P] [US1] Apply `withValidation` to `src/app/api/admin/ia/evals/casos/[id]/desactivar/route.ts` (PATCH) — cuid params schema.
- [x] T009 [P] [US1] Apply `withValidation` to `src/app/api/admin/ia/experimentos/[id]/preparar-activacion/route.ts` (POST) — cuid params schema + empty body.
- [x] T010 [P] [US1] Apply `withValidation` to `src/app/api/admin/ia/ollama/probar/route.ts` (POST) — replace manual validation with zod schema.
- [x] T011 [P] [US1] Apply `withValidation` to `src/app/api/admin/ia/sandbox/route.ts` (POST) — replace manual validation with zod schema.
- [x] T012 [P] [US1] Apply `withValidation` to `src/app/api/admin/operadores/[id]/reactivar/route.ts` (POST) — cuid params schema.
- [x] T013 [P] [US1] Apply `withValidation` to `src/app/api/admin/operadores/[id]/reenviar-email/route.ts` (POST) — cuid params schema.
- [x] T014 [P] [US1] Apply `withValidation` to `src/app/api/admin/operadores/[id]/regenerar-password/route.ts` (POST) — cuid params schema.
- [x] T015 [US1] Apply `withValidation` to `src/app/api/config/parametros/[clave]/route.ts` (PATCH) — replace manual validation with zod params + body schemas.
- [x] T016 [US1] Apply `withValidation` to `src/app/api/admin/apelaciones/vencer/route.ts` (POST) — empty body schema.

**Checkpoint**: User Story 1 functional — all listed admin mutation routes validate input with zod and preserve business logic.

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: Ensure quality, consistency, and documentation.

- [x] T017 [P] Run `npm run test` and confirm all tests pass.
- [x] T018 [P] Run `npx tsc --noEmit` and confirm no type errors.
- [x] T019 [P] Run `npm run lint` and confirm 0 errors.
- [x] T020 [P] Run `quickstart.md` validation scenarios end-to-end with curl (or document if environment unavailable).
- [x] T021 [P] Verify no `console.log` debug statements remain; replace with `console.error`/`console.warn` where permanent.
- [x] T022 Update `specs/048-validacion-uniforme/spec.md` status and implementation section.
- [x] T023 Create `specs/048-validacion-uniforme/cierre.md` with evidence: git log, files touched, test/deploy results, and technical debt.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **User Story 1 (Phase 2)**: Depends on Phase 1 (schemas and helper must exist).
- **Polish (Phase 3)**: Depends on Phase 2.

### User Story Dependencies

- **US1 (Validación uniforme)**: Can start after Phase 1. No dependency on other user stories.

### Within Each User Story

- Schemas/helper before endpoints.
- Unit tests before or alongside endpoint changes (TDD optional but valid).

### Parallel Opportunities

- T001-T004 (Setup): All parallel except T001 and T002 share the design of error shape; they can still be drafted in parallel.
- T007-T016 (US1 impl): All parallel; each route file is independent.
- T017-T023 (Polish): T017-T019 parallel; T020 depends on build; T022-T023 depend on completion.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: schemas and helper.
2. Complete Phase 2: apply validation to each route.
3. **STOP and VALIDATE**: Run `npm run test`, `tsc --noEmit`, `npm run lint`.
4. Deploy and close.

### Incremental Delivery

1. Shared validation layer → unit tests pass.
2. Admin IA routes → validated.
3. Admin operadores routes → validated.
4. Configuración + apelaciones → validated.
5. Polish → docs, build, deploy.

---

## Notes

- All file paths follow constitution §3.3 and plan.md structure: `src/app/api/**/route.ts` for endpoints, `src/lib/` for utilities.
- No Prisma schema changes; validation is input-layer only.
- One commit per functional block + one docs commit, as per AGENTS.md.
- `specs/048-validacion-uniforme/spec.md` status updated to `CERRADA` after validation and deploy.
