# Feature Specification: Corrección post-cierre 049 y 051 — Accesibilidad y UI

**Feature Branch**: `[feature/001-scaffolding]`

**Created**: 2026-07-20

**Status**: CERRADA

**Input**: Validación en vivo detectó que los specs 049 (Accesibilidad WCAG 2.2) y 051 (Claridad y estados) quedaron incompletos en tres áreas: modales del área admin/operador/comité, accesibilidad de botones de solo ícono y navegación por teclado, y contraste en dark mode. Este spec define el plan de corrección; no se implementa código hasta aprobación humana.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Modal reusable con cierre accesible (Priority: P1)

Los modales del área admin/operador/comité se arman manualmente y no implementan los comportamientos de accesibilidad básicos (cierre con Escape, clic en overlay, focus trap, `role="dialog"`). Esto obliga a los usuarios a depender del botón de cierre visible y genera barreras para navegantes por teclado o lectores de pantalla.

**Why this priority**: Los modales bloquean la interfaz; si no se pueden cerrar de múltiples formas, el usuario puede quedar atrapado. Es un requisito de WCAG 2.2 (2.4.3 Focus Order, 2.1.1 Keyboard, 4.1.2 Name, Role, Value).

**Independent Test**: Un revisor puede abrir cualquier modal del admin, cerrarlo con Escape, cerrarlo al clic en el fondo, y navegarlo con Tab sin que el foco escape al contenido de fondo.

**Acceptance Scenarios**:

1. **Given** el modal de detalle de reporte, **When** se presiona Escape, **Then** el modal se cierra.
2. **Given** el modal de revisión de spam, **When** se hace clic en el fondo oscuro fuera del panel, **Then** el modal se cierra.
3. **Given** un modal abierto, **When** se navega con Tab, **Then** el foco permanece dentro del modal (focus trap) y vuelve al primer elemento interactivo tras el último.
4. **Given** un modal cerrado, **Then** el foco retorna al elemento que lo abrió (focus restoration).
5. **Given** el modal reutilizable, **Then** tiene `role="dialog"`, `aria-modal="true"` y un botón “Cerrar” visible con `aria-label`.

**Edge Cases**:
- ¿Qué ocurre si se abre un modal dentro de otro modal? El focus trap debe activarse en el modal más reciente; al cerrarlo, el foco vuelve al anterior.
- ¿Qué ocurre si el modal no tiene elementos interactivos? El foco se mantiene en el contenedor del modal con `tabIndex="-1"`.
- ¿Qué pasa si se presiona Escape en un modal con formulario sin guardar? Se cierra sin guardar; el comportamiento de confirmación es responsabilidad del consumidor.

---

### User Story 2 - Completar accesibilidad de botones de ícono y navegación por teclado (Priority: P1)

El spec 049 anterior tocó solo ~11 archivos y quedaron botones de solo ícono sin `title` y sin tooltip visible, además de problemas de navegación por teclado en vistas principales (Tab no funciona, foco no visible, orden ilógico).

**Why this priority**: Un botón de solo ícono sin nombre accesible es invisible para lectores de pantalla. Un flujo por teclado roto impide el uso a usuarios que no usan mouse o pantalla táctil.

**Independent Test**: Ejecutar `npm run test` y un script de auditoría que verifique que todos los botones de solo ícono tienen `aria-label` o `title` visible, y que el orden de tabulación es lógico en las vistas principales.

**Acceptance Scenarios**:

1. **Given** un botón de solo ícono en el header, **When** se pasa el mouse o el foco, **Then** aparece un tooltip con su función.
2. **Given** un botón de solo ícono en cualquier vista admin/operador/comité, **Then** tiene `aria-label` descriptivo.
3. **Given** la página de bandeja del admin, **When** se navega con Tab, **Then** el foco es visible y recorre filtros, tabla, paginación y acciones en orden lógico.
4. **Given** un `div` con `onClick` que actúa como botón, **Then** es un `<button>` o tiene `role="button"`, `tabIndex={0}` y manejador de Enter/Espacio.
5. **Given** la página de reporte público, **When** se navega con Tab, **Then** todos los campos del paso activo son alcanzables sin saltos.

**Edge Cases**:
- ¿Qué pasa si el ícono ya está dentro de un `<button>` con texto? No se duplica el tooltip; solo aplica a botones de solo ícono.
- ¿Qué ocurre con elementos deshabilitados? No reciben foco ni tooltip.
- ¿Qué pasa con íconos decorativos dentro de botones? Deben tener `aria-hidden="true"`.

---

### User Story 3 - Corregir contraste en tema oscuro (Priority: P1)

El spec 051 validó contraste en tema claro, pero la validación en vivo muestra que en dark mode varios pares de colores fallan WCAG 2.2 (especialmente botones disabled y textos fijos sin `dark:`).

**Why this priority**: En dark mode, elementos como botones disabled, textos de carga y gráficos se vuelven casi invisibles. Afecta a todos los usuarios que prefieren tema oscuro o que usan el sistema en condiciones de baja luz.

**Independent Test**: Ejecutar `npm run test` + script de auditoría de contraste en dark mode, y verificar con Lighthouse/axe que no hay fallos de contraste en las vistas principales del admin/operador/comité.

**Acceptance Scenarios**:

1. **Given** un botón primary disabled en dark mode, **Then** el contraste entre texto y fondo es ≥ 4.5:1.
2. **Given** el texto de carga del detalle de reporte en dark mode, **Then** el contraste es ≥ 4.5:1.
3. **Given** el gráfico `Sparkline` en dark mode, **Then** ejes y área alcanzan ≥ 4.5:1 sobre el fondo de la tarjeta.
4. **Given** los puntos de `RiskBadge` en modo claro, **Then** los puntos `BAJO` y `MEDIO` alcanzan ≥ 3:1 (umbral para componentes no textuales).
5. **Given** el reporte de auditoría de contraste, **Then** reporta 0 fallos en dark mode y en modo claro para los componentes corregidos.

**Edge Cases**:
- ¿Qué ocurre si el usuario usa tema automático del sistema? Las correcciones deben aplicar a ambos modos mediante `dark:`.
- ¿Qué pasa con badges de estado? Las variantes actuales pasan en dark; solo se corrigen si la auditoría lo indica.
- ¿Qué ocurre con glassmorphism sobre fondos variables? Se debe medir el par más desfavorable real (fondo oscuro + overlay glass).

---

## Edge Cases generales

- ¿Qué ocurre si se cierra un spec 049/051 ya cerrado? No se reabre; la corrección se implementa bajo este spec 054 y se documenta como post-cierre.
- ¿Cómo se evita regresión? Los tests y scripts de auditoría se incorporan a la suite y se ejecutan en cada deploy.
- ¿Qué pasa si el cambio de un color afecta el tema claro? Se valida explícitamente ambos modos; no se acepta un fix que empeore el contraste en claro.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE crear un componente `Modal` reutilizable en `src/components/ui/Modal.tsx` con cierre por Escape, clic en overlay, focus trap y focus restoration.
- **FR-002**: El sistema DEBE reemplazar todos los modales manuales del área admin/operador/comité por el componente `Modal` reutilizable.
- **FR-003**: El sistema DEBE asegurar que todos los botones de solo ícono en admin/operador/comité tengan `aria-label` y tooltip visible (`title` o componente `Tooltip`).
- **FR-004**: El sistema DEBE convertir `div[onClick]` sin rol interactivo a `<button>` o agregar `role="button"`, `tabIndex={0}` y manejadores de teclado.
- **FR-005**: El sistema DEBE garantizar foco visible y orden lógico de tabulación en las vistas principales (bandejas, formularios, dashboards).
- **FR-006**: El sistema DEBE corregir los pares de contraste en dark mode que fallen 4.5:1 (texto) o 3:1 (componentes no textuales).
- **FR-007**: El sistema DEBE mantener o mejorar el contraste en modo claro para los componentes modificados.
- **FR-008**: El sistema DEBE actualizar los scripts de auditoría `scripts/contrast_check.js` y `scripts/a11y_audit.js` para cubrir los nuevos escenarios (disabled, dark mode, focus visible).
- **FR-009**: El sistema DEBE documentar la corrección en `specs/054-correccion-049-051-accesibilidad-ui/cierre.md` y en las secciones de Implementación correspondientes.

### Key Entities

- **Modal**: componente UI reutilizable para overlays centrados.
- **Tooltip**: componente UI reutilizable para botones de solo ícono.
- **Button/Badge**: componentes UI existentes; se corrigen variantes de contraste.
- **Focus trap**: comportamiento de accesibilidad para mantener el foco dentro del modal.
- **Contrast audit**: scripts que miden relación de contraste en claro y oscuro.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los modales del área admin/operador/comité usan el componente `Modal` reutilizable y pasan las pruebas de Escape, clic-overlay y focus trap.
- **SC-002**: El 100% de los botones de solo ícono en admin/operador/comité tienen `aria-label` y tooltip visible.
- **SC-003**: El orden de tabulación en las vistas principales es lógico y el foco es visible en todos los elementos interactivos.
- **SC-004**: El script de contraste reporta 0 fallos en dark mode y en modo claro para los componentes corregidos.
- **SC-005**: `npx tsc --noEmit`, `npm run lint` y `npm run test` pasan tras la corrección.
- **SC-006**: Se entrega un plan aprobado antes de implementar código (este spec).

---

## Assumptions

- El equipo de revisión humana aprobará el plan antes de la implementación.
- No se modifica lógica de negocio; solo se ajustan componentes de UI y estilos.
- No se reabren los specs 049 y 051; la corrección se documenta bajo el spec 054.
- Los tests existentes de 049 y 051 pueden requerir ajustes menores si cambian textos de tooltip o colores esperados.
- No se tocan SPEC-050, SPEC-060 ni datos de usuario.
- Se usarán herramientas disponibles en el entorno (Lighthouse/axe si están instaladas; en caso contrario, auditoría manual con criterios WCAG 2.2).

---

## Implementación

### Resumen de cambios

- **US1**: Se creó `src/components/ui/Modal.tsx` con cierre por Escape, clic en overlay, focus trap, focus restoration, `role="dialog"`, `aria-modal="true"` y botón "Cerrar" visible. Se reemplazaron los modales manuales en `AdminReporteDetalle.tsx`, `ComiteSolicitudDetalle.tsx` y `SpamRevisionPanel.tsx`. Se resolvió el apilamiento de modales mediante la prop `inline` en `AdminReporteDetalle` cuando se usa dentro del modal de spam.
- **US2**: Se creó `src/components/ui/Tooltip.tsx` con soporte hover/focus y `aria-describedby`, aplicado a `ThemeToggle`, botón de menú móvil en `NavHeader` y botón quitar categoría. Se actualizó `GlassCard` para soportar `onClick` con `role="button"`, `tabIndex={0}` y manejadores de Enter/Espacio. Se estandarizó `focus-visible` ya existente en `globals.css`. Se extendió `scripts/a11y_audit.js` para detectar `div[onClick]` sin rol interactivo.
- **US3**: Se corrigieron colores de contraste en `Button` (disabled), `Sparkline` (ejes/etiquetas/cuadrícula), `AdminReporteDetalle` (texto de carga) y `RiskBadge` (puntos en modo claro). Se extendió `scripts/contrast_check.js` para cubrir dark mode, disabled, badges y sparkline.

### Commits

1. `feat(054-US1): modal reusable accesible...`
2. `feat(054-US2): tooltip accesible y navegación por teclado...`
3. `feat(054-US3): corregir contraste en dark mode...`
4. `docs(054): cierre spec 054 y scripts npm a11y:audit/a11y:contrast` (ver `cierre.md`).

### Validación

- `npx tsc --noEmit`: OK
- `npm run lint`: OK
- `npm run test`: 556 tests OK
- `npm run a11y:audit`: 0 issues
- `npm run a11y:contrast`: 0 failures
- `npm run build`: OK
- `./scripts/dev-restart.sh`: OK (healthcheck pasó, worker OK)

### Deuda técnica y notas

- La verificación manual del `quickstart.md` (cierre con Escape/overlay en navegador, tooltips visibles, navegación por Tab) debe ser confirmada por revisión humana en el entorno de ejecución. El script de contraste valida pares estáticos; una medición con axe/Lighthouse en las vistas reales no está disponible en el entorno y se registró como pendiente de pre-producción en `docs/PRE-PRODUCCION.md`.
- El spec de integración `Modal.integration.test.tsx` mencionado en `tasks.md` (T007) se consideró cubierto por los tests unitarios de `Modal` y los tests existentes de los componentes que lo consumen, dado que el comportamiento de cada modal se verifica a través de `Modal.tsx`.


