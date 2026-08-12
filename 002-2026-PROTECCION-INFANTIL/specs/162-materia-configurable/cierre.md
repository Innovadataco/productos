# Cierre: SPEC-162 — Materia configurable en cursos

**Fecha**: 2026-08-12 · **Radicado**: 002-PI-061 · **Spec**: [spec.md](./spec.md)

## Evidencia

- **Commits en `work/002-pi-061`**: `57d8095d` especificación · `74d9d0ad` corrección tras compuerta ZEUS · `824388ea` schema+migración · `04e75c33` seed · `d564614c` `MateriaRepository` · `6164c5ea` endpoints materias · `86d056b1` `CursoMateriaRepository` · `56de7f81` endpoints curso-materia · `18c01ca8` frontend · `d0b1a400` arquitectura · `9f118e8a`+`c4c5fd6a` oráculos/README/tokens.
- **Merge a `feature/001-scaffolding`**: commit `6a83090d`.
- **CI PR #43**: run `31569879218` — `gate pass 22m23s`.
- **CI-PUSH `feature/001-scaffolding`**: run `31571415421` — `success`.
- **Gate local** (verificado previo al push): `npx tsc --noEmit` · `npm run lint` · `npm run tokens:check` · `npm run arch:check` · `npm run test` (1967 passed, 1 skipped) · `npm run build`.

## Qué se entregó (FR → evidencia)

- **FR-001**: CRUD de `Materia` en `src/lib/dal/repositories/materia.ts` + endpoints `/api/colegio/materias` (GET/POST/PATCH/estado) + tests.
- **FR-002**: seed inicial de 15 materias en `src/lib/colegio/materias-seed.ts`, invocado al crear colegio.
- **FR-003**: `Curso` no se modificó; `Estudiante.cursoId` intacto; unique constraint de `Curso` sin cambios.
- **FR-004/005/006/007**: `CursoMateria` en schema + `CursoMateriaRepository` + endpoints `/api/colegio/cursos/[cursoId]/materias`; validación de duplicados `(cursoId, materiaId)`, cross-tenant y materia activa.
- **FR-008/009**: endpoints REST con Zod + rate limiting.
- **FR-010**: página `/dashboard/colegio/materias` (`MateriasPageClient.tsx`) y sección `SeccionMateriasCurso` en ficha del curso; navegación actualizada en `ColegioSideNav` y `nav-items.ts`.
- **FR-011**: seis acciones de auditoría en `AccionAudit`: `COLEGIO_MATERIA_CREADA`, `COLEGIO_MATERIA_ACTUALIZADA`, `COLEGIO_MATERIA_ESTADO_CAMBIADO`, `COLEGIO_CURSO_MATERIA_CREADA`, `COLEGIO_CURSO_MATERIA_ACTUALIZADA`, `COLEGIO_CURSO_MATERIA_ESTADO_CAMBIADO`.

## Hallazgos y desviaciones

- Ninguna desviación funcional. El modelo final respetó la compuerta de ZEUS: `CursoMateria` como vínculo N:M, sin alterar `Curso` ni `Estudiante.cursoId`.
- I-49: migración 100% aditiva; sin `DROP`, `RENAME` ni cambios destructivos.

## Deuda técnica

- `dev-restart.sh` pendiente de ejecución por el CEO/ops (máquina compartida).
