# Research: SPEC-137 — reverificación en fuente (2026-08-01)

## Huecos verificados (archivo:línea)

1. **Sin tx en la creación**: `api/reportes/route.ts:67` instancia
   `new ReporteCreationService()` sin tx → `crear()` hace dedup (`reporte-creation.ts:77`),
   `create` (:106) y `upsertIncrementoReporte` (:132) como 3+ operaciones independientes.
2. **Efectos tragados**: `route.ts:146-153` (fuente) y `:156-163` (cola) — ambos
   `try/catch` que solo loguean. Un fallo de pg-boss = reporte `PENDIENTE` huérfano.
3. **Carrera de dedup**: dos requests concurrentes mismo usuario+identificador pasan
   ambas el check (:77) → dos reportes (la ventana de 30 días no es constraint).

## Infraestructura existente que se reusa

- `withUnitOfWork` (`dal/unit-of-work.ts`): reusa tx si ya hay una (no anida).
- `ReporteCreationService` constructor acepta `tx` (D2) — la ruta solo tiene que dársela.
- Anti-reencolado: `queue.ts:106-111` consulta `pgboss.job` para no duplicar jobs.
- Patrón de job de mantenimiento: `carga-roster-limpieza` en `worker-reportes.mjs`
  (cada 15 min, con `ensureQueue`).
- `ReintentoReporte` existe (reintentos del procesamiento, no del encolado inicial).

## Decisión outbox vs reconciliación

Insertar directo en `pgboss.job` dentro de la tx = depender del formato interno de
pg-boss (no es contrato público; un upgrade lo rompe silenciosamente). Reconciliación
periódica con ventana de gracia de 1 min: robusta, idempotente, reusa `sendReporte`
con su backpressure. Decidido: reconciliación.

## Red de tests existente

`api/reportes/route.test.ts` + `reportes/fallback/route.test.ts` + journeys (padre
reporta autenticado y anónimo) — deben quedar verdes sin tocar (FR-005).
