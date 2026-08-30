# Contract — Payload extension `/api/admin/analytics/colegios/[id]` (SPEC-311)

**Fecha**: 2026-08-29 · **Autor**: Dev PI-1 (`idc-be`)

Contrato aditivo. El shape existente de Fase 1 se conserva 100%.

## Endpoint

`GET /api/admin/analytics/colegios/[id]`

**Auth**: sesión ADMIN con `verificarAccesoPagina("analytics_colegios")` (sin cambios).

**Response shape** (aditivo Fase 2):

```jsonc
{
  // === Bloques Fase 1 preservados sin cambios ===
  "infoBasica": { /* ... */ },
  "metricasTamaño": { /* ... */ },
  "actividadReportes": { /* ... */ },
  "actividadReportesCruzada": { /* total, porEstado, casosAbiertos, ultimaActividad, rango */ },
  "comite": { /* ... */ },
  "alertas": { /* ... */ },
  "hallazgos": { /* ... */ },
  "comparacionMedia": { /* ... */ },
  "umbralesSemaforo": { /* ... */ },

  // === Aditivos Fase 2 ===
  "distribucionRol": {
    "padre": 12,
    "estudiante": 0,        // siempre 0 en estado actual del sistema
    "profesor": 3,
    "anonimo": 5
    // invariante: suma === actividadReportesCruzada.total
  },
  "operadoresAsignados": [
    { "id": "u_abc", "nombre": "María González", "email": "maria@innovadataco.com" },
    { "id": "u_xyz", "nombre": "Carlos Ruiz", "email": "carlos@innovadataco.com" }
  ],
  "lineaTiempo": {
    "fechaRegistro": "2026-03-15T00:00:00Z",
    "primerReporte": "2026-05-02T14:30:00Z",      // null si sin reportes
    "picoActividad": { "anioMes": "2026-07", "total": 18 },   // null si sin reportes
    "hoy": "2026-08-29T21:25:00Z"
  },
  "serieMensual": [
    { "anioMes": "2026-05", "total": 3 },
    { "anioMes": "2026-06", "total": 8 },
    { "anioMes": "2026-07", "total": 18 },
    { "anioMes": "2026-08", "total": 4 }
  ]
}
```

## Contratos de invariantes

- `distribucionRol.padre + distribucionRol.estudiante + distribucionRol.profesor + distribucionRol.anonimo === actividadReportesCruzada.total`.
- `operadoresAsignados`: DISTINCT por `id`. Orden estable (ASC por `nombre`).
- `lineaTiempo.primerReporte === null` sii el colegio no tiene reportes por ninguna de las 3 rutas de pertenencia.
- `lineaTiempo.picoActividad.total >= 1` cuando no es `null`.
- `serieMensual`: ordenada ASC por `anioMes`. Sin duplicados. Puede tener meses con `total: 0` (relleno de continuidad).
- `sum(serieMensual.total) === actividadTotalAllTime` (total all-time del colegio via `actividadDelColegio`).

## Contrato de error

Idéntico Fase 1:
- **401** — Sin sesión.
- **403** — Rol no ADMIN o sin acceso al módulo `analytics_colegios`.
- **404** — `colegioId` no existe.
- **500** — Error inesperado. NO expone stack trace (constitución §3.4).

## Compatibilidad hacia atrás

Los 4 bloques nuevos son **aditivos**. Ningún consumidor Fase 1 se rompe:
- Los consumidores actuales leen campos por nombre y toleran extras.
- Los tipos TypeScript se amplían en el mismo PR (constitución §3.1 · sin `any`).

## Rendimiento

- 4 queries adicionales (2 subqueries dentro de `actividadDelColegio` all-time, 1 para `operadoresAsignados`, 1 para `distribucionRol`) van en `Promise.all` con las existentes.
- Cache del endpoint (`analytics.colegios.cache_ttl_min` = 5 min default) protege requests subsiguientes.
- SC-009: total del endpoint < 800 ms para el colegio más grande, medido en `quickstart.md`.

## Contrato de tipos TypeScript

`ColegioDetalleResponse` en `src/lib/dal/repositories/analytics-colegio-types.ts` se amplía con los 4 nuevos campos. Todo consumidor (`ColegioDetalleClient.tsx`, tests) los tipifica automáticamente vía el import existente.

## Contrato de UI (rutas CTAs Bloque A)

Los CTAs del componente rediseñado apuntan a:
- `[Ver casos abiertos]` → `/dashboard/admin/reportes?colegioId=<id>&estado=REVISION_MANUAL,POSIBLE_SPAM`
- `[Ver alertas]` → `/dashboard/admin/alertas?colegioId=<id>`

Las rutas destino DEBEN aceptar `?colegioId=` como filtro. Verificación pre-implement en T-0 del `/speckit-tasks`. Si NO admiten:
- (a) Ampliar aditivamente la ruta si es < 20 líneas y trivial.
- (b) Reabrir §4 si es sensible (candado 17 D-98).
