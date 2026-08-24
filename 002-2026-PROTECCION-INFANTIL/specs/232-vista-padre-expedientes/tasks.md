# Tasks — SPEC-232 · Vista padre expedientes

## Fase 1: Helpers y componentes base

- [ ] T001 [P] Crear `src/lib/padre/expediente-ui.ts` (helpers: días desde última actividad Bogotá, labels de estado, badge de score).
- [ ] T002 [P] Crear `src/components/modules/padre/ExpedienteCard.tsx` (card de lista).
- [ ] T003 [P] Crear `src/components/modules/padre/AutoSuggestExpediente.tsx` (card N3).

## Fase 2: Lista de expedientes

- [ ] T004 Crear `src/components/modules/padre/ExpedientesListClient.tsx` (filtros + lista).
- [ ] T005 Reemplazar `/dashboard/padre/expedientes/page.tsx` por vista real (server component con fetch DAL).

## Fase 3: Detalle de expediente

- [ ] T006 Crear `src/components/modules/padre/TimelineEventos.tsx` (cronología).
- [ ] T007 Crear `src/components/modules/padre/ExpedienteDetalleClient.tsx` (cabecera + timeline + formulario).
- [ ] T008 Crear `/dashboard/padre/expedientes/[id]/page.tsx` (server component con fetch DAL).

## Fase 4: Agregar evento

- [ ] T009 Crear `src/components/modules/padre/AgregarEventoForm.tsx` (formulario cliente).
- [ ] T010 Crear `POST /api/padre/expedientes/[id]/eventos/route.ts` (endpoint con validación y DAL).
- [ ] T011 Integrar formulario en detalle con refresco de datos.

## Fase 5: Tests

- [ ] T012 [P] Tests de componente para `ExpedienteCard` y `AutoSuggestExpediente`.
- [ ] T013 Tests de integración para endpoint `POST /api/padre/expedientes/[id]/eventos`.

## Fase 6: Gate local

- [ ] T014 `npx tsc --noEmit`
- [ ] T015 `npm run lint -- --no-cache`
- [ ] T016 `npm run arch:check`
- [ ] T017 `npm run test:unit`
- [ ] T018 `npm run test:integration`
- [ ] T019 `npm run build`
- [ ] T020 Humo con `next start`

## Fase 7: Push

- [ ] T021 Rebase + diff pre-push (solo archivos SPEC-232)
- [ ] T022 `git push --force-with-lease`
- [ ] T023 Crear PR y reportar REALIZADO
