# Tasks: Gantt interactivo (arrastre)

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), **SPEC-015 (matemática pura)**

---

## Phase 1: Datos
- [x] T001 `dependeDe` (nullable) en entregables e hitos + migración aditiva `20260724200000`.
      Ensayada en BD desechable, aplicada a la viva sin pérdida. → FR-003
- [x] T002 Persistir `dependeDe` en `entregable.ts` y `proyectoPm2.ts` (datosHito). → FR-003

## Phase 2: Matemática inversa (RZ-2 / FR-006)
- [x] T003 `src/lib/ganttInteractivo.ts`: `fechaEnFraccion`, `snap`, `nuevaFechaSnap`,
      `moverBarra`, `redimensionar`, `detectarConflictos`. `gantt.ts` NO se toca (SC-003).
- [x] T004 `ganttInteractivo.test.ts` (16 casos): inversa, snap por escala, mover con duración
      constante, redimensionar sin cruzar, conflictos, referencia colgada, ciclo. → SC-004
- [x] T005 `ItemGantt` gana `dependeDe?`; adaptador lo propaga (+test).

## Phase 3: Componente (US1, US2, US3)
- [x] T006 `GanttProyecto.tsx`: arrastre con **pointer capture** (cuerpo mueve, bordes
      redimensionan), preview optimista, `PATCH` al soltar con **rollback** si falla, snap por
      escala. → FR-001, FR-002, FR-004
- [x] T007 Marcado de conflictos (rojo) con `detectarConflictos`; selector de dependencia por
      barra. → FR-003

## Phase 4: Gates y verificación
- [x] T008 Suite **606/71** (base 589), `tsc` limpio, `eslint src` **0**, build OK, 0 deps. → SC-004
- [x] T009 Los 18 tests de `gantt.test.ts` (spec 015) siguen verdes: la math no se rompió. → SC-003
- [x] T010 Persistencia del PATCH verificada con un entregable **desechable** en la viva (D-039),
      sembrado y borrado; nunca sobre datos del CEO. La verificación completa del arrastre en el
      navegador va tras el redespliegue (bloque 4). → SC-001

---

## Resultado (2026-07-24, turno D-068 / radicado 015)

| Gate | Resultado |
|---|---|
| Suite | **606/71** (base 589) |
| `tsc` / `eslint src` | limpio / **0** |
| Migración | `dependeDe` aditiva, ensayada, viva sin pérdida |
| Dependencias nuevas | **0** (puntero nativo) |
| Math de 015 (SC-003) | intacta: 18 tests verdes, la inversa en otro archivo |

**Nota honesta (Regla 4)**: la prueba de PATCH contra el contenedor del turno anterior actualizó
`fechaCompromiso` pero **no** `fechaInicio` — porque esa imagen no conoce el campo. Es la razón
exacta de redesplegar: el código de la ruta sí lo maneja (`resultante` + `datosEntregable`). La
verificación real del arrastre se hace con la imagen de este turno, en el bloque 4.
