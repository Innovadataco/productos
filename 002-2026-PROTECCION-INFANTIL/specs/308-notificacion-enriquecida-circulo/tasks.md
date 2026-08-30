# Tasks: Notificación enriquecida de Círculo de Confianza

**Input**: Design documents from `/specs/308-notificacion-enriquecida-circulo/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: Tests unitarios para cada componente + endpoint (TDD).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Crear estructura de carpetas y verificar dependencias del motor

- [ ] T001 [P] Verificar que `src/lib/notificaciones/plantillas/` existe o crearlo en `src/lib/notificaciones/plantillas/`
- [ ] T002 [P] Verificar plantilla y regla existentes en `prisma/seed.ts` para eventos de círculo (`padre.circulo_confianza.pendientes`)
- [ ] T003 [P] Revisar tests existentes de `src/lib/dal/services/circulo-confianza/notificaciones.test.ts` para entender fixtures y mocks

**Checkpoint**: Estructura lista y contexto del motor/seed comprendido

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Configuración de seed para el nuevo evento enriquecido

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Añadir plantilla `padre.circulo_confianza.reporte_enriquecido.email` en `prisma/seed.ts` con variables `{{nombreContacto}}`, `{{identificador}}`, `{{plataforma}}`, `{{categoria}}`, `{{totalReportes}}`, `{{urlExpediente}}`
- [ ] T005 Añadir reglas en `prisma/seed.ts` para evento `padre.circulo_confianza.reporte_enriquecido`, rol `PARENT`, canales `EMAIL` e `IN_APP`, offset `+0m`, no obligatoria
- [ ] T006 [P] Actualizar `src/lib/email.migracion.test.ts` para incluir el nuevo evento `padre.circulo_confianza.reporte_enriquecido` en la lista de eventos migrados

**Checkpoint**: Seed con evento y plantilla disponibles; tests de migración actualizados

---

## Phase 3: User Story 1 - Renderizar email enriquecido (Priority: P1) 🎯 MVP

**Goal**: Crear `src/lib/notificaciones/plantillas/reporte-circulo.ts` con función pura de renderizado

**Independent Test**: `renderizarEmailReporteCirculo(...)` retorna `{ asunto, cuerpo }` con los 6 datos contextuales y escaping correcto

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T010 [P] [US1] Test de renderizado completo en `src/lib/notificaciones/plantillas/reporte-circulo.test.ts`
- [ ] T011 [P] [US1] Test de escaping de identificador con caracteres especiales en `src/lib/notificaciones/plantillas/reporte-circulo.test.ts`
- [ ] T012 [P] [US1] Test de formas singular/plural según `totalReportes` en `src/lib/notificaciones/plantillas/reporte-circulo.test.ts`
- [ ] T013 [P] [US1] Test de fallback cuando `nombreContacto` es vacío en `src/lib/notificaciones/plantillas/reporte-circulo.test.ts`

### Implementation for User Story 1

- [ ] T014 [US1] Crear `src/lib/notificaciones/plantillas/reporte-circulo.ts` con interfaz `RenderEmailReporteCirculoInput`
- [ ] T015 [US1] Implementar `renderizarEmailReporteCirculo(input)` devolviendo `{ asunto, cuerpo }`
- [ ] T016 [US1] Implementar helper de escaping de Markdown (`_`, `*`, `[`, `]`, `<`, `>`)
- [ ] T017 [US1] Implementar pluralización de "reporte/s registrado/s"

**Checkpoint**: `reporte-circulo.test.ts` pasa; renderizado puro y testeable

---

## Phase 4: User Story 2 - Integrar con el motor vía email.ts (Priority: P1)

**Goal**: Añadir `enviarAlertaCirculoConfianzaEnriquecida` en `src/lib/email.ts` usando `programar()`

**Independent Test**: La función llama a `programar()` con el evento, sujeto y variables correctas; falla closed si no hay reglas

### Tests for User Story 2 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T020 [P] [US2] Test de llamada a `programar()` con variables enriquecidas en `src/lib/email.test.ts`
- [ ] T021 [P] [US2] Test de fail-closed cuando `programar()` retorna `{ programadas: 0 }` en `src/lib/email.test.ts`
- [ ] T022 [P] [US2] Test de resolución por `usuarioId` en lugar de `email` en `src/lib/email.test.ts`
- [ ] T023 [P] [US2] Test de omisión cuando `circulo.notificaciones.enabled` es `false` en `src/lib/email.test.ts`

### Implementation for User Story 2

- [ ] T024 [US2] Añadir función `enviarAlertaCirculoConfianzaEnriquecida` en `src/lib/email.ts`
- [ ] T025 [US2] Integrar `renderizarEmailReporteCirculo` dentro del wrapper o pasar variables ya renderizadas
- [ ] T026 [US2] Implementar chequeo de `circulo.notificaciones.enabled` antes de programar
- [ ] T027 [US2] Construir URL del expediente con `baseUrl()` y el id del expediente

**Checkpoint**: `email.test.ts` pasa; wrapper listo para ser usado desde el flujo de círculo

---

## Phase 5: User Story 3 - Disparar desde el flujo de círculo (Priority: P2)

**Goal**: Modificar `notificarCambioCirculoSiCorresponde` para usar la alerta enriquecida

**Independent Test**: `notificarCambioCirculoSiCorresponde(reporteId)` envía alerta contextual con datos correctos y respeta cooldown/preferencias

### Tests for User Story 3 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T030 [P] [US3] Test de alerta enriquecida cuando un reporte visible impacta un contacto en `src/lib/dal/services/circulo-confianza/notificaciones.test.ts`
- [ ] T031 [P] [US3] Test de no envío cuando el reporte no es visible en `src/lib/dal/services/circulo-confianza/notificaciones.test.ts`
- [ ] T032 [P] [US3] Test de no envío cuando el usuario desactivó notificaciones en `src/lib/dal/services/circulo-confianza/notificaciones.test.ts`
- [ ] T033 [P] [US3] Test de no envío cuando el usuario está en cooldown en `src/lib/dal/services/circulo-confianza/notificaciones.test.ts`
- [ ] T034 [P] [US3] Test de pluralización y datos contextuales correctos en el payload en `src/lib/dal/services/circulo-confianza/notificaciones.test.ts`

### Implementation for User Story 3

- [ ] T035 [US3] Refactorizar `src/lib/dal/services/circulo-confianza/notificaciones.ts` para resolver expediente, plataforma y categoría por contacto/identificador
- [ ] T036 [US3] Invocar `enviarAlertaCirculoConfianzaEnriquecida` en lugar de `enviarAlertaCirculoConfianza` cuando corresponda
- [ ] T037 [US3] Mantener lógica de cooldown y preferencias del usuario
- [ ] T038 [US3] Actualizar timestamp `ultimaNotificacionCirculoEn` solo después de programar exitosamente

**Checkpoint**: `notificaciones.test.ts` pasa; el flujo de círculo envía alertas contextualizadas

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validación de calidad y documentación

- [ ] T040 [P] Ejecutar `npx tsc --noEmit`
- [ ] T041 [P] Ejecutar `npm run lint`
- [ ] T042 [P] Ejecutar `npm run test` (incluyendo tests nuevos)
- [ ] T043 [P] Ejecutar `npm run build`
- [ ] T044 Verificar que `src/lib/notificaciones/motor.ts` no fue modificado
- [ ] T045 Verificar que `src/lib/ai/**` no fue modificado
- [ ] T046 Actualizar `docs/architecture/` si el cambio altera la navegación o el stack (si aplica)
- [ ] T047 Ejecutar `./scripts/dev-restart.sh` y validar healthcheck

**Checkpoint**: Gate de calidad verde; SPEC lista para cierre

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P1 → P2)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Depends on US1 (renderizado)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Depends on US2 (wrapper en email.ts)

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Render/helper before wrapper
- Wrapper before integration
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, US1 tests and implementation can proceed
- US2 tests can be drafted in parallel with US1 implementation
- US3 tests can be drafted in parallel with US2 implementation
- All polish/validation tasks marked [P] can run in parallel

---

## Implementation Strategy

### MVP First (User Stories 1-2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (renderizado puro)
4. Complete Phase 4: User Story 2 (wrapper + programar)
5. **STOP and VALIDATE**: Test US1 + US2 independently
6. Add Phase 5: User Story 3 (integración con flujo real)
7. Complete Phase 6: Polish

### Incremental Delivery

1. Setup + Foundational → Seed con evento y plantilla
2. US1 → Renderizado testeado → Demo de plantilla
3. US2 → Wrapper testeado → Programación real vía motor
4. US3 → Flujo integrado → Alertas contextuales en producción
5. Polish → Gate de calidad verde

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
