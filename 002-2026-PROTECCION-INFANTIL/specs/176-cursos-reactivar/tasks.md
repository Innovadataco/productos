# Tasks: SPEC-176 — Cursos: ver y reactivar desactivados

**Input**: `specs/176-cursos-reactivar/{spec,plan}.md` · **Modo**: autónomo (aprobado por ZEUS en la cola 002-PI-073).

- [ ] **T001** `src/lib/dal/repositories/curso.ts`: `listarPorColegio(colegioId, { incluirInactivos })`; `listarActivos` queda como wrapper.
- [ ] **T002** `src/app/api/colegio/cursos/route.ts`: query `incluirInactivos` (Zod, default false) → repo con la opción; tenant-first intacto.
- [ ] **T003** `CursosPageClient.tsx`: toggle "Mostrar desactivados" + refetch con query param + badge "Desactivado" + botón "Activar" (PATCH estado existente) solo en inactivos.
- [ ] **T004** Test integration del endpoint (con/sin flag, aislamiento, ida y vuelta desactivar→reactivar auditada).
- [ ] **T005** Test unit de la página (toggle cambia fetch, badge+Activar en inactivos, ausente en activos) + registro en `vitest.unit.includes.ts` si es archivo nuevo.
- [ ] **T006** Regenerar `docs/architecture/` si aplica + `arch:check` verde + gate completo + commit + PR.
- [ ] **T007** `cierre.md` + fila en `specs/README.md` (2 tablas).
