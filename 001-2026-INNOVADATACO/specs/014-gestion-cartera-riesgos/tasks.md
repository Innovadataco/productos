# Tasks: Espacio de gestión — cartera, detalle y Riesgos

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (Aprobada D-073)

**Rama**: `feature/001-scaffolding`. Staging explícito por ruta. Migración aditiva ensayada.

---

## Phase 1: Baseline

- [x] T001 Verificar lo construido en SPEC-008 (no duplicar): `GestionPm2`, `PanelColeccion`,
      `PanelPresupuesto` existen y son reutilizables; no hay `RiesgoProyecto` ni submódulo
      `gestion`. Suite base **525/63**.

## Phase 2: Modelo y migración (US3)

- [x] T002 Esquema: `RiesgoProyecto` (descripcion, probabilidad, impacto, mitigacion, estado),
      CASCADE, `@@map("riesgos_proyecto")`. → FR-004
- [x] T003 Migración aditiva `20260724180000_add_riesgos_proyecto`, **ensayada en BD desechable**
      (D-039): proyectos 1→1, entregables 1→1, CASCADE 0 huérfanos, abiertos correctos. Aplicada
      a la viva con conteo idéntico. Desechable eliminada. → SC-001

## Phase 3: Lógica pura (US1, US3)

- [x] T004 `src/lib/riesgo.ts` + test: `validarRiesgo`/`datosRiesgo`/`esRiesgoAbierto`, con los
      valores del CEO. → FR-004, FR-005
- [x] T005 `src/lib/cartera.ts` + test: `calcularAgregados` (presupuesto total, avance medio,
      riesgos abiertos, fase); avance `null` sin entregables; 0 proyectos no rompe. → FR-002,
      FR-006, SC-002

## Phase 4: Rutas (US1, US3)

- [x] T006 `/api/projects/[id]/riesgos` (+ `[itemId]`), patrón de las otras colecciones, con
      `verifyAuth`, `apiError`, `auditLog`. Tests: 401/404/400/crear/aislamiento. → FR-004
- [x] T007 `GET /api/projects/cartera`: proyectos + agregados al leer, endpoint propio para no
      cargar el listado plano. Tests: 401, agregados, 0 proyectos, sin fuga de `err.message`.
      → FR-002

## Phase 5: UI (US1, US2, US3)

- [x] T008 Riesgos como 6ª pestaña de `GestionPm2`, sobre `PanelColeccion` (RZ-2: no se
      reescribe). → FR-003
- [x] T009 `CarteraProyectos.tsx`: cartera (presupuesto/avance/riesgos/fase) + detalle que
      **reutiliza** `GestionPm2` fuera del modal, con vuelta a la cartera. → FR-002, FR-003
- [x] T010 Submódulo `gestion` en `SUBMODULES.proyectos` (junto a `fases`) y enrutado en
      `ProyectosTab`. → FR-001
- [x] T011 **Retirar** `GestionPm2` del modal `ProjectForm`; el modal apunta al submódulo. No
      queda import ni interactividad muerta (I-011). → FR-007, SC-003

## Phase 6: Gates

- [x] T012 Suite **564/68** (base 525), `tsc` limpio, `eslint src` **0**, build OK. → SC-004
- [x] T013 Sin dependencias nuevas; `src/lib` y API sin `any`.

---

## Resultado (2026-07-24, turno D-068 / radicado 015)

| Gate | Resultado |
|---|---|
| Suite | **564/68** (base 525) |
| `tsc` / `eslint src` | limpio / **0** |
| Migración | 1 tabla aditiva, ensayada; viva sin pérdida (proyectos 1, chunks 69) |
| Dependencias nuevas | **0** |
| RZ-2 | `GestionPm2`/`PanelColeccion`/`PanelPresupuesto` reutilizados, no reescritos |
| FR-007 | `GestionPm2` fuera del modal (grep = 0) |

**Verificación funcional en el contenedor**: en el bloque 4 (cierre).
