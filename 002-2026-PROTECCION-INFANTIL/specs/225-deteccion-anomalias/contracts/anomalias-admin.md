# Contratos de API — SPEC-225

## Autenticación y permisos

- Cookie `token` con JWT válido (`verifyAuth`, `src/lib/auth.ts`).
- Rol requerido: `ADMIN` en los tres endpoints. Otros roles → `403`; sin sesión → `401`.
- Las respuestas nunca incluyen texto de reportes ni PII; `datosContexto` solo contiene agregados.

## GET /api/admin/analisis/anomalias

Lista paginada de anomalías, ordenadas por `detectadaEn` descendente.

### Query params

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `page` | int ≥ 1 | 1 | Página |
| `pageSize` | int 1–100 | 25 | Tamaño de página |
| `tipo` | `TipoAnomalia` | — | Filtra por tipo exacto |
| `severidad` | `BAJA`/`MEDIA`/`ALTA` | — | Filtra por severidad |
| `estado` | `ABIERTAS`/`RESUELTAS`/`TODAS` | `ABIERTAS` | `ABIERTAS` = `resueltaEn IS NULL` |

Valores inválidos de `tipo`/`severidad`/`estado` → `400`.

### Response 200

```json
{
  "items": [
    {
      "id": "cuid",
      "tipo": "CAIDA_RECAUDO_CIUDAD",
      "sujetoTipo": "Ciudad",
      "sujetoId": "cuid-ciudad",
      "severidad": "ALTA",
      "descripcion": "El recaudo autorizado en Cali cayó 41% respecto a la semana anterior.",
      "detectadaEn": "2026-08-24T13:00:00.000Z",
      "resueltaEn": null,
      "resueltaPorAdminId": null
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 1, "totalPages": 1 }
}
```

## GET /api/admin/analisis/anomalias/[id]

Detalle de una anomalía, incluyendo `datosContexto`.

### Response 200

```json
{
  "id": "cuid",
  "tipo": "CAIDA_RECAUDO_CIUDAD",
  "sujetoTipo": "Ciudad",
  "sujetoId": "cuid-ciudad",
  "severidad": "ALTA",
  "descripcion": "El recaudo autorizado en Cali cayó 41% respecto a la semana anterior.",
  "datosContexto": {
    "ciudad": "Cali",
    "recaudoSemanaActualUSD": 590,
    "recaudoSemanaAnteriorUSD": 1000,
    "variacionPct": -41,
    "umbralPct": 30,
    "ventanaInicio": "2026-08-17",
    "ventanaFin": "2026-08-23"
  },
  "detectadaEn": "2026-08-24T13:00:00.000Z",
  "resueltaEn": null,
  "resueltaPorAdminId": null
}
```

### Response 404

```json
{ "error": "Anomalía no encontrada" }
```

## PATCH /api/admin/analisis/anomalias/[id]

Marca la anomalía como resuelta. Registra `AuditLog` (metadatos, sin PII).

### Request

```json
{ "notaResolucion": "Se contactó al colegio y se acordó plan de pagos." }
```

`notaResolucion` opcional, máx 500 caracteres; se persiste dentro de `datosContexto.notaResolucion` (merge aditivo) o se descarta si el producto decide no conservarlo — decisión final en implementación. Body vacío `{}` también es válido.

### Response 200

```json
{
  "id": "cuid",
  "resueltaEn": "2026-08-24T15:30:00.000Z",
  "resueltaPorAdminId": "cuid-admin"
}
```

### Response 404

```json
{ "error": "Anomalía no encontrada" }
```

### Response 409

```json
{ "error": "La anomalía ya fue resuelta" }
```

## Evento Motor Notif (contrato interno)

| Campo | Valor |
|---|---|
| `evento` | `analisis.anomalia.detectada` |
| `sujetoTipo` / `sujetoId` | `"Anomalia"` / id de la anomalía |
| `destinatarios` | un `usuarioId` por usuario `ADMIN` activo |
| `variables` | `tipoAnomalia`, `severidad`, `descripcion`, `fechaDeteccion`, `urlAnomalia` |
| Disparo | solo severidad `ALTA`, dentro del tick que la crea, si `analisis.anomalias.email_inmediato_habilitado = true` |
