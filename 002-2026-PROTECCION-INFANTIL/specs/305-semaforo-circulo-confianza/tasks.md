# Tasks: Semáforo por hijo/familiar del círculo de confianza

**Input**: Design documents from `/specs/305-semaforo-circulo-confianza/`

**Prerequisites**: plan.md, spec.md

**Tests**: Tests unitarios del cálculo, tests del endpoint y tests de componentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1, US2)

---

## Phase 1: Foundational

**Purpose**: Tipos y constantes compartidos del semáforo.

- [ ] T305-001 Crear `src/lib/padre/semaforo.ts` con tipos `ColorSemaforo`, `SemaforoContacto` y helper `peorColor`.
- [ ] T305-002 [P] Definir reglas de negocio en `src/lib/padre/semaforo.ts`: `calcularSemaforoContacto` (sin LLM).

**Checkpoint**: La lógica pura compila y tiene firma estable.

---

## Phase 2: User Story 1 - Ver semáforo de riesgo por contacto (Priority: P1)

**Goal**: Renderizar un semáforo visual por contacto del círculo.

**Independent Test**: El componente `SemaforoCirculo` renderiza tarjetas con el color correcto para un array de contactos.

### Tests for User Story 1

- [ ] T305-003 [P] Test unitario `src/lib/padre/semaforo.test.ts`: verde/ámbar/rojo según reportes y expedientes.
- [ ] T305-004 [P] Test de componente `src/components/modules/padre/SemaforoItem.test.tsx`: renderiza etiqueta, badge y conteo.
- [ ] T305-005 Test de componente `src/components/modules/padre/SemaforoCirculo.test.tsx`: estado vacío, lista y orden por severidad.

### Implementation for User Story 1

- [ ] T305-006 Crear `src/components/modules/padre/SemaforoItem.tsx` (tarjeta individual).
- [ ] T305-007 Crear `src/components/modules/padre/SemaforoCirculo.tsx` (lista de tarjetas).
- [ ] T305-008 Agregar estilos Tailwind para estados verde/ámbar/rojo usando tokens de color del proyecto (`pino`, `ambar`, `rubi`).

**Checkpoint**: US1 es funcional y testeable de forma aislada con datos mock.

---

## Phase 3: User Story 2 - Exponer semáforo vía API reusable (Priority: P2)

**Goal**: Endpoint `GET /api/padre/circulo-confianza/semaforo`.

**Independent Test**: El endpoint responde 200 con los semáforos del padre autenticado; 403 para otros roles.

### Tests for User Story 2

- [ ] T305-009 Test de endpoint `src/app/api/padre/circulo-confianza/semaforo/route.test.ts`: 200 con datos, 403 sin rol PARENT, aislamiento por usuario.

### Implementation for User Story 2

- [ ] T305-010 Crear `src/app/api/padre/circulo-confianza/semaforo/route.ts` con `verifyAuth`, validación de rol PARENT y uso del servicio.
- [ ] T305-011 Implementar query eficiente en `src/lib/padre/semaforo.ts` para obtener contactos + identificadores + reportes + expedientes en un número constante de queries.
- [ ] T305-012 Manejar errores con `AppError` y `errorToResponse`.

**Checkpoint**: US2 funciona de forma independiente; el endpoint puede consultarse directamente.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Integración ligera y calidad.

- [ ] T305-013 Actualizar `specs/README.md` con entrada de SPEC-305 (y 304/306/307/308 como PLANEADO).
- [ ] T305-014 Ejecutar `npx tsc --noEmit`, `npm run lint` y `npm run test` para los archivos tocados.
- [ ] T305-015 Verificar que `PlaceholderPadre` sigue intacto para otras rutas.

---

## Dependencies & Execution Order

### Phase Dependencies

- Foundational → US1 → US2 → Polish
- US1 no depende de US2; ambas dependen de Foundational.

### Within Each User Story

- Tests primero (TDD), luego implementación.
- Servicio antes de endpoint; componentes atómicos antes del listado.

### Parallel Opportunities

- T305-003 y T305-004 pueden correr en paralelo.
- T305-006 y T305-007 son independientes de T305-009/T305-010.
