# Tasks: SPEC-145 — Modelo `Profesor` mínimo

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

> **STUB — compuerta §4.** Se detalla con `/speckit.tasks` después de que ZEUS apruebe
> spec+plan y resuelva D1. Orden previsto (dependencias):

## Fase 1 — Schema y migración (US1)

- [ ] T001 `prisma/schema.prisma`: modelo `Profesor` + `Curso.profesorTitularId` +
      relaciones + `AccionAudit` COLEGIO_PROFESOR_* (FR-001/002/004)
- [ ] T002 Migración aditiva (diff + shadow DB) — **INSPECCIÓN I-49 del SQL: cero
      `DROP INDEX`**; aplicar a dev/test; `migrate reset && deploy && seed` en test

## Fase 2 — DAL y validación (US2)

- [ ] T003 [P] `src/lib/dal/repositories/profesor.ts` (tenant-first) + test A/B
- [ ] T004 [P] `profesorBodySchema` en `src/lib/schemas` + tests de schema

## Fase 3 — Rutas CRUD (US2)

- [ ] T005 `GET/POST /api/colegio/profesores` + test A/B (lista, 201, 400, 409)
- [ ] T006 `GET/PATCH /api/colegio/profesores/[id]` + test A/B (404 cross-tenant,
      baja suave conserva fila, audit)
- [ ] T007 [P] (D1=a) `profesorTitularId?` en endpoints de curso con validación
      same-tenant + test A/B

## Fase 4 — Cargas, arch y cierre

- [ ] T008 [P] O-2: `src/components/ui/LuzAmbiental.test.tsx`
- [ ] T009 [P] O-1: fixture `M1`/`M2` mayúscula + barrido amplio en
      `mis-reportes/[id]/route.test.ts`
- [ ] T010 Regenerar `01-modelo-datos.md` (52 modelos) + `arch:check` VERDE +
      `tokens:check` sin subir
- [ ] T011 Quickstart + gate completo + `dev-restart.sh` + PR auto-merge + CI HEAD
      success
