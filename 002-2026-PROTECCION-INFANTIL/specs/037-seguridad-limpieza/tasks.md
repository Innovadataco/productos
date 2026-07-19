# Tasks: Fixes de seguridad y limpieza

**Input**: Design documents from `/specs/037-seguridad-limpieza/`

**Prerequisites**: spec.md, plan.md, research.md, data-model.md, quickstart.md, checklists/requirements.md

**Tests**: Vitest + Playwright (donde aplique)

**Organization**: Tasks grouped by user story.

---

## Phase 1: Discovery (shared)

- [x] T001 [P] Grep en `src/app/api/admin/**/route.ts` para identificar endpoints que ya usan `checkRateLimit` y los que no.
- [x] T002 [P] Revisar `src/lib/rate-limit.ts` para confirmar scopes `admin_read` y `admin_write` y firma de `checkRateLimit`.
- [x] T003 [P] Revisar `src/app/api/reportes/procesar/route.ts` para localizar el punto donde se persiste `errMsg` en transición.

**Checkpoint**: Lista exacta de archivos a modificar y patrón de inserción definido.

---

## Phase 2: User Story 1 — Rate limiting en endpoints admin (P1)

### Implementation

- [x] T004 [P] [US1] Aplicar `checkRateLimit` a `src/app/api/admin/operadores/route.ts` (GET → admin_read, POST → admin_write).
- [x] T005 [P] [US1] Aplicar `checkRateLimit` a `src/app/api/admin/operadores/[id]/route.ts` (PATCH → admin_write, DELETE → admin_write).
- [x] T006 [P] [US1] Aplicar `checkRateLimit` a `src/app/api/admin/operadores/[id]/regenerar-password/route.ts` (POST → admin_write).
- [x] T007 [P] [US1] Aplicar `checkRateLimit` a `src/app/api/admin/operadores/[id]/reenviar-email/route.ts` (POST → admin_write).
- [x] T008 [P] [US1] Aplicar `checkRateLimit` a `src/app/api/admin/operadores/[id]/reactivar/route.ts` (POST → admin_write).
- [x] T009 [P] [US1] Aplicar `checkRateLimit` a `src/app/api/admin/comite/integrantes/route.ts` (GET → admin_read, POST → admin_write).
- [x] T010 [P] [US1] Aplicar `checkRateLimit` a `src/app/api/admin/comite/integrantes/[id]/route.ts` (PATCH → admin_write, DELETE → admin_write).
- [x] T011 [P] [US1] Aplicar `checkRateLimit` a `src/app/api/admin/reportes-revision/[id]/reasignar/route.ts` (POST → admin_write).
- [x] T012 [P] [US1] Verificar que el identificador usado es el `id` del usuario retornado por `verifyAuth`.
- [x] T013 [P] [US1] Verificar que el orden es `verifyAuth` → `checkRateLimit` → lógica de negocio.

### Validation

- [x] T014 [P] [US1] Ejecutar `npx tsc --noEmit` y `npm run lint`.
- [ ] T015 [P] [US1] Verificar manualmente headers `X-RateLimit-*` y respuesta `429` en al menos un endpoint admin.
  - **Nota**: En el entorno de desarrollo `.env` tiene `DISABLE_RATE_LIMIT=true`, por lo que no se alcanzó el estado `429` manualmente. La ruta de código y el helper `checkRateLimit` están cubiertos por tests unitarios y por endpoints admin previos.

**Checkpoint**: Todos los endpoints admin listados ahora invocan `checkRateLimit` con el scope correcto; compila y pasa lint.

---

## Phase 3: User Story 2 — errMsg crudo en transición (P1)

### Implementation

- [x] T016 [P] [US2] Definir mensaje genérico y extracción de código de error en `src/app/api/reportes/procesar/route.ts`.
- [x] T017 [P] [US2] Reemplazar `motivo: `Error de procesamiento: ${errMsg}`` por mensaje genérico + código.
- [x] T018 [P] [US2] Reemplazar `metadatos: { error: errMsg }` por `metadatos: { errorCode }` (o similar sin mensaje crudo).

### Validation

- [x] T019 [P] [US2] Ejecutar `npm run test` para confirmar que no se rompen tests existentes.
- [x] T020 [P] [US2] Verificar que el mensaje de error crudo ya no se persiste en transiciones de fallback.

**Checkpoint**: La transición de fallback usa mensaje genérico + código; tests pasan.

---

## Phase 4: Cierre y documentación

- [x] T021 [P] Actualizar `specs/037-seguridad-limpieza/spec.md` con sección Implementación.
- [x] T022 [P] Crear `docs/cierre-037.md` con evidencia de commits, tests y healthcheck.
- [x] T023 [P] Commit US1, commit US2, commit docs.
- [x] T024 [P] Ejecutar `./scripts/dev-restart.sh` y validar healthcheck.
- [x] T025 [P] Hacer push a `feature/001-scaffolding`.

**Checkpoint**: Spec kit completo, deploy limpio, rama actualizada.
