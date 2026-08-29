# Modelo de datos · SPEC-212 · Panel admin Pagos

## Cambios sobre SPEC-210

Esta SPEC no crea modelos nuevos; consume los modelos entregados por SPEC-210. El único cambio en schema es aditivo:

### Enum `EstadoPago`

Agregar valor `REEMBOLSADO` al enum existente:

```prisma
enum EstadoPago {
  PENDIENTE_AUTORIZACION
  AUTORIZADO
  RECHAZADO
  REEMBOLSADO
}
```

En PostgreSQL se implementa como migración aditiva:

```sql
ALTER TYPE "EstadoPago" ADD VALUE 'REEMBOLSADO';
```

> No requiere `DROP TYPE` ni modificar filas existentes. Filas previas conservan sus valores.

## Vistas y endpoints de solo lectura

La SPEC expone listados administrativos construidos sobre las tablas existentes:

| Vista / Tab | Fuentes de datos | Filtros principales |
|---|---|---|
| Pendientes | `Pago` | `estado = 'PENDIENTE_AUTORIZACION'` |
| Vencimientos | `Suscripcion` | `estado = 'ACTIVA' AND fechaFin <= hoy + 7 días` |
| Mora | `Suscripcion` | `estado IN ('EN_GRACIA','SUSPENDIDA')` |
| Bonos | `BonoPromocional` | todos, con paginación y filtro activo/inactivo |
| Planes | `Plan` | todos, filtro por año y tipoTitular |
| Reembolsos | `Pago` | `estado = 'AUTORIZADO' (para seleccionar) + `REEMBOLSADO` (historial) |
| Ficha cliente | `Suscripcion` + `Pago` + `AuditLog` | por `suscripcionId` |

## Mutaciones

| Operación | Modelo afectado | Campos actualizados | AuditLog |
|---|---|---|---|
| Autorizar pago | `Pago` | `estado`, `autorizadoPorAdminId`, `fechaAutorizacion` | `PAGO_AUTORIZADO` |
| Rechazar pago | `Pago` | `estado`, `motivoRechazo` | `PAGO_RECHAZADO` |
| Crear/editar bono | `BonoPromocional` | según formulario | `BONO_CREADO` / `BONO_EDITADO` |
| Editar plan | `Plan` | `precioBaseUSD`, `descuentoAnualPct` | `PLAN_EDITADO` |
| Registrar reembolso | `Pago` | `estado = 'REEMBOLSADO'`, campos de reembolso* | `PAGO_REEMBOLSADO` |
| Extensión manual vigencia | `Suscripcion` | `fechaFin`, `fechaCorteProgramado` | `SUSCRIPCION_EXTENSION_MANUAL` |

\* Los campos de reembolso (`montoReembolsoUSD`, `motivoReembolso`, `referenciaReembolso`) deben agregarse aditivamente al modelo `Pago` si no fueron incluidos en SPEC-210.

## Notas

- Todos los cálculos de fecha usan timezone `America/Bogota` (SPEC-200 / D-69).
- No se agregan índices adicionales más allá de los definidos en SPEC-210.
