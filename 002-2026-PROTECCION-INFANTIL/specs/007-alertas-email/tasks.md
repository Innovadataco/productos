# Tasks: Alertas por Email

**Input**: Design documents from `/specs/007-alertas-email/`

## Phase 1: Foundational

- [x] T001 [P] Agregar `enviarAlertaRevision()` en `src/lib/email.ts`.
- [x] T002 [P] Agregar `enviarAlertaScoreCritico()` en `src/lib/email.ts`.
- [x] T003 Agregar parámetros `alerts.admin.enabled` y `alerts.critical_score.enabled` en `prisma/seed.ts`.

## Phase 2: Integration

- [x] T004 [US1] Llamar `enviarAlertaRevision()` desde el catch de `POST /api/reportes/procesar` cuando el estado final es `REVISION_MANUAL`.
- [x] T005 [US2] Llamar `enviarAlertaScoreCritico()` tras `recalcularYGuardarScore()` cuando `nivelRiesgo === "CRITICO"`.
- [x] T006 Garantizar que los envíos sean fire-and-forget y no afecten la respuesta del worker.

## Phase 3: Tests

- [x] T007 [P] Tests unitarios en `src/lib/email.test.ts` (sin PII, parámetros de activación, admins inactivos).
- [x] T008 [P] Tests de integración en `src/app/api/reportes/procesar/route.test.ts` (alerta de revisión y score crítico).

## Phase 4: Polish

- [x] T009 Actualizar `.env.example` con variables relacionadas.
- [x] T010 Ejecutar gate completo: lint, test, build, e2e, tsc.
