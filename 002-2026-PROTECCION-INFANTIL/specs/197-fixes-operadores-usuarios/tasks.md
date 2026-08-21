# Tasks — SPEC-197

## Especificación

- [x] T001 — Redactar `spec.md`.
- [x] T002 — Redactar `plan.md`.
- [x] T003 — Crear artefactos auxiliares (`data-model.md`, `research.md`, `quickstart.md`).

## Implementación

- [ ] T004 — I-91: quitar botón "Reasignar caso" y estado/modal de `/dashboard/admin/operadores/asignar/page.tsx`.
- [ ] T005 — I-92: extender `OperadorOpcion` en `ReasignarModal.tsx` con cupo y casos abiertos.
- [ ] T006 — I-92: filtrar dropdown destino a operadores con cupo disponible.
- [ ] T007 — I-97: `UsuariosAdminClient` acepta prop `rol` (fallback a query string).
- [ ] T008 — I-97: crear páginas `/usuarios/rectores`, `/usuarios/operadores`, `/usuarios/comite`, `/usuarios/admins`.
- [ ] T009 — I-97: actualizar `UsuariosSubNav` para resaltar sub-tab activo.
- [ ] T010 — Tests: cobertura para I-91, I-92 e I-97.

## Cierre

- [ ] T011 — Gate local completo.
- [ ] T012 — Actualizar `specs/README.md`.
- [ ] T013 — Commit único + push.
- [ ] T014 — PR y CI verde.
- [ ] T015 — `cierre.md`.
