# Tasks: SPEC-146 — Wizard unificado curso + estudiantes + identificadores

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

- [ ] T001 `payloadUnificadoSchema` en `src/lib/schemas` (curso + estudiantes[] +
      identificadores[] con estudianteIndex) + tests de schema
- [ ] T002 `POST /api/colegio/cursos/unificado` — withUnitOfWork, re-validación
      Zod completa, profesor same-tenant (o profesorNuevo inline), duplicados 409,
      audit `COLEGIO_*` + route.test.ts (A/B, atomicidad con fallo provocado = 0
      filas, 400 humanos, 409)
- [ ] T003 `POST /api/colegio/cursos/unificado/validar` — multipart, reuso
      parser/validator, `{ filasValidas, problemas }` sin persistir + plantilla con
      columnas de acudiente + route.test.ts
- [ ] T004 [P] `src/components/ui/Accordion.tsx` + test a11y (teclado,
      aria-expanded, foco, reduced-motion)
- [ ] T005 [P] Wizard UI (`WizardUnificado` + SeccionCurso + TablaEstudiantes +
      ImportExcel + SeccionIdentificadores) + tests de componentes
- [ ] T006 `page.tsx` del wizard + redirects (`cursos/nuevo`, `cursos/carga`) +
      nav "Subir lista" + CTAs home verificados
- [ ] T007 Checks de día: tsc + lint + tokens:check (≤1166) + arch:check +
      tests del área (nuevos + journeys colegio + endpoints viejos intactos)

## Analyze (speckit.analyze, 2026-08-03)

- Cobertura: US1→T001,T002,T004,T005,T006 · US2→T003,T005 · US3→T006 · FR-008→T002,
  T003,T004,T005,T007. Toda FR tiene tarea; FR-006/009 son invariantes verificados
  en T007.
- Consistencia: alcance (cursos/[id] y alumnos/[id] quedan para 147) coherente con
  el orden del lote; dry-run stateless coherente con SPEC-132 (el roster viejo no
  se toca). Sin ambigüedades abiertas.
