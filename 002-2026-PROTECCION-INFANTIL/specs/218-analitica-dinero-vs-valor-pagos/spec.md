# SPEC-218 · Analítica dinero-vs-valor (002-PI-118)

> Status: `PLANEADO`
> PI: 002-PI-118
> Responsable: ODIN
> Rama: `work/002-PI-pagos-planes-lote3`
> Base: `feature/001-scaffolding`

## Contexto

Dashboard "motivar a la acción" del Módulo Pagos. Reemplaza el stub de analítica dejado por SPEC-212 con 4 widgets aprobados por CEO y una fila de KPIs base. Se implementa sin IA, usando SQL agregado y reglas simples. Depende de SPEC-210 (modelos) y SPEC-213 (datos de transiciones y pagos autorizados). Sigue D-72 (reutilizar módulos vivos) y D-74 (color `ambar`).

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como admin, quiero ver los vencimientos de esta semana, para llamar a los clientes antes de que corten. | Must |
| US-002 | Como admin, quiero identificar mora larga, para ofrecer bonos de retención. | Must |
| US-003 | Como admin, quiero detectar padres pagantes de colegios no renovados, para rescatar la cuenta institucional. | Must |
| US-004 | Como admin, quiero ver crecimiento anómalo por país/ciudad, para decidir dónde invertir. | Must |
| US-005 | Como admin, quiero ver KPIs de recaudo, suscripciones y conversión, para tener panorama general. | Must |

## Acceptance Scenarios

### AS-001 · Vencimientos esta semana
**Given** suscripciones `ACTIVA` con `fechaFin` entre hoy y hoy+7  
**When** admin abre la analítica  
**Then** ve lista ordenada con nombre, rol, fecha fin y botón "Copiar contactos".

### AS-002 · Mora larga
**Given** suscripciones `EN_GRACIA` o `SUSPENDIDA` con más de 30 días de mora  
**When** admin abre la analítica  
**Then** ve tarjetas rojas ordenadas por días de mora con acción "Crear bono ad-hoc".

### AS-003 · Padres pagantes de colegios no renovados
**Given** padres `ACTIVOS` cuyo colegio vinculado está `SUSPENDIDA`/`CANCELADA`  
**When** admin abre la analítica  
**Then** ve lista con card resaltada y contacto del rector.

### AS-004 · Crecimiento anómalo por país/ciudad
**Given** histórico de suscripciones/pagos por país y mes  
**When** admin abre la analítica  
**Then** ve gráfica de barras y alertas de cambio >25%.

### AS-005 · KPIs
**Given** datos de pagos y suscripciones  
**When** admin abre la analítica  
**Then** ve recaudo mes vs mes, conteos por estado, nuevas, renovaciones, ticket promedio, LTV, conversión freemium, tasa referidos.

## Functional Requirements

- **FR-001**: El sistema DEBE agregar un tab "Dinero vs Valor" en `/dashboard/admin/estadisticas` (D-72) o reemplazar el stub de SPEC-212 si ya existe una ruta propia.
- **FR-002**: El sistema DEBE reutilizar componentes de charts vivos en `/dashboard/admin/estadisticas/operacion/*` (BarChart, DonutChart, KPI cards).
- **FR-003**: El sistema DEBE implementar exactamente los 4 widgets del BRIEF §9.1:
  - Vencimientos esta semana.
  - Mora larga (>30 días).
  - Padres pagantes de colegios no renovados.
  - Crecimiento anómalo por país/ciudad (>25%).
- **FR-004**: El sistema DEBE mostrar los KPIs del BRIEF §9.2 en fila superior.
- **FR-005**: Cada widget DEBE consultar datos a través de `PagosRepository` con una sola query agregada (sin N+1).
- **FR-006**: El sistema DEBE cachear resultados por widget durante 60s (`pagos.analitica.cache_segundos`).
- **FR-007**: El sistema DEBE usar `date-fns-tz` con `America/Bogota` para agrupaciones por día/semana/mes.
- **FR-008**: El sistema DEBE usar la paleta `ambar` para la sección Pagos (D-74).
- **FR-009**: El layout DEBE ser responsive: 1 columna mobile, 2 tablet, 4 desktop.
- **FR-010**: El sistema NO DEBE usar IA ni `src/lib/ai/**`.
- **FR-011**: El sistema DEBE registrar `AuditLog` al exportar datos (si aplica exportación).

## Non-Functional Requirements

- **NFR-001**: Gate local completo.
- **NFR-002**: Tiempo de carga inicial < 2s en BD local.
- **NFR-003**: Contraste WCAG AA en labels y ejes.
- **NFR-004**: Tests de agregación con `date-fns-tz` Bogotá.

## Success Criteria

- **SC-001**: 4 widgets §9.1 renderizados y funcionales.
- **SC-002**: KPIs §9.2 en fila superior con valores correctos.
- **SC-003**: Cero uso de IA/`src/lib/ai/**`.
- **SC-004**: Tests de agregación sin drift de timezone.
- **SC-005**: Responsive verificado en breakpoints.
- **SC-006**: CI 6/6 verde.

## Assumptions

- SPEC-210 dejó modelos poblables.
- SPEC-213 genera datos de estados y pagos.
- SPEC-212 dejó un stub que se reemplaza.
- Existen componentes de charts en `/dashboard/admin/estadisticas/operacion/*`.

## Decisiones propuestas / Deuda

1. **Ubicación**: tab en `/dashboard/admin/estadisticas` (D-72 reutilizar), no ruta paralela `/dashboard/admin/pagos/analitica`.
2. **Caché**: caché en memoria por widget por 60s; invalidación manual al cambiar parámetro.
3. **Detección de anomalía**: cambio porcentual mes a mes >25%; v1 sin IA.
4. **Deuda técnica**: vinculación padre-colegio por "email domain" puede ser imprecisa; si existe relación explícita en modelo, usarla preferentemente.
