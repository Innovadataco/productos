# Tasks · SPEC-604 — Modelo EXPEDIENTE (cimientos)

**Status**: IMPLEMENTADO · Convención: `TNNN [P]` · orden por dependencias.

## Fase 1 — Backend: el expediente nace solo

- [x] T001 Crear `src/lib/dal/services/expediente-automatico.ts` (`asegurarExpedienteParaReporte`: anónimo → null; último CERRADO → ciclo nuevo; evento idempotente por `reporteId`). (FR-005)
- [x] T002 Integrar en `src/app/api/reportes/route.ts`: llamada dentro de la UoW tras la escritura de la cadena, solo con `usuarioId`; respuesta 201 del padre trae `expedienteId`; comentarios SPEC-340 → SPEC-604. (FR-005, FR-007)
- [x] T003 Integrar en `src/app/api/reportes/[id]/evento/route.ts`: el evento hereda `hijoId` del principal y se suma al expediente (backfill de cadenas legadas incluido). (FR-006)
- [x] T004 Barrido de comentarios del modelo viejo: `src/lib/dal/services/reporte-creation.ts`, `src/app/api/padre/expedientes/route.ts` (rol backfill legado), `src/lib/dal/services/cadenas-padre.ts`, `prisma/schema.prisma` (`origenCreacion`, solo comentario — sin migración).

## Fase 2 — Frontend: paso 0, edad automática y Mis reportes

- [x] T005 [P] Reescribir `src/components/modules/ReporteStepHijo.tsx`: chips con edad derivada («N años»/«sin edad»), opción «+ Nuevo hijo (solo nombre)» con input, props `modoNuevo/nuevoNombre/onElegirNuevo/onNuevoNombre`. (FR-001)
- [x] T006 `src/components/modules/ReporteWizard.tsx`: `hijoNuevoNombre` en el estado, `modoNuevoHijo` (forzado sin fichas), `elegirHijo` deriva la edad, validación del paso 0 (ficha o nombre), alta de la ficha AL ENVIAR antes del reporte, `ocultarEdad` y `hijoNombre` hacia los pasos. (FR-001, FR-002, FR-003)
- [x] T007 [P] `src/components/modules/ReporteStepDetalle.tsx`: prop `ocultarEdad` (default false — anónimo intacto). (FR-003, FR-009)
- [x] T008 [P] `src/components/modules/ReporteStepConfirmar.tsx`: fila «Para quién es» y nota «se crea o se actualiza el expediente de …» (solo autenticado).
- [x] T009 `src/components/modules/padre/MisReportesCadenas.tsx`: fuera el botón «Crear expediente» (estado, callback y rama); queda «Ver expediente». (FR-007)

## Fase 3 — API hijos: alta «solo nombre»

- [x] T010 `src/app/api/padre/hijos/route.ts`: `apellidos` opcional en `createSchema` (deroga parcialmente SPEC-339 FR-019, documentado); `src/lib/dal/services/hijos/tipos.ts` y `hijos.ts` (`apellidos ?? ""`). (FR-002)

## Fase 4 — Tests

- [x] T011 Reescribir `src/app/api/reportes/route-expediente-vinculacion.test.ts` (5 tests: nace en el alta, se suma el 2º/3º, oferta sin escribir, anónimo sin expediente). (FR-005, FR-007, FR-009)
- [x] T012 Actualizar `src/app/api/padre/reportes/cadenas/route.test.ts`: T016 ×2 al modelo nuevo (auto + idempotencia del legado; «Ver» desde el evento 1) y herencia de `hijoId` en «Agregar otro evento». (FR-006, FR-007)
- [x] T013 [P] Actualizar `src/app/api/padre/hijos/route.test.ts`: alta «solo nombre» → 201 con `apellidos = ""`. (FR-002)
- [x] T014 [P] `src/components/modules/ReporteWizard.test.tsx` (+5): selector solo activos con edad, edad oculta y derivada al enviar, alta «solo nombre» al enviar (orden hijos→reporte), bloqueo de avance sin elección, regresión anónimo (sin paso 0, campo de edad presente). (FR-001, FR-002, FR-003, FR-009)

## Fase 5 — Artefactos y gate

- [x] T015 Artefactos `specs/604-expediente-unico/` (spec.md con «Impacto en arquitectura:» — FR-008, plan.md, tasks.md, quickstart.md, checklists/requirements.md) + línea en `specs/README.md` (regenerada con `scripts/specs/generar-readme.ts`).
- [x] T016 Gate: `npx tsc --noEmit` · `npm run lint` · `npm run test` (+ `test:unit` del wizard) · `npm run build` · `npm run arch:check` (VERDE sin regenerar: la línea base no cambia).
