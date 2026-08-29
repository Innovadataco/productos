# Implementation Plan: SPEC-177 — Estadísticas del comité más útiles

**Branch**: `work/002-pi-074` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

---

## Summary

Extender `ComiteConvivenciaBandejaService.estadisticas()` (y su repositorio) con 4 bloques de agregados + renderizarlos en la página existente. Todo lectura, solo agregados, tenant-first.

---

## Estado actual (verificado en fuente)

- `src/lib/dal/services/comite-convivencia-bandeja.ts:104` — `estadisticas(colegioId)` → `{ casosPorEstado, tiempoMedioResolucionDias, topCategorias }`.
- `src/lib/dal/repositories/comite-convivencia-solicitudes.ts:108` — `estadisticasPorColegio(colegioId, takeTopCategorias)` con groupBy estado + groupBy categoría (vía `reporte.clasificacion`).
- Modelos: `SolicitudComite` tiene `creadoEn`, `resueltoEn`, `estado`, `colegioId`, `alertaColegioId` → `alerta.vencimientoSla` (SPEC-166).
- Endpoint: `src/app/api/colegio/comite/estadisticas/route.ts` (GET, rol comité + módulo bandeja).
- Página: `src/app/dashboard/colegio/comite/estadisticas/page.tsx` + `src/components/modules/colegio/comite/ComiteEstadisticas.tsx`.

---

## Cambios

### 1. Repositorio (`comite-convivencia-solicitudes.ts`)

Nuevos métodos (o extensión de `estadisticasPorColegio`):
- `tendenciaSemanal(colegioId, semanas = 8)`: dos conteos por semana — creados (`creadoEn`) y resueltos (`resueltoEn`) — agrupados por lunes de semana. Implementación: fetch de `creadoEn/resueltoEn` de los casos del colegio en la ventana (select mínimo) y agrupación en JS (el volumen por colegio es bajo; evita SQL crudo).
- `cumplimientoSla(colegioId)`: casos con `resueltoEn` + `alerta.vencimientoSla` → a tiempo si `resueltoEn <= vencimientoSla`; vencidos si `resueltoEn > vencimientoSla` O (estado PENDIENTE ∧ ahora > vencimientoSla); sinSla = sin alerta vinculada.
- `tiempoMedioPorCategoria(colegioId)`: AVG en JS de `resueltoEn - creadoEn` por categoría (join vía `reporte.clasificacion.categoria`, mismo camino del top existente).

### 2. Servicio + DTO

- `EstadisticasComiteDto` += `tendenciaSemanal: Array<{ semanaInicio: string; creados: number; resueltos: number }>`, `sla: { aTiempo: number; vencidos: number; sinSla: number; pctATiempo: number | null }`, `tiempoMedioPorCategoria: Array<{ categoria: string; dias: number; resueltos: number }>`, y `casosPorEstado` pasa a `{ estado, total, pct }[]` (o se añade `pct` sin romper lo viejo).

### 3. Endpoint + página

- El endpoint devuelve el DTO extendido (misma ruta, sin cambio de contrato roto — aditivo).
- `ComiteEstadisticas.tsx`: 4 secciones nuevas con tarjetas/listas/barras simples (Tailwind + tokens), tooltips criollos: "A tiempo = resuelto antes de su fecha límite", etc.

### 4. Tests

- `src/app/api/colegio/comite/estadisticas/route.test.ts` (integration, existente): casos nuevos — tendencia con semanas en cero incluidas, SLA a tiempo/vencido/sinSla, tiempo medio por categoría, distribución con %, aislamiento entre dos colegios, assert de claves sin PII.
- Unit del componente si se presta (render de bloques con datos falsos).

### 5. Arquitectura

- Sin rutas ni modelos nuevos → regenerar docs solo si el generador captura el DTO (verificar con arch:check).

---

## Verificación

Gate local completo + CI del PR verde.
