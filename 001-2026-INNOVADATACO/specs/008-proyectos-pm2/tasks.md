# Tasks: Proyectos PM2 (edición, fases Kanban y gestión completa)

**Input**: Design documents from `specs/008-proyectos-pm2/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (**Aprobada, D-060**),
**SPEC-007 COMPLETA** (aporta el `KanbanBoard` que US2 reutiliza).

**Rama**: `feature/001-scaffolding` (PRUEBAS). Commit + push en el mismo acto, staging
explícito por ruta (prohibido `git add -A`). **No es trabajo pesado: sin turno.**

**US1 y US2 son el mínimo de la noche** (D-060). **Sin migración**: el esquema de `Proyecto`
ya basta para editar y mover fases.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Baseline

- [x] T001 Baseline tras SPEC-007: suite **303/41** verde, `tsc` limpio.
- [x] T002 Barrido de I-011 en el módulo: **4** elementos que fingen interactividad
      (flecha, tarjeta, buscador, botón de filtro), no uno. → I-011

---

## Phase 2: Fases PM2 (US2 — base)

- [x] T003 [US2] `src/lib/fasesPm2.ts`: `FASES_PM2` (Inicio · Planeación · Ejecución ·
      Cierre) con las claves del dato vivo, `esFasePm2`, `nombreDeFase` con fallback. → FR-005
- [x] T004 [US2] `src/lib/fasesPm2.test.ts`: 4 fases en orden; `closing` incluida (la UI solo
      ofrecía 3); validación rechaza fase inventada; fallback de nombre. → FR-005

---

## Phase 3: Edición del proyecto (US1 — el gap base)

- [x] T005 [US1] `src/app/api/projects/[id]/route.ts`: **PATCH** (codigo, nombre, cliente,
      estado, currentPhase) y **DELETE**, con `verifyAuth` + `apiError`. 401 / 404 / 409
      (código en uso) / 400 (fase no PM2). → FR-001, FR-002, FR-003
- [x] T006 [US1] Auditoría (§2.5): `proyecto.fase.cambio` con origen y destino,
      `proyecto.editado`, `proyecto.eliminado`. Misma fase → sin registro de cambio de fase.
      → FR-006, FR-007
- [x] T007 [US1] `src/app/api/projects/[id]/route.test.ts`: 401 sin sesión sin tocar la base;
      404; 409; 400 con fase inválida; edición persiste; auditoría del cambio de fase y su
      ausencia; DELETE; sin fuga de `err.message`. → SC-001, SC-002, SC-004

**Commit 1** — ruta de edición de proyectos + fases PM2 + tests. Push.

---

## Phase 4: UI de edición e I-011 (US1)

- [x] T008 [US1] `ProjectForm.tsx` sirve crear **y** editar (prop opcional `proyecto`):
      PATCH en edición, 4 fases desde `FASES_PM2`, sin `catch (err: any)` ni `alert` con
      `err.message`, pie que no miente sobre dónde persisten los datos. → FR-004
- [x] T009 [US1] `src/app/projects/page.tsx` — **I-011, los 4 casos**: la flecha abre la
      edición; la tarjeta también; el buscador filtra de verdad (código/nombre/cliente); el
      botón de filtro sin semántica **se elimina**. → I-011
- [x] T010 [US1] `ProyectosTab.tsx` deja de ignorar `submoduleId` (era además un
      `no-unused-vars` de la línea base) y enruta `listado` / `fases`.

**Commit 2** — edición desde la UI + I-011 (4 casos). Push.

---

## Phase 5: Tablero de fases (US2 — reusa SPEC-007)

- [x] T011 [US2] `src/lib/tableroProyectos.ts`: `columnasDeFases()` y
      `tarjetasDeProyectos()`. → FR-008
- [x] T012 [US2] `src/lib/tableroProyectos.test.ts`: 4 columnas en orden (SC-003); proyecto en
      la columna de su fase; fase desconocida no rompe el tablero. → SC-003
- [x] T013 [US2] `src/components/proyectos/TableroProyectos.tsx`: usa el `KanbanBoard` de
      SPEC-007 **sin modificarlo**; `PATCH /api/projects/[id]` con `{ currentPhase }`,
      optimista con rollback y mensaje propio. → FR-005, FR-006, FR-007
- [x] T014 [US2] Submódulo `{ id: "fases", title: "Fases PM²" }` en `SUBMODULES.proyectos`.
- [x] T015 [US2] **Gate RZ-2 / SC-005**: `git diff` de esta spec **no** toca
      `src/components/kanban/KanbanBoard.tsx`. Es la prueba de que el tablero es reutilizable.

**Commit 3** — tablero de fases PM2 reutilizando el Kanban de SPEC-007. Push.

---

## Phase 6: Gates (US1 + US2)

- [x] T016 Suite verde y no menor que la línea base (303). → SC-012
- [x] T017 `npx tsc --noEmit` limpio; `npx eslint src/lib src/app/api` sin `no-explicit-any`.
      → SC-013
- [x] T018 `npm run build` compila con la ruta y el submódulo nuevos.
- [x] T019 Aislamiento: 5005/5433/5010/5434, Base Oficial y RAG intactos. → SC-015

---

## Phase 7: US3–US6 (solo si queda tiempo, por prioridad)

> Requieren **migración** (tablas nuevas). Ninguna se aplica a la BD viva sin ensayo previo en
> BD desechable con conteo antes/después (D-039). Cada una en **su** commit.

- [ ] T020 [US3] Entregables (P2): entidad CASCADE con nombre, descripción, estado/avance,
      fecha compromiso y responsable + rutas + tests. → FR-009, FR-010
- [ ] T021 [US5] Presupuesto por partidas (planeado/ejecutado/desviación) y recursos (P2).
      → FR-012, FR-013
- [ ] T022 [US4] Cronograma de hitos (P3). → FR-011
- [ ] T023 [US6] Lecciones aprendidas (P3). → FR-014

---

## Resultado (2026-07-24, turno nocturno D-060)

| Gate | Resultado |
|---|---|
| Suite sin BD ni Ollama | **332 verdes / 44 archivos** (baseline 303/41) |
| `npx tsc --noEmit` | limpio |
| `npx eslint src/lib src/app/api` | **0** `no-explicit-any` |
| `npm run build` | compila |
| Migración | **ninguna** (US1 y US2 no cambian el esquema) |
| RZ-2 / SC-005 | `KanbanBoard.tsx` **sin modificar**: el diff no lo toca |
| Puertos 5005/5433/5010/5434 + RAG | intactos |

**US1 y US2 completas.** US3–US6 **no implementadas** esta noche: exigen migración y la noche
se destinó a cerrar el mínimo verde más SPEC-009 (deuda P1), la auditoría de deuda y la
redacción de SPEC-010. Quedan como el siguiente frente natural, ya troceadas arriba.

**I-011 cerrada con alcance ampliado**: el barrido encontró 4 elementos que fingían
interactividad, no 1. Los cuatro quedan resueltos (tres funcionan, uno se retira).
