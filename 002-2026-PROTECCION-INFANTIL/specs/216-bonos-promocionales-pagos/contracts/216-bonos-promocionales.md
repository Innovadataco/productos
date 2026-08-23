# Contratos de API — SPEC-216

## Autenticación y permisos

- Cookie `token` con JWT válido.
- Rol requerido: `SCHOOL_ADMIN` o `PARENT`.
- El `suscripcionId` debe pertenecer al usuario autenticado (o al colegio del rector).
- Rate-limit `pagos_write`.

## POST /api/pagos/aplicar-bono

Aplica un bono promocional a la suscripción/pago del cliente.

### Request

```json
{
  "suscripcionId": "cuid",
  "codigoBono": "BOGOTA_UNCOLI_2026",
  "esNuevaSuscripcion": false
}
```

### Response 200

```json
{
  "bonoAplicadoId": "cuid",
  "tipo": "DESCUENTO_PCT",
  "valor": 15,
  "descuentoUSD": 15.0,
  "montoBaseUSD": 100.0,
  "montoNetoUSD": 85.0,
  "monedaLocal": "COP",
  "montoNetoLocal": 340000.0,
  "tasaCambioAplicada": 4000.0,
  "combinadoConReferido": false,
  "aplicadoEn": "2026-08-23T10:00:00-05:00"
}
```

### Response 400

```json
{ "error": { "message": "Solicitud inválida", "code": "BAD_REQUEST" } }
```

### Response 401/403

Códigos canónicos de auth.

### Response 409 — Conflictos de negocio

```json
{ "error": { "message": "El bono no está activo o ya venció", "code": "bono_invalido" } }
{ "error": { "message": "Se agotaron los usos de este bono", "code": "bono_tope_global" } }
{ "error": { "message": "Ya usaste este bono", "code": "bono_tope_cliente" } }
{ "error": { "message": "Este bono no aplica a tu perfil", "code": "bono_no_aplica_rol" } }
{ "error": { "message": "Este bono ya fue aplicado", "code": "bono_ya_aplicado" } }
```

## GET /api/pagos/bonos-aplicados (opcional)

Lista los bonos aplicados a la suscripción del cliente.

### Query params

- `suscripcionId`: cuid

### Response 200

```json
{
  "items": [
    {
      "id": "cuid",
      "bono": { "nombre": "BOGOTA_UNCOLI_2026", "tipo": "DESCUENTO_PCT", "valor": 15 },
      "descuentoUSD": 15.0,
      "aplicadoEn": "2026-08-23T10:00:00-05:00",
      "estado": "PENDIENTE_DE_PAGO"
    }
  ]
}
```
