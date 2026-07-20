# Tasks: Corrección post-cierre 049 y 051 — Accesibilidad y UI

## Phase 1 — Preparación y componentes base

| ID | Tarea | Archivo(s) | Dependencias |
|---|---|---|---|
| T001 | Crear `Modal.tsx` con Escape, overlay, focus trap, focus restoration, role y aria-label. | `src/components/ui/Modal.tsx`, `src/components/ui/Modal.test.tsx` | — |
| T002 | Crear `Tooltip.tsx` accesible (hover + focus, aria-describedby). | `src/components/ui/Tooltip.tsx`, `src/components/ui/Tooltip.test.tsx` | — |
| T003 | Estandarizar `focus-visible` en `globals.css` para todos los elementos interactivos. | `src/app/globals.css` | — |

## Phase 2 — Reemplazo de modales manuales

| ID | Tarea | Archivo(s) | Dependencias |
|---|---|---|---|
| T004 [P] | Reemplazar modal de `AdminReporteDetalle.tsx` por `Modal`. | `src/components/modules/AdminReporteDetalle.tsx`, `src/components/modules/reporte-detalle/*.tsx` | T001 |
| T005 [P] | Reemplazar modal de `ComiteSolicitudDetalle.tsx` por `Modal`. | `src/components/modules/ComiteSolicitudDetalle.tsx` | T001 |
| T006 [P] | Reemplazar modal de `SpamRevisionPanel.tsx` por `Modal` y resolver apilamiento con `AdminReporteDetalle`. | `src/components/modules/SpamRevisionPanel.tsx` | T001, T004 |
| T007 | Agregar tests de integración para cierre de modales. | `src/components/modules/Modal.integration.test.tsx` | T004, T005, T006 |

## Phase 3 — Accesibilidad de botones y navegación por teclado

| ID | Tarea | Archivo(s) | Dependencias |
|---|---|---|---|
| T008 [P] | Agregar `Tooltip` a botones de solo ícono en `ThemeToggle`, `NavHeader`, `CategoriaGruposEditor`. | `src/components/ui/ThemeToggle.tsx`, `src/components/modules/NavHeader.tsx`, `src/components/modules/CategoriaGruposEditor.tsx` | T002 |
| T009 | Auditar `div[onClick]` sin rol en vistas principales y convertir a `<button>` o agregar `role`/`tabIndex`/manejadores. | `src/components/modules/AdminReportesTable.tsx`, `ComiteBandeja.tsx`, `SpamRevisionPanel.tsx`, etc. | — |
| T010 | Verificar y corregir orden de tabulación en vistas principales (bandejas, formularios, dashboards). | `src/app/dashboard/admin/**`, `src/app/dashboard/admin/operadores/**`, `src/app/dashboard/admin/comite/**`, `src/app/reportar/page.tsx`, `src/app/consulta/page.tsx` | T009 |
| T011 | Actualizar `scripts/a11y_audit.js` para cubrir foco visible, `div[onClick]` y orden de tabulación. | `scripts/a11y_audit.js` | T008, T009 |

## Phase 4 — Contraste en dark mode

| ID | Tarea | Archivo(s) | Dependencias |
|---|---|---|---|
| T012 [P] | Corregir contraste de `Button` disabled en dark mode. | `src/components/ui/Button.tsx` | — |
| T013 [P] | Corregir texto de carga en `AdminReporteDetalle.tsx`. | `src/components/modules/AdminReporteDetalle.tsx` | — |
| T014 [P] | Corregir contraste de ejes/área en `Sparkline.tsx`. | `src/components/modules/Sparkline.tsx` | — |
| T015 [P] | Corregir contraste de puntos `RiskBadge` en modo claro. | `src/components/modules/RiskBadge.tsx` | — |
| T016 | Actualizar `scripts/contrast_check.js` para medir dark mode, disabled y textos fijos. | `scripts/contrast_check.js` | T012, T013, T014, T015 |

## Phase 5 — Validación y cierre

| ID | Tarea | Archivo(s) | Dependencias |
|---|---|---|---|
| T017 | Ejecutar `quickstart.md` de punta a punta. | — | T007, T010, T016 |
| T018 | Ejecutar `tsc`, `lint`, `test`, `build` y `dev-restart.sh`. | — | T017 |
| T019 | Actualizar `spec.md` sección Implementación, `cierre.md` y evidencia. | `specs/054-correccion-049-051-accesibilidad-ui/spec.md`, `cierre.md` | T018 |
| T020 | Commit por User Story + uno de docs; push a `feature/001-scaffolding`. | — | T019 |

## Tareas plan-only (🔒)

Ninguna. Este spec es de corrección y se implementará completo tras aprobación humana.

