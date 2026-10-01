# Tasks · SPEC-794 · Freemium: suma de meses en calendario Bogotá

## Fase 1 · Fix
- [x] T001 `calcularFechaFinTrasPagoFreemium` Bogotá-aware (`src/lib/pagos/freemium-calculos.ts`).

## Fase 2 · Cobertura (RED-first)
- [x] T002 Dos casos de frontera de fin de mes en `src/lib/pagos/freemium-calculos.test.ts` (fechas
      fijas; rojos sin el fix, verdes con él; el primero reproduce la firma del fallo de prod).
- [x] T003 Endurecer el oráculo de T010 en `src/lib/pagos/freemium.service.integration.test.ts`
      (sin `setMonth` nativo; usa el cálculo real → verifica cableado).

## Fase 3 · Gates
- [x] T004 Unit (freemium) + integración (freemium) verdes.
- [ ] T005 tsc + eslint + arch:check + preflight `test:unit` completo.
- [ ] T006 Commit + push + PR (con nota de intermitencia) + reporte al CEO.
