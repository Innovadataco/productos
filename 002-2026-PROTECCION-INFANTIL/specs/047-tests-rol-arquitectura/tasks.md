# Tasks: Tests de rol + documentación de arquitectura

**Input**: Design documents from `/specs/047-tests-rol-arquitectura/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `checklists/requirements.md`

**Tests**: Vitest + jsdom; verificación manual de `docs/ARCHITECTURE.md`

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

---

## Phase 1: Setup (Artefactos Spec-Kit)

**Purpose**: Asegurar que el directorio del spec y sus artefactos existen.

- [x] T001 Crear directorio `specs/047-tests-rol-arquitectura/`.
- [x] T002 Crear `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `checklists/requirements.md`, `tasks.md`.
- [x] T003 Validar que `checklists/requirements.md` pasa el Constitution Check.

**Checkpoint**: Todos los artefactos del Spec-Kit están presentes y el checklist está validado.

---

## Phase 2: User Story 1 — Tests de visibilidad por rol (Priority: P1) 🎯

**Goal**: Crear `src/lib/role-visibility.test.ts` que certifique qué ve cada rol y qué no ve en navegación, proxy y permisos.

**Independent Test**: `npm run test -- src/lib/role-visibility.test.ts` pasa.

### Tests for User Story 1

- [ ] T004 [P] [US1] Test de `ComiteSubNav`: ADMIN/SCHOOL_ADMIN ven 3 tabs; COMITE_VALIDACION solo ve "Bandeja".
- [ ] T005 [P] [US1] Test de `AdminNav`: ADMIN/SCHOOL_ADMIN ven todas las secciones; OPERADOR solo Bandeja/Spam; COMITE_VALIDACION solo Comité.
- [ ] T006 [P] [US1] Test de `proxy`: PARENT redirigido desde `/dashboard/admin`; COMITE_VALIDACION redirigido desde `/dashboard/admin/comite/gestion` y `/auditoria`; ADMIN accede a admin-only.
- [ ] T007 [P] [US1] Test de `puedeGestionarReporte`: ADMIN todo; SCHOOL_ADMIN solo su tenant; OPERADOR solo lo asignado; otros roles false.

**Checkpoint**: `role-visibility.test.ts` cubre los 9 escenarios de aceptación y pasa.

---

## Phase 3: User Story 2 — Documento de arquitectura (Priority: P1)

**Goal**: Redactar `docs/ARCHITECTURE.md` con capas, flujo de datos, convenciones y seguridad/despliegue.

**Independent Test**: El quickstart verifica que existan las 4 secciones principales.

### Implementation for User Story 2

- [ ] T008 [P] [US2] Redactar `docs/ARCHITECTURE.md` con introducción, capas de la aplicación, flujo de datos, convenciones, seguridad y despliegue.
- [ ] T009 [US2] Revisar coherencia con `AGENTS.md` y la constitución; ajustar si hay contradicciones.

**Checkpoint**: `docs/ARCHITECTURE.md` existe, tiene las 4 secciones y no contradice `AGENTS.md`.

---

## Phase 4: User Story 3 — JSDoc en módulos clave (Priority: P2)

**Goal**: Añadir JSDoc preciso a `reporte-lifecycle.ts`, `circulo-confianza.ts`, `proxy.ts`, `ai/classifier.ts` y `param-encryption.ts`.

**Independent Test**: `npx tsc --noEmit` y `npm run lint` pasan; JSDoc presente en exportaciones principales.

### Implementation for User Story 3

- [ ] T010 [P] [US3] Añadir JSDoc a funciones principales de `src/lib/reporte-lifecycle.ts`.
- [ ] T011 [P] [US3] Añadir JSDoc a funciones principales de `src/lib/circulo-confianza.ts`.
- [ ] T012 [US3] Añadir JSDoc a `src/lib/proxy.ts`.
- [ ] T013 [US3] Añadir JSDoc a funciones principales de `src/lib/ai/classifier.ts`.
- [ ] T014 [US3] Añadir JSDoc a funciones principales de `src/lib/param-encryption.ts`.

**Checkpoint**: Los 5 módulos tienen JSDoc en sus exportaciones principales y no hay errores de tipado/lint.

---

## Phase 5: Polish, Validation & Closure

**Purpose**: Garantizar calidad, commits ordenados y cierre del spec.

- [ ] T015 [P] Ejecutar `npx tsc --noEmit` y corregir errores.
- [ ] T016 [P] Ejecutar `npm run lint` y corregir errores (warnings heredados se documentan).
- [ ] T017 [P] Ejecutar `npm run test` y asegurar que todos los tests pasan.
- [ ] T018 Ejecutar `quickstart.md` paso a paso.
- [ ] T019 Hacer deploy limpio con `./scripts/dev-restart.sh`.
- [ ] T020 Crear commits: uno por US1, US2, US3 y uno de docs.
- [ ] T021 Push a `feature/001-scaffolding`.
- [ ] T022 Completar sección Implementación en `spec.md`.
- [ ] T023 Crear `specs/047-tests-rol-arquitectura/cierre.md` con evidencia.
- [ ] T024 Marcar `Status: CERRADA` en `spec.md`.

**Checkpoint**: Spec cerrado, validado, deploy limpio y push realizado.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies.
- **Phase 2 (US1)**: No dependencies sobre código; puede iniciar tras Phase 1.
- **Phase 3 (US2)**: No dependencies sobre código; puede iniciar tras Phase 1.
- **Phase 4 (US3)**: No dependencies sobre código; puede iniciar tras Phase 1.
- **Phase 5**: Depende de US1, US2, US3.

### User Story Dependencies

- **US1 (Tests)**: Independiente. No cambia funcionalidad.
- **US2 (ARCHITECTURE.md)**: Independiente. No cambia funcionalidad.
- **US3 (JSDoc)**: Independiente. No cambia funcionalidad.

### Parallel Opportunities

- US1, US2 y US3 pueden desarrollarse en paralelo.
- T004-T007 (tests) son paralelizables dentro de US1.
- T010-T014 (JSDoc) son paralelizables dentro de US3.

---

## Implementation Strategy

1. **Phase 1**: Crear todos los artefactos del Spec-Kit.
2. **Phase 2**: Implementar tests de visibilidad por rol.
3. **Phase 3**: Redactar `docs/ARCHITECTURE.md`.
4. **Phase 4**: Añadir JSDoc a los módulos clave.
5. **Phase 5**: Validar, commitear, deployar y cerrar el spec.
