# Contratos de API — SPEC-211

## Autenticación y permisos

- Cookie `token` con JWT válido.
- Rol requerido: `SCHOOL_ADMIN` para `/dashboard/colegio/suscripcion`; `PARENT` para `/dashboard/padre/suscripcion`.
- El endpoint devuelve solo la suscripción del usuario autenticado (o del colegio del rector).

## GET /api/pagos/suscripcion

### Response 200 — rector

```json
{
  "id": "cuid",
  "estado": "ACTIVA",
  "esFreemium": false,
  "diasRestantes": 120,
  "fechaInicio": "2026-08-23",
  "fechaFin": "2026-12-21",
  "plan": { "duracion": "MES_12", "precioBaseUSD": 100 },
  "totalPagadoUSD": 100,
  "totalPagadoLocal": 400000,
  "monedaLocal": "COP",
  "codigoReferidoPropio": "PI-COLEGIO-A7F3D2E1",
  "referidosExitososEsteAnio": 2,
  "contratoPDFUrl": "https://.../contrato.pdf",
  "pagoPendiente": null
}
```

## POST /api/pagos/renovacion

### Request

```multipart/form-data
suscripcionId=cuid
 duracion=MES_12
 metodoDeclarado=TRANSFERENCIA
 comprobante=<file>
 notas=Opcional
 codigoReferido=PI-COLEGIO-...
 codigoBono=BOGOTA_UNCOLI_2026
```

### Response 201

```json
{
  "pagoId": "cuid",
  "estado": "PENDIENTE_AUTORIZACION",
  "montoNetoUSD": 85,
  "montoLocalPagado": 340000,
  "monedaLocal": "COP",
  "comprobanteHashSha256": "abc123..."
}
```

### Response 413

```json
{ "error": { "message": "Archivo excede el tamaño máximo permitido", "code": "PAYLOAD_TOO_LARGE" } }
```

## POST /api/pagos/suscripcion/cancelar

### Request

```json
{ "suscripcionId": "cuid", "motivo": "Opcional" }
```

### Response 200

```json
{ "estado": "CANCELADA", "canceladaEn": "2026-08-23T10:00:00-05:00" }
```
