# Feature Specification: SPEC-260 — Tests de humo de las 4 pantallas de Pagos (SC-010)

**Feature Branch**: `work/002-PI-rescate-pagos`

**Created**: 2026-08-26

**Status**: `PLANEADO`

Impacto en arquitectura: sin cambio de producto. Se agrega una suite de tests de humo (`vitest`) que **abre** cada una de las 4 pantallas del panel de Pagos con datos sembrados y verifica que **renderizan contenido**. Complementa SPEC-254..257 con la lección de fondo de I-117 a I-127: **el CI validaba contratos que la interfaz no cumplía**. Este SPEC cierra ese vacío al probar el render de páginas, no solo el contrato de API.

**Input**: los 7 defectos de I-117..I-127 pasaron el CI en verde. Ninguna prueba abría las pantallas de Pagos; el CI probaba endpoints con valores que la UI no envía. Necesitamos pruebas que carguen la Server Component con datos, la rindericen, y afirmen que se ve algo real.

**Dependencias**: consume el trabajo de SPEC-254 (contrato relajado), SPEC-255 (edit UX), SPEC-256 (DAL directo), SPEC-257 (filtro cliente). Se implementa AL FINAL del lote.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Cada pantalla de Pagos renderiza con datos sembrados (Priority: P1)

Como responsable de calidad quiero que las 4 pantallas de Pagos tengan una prueba de humo que las abra con datos reales y verifique contenido visible.

**Independent Test**: correr la suite; las 4 pruebas de humo pasan.

**Acceptance Scenarios**:
1. **Given** la BD con al menos un plan sembrado, **When** se renderiza `PlanesAdminCRUD` (montaje del componente cliente) o la ruta `/dashboard/admin/pagos/planes/*`, **Then** aparece el nombre del plan sembrado en el DOM.
2. **Given** al menos un target sin suscripción vigente, **When** se renderiza `SinSuscripcionPage`, **Then** aparece el nombre del target en el DOM.
3. **Given** al menos un pago pendiente y una solicitud pendiente, **When** se renderiza `PendientesPage`, **Then** aparecen los datos del pago y de la solicitud.
4. **Given** al menos un bono sembrado, **When** se renderiza `BonosPage`, **Then** aparece el nombre del bono y el filtro es interactuable.

### User Story 2 — Test del contrato real (Priority: P1) — reforzado por SPEC-254

**Independent Test**: `POST /api/admin/pagos/planes` recibe el body EXACTO que arma `PlanesAdminCRUD.guardar()` — con `precioBaseUSD: 0` — y responde `201`. SPEC-254 ya lo cubre; se referencia aquí para cerrar la brecha semántica.

### Edge Cases

- ¿Y si el DAL está mockeado? — se prefiere BD de test real (siguiendo el patrón `fileParallelism: false` de este proyecto). Si algún test es demasiado costoso, se documenta en `research.md`.
- ¿Y las Server Components? — se pueden importar y llamar como funciones async (patrón estándar Next.js 15+/16); el render se assert-ea sobre el React Element devuelto.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: DEBE existir un test de humo por cada una de las 4 pantallas:
    - `src/app/dashboard/admin/pagos/planes/page.test.tsx` (o test sobre `PlanesAdminCRUD`)
    - `src/app/dashboard/admin/pagos/sin-suscripcion/page.test.tsx`
    - `src/app/dashboard/admin/pagos/pendientes/page.test.tsx`
    - `src/app/dashboard/admin/pagos/bonos/page.test.tsx`
- **FR-002**: Cada test DEBE sembrar datos reales (patrón `beforeAll` + `resetDatabase`) y assert-ear texto/contenido visible en el DOM tras renderizar.
- **FR-003**: NO se limita a "el fetch respondió 200" — la prueba mira el contenido de la pantalla, como si fuera un usuario.
- **FR-004**: NO se toca lógica de producto en esta SPEC — solo tests.

### Key Entities

- Tests colocados junto al `page.tsx` correspondiente.

## Success Criteria *(mandatory)*

- **SC-010 (brief)**: existe una prueba por cada una de las 4 pantallas de Pagos que verifica render de contenido.
- **SC-011 (brief)**: existe la prueba con el cuerpo real (cubierta por SPEC-254, referenciada aquí).

## Assumptions

- El proyecto usa Vitest + Testing Library + BD Postgres de test (`fileParallelism: false`).
- Los datos sembrados en `beforeAll` se limpian con `resetDatabase` (utilidad ya existente en `src/lib/test-utils`).
- Los Server Components se importan y ejecutan directamente en el test (patrón visto en `src/app/api/**/route.test.ts` para endpoints).
