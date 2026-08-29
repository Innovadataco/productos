# Contracts · API tasas de cambio · SPEC-214

Todas las rutas requieren rol `ADMIN`.

## `GET /api/admin/pagos/tasas`

Lista tasas vigentes por moneda con flag de desactualización.

**Query params:** `monedaDestino` (opcional).

**Response 200:**
```json
{
  "tasas": [
    {
      "monedaDestino": "COP",
      "tasa": 4000,
      "fecha": "2026-08-22T04:00:00Z",
      "fuente": "API",
      "desactualizada": false,
      "horasDesdeActualizacion": 2
    }
  ]
}
```

## `POST /api/admin/pagos/tasas`

Inyecta tasa manual.

**Body:**
```json
{
  "monedaDestino": "COP",
  "tasa": 4100,
  "motivoManual": "API caída, tasa estimada del día"
}
```

**Response 201:** fila creada en `TasaCambio` con `fuente=ADMIN_MANUAL`.

## Servicio interno

### `calcularMontoLocal(precioNetoUSD: number, monedaDestino: string): Promise<{ montoLocal: number, tasaAplicada: number, desactualizada: boolean } | null>`

Usado por flujos de renovación/autorización (SPECs 211/212). Retorna null si no hay tasa.

### `actualizarTasasDesdeAPI(): Promise<{ ok: boolean, insertadas: number, errores: string[] }>`

Invocado por worker. Consulta API, parsea rates y persiste filas `fuente=API`.
