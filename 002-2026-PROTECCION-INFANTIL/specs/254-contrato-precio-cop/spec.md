# Feature Specification: SPEC-254 — Contrato de precio en COP (I-126)

**Feature Branch**: `work/002-PI-rescate-pagos`

**Created**: 2026-08-26

**Status**: `PLANEADO`

Impacto en arquitectura: cambia el contrato Zod de `pagosPlanCreateSchema` y `pagosPlanUpdateSchema` en `src/lib/schemas/pagos.ts` para que `precioBaseUSD` acepte `0` (o sea opcional) — hoy exige `.positive()` y rechaza el `0` que envía `PlanesAdminCRUD.tsx:139`. Sin migración; conserva `precioBaseUSD` en el modelo (SPEC-214 multi-moneda intacto). Añade un test que envía EL cuerpo real que arma la interfaz, cerrando el falso verde histórico donde el CI usaba valores inventados (`10, 2, 5`).

**Input**: El CEO fija precios en pesos colombianos; hoy el 100 % de guardados de planes devuelve `400` porque el esquema del servidor exige un valor positivo en un campo que la interfaz siempre envía como `0`. Decisión CEO 2026-08-26: el producto cotiza en COP; USD deja de ser obligatorio.

**Dependencias**: primera SPEC del lote; ninguna otra depende del contrato modificado antes de este cambio.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El CEO crea un plan nuevo en pesos (Priority: P1)

Como `ADMIN` quiero crear un plan (nombre, precio en COP, duración, tipo titular) y que la API responda `201`, no `400`.

**Why this priority**: sin esto no hay operación de cobro posible; es la raíz del bloqueo comercial.

**Independent Test**: `POST /api/admin/pagos/planes` con el cuerpo exacto que arma `PlanesAdminCRUD.guardar()` (incluye `precioBaseUSD: 0`) → responde `201` con el plan creado.

**Acceptance Scenarios**:
1. **Given** un `ADMIN` autenticado, **When** envía `POST /api/admin/pagos/planes` con `{ nombre, precioBaseCOP: 50000, precioBaseUSD: 0, duracion, tipoTitular, ... }`, **Then** recibe `201` y el plan queda persistido con los mismos valores.
2. **Given** el mismo body pero `esFreemium: true` y `precioBaseCOP: 0` y `usosMaximosPorCliente: 5`, **When** se guarda, **Then** el `refine` de negocio sigue aceptando (freemium = precio 0 y usos ≥ 1).
3. **Given** un intento con `esFreemium: false` y `precioBaseCOP: 0`, **When** se guarda, **Then** el `refine` de negocio lo rechaza con `400` (regla de negocio no cambia: un plan no-freemium exige `precioBaseCOP > 0`).

---

### User Story 2 — El CEO edita un plan existente (Priority: P1)

Como `ADMIN` quiero editar un plan y que la API responda `200`, no `400`.

**Why this priority**: paralelo a US1 y por el mismo esquema.

**Independent Test**: `PATCH /api/admin/pagos/planes/[id]` con el body que arma `PlanesAdminCRUD.guardar()` cuando `editing` está seteado → `200`.

**Acceptance Scenarios**:
1. **Given** un plan existente, **When** el `ADMIN` envía `PATCH` con `{ precioBaseCOP: 80000, precioBaseUSD: 0 }`, **Then** recibe `200` y el plan tiene el nuevo `precioBaseCOP`.

---

### Edge Cases

- ¿Qué pasa si el body omite `precioBaseUSD`? — Debe aceptarse (el campo pasa a **opcional** en Create y ya lo era en Update).
- ¿Qué pasa si envía `precioBaseUSD` negativo? — `400` (`.min(0)` sigue bloqueando negativos).
- ¿Qué pasa con el multi-moneda de SPEC-214? — Se conserva: el campo sigue existiendo y admite valores > 0 cuando el CEO decida usarlos.
- ¿Y si el CI antiguo pasaba con `precioBaseUSD: 10`? — Ese test queda; se AÑADE otro test que envía el body real (`precioBaseUSD: 0`) — la coexistencia demuestra que ambos casos son válidos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `pagosPlanCreateSchema` DEBE aceptar `precioBaseUSD` como `z.coerce.number().min(0).optional()` (deja de exigir `.positive()`).
- **FR-002**: `pagosPlanUpdateSchema` DEBE aceptar `precioBaseUSD` como `z.coerce.number().min(0).optional()` (deja de exigir `.positive()`).
- **FR-003**: El `refine` de negocio de `pagosPlanCreateSchema` se conserva sin cambios: `esFreemium=true ⇒ precioBaseCOP=0 ∧ usos ≥ 1`; `esFreemium=false ⇒ precioBaseCOP > 0`.
- **FR-004**: DEBE existir un test que envíe el cuerpo real (`precioBaseUSD: 0`) contra `POST /api/admin/pagos/planes` y verifique `201`, cerrando la brecha del falso verde histórico (SC-011).
- **FR-005**: DEBE existir un test análogo para `PATCH /api/admin/pagos/planes/[id]` con `precioBaseUSD: 0` que verifique `200`.
- **FR-006**: NO se modifica `PlanesAdminCRUD.tsx` (el `precioBaseUSD: 0` que envía la interfaz queda como está — el arreglo es del lado del esquema).
- **FR-007**: NO hay migración de datos; los 10 planes con `precioBaseCOP = NULL` y descripción "(precio placeholder)" quedan como están para que el CEO los edite manualmente cuando SC-001/002 estén verdes.

### Key Entities

- **`pagosPlanCreateSchema`** / **`pagosPlanUpdateSchema`** (Zod, `src/lib/schemas/pagos.ts`): contratos de entrada de los endpoints de planes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001 (brief)**: `POST /api/admin/pagos/planes` con el cuerpo real devuelve `201` (verificado por test unitario y en vivo).
- **SC-002 (brief)**: `PATCH /api/admin/pagos/planes/[id]` con el cuerpo real devuelve `200`.
- **SC-011 (brief)**: existe una prueba que ejercita el cuerpo tal cual lo arma `PlanesAdminCRUD.guardar()`.

## Assumptions

- El `refine` `esFreemium ⇒ precioBaseCOP=0` NO se toca; sigue siendo la regla de negocio válida.
- El campo `precioBaseUSD` NO se elimina del modelo — se relaja su contrato de entrada; el multi-moneda (SPEC-214) queda como capacidad no bloqueante.
- Los tests históricos con `precioBaseUSD: 10, 2, 5` se mantienen (siguen siendo válidos: `.min(0)` los acepta).
