# Tasks: SPEC-162 — Materia configurable en cursos

**Orden**: por dependencias. TDD donde aplica.

## T001 — Schema y migración aditiva
- [ ] Añadir `model Materia` en `prisma/schema.prisma`.
- [ ] Añadir `model CursoMateria` con FKs a `Colegio`, `Curso`, `Materia`, `Profesor`.
- [ ] Asegurar que `Curso` y `Estudiante` NO se modifican.
- [ ] Generar migración aditiva con seed de materias por defecto para colegios existentes.
- [ ] Ejecutar `npx prisma migrate dev` y `npx prisma generate`.

## T002 — Seed inicial de materias
- [ ] Crear `src/lib/colegio/materias-seed.ts` con lista por defecto.
- [ ] Integrar seed en `src/app/api/admin/colegios/route.ts` dentro de `withUnitOfWork`.
- [ ] Test: al crear colegio se generan N materias por defecto.

## T003 — Repositorio Materia
- [ ] Crear `src/lib/dal/repositories/materia.ts` (listarActivas, crear, actualizar, cambiarEstado, obtenerPorId).
- [ ] Aislamiento por `colegioId` en todas las operaciones.
- [ ] Test `src/lib/dal/repositories/materia.test.ts`: CRUD + A/B + duplicados.

## T004 — Endpoints de materias
- [ ] `GET /api/colegio/materias`.
- [ ] `POST /api/colegio/materias`.
- [ ] `PATCH /api/colegio/materias/[id]`.
- [ ] `PATCH /api/colegio/materias/[id]/estado`.
- [ ] Tests de API con A/B y validaciones.

## T005 — Repositorio CursoMateria
- [ ] Crear `src/lib/dal/repositories/curso-materia.ts`.
- [ ] Validar same-tenant (`cursoId`, `materiaId`, `profesorId` del mismo colegio).
- [ ] Validar materia activa y profesor activo (si aplica).
- [ ] Test `src/lib/dal/repositories/curso-materia.test.ts`: CRUD + A/B + duplicados + validaciones.

## T006 — Endpoints de CursoMateria
- [ ] `GET /api/colegio/cursos/[cursoId]/materias`.
- [ ] `POST /api/colegio/cursos/[cursoId]/materias`.
- [ ] `PATCH /api/colegio/cursos/[cursoId]/materias/[id]`.
- [ ] `PATCH /api/colegio/cursos/[cursoId]/materias/[id]/estado`.
- [ ] Tests de API con A/B y validaciones.

## T007 — Frontend
- [ ] Crear página `/dashboard/colegio/materias` (lista + alta + edición + inactivar).
- [ ] Crear `MateriasCursoClient` en ficha del curso para gestionar materias asignadas.
- [ ] Opcional: mostrar conteo de materias en `CursoHeader`.

## T008 — Auditoría y arquitectura
- [ ] Añadir acciones de audit para `Materia` y `CursoMateria`.
- [ ] Auditar mutaciones en endpoints y repositorios.
- [ ] Regenerar artefactos de arquitectura y dejar `npm run arch:check` verde.

## T009 — Gate y cierre
- [ ] `tsc --noEmit`, `lint`, `tokens:check`, `arch:check`, `test:coverage`, `build` verdes.
- [ ] Actualizar `specs/README.md` (ambas tablas).
- [ ] Commit, push a `work/002-pi-061`, PR a `feature/001-scaffolding`.
- [ ] CI-PUSH verde.
