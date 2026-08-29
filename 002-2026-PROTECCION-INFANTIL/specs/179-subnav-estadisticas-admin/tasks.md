# Tasks: SPEC-179 — Sub-nav del área Estadísticas del admin (I-59)

**Input**: `specs/179-subnav-estadisticas-admin/{spec,plan}.md` · **Compuerta §4**: PENDIENTE de ZEUS.

- [ ] **T001** `src/app/dashboard/admin/estadisticas/components/EstadisticasSubNav.tsx` (nuevo): 3 tabs literales (Operación / Clasificación `?tab=clasificacion` / Motor), activo por pathname+searchParams, patrón OperadoresSubNav.
- [ ] **T002** Montarlo en `operacion/page.tsx` y `motor/page.tsx`.
- [ ] **T003** `scripts/arch/lib/nav-fuentes.ts`: registrar `EstadisticasSubNav.tabs` en `subnavsFijos()` (con manejo del `?tab=` si la aserción lo exige, documentado).
- [ ] **T004** Test unit `EstadisticasSubNav.test.tsx` (3 destinos, activo correcto) + registro en `vitest.unit.includes.ts`.
- [ ] **T005** Regenerar `docs/architecture/` + `arch:check` verde + gate completo + commit + push a `work/002-pi-nocturno-20260817` (actualiza PR #55).
- [ ] **T006** `cierre.md` + fila en `specs/README.md` (2 tablas).
