# Tasks: SPEC-131 — Visibilidad pública solo por reportes aprobados

**Input**: Design documents from `specs/131-visibilidad-solo-aprobados/` (aprobados por
ZEUS en compuerta §4 con condiciones O-1..O-4)

## Phase 1: Datos

- [x] T001 Migración ADITIVA: `reportesAprobados` + `autenticadosAprobados` en
  `IdentificadorReportado`, con backfill SQL DENTRO de la migración (O-1)
- [x] T002 Regenerar `docs/architecture/01-modelo-datos.md` y dejar `arch:check` verde (O-3)

## Phase 2: Escritor único y decisión

- [x] T003 `recalcularYGuardarScore` escribe los contadores aprobados (O-2)
- [x] T004 `visibility.ts` decide con aprobados: umbral + ratio sobre base aprobada;
  `ocultoPorComiteEn` intacto (O-4: superficie mostrada sin cambios)
- [x] T005 `correcciones/route.ts` recalcula tras corregir (la categoría puede moverse
  hacia/desde SPAM/OTRO) (O-2)

## Phase 3: Backfill verificable y tests

- [x] T006 `scripts/backfill-aprobados-agregado.ts` (recomputa y corrige solo si difiere;
  idempotente) — verificado en dev (0/0 tras la migración)
- [x] T007 Tests de la regla (6): solo-spam no visible, spam no empuja el umbral, umbral
  cumplido visible, ratio sobre base aprobada, comité gana, corrección a SPAM baja contadores

## Phase 4: Gates y cierre

- [x] T008 Gates: suite completa + `tsc --noEmit` + build + `arch:check` verdes
- [x] T009 Status IMPLEMENTADO en `spec.md` + Implementación con O-1..O-4 registradas +
  índice `specs/README.md`
