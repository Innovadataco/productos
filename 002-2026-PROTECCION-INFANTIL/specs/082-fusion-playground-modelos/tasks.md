# Tasks — Spec 082: Fusión Playground + Modelos (I-05)

**Spec**: `specs/082-fusion-playground-modelos/spec.md` · **Plan**: `plan.md` · **Fecha**: 2026-07-22

## Fase 1 — Implementación (US1/US2, fusión de UI)

- [x] T001 `src/app/dashboard/admin/ia/page.tsx`: eliminar tab "modelos" de `TABS`; componer `<IaModelSelector />` + `<IaPlayground />` en el tab `playground`.
- [x] T002 Verificar con grep que no quedan referencias al tab "modelos" en `src/`.

## Fase 2 — Corrección I-05 (US3)

- [x] T003 `src/components/modules/ia/IaModelSelector.tsx`: `fetchParams()` pasa a pedir `reportes.classification_model` y `system.ollama_base_url` por `GET /api/config/parametros/{clave}` (paralelo, tolerante a 404). `saveParam`/PATCH intactos.

## Fase 3 — Tests

- [x] T004 Nuevo `src/components/modules/ia/IaModelSelector.test.tsx`: carga por clave (URL rellena + botón habilitado), modelo activo cargado, 404 tolerante.

## Fase 4 — Validación y cierre

- [x] T005 Prueba manual quickstart en `:5005`: tab Playground con config arriba (URL `http://localhost:11434` cargada, guardar persiste) + sandbox abajo; "Probar con este modelo" navega con override; sin tab "Modelos".
- [x] T006 Gate: `npm run lint && npm run test && npm run build && npx tsc --noEmit` + `./scripts/dev-restart.sh`.
- [x] T007 Docs: `quickstart.md`, `cierre.md`, sección Implementación en `spec.md`, Status, índice `specs/README.md`.
- [x] T008 Commit: `feat(admin-ia): fusiona Playground+Modelos y corrige carga de config (spec 082, I-05)`.
