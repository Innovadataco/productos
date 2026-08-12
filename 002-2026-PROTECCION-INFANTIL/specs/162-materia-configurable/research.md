# Research: SPEC-162 — Materia configurable en cursos

**Date**: 2026-08-12

## Fuentes consultadas

- `Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-MODULO-COLEGIO.md` §3 (terminología) y §4.5 (Materia configurable).
- `prisma/schema.prisma` modelos `Colegio`, `Curso`, `Profesor`, `Estudiante`.
- `src/app/api/colegio/cursos/**`, `src/lib/dal/repositories/curso.ts`, `src/lib/schemas/index.ts`.
- `src/app/dashboard/colegio/cursos/**`, `src/components/modules/colegio/unificado/SeccionCurso.tsx`.
- `src/app/api/admin/colegios/route.ts` (alta de colegio).
- Specs de referencia: `specs/150-observacion-especial/spec.md`, `specs/001-multi-role-auth-config/spec.md`.

## Hallazgos

- `Curso.nombre` hoy es texto libre y en la UI se presenta como "Nombre" con placeholder "Ej. 8° B", es decir, representa el grupo (curso en terminología colombiana).
- `Estudiante.cursoId` vive directamente en `Curso`; cualquier intento de convertir `Curso` en materia × grupo duplicaría estudiantes y rompería el roster.
- No existe ninguna entidad `Materia` ni referencia en el schema.
- El wizard unificado (`SeccionCurso`) y el endpoint `POST /api/colegio/cursos/unificado` crean cursos (grupos), no materias.
- El alta de colegio usa `withUnitOfWork` y es el punto natural para seedear el catálogo inicial de materias.
- El repositorio `CursoRepository` ya sigue el patrón tenant-first (SPEC-134) y acepta cliente transaccional.

## Corrección tras compuerta ZEUS (2026-08-12)

La primera versión de la spec proponía `Curso = Materia × grupo`, lo que rompía el roster. ZEUS corrigió:

- **Curso** = grado/grupo (sin cambios).
- **Materia** = asignatura (catálogo colegio-scoped).
- **CursoMateria** = vínculo N:M entre `Curso` y `Materia`, con `profesorId` opcional.

Esta corrección:
- No toca `Curso` ni `Estudiante.cursoId`.
- Permite que un curso tenga varias materias sin duplicar estudiantes.
- Resuelve gratis el profesor multi-curso (§4.4), ya que un profesor puede aparecer en múltiples filas de `CursoMateria`.

## Decisión de diseño actual

- `Materia`: catálogo colegio-scoped con soft delete.
- `CursoMateria`: entidad de vínculo con `colegioId` denormalizado, FKs a `Curso`, `Materia`, `Profesor` y unique `(cursoId, materiaId)`.
- Migración puramente aditiva: crea `Materia` y `CursoMateria`; no modifica `Curso` ni `Estudiante`.
