# Tasks · SPEC-595 — Bandeja: pendientes vs procesados

## Fase 1 — Contrato y API

- [x] T001 [P] `src/lib/validators.ts` — agregar `seccion` (enum pendientes/procesados, default pendientes) a `reportesRevisionQuerySchema`.
- [x] T002 [P] `src/lib/dal/repositories/reporte.ts` — método `contarBandejaRevision(where)`.
- [x] T003 `src/app/api/admin/reportes-revision/route.ts` — aplicar filtro de sección en `where.AND` e incluir `secciones` en la respuesta.

## Fase 2 — UI

- [x] T004 `src/components/modules/reporte-detalle/ReporteDetalleSoloLectura.tsx` — modal solo-lectura (fetch propio + `ReporteDetalleInfo`).
- [x] T005 `src/components/modules/AdminReportesTable.tsx` — pestañas Pendientes/Procesados con contadores, URL `?seccion=`, modo solo lectura en procesados.

## Fase 3 — Tests

- [x] T006 [P] `src/app/api/admin/reportes-revision/route.test.ts` — asignación de estados a secciones (incl. CLASIFICADO con/sin corrección), default, coexistencia de filtros, `secciones`.
- [x] T007 [P] `src/components/modules/AdminReportesTable.test.tsx` — pestañas/contadores, procesados sin «Ver proceso», apertura modal solo-lectura.
- [x] T008 [P] `src/components/modules/reporte-detalle/ReporteDetalleSoloLectura.test.tsx` — campos visibles, sin acciones.

## Fase 4 — Cierre

- [x] T009 `specs/595-bandeja-procesados/` — spec.md, plan.md, tasks.md; `generar-readme.ts`; status IMPLEMENTADO.
- [x] T010 Gate: `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build` en verde.
