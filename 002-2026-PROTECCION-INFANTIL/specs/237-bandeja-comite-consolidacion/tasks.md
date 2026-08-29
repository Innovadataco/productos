# Tasks: SPEC-237 — Bandeja comité CONSOLIDACION + vista + aprobación multi-miembro

**Branch**: `work/002-pi-padre-lote-core` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Fase 1 — Migración, seed y repositorio base

- [x] **T001 [P1]** Crear migración aditiva `prisma/migrations/20260822010000_spec_237_comite_consolidacion/migration.sql` con:
  - Valor `CONSOLIDACION_EXPEDIENTE` en el enum/campo de tipo de tarea de bandeja.
  - Campos `estado`, `correccionesJson`, `aprobadoPorMiembrosJson`, `guiaAccionCategoriaIdPrincipal`, `motivoDevolucion` en `InformeConsolidado` (Timestamptz(6)).
  - Valores `INFORME_CONSOLIDADO_APROBADO`, `INFORME_CONSOLIDADO_CORREGIDO`, `INFORME_CONSOLIDADO_DEVUELTO` en `AccionAudit`.
- [x] **T002 [P1]** Añadir parámetros `padre.comite.miembros_minimos_aprobacion` y `padre.comite.sla_horas_consolidacion` en `prisma/seed.ts` (idempotente, categoría PADRE).
- [x] **T003 [P1]** Crear/extender `src/lib/dal/repositories/informe-consolidado.ts` con `listarPendientesConsolidacion`, `aprobarPorMiembro`, `corregirTexto`, `devolverConMotivo`.
- [x] **T004 [P1]** Crear `src/lib/comite/sla.ts` con helpers `calcularSlaEnBogota` y `colorIndicadorSla` usando `date-fns-tz`.
- [x] **T005 [P2]** Tests unitarios para helpers de SLA/color y tests de integración para `InformeConsolidadoRepository`.

## Fase 2 — Backend: listado, detalle y mutaciones

- [x] **T006 [P1]** Crear `src/app/api/admin/comite/consolidacion/route.ts` (`GET`, paginado, filtrable por tipo).
- [x] **T007 [P1]** Crear `src/app/api/admin/comite/consolidacion/[expedienteId]/route.ts` (`GET`, ensambla informe + expediente + patrones + señal comunitaria + guías disponibles).
- [x] **T008 [P1]** Crear `src/app/api/admin/comite/consolidacion/[expedienteId]/aprobar/route.ts` (`POST`, solo `COMITE_VALIDACION`, llama `aprobarPorMiembro` y transiciona si aplica).
- [x] **T009 [P1]** Crear `src/app/api/admin/comite/consolidacion/[expedienteId]/corregir/route.ts` (`POST`, Zod, solo `COMITE_VALIDACION`).
- [x] **T010 [P1]** Crear `src/app/api/admin/comite/consolidacion/[expedienteId]/devolver/route.ts` (`POST`, motivo obligatorio, solo `COMITE_VALIDACION`).
- [x] **T011 [P1]** Añadir schemas Zod en `src/lib/schemas/index.ts` para aprobar, corregir y devolver.
- [x] **T012 [P2]** Tests de integración para los 5 endpoints.

## Fase 3 — Bandeja enriquecida (UI)

- [x] **T013 [P1]** Modificar `src/components/modules/ComiteBandeja.tsx` para soportar filtro por tipo (`TODOS`, `REVISION_REPORTE`, `CONSOLIDACION_EXPEDIENTE`).
- [x] **T014 [P1]** Añadir badge/icono distintivo por tipo de tarea.
- [x] **T015 [P1]** Añadir columna SLA con indicador de color en zona Bogotá.
- [x] **T016 [P1]** Linkear filas de consolidación a `/dashboard/admin/comite/consolidacion/[expedienteId]`.
- [x] **T017 [P2]** Tests de componente para filtro, badge y SLA.

## Fase 4 — Vista de consolidación (UI)

- [x] **T018 [P1]** Crear `src/app/dashboard/admin/comite/consolidacion/[expedienteId]/page.tsx` (Server Component, verifica rol).
- [x] **T019 [P1]** Crear `src/components/modules/comite/consolidacion/ConsolidacionHeader.tsx`.
- [x] **T020 [P1]** Crear `src/components/modules/comite/consolidacion/ConsolidacionTimeline.tsx`.
- [x] **T021 [P1]** Crear `src/components/modules/comite/consolidacion/ConsolidacionResumenEditor.tsx` (editable solo `COMITE_VALIDACION`).
- [x] **T022 [P1]** Crear `src/components/modules/comite/consolidacion/ConsolidacionPatronesN1.tsx`.
- [x] **T023 [P1]** Crear `src/components/modules/comite/consolidacion/ConsolidacionSenalComunitaria.tsx`.
- [x] **T024 [P1]** Crear `src/components/modules/comite/consolidacion/ConsolidacionGuiaAccion.tsx`.
- [x] **T025 [P1]** Crear `src/components/modules/comite/consolidacion/ConsolidacionAcciones.tsx` (Aprobar/Corregir/Devolver, visibles solo `COMITE_VALIDACION`).
- [x] **T026 [P2]** Tests de componente para render condicional por rol y validación de devolución.

## Fase 5 — Integración, eventos y control de acceso

- [x] **T027 [P1]** Integrar `aplicarTransicion(expedienteId, 'EN_APROBACION_PADRE')` desde SPEC-236 en el flujo de aprobación.
- [x] **T028 [P1]** Publicar evento `expediente.comite.aprobo` al alcanzar el umbral.
- [x] **T029 [P1]** Asegurar que `ADMIN` vea UI en modo lectura y reciba 403 en endpoints de mutación.
- [x] **T030 [P1]** Asegurar que `PARENT` no acceda a `/dashboard/admin/comite/*`.
- [x] **T031 [P2]** Tests de integración de control de acceso (COMITE/ADMIN/PARENT).

## Fase 6 — Tests específicos del instructivo

- [x] **T032 [P2]** Test: filtro por tipo devuelve solo tareas del tipo seleccionado.
- [x] **T033 [P2]** Test: aprobación multi-miembro (1/2 no transiciona, 2/2 transiciona, 3/2 es ignorada).
- [x] **T034 [P2]** Test: corrección añade snapshot a `correccionesJson` sin borrar anteriores.
- [x] **T035 [P2]** Test: devolución sin motivo es rechazada; con motivo cambia estado a `DEVUELTO`.
- [x] **T036 [P2]** Test: SLA se calcula y muestra en zona `America/Bogota` con colores pino/ambar/rubi.
- [x] **T037 [P2]** Test: transición a `EN_APROBACION_PADRE` ocurre exactamente al alcanzar `miembros_minimos_aprobacion`.
- [x] **T038 [P2]** Test: control de rol estricto (COMITE muta, ADMIN lee, PARENT no accede).

> Nota implementación (ODIN, 2026-08-24): T001 adaptada — `TipoRevisionComite.CONSOLIDACION_EXPEDIENTE` y los campos `estadoAprobacion/correccionesJson/aprobadoPorMiembrosJson/guiaAccionCategoriaIdPrincipal` ya existían (SPEC-234); la migración `20260824082000_spec_237_comite_consolidacion` solo añade `motivoDevolucion`, el índice por `estadoAprobacion` y los 3 valores de `AccionAudit`. T039 queda para el coordinador (docs/architecture no se toca desde subagentes). T040/T042: gate full y quickstart los corre el coordinador (BD compartida).

## Fase 7 — Cierre

- [ ] **T039 [P1]** Regenerar docs de arquitectura (`npm run arch:generate` / `npm run arch:check`) si el cambio toca schema, proxy o navegación.
- [ ] **T040 [P1]** Gate local completo: `npx tsc --noEmit`, `npm run lint -- --no-cache`, `npm run test`, `npm run build`, `./scripts/dev-restart.sh`.
- [x] **T041 [P1]** Revisar conflictos con specs del lote padre (235, 236, 238, 239) en `prisma/schema.prisma` y `prisma/seed.ts`; rebasar conservando cambios aditivos.
- [ ] **T042 [P1]** Validar `quickstart.md` sección por sección en ambiente local.
