# Modelo de datos — SPEC-213

## Cambio de schema

Migración **aditiva**. Se reutilizan modelos de SPEC-210. Se agregan índices y posiblemente un parámetro de control.

## Índices aditivos propuestos

| Modelo | Índice | Justificación |
|---|---|---|
| `Suscripcion` | `@@index([estado, fechaFin, esFreemium])` | Worker: activas por vencer + freemium. |
| `Suscripcion` | `@@index([estado, fechaCorteProgramado])` | Worker: en gracia por cortar. |

> El índice `@@index([estado, fechaFin])` de SPEC-210 sigue siendo útil; los nuevos son más específicos.

## Parámetros aditivos propuestos

| Clave | Tipo | Default | Descripción |
|---|---|---|---|
| `pagos.vigencia.hora_corrida` | STRING | `01:00` | Hora diaria de ejecución del worker (HH:mm, Bogotá). |
| `pagos.vigencia.ultima_corrida` | STRING (ISO fecha Bogotá) | — | Fecha de la última corrida efectiva. |

Ambos se almacenan en `ParametroSistema` (existente). No requieren cambios de schema.

## Modelos afectados (ya definidos en SPEC-210)

### `Suscripcion`
Campos usados:
- `id`, `estado`, `fechaFin`, `fechaCorteProgramado`, `esFreemium`, `freemiumFechaFin`.
- `suspendidaEn`, `canceladaEn`.

### `AuditLog`
Se registra una fila por transición con:
- `usuarioId = 'SYSTEM'`.
- `accion = 'suscripcion_transicion_<ESTADO_ANTERIOR>_<ESTADO_NUEVO>'`.
- `entidad = 'Suscripcion'`, `entidadId = suscripcionId`.
- `metadata` con motivo y timestamp.

### `ParametroSistema`
Se usan/crean:
- `pagos.gracia_dias` (existente).
- `pagos.vigencia.hora_corrida` (nuevo).
- `pagos.vigencia.ultima_corrida` (nuevo, escrito por worker).

## Seed

Extender `prisma/seed.ts` (o seed de pagos) para sembrar:
- `pagos.vigencia.hora_corrida = '01:00'`.

No se requieren más tablas ni enums.

## Notas

- No se modifica el enum `EstadoSuscripcion`.
- No se eliminan columnas.
- La marca `ultima_corrida` podría moverse a una tabla de control de workers en el futuro; por ahora se usa `ParametroSistema` por simplicidad.
