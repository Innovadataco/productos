# Cierre — Spec 083: Simulación completitud/métricas + multi-modelo (I-06)

**Fecha**: 2026-07-22
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/083-simulacion-completitud-multimodelo/`
**Incidencia**: I-06
**Estado**: FINALIZADO — pendiente ACTA-VALIDACION de ZEUS para marcar CERRADA

## Resumen por User Story

| US | Descripción | Estado |
|----|-------------|--------|
| US1 (P1) | Progreso real + COMPLETADA solo al terminar (+ FALLIDA por timeout) | Implementado y validado en vivo |
| US2 (P1) | Métricas persistidas (accuracy, latencias, desempate) | Implementado y validado contra SQL directo |
| US3 (P2) | Selección multi-modelo en secuencia | Implementado y validado en vivo (2 modelos × 50 casos) |

## Cambios realizados

**Completitud (C1)**
- `src/lib/simulacion/executor.ts`: el batch creator ya no marca `COMPLETADA` al encolar; queda `EN_PROGRESO` y persiste `casosFallidos` (casos no encolados). `FALLIDA` solo si 0 encolados. Reanudable: salta índices ya creados. **Fix adicional**: `shortRunId` usa el sufijo del cuid (identificadores SIM únicos por run; ver "Bug encontrado en validación").
- `src/app/api/reportes/procesar/route.ts`: hook fail-open tras `finalizarReporte` → `marcarProgresoSimulacionPorReporte` actualiza el progreso del run por cada caso clasificado.
- `src/lib/simulacion/progreso.ts`: total efectivo (`totalCasos - casosFallidos`), timeout → `FALLIDA` (`ia.simulacion_timeout_minutos`, default 60), disparo de `refrescarMetricasSimulacion` al completar; `tieneMetricasCompletas`; hook `marcarProgresoSimulacionPorReporte`.
- `src/app/api/admin/ia/simulaciones/[id]/route.ts`: backfill perezoso cuando faltan métricas completas (cubre runs históricas con solo `{casosFallidos}`).
- `prisma/seed.ts`: parámetro `ia.simulacion_timeout_minutos` (60).

**Métricas (C2)**
- `src/lib/simulacion/metricas.ts`: `latenciaPromedioMs` y `usoDesempate {casos, porcentaje}` (desde `ClasificacionIA.usoCascada`); merge conserva `casosFallidos`.
- UI: `MetricasSimulacion.tsx` (6 tarjetas: Accuracy, Aciertos, Desempate, Latencia prom./p50/p95), `types.ts` extendido.

**Multi-modelo (C3)**
- `src/lib/schemas/simulacion.ts`: `modelos: string[]` (1..5).
- `POST /api/admin/ia/simulaciones`: un `SimulacionRun` por modelo + job `simulacion-lote`; validación de embeddings por modelo; 409 cubre el lote.
- `src/lib/queue.ts`: `sendSimulacionLote(runIds)`.
- `scripts/worker-reportes.mjs`: handler `simulacion-lote` (secuencia estricta: crea reportes del run y espera su cierre por poll de estado cada 10 s; respeta cancelación y timeout; handler `simulacion-run` conservado por compat).
- `NuevaSimulacionForm.tsx`: checkboxes multi-modelo, estimación agregada, payload `modelos[]`.

## Validación en vivo (2 modelos × 50 casos, `simulacion-50-casos-eval.json`)

- POST 202 → `runIds` [run1 `cmrwkwpub0001s47s0pwx2pkn` (ornith:9b), run2 `cmrwkwpuk0003s47sdo4m9gem` (qwen2.5:14b)].
- **Progreso real (US1)**: run1 observado en 4/50 → 21/50 → 42/50 → 50/50, siempre `EN_PROGRESO` hasta el final; `COMPLETADA` con `fechaFin` solo al clasificar el caso 50. Run2 permaneció `PENDIENTE` hasta entonces.
- **Secuencia (US3)**: log del worker — "run1 terminó con estado COMPLETADA" → recién después "creando reportes de run2".
- **Métricas (US2)**, run1 `metricasJson`: `accuracy: 0.94` (47 aciertos / 3 fallos), `latenciaPromedioMs: 23200`, `latenciaP50Ms: 22968`, `latenciaP95Ms: 25311`, `usoDesempate: {casos: 0}`, `casosFallidos: 0`, `distribucionEstados: {CLASIFICADO: 41, REVISION_MANUAL: 5, POSIBLE_SPAM: 4}`.
- **Contra SQL directo (SC-002)**: 47/50 = 0.94 — coincide exactamente.
- Run2 (qwen2.5:14b): resultado registrado abajo al completar.
- API detalle expone progreso y métricas; la UI lee los mismos valores (cards + detalle).

### Resultado run2 (qwen2.5:14b, relanzada tras el fix de identificadores)

- **Bug encontrado en validación**: `shortRunId` usaba `runId.slice(0, 6)` y los cuid de un mismo lote comparten prefijo → ambas runs generaban los MISMOS identificadores `SIM-cmrwkw-NNN` → la deduplicación por similitud marcaba los casos de la run 2 como `DUPLICADO` de la run 1 (12/12 observados, latencia 16 ms, sin clasificar).
- **Fix**: `shortRunId` ahora usa `slice(-6)` (sufijo aleatorio del cuid) + test de regresión. Run 2 cancelada y purgada (datos contaminados), relanzada como `cmrwm6cb70001ikn7ng3mo01t`.
- **Resultado**: `COMPLETADA` 50/50, `accuracy: 0.96` (48 aciertos / 2 fallos), `latenciaPromedioMs: 23959`, `latenciaP50Ms: 27845`, `usoDesempate: {casos: 0}`, `distribucionEstados: {CLASIFICADO: 46, POSIBLE_SPAM: 4}`. SQL directo: 48/50 = 0.96 — coincide.
- Estados durante la corrida: `CLASIFICADO` reales, cero `DUPLICADO` (identificadores `SIM-3mo01t-NNN` únicos).

## Gate de calidad

- `npm run lint`: 0 errores (1 warning heredado).
- `npx tsc --noEmit`: OK.
- `npm run test`: **739/739 tests pasan** (719 previos + 20 nuevos: progreso 12, métricas 4, executor +2, rutas +2).
- `rm -rf .next && npm run build`: OK.
- `./scripts/dev-restart.sh`: healthcheck `{"status":"ok","workerAlive":true,"dbOk":true}`, un solo worker con el handler `simulacion-lote`.

## Deuda técnica registrada

- El handler legacy `simulacion-run` queda solo para compat con jobs encolados antes del cambio; puede eliminarse en una limpieza futura junto con `sendSimulacionRun`.
- Runs COMPLETADA históricas con métricas parciales se corrigen por backfill perezoso al abrir su detalle; no hubo migración masiva.

## Commit

- `fix(simulacion): completitud/métricas + selección multi-modelo (spec 083, I-06)`
