# Modelo de datos — SPEC-211

## Cambio de schema

Migración **aditiva**. No se crean ni eliminan tablas. Se reutilizan modelos de SPEC-210.

## Índices aditivos propuestos

Ninguno adicional requerido; los de SPEC-210 son suficientes:
- `@@index([suscripcionId, createdAt])` en `Pago` para historial.
- `@@index([estado, fechaFin])` en `Suscripcion`.

## Modelos afectados (ya definidos en SPEC-210)

### `Suscripcion`
Campos usados:
- Todos los campos de resumen (estado, fechas, esFreemium, codigoReferidoPropio, etc.).

### `Pago`
Campos usados:
- Historial: `fechaReporte`, `duracionCubierta`, `fechaInicio`, `fechaFin`, `montoNetoUSD`, `montoLocalPagado`, `monedaLocal`, `metodoDeclarado`, `estado`, `comprobanteAdjuntoUrl`.

### `Plan`
Campos usados:
- `duracion`, `precioBaseUSD`, `descuentoAnualPct`.

### `BonoPromocional` / `BonoAplicado`
Usados indirectamente por endpoints de SPEC-216.

## Seed

No requiere seed adicional.

## Notas

- No se modifica schema.
- Upload de comprobante almacena URL/mime/hash; no se procesa multimedia.
