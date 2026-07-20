# Plan: Simulación de carga y comparación de modelos (Spec 070)

## Constitution Check

- **Texto plano**: sí, todos los artefactos son texto plano.
- **IA local**: no se requieren terceros; el plan se ejecuta con Ollama local y herramientas locales.
- **Lenguaje sin veredictos**: el plan describe comportamientos, no emite juicios.
- **Migraciones aditivas**: se añaden `SimulacionRun` y `SimulacionReporte`; no se toca `Reporte` ni se borran datos.
- **Un solo worker**: el diseño respeta el worker único; la simulación no crea un segundo worker.
- **Cobertura Vitest**: todo endpoint nuevo tendrá su `.test.ts`.

*Constitution Check pasado.*

---

## Technical Context

- **Framework**: Next.js 16 + React 19 + Tailwind CSS + TypeScript + Prisma + PostgreSQL + pg-boss.
- **Pipeline real**: `POST /api/reportes` (anónimo) → `sendReporte()` → `pg-boss` → worker → `POST /api/reportes/procesar` → Ollama.
- **Worker**: único por advisory lock de Postgres; concurrencia configurable (default 2); backpressure a partir de `max_pendientes` (default 100).
- **Modelos**: listado en `GET /api/admin/ia/modelos`; modelo por defecto `ornith:9b` configurable vía `ParametroSistema`.
- **Métricas de latencia**: ya capturadas en `ClasificacionIA.latenciaMs`, `OllamaMetrics`.
- **Rate limit**: `DISABLE_RATE_LIMIT=true` en dev evita que el anti-abuso corte la simulación.
- **Patrón visual existente**: `IaEvalManager` con tabs, `LaboratorioTab` (list/new/detail/compare), `ComparadorExperimentos`, `ExperimentCard`, `MetricCard`, `Badge`, `GlassCard`, `Select`, `Button`, `EmptyState`, `ErrorState`.

---

## Complexity Tracking

| Área | Complejidad | Riesgo | Notas |
|---|---|---|---|
| Carga y validación de casos | Media | Bajo | Parsing CSV/JSON + Zod en cliente/servidor. |
| Creación de reportes anónimos en pipeline real | Alta | Medio | Respetar worker único, forzar modelo, no contaminar datos reales. |
| Monitoreo en vivo | Media | Medio | Polling + actualización de progreso; cancelación parcial. |
| Resultados por caso | Baja | Bajo | Leer `Reporte` + `ClasificacionIA` filtrados por corrida. |
| Métricas agregadas | Media | Medio | Cálculo de precisión/recall, matriz de confusión, percentiles. |
| Comparación de corridas | Media | Bajo | Replicar `ComparadorExperimentos` con datos de `SimulacionRun`. |
| Exportación CSV/JSON | Baja | Bajo | Generación síncrona en server action o endpoint. |
| Migraciones | Baja | Bajo | Dos tablas aditivas, índices simples. |

---

## Decisiones de diseño propuestas

1. **Topes y concurrencia**:
   - Máximo 200 casos por corrida (tunable via `ParametroSistema` `simulacion.max_casos`).
   - Solo una corrida en estado `PENDIENTE` o `EN_PROGRESO` a la vez; intentar lanzar otra devuelve error con sugerencia de cancelar o esperar.
   - La creación de reportes se hace en batches (ej. 5 a 5) para no saturar la cola; se respeta el backpressure de `pg-boss`.

2. **Modelo forzado sin afectar producción**:
   - Se crea un `configSnapshot` temporal con `modeloClasificacion` igual al elegido.
   - El worker lee `modeloClasificacion` de `ParametroSistema` por defecto; para simulaciones, se propone pasar el modelo en el payload del job (`data.modeloClasificacion`) y usarlo si existe, sin persistir en `ParametroSistema`.
   - Si el worker no soporta override por job, se usa un parámetro de sistema temporal `simulacion.modelo_override` con TTL o se restaura al finalizar. En el plan se deja abierto a validar en implementación.

3. **Identificación de datos de simulación**:
   - Los identificadores de simulación usan prefijo `SIM-` + id de corrida + índice (ej. `SIM-abc123-042`).
   - `FuenteReporte` guarda `origen: "SIMULACION"` para poder excluir de dashboards si se decide más adelante.

4. **Patrón de UI**:
   - 4ª sub-pestaña dentro de `IaEvalManager` llamada "Simulación".
   - Vistas: `list` → `new` → `detail` → `compare`, replicando `LaboratorioTab`.
   - Componentes a reutilizar: `GlassCard`, `Badge`, `Button`, `Select`, `EmptyState`, `ErrorState`, `MetricCard`, `ComparadorExperimentos` (adaptado a corridas), `NuevoExperimentoForm` (como referencia para el formulario de nueva simulación).
   - Selector de modelo: mismo endpoint `/api/admin/ia/modelos` filtrando `!esEmbedding`.
   - Badges de estado: `PENDIENTE` (warning), `EN_PROGRESO` (info), `COMPLETADA` (success), `FALLIDA` (danger), `CANCELADA` (neutral).

5. **Monitoreo y cancelación**:
   - Polling cada 3 segundos al detalle de `SimulacionRun`.
   - Cancelar cambia el estado a `CANCELADA` y detiene el batch creator; los jobs ya encolados siguen su curso.
   - Progreso: `progreso` = casos cuyo `reporte.estado` ya no es `PENDIENTE` (o cuyo job terminó), sobre `totalCasos`.

6. **Métricas**:
   - Latencia p50/p95 calculada desde `ClasificacionIA.latenciaMs` de los reportes de la corrida.
   - Precisión/recall por categoría desde `categoriaEsperada` vs. `categoriaAsignada` (canonizada).
   - Matriz de confusión construida en memoria en el endpoint de resultados.
   - Falsos negativos: casos donde `categoriaEsperada` es grave (`ACOSO`, `CIBERBULLYING`, `GROOMING`, etc.) y la asignada es leve o no detectada.

7. **Exportación**:
   - Endpoint `GET /api/admin/ia/simulaciones/[id]/export?format=csv|json`.
   - CSV: una fila por caso con columnas definidas.
   - JSON: array de casos + objeto `metricas`.

---

## Riesgos y mitigaciones

- **Riesgo**: Simulación satura Ollama/colapsa el worker. **Mitigación**: tope de casos, batches, backpressure, concurrencia limitada, cancelación.
- **Riesgo**: Datos de simulación contaminan dashboards. **Mitigación**: prefijo `SIM-` y `origen: SIMULACION` en `FuenteReporte`; dashboards pueden filtrar si se decide.
- **Riesgo**: Forzar el modelo afecta producción. **Mitigación**: override por job o parámetro temporal; no se cambia el modelo de producción.
- **Riesgo**: Cancelación deja inconsistencias. **Mitigación**: estado `CANCELADA` y conteo de casos procesados; no se revierten reportes ya creados.
- **Riesgo**: El polling es ineficiente. **Mitigación**: polling cada 3s es aceptable para este volumen; se puede evolucionar a SSE o WebSocket en fase futura.

---

## Approach

1. Migración aditiva: `SimulacionRun` y `SimulacionReporte`.
2. Endpoints: list, create, get, cancel, results, compare, export.
3. Componentes UI: reutilizar patrón del Laboratorio; crear `SimulacionTab` (list/new/detail/compare) y `NuevaSimulacionForm`.
4. Integración con pipeline: crear reportes anónimos en batch, forzar modelo, monitorear progreso.
5. Cálculo de métricas y comparación.
6. Tests: Vitest para todos los endpoints y componentes clave.
7. Validación: quickstart + deploy limpio.

