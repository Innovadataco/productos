# Feature Specification: SPEC-177 — Estadísticas del comité de convivencia más útiles

**Feature Branch**: `work/002-pi-074`

**Created**: 2026-08-18

**Status**: IMPLEMENTADO

**Implementación** (2026-08-18): ver [cierre.md](./cierre.md). 4 bloques nuevos (tendencia semanal, SLA, tiempo medio por categoría, distribución con %) — todo agregado, cero PII, contrato aditivo.

Impacto en arquitectura: extiende el DTO y la página de estadísticas del comité (`/dashboard/colegio/comite/estadisticas`) con 4 bloques nuevos de agregados. Sin cambios de modelo, sin migraciones, cero PII.

**Input**: Instructivo 002-PI-074. Contexto: la página de estadísticas del comité (creada en SPEC-173) hoy solo muestra totales por estado, tiempo medio global y top categorías. El comité de convivencia necesita leer tendencia y cumplimiento para gestionar su semana.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El comité lee su operación semanal de un vistazo (Priority: P1)

Como integrante del comité de convivencia quiero ver la tendencia de casos por semana, cuántos casos se resolvieron dentro del SLA y cuánto tardamos por categoría, para saber si vamos al día o nos estamos atrasando.

**Why this priority**: la página existe pero no responde la pregunta operativa real ("¿vamos bien?").

**Independent Test**: abrir `/dashboard/colegio/comite/estadisticas` con datos sembrados y verificar los 4 bloques nuevos con números correctos.

**Acceptance Scenarios**:

1. **Given** la página de estadísticas del comité, **Then** muestra además de lo actual: (a) tendencia semanal de casos creados y resueltos (últimas 8 semanas), (b) cumplimiento SLA (resueltos a tiempo vs vencidos, con %), (c) tiempo medio de resolución por categoría, (d) distribución por estado con porcentajes.
2. **Given** el endpoint `/api/colegio/comite/estadisticas`, **Then** la respuesta incluye los 4 bloques nuevos como agregados numéricos — SIN texto de reportes, SIN denunciante, SIN identificadores de sujetos.
3. **Given** un colegio sin casos resueltos, **Then** los bloques muestran ceros / "sin datos" en lugar de romperse (nulls manejados).
4. **Given** dos colegios con casos, **Then** cada comité ve solo los suyos (aislamiento `colegioId` verificado por test).
5. **Given** el SLA de un caso, **Then** "a tiempo" = `resueltoEn <= alerta.vencimientoSla`; vencidos = los que superaron ese plazo (o siguen abiertos y ya vencidos).

---

### Edge Cases

- Casos sin `alertaColegioId` (escalados antes de SPEC-168 o por otro flujo): no entran al cálculo de SLA (se reportan aparte como "sin SLA").
- Semanas sin casos: la tendencia muestra la semana en cero (continuidad del eje).
- Categoría con un solo caso resuelto: su tiempo medio se muestra igual (muestra pequeña, sin umbral mínimo en esta fase).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El endpoint `/api/colegio/comite/estadisticas` DEBE añadir: `tendenciaSemanal` (8 semanas: creados y resueltos por semana), `sla` ({ aTiempo, vencidos, sinSla, pctATiempo }), `tiempoMedioPorCategoria` (días, por categoría con al menos 1 resuelto), `porEstado` extendido con porcentaje.
- **FR-002**: Todo cálculo DEBE filtrar por `colegioId` del usuario autenticado (tenant-first).
- **FR-003**: Ningún bloque DEBE incluir texto de reporte, motivo, denunciante ni identificadores — solo conteos, porcentajes y tiempos medios.
- **FR-004**: La página DEBE renderizar los 4 bloques con componentes existentes (tarjetas/listas/barras simples), tooltips en criollo donde aporte.
- **FR-005**: Sin cambios de modelo ni migraciones; reuso del servicio/repositorio de bandeja existente.

### Key Entities

- **SolicitudComite** (existente): `creadoEn`, `resueltoEn`, `estado`, `colegioId`, `alertaColegioId` → `alerta.vencimientoSla`.
- **AlertaColegio** (existente, SPEC-166): `vencimientoSla`, `prioridad`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los 4 bloques nuevos se renderizan con números que cuadran con los datos sembrados en test.
- **SC-002**: La respuesta del endpoint contiene cero campos de texto de reporte/denunciante (assert de claves en test).
- **SC-003**: Gate local completo verde y CI del PR verde.

## Assumptions

- Ventana de tendencia: 8 semanas cerradas hacia atrás desde el lunes de la semana actual (America/Bogota), reutilizando el helper de semana si existe o uno local simple.
- "Semana" = lunes a domingo (convención ya usada en SPEC-172).
- El tiempo medio por categoría usa la categoría de la clasificación del reporte asociado (mismo origen que el top de categorías existente).
