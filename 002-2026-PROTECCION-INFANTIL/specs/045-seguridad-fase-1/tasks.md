# Tasks: Seguridad Fase 1 — Saneamiento de Auth

**Input**: Design documents from `/specs/045-seguridad-fase-1/`

**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/auth.md

**Tests**: Integration tests included per constitution §5.1 (Vitest + jsdom)

**Organization**: Tasks grouped by user story. US3 is plan-only; no code implementation.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create Spec-Kit artifacts and prepare shared utilities.

- [x] T001 Create `specs/045-seguridad-fase-1/` directory with all required artifacts: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `checklists/requirements.md`, `tasks.md`, `contracts/auth.md`.
- [x] T002 Add default rate limit scopes `recuperar_solicitar` and `verificacion_solicitar` to `src/lib/rate-limit.ts` defaults.
- [x] T003 Add Zod schemas `authRegisterSchema`, `recuperarSolicitarSchema`, `restablecerPasswordSchema` to `src/lib/validators.ts`.

---

## Phase 2: User Story 1 — Rate limiting en recuperación y verificación (Priority: P1) 🎯 MVP

**Goal**: Apply `checkRateLimit` to `POST /api/auth/recuperar/solicitar` and `POST /api/auth/verificar/solicitar`, both by IP and by email identifier, preserving uniform responses.

**Independent Test**: Run quickstart.md Scenarios A, B and C (rate limit by IP and by identifier).

### Tests for User Story 1

- [x] T004 [P] [US1] Integration test: `src/app/api/auth/recuperar/solicitar/route.test.ts` — rate limit by IP, rate limit by email, uniform response, headers present.
- [x] T005 [P] [US1] Integration test: `src/app/api/auth/verificar/solicitar/route.test.ts` — rate limit by IP, rate limit by email, 202/429 response, no enumeration.

### Implementation for User Story 1

- [x] T006 [P] [US1] Update `src/app/api/auth/recuperar/solicitar/route.ts` to call `checkRateLimit(request, "recuperar_solicitar")` and `checkRateLimit(request, "recuperar_solicitar", { identifier: email })` before processing.
- [x] T007 [P] [US1] Update `src/app/api/auth/verificar/solicitar/route.ts` to call `checkRateLimit(request, "verificacion_solicitar")` and `checkRateLimit(request, "verificacion_solicitar", { identifier: email })` before processing.
- [x] T008 [US1] Ensure both endpoints return the existing success message with `429` status and `Retry-After` / `X-RateLimit-*` headers when rate limited.
- [x] T009 [US1] Add `src/lib/rate-limit.test.ts` coverage for the new scopes if needed (optional, existing tests cover generic behavior).

**Checkpoint**: US1 functional — rate limit blocks after threshold, uniform response, no account enumeration.

---

## Phase 3: User Story 2 — Validación Zod en endpoints públicos de auth (Priority: P1)

**Goal**: Validate payloads with Zod in `POST /api/auth/register`, `POST /api/auth/recuperar/solicitar`, and `POST /api/auth/recuperar/restablecer`.

**Independent Test**: Run quickstart.md Scenarios D, E and F (invalid payloads rejected with 400).

### Tests for User Story 2

- [x] T010 [P] [US2] Unit test: `src/lib/validators.test.ts` — validate each schema accepts valid inputs and rejects invalid emails, weak passwords, missing fields, extra fields.
- [x] T011 [P] [US2] Integration test: `src/app/api/auth/register/route.test.ts` — validation errors before DB, valid registration still works.
- [x] T012 [P] [US2] Integration test: `src/app/api/auth/recuperar/solicitar/route.test.ts` — invalid email rejected with 400.
- [x] T013 [P] [US2] Integration test: `src/app/api/auth/recuperar/restablecer/route.test.ts` — invalid token/password rejected with 400.

### Implementation for User Story 2

- [x] T014 [P] [US2] Update `src/app/api/auth/register/route.ts` to use `authRegisterSchema` for payload validation; replace manual validation while preserving role/tenant logic.
- [x] T015 [P] [US2] Update `src/app/api/auth/recuperar/solicitar/route.ts` to use `recuperarSolicitarSchema` for payload validation.
- [x] T016 [P] [US2] Update `src/app/api/auth/recuperar/restablecer/route.ts` to use `restablecerPasswordSchema` for payload validation; preserve password complexity and token lookup logic.
- [x] T017 [US2] Ensure all validation errors return `400` with `VALIDATION_ERROR` code and a readable message.

**Checkpoint**: US2 functional — invalid payloads rejected before DB, valid flows unchanged.

---

## Phase 4: User Story 3 — Plan de borrado seguro / derecho al olvido (Priority: P1) *(plan-only)*

**Goal**: Deliver complete design plan for secure deletion / right to be forgotten without writing code.

**Independent Test**: Review `specs/045-seguridad-fase-1/plan.md` section "Plan de Borrado Seguro / Derecho al Olvido" for completeness.

- [x] T018 [US3] Document all tables containing PII (Usuario, Reporte, AuditLog, CodigoVerificacion, TokenRecuperacion, Disputa, CirculoConfianza, Apelacion).
- [x] T019 [US3] Define request → confirmation → ADMIN approval → execution flow.
- [x] T020 [US3] Distinguish physical deletion vs. anonymization per legal retention.
- [x] T021 [US3] Define proposed Prisma model `BorradoSolicitud` and endpoints without implementing.
- [x] T022 [US3] Include UX/UI proposal and test plan for future implementation.
- [x] T023 [US3] Mark all US3 tasks as `[PLAN-ONLY]` in tasks.md and do not create src files.

**Checkpoint**: US3 plan complete — no code, no migrations, no schema changes.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Ensure all tests pass, build succeeds, and Spec-Kit is closed.

- [x] T024 [P] Run `quickstart.md` validation scenarios end-to-end with curl.
- [x] T025 [P] Run `npx tsc --noEmit` with 0 errors.
- [x] T026 [P] Run `npm run lint` with 0 errors.
- [x] T027 [P] Run `npm run test` with all tests passing.
- [x] T028 [P] Run `npm run build` successfully.
- [x] T029 [P] Run `./scripts/dev-restart.sh` for clean deploy.
- [x] T030 [US1] Commit: `feat(045): rate limit en auth recuperar y verificar por IP e email`.
- [x] T031 [US2] Commit: `feat(045): validación Zod en endpoints públicos de auth`.
- [x] T032 [US3] Commit: `docs(045): plan de borrado seguro / derecho al olvido`.
- [x] T033 [P] Push commits to `feature/001-scaffolding`.
- [x] T034 [P] Write `specs/045-seguridad-fase-1/cierre.md` and update `spec.md` Implementation section.
- [x] T035 [P] Update `spec.md` status to `CERRADA`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately.
- **Phase 2 (US1)**: Depends on Phase 1 (T002).
- **Phase 3 (US2)**: Depends on Phase 1 (T003). Can run in parallel with US1 after setup.
- **Phase 4 (US3)**: Depends only on Phase 1; no code, no cross-dependencies.
- **Phase 5 (Polish)**: Depends on all previous phases.

### User Story Dependencies

- **US1 (Rate limit)**: No dependency on US2 or US3.
- **US2 (Zod validation)**: No dependency on US1 or US3; both US1 and US2 touch `recuperar/solicitar`, so they must coordinate on that file (sequencing T006 after T015 or vice versa).
- **US3 (Plan-only)**: No dependency on US1 or US2.

### Within Each User Story

- Tests before implementation (TDD where applicable).
- Implementation preserves existing business logic and response shapes.
- Polish and validation after all implementations.

### Parallel Opportunities

- T004 and T005 (US1 tests) can run in parallel.
- T006 and T007 (US1 impl) can run in parallel.
- T010, T011, T012, T013 (US2 tests) can run in parallel once T003 is done.
- T014, T015, T016 (US2 impl) can run in parallel.
- T018-T023 (US3 plan) are pure documentation and can run in parallel.

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1: Setup and shared utilities.
2. Complete Phase 2: US1 — rate limit on `recuperar/solicitar` and `verificar/solicitar`.
3. Complete Phase 3: US2 — Zod validation on `register`, `recuperar/solicitar`, `recuperar/restablecer`.
4. Complete Phase 4: US3 — plan-only documentation.
5. Complete Phase 5: Validate, build, deploy, close.

### Incremental Delivery

1. Setup → schemas and rate limit defaults ready.
2. US1 → Test independently → rate limit works.
3. US2 → Test independently → Zod validation works.
4. US3 → Review plan → no code.
5. Polish → All tests pass, build succeeds, docs closed.

---

## Notes

- All file paths follow constitution §3.3 and plan.md structure: `src/app/api/**/route.ts` for endpoints, `src/lib/` for utilities.
- No schema changes or migrations in this spec.
- Rate limit scopes are additive; existing `report`, `login`, `register`, etc. remain unchanged.
- `register` endpoint already had rate limit by scope `register`; US2 adds Zod validation but does not alter that rate limit.
- US3 tasks are explicitly marked `[PLAN-ONLY]` to prevent accidental code implementation.
