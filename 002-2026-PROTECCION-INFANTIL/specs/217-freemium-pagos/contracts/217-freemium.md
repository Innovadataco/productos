# Contratos de API — SPEC-217

## GET /api/pagos/suscripcion

Devuelve el estado de la suscripción del cliente autenticado, incluyendo datos de freemium.

### Response 200 (freemium activo)

```json
{
  "id": "cuid",
  "estado": "ACTIVA",
  "esFreemium": true,
  "freemiumFechaFin": "2026-09-22T23:59:59-05:00",
  "diasRestantesFreemium": 30,
  "plan": { "duracion": "MES_1", "precioBaseUSD": 10 },
  "fechaInicio": "2026-08-23T00:00:00-05:00",
  "fechaFin": "2026-09-22T23:59:59-05:00"
}
```

### Response 200 (sin freemium)

```json
{
  "id": "cuid",
  "estado": "ACTIVA",
  "esFreemium": false,
  "freemiumFechaFin": null,
  "diasRestantesFreemium": null,
  "plan": { "duracion": "MES_12", "precioBaseUSD": 100 },
  "fechaInicio": "2026-08-23T00:00:00-05:00",
  "fechaFin": "2027-08-22T23:59:59-05:00"
}
```

## Flujo interno: creación de suscripción

No es un endpoint directo. Al crear `Suscripcion`:

1. Si `pagos.freemium.activo = false` → omitir.
2. Si el titular ya tuvo freemium histórico → omitir.
3. Buscar plan `MES_1` del rol y año actual.
4. Crear suscripción con:
   - `estado = ACTIVA`
   - `esFreemium = true`
   - `fechaInicio = now Bogotá`
   - `freemiumFechaFin = fechaInicio + pagos.freemium.duracion_dias`
   - `fechaFin = freemiumFechaFin`
   - `planActualId = plan básico`
5. Registrar `AuditLog`.
6. Programar notificaciones T-7, T-1, T=0 (vía SPEC-213).

## Flujo interno: autorización de pago durante freemium

1. Cambiar `esFreemium = false`.
2. Calcular `fechaFin = max(freemiumFechaFin, hoy Bogotá) + duracionCubierta`.
3. Actualizar `fechaCorteProgramado`.
4. Registrar `AuditLog`.
