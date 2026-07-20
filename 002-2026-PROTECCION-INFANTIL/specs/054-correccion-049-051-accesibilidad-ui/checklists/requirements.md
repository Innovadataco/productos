# Checklist: Corrección post-cierre 049 y 051 — Accesibilidad y UI

## Requisitos funcionales

- [ ] FR-001: Existe `src/components/ui/Modal.tsx` con Escape, overlay, focus trap, focus restoration, role y aria-label.
- [ ] FR-002: Todos los modales manuales del área admin/operador/comité usan `Modal`.
- [ ] FR-003: Todos los botones de solo ícono en admin/operador/comité tienen `aria-label` y tooltip visible.
- [ ] FR-004: Los `div[onClick]` sin rol interactivo fueron convertidos a `<button>` o tienen `role="button"`, `tabIndex={0}` y manejadores de teclado.
- [ ] FR-005: Foco visible y orden lógico de tabulación en vistas principales.
- [ ] FR-006: Pares de contraste en dark mode pasan ≥ 4.5:1 (texto) o ≥ 3:1 (no textual).
- [ ] FR-007: No se empeora el contraste en modo claro.
- [ ] FR-008: Scripts `scripts/contrast_check.js` y `scripts/a11y_audit.js` cubren los nuevos escenarios.
- [ ] FR-009: `spec.md` sección Implementación y `cierre.md` documentan la corrección.

## Criterios de éxito

- [ ] SC-001: 100% de modales usan `Modal` y pasan pruebas de Escape, overlay y focus trap.
- [ ] SC-002: 100% de botones de solo ícono tienen `aria-label` y tooltip.
- [ ] SC-003: Orden de tabulación lógico y foco visible en vistas principales.
- [ ] SC-004: 0 fallos de contraste en dark mode y modo claro para componentes corregidos.
- [ ] SC-005: `tsc`, `lint`, `test` pasan.
- [ ] SC-006: Plan aprobado antes de implementar (este documento).

## Validación manual

- [ ] Modal de spam cierra con Escape, overlay y botón.
- [ ] Modal de detalle de reporte cierra con Escape, overlay y botón.
- [ ] Modal de detalle de solicitud del comité cierra con Escape, overlay y botón.
- [ ] Tab no escapa del modal.
- [ ] Tooltip visible en hover/focus de botones de solo ícono.
- [ ] Todos los elementos interactivos de `/dashboard/admin`, `/dashboard/admin/operadores/asignar`, `/dashboard/admin/comite` reciben foco visible.
- [ ] Modo oscuro: botones disabled, texto de carga, Sparkline y RiskBadge tienen contraste adecuado.
- [ ] Modo claro: no hay regresiones de contraste.

## Reglas de oro

- [ ] No se reabren specs 049 ni 051.
- [ ] No se tocan SPEC-050 ni SPEC-060.
- [ ] No hay migraciones ni cambios de datos.
- [ ] Un commit por User Story + uno de docs con evidencia.
- [ ] Deploy limpio con `./scripts/dev-restart.sh` (un solo worker).
- [ ] Prueba con `quickstart.md`.

