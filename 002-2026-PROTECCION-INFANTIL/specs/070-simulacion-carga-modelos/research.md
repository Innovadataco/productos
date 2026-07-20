# Research: Simulación de carga y comparación de modelos (Spec 070)

**Date**: 2026-07-20

**Feature**: `specs/070-simulacion-carga-modelos/spec.md`

---

## 1. Reutilización de componentes y patrones del Laboratorio

El submódulo "Simulación" vive dentro de `/dashboard/admin/ia?tab=eval` como 4ª sub-pestaña. Debe replicar el patrón y la calidad del Laboratorio existente. Los componentes y patrones a reutilizar son:

### Contenedor y navegación

| Componente | Ruta | Reutilización |
|---|---|---|
| `IaEvalManager` | `src/components/modules/ia/IaEvalManager.tsx` | Agregar tab "Simulación" junto a Laboratorio, Casos del fixture, Historial. |
| Tabs internos | `IaEvalManager.tsx` | Estilo de borde activo (`border-sky-500` / `dark:border-cyan-400`). |

### Vistas list → new → detail → compare

| Componente | Ruta | Reutilización |
|---|---|---|
| `LaboratorioTab` | `src/components/modules/ia/eval/LaboratorioTab.tsx` | Patrón de `view: "list" \| "new" \| "detail" \| "compare"`; `selectedId`. |
| `SimulacionTab` (nuevo) | `src/components/modules/ia/simulacion/SimulacionTab.tsx` | Router de vistas replicando `LaboratorioTab`. |
| `ExperimentCard` | `src/components/modules/ia/eval/ExperimentCard.tsx` | Card clickeable con métricas en grid 3 columnas. Adaptar a `SimulacionRun`. |
| `MetricCard` | `src/components/modules/ia/eval/MetricCard.tsx` | Card de métrica con delta. Adaptar a p50/p95/aciertos. |
| `ComparadorExperimentos` | `src/components/modules/ia/eval/ComparadorExperimentos.tsx` | Tabla comparativa; adaptar a `ComparadorSimulaciones`. |
| `NuevoExperimentoForm` | `src/components/modules/ia/eval/NuevoExperimentoForm.tsx` | Referencia para formulario de nueva simulación (modelo, notas). |
| `ExperimentoDashboard` | `src/components/modules/ia/eval/ExperimentoDashboard.tsx` | Referencia para detalle con polling y métricas. |

### Selector de modelos

| Componente | Ruta | Reutilización |
|---|---|---|
| Selector de Ollama | `src/components/modules/ia/eval/NuevoExperimentoForm.tsx:32` | Carga `GET /api/admin/ia/modelos`, filtra `!m.esEmbedding`, usa `Select`. |
| `Select` (UI) | `src/components/ui/Select.tsx` | Componente genérico para selector. |

### Badges de estado

| Componente | Ruta | Mapeo propuesto |
|---|---|---|
| `Badge` | `src/components/ui/Badge.tsx` | `PENDIENTE` → warning; `EN_PROGRESO` → info; `COMPLETADA` → success; `FALLIDA` → danger; `CANCELADA` → neutral. |

### Tablas y superficies

| Componente | Ruta | Reutilización |
|---|---|---|
| `GlassCard` | `src/components/ui/GlassCard.tsx` | Superficie base de cards. |
| `EmptyState` | `src/components/ui/EmptyState.tsx` | Listado vacío. |
| `ErrorState` | `src/components/ui/ErrorState.tsx` | Fallo de carga. |
| `Button` | `src/components/ui/Button.tsx` | Acciones primarias/secundarias/danger. |
| `Input` | `src/components/ui/Input.tsx` | Inputs numéricos/texto. |
| `Tooltip` | `src/components/ui/Tooltip.tsx` | Botones de acción (creado en Spec 054). |
| `Modal` | `src/components/ui/Modal.tsx` | Confirmación de cancelación (creado en Spec 054). |

### Estilos y tokens

| Token | Ruta | Uso |
|---|---|---|
| `.bg-page` | `src/app/globals.css` | Fondo de página con degradados. |
| `.text-body`, `.text-muted`, `.text-subtle`, `.text-accent` | `src/app/globals.css` | Jerarquía tipográfica. |
| `.glass`, `.glass-strong`, `.glass-input` | `src/app/globals.css` | Superficies glass. |
| Espaciado: `space-y-6`, `gap-4`, `p-5/p-6`, `rounded-3xl`/`rounded-xl` | Laboratorio | Consistencia visual. |
| Colores semánticos: `green-600`, `red-600`, `amber-700`, `sky-500`, `cyan-400` (dark) | Laboratorio | Badges y métricas. |

---

## 2. Pipeline de reportes y worker

### Endpoint de reporte anónimo

| Aspecto | Detalle |
|---|---|
| Endpoint | `POST /api/reportes` |
| Archivo | `src/app/api/reportes/route.ts` |
| Payload | `identificador`, `plataforma`, `texto`, `fechaIncidente`, `ciudad`, `pais`, `paisId`, `ciudadId`, `otraPlataforma`, `edadVictima` |
| Validación | `crearReporteSchema` (Zod) en `src/lib/validators.ts` |
| Rol permitido | Solo `PARENT` (anónimo); roles internos reciben 403 |
| Duplicados | `usuarioId + identificador` en 30 días → 429 `DUPLICATE_REPORT` |
| Rate limits | `report`, `report_fingerprint`, `report_identificador` (deshabilitados en dev con `DISABLE_RATE_LIMIT=true`) |
| Encolamiento | `sendReporte(reporte.id, { prioridadAlta: true })` si estado `PENDIENTE` |
| Respuesta | `{ reporte: { id, numeroSeguimiento, estado }, mensaje }` HTTP 201 |

### Worker y cola

| Aspecto | Detalle |
|---|---|
| Cola | `pg-boss`, nombre `reporte-procesamiento` |
| Backpressure | `max_pendientes` (default 100); si se alcanza, no se encolan más; `drainPending()` los reencola tras éxito |
| Worker único | Advisory lock Postgres (`pg_try_advisory_lock(123456789)`) |
| Concurrencia | `teamSize = teamConcurrency = 2` (default) |
| Procesamiento | Worker llama `POST /api/reportes/procesar` con `X-Worker-Secret` |
| Fallback | Si falla después de reintentos, `POST /api/reportes/fallback` → `REVISION_MANUAL` |

### Métricas de latencia ya capturadas

| Entidad | Campos | Uso |
|---|---|---|
| `ClasificacionIA` | `modeloUsado`, `latenciaMs`, `promptTokens`, `responseTokens`, `rawResponse`, `usoCascada`, `modeloCascada`, `categoriasSecundarias`, `votos` | Persistencia de latencia y modelo usado. |
| `OllamaMetrics` (interface) | `modelo`, `latenciaMs`, `promptTokens`, `responseTokens`, `totalDuration`, `loadDuration` | Métricas en memoria de la llamada a Ollama. |
| Cálculo | `Date.now()` antes/después; `totalDuration` en ns → ms | `clasificacion.latenciaMs + piiResult.metrics.latenciaMs` en `src/app/api/reportes/procesar/helpers/clasificacion.ts:82`. |

### Monitoreo de estado de reportes

No existe un concepto de "lote" en el schema actual. Para Simulación se añaden `SimulacionRun` y `SimulacionReporte` como capa de seguimiento sin modificar `Reporte`.

---

## 3. Entorno de desarrollo

- `DISABLE_RATE_LIMIT=true` en `.env` (verificado en `src/lib/rate-limit.ts:90`). Esto permite inyectar volumen de reportes anónimos sin que el anti-abuso corte la corrida.
- El worker único y la concurrencia de Ollama (`ollamaNumParallel` default 2, `nVotos` 5) son el cuello de botella real de la simulación.
- El submódulo es solo para `ADMIN` en fase de desarrollo; datos descartables.

---

## 4. Decisiones de diseño registradas

### 4.1 ¿Cómo forzar el modelo sin afectar producción? (Decisión definitiva: Opción A por job)

**Opción A — Override por job de `pg-boss` (elegida)**:
- `sendReporte` acepta `modeloClasificacion` opcional en `data` del job y lo envía junto a `reporteId` e `intento`.
- El worker (`scripts/worker-reportes.mjs`) lee `job.data.modeloClasificacion` y lo incluye en el body de `POST /api/reportes/procesar`.
- El endpoint `/api/reportes/procesar` recibe el override y lo pasa a `cargarParametrosClasificacion`.
- `cargarParametrosClasificacion` acepta un objeto parcial `override` (`modeloClasificacion`, `modeloAnonimizacion`, `modeloEmbedding`) y usa el valor del job si existe; de lo contrario, lee de `ParametroSistema` como hace hoy.
- De esta forma, cada job de simulación se procesa con su propio modelo sin alterar el modelo de producción ni afectar reportes reales que no lleven el override.

**Opción B — Parámetro de sistema temporal `simulacion.modelo_override` (DESCARTADA)**:
- Riesgo de contaminar clasificaciones reales si falla a mitad de una corrida o si el worker comparte instancia con reportes reales.
- No se toca `ParametroSistema` para simulaciones.

**Verificación técnica**: el worker ya accede a `job.data.reporteId` e `intento` (`scripts/worker-reportes.mjs:156`). Agregar `modeloClasificacion` en `job.data` y propagarlo al body de `/api/reportes/procesar` es un cambio mínimo y seguro. El helper `cargarParametrosClasificacion` actualmente no recibe parámetros; se le añadirá un argumento opcional `override`.

**Impacto en el plan**: se modificarán `src/lib/queue.ts` (`sendReporte`), `scripts/worker-reportes.mjs` (body del POST), `src/app/api/reportes/procesar/route.ts` (recibir override), y `src/app/api/reportes/procesar/helpers/parametros.ts` (aplicar override). No se modifica el schema de `ParametroSistema`.

### 4.2 ¿Rechazo o encolamiento de segunda corrida?

- **Rechazo simple**: si hay una corrida en `PENDIENTE` o `EN_PROGRESO`, no se permite lanzar otra. UX clara y simple. Se propone esta opción.
- **Encolamiento secuencial**: permitir múltiples `PENDIENTE` y ejecutar en orden. Añade complejidad al batch creator y al monitoreo.

**Decisión preliminar**: rechazo simple para el MVP del plan; documentar como posible mejora futura.

### 4.3 ¿Cómo identificar reportes de simulación?

- Prefijo `SIM-` en el identificador (ej. `SIM-abc123-042`).
- `FuenteReporte.origen = "SIMULACION"` si el schema lo soporta; si no, se usa el prefijo y la relación `SimulacionReporte`.

### 4.4 UI/UX recommendations (ui-ux-pro-max)

- Accessibility: mantener focus rings, aria-labels en botones de acción, contrast 4.5:1.
- Touch & Interaction: botones ≥ 44×44 px, feedback visual de carga, estados disabled claros.
- Performance: reservar espacio para tablas/progreso para evitar CLS; lazy loading en listas largas si aplica.
- Style: replicar glassmorphism del Laboratorio; no inventar nuevos estilos.
- Layout: mobile-first, tablas con scroll horizontal en móvil.
- Animation: transiciones de 150-300ms entre vistas; no animar layout complejo.
- Forms & Feedback: errores de validación cerca del input de archivo; estados de progreso claros.
- Navigation: deep linking a vista detail/compare por ID; back button predecible.
- Charts & Data: usar tooltips y leyendas; no depender solo del color para estados.

---

## 5. Puntos abiertos a validar en implementación

- Confirmar si `FuenteReporte.origen` puede almacenar `"SIMULACION"` o si se requiere otro mecanismo.
- Validar la viabilidad del override del modelo por job sin modificar excesivamente el pipeline.
- Decidir si los reportes de simulación deben excluirse de dashboards de producción y cómo.
- Confirmar que el admin real puede lanzar reportes anónimos (actualmente el endpoint requiere rol `PARENT`; se necesitará un mecanismo de suplantación o un endpoint separado de simulación).

*[NEEDS CLARIFICATION]*: El endpoint `POST /api/reportes` requiere rol `PARENT`. Para simulación se necesita que un `ADMIN` lance reportes anónimos. Se propone crear un endpoint interno de simulación que cree reportes como si fueran anónimos (sin `usuarioId`, fuente `SIMULACION`), sin pasar por el endpoint público. Esto debe validarse en la fase de implementación.

