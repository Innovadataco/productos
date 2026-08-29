# Modelo de datos — SPEC-218

## Cambio de schema

Migración **aditiva**. No se crean ni eliminan tablas. Se reutilizan modelos de SPEC-210.

## Índices aditivos propuestos

| Modelo | Índice | Justificación |
|---|---|---|
| `Suscripcion` | `@@index([estado, paisCliente, monedaLocal, createdAt])` | Widget crecimiento por país. |
| `Pago` | `@@index([estado, createdAt, monedaLocal])` | KPIs recaudo mes a mes. |

> Los índices de SPEC-210 (`@@index([estado, fechaFin])`, `@@index([suscripcionId, createdAt])`) siguen siendo útiles.

## Modelos afectados (ya definidos en SPEC-210)

### `Suscripcion`
Campos usados:
- `id`, `estado`, `tipoTitular`, `fechaFin`, `paisCliente`, `monedaLocal`, `createdAt`, `esFreemium`.
- `colegioId`, `usuarioId`.

### `Pago`
Campos usados:
- `id`, `estado`, `montoNetoUSD`, `montoLocalPagado`, `monedaLocal`, `createdAt`, `suscripcionId`.

### `Colegio`
Campos usados:
- `id`, `nombre`, `email`.

### `Usuario`
Campos usados:
- `id`, `email`, `nombre`.

## Seed

No requiere seed adicional.

## Notas

- No se modifica schema.
- No se agregan enums.
- Las queries deben ser agregadas y eficientes.
