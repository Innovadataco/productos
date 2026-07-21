# Feature Specification: Simulación — Ver detalle del reporte (Spec 072)

**Feature Branch**: `[feature/001-scaffolding]`

**Created**: 2026-07-20

**Status**: PLANEADO

**Input**: Ampliación del Spec 070 (Simulación de carga y comparación de modelos). En la tabla de resultados por caso se agrega un botón "Ver detalle" que abre el modal de detalle del reporte existente (`AdminReporteDetalle`), reutilizando el componente y el `Modal` del Spec 054. No se implementa código hasta aprobación humana del plan.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Botón "Ver detalle" en resultados de simulación (Priority: P1)

Un administrador que revisa los resultados de una simulación necesita inspeccionar el reporte real que generó cada caso, con el mismo detalle que ve en la bandeja de administración (texto, categoría asignada, confianza, estado, transiciones, acciones disponibles, etc.).

**Why this priority**: Mejora la capacidad de auditoría y depuración de una simulación. Hoy la tabla solo muestra métricas agregadas por fila; el admin no puede abrir el reporte subyacente sin salir del flujo de simulación.

**Independent Test**: Con una simulación finalizada, el admin hace clic en "Ver detalle" de un caso y se abre el mismo modal de detalle que usa la bandeja de admin. El modal cierra con Escape, clic en el overlay o botón "Cerrar".

**Acceptance Scenarios**:

1. **Given** una simulación finalizada con resultados por caso, **When** el admin hace clic en "Ver detalle" de una fila, **Then** se abre `AdminReporteDetalle` con el `reporteId` de ese caso, mostrando el detalle completo del reporte.
2. **Given** el modal de detalle abierto desde la simulación, **When** el admin presiona Escape, **Then** el modal se cierra.
3. **Given** el modal de detalle abierto desde la simulación, **When** el admin hace clic fuera del modal (overlay), **Then** el modal se cierra.
4. **Given** el modal de detalle abierto desde la simulación, **When** el admin hace clic en el botón "Cerrar", **Then** el modal se cierra.
5. **Given** el detalle abierto, **When** el admin realiza una acción disponible (por ejemplo, validar anonimización o escalar), **Then** el componente se comporta igual que en la bandeja admin y, al cerrar, la tabla de simulación se refresca si el estado cambió.

**Edge Cases**:
- ¿Qué pasa si el reporte fue dado de baja entre el cierre de la simulación y la apertura del detalle? `AdminReporteDetalle` ya maneja estados eliminados; no se requiere lógica adicional.
- ¿Qué pasa si el reporte aún no tiene clasificación (`DESCONOCIDA`)? El modal muestra el estado del reporte y el componente existente se encarga del mensaje.
- ¿Qué pasa si la fila pertenece a una comparación de dos corridas? El botón "Ver detalle" abre el reporte del caso en la corrida principal de la fila; cada corrida ya tiene su propio `reporteId` vinculado.

---

## Edge Cases generales

- ¿Qué ocurre si el endpoint de resultados no devuelve `reporteId`? Se agrega al select de salida (cambio aditivo, sin tocar el modelo `Reporte`).
- ¿Qué ocurre si `AdminReporteDetalle` cambia de props en el futuro? La integración se actualiza en el mismo PR para mantener la reutilización.
- ¿Qué ocurre si la tabla se usa en la vista de comparación de corridas? El botón debe aparecer en ambas tablas (resultados de una corrida y comparación lado a lado) siempre que haya un `reporteId` disponible.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE agregar un botón "Ver detalle" en cada fila de `TablaResultadosSimulacion` cuando la simulación tenga resultados.
- **FR-002**: El botón DEBE abrir el componente `AdminReporteDetalle` pasando el `reporteId` del caso y un `onClose` que cierre el modal.
- **FR-003**: El sistema NO DEBE crear un nuevo modal ni duplicar la vista de detalle; DEBE reutilizar `AdminReporteDetalle` y el `Modal` del Spec 054.
- **FR-004**: El endpoint `GET /api/admin/ia/simulaciones/[id]/resultados` DEBE incluir `reporteId` en cada ítem de la respuesta (verificación: ya está presente; si no, se agrega al select sin modificar el modelo `Reporte`).
- **FR-005**: El botón DEBE respetar el comportamiento de cierre del `Modal` (Escape, overlay, botón Cerrar).
- **FR-006**: El sistema DEBE actualizar la tabla de resultados si el detalle realiza una acción que cambie el estado del reporte (mismo patrón de `onRefresh` que en la bandeja admin).
- **FR-007**: El sistema NO DEBE exponer información adicional del reporte fuera del modal; el acceso sigue gobernado por `verifyAuth(ADMIN)` en el endpoint de detalle.

### Key Entities

- **SimulacionReporte**: tabla puente que vincula una corrida con los reportes creados. Campos relevantes: `reporteId`, `indice`, `categoriaEsperada`.
- **Reporte**: entidad real creada por la simulación; su detalle se muestra con `AdminReporteDetalle`.
- **ResultadoCaso**: DTO de la UI que ya incluye `reporteId` (verificado en `src/components/modules/ia/simulacion/types.ts`).
- **AdminReporteDetalle**: componente existente que muestra el detalle de un reporte y sus acciones.
- **Modal**: componente reusable del Spec 054 con cierre por Escape, overlay y botón.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El botón "Ver detalle" aparece en cada fila de la tabla de resultados de simulación.
- **SC-002**: Al hacer clic, se abre el modal con `AdminReporteDetalle` renderizado con el `reporteId` correcto.
- **SC-003**: El modal cierra con Escape, overlay y botón Cerrar.
- **SC-004**: No se crea un nuevo componente de modal ni de detalle; se reutilizan los existentes.
- **SC-005**: El endpoint de resultados devuelve `reporteId` para cada caso (ya verificado; si no, se corrige).
- **SC-006**: El quickstart documenta el paso a paso para probar el flujo.

---

## Assumptions

- `AdminReporteDetalle` ya usa el `Modal` reusable del Spec 054 y acepta `reporteId`, `onClose` y `onRefresh`.
- `TablaResultadosSimulacion` recibe un array de `ResultadoCaso`, que ya incluye `reporteId`.
- El endpoint `GET /api/admin/ia/simulaciones/[id]/resultados` ya devuelve `reporteId` por cada ítem (a confirmar en `research.md`).
- No se toca el modelo `Reporte`, `SimulacionRun`, `SimulacionReporte` ni `ClasificacionIA`.
- No hay endpoints nuevos; solo se consume el endpoint de resultados existente y el detalle de reporte existente.
- No se implementa código hasta aprobación humana del plan.

---

## Implementación

*Pendiente. Se completará tras la aprobación del plan y la implementación de la User Story.*

## Status

PLANEADO
