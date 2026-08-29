# Modelo de datos — SPEC-215

## Cambio de schema

Migración **aditiva**. Se reutilizan modelos de SPEC-210. No se agregan tablas nuevas.

## Índices aditivos propuestos

| Modelo | Índice | Justificación |
|---|---|---|
| `Suscripcion` | `@@index([codigoReferidoPropio])` | Ya es `@unique` en SPEC-210; el índice implícito sirve. |
| `CodigoReferidoUso` | `@@index([suscripcionReferidaId])` | Buscar uso por referido al autorizar pago. |

## Modelos afectados (ya definidos en SPEC-210)

### `Suscripcion`
Campos usados:
- `id`, `tipoTitular`, `estado`, `codigoReferidoPropio`, `codigoReferidoUsado`, `usuarioId`, `colegioId`.

### `CodigoReferidoUso`
Campos usados:
- `codigoReferidoUsuarioId`, `suscripcionReferidaId`, `año`, `fechaRegistro`, `fechaActivacion`, `recompensaOtorgada`, `tipoRecompensa`, `requiereRevisionAdmin`.

### `Pago`
Campos usados:
- `id`, `suscripcionId`, `estado`, `codigoReferidoUsado`.

### `Usuario` / `Colegio`
Campos usados para anti-autorreferido:
- `Usuario.email`, `Usuario.documento` (si existe).
- `Colegio.email` / contacto del rector.

## Seed

No requiere seed adicional. Los parámetros ya existen por SPEC-210:
- `pagos.referidos.max_por_año`
- `pagos.referidos.notificar_admin_al`
- (Se asume `pagos.referidos.descuento_referido_pct` sembrado también).

## Notas

- No se modifica el enum `EstadoPago`.
- No se eliminan columnas.
- El código del referido vive en `Suscripcion`, no en `Usuario`, siguiendo el BRIEF §5.1.
