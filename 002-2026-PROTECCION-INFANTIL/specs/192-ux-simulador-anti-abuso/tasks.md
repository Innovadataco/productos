# Tasks: SPEC-192 — UX del simulador anti-abuso (002-PI-086)

**Input**: Design documents from `/specs/192-ux-simulador-anti-abuso/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

## Phase 1 — Reset limpio al cambiar escenario (I-70)

**Goal**: El detalle de la corrida anterior desaparece al cambiar de escenario.

- [ ] T001 [P] [US1] En `src/components/modules/AdminAntiAbusoSimulador.tsx`, resetear `run`, `runId`, `error` y `sugerencia` en el `onChange` del Select de escenario.
- [ ] T002 [US1] Asegurar que `cargarSugerencia` limpie el error previo antes de cargar nueva sugerencia.

## Phase 2 — Bypass seguro de fingerprint rate-limit con secret compartido (I-71)

**Goal**: El simulador no se satura por rate-limit `report_fingerprint`, manteniendo protección para el público.

- [ ] T003 [P] [US2] Añadir `SIMULADOR_ABUSO_SECRET` a `.env.example` y `.env.production.example` (sin valor real, solo referencia).
- [ ] T004 [P] [US2] Crear `src/lib/anti-abuso/simulador-secreto.ts` con `validarSecretoSimulacion(request)` usando `crypto.timingSafeEqual`.
- [ ] T005 [P] [US2] En `src/app/api/reportes/route.ts`, usar `validarSecretoSimulacion(request)` antes de `checkRateLimit("report_fingerprint", ...)`; si true, omitir el rate-limit fingerprint.
- [ ] T006 [US2] En `scripts/simulador-abuso.mjs`, añadir header `"x-simulacion-secret": process.env.SIMULADOR_ABUSO_SECRET` en `enviarReporte`.
- [ ] T007 [P] [US2] En `scripts/simulador-abuso.mjs`, fail-loud si `SIMULADOR_ABUSO_SECRET` no está definido.
- [ ] T008 [P] [US2] Test de integración: secret correcto → no bloquea por fingerprint; sin header → bloquea al 6º; header falso → bloquea al 6º.

## Phase 3 — Dropdown de plataformas reales (I-74)

**Goal**: El campo Plataforma es un Select con plataformas del catálogo.

- [ ] T009 [P] [US3] Reemplazar `<Input>` de Plataforma por `<Select>` en `AdminAntiAbusoSimulador.tsx`.
- [ ] T010 [US3] Cargar `/api/plataformas` al montar el componente.
- [ ] T011 [US3] Implementar fallback hardcoded si la BD está vacía.

## Phase 4 — Priorizar arrays sobre campos únicos (I-75)

**Goal**: El form envía el array cuando tiene contenido, y deshabilita el campo único.

- [ ] T012 [P] [US4] Cambiar orden de prioridad en `iniciar` para `identificadores`/`identificador` e `ips`/`ip`.
- [ ] T013 [US4] Deshabilitar campo único con leyenda cuando el array correspondiente tenga contenido.
- [ ] T014 [P] [US4] Test de componente o integración: payload envía array cuando ambos campos están llenos.

## Phase 5 — Historial con escenario legible y nota (I-76)

**Goal**: El historial muestra label del escenario y la nota interna.

- [ ] T015 [P] [US5] Crear migración aditiva `20260820030000_spec_192_simulador_nota` con `ALTER TABLE simulacion_abuso_runs ADD COLUMN nota VARCHAR(200)`.
- [ ] T016 [US5] Actualizar `prisma/schema.prisma` (`SimulacionAbusoRun.nota String? @db.VarChar(200)`).
- [ ] T017 [US5] Extender `SimulacionAbusoRepository.crear` y `.listar` para soportar `nota`.
- [ ] T018 [US5] Añadir `nota` a `simularAbusoBodySchema` en `src/lib/schemas/index.ts`.
- [ ] T019 [US5] Actualizar `POST /api/admin/anti-abuso/simular/route.ts` para recibir y pasar `nota`.
- [ ] T020 [US5] Añadir input "Nota (interna)" en `AdminAntiAbusoSimulador.tsx`.
- [ ] T021 [US5] Actualizar `AdminAntiAbusoSimuladorHistorial.tsx`: primera columna label del escenario + columna Nota.
- [ ] T022 [P] [US5] Test de integración: crear corrida con nota y verificar que se persiste y se lista.

## Phase 6 — Botón Iniciar re-habilitado (I-77)

**Goal**: Tras finalizar una corrida, el botón vuelve a estar habilitado.

- [ ] T023 [P] [US6] Cambiar condición `disabled` del botón Iniciar a `enviando || (!!runId && !finalizada)`.
- [ ] T024 [US6] Verificar que `finalizada` se calcula correctamente para estados COMPLETADA/FALLIDA/CANCELADA.

## Phase 7 — Gate y cierre

- [ ] T025 [P] Ejecutar `npx tsc --noEmit`, `npm run lint -- --no-cache`, `npm run test:unit`, `npm run test:integration`, `npm run build`, `./scripts/dev-restart.sh`.
- [ ] T026 Actualizar `specs/README.md` con fila de SPEC-192.
- [ ] T027 Crear `specs/192-ux-simulador-anti-abuso/cierre.md` con evidencia de gate.
