# Contract — Payload de endpoints admin colegios (SPEC-303)

**Fecha**: 2026-08-29 · **Autor**: Dev PI-1 (`idc-be`)

Contrato de forma de la respuesta de los dos endpoints admin afectados. Ambos son **aditivos** — el shape existente se conserva y se le suman dos bloques nuevos (`umbralesSemaforo` y, en el detalle, `actividadReportes`).

## Endpoint 1 — `GET /api/admin/analytics/colegios` (listado)

**Auth**: requiere sesión con `verificarAccesoPagina("analytics_colegios")`.

**Query params**: los ya existentes (paginación, filtros); ninguno nuevo en Fase 1.

**Response shape (aditivo)**:

```jsonc
{
  // Bloque existente: array de items del listado (no se modifica su estructura interna;
  // se le añade UN campo `totalReportes` por item con el número de reportes de los
  // últimos N días — donde N = analytics.colegios.periodo_default_dias).
  "items": [
    {
      "colegioId": "cl_abc...",
      "nombre": "Sagrado Corazón",
      // ... (todos los campos actuales del listado)
      "semaforo": "verde" | "amarillo" | "rojo",
      "totalReportes": 45,          // NUEVO · SC-004 (columna "Reportes")
      "motivoNoVerde": "12 casos abiertos"  // NUEVO · string breve (≤ 60 chars) o null si verde. SC-003.
    }
    // ...
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 47, "totalPages": 2 },
  // Bloque NUEVO · umbrales vigentes leídos de ParametroSistema (analytics.colegios.*)
  "umbralesSemaforo": {
    "casos_abiertos_alto": 5,
    "casos_sin_movimiento_dias": 14,
    "porcentaje_procesado_min": 0.7,
    "inactividad_alerta_dias": 45,
    "spam_alerta_pct": 0.5,
    "resolucion_comite_ok_pct": 0.8,
    "periodo_default_dias": 30
  }
}
```

**Notas del contrato**:

- `totalReportes` es el resultado de `actividadDelColegio(colegioId, últimos periodo_default_dias).total` para cada colegio del listado. Se computa una vez por request y se paraleliza con `Promise.all` sobre los items visibles de la página (nunca N+1 si se necesita optimizar; ver research §D4).
- `motivoNoVerde` es el hallazgo con mayor peso citado en < 60 chars. `null` para colegios verdes. NO expone datos personales.
- `umbralesSemaforo` incluye TODAS las 8 keys del namespace `analytics.colegios.*` (5 preexistentes + 3 nuevas). Excluye `cache_ttl_min` que es infra pura si el equipo prefiere (verificar en `/speckit-implement`).

## Endpoint 2 — `GET /api/admin/analytics/colegios/[id]` (detalle)

**Auth**: idem listado.

**Path param**: `id` = `colegioId`.

**Response shape (aditivo)**:

```jsonc
{
  // Bloque existente del detalle (todos los campos actuales conservados)
  "colegio": {
    "id": "cl_abc...",
    "nombre": "Sagrado Corazón",
    // ... (todos los campos del detalle actual)
    "semaforo": "verde" | "amarillo" | "rojo",
    "hallazgos": [ /* ... existente ... */ ]
  },
  // Bloque NUEVO · reemplaza el "Sin datos" de la sección 3 de la ficha
  "actividadReportes": {
    "total": 45,
    "porEstado": {
      "CLASIFICADO": 40,
      "REVISION_MANUAL": 3,
      "POSIBLE_SPAM": 2
      // ... otros estados si aparecen · siempre solo los NO-PENDIENTE
    },
    "casosAbiertos": 3,           // alertas no-cerradas + expedientes activos
    "ultimaActividad": "2026-08-27T14:35:00Z" | null,
    "rango": {
      "desde": "2026-07-30T00:00:00Z",
      "hasta": "2026-08-29T23:59:59Z",
      "periodoDias": 30
    }
  },
  // Bloque NUEVO · idem umbralesSemaforo del listado
  "umbralesSemaforo": {
    "casos_abiertos_alto": 5,
    "casos_sin_movimiento_dias": 14,
    "porcentaje_procesado_min": 0.7,
    "inactividad_alerta_dias": 45,
    "spam_alerta_pct": 0.5,
    "resolucion_comite_ok_pct": 0.8,
    "periodo_default_dias": 30
  }
}
```

**Notas del contrato**:

- `actividadReportes` proviene directamente de `ColegioActividadRepository.actividadDelColegio(colegioId, rango)`. El `rango` se calcula del último `periodo_default_dias` en el momento del request (`hasta = ahora`, `desde = ahora - periodoDias`).
- `porEstado` puede omitir claves con conteo 0 (a criterio del backend); el frontend debe tolerarlo.
- `actividadReportes.rango` es informativo para el frontend (muestra "últimos 30 días" o similar).

## Compatibilidad hacia atrás

Los bloques `umbralesSemaforo` y `actividadReportes` (y los campos `totalReportes`, `motivoNoVerde` en items del listado) son **aditivos**. Ningún consumidor existente del payload se rompe porque:

- Los consumidores actuales leen campos por nombre y no fallan si aparecen extras.
- Los tipos TypeScript se amplían en el mismo PR (constitución §3.1 · sin `any`).

## Contrato de error

- **401** — Sin sesión.
- **403** — Rol no autorizado (`verificarAccesoPagina` deniega).
- **404** — `colegioId` no existe (solo endpoint detalle).
- **400** — `rango.desde > rango.hasta` (esto NO se activa en Fase 1 porque el rango no es user-input, es derivado de `periodo_default_dias`; el candado queda para futuros PRs que expongan rango en query).
- **500** — Error inesperado. El endpoint NO expone stack traces (constitución §3.4).

## Contrato de tipos TypeScript

Los tipos se definen en un archivo compartido (probablemente `src/types/analytics-colegios.ts` o análogo — verificar existencia durante `/speckit-implement`; si no existe, se crea junto al primer consumo). El repo `ColegioActividadRepository` exporta su tipo de retorno para que endpoint y frontend lo importen sin duplicar shape.
