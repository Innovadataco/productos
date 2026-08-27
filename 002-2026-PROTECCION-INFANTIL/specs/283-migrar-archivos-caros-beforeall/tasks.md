# Tasks — SPEC-283 · Migrar los 8 archivos más caros

## Estado: IMPLEMENTADO (parcial; ver hallazgo)

## Resultado por archivo

| # | Archivo | Migración | Motivo |
|---|---------|-----------|--------|
| 1 | `src/lib/dal/repositories/colegio-resumen.test.ts` (4 tests) | ❌ Revertido | `beforeAll` roto por concurrencia entre archivos (ver hallazgo) |
| 2 | `src/app/api/colegio/carga/confirmar/route.test.ts` (3 tests) | ❌ Revertido | Idem |
| 3 | `src/lib/dal/repositories/embedding.test.ts` (4 tests) | ❌ No migrado | `Reporte.numeroSeguimiento` unique + `TAG` compartido → colisión determinista |
| 4 | `src/app/api/pagos/aplicar-bono/route.test.ts` (10 tests) | ❌ No migrado | `Plan @@unique([tipoTitular, duracion, anio])` → colisión determinista |
| 5 | `src/app/api/webhooks/resend/route.test.ts` (7 tests) | ✅ Reset SELECTIVO | `beforeEach(resetDatabase(["notificaciones"]))` en lugar de 96 tablas; aislado 61 s → 1.7 s local (~35× más rápido) |
| 6 | `src/lib/colegio/avisos-observacion.test.ts` (4 tests) | ❌ Revertido | Concurrencia entre archivos |
| 7 | `src/app/api/colegio/alertas/route.test.ts` (15 tests) | ❌ Revertido | Concurrencia entre archivos |
| 8 | `src/lib/analisis/digest-semanal.test.ts` (40 tests) | ❌ No migrado | 40 tests con costo ya bajo (1.7 s/prueba); `describe("seedDigestSemanal")` cuenta filas globales — migrar a `beforeAll` acumularía estado |

## Hallazgo crítico (SC-009)

Los 4 archivos migrados a `beforeAll` (colegio-resumen, carga/confirmar, alertas, avisos-observacion) pasaban aislados en < 6 s con 3/3 corridas idénticas. En la **suite completa** fallaban 10 tests determinísticamente en 2 corridas seguidas.

**Causa raíz** (documentada en `src/lib/test-setup.ts`): vitest 3.2.x corre archivos concurrentemente a pesar de `fileParallelism: false` + `sequence.concurrent: false`. El mutex `TestMutex` serializa **por test individual** (afterEach), no por archivo. Cuando el Archivo A hace `beforeAll(seed)` y otro Archivo B en otro fork corre `beforeEach(reset)`, la BD queda sin los seeds de A antes de que corra su primer `it`.

**Fix**: revertir los 4 archivos a `beforeEach(resetDatabase)` con comentario que documenta por qué (SC-008).

**Ganancia real de SPEC-283**: solo `webhooks/resend` con reset selectivo. Los demás archivos caros conservan `beforeEach(resetDatabase())`; su mejora vendrá de SPEC-281 (reparto por peso) que compensa el costo del reset con paralelismo balanceado.

## Verificación (SC-009 · triple corrida)

Pendiente al momento de commit. Se ejecuta antes del REALIZADO.
