# Feature Specification: SPEC-179 — Sub-nav del área Estadísticas del admin (I-59)

**Feature Branch**: `work/002-pi-nocturno-20260817` (parche sobre PR #55)

**Created**: 2026-08-18

**Status**: IMPLEMENTADO

**Implementación** (2026-08-18): ver [cierre.md](./cierre.md). Sub-nav con Operación · Clasificación · Motor montado en ambas páginas; aserción B evalúa los 3 hrefs (97 totales). Flake de timing en OperacionTableroClient.test.tsx corregido (getAllByText).

Impacto en arquitectura: restaura un sub-nav en el área `/dashboard/admin/estadisticas` con 3 destinos (Operación, Clasificación, Motor). Sin cambios de permisos (todo usa el módulo `estadisticas`, que ADMIN ya tiene), sin modelo, sin endpoints.

**Input**: Instructivo I-59. Contexto: SPEC-171 renovó `/dashboard/admin/estadisticas/operacion` (tablero con 6 semáforos + widgets) fusionando Clasificación como sub-tab por `?tab=`, y SPEC-172 creó `/dashboard/admin/estadisticas/motor` (deriva). Al fusionar, el `DashboardSubNav` anterior se retiró (sus 2 hrefs quedaban muertos) y la página Motor nació sin entrada de navegación: hoy ambos tableros solo se alcanzan por URL directa.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El admin navega entre los tableros de estadísticas sin conocer las URLs (Priority: P1)

Como admin quiero ver las pestañas del área de estadísticas (Operación, Clasificación, Motor) en la pantalla, para moverme entre tableros sin adivinar direcciones.

**Why this priority**: funcionalidad entregada e inaccesible por navegación = no existe para el usuario (I-59).

**Independent Test**: entrar a `/dashboard/admin/estadisticas/operacion` y verificar que hay tabs visibles hacia Clasificación y Motor; entrar a Motor y verificar tabs de vuelta.

**Acceptance Scenarios**:

1. **Given** `/dashboard/admin/estadisticas/operacion`, **Then** se ve un sub-nav con exactamente 3 destinos: "Operación" (la propia página), "Clasificación" (`?tab=clasificacion`) y "Motor" (`/dashboard/admin/estadisticas/motor`).
2. **Given** el sub-nav, **Then** el destino activo se marca según la página/tab actual (incluyendo `?tab=clasificacion`).
3. **Given** `/dashboard/admin/estadisticas/motor`, **Then** el mismo sub-nav aparece con "Motor" activo.
4. **Given** el sub-nav, **Then** todos sus hrefs pasan la aserción B del arch:check ("el menú no miente": href pintado = alcanzable por el rol).
5. **Given** un ADMIN sin cambios de permisos, **Then** todo sigue bajo el módulo `estadisticas` (sin claves nuevas, sin seed).

---

### Edge Cases

- URL vieja `/dashboard/admin/estadisticas/clasificacion`: sigue redirigiendo a `operacion?tab=clasificacion` (SPEC-171) y el sub-nav marca "Clasificación".
- `?tab=` con valor inválido: cae al tab por defecto y el sub-nav marca "Operación" (comportamiento actual del tablero).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El área de estadísticas del admin DEBE mostrar un sub-nav con 3 destinos: Operación, Clasificación (`?tab=clasificacion`), Motor.
- **FR-002**: El sub-nav DEBE aparecer al menos en la página de operación (tablero) y en la página motor; el destino activo se marca correctamente incluyendo el tab por query param.
- **FR-003**: El componente DEBE seguir el patrón existente de sub-navs del admin (filtrado por `esDestinoPermitidoPorRol`, hrefs literales parseables por la aserción B del arch:check).
- **FR-004**: Sin cambios de permisos, catálogo de módulos, proxy, modelo ni endpoints.
- **FR-005**: `docs/architecture/` regenerado y `arch:check` verde (aserción B incluye los hrefs nuevos).

### Key Entities

- **Sub-nav del área** (componente UI): tabs declaradas con hrefs literales (patrón `OperadoresSubNav.tabs`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde cualquier página del área de estadísticas se llega a las otras dos en 1 clic.
- **SC-002**: `arch:check` verde con los hrefs del sub-nav evaluados por la aserción B.
- **SC-003**: Gate local completo verde y CI del PR #55 verde tras el push.

## Assumptions

- El sub-nav vuelve como componente del área (no como item del menú lateral admin): el menú lateral ya tiene "Dashboard" → `/dashboard/admin/estadisticas` (módulo `estadisticas`).
- El tablero de operación conserva sus tabs internos por `?tab=`; el sub-nav apunta a ellos con hrefs reales (navegación por URL compartible — mejora sobre el estado actual).
- Los hrefs con query (`?tab=clasificacion`) son válidos para la aserción B si el predicado evalúa el pathname (verificar en implementación; si la aserción exige href sin query, el sub-nav usa el pathname y el tab queda como default visual — se documenta).
