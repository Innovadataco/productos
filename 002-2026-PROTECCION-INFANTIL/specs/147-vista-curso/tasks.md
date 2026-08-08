# Tasks: SPEC-147 — Vista de curso

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

- [ ] T001 `estudiante.listarPorCursoConDetalle` (include acudientes +
      identificadores activos, tenant) + `contarCobertura` parametrizada por curso
      (aditivo) + tests
- [ ] T002 [P] `alerta-colegio`: conteos DISTINCT reporteId 30d/60d para UN curso
      (raw con nombres físicos, tenant en ambos lados) + tests
- [ ] T003 `colegio-resumen.cursoDetalle(colegioId, cursoId)` (Promise.all, DTO,
      404 si 0 filas) + test A/B + conteo de queries
- [ ] T004 [P] `AcudienteContacto` (tel:/mailto: condicional, badge ámbar, segundo
      acudiente visible) + test por caso (solo tel, solo email, ambos, ninguno)
- [ ] T005 [P] `TablaEstudiantes` (ui/Tabla + buscador debounce + empty state) +
      `AnilloCurso` + `TarjetasCurso` + `CursoHeader` + tests
- [ ] T006 `CursoEscritorioClient` + `page.tsx` (server, una llamada) +
      `FormAgregarEstudiante` (acudiente opcional) + edición con titular — endpoints
      existentes intactos
- [ ] T007 Checks de día: tsc + lint + tokens:check (≤1135) + arch:check + tests
      del área (nuevos + existentes cursos/alumnos/journeys verdes)

## Analyze (2026-08-03)

- Cobertura: US1→T001-T003,T005,T006 · US2→T001,T004,T005 · US3→T006 · FR-006→T001-T007.
  Toda FR tiene tarea; FR-007 invariante en T007.
- Consistencia: endpoints existentes no se tocan (FR-005 coherente con 146);
  métrica D2 heredada de 143; anillo 88px soportado de fábrica por el primitivo.
