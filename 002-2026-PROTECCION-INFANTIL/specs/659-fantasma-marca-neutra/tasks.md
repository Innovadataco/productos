# SPEC-659 / I-403 · Tasks

## Marca (outline/fantasma) → tinta neutra
- [x] T1 · `.btn-ds--fantasma` (`globals.css`): texto + borde → `rgb(var(--tinta-rgb))`; hover → velo de tinta. Docblock: la decisión ATERRIZÓ (ya no «interino»).
- [x] T2 · Re-anclar el candado de render (`acento-primario.render.ts`): medir `--tinta-rgb` y exigir que el TEXTO del Fantasma sea ese valor concreto. Conducta renderizada (Chromium), no regex.
- [x] T3 · Verificado por mutación: devolver el Fantasma a `var(--pi-accent)` (pino interino) → el candado CAE en los 4 temas × 2 modos. Restaurado idéntico.

## Relleno → cielo + tinta oscura
- [x] T4 · `ExpedientesListClient:91` («+ Reportar una situación») y `:191` («Abrir expediente») → `bg-cielo text-acento-ink` (antes `bg-pino text-papel`). Mismo patrón firmado que `MisCitasList`/`IdentificadorBusquedaClient` (ya en cielo en main).

## Nombrado, no tocado
- [ ] T5 · `AQuienProtejoView:41` («Agregar un menor») — mismo defecto de relleno, fuera de la FORMA-I403 → el CEO decide (ficha o fold).
- [ ] T6 · `text-accent` en el padre → I-406 (no tocado; ficha propia).

## Cierre
- [x] T7 · Preflight VERDE: render:check (+ mutación) · tsc 0 · lint 0 · arch · tokens · unidad 406/3113 · specs-discipline 8/8.
- [ ] T8 · PR. Merge por el CEO tras firmas (Diseño re-firma contra el head).

## Verificación en vivo (antes de REALIZADO)
- [ ] T9 · En la app desplegada, rol padre: los botones outline («Editar/Inactivar/Agregar», «Consultar estado») se ven en tinta neutra (no verde); «Abrir expediente»/«Reportar» en cielo con rótulo oscuro. Reportar qué se vio.
