# Tasks: Gantt del cronograma (solo lectura)

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md)

---

## Phase 1: Datos
- [x] T001 `Entregable.fechaInicio` (nullable) + migración aditiva `20260724190000`. Ensayada en
      BD desechable (existente queda NULL) y aplicada a la viva sin pérdida. → FR-006, SC-005
- [x] T002 `entregable.ts` (+test): validar/normalizar `fechaInicio`; rechazar fin anterior al
      inicio. → FR-006

## Phase 2: Matemática pura (RZ-2 / SC-003)
- [x] T003 `src/lib/gantt.ts`: `rangoDeItems`, `fraccion`, `posicionItem`, `fraccionAvance`,
      `posicionHoy`, `ticks` (día/semana/mes). Devuelve fracciones 0..1; "hoy" es parámetro.
- [x] T004 `src/lib/gantt.test.ts` (18 casos): posiciones, escalas, HOY dentro/fuera, ancho
      mínimo, estado vacío. → SC-001, SC-003
- [x] T005 `src/lib/ganttAdaptador.ts` (+test): entregables/hitos → `ItemGantt`; entregable sin
      compromiso excluido; sin `fechaInicio` usa `createdAt`. → FR-001, FR-006

## Phase 3: Componente (US1, US2, US3)
- [x] T006 `GanttProyecto.tsx`: barras con avance, rombos/rangos, cabecera de escala, línea de
      HOY. SVG/CSS propio, cero deps. "Hoy" en inicializador perezoso (§6.2). → FR-001..FR-004
- [x] T007 Pestaña "Gantt" en `GestionPm2`; campo `fechaInicio` en el form de entregables.
      → FR-005

## Phase 4: Gates
- [x] T008 Suite **589/70** (base 564), `tsc` limpio, `eslint src` **0**, build OK, 0 deps. → SC-004

---

## Resultado (2026-07-24, turno D-068 / radicado 015)

| Gate | Resultado |
|---|---|
| Suite | **589/70** (base 564) |
| `tsc` / `eslint src` | limpio / **0** |
| Migración | `fechaInicio` aditiva, ensayada, viva sin pérdida |
| Dependencias nuevas | **0** (SVG/CSS propio) |
| Matemática pura (RZ-2) | `gantt.ts` 18 tests, separada del render — lista para que 016 la reuse |

Verificación funcional en el contenedor: bloque 4.
