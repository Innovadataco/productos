# Contratos de API — SPEC-222 · Panel principal Análisis

## Autenticación y permisos (todos los endpoints)

- Cookie `token` con JWT válido (`verifyAuth`).
- `assertModulo(user, "estadisticas")` + rol `ADMIN`; cualquier otro rol → `403` (`FORBIDDEN`).
- Rate limit scope `admin_read`; exceso → `429`.
- Errores con formato `{ error: { message, code } }` y códigos canónicos de `src/lib/errors.ts`.

---

## GET /api/admin/analisis/top-decisiones

Hasta 5 recomendaciones pendientes no expiradas para el bloque "Top 5 decisiones hoy".

### Response 200

```json
{
  "items": [
    {
      "id": "cuid",
      "titulo": "Llama a Colegio San José · vence 2026-08-30",
      "descripcion": "Suscripción colegio vence en 6 días",
      "categoria": "renovacion",
      "prioridad": 85,
      "generadaEn": "2026-08-24T08:00:00.000Z",
      "expiraEn": "2026-08-31T04:59:59.000Z",
      "sujetoTipo": "Suscripcion",
      "sujetoId": "cuid",
      "accionSugerida": "llamar",
      "contacto": { "telefono": "+57...", "email": "rector@..." }
    }
  ]
}
```

- Orden: `prioridad DESC, generadaEn ASC`. Máximo 5.
- `contacto` se deriva de `datosContexto`; puede ser `null` (los botones `tel:`/`mailto:` se ocultan).

---

## POST /api/admin/analisis/recomendaciones/[id]/resolver

Marca una recomendación como aplicada o ignorada. Registra `AuditLog`.

### Request

```json
{ "accion": "APLICADA", "motivo": "Llamé al rector, renueva el lunes" }
```

- `accion`: `"APLICADA" | "IGNORADA"` (Zod, requerido).
- `motivo`: string opcional, máx 500 chars.

### Responses

- **200**: `{ "recomendacion": { "id", "estado": "APLICADA", "resueltaEn": "...", "resueltaPorAdminId": "..." } }`
- **400**: body inválido (`VALIDATION_ERROR`).
- **403**: rol no ADMIN.
- **404**: recomendación inexistente.
- **409**: ya estaba resuelta o expirada (`CONFLICT`).

---

## GET /api/admin/analisis/dinero-vs-valor

Agregación por granularidad con filtros globales y drill-down.

### Query params (Zod)

| Param | Tipo | Default | Notas |
|---|---|---|---|
| `granularidad` | `pais\|ciudad\|colegio\|padre\|plan\|cohorte\|canal` | `pais` | |
| `periodo` | `mes\|trimestre\|anio\|custom` | `mes` | Cortes Bogotá |
| `desde`, `hasta` | `YYYY-MM-DD` | — | Requeridos si `periodo=custom`; `desde <= hasta` o `400` |
| `estado` | `ACTIVA\|EN_GRACIA\|SUSPENDIDA\|CANCELADA\|todas` | `todas` | |
| `tipoTitular` | `COLEGIO\|PADRE\|ambos` | `ambos` | |
| `paisId`, `ciudadId`, `colegioId` | string | — | Nivel de drill activo |
| `page`, `pageSize` | int | `1`, `25` | `pageSize` máx 100 |

### Response 200

```json
{
  "items": [
    {
      "clave": "col-antioquia-medellin",
      "etiqueta": "Medellín",
      "suscripciones": 42,
      "recaudoUSD": 3810.5,
      "scorePromedio": 61.2,
      "variacionRecaudoPct": 12.4,
      "semaforo": "pino",
      "drill": { "granularidad": "colegio", "params": { "ciudadId": "..." } }
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 137, "totalPages": 6 },
  "totales": { "suscripciones": 137, "recaudoUSD": 12450.0, "scorePromedio": 58.9, "sinScore": 7 }
}
```

- `semaforo`: `pino` (variación ≥ 0), `ambar` (caída ≤ 25%), `rubi` (caída > 25% — umbral `analisis.anomalias.crecimiento_pct_umbral`).
- `drill` es `null` en el nivel hoja (colegio/padre → navega a `/dashboard/admin/pagos/cliente/[id]`).
- En granularidad `cohorte`, `clave` = `"YYYY-MM"` y `items` incluyen `retenidosPct`.
- En granularidad `canal`, `clave` ∈ `referido|bono|freemium_convertido|directo`.
- En granularidad `ciudad`, padres sin ciudad se agregan en `etiqueta: "Sin ciudad"`.

---

## GET /api/admin/analisis/dispersion

Puntos de la matriz dinero-vs-valor del período.

### Query params

`periodo`, `desde`/`hasta`, `estado`, `tipoTitular` (mismos códigos del endpoint anterior).

### Response 200

```json
{
  "puntos": [
    {
      "suscripcionId": "cuid",
      "cliente": "Colegio San José",
      "tipoTitular": "COLEGIO",
      "montoUSD": 120.0,
      "scoreTotal": 74.5,
      "cuadrante": "estables"
    }
  ],
  "cortes": { "montoUSD": 95.0, "score": 52.0, "fuente": "mediana" },
  "truncado": false,
  "totalSuscripciones": 137,
  "sinScore": 7
}
```

- `cuadrante` ∈ `estables` (alto/alto) · `riesgo` (alto pago / bajo score) · `oportunidad` (bajo pago / alto score) · `atencion` (bajo/bajo).
- `cortes.fuente` = `mediana` | `parametro`.
- Máximo `analisis.panel.dispersion_max_puntos` (default 500); si se trunca, `truncado: true` (los puntos devueltos son una muestra determinística ordenada por `suscripcionId`).

---

## GET /api/admin/analisis/kpis

### Query params

`periodo`, `desde`/`hasta` (mismos códigos).

### Response 200

```json
{
  "kpis": {
    "mau": { "valor": 312, "deltaPct": 4.2 },
    "mrrUSD": { "valor": 5230.0, "deltaPct": 1.8 },
    "churnRatePct": { "valor": 2.1, "deltaPct": -0.4 },
    "ltvUSD": { "valor": 186.4, "deltaPct": 3.0 },
    "renovacionesPct": { "valor": 71.0, "deltaPct": 2.2 },
    "conversionFreemiumPct": { "valor": 18.5, "deltaPct": 1.1 },
    "referidosExitososPct": { "valor": 9.3, "deltaPct": 0.0 }
  },
  "periodo": { "desde": "2026-08-01", "hasta": "2026-08-31", "zona": "America/Bogota" }
}
```

- `deltaPct` es vs el período anterior equivalente; `null` si no hay base de comparación.

---

## GET /api/admin/analisis/anomalias

Anomalías no resueltas, espejo en panel de las alertas del módulo.

### Query params

`severidad` (`ALTA|MEDIA|BAJA|todas`, default `todas`), `page`, `pageSize`.

### Response 200

```json
{
  "items": [
    {
      "id": "cuid",
      "tipo": "CRECIMIENTO_ANOMALO_CIUDAD",
      "severidad": "ALTA",
      "descripcion": "Cali: recaudo semanal -34% vs semana anterior",
      "sujetoTipo": "Ciudad",
      "sujetoId": "cuid",
      "detectadaEn": "2026-08-23T11:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 3, "totalPages": 1 },
  "disponible": true
}
```

- Orden: severidad (`ALTA` → `MEDIA` → `BAJA`), luego `detectadaEn DESC`.
- Si el modelo `Anomalia` no está desplegado: `200` con `{ "items": [], "pagination": {...}, "disponible": false }` (nunca 500).
