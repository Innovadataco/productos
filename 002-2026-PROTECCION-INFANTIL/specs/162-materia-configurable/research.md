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

- `Curso.nombre` hoy es texto libre y en la UI se presenta como "Nombre" con placeholder "Ej. 8° B", es decir, ya se usa como grupo.
- La unique constraint actual es `(colegioId, nombre, grado, anioLectivo)`.
- No existe ninguna entidad `Materia` ni referencia en el schema.
- El wizard unificado (`SeccionCurso`) y el endpoint `POST /api/colegio/cursos/unificado` reutilizan `cursoBodySchema`.
- El alta de colegio usa `withUnitOfWork` y es el punto natural para seedear el catálogo inicial.
- El repositorio `CursoRepository` ya sigue el patrón tenant-first (SPEC-134) y acepta cliente transaccional.

## Decisión de diseño propuesta

- **Grupo = atributo string de `Curso`** (`Curso.nombre`, sin renombrar columna por compatibilidad).
- **`Curso = Materia × grupo × grado × añoLectivo`**.
- **`Materia`** es un catálogo colegio-scoped con soft delete por `estado`.
- **Migración aditiva**: `materiaId` nullable + backfill a materia por defecto `"Otra"`.

## Pregunta para la compuerta

- ¿ZEUS confirma que grupo es atributo string y no entidad aparte en esta fase?
- ¿El catálogo inicial propuesto (12 materías) es correcto o se ajusta?
