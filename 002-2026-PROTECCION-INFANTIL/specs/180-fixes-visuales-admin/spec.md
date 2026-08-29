# Feature Specification: SPEC-180 — Fixes visuales del admin (tabs duplicados, texto invisible, monitoreo redundante, propósito de Dataset)

**Feature Branch**: `work/002-pi-077`

**Created**: 2026-08-19

**Status**: IMPLEMENTADO

**Implementación** (2026-08-19): ver [cierre.md](./cierre.md). Nav interno duplicado eliminado; `bg-accent`→`bg-pino` en sub-navs (la clase a secas no genera CSS — tab activo invisible); monitoreo/worker fuera del menú con redirect; Dataset explica su propósito.

Impacto en arquitectura: UI únicamente (un componente menos, clases de color, un item de menú retirado con redirect). Sin cambios de permisos, modelo, endpoints ni motor.

**Input**: Aprobación del CEO (2026-08-19) sobre la revisión de prod en pi.innovadataco.com. Hallazgos verificados en fuente: (1) tabs duplicados en `/dashboard/admin/estadisticas/operacion` (sub-nav de SPEC-179 + nav interno del tablero); (2) texto blanco invisible en tabs activos de TODOS los sub-navs — `bg-accent` a secas no genera CSS porque `accent` es un objeto de sombras en tailwind.config.ts; (3) `/dashboard/admin/monitoreo/worker` quedó redundante tras el tablero operativo de SPEC-171; (4) la página Dataset de entrenamiento no explica su propósito.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Los tabs del admin se ven y no se duplican (Priority: P1)

Como admin quiero que el tab activo de cada sub-nav se vea claramente y que el área de estadísticas tenga una sola fila de tabs, para no confundirme navegando.

**Why this priority**: el CEO lo detectó en prod; el tab activo invisible afecta a Comité, Operadores y Estadísticas.

**Independent Test**: abrir operación (una sola fila de tabs), comité y operadores — el tab activo es una píldora verde visible.

**Acceptance Scenarios**:

1. **Given** `/dashboard/admin/estadisticas/operacion`, **Then** hay UNA sola fila de navegación (el sub-nav de SPEC-179); el nav interno del componente no existe.
2. **Given** cualquier sub-nav del admin (Estadísticas, Comité, Operadores), **Then** el tab activo usa `bg-pino` (píldora verde oscura con texto blanco visible).
3. **Given** el tablero operación, **Then** `?tab=clasificacion` sigue mostrando Clasificación (el componente lee el param; la navegación es del sub-nav).

### User Story 2 — Monitoreo worker deja de competir con el tablero (Priority: P2)

Como admin quiero una sola pantalla de salud del sistema, para no dudar cuál mirar.

**Acceptance Scenarios**:

1. **Given** el menú lateral del admin, **Then** ya no aparece "Monitoreo worker".
2. **Given** la URL vieja `/dashboard/admin/monitoreo/worker`, **Then** redirige a `/dashboard/admin/estadisticas/operacion` (sin 404 para bookmarks).

### User Story 3 — La página Dataset explica su propósito (Priority: P3)

Como admin quiero entender qué es el Dataset de entrenamiento al abrir la página.

**Acceptance Scenarios**:

1. **Given** `/dashboard/admin/dataset-entrenamiento`, **Then** un bloque explica en criollo qué es (registros anonimizados de correcciones humanas usados para medir/mejorar el clasificador) y de dónde vienen los datos.

## Requirements *(mandatory)*

- **FR-001**: Eliminar el nav interno de `OperacionTableroClient` (la navegación la da el sub-nav); conservar la lectura de `?tab=`.
- **FR-002**: Reemplazar `bg-accent text-white` por `bg-pino text-white` en `ComiteSubNav.tsx` y `OperadoresSubNav.tsx`.
- **FR-003**: Retirar "Monitoreo worker" de `ADMIN_NAV_ITEMS` y redirigir la ruta a operación.
- **FR-004**: Bloque explicativo del propósito en la página Dataset.
- **FR-005**: `arch:check` verde (aserción B sin el href retirado; redirect documentado), tokens sin subir del piso, tests actualizados.

## Success Criteria

- **SC-001**: El tab activo es visible (contraste real) en los 3 sub-navs; una sola fila de tabs en operación.
- **SC-002**: Cero ocurrencias de `bg-accent` a secas en `src/`.
- **SC-003**: Gate local completo verde + CI del PR verde.

## Assumptions

- Dataset se queda (opción a del CEO): se aclara el propósito, no se retira.
- El redirect de monitoreo/worker mantiene vivos los bookmarks; el endpoint `/api/health/worker` NO se toca (lo usa el tablero).
