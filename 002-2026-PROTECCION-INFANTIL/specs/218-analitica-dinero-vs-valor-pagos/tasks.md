# Tasks — SPEC-218 (002-PI-118)

> Planificado. No se ejecutan hasta aprobación de ZEUS.

## Fase 1 — Especificación y diseño

- [x] T001 [P1] Redactar artefactos.
- [x] T002 [P1] Commit "docs(SPEC-218/002-PI-118): analítica dinero-vs-valor".

## Fase 2 — Queries analíticas

- [ ] T003 [P1] Extender `PagosRepository` con queries de los 4 widgets y KPIs.
- [ ] T004 [P1] Crear `src/lib/pagos/analitica.service.ts` con caché 60s.
- [ ] T005 [P1] Tests de agregación con fechas Bogotá.

## Fase 3 — UI

- [ ] T006 [P1] Verificar/reutilizar componentes de charts existentes.
- [ ] T007 [P1] Crear KPI cards.
- [ ] T008 [P1] Crear 4 widgets.
- [ ] T009 [P1] Crear página `/dashboard/admin/estadisticas/dinero-vs-valor/page.tsx`.

## Fase 4 — Integración y navegación

- [ ] T010 [P1] Agregar tab en sub-nav de estadísticas.
- [ ] T011 [P1] Responsive y contraste AA.

## Fase 5 — Gate y cierre

- [ ] T012 [P1] Gate local completo.
- [ ] T013 [P1] Actualizar `specs/README.md` estado a IMPLEMENTADO.
- [ ] T014 [P1] Redactar `cierre.md`.

## Dependencias y orden

- T003 → T004 → T005.
- T006 → T007/T008 → T009 → T010.
