# Tasks: Restablecimiento de Contraseña

**Input**: Design documents from `/specs/005-password-reset/`

**Prerequisites**: spec.md, plan.md

---

## Phase 1: Backend

**Purpose**: Modelo de datos y endpoints de recuperación

- [x] T001 Agregar modelo `TokenRecuperacion` en `prisma/schema.prisma`
- [x] T002 Crear migración Prisma para `TokenRecuperacion`
- [x] T003 Crear `POST /api/auth/recuperar/solicitar` — genera token, envía email, respuesta genérica
- [x] T004 Crear `GET /api/auth/recuperar/validar` — valida token no usado/no expirado
- [x] T005 Crear `POST /api/auth/recuperar/restablecer` — actualiza password, invalida token
- [x] T006 Extender `src/lib/email.ts` con `enviarTokenRecuperacion(email, token)`
- [x] T007 Aplicar bypass de email en dev (devToken en respuesta + log)

**Checkpoint**: Endpoints responden correctamente; token se invalida tras uso

---

## Phase 2: Frontend

**Purpose**: Páginas y formularios de recuperación

- [x] T008 Crear `src/app/recuperar/page.tsx`
- [x] T009 Crear `src/components/modules/RecuperarForm.tsx`
- [x] T010 Crear `src/app/recuperar/[token]/page.tsx`
- [x] T011 Crear `src/components/modules/RestablecerForm.tsx`
- [x] T012 Manejar estados: éxito, token inválido, error genérico

**Checkpoint**: Usuario puede navegar flujo completo en UI

---

## Phase 3: Tests

**Purpose**: Validación automatizada

- [x] T013 Crear `tests/e2e/password-reset.spec.ts` con flujo feliz
- [x] T014 Agregar test E2E de token inválido
- [x] T015 Agregar test E2E de respuesta idéntica para email existente/no existente

**Checkpoint**: `npm run test:e2e` pasa todos los tests de recuperación

---

## Phase 4: Validación

- [x] T016 `npm run build` limpio
- [x] T017 `npm run test` verde
- [x] T018 `npm run test:e2e` verde
- [ ] T019 Commit final + push

---

## Dependencies & Execution Order

Phase 1 → Phase 2 → Phase 3 → Phase 4
