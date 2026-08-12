# Requirements Checklist: SPEC-162 — Materia configurable en cursos

- [ ] FR-001: CRUD de materias por colegio con aislamiento `colegioId`.
- [ ] FR-002: Seed inicial de materias al crear colegio.
- [ ] FR-003: `Curso.materiaId` referencia `Materia` (nullable en BD).
- [ ] FR-004: `Curso.nombre` reinterpretado como grupo en UI/validación.
- [ ] FR-005: Unicidad `(colegioId, materiaId, nombre, grado, anioLectivo)`.
- [ ] FR-006: Validar que la materia pertenece al colegio y está activa.
- [ ] FR-007: Endpoints REST `/api/colegio/materias`.
- [ ] FR-008: Endpoints de curso actualizados con `materiaId`.
- [ ] FR-009: UI de cursos y wizard actualizados.
- [ ] FR-010: Auditoría de mutaciones sobre materia y cambios de materia en curso.
- [ ] SC-001: Rendimiento de listado < 500 ms para 50 materias.
- [ ] SC-002: 100% de operaciones respetan aislamiento por colegio.
- [ ] SC-003: Cursos nuevos requieren materia activa.
- [ ] SC-004: Cursos existentes sin materia siguen editables.
- [ ] SC-005: AuditLog inmutable por mutación.
- [ ] SC-006: Migración aditiva sin pérdida de datos.
