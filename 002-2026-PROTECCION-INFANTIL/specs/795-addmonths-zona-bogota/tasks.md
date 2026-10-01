# Tasks · SPEC-795

## Fase 0 — MEDIR (hecha, antes de tocar código)
- [x] T001 Base + reproducción del instante que rompe cada uno de los 4 sitios (código corriendo, TZ=UTC).
- [x] T002 Veredicto por sitio (los 4 MAL) + dirección (pierde/gana) + auditoría de oráculos (tautológico/mitad-de-mes).
- [x] T003 Reporte al CEO; veredicto: arreglar los 4 en 2 PRs por clase, sitio 4 primero.

## PR 1 — sitio 4 (desborde) · ESTE PR
- [x] T010 `periodo.ts calcularFinServicio`: Bogotá-aware addMonths (clampa, no desborda).
- [x] T011 `vigencia-colegio.ts calcularFinDesdeDuracionPlan` (MES_2/MES_3): idem.
- [x] T012 Candado frontera `periodo.test.ts` (literales + control positivo de desborde).
- [x] T013 `vigencia-colegio.service.test.ts`: oráculo reescrito a literal + frontera MES_2/MES_3.
- [x] T014 Gates: tsc 0 · lint 0 · test:unit 3342 · periodo 14/14 · vigencia-colegio 6/6 · colegios/route 6/6 · arch:check VERDE.
- [x] T015 Mapa de llamadores de `ahoraBogota()` al CEO (para decidir el sub-defecto (b)).

## PR 2 — sitios 1, 2, 3 (zona) · DESPUÉS del merge de PR 1
- [ ] T020 `referido.service.ts:276` método Bogotá-aware + candado frontera (literal).
- [ ] T021 `admin-autorizar-solicitud.service.ts:146` + `admin-activacion-manual.service.ts:176`: base `fechaPagoReal ?? new Date()` + método completo; retirar `ahoraBogota()` local muerto.
- [ ] T022 Reescribir los oráculos tautológicos existentes de esos tests a literales de frontera.
- [ ] T023 Gates + cierre.
