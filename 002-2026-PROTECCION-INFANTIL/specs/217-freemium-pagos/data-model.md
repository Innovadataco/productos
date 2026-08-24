# Modelo de datos — SPEC-217

## Cambio de schema

Migración **aditiva**. No se crean ni eliminan tablas. Se reutilizan modelos de SPEC-210.

## Índices aditivos propuestos

| Modelo | Índice | Justificación |
|---|---|---|
| `Suscripcion` | `@@index([esFreemium, freemiumFechaFin])` | Worker: listar freemiums vencidos. |
| `Suscripcion` | `@@index([usuarioId, esFreemium])` | Verificar histórico de freemium por padre. |
| `Suscripcion` | `@@index([colegioId, esFreemium])` | Verificar histórico de freemium por colegio. |

## Modelos afectados (ya definidos en SPEC-210)

### `Suscripcion`
Campos usados:
- `estado`, `esFreemium`, `freemiumFechaFin`, `fechaInicio`, `fechaFin`, `planActualId`.
- `usuarioId`, `colegioId`.

### `Plan`
Campos usados:
- `tipoTitular`, `duracion`, `año`, `precioBaseUSD`.

### `Pago`
Campos usados:
- `suscripcionId`, `estado`, `duracionCubierta`.

### `ParametroSistema`
Campos usados:
- `pagos.freemium.activo`
- `pagos.freemium.duracion_dias`

## Seed

No requiere seed adicional. Los parámetros ya existen por SPEC-210.

## Notas

- No se modifica el enum `EstadoSuscripcion`.
- No se agregan columnas.
- `freemiumFechaFin` ya es `DateTime? @db.Timestamptz(6)` en SPEC-210.
