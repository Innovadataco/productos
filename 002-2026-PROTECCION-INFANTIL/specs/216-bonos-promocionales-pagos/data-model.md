# Modelo de datos — SPEC-216

## Cambio de schema

Migración **aditiva**. No se crean ni eliminan tablas; se reutilizan los modelos `BonoPromocional`, `BonoAplicado`, `Suscripcion` y `Pago` definidos en SPEC-210. Se agregan índices opcionales si es necesario para las consultas de validación.

## Índices aditivos propuestos

| Modelo | Índice | Justificación |
|---|---|---|
| `BonoAplicado` | `@@index([bonoId, suscripcionId])` | Verificar idempotencia y conteo por cliente. |
| `BonoAplicado` | `@@index([suscripcionId, bonoId])` | Listar bonos aplicados a una suscripción. |

> Si Prisma genera el índice `@@index([bonoId, aplicadoEn])` de SPEC-210, los nuevos son complementarios, no conflictivos.

## Modelos afectados (ya definidos en SPEC-210)

### `BonoPromocional`
Campos usados por esta SPEC:
- `nombre` (código único del bono).
- `tipo`, `valor`.
- `vigenciaInicio`, `vigenciaFin`.
- `usosMaximosTotales`, `usosMaximosPorCliente`.
- `aplicaANuevos`, `aplicaARenovaciones`, `aplicaSoloA`.
- `combinableConCodigoPersonal`, `activo`.

### `BonoAplicado`
Campos usados:
- `bonoId`, `suscripcionId`, `pagoId`, `aplicadoEn`, `descuentoUSD`.

### `Suscripcion`
Campos usados:
- `id`, `tipoTitular`, `estado`, `codigoReferidoUsado`.

### `Pago`
Campos usados:
- `id`, `suscripcionId`, `descuentoAplicadoUSD`, `montoNetoUSD`, `bonoAplicadoId`, `codigoReferidoUsado`.

## Seed

No requiere seed adicional. Los parámetros `pagos.*` ya existen por SPEC-210.

## Notas

- No se modifica el enum `TipoBono` ni se agregan columnas a `BonoPromocional`.
- La relación `BonoAplicado.pago Pago?` permite pre-aplicar un bono antes de crear el pago.
