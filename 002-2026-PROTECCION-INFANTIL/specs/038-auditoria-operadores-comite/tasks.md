# Tasks: Auditoría de Operadores y Comité

**Input**: Design documents from `/specs/038-auditoria-operadores-comite/`

**Prerequisites**: plan.md, spec.md, data-model.md, research.md, quickstart.md

**Tests**: Integration tests included per constitution §5.1

**Organization**: Tasks grouped by implementation phase. Each task includes the file path and, where applicable, TDD notes.

---

## Phase 0: Spec-Kit

- [ ] T000 Crear directorio `specs/038-auditoria-operadores-comite/` con `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `tasks.md`, `checklists/requirements.md`.

---

## Phase 1: Shared Constants & Validation

- [ ] T001 [P] Crear `src/lib/audit-actions.ts` con `OPERADOR_AUDIT_ACTIONS` y `COMITE_AUDIT_ACTIONS` derivados del enum `AccionAudit`.
- [ ] T002 [P] Extender `src/lib/validators.ts`: agregar `acciones` (csv), `q` (usuario) y `recursoId`; mantener `accion` legacy.

---

## Phase 2: API Endpoint

- [ ] T003 [P] Actualizar `src/app/api/admin/audit-logs/route.ts` para soportar filtros `acciones`, `q`, `recursoId` y fecha.
- [ ] T004 [P] Crear `src/app/api/admin/audit-logs/route.test.ts` con casos de filtrado, paginación y permisos.

---

## Phase 3: UI Component

- [ ] T005 [P] Crear `src/components/modules/AuditLogViewer.tsx` con filtros, tabla, paginación y detalle expandible.
- [ ] T006 Crear `src/app/dashboard/admin/operadores/auditoria/page.tsx` con `AuditLogViewer` y acciones `OPERADOR_*` por defecto.
- [ ] T007 Crear `src/app/dashboard/admin/comite/auditoria/page.tsx` con `AuditLogViewer` y acciones `COMITE_*` por defecto.
- [ ] T008 Actualizar `src/app/dashboard/admin/operadores/components/OperadoresSubNav.tsx` para agregar pestaña "Auditoría".
- [ ] T009 Actualizar `src/app/dashboard/admin/comite/components/ComiteSubNav.tsx` para agregar pestaña "Auditoría".

---

## Phase 4: Verification & Closure

- [ ] T010 [P] Ejecutar `npx tsc --noEmit` y corregir errores.
- [ ] T011 [P] Ejecutar `npm run lint` y corregir errores.
- [ ] T012 [P] Ejecutar `npm run test` y asegurar que todos pasen.
- [ ] T013 [P] Ejecutar `./scripts/dev-restart.sh` y healthcheck.
- [ ] T014 Validar escenarios de `quickstart.md` con curl.
- [ ] T015 Actualizar `specs/038-auditoria-operadores-comite/spec.md` con sección Implementación.
- [ ] T016 Crear `docs/cierre-038.md`.
- [ ] T017 Commit por User Story + commit de docs; push a `feature/001-scaffolding`.

---

## Dependencies & Execution Order

```text
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
```

- Phase 1 (constantes + validación) bloquea Phase 2 (endpoint).
- Phase 2 bloquea Phase 3 (componente consume endpoint).
- Phase 3 bloquea Phase 4 (verificación end-to-end).

---

## Parallel Opportunities

- T001 y T002 pueden ejecutarse en paralelo.
- T005 puede comenzar una vez T002 esté listo (la UI consume el schema, pero no requiere el endpoint final).
- T006 y T007 son paralelos.
- T008 y T009 son paralelos.
