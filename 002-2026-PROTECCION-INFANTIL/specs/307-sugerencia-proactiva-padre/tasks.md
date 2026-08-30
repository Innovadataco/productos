---

description: "Task list for SPEC-307: Sugerencia proactiva para el área del padre"

---

# Tasks: Sugerencia proactiva para el área del padre

**Input**: Design documents from `/specs/307-sugerencia-proactiva-padre/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: Incluidos. Deben escribirse primero y fallar antes de la implementación (TDD).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Crear la estructura de carpetas y archivos base para la feature.

- [ ] T001 Crear estructura de carpetas:
  - `src/lib/padre/sugerencia.types.ts`
  - `src/lib/padre/sugerencia.ts`
  - `src/lib/padre/sugerencia.test.ts`
  - `src/app/api/padre/home/sugerencia/route.ts`
  - `src/app/api/padre/home/sugerencia/route.test.ts`
  - `src/components/modules/padre/SugerenciaProactiva.tsx`
  - `src/components/modules/padre/SugerenciaProactiva.test.tsx`

**Checkpoint**: Estructura lista para recibir tipos, motor, endpoint y componente.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos, constantes y utilidades compartidas que bloquean las user stories.

- [ ] T002 [P] Definir tipos y schema Zod en `src/lib/padre/sugerencia.types.ts`:
  - `TipoSugerencia`: `'INVITAR_CONTACTOS' | 'ROJO' | 'AMBAR' | 'SIN_NOVEDADES' | 'TODO_VERDE'`
  - `SugerenciaProactiva`: `{ tipo, mensaje, accion, metadata }`
  - `EstadoCirculoEntrada`: datos mínimos del círculo para evaluación
  - `EntradaSugerencia`: contactos, expedientes, notificaciones y fecha de referencia
- [ ] T003 [P] Definir constantes de negocio en `src/lib/padre/sugerencia.types.ts`:
  - Orden de prioridad de tipos de sugerencia
  - Ventana de 7 días para `SIN_NOVEDADES`
  - Mapeo tipo → mensaje/acción por defecto

**Checkpoint**: Tipos y constantes estables; las user stories pueden comenzar.

---

## Phase 3: User Story 2 - API y motor de reglas (Priority: P2)

**Goal**: Exponer `GET /api/padre/home/sugerencia` con un motor de reglas puro, determinista y testeado.

**Independent Test**: `GET /api/padre/home/sugerencia` responde correctamente para cada tipo de sugerencia y rechaza accesos no autorizados.

### Tests for User Story 2 (TDD) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T004 [US2] Test unitario del motor en `src/lib/padre/sugerencia.test.ts`:
  - Sin contactos → `INVITAR_CONTACTOS`
  - Todo verde + novedades recientes → `TODO_VERDE`
  - Contacto en ámbar → `AMBAR`
  - Contacto en rojo → `ROJO`
  - Sin novedades 7 días → `SIN_NOVEDADES`
  - Prioridad: sin contactos > rojo > ámbar > sin novedades 7 días > todo verde
- [ ] T005 [US2] Test unitario del endpoint en `src/app/api/padre/home/sugerencia/route.test.ts`:
  - PARENT autenticado recibe sugerencia con status 200
  - Sin sesión o rol distinto recibe 401/403
  - Datos de prueba cubren al menos 3 tipos de sugerencia

### Implementation for User Story 2

- [ ] T006 [US2] Implementar motor de reglas en `src/lib/padre/sugerencia.ts`:
  - Función `analizarSugerencia(entrada): SugerenciaProactiva`
  - Queries/entrada: contactos activos, resumen del semáforo del círculo, expedientes recientes, notificaciones no leídas
  - Aplicar orden de prioridad definido en FR-003
  - Sin LLM; solo lógica condicional y fechas
- [ ] T007 [US2] Implementar endpoint `GET /api/padre/home/sugerencia/route.ts`:
  - Verificar autenticación con `verifyAuth` y rol PARENT
  - Obtener datos del usuario autenticado
  - Llamar a `analizarSugerencia` con datos de BD
  - Responder `{ sugerencia }` con status 200
- [ ] T008 [US2] Validar salida con Zod y manejar errores con `AppError`/`safeErrorMessage`

**Checkpoint**: Endpoint y motor funcionan de forma independiente; todos los tests de US2 pasan.

---

## Phase 4: User Story 1 - Componente SugerenciaProactiva (Priority: P1) 🎯 MVP

**Goal**: Renderizar la sugerencia contextual en el home del padre.

**Independent Test**: El componente `SugerenciaProactiva` muestra el mensaje, icono y acción correctos para cada tipo de sugerencia.

### Tests for User Story 1 (TDD) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T009 [US1] Test unitario del componente en `src/components/modules/padre/SugerenciaProactiva.test.tsx`:
  - Renderiza `INVITAR_CONTACTOS` con enlace a flujo de agregar contacto
  - Renderiza `TODO_VERDE` con tono tranquilizador
  - Renderiza `AMBAR` con alerta en revisión
  - Renderiza `ROJO` con acción recomendada
  - Renderiza `SIN_NOVEDADES` con recordatorio amigable
  - Maneja estado de carga/error si aplica

### Implementation for User Story 1

- [ ] T010 [US1] Implementar componente `src/components/modules/padre/SugerenciaProactiva.tsx`:
  - Recibir prop `sugerencia: SugerenciaProactiva`
  - Mostrar icono, mensaje y acción según `tipo`
  - Usar Tailwind CSS; sin colores hardcodeados arbitrarios (usar semántica del semáforo)
  - Incluir `"use client"` si requiere interacción
- [ ] T011 [US1] Integrar componente en el home del padre (`src/app/dashboard/padre/page.tsx` o ruta equivalente):
  - Llamar al endpoint desde Server Component u obtener datos vía fetch
  - Renderizar `<SugerenciaProactiva sugerencia={...} />` en la parte superior del home
  - Manejar estado vacío/error sin romper la página

**Checkpoint**: User Story 1 es funcional en el home del padre; todos los tests de US1 pasan.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validación, documentación y ajustes finales.

- [ ] T012 [P] Ejecutar `npx tsc --noEmit` y corregir errores de tipo
- [ ] T013 [P] Ejecutar `npm run lint` y corregir advertencias
- [ ] T014 [P] Ejecutar `npm run test` y asegurar que todos los tests de SPEC-307 pasan
- [ ] T015 Actualizar sección "Implementation" de `specs/307-sugerencia-proactiva-padre/spec.md` con resumen de cambios y deuda técnica
- [ ] T016 Validar manualmente con `quickstart.md` si existe; de lo contrario, crear notas de validación en `specs/307-sugerencia-proactiva-padre/`
- [ ] T017 Verificar que no se modificó `src/lib/ai/**` ni `src/lib/notificaciones/motor.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 2 (Phase 3)**: Depende de Phase 2; proporciona el endpoint y motor que consume US1
- **User Story 1 (Phase 4)**: Depende de Phase 2 y Phase 3 (endpoint/motor)
- **Polish (Phase 5)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 2 (P2)**: Independiente; debe completarse antes de US1 porque el componente consume el endpoint/motor
- **User Story 1 (P1)**: Depende del endpoint y motor de US2; su componente es independiente en tests pero requiere los datos de US2 en runtime

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types/constants before motor
- Motor before endpoint
- Endpoint before component integration
- Story complete before moving to next priority

### Parallel Opportunities

- T002 y T003 pueden ejecutarse en paralelo
- T004 y T005 pueden ejecutarse en paralelo (tests de motor y endpoint)
- T009 puede escribirse en paralelo con T004/T005 una vez los tipos estén listos
- T012, T013, T014, T015 y T017 pueden ejecutarse en paralelo al final

---

## Implementation Strategy

### MVP First (User Story 2 → User Story 1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (tipos y constantes)
3. Complete Phase 3: User Story 2 (motor + endpoint + tests)
4. **STOP and VALIDATE**: Test User Story 2 independently
5. Complete Phase 4: User Story 1 (componente + integración + tests)
6. Complete Phase 5: Polish
7. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 2 → Test endpoint/motor independently
3. Add User Story 1 → Test componente e integración independently
4. Polish → Validación final

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable; US1 requiere US2 en runtime pero no en tests unitarios del componente
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
