> # Data Model — Motor de encolamiento

**Date**: 2026-07-18
**Feature**: specs/027-motor-encolamiento/spec.md

---

## Modelo existente: `Reporte` (campos usados)

| Campo | Tipo | Uso en esta spec |
|-------|------|------------------|
| `id` | String | ID que se encola |
| `estado` | `EstadoReporte` | PENDIENTE, PROCESANDO, REVISION_MANUAL |
| `esAnonimo` | Boolean | Determina prioridad base |
| `prioridadAlta` | Boolean | Prioridad alta por autenticación o keyword |
| `keywordsDetectadas` | String[] | Keywords que elevan prioridad |
| `processingError` | String? @db.Text | Error tras agotar reintentos |

---

## Nueva tabla: `ReintentoReporte`

Compartida con Spec 026; se define e implementa en esta spec.

```prisma
model ReintentoReporte {
  id        String   @id @default(cuid())
  reporteId String
  intento   Int
  exitoso   Boolean  @default(false)
  error     String?  @db.Text
  creadoEn  DateTime @default(now())

  reporte Reporte @relation(fields: [reporteId], references: [id], onDelete: Cascade)

  @@index([reporteId])
  @@index([creadoEn])
}
```

**Relación inversa en `Reporte`**:
```prisma
model Reporte {
  // ... campos existentes ...
  reintentos ReintentoReporte[]
}
```

---

## Parámetros nuevos en `ParametroSistema`

| Clave | Tipo | Default | Categoría | Descripción |
|-------|------|---------|-----------|-------------|
| `worker.max_reintentos` | INTEGER | 3 | SYSTEM | Máximo de reintentos ante fallo |
| `worker.retry_delay_segundos` | INTEGER | 30 | SYSTEM | Delay base entre reintentos |
| `worker.concurrencia` | INTEGER | 2 | SYSTEM | Jobs en paralelo según capacidad de GPU |
| `worker.max_pendientes` | INTEGER | 100 | SYSTEM | Límite de jobs pendientes para backpressure |

---

## Jobs de pg-boss

Cola: `reporte-procesamiento`

Opciones de envío:
- `priority`: 10 (alta) o 1 (baja).
- `retryLimit`: leído de `worker.max_reintentos`.
- `retryDelay`: leído de `worker.retry_delay_segundos`.
- `retryBackoff`: `true` (exponencial).

Opciones de work:
- `teamSize`: `worker.concurrencia`.
- `teamConcurrency`: `worker.concurrencia`.
- `batchSize`: 1 (un reporte por job).

---

## Migración

`20260718xx_add_reintento_reporte`

```sql
CREATE TABLE "ReintentoReporte" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "reporteId" TEXT NOT NULL,
    "intento" INTEGER NOT NULL,
    "exitoso" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReintentoReporte_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReintentoReporte" ADD CONSTRAINT "ReintentoReporte_reporteId_fkey"
  FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ReintentoReporte_reporteId_idx" ON "ReintentoReporte"("reporteId");
CREATE INDEX "ReintentoReporte_creadoEn_idx" ON "ReintentoReporte"("creadoEn");
```

---

## Invariantes

- Todo reporte pasa por la cola; no se procesa síncronamente en el request de creación.
- Si `jobs pendientes >= worker.max_pendientes`, nuevos reportes quedan en `PENDIENTE` sin encolar hasta que baje la carga.
- Cada intento (éxito o fracaso) se registra en `ReintentoReporte`.
- Si se agotan reintentos, el reporte pasa a `REVISION_MANUAL` con `processingError` y el historial completo.
