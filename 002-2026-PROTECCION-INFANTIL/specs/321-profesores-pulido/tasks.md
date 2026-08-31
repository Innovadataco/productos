# Tasks: SPEC-321 · pulido profesores (SPEC-B)

**Radicado**: 002-PI-221 · **Branch**: `work/pi-SPEC-321-profesores-pulido`
**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

## Phase 1: Setup
- [x] T001 Worktree + npm ci (D-82) · base main 478cc4769

## Phase 2: Backend conteo (P10)
- [x] T002 `profesor.ts` `listarPaginados`: `_count` filtrado de `identificadoresProf` activos
- [x] T003 `route.ts` GET: exponer `identificadoresActivos` por profesor

## Phase 3: UI (P5/P8/P10 · US1)
- [x] T004 [US1] Quitar el botón duplicado del EmptyState (queda el del header)
- [x] T005 [US1] Toggle label → "Inactivar"/"Activar"; ajustar el mensaje de éxito al mismo vocabulario
- [x] T006 [US1] Columna "Identificadores" con el conteo; `type Profesor` += `identificadoresActivos`

## Phase 4: Tests + verificación
- [x] T007 `ProfesoresPageClient.test.tsx`: 1 botón, toggle Inactivar/Activar+PATCH, columna conteo (payload real)
- [x] T008 Job `verificaciones` + `specs-discipline` + test:unit
- [ ] T009 Verificación navegador como rector (candado 25) — evidencia PR
- [x] T010 Fila 321 en `specs/README.md` · Status IMPLEMENTADO · commit · push · PR

## Dependencias
- T002 antes de T003 · T003 antes de T006 · T004–T006 antes de T007.
