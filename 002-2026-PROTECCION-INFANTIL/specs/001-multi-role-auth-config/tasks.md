# Tasks: Autenticación Multi-Rol y Parámetros de Configuración

**Input**: Design documents from `/specs/001-multi-role-auth-config/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/auth.md, contracts/config.md, research.md

**Tests**: Integration tests included per constitution §5.1 (Vitest + jsdom)

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Initialize Next.js 16.2.10 project with TypeScript strict in repository root
- [ ] T002 [P] Install core dependencies: `prisma`, `@prisma/client`, `jose`, `bcryptjs`, `tailwindcss`, `resend`
- [ ] T003 [P] Install dev dependencies: `vitest`, `jsdom`, `@testing-library/react`, `@types/bcryptjs`
- [ ] T004 Configure `tsconfig.json` with `"strict": true` and path aliases (`@/*` → `./src/*`)
- [ ] T005 Create `docker-compose.yml` with PostgreSQL 16 service (healthcheck, volume)
- [ ] T006 Create `.env.example` with `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `ENCRYPTION_KEY`
- [ ] T007 Configure `vitest.config.ts` with jsdom environment, path aliases, and coverage reporter

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 [P] Create `prisma/schema.prisma` with enums (`RolUsuario`, `EstadoUsuario`, `TipoParametro`, `CategoriaParametro`, `AccionAudit`) and all entities from data-model.md
- [ ] T009 [P] Run initial Prisma migration: `npx prisma migrate dev --name init`
- [ ] T010 [P] Create `prisma/seed.ts` with default roles, admin user, default parameters (`visibility.report_threshold=3`, `security.max_login_attempts=5`, etc.), and empty Tenant/Plan/Subscription/BillingCycle
- [ ] T011 Create `src/lib/prisma.ts` singleton (globalThis pattern per constitution §4.1)
- [ ] T012 Create `src/lib/errors.ts` with `AppError` class and error code constants (`AUTH_INVALID`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, etc.)
- [ ] T013 Create `src/lib/auth.ts` with `hashPassword`, `verifyPassword`, `createToken`, `verifyToken`, `verifyAuth` (JWT in httpOnly cookie per constitution §6.1)
- [ ] T014 Create `src/lib/config-cache.ts` with in-memory Map cache, TTL invalidation, and `invalidateCache` function
- [ ] T015 Create `src/lib/email.ts` wrapper for Resend API (reads `RESEND_API_KEY` from env, sends verification codes)
- [ ] T016 Create `src/lib/audit.ts` with `logAudit` function that writes immutable `AuditLog` records

**Checkpoint**: Foundation ready — `npm run build` passes, `npx prisma db seed` creates baseline data, auth utils tested manually

---

## Phase 3: User Story 1 — Administrador gestiona parámetros del sistema (Priority: P1) 🎯 MVP

**Goal**: ADMIN can read, update, delete configuration parameters with audit trail. Public parameters readable without auth.

**Independent Test**: Login as ADMIN → PATCH `/api/config/parametros/visibility.report_threshold` → Verify in GET `/api/config/parametros/publicos`

### Tests for User Story 1

- [ ] T017 [P] [US1] Integration test: `src/app/api/config/parametros/route.test.ts` — GET list (ADMIN), GET public (no auth), PATCH (ADMIN), PATCH denied (PARENT)
- [ ] T018 [P] [US1] Integration test: `src/app/api/config/parametros/[clave]/route.test.ts` — GET single, DELETE, concurrent modification

### Implementation for User Story 1

- [ ] T019 [P] [US1] Implement `GET /api/config/parametros/publicos` in `src/app/api/config/parametros/publicos/route.ts` (no auth required)
- [ ] T020 [US1] Implement `GET /api/config/parametros/route.ts` — list all params with pagination (ADMIN only)
- [ ] T021 [US1] Implement `GET /api/config/parametros/[clave]/route.ts` — get single param with audit history (ADMIN only)
- [ ] T022 [US1] Implement `PATCH /api/config/parametros/[clave]/route.ts` — update param value with type validation, rules validation, and audit log (ADMIN only)
- [ ] T023 [US1] Implement `DELETE /api/config/parametros/[clave]/route.ts` — delete param, block system-critical (ADMIN only)
- [ ] T024 [US1] Create `src/components/modules/ConfigPanel.tsx` — ADMIN UI for listing, editing, deleting parameters
- [ ] T025 [US1] Create `src/app/dashboard/configuracion/page.tsx` — configuration dashboard page (ADMIN only)

**Checkpoint**: User Story 1 functional — public params readable without auth, ADMIN can modify with audit trail, UI renders

---

## Phase 4: User Story 2 — Registro e inicio de sesión de usuarios (Priority: P1)

**Goal**: Self-registration via email verification code (6 digits, 15 min), login with JWT cookie, role-based access, logout.

**Independent Test**: Run quickstart.md Scenario A (solicitar → validar → completar → login) with curl

### Tests for User Story 2

- [ ] T026 [P] [US2] Integration test: `src/app/api/auth/verificar/solicitar/route.test.ts` — code request, duplicate email blocked, rate limit (3/hr)
- [ ] T027 [P] [US2] Integration test: `src/app/api/auth/verificar/validar/route.test.ts` — valid code, expired code, max attempts (5), used code
- [ ] T028 [P] [US2] Integration test: `src/app/api/auth/verificar/completar/route.test.ts` — complete registration, weak password rejected
- [ ] T029 [P] [US2] Integration test: `src/app/api/auth/login/route.test.ts` — valid login, invalid credentials, blocked account
- [ ] T030 [P] [US2] Integration test: `src/app/api/auth/logout/route.test.ts` — session invalidation
- [ ] T031 [P] [US2] Integration test: `src/app/api/me/route.test.ts` — profile for each role

### Implementation for User Story 2

- [ ] T032 [P] [US2] Implement `POST /api/auth/verificar/solicitar/route.ts` — generate 6-digit code, hash with bcrypt, store in `CodigoVerificacion`, send via Resend
- [ ] T033 [P] [US2] Implement `POST /api/auth/verificar/validar/route.ts` — verify bcrypt hash, check expiration, check max attempts, return temp JWT
- [ ] T034 [US2] Implement `POST /api/auth/verificar/completar/route.ts` — validate temp JWT, create `Usuario` with rol=PARENT, set session cookie
- [ ] T035 [US2] Implement `POST /api/auth/login/route.ts` — verify credentials, check account status/blocks, set session cookie
- [ ] T036 [US2] Implement `POST /api/auth/logout/route.ts` — clear `token` cookie
- [ ] T037 [US2] Implement `POST /api/auth/register/route.ts` — ADMIN/SCHOOL_ADMIN direct user creation (skip code flow)
- [ ] T038 [US2] Implement `GET /api/me/route.ts` — return current user profile from cookie
- [ ] T039 [US2] Create `src/components/modules/LoginForm.tsx` — email/password login form
- [ ] T040 [US2] Create `src/components/modules/RegistroForm.tsx` — 3-step registration (email → code → password)
- [ ] T041 [US2] Create `src/app/login/page.tsx` — login page
- [ ] T042 [US2] Create `src/app/registro/page.tsx` — registration page

**Checkpoint**: User Story 2 functional — self-registration with code works, login/logout works, role-based access enforced

---

## Phase 5: User Story 3 — Estructura base del proyecto (Priority: P2)

**Goal**: Reusable project structure, shared components, dashboard layout, seed data, all tests pass.

**Independent Test**: `npm run test` passes all suites, `npm run build` compiles, new endpoint reuses auth utils without modification

### Tests for User Story 3

- [ ] T043 [P] [US3] Unit test: `src/lib/auth.test.ts` — hash/verify, token create/verify, role checks
- [ ] T044 [P] [US3] Unit test: `src/lib/config-cache.test.ts` — get/set/invalidate/TTL behavior
- [ ] T045 [P] [US3] Unit test: `src/lib/errors.test.ts` — error construction and serialization

### Implementation for User Story 3

- [ ] T046 [P] [US3] Create `src/app/dashboard/layout.tsx` — protected layout with role-based sidebar navigation
- [ ] T047 [P] [US3] Create `src/app/dashboard/page.tsx` — role-aware dashboard landing (redirects by role)
- [ ] T048 [P] [US3] Create `src/components/modules/RootLayoutContent.tsx` — theme provider, auth context
- [ ] T049 [P] [US3] Create `src/app/layout.tsx` — root layout with providers
- [ ] T050 [US3] Create `src/app/page.tsx` — public landing page with login/register links
- [ ] T051 [US3] Create `src/middleware.ts` — route protection: redirect unauthenticated to login, block wrong roles
- [ ] T052 [US3] Create placeholder `scripts/worker.mjs` — empty pg-boss worker (future use)
- [ ] T053 [US3] Create `scripts/seed-dev.mjs` — development seed script (calls prisma seed)

**Checkpoint**: User Story 3 functional — dashboard renders per role, middleware protects routes, all tests pass, build succeeds

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T054 [P] Run `quickstart.md` validation scenarios end-to-end with curl
- [ ] T055 [P] Verify all contract endpoints return correct HTTP status codes per constitution §3.4
- [ ] T056 Review and remove any `any` types; add `// TODO(any)` with justification if unavoidable (constitution §3.1)
- [ ] T057 Verify no `console.log` debug statements remain; replace with `console.error`/`console.warn` where permanent (constitution §8.2)
- [ ] T058 Verify `npm run lint` passes with 0 errors
- [ ] T059 Verify `npm run test` passes with >15 tests (constitution §5.3 meta inmediata)
- [ ] T060 Verify `npm run build` compiles successfully
- [ ] T061 Update `README.md` with setup instructions, environment variables, and quickstart

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational
  - US1 and US2 are P1 and can proceed in parallel after Foundational
  - US3 is P2 and can start after Foundational, ideally after US1/US2 for shared component patterns
- **Polish (Phase 6)**: Depends on all user stories

### User Story Dependencies

- **US1 (Configuración)**: Can start after Foundational. No dependency on US2 or US3.
- **US2 (Registro/Login)**: Can start after Foundational. No dependency on US1 or US3.
- **US3 (Estructura base)**: Can start after Foundational. Best after US1+US2 to reuse components.

### Within Each User Story

- Models (Prisma already done in Foundational)
- Services/utilities before endpoints
- Endpoints before UI components
- Tests validate independently

### Parallel Opportunities

- T001-T007 (Setup): All parallel except T001 must complete before T002-T007
- T008-T016 (Foundational): T008/T009/T010 parallel; T011-T016 parallel after T009
- T017-T018 + T026-T031 (Tests): All parallel once Foundational complete
- T019-T025 (US1 impl): T019 parallel with T020-T021; T022 depends on T021; T024-T025 parallel after T022
- T032-T042 (US2 impl): T032-T033 parallel; T034 depends on T033; T035-T038 parallel after T034; T039-T042 parallel after endpoints
- T043-T053 (US3): All parallel after Foundational

---

## Parallel Example: User Story 1 + User Story 2

```bash
# After Foundational complete, two developers can work in parallel:

# Developer A (US1 - Configuración):
T019: GET /api/config/parametros/publicos
T020: GET /api/config/parametros
T021: GET /api/config/parametros/[clave]
T022: PATCH /api/config/parametros/[clave]
T023: DELETE /api/config/parametros/[clave]
T024: ConfigPanel.tsx
T025: dashboard/configuracion/page.tsx

# Developer B (US2 - Registro/Login):
T032: POST /api/auth/verificar/solicitar
T033: POST /api/auth/verificar/validar
T034: POST /api/auth/verificar/completar
T035: POST /api/auth/login
T036: POST /api/auth/logout
T037: POST /api/auth/register
T038: GET /api/me
T039-T042: UI components and pages
```

---

## Implementation Strategy

### MVP First (User Stories 1+2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 (Configuración) — ADMIN can manage parameters
4. Complete Phase 4: US2 (Registro/Login) — users can register and login
5. **STOP and VALIDATE**: Run quickstart.md scenarios
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Test independently → Admin panel works
3. US2 → Test independently → Registration and login work
4. US3 → Test independently → Dashboard and structure complete
5. Polish → All tests pass, build succeeds, docs updated

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational done:
   - Developer A: US1 (Configuración)
   - Developer B: US2 (Registro/Login)
   - Developer C: US3 (Estructura base + tests)
3. Stories complete and integrate independently
4. Polish phase: team review together

---

## Notes

- All file paths follow constitution §3.3 and plan.md structure: `src/app/api/**/route.ts` for endpoints, `src/lib/` for utilities, `src/components/modules/` for UI
- Prisma schema is foundational — all entities created in Phase 2, no schema changes in user story phases
- `CodigoVerificacion` entity used only in US2; no cross-story dependencies
- `AuditLog` is cross-cutting — used in US1 (param updates) and US2 (login/logout)
- Rate limiting for code requests (3/hr) implemented in-memory (no Redis per research.md D2)
- Email sending via Resend (research.md D7); mock in tests