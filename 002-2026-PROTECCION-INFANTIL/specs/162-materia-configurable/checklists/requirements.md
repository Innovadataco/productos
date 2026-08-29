# Requirements Checklist: SPEC-162 — Materia configurable en cursos

- [ ] FR-001: CRUD de materias por colegio con aislamiento `colegioId`.
- [ ] FR-002: Seed inicial de materias al crear colegio.
- [ ] FR-003: `Curso` y `Estudiante.cursoId` no se modifican.
- [ ] FR-004: `CursoMateria` vincula `Curso` × `Materia` × `Profesor`.
- [ ] FR-005: Unicidad `(cursoId, materiaId)`.
- [ ] FR-006: Validar que curso, materia y profesor pertenecen al mismo colegio.
- [ ] FR-007: Validar que la materia está activa al crear/editar vínculo.
- [ ] FR-008: Endpoints REST `/api/colegio/materias`.
- [ ] FR-009: Endpoints REST `/api/colegio/cursos/[cursoId]/materias`.
- [ ] FR-010: UI del curso actualizada para gestionar materias.
- [ ] FR-011: Auditoría de mutaciones sobre `Materia` y `CursoMateria`.
- [ ] SC-001: Rendimiento de listado < 500 ms para 50 materias.
- [ ] SC-002: 100% de operaciones respetan aislamiento por colegio.
- [ ] SC-003: Un curso puede tener N materias sin duplicar estudiantes.
- [ ] SC-004: Cursos y estudiantes existentes no se ven afectados.
- [ ] SC-005: AuditLog inmutable por mutación.
- [ ] SC-006: Migración puramente aditiva.
