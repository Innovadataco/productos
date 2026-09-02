# Tasks · SPEC-364 · A-72 ráfaga por origen

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

## Fase 1 · Verificación en fuente (candado 15v5 + 22v5)

- [x] T001 Leer `reporte-processing/rafagas.ts`, `index.ts` y `anti-abuso/fuente-reporte.ts` en fuente
- [x] T002 Confirmar que `crearFuenteReporte` corre ANTES de encolar (`api/reportes/route.ts:230`)
- [x] T003 Enumerar callsites de `detectarRafaga` (por nick): único consumidor = `index.ts:107`
- [x] T004 Confirmar que `finalizacion.ts` solo recibe el booleano `esRafaga` (sin colisión con A-71)

## Fase 2 · Ráfaga por origen

- [x] T005 `detectarRafaga` lee el origen del reporte actual (`FuenteReporte.ipHash`/`fingerprintHash`)
- [x] T006 Agrupar historial-previo y ventana por ese origen (mismo predicado que `detectarRafagaFuente`)
- [x] T007 Camino "sin origen" → no marcar ráfaga (no penalizar corroboración)
- [x] T008 Ventana por `findMany` de ids + `updateMany` por `id in` (Prisma no filtra relación en updateMany)
- [x] T009 Conservar parámetros, regla de historial-previo, marcado y paso "guardas" del expediente

## Fase 3 · Pruebas (candado 24v2)

- [x] T010 [P] `reporte-processing/rafagas.test.ts` (4): mismo/distinto origen, sin origen, historial previo
- [x] T011 Actualizar `api/reportes/procesar/route.test.ts`: sembrar origen en los casos de ráfaga existentes
- [x] T012 [P] Nuevo caso: 3 reportes del mismo nick, orígenes distintos → NO ráfaga (corroboración)

## Fase 4 · Puertas

- [x] T013 `tsc --noEmit` limpio
- [x] T014 `arch:check` / `tokens:check` / `locks:check` / `ratchets:check` verdes
- [x] T015 `lint` sin errores
- [x] T016 `test:unit` verde
