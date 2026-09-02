# Tasks · SPEC-366 · A-71 duplicado hereda del original

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

## Fase 1 · Verificación en fuente (candado 15v5 + 22v5)

- [x] T001 Leer `duplicados.ts` (dónde se marca DUPLICADO), el enum EstadoReporte y `reporteOrigenId`
- [x] T002 Enumerar la exclusión de señal por estado: predicado único `whereReporteAprobado`/`esReporteAprobado` (~13 consumidores) + raw SQL `embedding.ts:116,162`
- [x] T003 Confirmar que el duplicado es SIEMPRE anónimo (`duplicados.ts` corta la dedup para no anónimos) → solo `seguimiento()` sirve duplicados
- [x] T004 Confirmar que con opción (a) el estado sigue DUPLICADO → 0 callsites de exclusión a migrar

## Fase 2 · Resolución read-time (opción a)

- [x] T005 `SELECT_SEGUIMIENTO` (reporte.ts): agregar `reporteOrigenId` + `reporteOrigen{estado,clasificacion}`
- [x] T006 `reporte-query.ts seguimiento()`: estado y clasificación EFECTIVOS del original si es duplicado; `estadoInterno` sigue crudo
- [x] T007 Privacidad: el DTO expone solo categoría/labels; el texto del original nunca sale

## Fase 3 · Pruebas (candado 24v2)

- [x] T008 [P] Seguimiento: duplicado de original CLASIFICADO → "Procesado" + categoría del original; estadoInterno DUPLICADO
- [x] T009 [P] Seguimiento: duplicado de original PROCESANDO → estado honesto "En proceso", sin clasificación
- [x] T010 **Invariante**: un reporte con cuenta idéntico a otro NUNCA queda DUPLICADO (blinda el alcance mínimo)

## Fase 4 · Puertas

- [x] T011 `tsc --noEmit` limpio
- [x] T012 `arch:check` / `tokens:check` / `locks:check` / `ratchets:check` verdes
- [x] T013 `lint` sin errores
- [x] T014 `test:unit` verde
