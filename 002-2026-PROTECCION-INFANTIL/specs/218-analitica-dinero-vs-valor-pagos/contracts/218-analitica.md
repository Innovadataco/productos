# Contratos de API — SPEC-218

## GET /api/admin/estadisticas/dinero-vs-valor

Devuelve datos agregados para el dashboard. Requiere rol `ADMIN`.

### Response 200

```json
{
  "kpi": {
    "recaudoMesActualUSD": 1500,
    "recaudoMesAnteriorUSD": 1200,
    "variacionRecaudoPct": 25,
    "activas": 45,
    "enGracia": 5,
    "suspendidas": 3,
    "canceladas": 2,
    "nuevasEsteMes": 8,
    "renovacionesEsteMes": 12,
    "ticketPromedioUSD": 75,
    "ltvUSD": 225,
    "conversionFreemiumPct": 60,
    "tasaReferidosPct": 20
  },
  "widgets": {
    "vencimientosEstaSemana": {
      "total": 7,
      "items": [
        { "suscripcionId": "cuid", "nombre": "Colegio Andino", "rol": "COLEGIO", "fechaFin": "2026-08-29", "diasRestantes": 6 }
      ]
    },
    "moraLarga": {
      "total": 4,
      "items": [
        { "suscripcionId": "cuid", "nombre": "Padre López", "rol": "PADRE", "diasMora": 35, "estado": "SUSPENDIDA" }
      ]
    },
    "padresPagantesColegiosCaidos": {
      "total": 2,
      "items": [
        { "padreId": "cuid", "padreNombre": "Ana R.", "colegioId": "cuid", "colegioNombre": "Colegio Beta", "colegioEstado": "SUSPENDIDA", "rectorEmail": "rector@beta.edu" }
      ]
    },
    "crecimientoPaisCiudad": {
      "labels": ["2026-06", "2026-07", "2026-08"],
      "series": [
        { "pais": "CO", "data": [10, 12, 18], "variacionPct": 50, "alerta": "crecimiento_alto" },
        { "pais": "CL", "data": [5, 4, 3], "variacionPct": -40, "alerta": "crecimiento_bajo" }
      ]
    }
  }
}
```

## Cache

- Cada widget se cachea 60s en memoria del servidor.
- Header `x-cache: HIT | MISS` opcional para debugging.
