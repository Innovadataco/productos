# Contratos de API — SPEC-215

## Autenticación y permisos

- Cookie `token` con JWT válido.
- Rol requerido: `SCHOOL_ADMIN` o `PARENT`.
- El `suscripcionId` debe pertenecer al usuario autenticado.

## POST /api/pagos/aplicar-referido

Aplica un código de referido a la suscripción del cliente.

### Request

```json
{
  "suscripcionId": "cuid",
  "codigoReferido": "PI-COLEGIO-A7F3D2E1"
}
```

### Response 200

```json
{
  "usoId": "cuid",
  "codigoReferido": "PI-COLEGIO-A7F3D2E1",
  "referidorId": "cuid",
  "descuentoPrimerPagoPct": 15,
  "estado": "REGISTRADO"
}
```

### Response 409

```json
{ "error": { "message": "Código no encontrado o inactivo", "code": "referido_invalido" } }
{ "error": { "message": "No puedes usar tu propio código", "code": "referido_autorreferido" } }
{ "error": { "message": "Ya fuiste referido por este usuario", "code": "referido_ya_registrado" } }
{ "error": { "message": "El referidor llegó al tope anual", "code": "referido_tope_anual" } }
```

## Evento interno: `pago.autorizado`

No es un endpoint HTTP. Al cambiar `Pago.estado` a `AUTORIZADO`, el sistema:

1. Busca `CodigoReferidoUso` donde `suscripcionReferidaId = Pago.suscripcionId` y `fechaActivacion IS NULL`.
2. Si existe:
   - Marca `fechaActivacion = now()`.
   - Aplica descuento del parámetro al pago (si aún no se calculó).
   - Otorga recompensa al referidor (extensión de 1 mes en próxima renovación).
   - Emite `referido.recompensa.otorgada`.
   - Si es el 4º uso del año, emite `referido.tope_anual`.
   - Registra `AuditLog`.
