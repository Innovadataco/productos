# TASKS — SPEC-122 (bloque R4)

## Fase 1 — Capa central (sin tocar rutas)

- [x] T001 Enumerar con grep las 39 copias manuales y sus formas (ver plan.md)
- [x] T002 Crear `src/lib/reportes-acceso.ts` (`whereReporteVigente`, `whereReporteEnEstado`, `whereReporteEnEstados`, reexport de `whereReporteAprobado`)
- [x] T003 [P] Test de equivalencia `src/lib/reportes-acceso.test.ts` (20 casos, verde)
- [x] T004 Commit pieza central → `6652d4ae`

## Fase 2 — Rutas públicas

- [x] T005 Migrar `src/app/api/estadisticas-publicas/route.ts` (forma F anidada) + test verde
- [x] T006 [P] Migrar `src/app/api/consulta/detalle/route.ts` (forma D) + test verde
- [x] T007 Commit zona pública → `62e0fe48`

## Fase 3 — Padre

- [x] T008 Migrar `src/app/api/reportes/mis-reportes/route.ts` (forma A) + test verde → commit `eb786ccf`

## Fase 4 — Admin

- [x] T009 Migrar `src/app/api/admin/estadisticas/route.ts` (13 copias: A/C/D/F) + test verde
- [x] T010 [P] Migrar `src/app/api/admin/estadisticas/clasificacion/route.ts` (3 copias B) + test verde → commit `f0b8452a`
- [x] T011 Migrar `src/app/api/admin/operadores/route.ts` (2 copias) + test verde
- [x] T012 [P] Migrar `src/app/api/admin/operadores/asignacion/route.ts` (2 copias B) + test verde
- [x] T013 [P] Migrar `src/app/api/admin/reportes-revision/[id]/reasignar/route.ts` (1 copia B)
- [x] T014 [P] Migrar `src/app/api/admin/padres/route.ts` (1 copia A) + test verde → commit `9dc3974a`
- [x] T015 Migrar `src/app/api/admin/spam/pendientes/route.ts` (A+OR) + test verde
- [x] T016 [P] Migrar `src/app/api/admin/reportes-revision/route.ts` (forma E) + test verde
- [x] T017 [P] Migrar `src/app/api/admin/comite/apelaciones/[id]/resolver/route.ts` (forma A) + test verde → commit `476a9e01`

## Fase 5 — Cierre

- [x] T018 Artefactos `specs/122-capa-datos-reportes/` (spec.md, plan.md, tasks.md, cierre.md)
- [x] T019 Gate bajo candado: tsc + lint + tests tocados + build + suite completa
- [ ] T020 (deuda) Migrar `rafagas.ts` cuando el frente del motor lo permita
- [ ] T021 (deuda) Migrar las 8 copias de `src/lib/**` en su frente correspondiente
