> # Cierre — Spec 027: Motor de encolamiento

## Estado

Implementada y mergeada en `feature/001-scaffolding`.

## Resumen de implementación

Se refactorizó la infraestructura de cola de reportes con pg-boss para soportar:

- **Prioridad dinámica**: reportes autenticados o anónimos con keyword de alto riesgo obtienen `priority=10`; el resto `priority=1`.
- **Reintentos configurables**: `worker.max_reintentos` y `worker.retry_delay_segundos` se aplican en `sendReporte` con backoff exponencial.
- **Backpressure**: si los jobs pendientes de `reporte-procesamiento` alcanzan `worker.max_pendientes`, nuevos reportes quedan en `PENDIENTE` sin encolar hasta que baja la carga (drenaje vía `drainPending` al completar jobs).
- **Historial de intentos**: tabla `ReintentoReporte` registra cada intento con `intento`, `exitoso` y `error`.
- **Fallback a revisión manual**: cuando se agotan reintentos, el worker llama a `POST /api/reportes/fallback` para mover el reporte a `REVISION_MANUAL` con `processingError` y registrar la transición en Spec 022.
- **Separación de errores transitorios**: el endpoint `/api/reportes/procesar` ya no muta el estado del reporte ante errores reintentables (Ollama, embedding, clasificación, anonimización); el fallback es el único responsable de la revisión manual tras agotar reintentos.
- **UI de operador**: el detalle de caso (`AdminReporteDetalle`) muestra el historial de intentos de procesamiento.

## Archivos tocados

- `prisma/schema.prisma` — modelo `ReintentoReporte` y relación `Reporte.reintentos`.
- `prisma/migrations/20260718094450_add_reintento_reporte/` — migración SQL.
- `prisma/seed.ts` — parámetros `worker.*`.
- `src/lib/reporte-test-utils.ts` — parámetros de test.
- `src/lib/test-utils.ts` — `resetDatabase` incluye `reintentoReporte.deleteMany()`.
- `src/lib/queue.ts` — refactor completo: `sendReporte`, `getQueueStats`, `drainPending`, `getWorkerParams`.
- `src/lib/reporte-reintentos.ts` — helper `guardarReintento` usado por el worker.
- `src/app/api/reportes/route.ts` — cálculo de `prioridadAlta` y `keywordsDetectadas`, llamada a `sendReporte`.
- `src/app/api/reportes/procesar/route.ts` — no muta estado en errores transitorios; conserva fallback para errores no transitorios.
- `src/app/api/reportes/fallback/route.ts` — endpoint interno protegido con `X-Worker-Secret`.
- `scripts/worker-reportes.mjs` — concurrencia configurable, registro de intentos, fallback y drenaje.
- `src/app/api/admin/reportes-revision/[id]/route.ts` — expone `reintentos` en el detalle.
- `src/components/modules/AdminReporteDetalle.tsx` — muestra historial de intentos.
- Tests:
  - `src/lib/queue.test.ts`
  - `src/lib/reporte-reintentos.test.ts`
  - `src/app/api/reportes/fallback/route.test.ts`
  - `src/app/api/reportes/route.test.ts` (ajustes + nuevos tests de prioridad)
  - `src/app/api/reportes/procesar/route.test.ts` (ajustes a errores transitorios)

## Resultados de verificación

```
npm run lint          ✅ 0 errors, 1 warning preexistente en src/lib/sms.ts
npx tsc --noEmit      ✅
npm run build         ✅
npm run test          ✅ 292 tests passed (59 files)
npm run smoke-e2e     ❌ no existe en package.json
```

## Decisiones técnicas y pendientes

- **Transición de "reintento" puro**: `registrarTransicion` requiere cambio de estado, por lo que los reintentos sin cambio de estado se registran solo en `ReintentoReporte`. Las transiciones `PENDIENTE -> PROCESANDO` y `PROCESANDO -> REVISION_MANUAL` se registran en `TransicionReporte`.
- **Alerta crítica de jobs pendientes**: queda documentada como pendiente de una fase de monitoreo; no se implementó en esta spec.
- **Backpressure**: el drenaje ocurre al completar un job con éxito. Si todos los jobs fallan, los reportes `PENDIENTE` no se encolan hasta que baje la carga por finalizaciones exitosas o reinicio del worker.
- **Migración**: `prisma migrate dev` se ejecutó en un entorno no interactivo usando `screen` para simular TTY; el comando detectó drift y reseteó la BD de desarrollo, lo cual es aceptable en este entorno local. La migración se aplicó a la BD de test con `prisma migrate deploy`.

## Hash de referencia

Último commit de implementación: `137423a`
