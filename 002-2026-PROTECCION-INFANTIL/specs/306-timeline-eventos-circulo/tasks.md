# Tasks — SPEC-306 · Timeline de eventos del círculo de confianza

**Input**: Design documents from `/specs/306-timeline-eventos-circulo/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the feature branch and base structure.

- [ ] T001 Crear directorio de la SPEC: `specs/306-timeline-eventos-circulo/` con `spec.md`, `plan.md` y `tasks.md`.
- [ ] T002 Actualizar `.specify/feature.json` para apuntar a `specs/306-timeline-eventos-circulo`.

**Checkpoint**: Estructura de documentación lista y feature activa configurada.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Revisar dependencias existentes antes de implementar las historias.

- [ ] T003 Verificar que `whereReportesCirculo` en `src/lib/dal/services/circulo-confianza/estado.ts` cubre los estados visibles requeridos por FR-004.
- [ ] T004 Verificar que `obtenerGruposCategoria` en `src/lib/categoria-grupos.ts` expone los grupos necesarios para derivar severity (FR-006).
- [ ] T005 Verificar que los modelos `EventoExpediente` y `Expediente` en `prisma/schema.prisma` tienen los campos y relaciones requeridos por FR-004 y FR-007.

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Timeline API (Priority: P1) 🎯 MVP

**Goal**: Exponer `GET /api/padre/circulo-confianza/timeline` que devuelva eventos de los últimos 30 días relacionados con identificadores del círculo.

**Independent Test**: Llamada autenticada como PARENT a `GET /api/padre/circulo-confianza/timeline` debe devolver el array ordenado de eventos.

### Tests for User Story 1 (write these FIRST) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T006 [P] [US1] Test unitario en `src/lib/padre/timeline-circulo.test.ts`: devuelve lista vacía cuando el usuario no tiene contactos.
- [ ] T007 [P] [US1] Test unitario en `src/lib/padre/timeline-circulo.test.ts`: incluye solo eventos de los últimos 30 días.
- [ ] T008 [P] [US1] Test unitario en `src/lib/padre/timeline-circulo.test.ts`: incluye eventos `REPORTE` y `EXPEDIENTE` de identificadores activos del círculo.
- [ ] T009 [P] [US1] Test unitario en `src/lib/padre/timeline-circulo.test.ts`: ordena por fecha descendente y severity descendente en empate.
- [ ] T010 [US1] Test de integración en `src/app/api/padre/circulo-confianza/timeline/route.test.ts`: usuario no autenticado recibe 401.
- [ ] T011 [US1] Test de integración en `src/app/api/padre/circulo-confianza/timeline/route.test.ts`: usuario sin rol PARENT recibe 403.
- [ ] T012 [US1] Test de integración en `src/app/api/padre/circulo-confianza/timeline/route.test.ts`: usuario PARENT recibe `{ items: [...] }` con shape correcto.

### Implementation for User Story 1

- [ ] T013 [US1] Crear `src/lib/padre/timeline-circulo.ts` con la función `construirTimelineCirculo(usuarioId, client?)`.
- [ ] T014 [US1] Implementar consulta de contactos e identificadores activos del usuario.
- [ ] T015 [US1] Implementar consulta de reportes visibles (`whereReportesCirculo`) de los últimos 30 días.
- [ ] T016 [US1] Implementar consulta de eventos de expediente (`EventoExpediente`) de expedientes del padre cuyo `identificadorReportado` esté en el círculo y con `fechaEvento` en los últimos 30 días.
- [ ] T017 [US1] Implementar mapeo a items del timeline con `tipo`, `fecha`, `severity`, `categoria`, `titulo`, `descripcion`, `expedienteId`, `contactoEtiqueta`, `identificador`.
- [ ] T018 [US1] Implementar ordenamiento por fecha descendente y severity descendente en empate.
- [ ] T019 [US1] Crear `src/app/api/padre/circulo-confianza/timeline/route.ts` con handler GET, autenticación y validación de rol PARENT.
- [ ] T020 [US1] Conectar el handler con `construirTimelineCirculo` y responder `{ items }`.
- [ ] T021 [US1] Agregar manejo de errores con `AppError` y `safeErrorMessage`.

**Checkpoint**: User Story 1 debe ser completamente funcional y testeable de forma independiente (`npm run test` pasa para estos tests).

---

## Phase 4: User Story 2 - Componente Timeline (Priority: P2)

**Goal**: Renderizar el timeline en el componente `TimelineEventosCirculo` con severity, fecha, categoría y botón "abrir expediente".

**Independent Test**: El componente renderiza correctamente con datos de prueba en `src/components/modules/padre/TimelineEventosCirculo.test.tsx`.

### Tests for User Story 2 (write these FIRST) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T022 [P] [US2] Test de componente en `src/components/modules/padre/TimelineEventoItem.test.tsx`: renderiza evento ROJO con fecha, categoría y botón "abrir expediente".
- [ ] T023 [P] [US2] Test de componente en `src/components/modules/padre/TimelineEventoItem.test.tsx`: no muestra el botón "abrir expediente" cuando `expedienteId` es `null`.
- [ ] T024 [P] [US2] Test de componente en `src/components/modules/padre/TimelineEventosCirculo.test.tsx`: renderiza lista ordenada de eventos.
- [ ] T025 [P] [US2] Test de componente en `src/components/modules/padre/TimelineEventosCirculo.test.tsx`: muestra estado vacío cuando no hay eventos.
- [ ] T026 [US2] Test de componente en `src/components/modules/padre/TimelineEventosCirculo.test.tsx`: el botón "abrir expediente" navega a `/dashboard/padre/expedientes/[id]`.

### Implementation for User Story 2

- [ ] T027 [P] [US2] Crear `src/components/modules/padre/TimelineEventoItem.tsx` (ítem individual con severity, fecha, categoría y botón condicional).
- [ ] T028 [P] [US2] Crear `src/components/modules/padre/TimelineEventosCirculo.tsx` (lista que consume el array de eventos y renderiza `TimelineEventoItem`).
- [ ] T029 [US2] Implementar estado vacío amigable en `TimelineEventosCirculo`.
- [ ] T030 [US2] Aplicar colores y estilos según severity usando Tailwind (reutilizar clases de `expediente-ui.ts` si aplica).
- [ ] T031 [US2] Implementar navegación del botón "abrir expediente" hacia `/dashboard/padre/expedientes/[expedienteId]`.
- [ ] T032 [US2] (Opcional) Integrar `TimelineEventosCirculo` en `src/app/dashboard/padre/page.tsx` si el home ya está estabilizado; de lo contrario, documentar en `plan.md`.

**Checkpoint**: User Stories 1 y 2 deben funcionar de forma independiente y todos los tests de UI pasar.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Gate de calidad y documentación antes de cerrar.

- [ ] T033 [P] Ejecutar `npx tsc --noEmit` y corregir errores de tipado.
- [ ] T034 [P] Ejecutar `npm run lint -- --no-cache` y corregir violaciones.
- [ ] T035 [P] Ejecutar `npm run arch:check` y regenerar línea base si es necesario.
- [ ] T036 Ejecutar `npm run test` y garantizar que todos los tests nuevos pasan.
- [ ] T037 Ejecutar `npm run build`.
- [ ] T038 Ejecutar humo con `./scripts/dev-restart.sh`.
- [ ] T039 Actualizar sección Implementación en `spec.md` con decisiones finales y deuda técnica.
- [ ] T040 Rebase + diff pre-push (solo archivos SPEC-306) y `git push --force-with-lease`.

**Checkpoint**: SPEC lista para cierre con evidencia de tests y build verde.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
  - User stories can proceed in parallel (if staffed).
  - Or sequentially in priority order (P1 → P2).
- **Polish (Final Phase)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories.
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on API shape from US1 but can mock it para tests de UI; debe integrarse con US1 antes del polish.

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- Service/helper before endpoint/component.
- Endpoint before UI integration.
- Story complete before moving to next priority.

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel.
- All Foundational tasks marked [P] can run in parallel.
- Once Foundational phase completes, US1 and US2 tests can start in parallel.
- US1 implementation and US2 component implementation can overlap once el contrato de datos del timeline está definido.
- All polish tasks marked [P] can run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Test User Story 1 independently.
5. Add Phase 4: User Story 2.
6. Add Phase 5: Polish.

### Incremental Delivery

1. Setup + Foundational → Foundation ready.
2. Add User Story 1 → Test independently.
3. Add User Story 2 → Test independently.
4. Polish + gates → Close SPEC.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Each user story should be independently completable and testable.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Stop at any checkpoint to validate story independently.
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence.
