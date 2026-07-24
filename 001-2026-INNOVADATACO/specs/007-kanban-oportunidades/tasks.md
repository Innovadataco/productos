# Tasks: Kanban de Oportunidades (componente reutilizable)

**Input**: Design documents from `specs/007-kanban-oportunidades/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (**Aprobada, D-060**)

**Rama**: `feature/001-scaffolding` (PRUEBAS). Commit + push en el mismo acto, staging
explícito por ruta (prohibido `git add -A`). **No es trabajo pesado: sin turno.**

**Sin migración**: el tablero no cambia el esquema. `Licitacion.estadoId` y
`LicitacionStatus` ya existen.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos). Cada tarea con su verificación.

---

## Phase 1: Baseline

- [x] T001 Baseline: suite **282/39** verde, `npx tsc --noEmit` limpio. Anotado antes de tocar nada.

---

## Phase 2: Lógica genérica del tablero (US3 — la condición de ZEUS)

- [x] T002 [US3] `src/lib/kanban.ts`: tipos `ColumnaKanban`/`TarjetaKanban`/`ColumnaConTarjetas`
      y funciones puras `agruparPorColumna`, `tarjetasHuerfanas`, `esMovimientoReal`. Cero
      dominio, cero dependencias. → FR-001, FR-009
- [x] T003 [US3] `src/lib/kanban.test.ts`: orden del catálogo respetado; columna vacía **no**
      se omite; huérfana detectada sin romper; `esMovimientoReal` en misma columna / tarjeta
      inexistente / movimiento real. → US1-2, US1-3, US1-4, FR-009

---

## Phase 3: Presentación genérica (US3)

- [x] T004 [US3] `src/components/kanban/KanbanBoard.tsx`: columnas + tarjetas + arrastre
      HTML5 nativo; emite `onMover(tarjetaId, columnaDestinoId)` **solo** si
      `esMovimientoReal`; `moviendoId` atenúa la tarjeta en vuelo; `mensajeVacio` para
      catálogo sin columnas. **Importa únicamente `@/lib/kanban` y React.** → FR-001, SC-008
- [x] T005 [US3] Verificar SC-008 por imports: el archivo no menciona `Licitacion`, estados,
      ni rutas de API. → US3-1

**Commit 1** — componente Kanban genérico + lógica pura + tests. Push.

---

## Phase 4: Adaptador de Oportunidades (US1, US2, US4)

- [x] T006 [US1] `src/lib/tableroOportunidades.ts`: `columnasDeEstados` (una columna por
      estado del catálogo, en su orden, acento por `key` con **fallback neutro**) y
      `tarjetasDeOportunidades` (título, número, tipo). → FR-003, FR-004, RZ-2
- [x] T007 [US1] `src/lib/tableroOportunidades.test.ts`: una columna por estado (SC-001);
      tarjeta en la columna de su estado (SC-002); estado nuevo sin color → fallback (US4-1);
      oportunidad sin número no rompe. → SC-001, SC-002
- [x] T008 [US2] `src/components/licitaciones/TableroOportunidades.tsx`: carga
      `/api/licitaciones?pageSize=100` + `/api/licitaciones/estados` (acepta arreglo o
      `{items}`); `onMover` optimista con **rollback** y mensaje propio ante fallo; aviso de
      huérfanas. → FR-002, FR-005, FR-008
- [x] T009 [US1] Cableado: submódulo `{ id: "tablero", title: "Tablero" }` en
      `SUBMODULES.licitaciones` (`WorkspaceContext.tsx`) y `case "tablero"` en
      `LicitacionesTab.tsx`. **"Estados" se conserva.** → FR-011

**Commit 2** — adaptador de Oportunidades + submódulo Tablero. Push.

---

## Phase 5: Persistencia auditada (US2)

- [x] T010 [US2] `PATCH /api/licitaciones/[id]`: registrar `auditLog` **solo** cuando
      `estadoId` cambia respecto al existente (usuario, oportunidad, origen, destino). No se
      crea ruta paralela. → FR-007, US2-6
- [x] T011 [US2] `[id]/route.test.ts` extendido: audita al cambiar de estado (SC-004); **no**
      audita si el estado llega igual (SC-007); el 401 sin sesión ya estaba cubierto (SC-005).
      → FR-007, FR-009

**Commit 3** — auditoría del cambio de estado + tests. Push.

---

## Phase 6: Gates

- [x] T012 Suite completa verde y **no menor** que la línea base (282). → SC-009
- [x] T013 `npx tsc --noEmit` limpio y `npx eslint src/lib src/app/api` sin
      `no-explicit-any`. → SC-010
- [x] T014 `npm run build` compila con el submódulo nuevo.
- [x] T015 Aislamiento: sin tocar 5005/5433/5010/5434, Base Oficial ni RAG. → SC-011

---

## Phase 7: Defecto I-014 — el tablero no cabe (turno D-068)

> Reportado por el CEO sobre la app **ya desplegada**: en ambos tableros la última columna
> quedaba fuera de pantalla. Entra aquí porque el componente es de esta spec y su acta sigue
> abierta. **Es que el tablero se pueda usar, no un rediseño** (eso es SPEC-012).

- [x] T016 Medir la causa antes de tocar: columna `w-72` (288 px) + `gap-4` (16 px) → 4
      columnas piden 1200 px y 5 piden 1504 px; el área real de contenido son **1184 px**
      (`max-w-7xl` − `p-12`). Desbordaba **siempre**, no a cierto ancho. → research D6
- [x] T017 `src/lib/kanban.ts`: `seRepartenLasColumnas` y `plantillaDeColumnas`, con
      `MAX_COLUMNAS_REPARTIDAS = 6`. La decisión de maquetado se saca a función **pura** para
      poder probarla sin navegador. → FR-012
- [x] T018 `src/lib/kanban.test.ts`: reparte con 4 y con 5 (los dos tableros reales), reparte
      hasta el umbral, por encima vuelve al desplazamiento, y la plantilla usa `minmax(0,1fr)`
      para que una palabra larga no estire su columna. → FR-012
- [x] T019 `KanbanBoard.tsx`: rejilla que reparte el ancho en vez de `flex` con ancho fijo;
      `min-w-0` en la columna; sin `pb-4` de barra de desplazamiento (era la franja muerta bajo
      el tablero). → FR-012
- [x] T020 `RootLayoutContent.tsx`: la barra de submódulos envuelve en vez de empujar y el
      botón *Cerrar* no se encoge — con seis submódulos apretaba contra el borde. → FR-013
- [x] T021 `scripts/verify-tableros.mjs`: mide **en la app desplegada**, con navegador real, a
      1280/1440/1920: `scrollWidth` vs `clientWidth`, columnas enteras y desborde de página.
      → SC-012
- [x] T022 **Gate RZ-1 / SC-013**: `KanbanBoard.tsx` sigue importando solo React y
      `@/lib/kanban`.

**Commit** — I-014. Push.

---

## Documentación Spec Kit (D-066, turno D-068)

- [x] T023 `research.md`: las decisiones de la spec con sus alternativas descartadas, incluida
      la medición de I-014 y por qué **no** se tocó el ancho global de `main`.
- [x] T024 `quickstart.md`: cómo verificar la spec paso a paso, contra la app **desplegada**.

---

## Resultado (2026-07-24, turno nocturno D-060)

| Gate | Resultado |
|---|---|
| Suite sin BD ni Ollama | **309 verdes / 42 archivos** (baseline 282/39) |
| `npx tsc --noEmit` | limpio |
| `npx eslint src/lib src/app/api` | **0** `no-explicit-any` |
| `npm run build` | compila |
| Migración | **ninguna** (el tablero no cambia el esquema) |
| Puertos 5005/5433/5010/5434 + RAG | intactos |

**RZ-1 acreditada dos veces**: `KanbanBoard.tsx` importa exclusivamente `@/lib/kanban` y
React; SPEC-008 lo reutiliza sin modificarlo para las fases PM2 (esa es la prueba real de
que el tablero es genérico, y llegó la misma noche).
