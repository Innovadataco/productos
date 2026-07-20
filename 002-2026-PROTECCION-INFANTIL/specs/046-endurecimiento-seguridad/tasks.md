# Tasks: Endurecimiento de Seguridad (Spec 046)

**Input**: Design documents from `/specs/046-endurecimiento-seguridad/`

**Prerequisites**: plan.md, spec.md, data-model.md, research.md, quickstart.md, checklists/requirements.md

**Tests**: Vitest + Playwright + tsc + lint

**Organization**: Tasks grouped by user story. US6 es plan-only; no se implementa código.

---

## Phase 1: Documentación e inventario (US1)

**Goal**: Documentar dónde vive cada dato sensible y cómo se minimiza.

- [x] T001 [US1] Crear `docs/pii-inventory.md` con mapa de PII (entidades, campos, tratamiento, riesgo).
- [x] T002 [US1] Crear `specs/046-endurecimiento-seguridad/research.md` sección de inventario de PII.
- [x] T003 [US1] Crear `specs/046-endurecimiento-seguridad/data-model.md` resumiendo entidades PII.
- [ ] T004 [US1] [P] Auditar `AuditLog.metadatos`, `Reporte.processingError` y `ClasificacionIA.rawResponse` para asegurar que no contienen PII cruda en flujos normales (documentar en inventario; no cambiar código si ya está OK).

**Checkpoint**: Inventario completo con al menos 10 campos/entidades documentados.

---

## Phase 2: CSP con nonce (US2)

**Goal**: Endurecer la CSP con nonces por petición y directivas restrictivas.

- [ ] T005 [US2] Crear/generar nonce en `src/lib/proxy.ts` para cada petición.
- [ ] T006 [US2] Mover CSP de `next.config.ts` a `src/lib/proxy.ts` con nonce dinámico.
- [ ] T007 [US2] Añadir directivas `upgrade-insecure-requests`, `manifest-src 'self'`, `worker-src 'self'`, `media-src 'self'`.
- [ ] T008 [US2] Remover `unsafe-eval` de `script-src`.
- [ ] T009 [US2] Conservar headers de seguridad estáticos en `next.config.ts` (X-Frame, X-Content-Type, Referrer, Permissions, HSTS).
- [ ] T010 [US2] [P] Test manual: inspeccionar header CSP y verificar carga de la app.

**Checkpoint**: La app carga correctamente y el header CSP no contiene `unsafe-eval`.

---

## Phase 3: Tope de pageSize (US4)

**Goal**: Centralizar y confirmar el tope máximo de 100 registros por página.

- [ ] T011 [US4] Crear `src/lib/pagination.ts` con `MAX_PAGE_SIZE = 100` y `clampPageSize()`.
- [ ] T012 [US4] Aplicar `clampPageSize()` en `src/app/api/admin/dataset-entrenamiento/route.ts`.
- [ ] T013 [US4] Aplicar `clampPageSize()` en `src/app/api/config/parametros/route.ts`.
- [ ] T014 [US4] Aplicar `clampPageSize()` en `src/app/api/reportes/mis-reportes/route.ts`.
- [ ] T015 [US4] [P] Añadir/actualizar tests que verifiquen `pageSize > 100` devuelve 100.

**Checkpoint**: Los tres endpoints responden con máximo 100 items cuando se solicita más.

---

## Phase 4: Sanitización de errores (US5)

**Goal**: Ninguna ruta devuelve `Error.message` crudo al cliente.

- [ ] T016 [US5] Añadir `safeErrorMessage()` en `src/lib/errors.ts`.
- [ ] T017 [US5] Corregir `src/app/api/circulo-confianza/[id]/route.ts` (PATCH) para no devolver mensaje crudo.
- [ ] T018 [US5] Corregir `src/app/api/circulo-confianza/route.ts` (POST) para no devolver mensaje crudo.
- [ ] T019 [US5] Corregir `src/app/api/health/worker/route.ts` para no devolver mensaje crudo.
- [ ] T020 [US5] Corregir `src/app/api/admin/ia/modelos/route.ts` para no devolver mensaje crudo.
- [ ] T021 [US5] Corregir `src/app/api/admin/ia/ollama/probar/route.ts` para no devolver mensaje crudo.
- [ ] T022 [US5] Corregir `src/app/api/admin/ia/evals/route.ts` para no devolver mensaje crudo.
- [ ] T023 [US5] Corregir `src/app/api/admin/ia/experimentos/route.ts` (POST) para no devolver mensaje crudo.
- [ ] T024 [US5] Corregir `src/app/api/admin/ia/sandbox/route.ts` (ya loguea y devuelve genérico; verificar que no filtra mensaje).
- [ ] T025 [US5] Remover `emailError` de respuestas de desarrollo en `src/app/api/auth/verificar/solicitar/route.ts` y `src/app/api/auth/recuperar/solicitar/route.ts` (mantener `devCode`/`devToken`).
- [ ] T026 [US5] [P] Ejecutar `npm run test` y verificar que no se rompen tests existentes.

**Checkpoint**: `grep` no encuentra rutas que devuelvan `error.message` crudo a clientes (salvo `AppError` controlados).

---

## Phase 5: Test e2e de anonimización (US3)

**Goal**: Garantizar que ninguna PII cruda llega a RAG/consulta/logs.

- [ ] T027 [US3] Crear `tests/e2e/anonimizacion.spec.ts`.
- [ ] T028 [US3] Insertar reporte con PII simulada (nombre + teléfono) marcado como anonimizado.
- [ ] T029 [US3] Verificar que `/api/consulta` no devuelve el texto ni fragmentos de PII.
- [ ] T030 [US3] Verificar que `DatasetEntrenamiento` generado desde corrección no contiene PII cruda.
- [ ] T031 [US3] Verificar que logs de error no contienen PII cruda (forzar error controlado).
- [ ] T032 [US3] [P] Ejecutar `npm run test:e2e` y verificar que pasa.

**Checkpoint**: Test e2e de anonimización pasa.

---

## Phase 6: Plan de rotación de clave (US6) — plan-only

**Goal**: Definir cómo se rotará `PARAM_ENCRYPTION_KEY` sin implementar código.

- [x] T033 [US6] Documentar estrategia de versionado en `research.md`.
- [x] T034 [US6] Documentar soporte de múltiples claves en `research.md`.
- [x] T035 [US6] Documentar script de re-cifrado offline en `research.md`.
- [x] T036 [US6] Documentar procedimiento de rollback en `research.md`.
- [x] T037 [US6] Marcar tareas de US6 como `plan-only` en `tasks.md`.

**Checkpoint**: Plan completo y revisable; sin cambios de código.

---

## Phase 7: Validación y cierre

**Goal**: Todos los checks pasan y el spec se cierra.

- [ ] T038 [P] `npx tsc --noEmit`
- [ ] T039 [P] `npm run lint`
- [ ] T040 [P] `npm run test`
- [ ] T041 [P] `npm run test:e2e`
- [ ] T042 [P] `./scripts/dev-restart.sh`
- [ ] T043 [P] Ejecutar `quickstart.md`
- [ ] T044 [P] Crear `specs/046-endurecimiento-seguridad/cierre.md` con evidencia.
- [ ] T045 [P] Actualizar sección Implementación en `spec.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (docs) puede hacerse primero.
- Phase 2 (CSP), Phase 3 (pageSize), Phase 4 (errores) y Phase 5 (test e2e) pueden progresar en paralelo, pero Phase 5 depende de que el flujo de anonimización esté operativo.
- Phase 6 (plan-only) ya está completado en documentos.
- Phase 7 (validación) depende de todas las anteriores.

### Parallel Opportunities

- T001-T004: documentación en paralelo.
- T005-T010: CSP en secuencia (T005 antes que T006).
- T011-T015: pageSize en paralelo.
- T016-T026: errores en paralelo (T016 primero).
- T027-T032: test e2e en secuencia.
- T033-T037: plan-only ya completado.
- T038-T045: validación en paralelo, excepto T042 que debe ejecutarse tras build exitoso.
