# Cierre: SPEC-177 — Estadísticas del comité de convivencia más útiles

**Fecha**: 2026-08-18 · **Rama**: `work/002-pi-074` · **Modo**: autónomo (cola 002-PI-074, bajo riesgo UX).

## Qué se implementó

Extensión aditiva del endpoint y la página `/dashboard/colegio/comite/estadisticas` con 4 bloques nuevos (todo agregado, cero PII — ni texto de reporte, ni motivo, ni denunciante, ni identificadores):

1. **Tendencia semanal** (8 semanas, lunes–domingo Bogotá): casos creados y resueltos por semana, con semanas en cero incluidas (eje continuo) y barras gemelas.
2. **Cumplimiento SLA**: a tiempo (`resueltoEn <= alerta.vencimientoSla`) vs vencidos (resuelto tarde o pendiente ya vencido) vs sin SLA (casos sin alerta vinculada), con % a tiempo (null si no hay evaluables).
3. **Tiempo medio de resolución por categoría** (días, 1 decimal, ordenado desc; vía `reporte.clasificacion.categoria`, mismo origen que el top existente).
4. **Distribución por estado con %** (`distribucionEstado`; las claves viejas del DTO quedaron intactas — contrato aditivo).

## Detalles de implementación

- Repositorio: 3 métodos nuevos con select mínimo y agregación en JS (volumen por colegio bajo; evita SQL crudo). Helper `lunesSemanaBogota` duplicado localmente a propósito (no arrastrar email/colas al DAL — documentado en código).
- Servicio: `Promise.all` de los 4 agregados en `estadisticas()`.
- Endpoint: sin cambios (el DTO extendido fluye solo).
- Página: 4 bloques con tokens del proyecto (pino/ambar/rubi/tinta, cero color crudo), tooltips criollos vía `Tooltip` accesible, estados vacíos "Todavía no hay…".

## Evidencia

- Integration `route.test.ts`: 12/12 (6 previos + 6 nuevos: tendencia con huecos, SLA 3 vías + %, tiempo medio 2 categorías, distribución %, aislamiento A/B, colegio vacío con nulls) + asserts de claves sin PII.
- Unit `ComiteEstadisticas.test.tsx`: 2/2 (bloques con datos falsos + estado vacío).
- `arch:check` VERDE sin regenerar (sin rutas ni modelos nuevos) · eslint --no-cache limpio · tokens bajo el piso.
- Gate completo: anexo en el PR.

## Nota

- El unit test del componente usa props directas (la página fetchea server-side) en vez de `vi.stubGlobal("fetch")` — mismo cubrimiento, más simple.
- Sin migraciones, sin cambios de modelo, sin tocar el motor.
