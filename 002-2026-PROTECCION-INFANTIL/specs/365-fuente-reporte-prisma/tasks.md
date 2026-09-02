# Tasks · SPEC-365 · I-263 fuente-reporte prisma no definido

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

## Fase 1 · Diagnóstico (candado 15v5)

- [x] T001 Confirmar en logs de prod el error tragado: `[REPORTES] Error registrando fuente: prisma is not defined`
- [x] T002 Confirmar en fuente que `fuente-reporte.ts` referencia `prisma` global sin importarlo y que `db` es variable muerta
- [x] T003 Confirmar el mecanismo: `prisma.ts` solo setea `globalThis.prisma` fuera de producción

## Fase 2 · Barrido candado 22v5

- [x] T004 Buscar el patrón `?? prisma` sin importar el singleton en TODO `src/` → único archivo: `fuente-reporte.ts`

## Fase 3 · Arreglo

- [x] T005 Borrar `const db = tx ?? prisma;` en `contarHistorialFuente` (93), `detectarRafagaFuente` (130) y `crearFuenteReporte` (205)
- [x] T006 Verificar que no queda ninguna referencia bare a `prisma` ni a `db` en el módulo

## Fase 4 · Pruebas (candado 24v2)

- [x] T007 Regresión en `fuente-reporte.test.ts`: sin `globalThis.prisma` (simula prod), `crearFuenteReporte` persiste la fila
- [x] T008 Verificar que el test caza el bug: reintroducir la línea → falla con `ReferenceError: prisma is not defined`
- [x] T009 Cerrar hueco en `route.test.ts`: un POST exitoso crea la `FuenteReporte` (ipHash + pesoAplicado)

## Fase 5 · Puertas

- [x] T010 `tsc --noEmit` limpio
- [x] T011 `arch:check` / `tokens:check` / `locks:check` / `ratchets:check` verdes
- [x] T012 `lint` sin errores
- [x] T013 `test:unit` verde
