# Tasks: SPEC-162 — Materia configurable en cursos

**Orden**: por dependencias. TDD donde aplica.

## T001 — Schema y migración aditiva
- [ ] Añadir `model Materia` en `prisma/schema.prisma`.
- [ ] Añadir `materiaId` nullable a `Curso` y relación.
- [ ] Reemplazar unique constraint de `Curso`.
- [ ] Generar migración aditiva con backfill de materia por defecto `"Otra"`.
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

## T005 — Curso con materia (backend)
- [ ] Actualizar `CursoRepository` para incluir `materiaId` y validar materia.
- [ ] Actualizar schemas `cursoBodySchema`, `cursoUpdateBodySchema`, `payloadUnificadoSchema`.
- [ ] Actualizar `POST /api/colegio/cursos`, `PATCH /api/colegio/cursos/[id]`, `POST /api/colegio/cursos/unificado`.
- [ ] Actualizar tests existentes de cursos.

## T006 — Frontend de materias
- [ ] Crear página `/dashboard/colegio/materias` (lista + alta + edición + inactivar).
- [ ] Actualizar `CursosPageClient` para mostrar materia + grupo y editar ambos.
- [ ] Actualizar `nuevo/page.tsx` y `SeccionCurso` del wizard.
- [ ] Actualizar `CursoEscritorioClient` y `CursoHeader`.

## T007 — Auditoría y arquitectura
- [ ] Añadir acciones de audit `COLEGIO_MATERIA_CREADA`, `COLEGIO_MATERIA_ACTUALIZADA`, `COLEGIO_MATERIA_ESTADO_CAMBIADO`.
- [ ] Auditar cambio de `materiaId` en curso.
- [ ] Regenerar artefactos de arquitectura y dejar `npm run arch:check` verde.

## T008 — Gate y cierre
- [ ] `tsc --noEmit`, `lint`, `tokens:check`, `arch:check`, `test:coverage`, `build` verdes.
- [ ] Actualizar `specs/README.md` (ambas tablas).
- [ ] Commit, push a `work/002-pi-061`, PR a `feature/001-scaffolding`.
- [ ] CI-PUSH verde.
