# Tasks: Rediseño visual del tablero Kanban

**Input**: Design documents from `specs/012-rediseno-tablero/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (**gate provisional D-069**;
ratificación del CEO pendiente)

**Rama**: `feature/001-scaffolding` (PRUEBAS). Staging explícito por ruta. **Sin migración, sin
dependencias, sin trabajo pesado.**

---

## Phase 1: Baseline

- [x] T001 Línea base tras el bloque 3: suite **506/61**, `tsc` limpio, `eslint src` en **0**.
- [x] T002 Traducir la petición del CEO —*"está horrible, más transiciones, más moderno"*— a
      decisiones concretas y **dejarlo escrito** en el plan, para que ZEUS pueda discutir la
      traducción y no solo el resultado.

---

## Phase 2: El rediseño (un solo archivo)

- [x] T003 **Tarjeta, jerarquía** (FR-001): el título manda (13 px, negrita, dos líneas con
      corte limpio); referencia y tipo bajan a una línea de apoyo, separados por un punto. Sin
      número o sin tipo la tarjeta no deja hueco. → US1
- [x] T004 **Movimiento** (FR-002): al arrastrar la tarjeta se **eleva** (escala, inclinación
      mínima y sombra); la columna sobrevolada se marca con acento y sombra; al soltar, la
      tarjeta **entra** con `animate-in`. La que se está guardando queda atenuada, con cursor
      de espera y **sin** `draggable`: no invita a arrastrarla otra vez. → US2
- [x] T005 **Vacío compuesto** (FR-003): área con borde discontinuo, símbolo y "Suelta una
      tarjeta aquí". Se lee como destino, no como fallo de carga. Sigue aceptando el arrastre.
      → US3
- [x] T006 **Cabecera de acento** (FR-005): el color del estado pasa a un **punto** y un filo
      bajo la cabecera, en vez de un bloque sólido. `colorDeAcento` extrae el color del acento
      que ya define el adaptador; un estado sin color usa el neutro. → US5
- [x] T007 **Densidad** (FR-004, FR-007): columnas a la **misma altura** (`items-stretch`) para
      que el conjunto no quede con los pies desiguales; lista con altura máxima y
      desplazamiento **por dentro**; sin franja muerta al pie. → US4
- [x] T008 **Movimiento reducido** (FR-006): todo el movimiento apagado con `motion-reduce`.
      Animar a quien pidió no ser animado es un defecto de accesibilidad, no una floritura.

---

## Phase 3: Gates — que sea piel y no huesos

- [x] T009 **SC-001**: `git diff` de la spec **no toca** `package.json` ni `package-lock.json`.
- [x] T010 **SC-002**: `git diff` **no toca** `src/app/api/`, `prisma/` ni los adaptadores
      (`tableroOportunidades.ts`, `tableroProyectos.ts`). Es la prueba objetiva de la frontera.
- [x] T011 **SC-003**: suite **506/61** (no baja), `tsc` limpio, `eslint src` en **0**.
- [x] T012 **SC-004**: `KanbanBoard.tsx` sigue importando solo React y `@/lib/kanban`.
- [x] T013 **SC-005**: los **dos** tableros se ven rediseñados sin que sus adaptadores cambien.
- [x] T014 **SC-006 / RZ-5**: `scripts/verify-tableros.mjs` **en verde tras el rediseño**:
      5/5 y 4/4 columnas a 1280, 1440 y 1920, sin desplazamiento horizontal. **I-014 no se
      reabre** — era el riesgo real de tocar el maquetado recién arreglado.

---

## Resultado (2026-07-24, turno D-068)

| Gate | Resultado |
|---|---|
| Archivos de código tocados | **1** (`KanbanBoard.tsx`) |
| Dependencias nuevas | **0** |
| API / esquema / adaptadores | **sin tocar** (verificado con `git diff`) |
| Suite | **506/61**, sin bajar |
| `tsc --noEmit` / `eslint src` | limpio / **0** |
| Verificador de tableros (en el contenedor) | **verde** a 1280, 1440 y 1920 |
| Imagen verificada | `001-2026-innovadataco-app` del **2026-07-24 03:19** |

**Pendiente**: la ratificación estética del CEO. El gate de ZEUS (D-069) era provisional y esta
spec **no se cierra** con el turno: se cierra cuando el CEO diga que ya no está horrible.

**No se hizo, y no es olvido**: la accesibilidad del arrastre por teclado sigue abierta desde
SPEC-007 (research D1). Está fuera del alcance declarado de esta spec, que es de aspecto; el
arrastre nativo no es navegable por teclado y eso no lo arregla ninguna transición.
