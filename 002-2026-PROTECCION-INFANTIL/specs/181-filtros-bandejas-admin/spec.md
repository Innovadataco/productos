# Feature Specification: SPEC-181 — Filtros, búsqueda y orden en las bandejas del admin

**Feature Branch**: `work/002-pi-078`

**Created**: 2026-08-19

**Status**: PLANEADO

Impacto en arquitectura: extiende 3 endpoints de lectura con query params validados (Zod) y parametriza el `orderBy` fijo de los repositorios de bandeja. Sin modelo, sin migraciones, sin permisos nuevos.

**Input**: Aprobación del CEO (2026-08-19) tras revisión de prod. Estado actual verificado en fuente: la bandeja principal (`/dashboard/admin`) YA tiene filtros + búsqueda pero orden fijo; spam no tiene filtros, búsqueda ni paginación en UI; anti-abuso solo tiene `page` y un skeleton ad-hoc que "parpadea" al cargar.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El admin filtra, busca y ordena en cualquier bandeja (Priority: P1)

Como admin quiero en cada bandeja una barra con búsqueda, filtros y orden, para encontrar rápido lo que necesito revisar.

**Why this priority**: las bandejas son la herramienta diaria de operación; hoy spam y anti-abuso obliga a recorrer páginas a ciegas.

**Independent Test**: en cada una de las 3 bandejas, usar la búsqueda y un filtro y cambiar el orden; la lista responde y la URL refleja el estado.

**Acceptance Scenarios**:

1. **Given** `/dashboard/admin` (bandeja principal), **When** el admin elige orden "más recientes" o "mayor prioridad" u "orden por fecha ascendente", **Then** la lista se reordena (el orden hoy es fijo prioridad+fecha).
2. **Given** `/dashboard/admin/spam`, **Then** hay barra con búsqueda por texto (identificador/número de seguimiento), filtro por estado (POSIBLE_SPAM / REVISION_MANUAL), orden y paginación visible — replicando el patrón de la bandeja principal.
3. **Given** `/dashboard/admin/anti-abuso`, **Then** hay búsqueda por identificador, filtro por nivel de riesgo y por plataforma, y orden — más la carga con el componente estándar `Cargando` en lugar del skeleton ad-hoc que parpadea.
4. **Given** cualquier filtro aplicado, **Then** la URL lleva los query params (estado compartible/recargable) y los endpoints validan con Zod (400 claro ante params inválidos).
5. **Given** la respuesta de spam, **Then** sigue la convención `{ reportes, pagination }` con `pageSize` (hoy usa `paginacion`/`limit`).

---

### Edge Cases

- Búsqueda con menos de 3 caracteres: el endpoint la ignora o 400 claro (patrón existente: `q` min 3).
- Orden inválido: 400 con mensaje (enum cerrado).
- Filtros que no devuelven nada: `EmptyState` existente, sin error.
- Combinación de filtros + paginación: al cambiar filtros se vuelve a página 1.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `GET /api/admin/reportes-revision` DEBE aceptar `orden` (enum: `prioridad`, `recientes`, `antiguos`; default `prioridad` = comportamiento actual) y propagarlo al repositorio.
- **FR-002**: `GET /api/admin/spam/pendientes` DEBE validar con Zod y aceptar `q` (min 3), `estado` (POSIBLE_SPAM/REVISION_MANUAL), `orden`, `page`, `pageSize`; respuesta con la convención estándar.
- **FR-003**: `GET /api/admin/anti-abuso/simulacion-score` DEBE aceptar `q` (identificador), `nivel`, `plataformaId`, `orden`, `page`, `pageSize` con Zod.
- **FR-004**: Las 3 bandejas DEBEN tener barra de filtros visible con búsqueda + filtros + orden + paginación, con la URL como fuente de verdad (patrón de `AdminReportesTable`).
- **FR-005**: El estado de carga DEBE usar el componente estándar `Cargando` (adiós al skeleton ad-hoc de anti-abuso que parpadea).
- **FR-006**: Los repositorios con `orderBy` fijo (`findBandejaRevision`, `findBandejaSpam`) DEBEN parametrizar el orden de forma segura (mapa cerrado de ordenes permitidos — nunca interpolación de entrada).

### Key Entities

- Sin cambios de modelo. Query params nuevos en 3 endpoints de lectura.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las 3 bandejas tienen búsqueda + filtros + orden + paginación funcionando, con URL compartible.
- **SC-002**: Tests de endpoint por cada bandeja cubren: param inválido → 400, filtro aplica, orden cambia el orden real de resultados, paginación estándar.
- **SC-003**: Gate local completo verde + CI del PR verde.

## Assumptions

- El orden default no cambia en ninguna bandeja (prioridad+fecha) — solo se añade la opción de cambiarlo.
- No se crea componente compartido `BarraFiltros` en esta fase: se replica el patrón de `AdminReportesTable` en cada client (3 implementaciones similares mejor que una abstracción prematura; si crece, se extrae después).
- Anti-abuso mantiene su simulación en seco; los filtros aplican a la tabla comparativa.
