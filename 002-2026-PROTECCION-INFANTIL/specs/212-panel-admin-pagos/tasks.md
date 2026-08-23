# Tasks · SPEC-212 · Panel admin Pagos

## Fase 1 — Especificación (no code)

- [done] T001 · Redactar `spec.md` con contexto, US, AS, FR/NFR, SC, assumptions y decisiones.
- [done] T002 · Redactar `data-model.md` con cambio aditivo en enum `EstadoPago`.
- [done] T003 · Redactar `research.md` con análisis de `AdminNav`, tabs y `pagos-repository`.
- [ ] T004 · Redactar `contracts/` con endpoints admin/pagos (pendiente FASE 1).
- [ ] T005 · Redactar `tasks.md` con dependencias (este archivo).
- [ ] T006 · Redactar `checklists/requirements.md` y `quickstart.md`.
- [ ] T007 · Commit docs: `docs(SPEC-212/002-PI-112): panel admin pagos`.

## Fase 2 — Implementación

- [ ] T101 · Migración aditiva: agregar `REEMBOLSADO` a enum `EstadoPago` y campos de reembolso a `Pago`.
- [ ] T102 · Extender `src/lib/dal/repositories/pagos-repository.ts` con métodos de bandeja, bonos, planes, reembolsos y ficha cliente.
- [ ] T103 · Agregar módulo `pagos_admin` en `src/lib/permisos-catalogo.ts` y ruta en proxy.
- [ ] T104 · Modificar `src/lib/nav-items.ts` y `AdminNav.tsx` para item "Pagos" color `ambar`.
- [ ] T105 · Crear layout `/dashboard/admin/pagos/layout.tsx` con `PagosSubNav` (7 tabs).
- [ ] T106 · Crear endpoints API bajo `src/app/api/admin/pagos/pendientes/route.ts`.
- [ ] T107 · Crear endpoints API para vencimientos y mora.
- [ ] T108 · Crear endpoints API para CRUD bonos.
- [ ] T109 · Crear endpoints API para CRUD planes (edición de precios).
- [ ] T110 · Crear endpoints API para reembolsos.
- [ ] T111 · Implementar tab `Pendientes` con tabla y acciones autorizar/rechazar.
- [ ] T112 · Implementar tabs `Vencimientos` y `Mora`.
- [ ] T113 · Implementar tab `Bonos` con formulario CRUD.
- [ ] T114 · Implementar tab `Planes` con edición de precios.
- [ ] T115 · Implementar tab `Reembolsos`.
- [ ] T116 · Implementar tab `Analítica` como stub.
- [ ] T117 · Crear ficha `/dashboard/admin/pagos/cliente/[id]/page.tsx`.
- [ ] T118 · Tests unitarios e integración de endpoints críticos.
- [ ] T119 · Gate local exhaustivo (tsc · lint · arch:check · test:unit · test:integration · build · humo).
- [ ] T120 · Commit feat: `feat(SPEC-212/002-PI-112): panel admin pagos`.

## Fase 3 — Integración y cierre

- [ ] T201 · Rebasear sobre `origin/feature/001-scaffolding` si hay cambios.
- [ ] T202 · Push único junto con SPEC-214.
- [ ] T203 · Verificar CI 6/6 verde.
- [ ] T204 · Documentar `cierre.md` y sección Implementación en `spec.md`.
