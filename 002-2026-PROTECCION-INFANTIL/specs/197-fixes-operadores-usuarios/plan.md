# Plan SPEC-197 — Fixes operadores + usuarios

## Resumen

Tres fixes UI/UX (I-91, I-92, I-97) sobre módulos admin existentes. Sin cambios de arquitectura. Un único commit de implementación al final.

## Fases

### Fase 1 — Especificación y diseño
- [x] T001: Redactar `spec.md` con US/AS/FR/NFR.
- [x] T002: Redactar `plan.md` con fases y tasks.
- [x] T003: Crear artefactos auxiliares mínimos (`data-model.md`, `research.md`, `quickstart.md`).

### Fase 2 — Fix I-91: quitar reasignar del listado
- [ ] T004: Eliminar botón "Reasignar caso" y estados/modal asociados en `src/app/dashboard/admin/operadores/asignar/page.tsx`.
- [ ] T005: Actualizar test de la página si existe.

### Fase 3 — Fix I-92: filtrar destino por cupo
- [ ] T006: Extender `OperadorOpcion` en `ReasignarModal.tsx` con `casosAbiertos` y `cupoMaximo`.
- [ ] T007: Filtrar opciones destino a operadores con `casosAbiertos < cupoMaximo`.
- [ ] T008: Actualizar `ReasignarModal.test.tsx` para cubrir el filtro de cupo.

### Fase 4 — Fix I-97: sub-tabs de usuarios
- [ ] T009: Modificar `UsuariosAdminClient` para aceptar prop `rol` (con fallback a query string para compatibilidad).
- [ ] T010: Crear `src/app/dashboard/admin/usuarios/rectores/page.tsx` (rol `SCHOOL_ADMIN`).
- [ ] T011: Crear `src/app/dashboard/admin/usuarios/operadores/page.tsx` (rol `OPERADOR`).
- [ ] T012: Crear `src/app/dashboard/admin/usuarios/comite/page.tsx` (roles `COMITE_VALIDACION` + `COMITE_CONVIVENCIA`).
- [ ] T013: Crear `src/app/dashboard/admin/usuarios/admins/page.tsx` (rol `ADMIN`).
- [ ] T014: Actualizar `UsuariosSubNav` para resaltar tab activo con `startsWith` (soporta `/usuarios/[sub]`).
- [ ] T015: Añadir tests de renderizado para las nuevas páginas.

### Fase 5 — Cierre
- [ ] T016: Gate local completo: typecheck, lint, test, arch:check, build.
- [ ] T017: Actualizar `specs/README.md` con SPEC-197.
- [ ] T018: Commit único + push a `origin/work/002-pi-094`.
- [ ] T019: Abrir PR a `feature/001-scaffolding` y esperar CI verde.
- [ ] T020: Redactar `cierre.md` con evidencia.

## Decisiones de diseño

| Tema | Decisión | Razón |
|---|---|---|
| Rol en usuarios | Prop `rol` al client + fallback query string | Permite URLs limpias `/usuarios/rectores` sin romper links antiguos |
| Tab Comité | Un solo sub-tab para `COMITE_VALIDACION` y `COMITE_CONVIVENCIA` | Simplifica navegación; ambos son cuentas de comité |
| Cupo disponible | Filtro en cliente sobre datos de `/api/admin/operadores` | Reusa endpoint existente; mínima intrusión |
| Commit | Único al final | Régimen D-54 |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Regresión en reasignación desde ficha | `ReasignarModal` conserva API; solo cambia filtro de opciones |
| Tab activo no resaltado | Actualizar lógica de `UsuariosSubNav` a `startsWith` |
