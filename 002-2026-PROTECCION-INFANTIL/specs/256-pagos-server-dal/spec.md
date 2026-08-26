# Feature Specification: SPEC-256 — Pantallas Pagos leen del DAL, con errores visibles (I-127)

**Feature Branch**: `work/002-PI-rescate-pagos`

**Created**: 2026-08-26

**Status**: `PLANEADO`

Impacto en arquitectura: dos Server Components (`src/app/dashboard/admin/pagos/sin-suscripcion/page.tsx` y `pendientes/page.tsx`) dejan de hacer `fetch()` a su propia API (URL relativa + `credentials: "include"`, que en server-side lanza y además nunca reenvía cookies) y pasan a leer directamente del DAL — `PagosRepository` para bonos ya establecido, `PagosAdminManualService`/`PagosAdminManualRepository` para los otros dos. El helper mudo `fetchJson` desaparece de estos dos archivos; en su lugar, cualquier `throw` del repositorio se captura y muestra un estado de error explícito (`Alerta tono="error"`), y el estado vacío queda diferenciado del estado roto. Sin migración; sin cambio de contrato de API (los endpoints REST siguen existiendo para clientes externos si los tuviera, pero las páginas de servidor ya no los consumen). Frontera DAL respetada: cero `@/lib/prisma` en `src/app`.

**Input**: dos pantallas del panel de Pagos aparecen siempre vacías. En logs de producción el `fetch` de servidor lanza con URL relativa; el `catch { return null }` traga el error y la UI muestra "0 registro(s)" sin diferencia entre vacío real y fallo. Explícitamente FUERA de alcance: `operadores/asignar`, `operadores/gestion`, `operadores/modelo`, `colegio/onboarding` (son componentes de cliente y su fetch es legítimo).

**Dependencias**: ninguna dura sobre otras SPECs del lote; requiere que `PagosRepository`/`PagosAdminManualRepository` expongan los métodos que hoy consume la API de estos dos endpoints (verificar en `research.md`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — `/dashboard/admin/pagos/sin-suscripcion` muestra datos reales (Priority: P1)

Como `ADMIN` quiero ver los targets sin suscripción, no una tabla vacía por defecto silencioso.

**Independent Test**: sembrar un colegio y un padre sin suscripción vigente; abrir `/dashboard/admin/pagos/sin-suscripcion`; verificar que ambos aparecen en la tabla, con el filtro por tipo funcional.

**Acceptance Scenarios**:
1. **Given** hay 3 targets sin suscripción vigente en BD, **When** el `ADMIN` abre la página, **Then** la tabla los muestra con paginación correcta y el catálogo de planes disponible para activar.
2. **Given** el DAL lanza (ej. BD caída simulada), **When** el `ADMIN` abre la página, **Then** ve un `Alerta` con mensaje de error explícito ("No se pudo cargar el listado…") y CERO tabla — nunca la ilusión de "0 registros".
3. **Given** BD vacía real (no hay targets sin suscripción), **When** el `ADMIN` abre la página, **Then** ve la fila "No hay targets sin suscripción vigente." (estado vacío existente), SIN el `Alerta` de error.

### User Story 2 — `/dashboard/admin/pagos/pendientes` muestra pagos y solicitudes pendientes (Priority: P1)

Como `ADMIN` quiero ver los pagos reportados y las solicitudes de suscripción pendientes de autorización.

**Independent Test**: sembrar 2 pagos pendientes + 1 solicitud pendiente; abrir la página; verificar las 3 filas.

**Acceptance Scenarios**:
1. **Given** hay pagos y solicitudes pendientes, **When** el `ADMIN` abre la página, **Then** ambos listados renderizan con sus paginaciones independientes.
2. **Given** el DAL lanza para pagos pero no para solicitudes, **When** se renderiza, **Then** el bloque de pagos muestra el `Alerta` de error y el de solicitudes muestra su tabla; los estados son independientes.

### Edge Cases

- Cookie de sesión inválida en el server component → `verifyAuth("ADMIN")` ya devuelve `null` y la página retorna `<SinAccesoModulo />` (sin cambio).
- ¿Y las 4 páginas de cliente con patrón similar (`operadores/*`, `colegio/onboarding`)? — NO se tocan (candado del brief).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `sin-suscripcion/page.tsx` DEBE eliminar `fetchJson` y `API_BASE` locales; consume `PagosAdminManualRepository.listarSinSuscripcion({ q, tipo, page, pageSize })` (o método equivalente ya existente) directamente.
- **FR-002**: `sin-suscripcion/page.tsx` DEBE leer el catálogo de planes (`PagosRepository.listarPlanes({ anio, activo, pageSize })` o equivalente) para `ActivarSuscripcionManual`, sin usar `fetchJson`.
- **FR-003**: `pendientes/page.tsx` DEBE eliminar `fetchJson` y leer pagos pendientes (`PagosAdminManualRepository.listarPagosPendientes(...)`) y solicitudes pendientes (`PagosAdminManualRepository.listarSolicitudesPendientes(...)`) directamente.
- **FR-004**: Ambas páginas DEBEN capturar el error del DAL con `try/catch` a nivel de bloque y mostrar `Alerta tono="error"` con mensaje explícito. NO se traga silenciosamente.
- **FR-005**: El estado "sin datos" DEBE renderizarse SIN el `Alerta` de error — quedan como estados distintos y visibles.
- **FR-006**: NO se toca `operadores/asignar/page.tsx`, `operadores/gestion/page.tsx`, `operadores/modelo/page.tsx`, ni `colegio/onboarding/page.tsx` (candado brief §4.3).
- **FR-007**: NO se toca ninguna ruta REST bajo `src/app/api/admin/pagos/**` — siguen existiendo para uso externo si aplica.
- **FR-008**: Frontera DAL: los servicios/repos NO importan `@/lib/prisma` desde `src/app`; los repos ya lo hacen internamente.

### Key Entities

- **`PagosAdminManualRepository`** (o `PagosAdminManualService`): capa DAL que expone `listarSinSuscripcion`, `listarPagosPendientes`, `listarSolicitudesPendientes`.
- **`PagosRepository`**: capa DAL con `listarPlanes` (ya usada por bonos).

## Success Criteria *(mandatory)*

- **SC-004 (brief)**: `/dashboard/admin/pagos/pendientes` muestra datos reales; vacío explícito; error legible.
- **SC-005 (brief)**: `/dashboard/admin/pagos/sin-suscripcion` idem.
- **SC-010 (brief, delegado a SPEC-260)**: test de humo que rinderiza y verifica contenido — cubierto en SPEC-260.

## Assumptions

- Existe capa DAL con los métodos requeridos (a confirmar en Fase 0 / `research.md`). Si falta alguno, se agrega dentro del scope de esta SPEC (aditivo al DAL, no toca el API).
- El motor de vigencia (SPEC-213) y multi-moneda (SPEC-214) no se tocan.
