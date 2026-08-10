# Tasks: SPEC-152 — Duplicar curso al año siguiente

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

- [x] T001 Migración aditiva: valor enum `COLEGIO_CURSO_DUPLICADO` en `AccionAudit`.
- [x] T002 `CursoRepository` extendido (`buscarPorDatos`, `crear`) — validación de duplicado destino.
- [x] T003 Servicio `duplicarCurso` — clonación atómica de estudiantes, acudientes e identificadores.
- [x] T004 Endpoint `POST /api/colegio/cursos/[id]/duplicar` con auth, vigencia y rate limit.
- [x] T005 Tests de integración: 201, 404, 409, atomicidad.
- [x] T006 UI botón "Duplicar al año siguiente" en ficha del curso.
- [ ] T007 Registrar SPEC-152 en `specs/README.md` (ambas tablas).
- [ ] T008 Gate de calidad completo verde.

## Analyze

- Cobertura: US1→T002,T003,T004,T005; US2→T002,T004,T005; US3→T006,T007.
- Toda FR tiene tarea asignada; FR-012 (I-29/arch:check/tokens) se verifica en T008.
- Consistencia: reusa `withUnitOfWork` (SPEC-137), repositorios tenant-first (SPEC-134) y patrón de creación anidada del endpoint unificado (SPEC-146).
