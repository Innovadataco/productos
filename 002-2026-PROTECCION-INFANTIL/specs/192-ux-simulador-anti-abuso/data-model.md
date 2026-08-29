# Data Model: SPEC-192 — UX del simulador anti-abuso

## Cambios al modelo

### `SimulacionAbusoRun`

Añadir campo opcional `nota` para anotaciones internas del operador.

```prisma
model SimulacionAbusoRun {
  id             String   @id @default(cuid())
  escenario      String
  totalReportes  Int
  progreso       Int      @default(0)
  estado         String   @default("PENDIENTE")
  configJson     Json?
  resultadosJson Json?
  nota           String?  @db.VarChar(200)   // ← NUEVO (SPEC-192)
  creadoPorId    String
  creadoEn       DateTime @default(now())
  actualizadoEn  DateTime @updatedAt

  creadoPor Usuario @relation(fields: [creadoPorId], references: [id])

  @@index([estado])
  @@index([creadoPorId])
  @@map("simulacion_abuso_runs")
}
```

### Migración

```sql
-- prisma/migrations/20260820030000_spec_192_simulador_nota/migration.sql
ALTER TABLE simulacion_abuso_runs ADD COLUMN nota VARCHAR(200);
```

## Entidades de solo lectura

- **Plataforma**: catálogo existente (`id`, `clave`, `nombre`, `esActiva`). Se lee vía `/api/plataformas`.
- **RateLimit**: tabla existente. El bypass de `report_fingerprint` se implementa omitiendo la llamada, no tocando la tabla.

## JSON afectados

- **`SimulacionAbusoRun.configJson`**: ya almacena `n`, `ipInyectada`, `identificador`, `plataforma`, `usuarioId`. No cambia estructura; el frontend prioriza arrays al construir el body.
