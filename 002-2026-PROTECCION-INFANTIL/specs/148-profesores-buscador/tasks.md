# Tasks: SPEC-148 — Profesores + buscador global ⌘K

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

- [ ] T001 `busqueda-colegio.ts` (ilike nombre+apellidos/nombre, solo activos,
      tenant, top N por grupo + restantes, prefijo primero) + test (A/B, 500
      registros < 200 ms, mínimo 2 caracteres)
- [ ] T002 `GET /api/colegio/buscar` (patrón rutas colegio, rate limit admin_read)
      + route.test.ts A/B
- [ ] T003 [P] `CommandPalette` (portal, focus trap, combobox/listbox aria, ↑↓
      Enter Esc, restauración foco) + test a11y
- [ ] T004 [P] `BuscadorGlobal` (⌘K/Ctrl+K, debounce 250-300 ms, resultados
      agrupados con contexto, empty honesto) montado en layout del colegio + test
- [ ] T005 [P] Página `/dashboard/colegio/profesores/` (tabla, filtro
      activos/inactivos, buscador, formulario, baja suave + reactivar) + tests
- [ ] T006 Nav "Profesores" + placeholder home → pantalla nueva + oráculo páginas
      54→55 + arch:check VERDE
- [ ] T007 Checks de día: tsc + lint + tokens:check (≤1122) + arch:check + tests
      del área (nuevos + SPEC-145 intactos) + push

## Analyze (2026-08-08)

- Cobertura: US1→T005,T006 · US2→T001-T004,T006 · FR-006→T001-T007. Toda FR tiene
  tarea; FR-007 invariante en T007.
- Consistencia: CRUD de SPEC-145 intacto (US3 no toca endpoints); búsqueda solo
  activos coherente con baja suave; destino estudiante = ficha vieja (Assumption).
