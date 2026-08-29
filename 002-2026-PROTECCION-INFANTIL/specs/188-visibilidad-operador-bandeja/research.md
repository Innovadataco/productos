# Research: SPEC-188 — Visibilidad del operador en la bandeja

## Contexto

La bandeja de reportes (`/dashboard/admin/reportes`) permite revisar casos. El backend ya filtra por `operadorId`, pero la UI no muestra ni permite filtrar por operador. El CEO necesita visibilidad operativa.

El timeline "Ver proceso" (SPEC-155) combina `TransicionReporte` y `ReintentoReporte`. Falta incluir eventos de asignación de operador que ya se registran en `AuditLog`.

## Decisiones de diseño

- **Columna + filtro en bandeja**: reutilizar el patrón de filtros de SPEC-181 (dropdown con opciones cargadas de endpoint).
- **Timeline**: extender el servicio existente con un tercer tipo de evento, manteniendo orden cronológico.
- **Frontera DAL**: acceso a `AuditLog` via `AuditLogRepository`.

## Alternativas descartadas

- **Nueva tabla de asignaciones**: innecesaria; `AuditLog` ya registra la historia.
- **Mostrar operador solo en detalle**: no resuelve el problema de visibilidad de la bandeja.
