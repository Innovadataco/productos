# Feature Specification: SPEC-257 — Filtro de bonos a componente cliente (I-125)

**Feature Branch**: `work/002-PI-rescate-pagos`

**Created**: 2026-08-26

**Status**: `PLANEADO`

Impacto en arquitectura: `src/app/dashboard/admin/pagos/bonos/page.tsx:49` es un Server Component que pasa `onChange` a un `<select>` — en App Router eso lanza "Event handlers cannot be passed to Client Component props" en el render. Se extrae el `<form>`+`<select>` a un componente `"use client"` nuevo (`FiltroBonos.tsx` bajo `src/components/modules/pagos/`) y el `page.tsx` deja de tocar handlers. Sin ruta nueva, sin API nueva, sin migración.

**Input**: Logs de producción: `Error: Event handlers cannot be passed to Client Component props. { name: "origen", ... onChange: function onChange ... } digest: '1152862741'`. La pantalla `/dashboard/admin/pagos/bonos` no renderiza.

**Dependencias**: ninguna.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — `/dashboard/admin/pagos/bonos` carga sin error (Priority: P1)

Como `ADMIN` quiero abrir la pantalla de bonos y verla renderizada.

**Independent Test**: abrir la ruta → 200 OK sin excepción de render; ver el título "Bonos promocionales" y (si hay bonos) la tabla.

**Acceptance Scenarios**:
1. **Given** el `ADMIN` autenticado, **When** navega a `/dashboard/admin/pagos/bonos`, **Then** la página renderiza sin error.
2. **Given** la lista de bonos, **When** el `ADMIN` cambia el filtro de origen a "Recompensa por pago", **Then** la URL se actualiza con `?origen=RECOMPENSA_PAGO` y la lista filtra.
3. **Given** filtro activo, **When** el `ADMIN` vuelve a "Todos los orígenes", **Then** el filtro se limpia y la URL queda sin `?origen`.

### Edge Cases

- ¿Cómo se preserva el `page` actual al cambiar el filtro? — el filtro reinicia a `page=1` (comportamiento estándar de listas paginadas al filtrar).
- ¿Y sin JS? — el `<form>` sigue funcionando con un botón "Filtrar" fallback: cambia el origen y pulsa el botón, o auto-submit por JS si está disponible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEBE existir un nuevo componente `FiltroBonos` (`"use client"`) bajo `src/components/modules/pagos/FiltroBonos.tsx` que renderiza el `<form method="get">` con el `<select name="origen">` y auto-envía en `onChange`.
- **FR-002**: `src/app/dashboard/admin/pagos/bonos/page.tsx` DEBE dejar de importar handlers; el bloque del filtro se reemplaza por `<FiltroBonos activoActual={activo} origenActual={origen} />`.
- **FR-003**: El componente cliente DEBE preservar el `hidden input` para `activo` (mantiene compatibilidad con la señal que hoy pasa `page.tsx`).
- **FR-004**: El comportamiento visible del filtro NO cambia: mismo select, misma opción "Todos los orígenes"/"Recompensa por pago", mismo estilo (tokens semánticos).
- **FR-005**: NO se toca la lectura del DAL ni la tabla; solo el bloque de filtro.

### Key Entities

- **`FiltroBonos`** (React client component, `src/components/modules/pagos/FiltroBonos.tsx`).

## Success Criteria *(mandatory)*

- **SC-006 (brief)**: `/dashboard/admin/pagos/bonos` carga sin error y el filtro por origen funciona.

## Assumptions

- El motor de filtros por query string sigue funcionando (query params consumidos en Server Component).
- Sin cambio de UX visible.
