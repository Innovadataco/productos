# Checklist de requisitos: SPEC-152

## Functional Requirements

- [x] FR-001: Endpoint `POST /api/colegio/cursos/[id]/duplicar` existe.
- [x] FR-002: 404 si el curso no pertenece al colegio del SCHOOL_ADMIN.
- [x] FR-003: Atomicidad con `withUnitOfWork` (todo o nada).
- [x] FR-004: Nuevo `anioLectivo` calculado correctamente.
- [x] FR-005: 409 si el curso destino ya existe.
- [x] FR-006: Estudiantes activos clonados con acudientes.
- [x] FR-007: Identificadores activos clonados.
- [x] FR-008: No se copia `profesorTitularId`.
- [x] FR-009: Auditoría `COLEGIO_CURSO_DUPLICADO`.
- [x] FR-010: Tests de integración verdes.
- [x] FR-011: UI botón en ficha del curso.
- [x] FR-012: I-29 intacto; no se toca `src/lib/ai/**`.

## Quality Gates

- [x] `npx tsc --noEmit` verde.
- [x] `npm run lint` verde (solo warnings preexistentes).
- [x] `npm run tokens:check` verde.
- [x] `npm run arch:check` verde.
- [ ] `npm run test:coverage` verde.
- [ ] `npm run build` verde.

## Documentation

- [x] `spec.md` actualizado con sección Implementación al cerrar.
- [x] `cierre.md` creado con evidencia.
- [ ] `specs/README.md` actualizado en ambas tablas.
- [ ] `.specify/feature.json` actualizado a la siguiente spec (153) al cerrar.
