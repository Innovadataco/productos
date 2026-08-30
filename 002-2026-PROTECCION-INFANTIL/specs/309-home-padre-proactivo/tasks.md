---

description: "Task list for SPEC-309: Home dashboard proactivo del área padre"

---

# Tasks: Home dashboard proactivo del área padre

**Input**: Design documents from `/specs/304-home-padre-proactivo/`

**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: Tests are required for every component and the endpoint. Write tests first (TDD).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label: US1, US2, US3, US4, SHARED
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare directory structure and remove the placeholder.

- [ ] T304-001 [SHARED] Crear estructura de carpetas según plan.md: `src/lib/padre/` (home*, *-semaforo, *-timeline, *-sugerencia) y `src/components/modules/padre/` (widgets del dashboard).
- [ ] T304-002 [SHARED] Eliminar `src/components/modules/padre/PlaceholderPadre.tsx` y reemplazar su import en `src/app/dashboard/padre/page.tsx` por el contenedor del nuevo dashboard.

**Checkpoint**: Placeholder fuera; esqueleto de carpetas y archivos listo.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data services that MUST be complete before implementing widgets.

**⚠️ CRITICAL**: No widget work can begin until the shared types and base queries are ready.

### Tests for Foundational Services (TDD)

- [ ] T304-003 [SHARED] Escribir tests unitarios para `src/lib/padre/home.ts` (payload, resumen del círculo, manejo de errores).
- [ ] T304-004 [P] [SHARED] Escribir tests unitarios para `src/lib/padre/home-semaforo.ts` (colores, contacto sin reportes, peor color gana).
- [ ] T304-005 [P] [SHARED] Escribir tests unitarios para `src/lib/padre/home-timeline.ts` (últimos 5 eventos, orden, vacío).
- [ ] T304-006 [P] [SHARED] Escribir tests unitarios para `src/lib/padre/home-sugerencia.ts` (reglas por semáforo rojo, gracia, sin contactos).

### Implementation for Foundational Services

- [ ] T304-007 [SHARED] Definir tipos de dominio y payload del dashboard en `src/lib/padre/home.ts`.
- [ ] T304-008 [SHARED] Implementar query base de resumen del círculo en `src/lib/padre/home.ts` (total contactos, sin reportes, en revisión, clasificados).
- [ ] T304-009 [P] [SHARED] Implementar `src/lib/padre/home-semaforo.ts` (cálculo propio verde/ámbar/rojo por contacto, sin importar SPEC-305).
- [ ] T304-010 [P] [SHARED] Implementar `src/lib/padre/home-timeline.ts` (query propia de últimos 5 eventos del círculo, sin importar SPEC-306).
- [ ] T304-011 [P] [SHARED] Implementar `src/lib/padre/home-sugerencia.ts` (reglas propias sin LLM, sin importar SPEC-307).

**Checkpoint**: Servicios base verdes en `npm run test`; widgets pueden arrancar.

---

## Phase 3: User Story 1 - Cabecera y resumen del círculo (Priority: P1) 🎯 MVP

**Goal**: Saludo personalizado con fecha y resumen del círculo.

**Independent Test**: Renderizar `ResumenCirculo` y `HomePadreDashboard` con mocks; mostrar saludo, fecha y conteos.

### Tests for User Story 1

- [ ] T304-012 [P] [US1] Escribir `src/components/modules/padre/ResumenCirculo.test.tsx` (renderiza conteos, estado vacío).
- [ ] T304-013 [US1] Escribir `src/components/modules/padre/HomePadreDashboard.test.tsx` para saludo/fecha y resumen.

### Implementation for User Story 1

- [ ] T304-014 [US1] Implementar `src/components/modules/padre/ResumenCirculo.tsx`.
- [ ] T304-015 [US1] Implementar saludo/fecha y resumen en `src/components/modules/padre/HomePadreDashboard.tsx`.
- [ ] T304-016 [US1] Actualizar `src/app/dashboard/padre/page.tsx` para orquestar cabecera y resumen vía `src/lib/padre/home.ts`.

**Checkpoint**: US1 funciona independientemente; tests verdes.

---

## Phase 4: User Story 2 - Semáforo y timeline del círculo (Priority: P1) 🎯 MVP

**Goal**: Visualizar semáforo de riesgo y timeline de eventos recientes.

**Independent Test**: `GET /api/padre/home` devuelve `semaforo` y `timeline`; componentes los renderizan.

### Tests for User Story 2

- [ ] T304-017 [P] [US2] Escribir `src/components/modules/padre/SemaforoResumen.test.tsx` (colores, conteos, orden).
- [ ] T304-018 [P] [US2] Escribir `src/components/modules/padre/TimelineResumen.test.tsx` (eventos, vacío, fecha formateada).

### Implementation for User Story 2

- [ ] T304-019 [US2] Implementar `src/components/modules/padre/SemaforoResumen.tsx` consumiendo datos de `src/lib/padre/home-semaforo.ts`.
- [ ] T304-020 [US2] Implementar `src/components/modules/padre/TimelineResumen.tsx` consumiendo datos de `src/lib/padre/home-timeline.ts`.
- [ ] T304-021 [US2] Integrar semáforo y timeline en `src/components/modules/padre/HomePadreDashboard.tsx`.

**Checkpoint**: US1 + US2 funcionan juntas; tests verdes.

---

## Phase 5: User Story 3 - Sugerencia proactiva y accesos rápidos (Priority: P2)

**Goal**: Mostrar la siguiente acción recomendada y enlaces rápidos incluyendo canales oficiales.

**Independent Test**: `HomePadreDashboard` muestra sugerencia según reglas y `AccesosRapidos` tiene hrefs correctos.

### Tests for User Story 3

- [ ] T304-022 [P] [US3] Escribir `src/components/modules/padre/SugerenciaProactiva.test.tsx` (reglas, textos, fallback).
- [ ] T304-023 [P] [US3] Escribir `src/components/modules/padre/AccesosRapidos.test.tsx` (enlaces internos y canales oficiales).

### Implementation for User Story 3

- [ ] T304-024 [US3] Implementar `src/components/modules/padre/SugerenciaProactiva.tsx` consumiendo datos de `src/lib/padre/home-sugerencia.ts`.
- [ ] T304-025 [US3] Implementar `src/components/modules/padre/AccesosRapidos.tsx` con enlaces a Reportar, Círculo, Expedientes, Línea 141, CAI Virtual y Te Protejo.
- [ ] T304-026 [US3] Integrar sugerencia y accesos rápidos en `src/components/modules/padre/HomePadreDashboard.tsx`.

**Checkpoint**: US3 funciona; todos los widgets visibles en el home; tests verdes.

---

## Phase 6: User Story 4 - API interna del home (Priority: P2)

**Goal**: Exponer el mismo payload agregado en `GET /api/padre/home`.

**Independent Test**: Endpoint responde 200 con payload completo para PARENT y 403 para otros roles.

### Tests for User Story 4

- [ ] T304-027 [US4] Escribir `src/app/api/padre/home/route.test.ts` (200 PARENT, 403 no-PARENT, payload completo, error canónico).

### Implementation for User Story 4

- [ ] T304-028 [US4] Implementar `src/app/api/padre/home/route.ts` (autenticación, validación rol PARENT, orquestación de servicios, respuesta canónica).
- [ ] T304-029 [US4] Escribir `src/app/dashboard/padre/page.test.tsx` para verificar que el Server Component orquesta correctamente los servicios (mock de Prisma/servicios).

**Checkpoint**: Endpoint independiente verde; página y API comparten la misma lógica de `src/lib/padre/`.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Calidad, documentación y cierre.

- [ ] T304-030 [P] [SHARED] Ejecutar `npx tsc --noEmit` y corregir errores de tipos.
- [ ] T304-031 [P] [SHARED] Ejecutar `npm run lint` y corregir advertencias.
- [ ] T304-032 [P] [SHARED] Ejecutar `npm run test` y asegurar cobertura > 80% en archivos nuevos.
- [ ] T304-033 [P] [SHARED] Ejecutar `npm run build`.
- [ ] T304-034 [SHARED] Ejecutar `./scripts/dev-restart.sh` y validar el home con `quickstart.md`.
- [ ] T304-035 [SHARED] Actualizar sección Implementación en `specs/304-home-padre-proactivo/spec.md` y marcar tareas completadas en `tasks.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Blocks all widget work; home-semaforo/home-timeline/home-sugerencia can be built in parallel after base types/queries.
- **User Stories (Phase 3-6)**: Depend on Foundational phase.
  - US1, US2, US3 can proceed in parallel once their underlying services are ready.
  - US4 depends on all services being ready.
- **Polish (Phase 7)**: Depends on all user stories.

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 base queries (`src/lib/padre/home.ts`).
- **User Story 2 (P1)**: Depends on `src/lib/padre/home-semaforo.ts` and `src/lib/padre/home-timeline.ts`.
- **User Story 3 (P2)**: Depends on `src/lib/padre/home-sugerencia.ts`.
- **User Story 4 (P2)**: Depends on all foundational services and widgets.

### Within Each User Story

- Tests MUST be written first and fail before implementation.
- Services/models before components.
- Components before page integration.
- Story complete before moving to next priority.

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel.
- Foundational service tests and implementations marked [P] can run in parallel.
- Widget tests for different user stories marked [P] can run in parallel.
- Lint/tsc/test/build in Phase 7 marked [P] can run in parallel (if tooling allows).

---

## Implementation Strategy

### MVP First (User Story 1 + Foundational)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational services with tests.
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Test US1 independently.

### Incremental Delivery

1. Foundational + US1 → Test → Demo.
2. Add US2 (semáforo + timeline) → Test → Demo.
3. Add US3 (sugerencia + accesos) → Test → Demo.
4. Add US4 (API endpoint) → Test → Demo.
5. Polish and close.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Each user story should be independently completable and testable.
- Verify tests fail before implementing.
- Commit after each logical group of tasks.
- Avoid importing files from `specs/305-*`, `specs/306-*`, `specs/307-*`, `specs/308-*` source trees.
