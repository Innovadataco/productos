# Contratos de API — SPEC-227 · Historial de recomendaciones

## Autenticación y permisos (los tres endpoints)

- Cookie `token` con JWT válido, rol `ADMIN` (`verifyAuth(RolUsuario.ADMIN)`).
- Módulo permisible `analisis_recomendaciones` otorgado (`assertModulo`).
- Rate limit scope `admin_read`.
- Errores canónicos: `400` filtro inválido · `401` sin sesión · `403` sin módulo/rol · `413` export excede tope · `429` rate limit · `500` interno (nunca stack trace).

## Filtros comunes (query params)

| Param | Tipo | Notas |
|-------|------|-------|
| `estado` | `PENDIENTE\|APLICADA\|IGNORADA\|EXPIRADA` | opcional |
| `reglaId` | string | opcional |
| `categoria` | string | opcional |
| `sujetoTipo` | `Suscripcion\|Colegio\|Usuario` | opcional |
| `sujetoId` | string | opcional |
| `ejecutadaAutomatica` | `true\|false` | opcional |
| `desde` / `hasta` | `YYYY-MM-DD` | día calendario `America/Bogota` (desde 00:00, hasta 23:59:59.999) |

## GET /api/admin/analisis/recomendaciones

Query: filtros comunes + `page` (default 1) + `pageSize` (default 25, máx 100).

### Response 200

```json
{
  "items": [
    {
      "id": "cuid",
      "titulo": "Llama a Colegio Ejemplo · vence 2026-08-30",
      "regla": { "id": "cuid", "clave": "vencimiento.T_menos_7", "nombre": "Llamar a clientes que vencen esta semana" },
      "categoria": "renovacion",
      "prioridad": 80,
      "estado": "PENDIENTE",
      "generadaEn": "2026-08-23T14:05:00-05:00",
      "resueltaEn": null,
      "ejecutadaAutomatica": false,
      "sujetoTipo": "Suscripcion",
      "sujetoId": "cuid"
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 132, "totalPages": 6 }
}
```

### Response 400

```json
{ "error": { "message": "Parámetro 'estado' inválido", "code": "VALIDATION_ERROR" } }
```

## GET /api/admin/analisis/recomendaciones/metricas

Query: filtros comunes (sin paginación).

### Response 200

```json
{
  "rango": { "desde": "2026-08-01", "hasta": "2026-08-31" },
  "totalGeneradas": 132,
  "totalResueltas": 110,
  "pendientes": 22,
  "tasaAplicacionPct": 45.5,
  "tasaIgnoradaPct": 40.0,
  "tasaExpiradaPct": 14.5,
  "tiempoPromedioResolucionHoras": 26.4,
  "umbralAlertaIgnoradaPct": 70,
  "porRegla": [
    {
      "reglaId": "cuid",
      "reglaClave": "mora.T_mas_30",
      "reglaNombre": "Mora larga · sugerir bono de retención",
      "totalGeneradas": 10,
      "tasaAplicacionPct": 20.0,
      "tasaIgnoradaPct": 80.0,
      "tasaExpiradaPct": 0.0,
      "tiempoPromedioResolucionHoras": 31.2,
      "sobreUmbralAlerta": true
    }
  ]
}
```

- Tasas calculadas sobre resueltas (`APLICADA + IGNORADA + EXPIRADA`); `null` si `totalResueltas = 0` (UI muestra "—").
- `porRegla` ordenado por `tasaIgnoradaPct` descendente.

## GET /api/admin/analisis/recomendaciones/export

Query: filtros comunes (sin paginación). Respeta tope `analisis.recomendaciones.export_max_filas` (default 5000).

### Response 200

```text
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="recomendaciones-20260824-0915.csv"

recomendacion_id,regla_clave,regla_nombre,categoria,prioridad,estado,generada_en,resuelta_en,tiempo_resolucion_horas,ejecutada_automatica,sujeto_tipo,sujeto_hash
ckx1...,vencimiento.T_menos_7,"Llamar a clientes que vencen esta semana",renovacion,80,APLICADA,2026-08-20T14:05:00-05:00,2026-08-21T09:30:00-05:00,19.4,false,Suscripcion,9f2ab41c7d05e3aa
```

- `sujeto_hash` = SHA-256(`sujetoId` + `ANALISIS_EXPORT_SALT`) truncado a 16 hex; vacío si `sujetoId` es null.
- El CSV NO incluye `titulo`, `descripcion` ni `datosContexto` (posible PII renderizada).
- Efecto lateral: `AuditLog` con acción de exportación, filtros y conteo de filas.

### Response 413

```json
{ "error": { "message": "El conjunto filtrado supera el máximo de 5000 filas. Refina los filtros.", "code": "PAYLOAD_TOO_LARGE" } }
```
