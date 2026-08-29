# Modelo de datos — SPEC-243 (002-PI-146)

## Cambios en `prisma/schema.prisma`

### Modelo `Plan` (catálogo de suscripciones)

Se extiende aditivamente con tres campos nuevos. `precioBaseUSD` y `precio` legacy se conservan sin cambios.

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `precioBaseCOP` | `Float?` | — | Precio de venta en pesos colombianos. Es la moneda de visualización y cálculo para Colombia. |
| `esFreemium` | `Boolean` | `false` | `true` identifica sin ambigüedad un plan gratuito (ej: prueba 30 días). |
| `usosMaximosPorCliente` | `Int?` | — | Límite de usos por titular para planes freemium; `null` para planes pagos. |

```prisma
model Plan {
  id                    String       @id @default(cuid())
  nombre                String
  tipoTitular           TipoTitular
  duracion              DuracionPlan
  anio                  Int
  precioBaseUSD         Float
  precioBaseCOP         Float?
  esFreemium            Boolean      @default(false)
  usosMaximosPorCliente Int?
  descuentoAnualPct     Float?
  activo                Boolean      @default(true)
  descripcion           String?
  precio                Float? // legacy placeholder
  creadoPorAdminId      String
  createdAt             DateTime     @default(now()) @db.Timestamptz(6)
  updatedAt             DateTime     @updatedAt @db.Timestamptz(6)

  creadoPor     Usuario       @relation(fields: [creadoPorAdminId], references: [id], name: "PlanesCreados")
  suscripciones Suscripcion[]

  @@unique([tipoTitular, duracion, anio])
  @@index([activo, anio])
}
```

### Enum `AccionAudit`

Se agregan tres valores aditivos para trazabilidad del CRUD de planes:

- `PLAN_CREATE`
- `PLAN_UPDATE`
- `PLAN_TOGGLE`

Los parámetros globales reutilizan el valor existente `PARAM_UPDATE`.

## Migración SQL

Archivo: `prisma/migrations/20260825004336_crud_admin_planes/migration.sql`

```sql
ALTER TABLE "Plan"
    ADD COLUMN IF NOT EXISTS "precioBaseCOP" double precision,
    ADD COLUMN IF NOT EXISTS "esFreemium" boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "usosMaximosPorCliente" integer;

ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'PLAN_CREATE';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'PLAN_UPDATE';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'PLAN_TOGGLE';
```

> **CANDADO**: migración 100% aditiva. No hay `DROP`, `RENAME` ni cambios destructivos.

## Seed

`prisma/seed.ts` garantiza:

- 8 planes base (4 por rol: PADRE y COLEGIO).
- Orden visual sembrado: Freemium (MES_1), 3 meses, 6 meses, Anual.
- Idempotencia mediante `upsert({ create, update: {} })`; no se sobreescriben ediciones manuales.
- Año actual calculado con timezone `America/Bogota`.
- 7 parámetros globales de §6.3 (`pagos.iva.*`, `pagos.freemium.*`, `pagos.recompensa.*`) sembrados con `update: {}`.

## Relaciones

- `Plan` ← `Suscripcion` (validación de borrado lógico: un plan con suscripciones `ACTIVA` no puede desactivarse).
- `Plan` ← `Usuario` (`creadoPorAdminId`).
- `AuditLog` registra cada mutación vía `logAudit`.
