# Data Model: Middleware de vigencia (SPEC-242)

## Cambios en schema

### Enum `EstadoSuscripcion`
- Agrega `PENDIENTE_AUTORIZACION` como valor aditivo.
- Representa una suscripción creada (por ejemplo, tras completar el flujo de
  activación de colegio o tras seleccionar plan) pero aún no autorizada por un
  administrador o pendiente de confirmación de pago.

### Enum `AccionAudit`
- Agrega `REPORTE_SIN_SUSCRIPCION` como valor aditivo.
- Trazabilidad de accesos de padres autenticados a `/reportar` cuando no tienen
  una suscripción en estado `ACTIVA` o `EN_GRACIA`.

## Migración

Archivo: `prisma/migrations/20260825054000_spec_242_vigencia_middleware/migration.sql`

```sql
ALTER TYPE "EstadoSuscripcion" ADD VALUE IF NOT EXISTS 'PENDIENTE_AUTORIZACION';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'REPORTE_SIN_SUSCRIPCION';
```

- 100% aditiva.
- Cero `DROP`, cero rename destructivo.
- Uso de `IF NOT EXISTS` para ser idempotente frente a SPEC-245 (que también
  agrega `PENDIENTE_AUTORIZACION`) y SPEC-243 (que agrega `PLAN_CREATE`,
  `PLAN_UPDATE`, `PLAN_TOGGLE` al mismo enum `AccionAudit`).

## Modelos afectados (solo lectura)

- `Suscripcion`: fuente única de vigencia; se lee `estado`, `fechaFin`,
  `fechaCorteProgramado`.
- `Usuario`: se usa `id`, `rol`, `estado` para autenticar y vincular la
  suscripción.
- `AuditLog`: destino del registro `REPORTE_SIN_SUSCRIPCION`.
