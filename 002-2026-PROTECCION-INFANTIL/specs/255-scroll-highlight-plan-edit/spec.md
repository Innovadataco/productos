# Feature Specification: SPEC-255 — Scroll y resaltado al editar plan (I-123)

**Feature Branch**: `work/002-PI-rescate-pagos`

**Created**: 2026-08-26

**Status**: `PLANEADO`

Impacto en arquitectura: cambio de UX en `src/components/modules/PlanesAdminCRUD.tsx` — la función `editar(plan)` (líneas 117-129) agrega scroll al formulario y resaltado de la fila en edición. Sin ruta nueva, sin API nueva, sin migración. Componente ya es `"use client"`; se agrega un `useRef` al `<form>` y una clase condicional a `<tr>`.

**Input**: `PlanesAdminCRUD.tsx` tiene el formulario ARRIBA y la tabla DEBAJO. Al pulsar "Editar" en la fila 8, el estado se actualiza pero el usuario no ve nada porque la vista queda en la tabla. Percepción: "el botón no funciona".

**Dependencias**: ninguna. Puede mergearse antes o después de SPEC-254; la relación es solo temática.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Al editar un plan, la vista salta al formulario y la fila queda resaltada (Priority: P1)

Como `ADMIN` con 10 planes listados, quiero que al pulsar "Editar" en una fila la vista salte al formulario (arriba) y esa fila quede marcada visualmente, para saber en qué plan estoy trabajando.

**Independent Test**: renderizar `PlanesAdminCRUD` con 10 planes; simular click en "Editar" de la fila 8; verificar que `formRef.current.scrollIntoView` se llama y que la fila 8 tiene la clase de resaltado.

**Acceptance Scenarios**:
1. **Given** la lista de planes visible con el formulario colapsado o fuera de vista, **When** el `ADMIN` pulsa "Editar" en una fila, **Then** la vista se desplaza suavemente hasta el formulario y ese formulario contiene los datos del plan seleccionado.
2. **Given** un plan seleccionado en modo edición, **When** se recorre visualmente la tabla, **Then** la fila del plan editado se distingue con un fondo de token semántico (`bg-cielo/10` o equivalente coherente con el sistema de diseño), y las demás filas mantienen su estilo normal.
3. **Given** el modo edición activo, **When** el `ADMIN` pulsa "Cancelar" (`resetForm`), **Then** el resaltado desaparece de la fila y el formulario vuelve a su estado vacío.

### Edge Cases

- ¿Qué pasa con motion-reduced (accesibilidad)? — `scrollIntoView({ behavior: "smooth" })` respeta `prefers-reduced-motion` en Chromium/WebKit modernos; si no, degrada a scroll instantáneo (aceptable).
- ¿Qué pasa si el usuario ya está viendo el formulario? — el scroll es idempotente (no molesta).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `PlanesAdminCRUD.tsx` DEBE mantener una `ref` al elemento `<form>` de edición.
- **FR-002**: `editar(plan)` DEBE llamar `formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })` tras el `setEditing`.
- **FR-003**: El `<tr>` de cada plan DEBE aplicar una clase de resaltado (token `cielo` o `ambar`, con opacidad ≤ 20 %) cuando `editing?.id === plan.id`.
- **FR-004**: El resaltado DEBE limpiarse al llamar `resetForm()` (que ya pone `setEditing(null)`).
- **FR-005**: NO se toca la lógica de guardado (`guardar`), la lista, ni la paginación.
- **FR-006**: Solo tokens semánticos (`cielo`, `ambar`, `tinta`, opacidad) — cero colores crudos, para no subir el ratchet SPEC-157.

### Key Entities

- **`PlanesAdminCRUD`** (React client component, `src/components/modules/PlanesAdminCRUD.tsx`).

## Success Criteria *(mandatory)*

- **SC-001**: al pulsar "Editar" en cualquier fila, `scrollIntoView` se ejecuta contra el `<form>` (verificable por test unitario con `vi.spyOn(HTMLElement.prototype, "scrollIntoView")`).
- **SC-002**: la fila cuyo `id` coincide con `editing.id` tiene el fondo del token (verificable por Testing Library: `expect(row.className).toContain(...)`).
- **SC-003 (brief)**: cumple SC-003 del brief.

## Assumptions

- El componente es `"use client"` (ya lo es).
- `scrollIntoView` está disponible en todos los navegadores objetivo (evergreen).
