# SPEC-659 / I-403 · Tasks

## Marca (outline/fantasma) → tinta neutra
- [x] T1 · `.btn-ds--fantasma` (`globals.css`): texto + borde → `rgb(var(--tinta-rgb))`; hover → velo de tinta. Docblock: la decisión ATERRIZÓ (ya no «interino»).
- [x] T2 · Re-anclar el candado de render (`acento-primario.render.ts`): medir `--tinta-rgb` y exigir que el TEXTO del Fantasma sea ese valor concreto. Conducta renderizada (Chromium), no regex.
- [x] T3 · Verificado por mutación: devolver el Fantasma a `var(--pi-accent)` (pino interino) → el candado CAE en los 4 temas × 2 modos. Restaurado idéntico.

## Relleno → cielo + tinta oscura
- [x] T4 · `ExpedientesListClient:91,191` y `AQuienProtejoView:41` («Agregar un menor», folddeado por VEREDICTO CEO — estado vacío de día-uno) → `bg-cielo text-acento-ink` (antes `bg-pino` a mano). Mismo patrón firmado que `MisCitasList`/`IdentificadorBusquedaClient` (ya en cielo en main).
- [x] T4-bis · `PanelAgregar:135,152` (seleccionado de toggles, decisión de Diseño) → `border-cielo bg-cielo/10 text-estado-cielo` + hover `border-cielo/40` (tinte, no sólido).
- [x] T4-ter · CANDADO del relleno/acento de CONDUCTA (no lista): `acento-relleno-sin-pino-crudo.candado.test.ts` — ningún interactivo del padre con `bg-pino`/`border-pino` sólido, ESTÁTICO o CONDICIONAL. Verificado por mutación (ambos). Excluye semántico (opacidad/variable), `focus:`/`hover:` (SPEC-662) y `text-pino` (I-406).

## Nombrado, no tocado
- [ ] T5 · `PanelAgregar` focos de input (`:115,166,185,200`) en `focus:border-pino` → carril del foco (SPEC-662); `PanelAgregar:217` botón `text-pino` → I-406. Nombrados para Diseño.
- [ ] T6 · `text-accent` en el padre → I-406 (no tocado; ficha propia).

## Cierre
- [x] T7 · Preflight VERDE: render:check (+ mutación) · tsc 0 · lint 0 · arch · tokens · unidad 406/3113 · specs-discipline 8/8.
- [ ] T8 · PR. Merge por el CEO tras firmas (Diseño re-firma contra el head).

## Verificación en vivo (antes de REALIZADO)
- [ ] T9 · En la app desplegada, rol padre: los botones outline («Editar/Inactivar/Agregar», «Consultar estado») se ven en tinta neutra (no verde); «Abrir expediente»/«Reportar» en cielo con rótulo oscuro. Reportar qué se vio.
