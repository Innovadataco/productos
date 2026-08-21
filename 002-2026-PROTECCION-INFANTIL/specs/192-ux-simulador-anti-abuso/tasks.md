# Tasks: SPEC-192 — UX del simulador anti-abuso (002-PI-086)

**Input**: Design documents from `/specs/192-ux-simulador-anti-abuso/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

## Phase 1 — Reset limpio al cambiar escenario (I-70)

**Goal**: El detalle de la corrida anterior desaparece al cambiar de escenario.

- [ ] T001 [P] [US1] En `src/components/modules/AdminAntiAbusoSimulador.tsx`, resetear `run`, `runId`, `error` y `sugerencia` en el `onChange` del Select de escenario.
- [ ] T002 [US1] Asegurar que `cargarSugerencia` limpie el error previo antes de cargar nueva sugerencia.

## Phase 2 — Bypass seguro de fingerprint rate-limit (I-71)

**Goal**: El simulador no se satura por rate-limit `report_fingerprint`, manteniendo protección para el público.

- [ ] T003 [P] [US2] En `src/app/api/reportes/route.ts`, detectar header `x-simulacion: true` + sesión ADMIN antes de `checkRateLimit` de `report_fingerprint`.
- [ ] T004 [US2] En `scripts/simulador-abuso.mjs`, añadir header `"x-simulacion": "true"` en `enviarReporte`.
- [ ] T005 [P] [US2] Test de integración: request con header + ADMIN no incrementa `report_fingerprint`; request público sí.

## Phase 3 — Dropdown de plataformas reales (I-74)

**Goal**: El campo Plataforma es un Select con plataformas del catálogo.

- [ ] T006 [P] [US3] Reemplazar `<Input>` de Plataforma por `<Select>` en `AdminAntiAbusoSimulador.tsx`.
- [ ] T007 [US3] Cargar `/api/plataformas` al montar el componente.
- [ ] T008 [US3] Implementar fallback hardcoded si la BD está vacía.

## Phase 4 — Priorizar arrays sobre campos únicos (I-75)

**Goal**: El form envía el array cuando tiene contenido, y deshabilita el campo único.

- [ ] T009 [P] [US4] Cambiar orden de prioridad en `iniciar` para `identificadores`/`identificador` e `ips`/`ip`.
- [ ] T010 [US4] Deshabilitar campo único con leyenda cuando el array correspondiente tenga contenido.
- [ ] T011 [P] [US4] Test de componente o integración: payload envía array cuando ambos campos están llenos.

## Phase 5 — Historial con escenario legible y nota (I-76)

**Goal**: El historial muestra label del escenario y la nota interna.

- [ ] T012 [P] [US5] Crear migración aditiva `20260820030000_spec_192_simulador_nota` con `ALTER TABLE simulacion_abuso_runs ADD COLUMN nota VARCHAR(200)`.
- [ ] T013 [US5] Actualizar `prisma/schema.prisma` (`SimulacionAbusoRun.nota String? @db.VarChar(200)`).
- [ ] T014 [US5] Extender `SimulacionAbusoRepository.crear` y `.listar` para soportar `nota`.
- [ ] T015 [US5] Añadir `nota` a `simularAbusoBodySchema` en `src/lib/schemas/index.ts`.
- [ ] T016 [US5] Actualizar `POST /api/admin/anti-abuso/simular/route.ts` para recibir y pasar `nota`.
- [ ] T017 [US5] Añadir input "Nota (interna)" en `AdminAntiAbusoSimulador.tsx`.
- [ ] T018 [US5] Actualizar `AdminAntiAbusoSimuladorHistorial.tsx`: primera columna label del escenario + columna Nota.
- [ ] T019 [P] [US5] Test de integración: crear corrida con nota y verificar que se persiste y se lista.

## Phase 6 — Botón Iniciar re-habilitado (I-77)

**Goal**: Tras finalizar una corrida, el botón vuelve a estar habilitado.

- [ ] T020 [P] [US6] Cambiar condición `disabled` del botón Iniciar a `enviando || (!!runId && !finalizada)`.
- [ ] T021 [US6] Verificar que `finalizada` se calcula correctamente para estados COMPLETADA/FALLIDA/CANCELADA.

## Phase 7 — Gate y cierre

- [ ] T022 [P] Ejecutar `npx tsc --noEmit`, `npm run lint -- --no-cache`, `npm run test:unit`, `npm run test:integration`, `npm run build`, `./scripts/dev-restart.sh`.
- [ ] T023 Actualizar `specs/README.md` con fila de SPEC-192.
- [ ] T024 Crear `specs/192-ux-simulador-anti-abuso/cierre.md` con evidencia de gate.
