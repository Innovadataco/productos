# Tasks — SPEC-111: D-28 — la rúbrica como motor predeterminado

**Input**: plan.md, spec.md, research.md, data-model.md, quickstart.md de
`/specs/111-motor-rubrica-default/` | **Branch**: `feature/001-scaffolding`

> Nota de flujo: `tasks.md` se genera en compuerta para cumplir el gate de la SPEC-107
> (toda spec nueva exige plan.md + tasks.md). `speckit-implement` NO se corre hasta la
> aprobación de ZEUS (compuerta §4).

## Fase 1: US1/US2 — encendido de verdad

- [x] T001 [US1] `prisma/seed.ts`: `ia.rubrica.enabled` se siembra con valor `true` (base nueva).
- [x] T002 [US2] Script idempotente `scripts/aplicar-rubrica-default-111.ts`: lee el parámetro; `true` → no-op con log; si no → fija `true` con evidencia. Sin ejecutar en prod (lote del CEO).
- [x] T003 [US1] Test de efecto (`src/app/api/reportes/procesar/...test.ts`): `enabled=true` → el reporte procesado tiene filas en `ClasificacionRubricaVoto`; `enabled=false` → no las tiene.

## Fase 2: US3 — reversión

- [x] T004 [US3] `docs/runbook.md`: sección de reversión en caliente a legacy (parámetro a `false`, efecto inmediato, verificación por ausencia de votos de rúbrica).

## Fase 3: Cierre

- [x] T005 Verificación de restricciones: diff sin tocar textos de preguntas, terna ni umbral 60%.
- [x] T006 Gate: `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build`.
- [x] T007 `cierre.md` + `specs/README.md` (111 → estado final) + commits + push. **NO desplegar** (lo autoriza el CEO por lote).

## Dependencias

- T001/T002/T004 en cualquier orden; T003 depende de T001; T005–T007 al final.
