> # Plan — Spec 027: Motor de encolamiento

## Modelos y campos de BD (schema.prisma)

**Nuevo modelo:**

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

**Modelo existente modificado:** `Reporte` agrega relación `reintentos ReintentoReporte[]`.

**Sin cambios en enums.**

**Migración:** `2026xxxxxx_add_reintento_reporte`.

## Herramientas

- **Reutilizar**:
  - `pg-boss` (ya en uso) para jobs, priority nativo, retry y concurrencia.
  - `ParametroSistema` para configuración dinámica.
  - `src/lib/ai/keywords-riesgo.ts` para válvula de alto riesgo.
  - **Spec 022** (`TransicionReporte`) para registrar transiciones.
- **Nueva**: ninguna. pg-boss ya cubre priority, retry y concurrencia.

## Dependencias

- Requiere **Spec 022** para registrar transiciones (encolado, reintento, fallback a revisión).
- Es base para **Spec 026** (spam usa prioridad/reintentos) y para cualquier job futuro.

## Fases

1. Schema: crear `ReintentoReporte`.
2. Refactorizar `src/lib/queue.ts`:
   - `sendReporte(reporteId, prioridad, intento=0)`.
   - Leer params de `ParametroSistema`.
   - Aplicar backpressure si `jobs pendientes >= worker.max_pendientes`.
3. Refactorizar `scripts/worker-reportes.mjs`:
   - Concurrencia configurable (`worker.concurrencia`).
   - En caso de error, pg-boss reintenta hasta `worker.max_reintentos`.
   - Al finalizar (éxito o fracaso), registrar en `ReintentoReporte`.
4. Fallback: si se agotan reintentos, actualizar `Reporte.estado = REVISION_MANUAL` y `processingError`.
5. UI de operador: mostrar historial de `ReintentoReporte` en detalle del caso.
6. Tests de integración con pg-boss.

## Parámetros nuevos en ParametroSistema

| Clave | Tipo | Default | Descripción |
|---|---|---|---|
| `worker.max_reintentos` | INTEGER | 3 | Máximo de reintentos ante fallo |
| `worker.retry_delay_segundos` | INTEGER | 30 | Delay base entre reintentos |
| `worker.concurrencia` | INTEGER | 2 | Jobs en paralelo (según GPU) |
| `worker.max_pendientes` | INTEGER | 100 | Límite de jobs pendientes para backpressure |

## Notas

- pg-boss soporta nativamente `priority` (mayor número = mayor prioridad) y `retryLimit`/`retryDelay`.
- La prioridad se calcula al encolar: autenticado=10, anónimo+keyword=10, anónimo=1.
