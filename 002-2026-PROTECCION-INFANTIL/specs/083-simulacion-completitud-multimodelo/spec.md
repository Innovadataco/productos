# Spec 083 — Simulación: completitud/métricas + selección multi-modelo (I-06)

**Status**: `CERRADA` (ACTA-VALIDACION aprobada por ZEUS 2026-07-23)
**Rama**: `feature/001-scaffolding`
**Fase del programa**: Corrección de incidencias / Mejoras del módulo IA
**Creado**: 2026-07-22
**Incidencia**: I-06

**Input**: "La run se marca COMPLETADA sin esperar a que el worker clasifique todos los casos (runs con 1/50 y 39/50 marcadas COMPLETADA). `progreso` queda en 0 y `metricasJson` solo guarda {casosFallidos:N}; nunca calcula accuracy/latencia/p50 → la UI muestra 0/50, 0%, 0ms. Los datos crudos SÍ están. Objetivo 1: arreglar el ciclo (progreso real, COMPLETADA solo al terminar, métricas persistidas). Objetivo 2: selección multi-modelo en Nueva simulación, ejecutada en SECUENCIA, un SimulacionRun por modelo."

## Contexto

Cadena causal verificada en código (2026-07-22):

1. `runSimulacionBatchCreator` (`src/lib/simulacion/executor.ts:118`) marca el run `COMPLETADA` cuando los reportes están **creados y encolados**, no clasificados.
2. Al consultar `GET /api/admin/ia/simulaciones/[id]`, `actualizarProgresoYEstado` (`src/lib/simulacion/progreso.ts:24`) retorna temprano si el estado ya es `COMPLETADA` → `progreso` queda en 0 para siempre.
3. El batch creator ya escribió `metricasJson: { casosFallidos: N }`, así que la condición `estado === "COMPLETADA" && !run.metricasJson` del GET (`[id]/route.ts:41`) nunca dispara `refrescarMetricasSimulacion` → la UI lee `accuracy ?? 0` y `latenciaP50Ms ?? 0` (`SimulacionCard.tsx:43-47`).
4. Los datos crudos existen: `ClasificacionIA` por reporte (categoría, confianza, `latenciaMs`, `usoCascada`) y `SimulacionReporte.categoriaEsperada`. `calcularMetricasSimulacion` (`src/lib/simulacion/metricas.ts`) ya calcula accuracy, porCategoria, matriz de confusión, falsosNegativos, p50/p95 — pero no se persiste por el punto 3, y le faltan latencia promedio y uso de desempate (`usoCascada`).

Infraestructura que sí existe y se reutiliza: transición `EN_PROGRESO → COMPLETADA` cuando `progreso >= totalCasos` (`progreso.ts:32`), cancelación entre batches (`executor.ts:95`), job pg-boss `simulacion-run` consumido por `scripts/worker-reportes.mjs:398`.

## User Scenarios & Testing

### User Story 1 — Progreso real y COMPLETADA solo al terminar (Priority: P1)

**Como** ADMIN,
**quiero** que una simulación avance su `progreso` conforme cada caso se clasifica y solo pase a `COMPLETADA` cuando todos los casos tengan clasificación,
**para** confiar en el estado que veo en el dashboard.

**Why this priority**: es la raíz de I-06; sin completitud fiable no hay métricas ni secuencia multi-modelo.

**Independent Test**: lanzar una simulación con el JSON de 50 casos: durante la corrida `progreso` crece (1/50 → 50/50) y el estado permanece `EN_PROGRESO`; al clasificar el último caso pasa a `COMPLETADA` con `fechaFin`. Nunca antes.

**Acceptance Scenarios**:

1. **Given** un run con 50 casos encolados, **When** el worker ha clasificado 20, **Then** `progreso = 20` y `estado = EN_PROGRESO`.
2. **Given** un run con 50/50 casos clasificados, **When** se actualiza el progreso, **Then** `estado = COMPLETADA` y `fechaFin` queda fijada.
3. **Given** casos que no pudieron crearse/encolarse (error), **When** el resto terminó, **Then** el run cierra como `COMPLETADA` con los fallidos contabilizados en métricas (no queda `EN_PROGRESO` eterno).
4. **Given** un run estancado (worker caído, Ollama caído) más allá del timeout configurable, **When** se evalúa su estado, **Then** pasa a `FALLIDA` con `fechaFin`.
5. **Given** un run `CANCELADA`, **When** el ciclo evalúa su progreso, **Then** no cambia de estado ni calcula métricas.

---

### User Story 2 — Métricas calculadas y persistidas (Priority: P1)

**Como** ADMIN,
**quiero** que al completarse la simulación se persistan en `metricasJson` accuracy, aciertos, latencia promedio y p50/p95, y uso de desempate,
**para** ver en la UI los mismos valores que arrojan los datos crudos (p. ej. accuracy real 98%).

**Why this priority**: es la mitad visible de I-06; la UI ya lee estas claves y hoy muestra ceros.

**Independent Test**: con una run completada sobre el JSON de 50 casos con `categoriaEsperada`, `metricasJson` contiene `accuracy`, `aciertos`, `fallos`, `latenciaPromedioMs`, `latenciaP50Ms`, `latenciaP95Ms` y `usoDesempate` coherentes con un cálculo SQL directo sobre `ClasificacionIA`.

**Acceptance Scenarios**:

1. **Given** una run recién completada, **When** se persisten métricas, **Then** `accuracy = aciertos / (aciertos + fallos)` comparando `ClasificacionIA.categoria` vs `categoriaEsperada` (canonizada).
2. **Given** clasificaciones con `latenciaMs`, **When** se calculan métricas, **Then** `latenciaPromedioMs`, `latenciaP50Ms` y `latenciaP95Ms` reflejan esos valores (la UI deja de mostrar 0ms).
3. **Given** casos que usaron cascada de desempate (`usoCascada = true`), **When** se calculan métricas, **Then** `usoDesempate` reporta el conteo y porcentaje.
4. **Given** una run COMPLETADA sin métricas persistidas (runs históricas), **When** se consulta el detalle, **Then** las métricas se calculan y persisten bajo demanda (backfill perezoso).

---

### User Story 3 — Selección multi-modelo en secuencia (Priority: P2)

**Como** ADMIN,
**quiero** seleccionar varios modelos en "Nueva simulación" y que se ejecuten en secuencia (modelo 1 → fin → modelo 2…), con un `SimulacionRun` y progreso por modelo,
**para** comparar modelos sobre el mismo set sin lanzar cada corrida a mano.

**Why this priority**: es el Objetivo 2 del brief; depende de US1 (sin completitud fiable no hay secuencia).

**Independent Test**: lanzar 2 modelos sobre el JSON de 50 casos → se crean 2 runs; el segundo no inicia hasta que el primero está `COMPLETADA`/`FALLIDA`/`CANCELADA`; cada run muestra su progreso y métricas propias.

**Acceptance Scenarios**:

1. **Given** el paso 2 del formulario, **When** el ADMIN selecciona 2+ modelos y lanza, **Then** se crea un `SimulacionRun` por modelo (mismo set de casos) y la ejecución es estrictamente secuencial.
2. **Given** una secuencia en curso, **When** el run del modelo 1 termina (cualquier estado final), **Then** el run del modelo 2 inicia su creación de reportes.
3. **Given** una secuencia en curso, **When** el ADMIN cancela el run activo, **Then** la secuencia salta al siguiente modelo (o termina si no hay más).
4. **Given** 1 solo modelo seleccionado, **When** se lanza, **Then** el comportamiento es equivalente al actual (un run, secuencia trivial).
5. **Given** una secuencia en curso, **When** otro ADMIN intenta lanzar otra simulación, **Then** recibe 409 (la regla "una simulación en curso" cubre todo el lote).

---

### Edge Cases

- **Run histórica ya COMPLETADA sin métricas**: backfill perezoso al consultar detalle (US2-E4), sin migración de datos obligatoria.
- **Ollama caído a mitad de corrida**: los casos no se clasifican → el timeout configurable cierra el run como `FALLIDA` y la secuencia continúa con el siguiente modelo.
- **Modelo de embedding seleccionado**: validación existente (`isEmbeddingModel`) aplicada a cada modelo del array.
- **Cancelación entre modelos**: un run `PENDIENTE` cancelado antes de iniciar se salta en la secuencia.
- **Worker reiniciado a mitad de secuencia**: el job de secuencia debe ser reanudable (reintento pg-boss) sin duplicar reportes ya creados (la creación es idempotente por `SimulacionReporte.reporteId @unique`).

## Requirements

### Functional Requirements

- **FR-001**: El sistema NO DEBE marcar un run `COMPLETADA` al encolar reportes; el batch creator deja el run en `EN_PROGRESO` (o `FALLIDA` si no se creó ninguno).
- **FR-002**: El sistema DEBE actualizar `progreso` conforme cada caso alcanza un estado final de clasificación, sin depender del polling de la UI (hook en el flujo de procesamiento del reporte).
- **FR-003**: Un run DEBE pasar a `COMPLETADA` solo cuando `progreso + casosNoEncolados >= totalCasos` (o `FALLIDA` por timeout configurable / sin casos creados), fijando `fechaFin`.
- **FR-004**: Al completarse, el sistema DEBE persistir en `metricasJson`: `accuracy`, `aciertos`, `fallos`, `omitidos`, `latenciaPromedioMs`, `latenciaP50Ms`, `latenciaP95Ms`, `usoDesempate` (conteo y porcentaje), además de lo ya calculado (`porCategoria`, `matrizConfusion`, `falsosNegativos`, `distribucionEstados`, `casosFallidos`).
- **FR-005**: El detalle de un run COMPLETADA sin métricas DEBE disparar su cálculo y persistencia (backfill perezoso), sin condición de `metricasJson` nulo parcial que lo bloquee.
- **FR-006**: El API de creación DEBE aceptar `modelos: string[]` (1..N); valida cada uno (no embedding, no vacío) y crea un `SimulacionRun` por modelo con el mismo set de casos.
- **FR-007**: La ejecución multi-modelo DEBE ser estrictamente secuencial: el run N+1 no crea reportes hasta que el run N está en estado final.
- **FR-008**: La cancelación de un run en secuencia DEBE hacer saltar al siguiente modelo; la regla 409 de "simulación en curso" DEBE cubrir todo el lote.
- **FR-009**: El formulario "Nueva simulación" DEBE permitir seleccionar varios modelos (paso 2) y mostrar la estimación agregada; el dashboard DEBE mostrar progreso y métricas por run/modelo.
- **FR-010**: El timeout de estancamiento DEBE ser configurable (parámetro de sistema con default documentado).

### Key Entities

- **`SimulacionRun`**: corrida de un modelo sobre un set de casos (`progreso`, `estado`, `metricasJson`, `casosJson`). Uno por modelo en modo multi.
- **`SimulacionReporte`**: vínculo run ↔ reporte con `categoriaEsperada`; `reporteId` único (idempotencia).
- **`ClasificacionIA`**: resultado crudo por reporte (`categoria`, `confianza`, `latenciaMs`, `usoCascada`).
- **Job pg-boss `simulacion-run` / secuenciador**: transporte de la ejecución; la secuencia multi-modelo se apoya en la completitud de US1.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Con el JSON de 50 casos, `progreso` refleja el avance real (observable vía GET detalle durante la corrida) y el run pasa a `COMPLETADA` exactamente al clasificar el caso 50 (o los creados).
- **SC-002**: Tras completar, `metricasJson.accuracy` coincide con el cálculo SQL directo sobre `ClasificacionIA` (tolerancia 0; verificado con el set semilla, accuracy esperado ~0.98 para qwen según medición de ZEUS).
- **SC-003**: La UI (cards + detalle) muestra progreso, accuracy y latencias distintos de cero con datos reales.
- **SC-004**: Lanzando 2 modelos sobre los 50 casos: dos runs, ejecución secuencial verificable por `fechaInicio`/`fechaFin` (run 2 inicia tras el fin del run 1), métricas independientes por run.
- **SC-005**: Gate completo verde: `npm run lint`, `npm run test`, `npm run build`, `npx tsc --noEmit` + `dev-restart.sh`.

## Assumptions

- El JSON de 50 casos del laboratorio (usado en specs 070–072) sigue disponible para la validación.
- La secuencia multi-modelo se implementa server-side (worker), no con esperas del cliente; la UI solo lanza y observa.
- No se requiere agrupación visual de lote en la UI: una card por run/modelo, ordenadas por fecha, es suficiente (KISS).
- El timeout por defecto propuesto es 60 minutos por run, configurable vía `ParametroSistema`.
- Runs históricas COMPLETADA con métricas parciales se cubren con backfill perezoso; no hay migración de datos masiva.

## Implementación

**Fecha**: 2026-07-22 · **Cierre completo**: [`cierre.md`](./cierre.md)

- C1 completitud: executor sin COMPLETADA-al-encolar (reanudable), hook en `procesar`, total efectivo + timeout (`ia.simulacion_timeout_minutos`, 60), backfill perezoso.
- C2 métricas: `latenciaPromedioMs` + `usoDesempate` persistidos; UI con 6 tarjetas.
- C3 multi-modelo: `modelos[]` (1..5), un run por modelo, job `simulacion-lote` secuencial en el worker, form con checkboxes.
- **Bug encontrado en validación**: `shortRunId` por prefijo cuid generaba identificadores SIM duplicados entre runs del mismo lote → dedup marcaba la run 2 como DUPLICADO. Fix: sufijo `slice(-6)` + test de regresión.
- Validación en vivo (50 casos): ornith:9b COMPLETADA 50/50 accuracy 0.94 (= SQL), qwen2.5:14b COMPLETADA 50/50 accuracy 0.96 (= SQL); secuencia verificada en log del worker.
- Gate: lint 0 errores · tsc OK · **738/738 tests** · build limpio · `dev-restart.sh` healthcheck OK.
- Commit: `fix(simulacion): completitud/métricas + selección multi-modelo (spec 083, I-06)`.
