# Tasks: SPEC-185 — Historial y sugerencias del simulador de abusos

**Input**: Design documents from `/specs/185-simulador-historial/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

## Phase 1 — Fix I-64 + backfill

**Goal**: Corregir el bug que marca corridas exitosas como FALLIDA.

- [ ] T001 [P] [US5] Quitar parámetro `fechaFin` de `SimulacionAbusoRepository.actualizarEstado` en `src/lib/dal/repositories/simulacion-abuso.ts`
- [ ] T002 [US5] Actualizar `src/lib/anti-abuso/simulador.ts::cancelarSimulacionAbuso` para no pasar `new Date()`
- [ ] T003 [US5] Actualizar `scripts/simulador-abuso.mjs` para no pasar `fechaFin` en `actualizarEstado`
- [ ] T004 [US5] Crear script de backfill `scripts/reparar-simulaciones-fechafin.mjs`
- [ ] T005 [P] [US5] Ampliar `src/lib/anti-abuso/simulador.test.ts` para verificar estado `COMPLETADA` al finalizar

## Phase 2 — Sugerencias frescas por escenario

**Goal**: Evitar colisiones de IP entre escenarios.

- [ ] T006 [P] [US2] Extender `SimulacionAbusoRepository` con `listar`, `buscarIpsUsadas` en `src/lib/dal/repositories/simulacion-abuso.ts`
- [ ] T007 [P] [US2] Extender `RateLimitRepository` con `buscarIpsBloqueadasRecientemente` en `src/lib/dal/repositories/rate-limit.ts`
- [ ] T008 [US2] Crear `src/lib/anti-abuso/sugerencias-simulador.ts` con lógica por escenario
- [ ] T009 [US2] Crear endpoint `GET /api/admin/anti-abuso/simular/sugerencias/route.ts`
- [ ] T010 [P] [US2] Test de integración: dos sugerencias seguidas devuelven IPs distintas
- [ ] T011 [US2] Añadir parámetro `simulacion.spam.usuario_id` en `prisma/seed.ts`

## Phase 3 — Listado paginado de corridas

**Goal**: Permitir al admin ver historial de simulaciones.

- [ ] T012 [US1] Implementar `GET /api/admin/anti-abuso/simular/route.ts` (listado paginado + filtros)
- [ ] T013 [P] [US1] Test de integración del listado con paginación y filtros

## Phase 4 — Detalle de corrida en criollo

**Goal**: Explicar qué se probó y cuál fue el resultado.

- [ ] T014 [US4] Crear `src/lib/anti-abuso/descripcion-escenario.ts`
- [ ] T015 [US4] Extender `GET /api/admin/anti-abuso/simular/[id]/route.ts` con descripción, detalles y percentiles
- [ ] T016 [US4] Actualizar `scripts/simulador-abuso.mjs` para guardar `detalles`, `latenciaP50Ms`, `latenciaP95Ms`
- [ ] T017 [P] [US4] Test que verifica que `resultadosJson` incluye detalles y percentiles

## Phase 5 — Frontend: sub-tabs y autofill

**Goal**: Mejorar UX del simulador.

- [ ] T018 [US3] Refactorizar `src/components/modules/AdminAntiAbusoSimulador.tsx` con sub-tabs "Nueva corrida" / "Historial"
- [ ] T019 [US3] Implementar autofill al cambiar escenario y botón "Refrescar sugerencia"
- [ ] T020 [US1] Implementar tabla de historial con filtros y paginación
- [ ] T021 [US4] Crear componente modal `src/components/modules/SimulacionAbusoDetalleModal.tsx`
- [ ] T022 [US4] Implementar botón "Repetir con nueva sugerencia" en el modal

## Phase 6 — Gate y cierre

- [ ] T023 [P] Ejecutar `npx tsc --noEmit`, `npm run lint -- --no-cache`, `npm run test:unit`, `npm run test:integration`, `npm run build`, `./scripts/dev-restart.sh`
- [ ] T024 Actualizar `specs/README.md` con fila de SPEC-185
- [ ] T025 Crear `specs/185-simulador-historial/cierre.md` con evidencia de gate
