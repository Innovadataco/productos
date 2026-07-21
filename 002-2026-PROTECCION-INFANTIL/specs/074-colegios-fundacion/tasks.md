# Tasks: Módulo Colegios — Fase 1: Fundación (Spec 074)

**Input**: Design documents from `/specs/074-colegios-fundacion/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Vitest integration tests per constitution §5.1

**Organization**: Tasks grouped by user story and phase. No code implementation until human approval.

---

## Phase 1: Backup & Migration (Prerequisites)

**Purpose**: Protect data and add the `Colegio` model aditively.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete and verified.

- [ ] T001 [P] Generate DB dump before any migration (`pg_dump` to `/tmp/backup-pre-074.dump`).
- [ ] T002 [US1] Create additive Prisma migration `add_colegio`:
  - Create table `colegios`.
  - Create enum `TipoPeriodoServicio`.
  - Add `colegioId` nullable to `usuarios` with FK to `colegios.id`.
  - Add values `COLEGIO_*` to enum `AccionAudit`.
  - Add indexes (`Colegio.paisId`, `Colegio.departamentoId`, `Colegio.ciudadId`, `Colegio.tenantId`, `Usuario.colegioId`).
- [ ] T003 [US1] Update `prisma/schema.prisma`:
  - Add `model Colegio` with fields and relations.
  - Add `colegioId` to `Usuario`.
  - Add `TipoPeriodoServicio` enum.
  - Extend `AccionAudit` with `COLEGIO_CREADO`, `COLEGIO_ACTUALIZADO`, `COLEGIO_DESACTIVADO`, `COLEGIO_REACTIVADO`, `COLEGIO_PASSWORD_REGENERADA`, `COLEGIO_EMAIL_REENVIADO`.
- [ ] T004 [US1] Verify migration applies with `npx prisma migrate deploy` on dev and test DBs (no data loss).

**Checkpoint**: Schema migrated, DB backed up, no data loss.

---

## Phase 2: User Story 1 — El admin crea colegios (Priority: P1) 🎯 MVP

**Goal**: ADMIN can create, read, update, activate/deactivate colegios and generate a SCHOOL_ADMIN user.

**Independent Test**: Admin creates a colegio via API; response includes colegio + SCHOOL_ADMIN + temporary password.

### Tests for User Story 1

- [ ] T005 [P] [US1] Integration test: `src/app/api/admin/colegios/route.test.ts` — POST creates colegio + SCHOOL_ADMIN with hashed password, 201.
- [ ] T006 [P] [US1] Integration test: POST rejects duplicate email with 409.
- [ ] T007 [P] [US1] Integration test: POST rejects non-ADMIN roles with 403.
- [ ] T008 [P] [US1] Integration test: PATCH `/api/admin/colegios/[id]` updates fields and records `COLEGIO_ACTUALIZADO`.
- [ ] T009 [P] [US1] Integration test: PATCH `/api/admin/colegios/[id]/desactivar` sets `estado = inactivo` and records `COLEGIO_DESACTIVADO`.
- [ ] T010 [P] [US1] Integration test: PATCH `/api/admin/colegios/[id]/activar` reactivates and records `COLEGIO_REACTIVADO`.
- [ ] T011 [P] [US1] Integration test: GET `/api/admin/colegios` returns paginated list for ADMIN, 403 for others.
- [ ] T012 [P] [US1] Integration test: only one SCHOOL_ADMIN per colegio (database unique constraint / application check).
- [ ] T013 [P] [US1] Audit test: `AuditLog` contains `COLEGIO_CREADO` with correct `recursoId` and `usuarioId`.

### Implementation for User Story 1

- [ ] T014 [US1] Create `src/app/api/admin/colegios/route.ts` with GET/POST.
- [ ] T015 [US1] Create `src/app/api/admin/colegios/[id]/route.ts` with GET/PATCH.
- [ ] T016 [US1] Create `src/app/api/admin/colegios/[id]/activar/route.ts`.
- [ ] T017 [US1] Create `src/app/api/admin/colegios/[id]/desactivar/route.ts`.
- [ ] T018 [US1] Create `src/app/api/admin/colegios/[id]/regenerar-password/route.ts`.
- [ ] T019 [US1] Create `src/app/api/admin/colegios/[id]/reenviar-email/route.ts`.
- [ ] T020 [US1] Create `src/lib/colegio/servicio.ts` with helper `crearColegioConAdmin` (transaction: create Tenant, Colegio, Usuario SCHOOL_ADMIN).
- [ ] T021 [US1] Create `src/lib/colegio/validators.ts` with zod schema for colegio creation/update.
- [ ] T022 [US1] Create `src/components/modules/colegio/ColegioForm.tsx` (admin form) and `ColegioList.tsx`.
- [ ] T023 [US1] Create `src/app/dashboard/admin/colegios/page.tsx` and `src/app/dashboard/admin/colegios/nuevo/page.tsx`.
- [ ] T024 [US1] Add `enviarEmailBienvenidaColegio` to `src/lib/email.ts` (or reuse operator email with role copy).

**Checkpoint**: Admin can create and manage colegios; SCHOOL_ADMIN created automatically.

---

## Phase 3: User Story 2 — Login institucional con identidad visual verde (Priority: P1)

**Goal**: SCHOOL_ADMIN logs in and sees the institutional green-themed dashboard.

**Independent Test**: SCHOOL_ADMIN login succeeds and UI renders green accent.

### Tests for User Story 2

- [ ] T025 [P] [US2] Integration test: `src/app/api/auth/login/route.test.ts` — SCHOOL_ADMIN with valid service logs in successfully.
- [ ] T026 [P] [US2] Integration test: login returns 401 with `SERVICIO_NO_VIGENTE` when service is expired (TBD after US3, can be combined).
- [ ] T027 [P] [US2] Component test: `src/app/dashboard/colegio/page.tsx` or `ColegioPanel.tsx` renders colegio name and green accent classes.
- [ ] T028 [P] [US2] Visual regression smoke: `globals.css` contains `.theme-colegio` overrides for `text-accent`, `accent-gradient`, `ring-accent`, `text-gradient`.

### Implementation for User Story 2

- [ ] T029 [US2] Create `src/app/dashboard/colegio/layout.tsx` applying `theme-colegio` class wrapper.
- [ ] T030 [US2] Create `src/app/dashboard/colegio/page.tsx` showing colegio info.
- [ ] T031 [US2] Create `src/components/modules/colegio/ColegioPanel.tsx`.
- [ ] T032 [US2] Add green accent variant to `src/app/globals.css` (`.theme-colegio` overrides).
- [ ] T033 [US2] Update `src/components/modules/NavHeader.tsx` if needed to show colegio name for SCHOOL_ADMIN.

**Checkpoint**: SCHOOL_ADMIN sees green-themed institutional panel.

---

## Phase 4: User Story 3 — Validación de vigencia del servicio (Priority: P1)

**Goal**: SCHOOL_ADMIN login and colegio routes are blocked when service is not active.

**Independent Test**: SCHOOL_ADMIN with expired service cannot login; middleware blocks colegio routes when service expires.

### Tests for User Story 3

- [ ] T034 [P] [US3] Integration test: login rejects SCHOOL_ADMIN with `finServicio` in the past.
- [ ] T035 [P] [US3] Integration test: login rejects SCHOOL_ADMIN with `inicioServicio` in the future.
- [ ] T036 [P] [US3] Integration test: login rejects SCHOOL_ADMIN when colegio `estado = inactivo`.
- [ ] T037 [P] [US3] Middleware/proxy test: authenticated SCHOOL_ADMIN with expired service is blocked on `/dashboard/colegio` and redirected to `/login`.
- [ ] T038 [P] [US3] API test: `/api/me/colegio` returns 403 `SERVICIO_NO_VIGENTE` when service expired.
- [ ] T039 [P] [US3] Unit test: `src/lib/colegio/vigencia.ts` helpers (`colegioEstaVigente`, `validarVigenciaColegio`).

### Implementation for User Story 3

- [ ] T040 [US3] Create `src/lib/colegio/vigencia.ts` with helpers to check `inicioServicio`, `finServicio`, `estado`.
- [ ] T041 [US3] Update `src/app/api/auth/login/route.ts` to verify colegio vigencia for SCHOOL_ADMIN.
- [ ] T042 [US3] Update `src/lib/proxy.ts` to verify colegio vigencia on `/dashboard/colegio/*` and `/api/me/colegio`.
- [ ] T043 [US3] Update `src/app/api/me/colegio/route.ts` to verify vigencia before returning data.
- [ ] T044 [US3] Create `src/app/dashboard/colegio/servicio-no-vigente/page.tsx` (optional; proxy can redirect to `/login` with message).

**Checkpoint**: Vigencia enforced at login and middleware.

---

## Phase 5: User Story 4 — El colegio NO puede reportar (Priority: P1)

**Goal**: SCHOOL_ADMIN cannot create reports; anonymous/PARENT flow unchanged.

**Independent Test**: SCHOOL_ADMIN POST to `/api/reportes` returns 403; anonymous POST still works.

### Tests for User Story 4

- [ ] T045 [P] [US4] Integration test: `src/app/api/reportes/route.test.ts` — SCHOOL_ADMIN POST returns 403.
- [ ] T046 [P] [US4] Integration test: anonymous POST to `/api/reportes` still works (no regression).
- [ ] T047 [P] [US4] Integration test: PARENT POST to `/api/reportes` still works (no regression).
- [ ] T048 [P] [US4] Proxy test: SCHOOL_ADMIN navigating to `/reportar` is redirected away.
- [ ] T049 [P] [US4] Proxy test: anonymous/PARENT can still access `/reportar`.

### Implementation for User Story 4

- [ ] T050 [US4] Update `src/app/api/reportes/route.ts` to reject `SCHOOL_ADMIN` on POST (allow anonymous and PARENT).
- [ ] T051 [US4] Update `src/lib/proxy.ts` to block `/reportar` for internal roles (ADMIN, SCHOOL_ADMIN, OPERADOR, COMITE_VALIDACION), redirecting to `homeForRole(rol)`.
- [ ] T052 [US4] Verify no regression in `/api/reportes/fallback` and related report endpoints.

**Checkpoint**: SCHOOL_ADMIN blocked from reporting; public reporting intact.

---

## Phase 5.5: User Story 5 — Aislamiento del rol SCHOOL_ADMIN (Priority: P1)

**Goal**: Audit and remove SCHOOL_ADMIN access from all admin/operator/committee/report endpoints and components.

**Independent Test**: SCHOOL_ADMIN receives 403 or redirect on every non-colegio internal route; other roles keep access.

### Tests for User Story 5

- [ ] T061 [P] [US5] Security test: SCHOOL_ADMIN receives 403 on `GET /api/admin/operadores`.
- [ ] T062 [P] [US5] Security test: SCHOOL_ADMIN receives 403 on `GET /api/admin/comite/pendientes`.
- [ ] T063 [P] [US5] Security test: SCHOOL_ADMIN receives 403 on `GET /api/admin/reportes-revision`.
- [ ] T064 [P] [US5] Security test: SCHOOL_ADMIN receives 403 on `GET /api/admin/estadisticas`.
- [ ] T065 [P] [US5] Security test: SCHOOL_ADMIN receives 403 on `GET /api/admin/ia/modelos`.
- [ ] T066 [P] [US5] Security test: SCHOOL_ADMIN receives 403 on `GET /api/admin/spam/pendientes`.
- [ ] T067 [P] [US5] Security test: SCHOOL_ADMIN is redirected away from `/dashboard/admin` and `/dashboard/admin/operadores` by proxy.
- [ ] T068 [P] [US5] Security test: SCHOOL_ADMIN is redirected away from `/mis-reportes` and `/dashboard/circulo-confianza` by proxy.
- [ ] T069 [P] [US5] Component test: `AdminNav` does not render admin/operator/committee items for SCHOOL_ADMIN.
- [ ] T070 [P] [US5] Component test: `ComiteSubNav` does not render tabs for SCHOOL_ADMIN.
- [ ] T071 [P] [US5] Component test: `NavHeader` does not show admin dashboard link for SCHOOL_ADMIN; shows colegio link instead.
- [ ] T072 [P] [US5] Regression test: ADMIN still accesses `/api/admin/operadores`, `/dashboard/admin`, etc.
- [ ] T073 [P] [US5] Regression test: OPERADOR still accesses `/dashboard/admin`, `/api/admin/spam/pendientes`, etc.
- [ ] T074 [P] [US5] Regression test: COMITE_VALIDACION still accesses `/dashboard/admin/comite` and resolver endpoints.
- [ ] T075 [P] [US5] Regression test: PARENT still accesses `/reportar`, `/dashboard`, `/mis-reportes`, `/dashboard/circulo-confianza`.
- [ ] T076 [P] [US5] Update `src/lib/role-visibility.test.tsx` to expect SCHOOL_ADMIN is isolated from admin/operator/committee views.

### Implementation for User Story 5

- [ ] T077 [US5] Run `grep -R "SCHOOL_ADMIN" src/` and document the full inventory in `research.md` (snapshot before changes).
- [ ] T078 [US5] Update `src/lib/auth.ts`:
  - Remove `SCHOOL_ADMIN` from `requireAdmin`, `requireOperadorOAdmin`, `requireComiteOAdmin`, `requireAdminOComiteOOperador`.
  - Add `requireSchoolAdmin()` helper if needed.
- [ ] T079 [US5] Update `src/lib/proxy.ts`:
  - Remove `SCHOOL_ADMIN` from `ADMIN_ROLES`.
  - Treat `SCHOOL_ADMIN` separately from `INTERNAL_ROLES`: allow only `/dashboard/colegio/*` and `/api/me/colegio`.
  - Update `homeForRole` to return `/dashboard/colegio` for SCHOOL_ADMIN.
- [ ] T080 [US5] Update `src/lib/operadores/permisos.ts`: `esAdminRol` should return `false` for SCHOOL_ADMIN when used in report/operator/committee context; or create `esAdminPlataforma` excluding SCHOOL_ADMIN.
- [ ] T081 [US5] Update `src/lib/reporte-transiciones.ts`: remove SCHOOL_ADMIN from `ADMIN` mapping.
- [ ] T082 [US5] Audit and update all `verifyAuth([..., "SCHOOL_ADMIN", ...])` in `src/app/api/admin/**/route.ts` to exclude SCHOOL_ADMIN.
- [ ] T083 [US5] Update `src/components/modules/AdminNav.tsx` to exclude SCHOOL_ADMIN.
- [ ] T084 [US5] Update `src/components/modules/AdminNav.tsx` type `RolNav` to exclude SCHOOL_ADMIN.
- [ ] T085 [US5] Update `src/components/modules/ComiteSubNav.tsx` to exclude SCHOOL_ADMIN.
- [ ] T086 [US5] Update `src/components/modules/NavHeader.tsx` to treat SCHOOL_ADMIN as its own category (colegio link, no admin menu items, no admin header styles).
- [ ] T087 [US5] Update `src/app/login/page.tsx` to redirect SCHOOL_ADMIN to `/dashboard/colegio`.
- [ ] T088 [US5] Update `src/app/cambiar-password/page.tsx` to redirect SCHOOL_ADMIN to `/dashboard/colegio`.
- [ ] T089 [US5] Update `src/app/dashboard/admin/layout.tsx` to exclude SCHOOL_ADMIN (redirect to colegio).
- [ ] T090 [US5] Update `src/app/mis-reportes/page.tsx` and `src/app/dashboard/circulo-confianza/page.tsx` to redirect SCHOOL_ADMIN to `/dashboard/colegio`.
- [ ] T091 [US5] Run `grep -R "SCHOOL_ADMIN" src/` again and document final inventory in `research.md` (snapshot after changes).

**Checkpoint**: SCHOOL_ADMIN is isolated to colegio routes only; all other roles retain access.

---

## Phase 6: Polish & Documentation

**Purpose**: Finalize docs, run validations, and prepare for human review.

- [ ] T053 [P] Update `specs/074-colegios-fundacion/spec.md` with any adjustments discovered during planning.
- [ ] T054 [P] Verify `npx tsc --noEmit` passes (after implementation, not now).
- [ ] T055 [P] Verify `npm run lint` passes.
- [ ] T056 [P] Verify `npm run test` passes with ≥ 605 tests.
- [ ] T057 [P] Verify `npm run build` compiles successfully.
- [ ] T058 [P] Create `cierre.md` and update spec.md `Implementación` after implementation (post-approval).
- [ ] T059 [P] Deploy clean with `./scripts/dev-restart.sh` and verify healthcheck.
- [ ] T060 [P] Run `quickstart.md` steps end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Backup & Migration)**: No dependencies; blocks all user stories.
- **Phase 2 (US1)**: Depends on Phase 1.
- **Phase 3 (US2)**: Depends on Phase 2 (colegio exists) and Phase 4 (vigencia login).
- **Phase 4 (US3)**: Depends on Phase 2 (colegio model). Can be developed in parallel with Phase 3 UI once model exists.
- **Phase 5.5 (US5)**: Depends on Phase 1 (model not required, but must happen after migration safety). Can be parallel with Phase 2. Security-critical; should be completed before deploy.
- **Phase 6 (Polish)**: Depends on all previous phases.

### Parallel Opportunities

- T005-T013 (US1 tests) can be written in parallel with T014-T024 (US1 implementation).
- T025-T028 (US2 tests) in parallel with T029-T033 (US2 UI).
- T034-T039 (US3 tests) in parallel with T040-T044 (US3 vigencia).
- T045-T049 (US4 tests) in parallel with T050-T052 (US4 restriction).
- T061-T076 (US5 tests) in parallel with T077-T091 (US5 isolation).

---

## Implementation Strategy

### MVP First

1. Backup DB and additive migration.
2. Audit and fix SCHOOL_ADMIN access (US5) — security prerequisite; do it before exposing the colegio module.
3. Admin API for colegio CRUD + SCHOOL_ADMIN creation (US1).
4. Login vigencia check (US3).
5. Proxy vigencia + `/reportar` restriction (US4).
6. Green-themed colegio dashboard UI (US2).
7. Tests, docs, deploy.

---

## Notes

- All paths follow project conventions: `src/app/api/**/route.ts`, `src/components/modules/`, `prisma/` for schema/migrations.
- No raw SQL in application code; raw SQL only in migrations.
- `prisma migrate reset` is prohibited; use `migrate deploy` only.
- Every new endpoint must have a `.test.ts` file.
- The green theme is implemented as a CSS utility override, not a new component library.
