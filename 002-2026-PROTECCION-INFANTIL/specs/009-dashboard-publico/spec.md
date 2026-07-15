# Feature Specification: Dashboard Público

**Feature Branch**: `feature/009-dashboard-publico`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Página pública de estadísticas agregadas sobre identificadores reportados: total de reportes, identificadores visibles, distribución por plataforma/categoría, últimos identificadores reportados y score promedio."

---

## User Scenarios & Testing

### User Story 1 — Resumen de estadísticas (Priority: P1) 🎯 MVP

Un visitante anónimo puede ver cifras agregadas del sistema sin datos personales ni textos originales.

**Why this priority**: Transparencia y valor público; muestra actividad de la plataforma.

**Independent Test**: Acceder a `/dashboard-publico` y ver tarjetas con total de reportes, identificadores visibles y score promedio.

**Acceptance Scenarios**:

1. **Given** un visitante anónimo, **When** accede a `/dashboard-publico`, **Then** ve el total de reportes procesados.
2. **Given** un visitante anónimo, **When** accede al dashboard, **Then** ve el número de identificadores visibles públicamente.
3. **Given** un visitante anónimo, **When** accede al dashboard, **Then** ve el score promedio de los identificadores visibles.

---

### User Story 2 — Distribución por plataforma y categoría (Priority: P1) 🎯 MVP

El dashboard muestra gráficos o listados con la distribución de reportes por plataforma y categoría de conducta.

**Why this priority**: Ayuda a entender dónde y cómo se presentan los riesgos.

**Independent Test**: Verificar que el dashboard muestra al menos un gráfico de barras o donut por plataforma y otro por categoría.

**Acceptance Scenarios**:

1. **Given** reportes clasificados en múltiples plataformas, **When** se carga el dashboard, **Then** se muestra la distribución por plataforma.
2. **Given** reportes clasificados en múltiples categorías, **When** se carga el dashboard, **Then** se muestra la distribución por categoría.

---

### User Story 3 — Últimos identificadores reportados (Priority: P2)

El dashboard lista los últimos identificadores que alcanzaron visibilidad pública, con su plataforma, score y nivel de riesgo.

**Why this priority**: Proporciona visibilidad reciente y permite a usuarios consultar identificadores de riesgo.

**Independent Test**: Crear reportes hasta que un identificador sea visible; verificar que aparece en la lista del dashboard.

**Acceptance Scenarios**:

1. **Given** un identificador recién visible, **When** se carga el dashboard, **Then** aparece en la lista de últimos identificadores.
2. **Given** un identificador con score crítico, **When** aparece en la lista, **Then** se destaca visualmente su nivel de riesgo.

---

## Requirements

### Functional Requirements

- **FR-001**: Crear ruta pública `/dashboard-publico`.
- **FR-002**: Crear endpoint `GET /api/admin/estadisticas-publicas` (o similar) que devuelva datos agregados sin PII.
- **FR-003**: El endpoint debe calcular total de reportes, identificadores visibles, score promedio, distribución por plataforma y categoría.
- **FR-004**: El endpoint debe devolver los últimos N identificadores visibles ordenados por `actualizadoEn`.
- **FR-005**: Reutilizar componente `DonutChart` para visualizaciones.
- **FR-006**: La página debe ser estática o ISR con revalidación configurable.

### Non-Functional Requirements

- **NFR-001**: No exponer textos originales, emails ni datos de usuarios.
- **NFR-002**: La consulta debe ser eficiente usando `IdentificadorReportado` ya materializado.
- **NFR-003**: Debe respetar la configuración de visibilidad pública (`visibility.report_threshold`, `visibility.min_authenticated_ratio`).

---

## Success Criteria

- **SC-001**: El dashboard carga en menos de 2 segundos con datos de producción representativos.
- **SC-002**: 100% de los datos mostrados provienen de identificadores marcados como `esVisiblePublicamente=true`.
- **SC-003**: Tests E2E verifican las métricas principales y la lista de identificadores.

---

## Assumptions

- El modelo `IdentificadorReportado` ya existe con `score`, `nivelRiesgo` y `esVisiblePublicamente`.
- El cálculo de visibilidad pública ya está implementado.
