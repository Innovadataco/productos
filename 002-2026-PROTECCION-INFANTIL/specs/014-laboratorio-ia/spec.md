# Spec 014 — Laboratorio de Experimentos IA

## Estado
- **Estado:** CERRADA
- **Creada:** 2026-07-17
- **Cerrada:** 2026-07-17
- **Owner:** Equipo Protección Infantil

## Concepto
Un **experimento** = una corrida del eval con una configuración congelada (modelo + parámetros + `fixtureVersion`), con nombre, notas, métricas completas y resultados por caso. Es repetible, comparable y nunca afecta la configuración de producción.

## Decisiones de arquitectura

### Modelo de datos: extender `EvalRun`
No se creó una tabla `Experimento` separada. Un experimento **es** una corrida de eval; `EvalRun` ya modelaba eso desde la Spec 013.

Cambios:
- `EvalRun` agrega `nombre`, `notas`, `configSnapshot` (JSON congelado), `progresoCasos`, `progresoTotal`.
- Nueva tabla `EvalResultado` con una fila por caso: `experimentoId`, `casoEvalId`, `esperado`, `predicho`, `confianza`, `estadoFinal`, `correcto`, `latenciaMs`.
- Las corridas históricas de la Spec 013 quedan con `configSnapshot=null` y se muestran sin baseline.

### Baseline
La línea de base es el último experimento `COMPLETADA` cuyo `configSnapshot` coincide con la configuración de producción actual y la misma `fixtureVersion`. Si no existe, la UI muestra: "Sin línea de base — corré un experimento con la configuración de producción actual".

### EVALUAR ≠ ACTIVAR
- Un experimento nunca cambia la config de producción.
- El botón **"Usar esta configuración"** del dashboard pre-carga los valores en la tab Configuración vía `localStorage`.
- Activar sigue siendo el acto explícito de guardar en Configuración, con su `AuditLog` `PARAM_UPDATE`.

## Arquitectura

### Endpoints

| Método | Ruta | Propósito |
|--------|------|-----------|
| POST | `/api/admin/ia/experimentos` | Crea experimento, valida modelo instalado, encola job. |
| GET | `/api/admin/ia/experimentos` | Lista experimentos con filtros. |
| GET | `/api/admin/ia/experimentos/[id]` | Detalle, métricas, baseline. |
| GET | `/api/admin/ia/experimentos/[id]/resultados` | Resultados por caso filtrables. |
| POST | `/api/admin/ia/experimentos/comparar` | Compara 2-5 experimentos misma `fixtureVersion`. |
| POST | `/api/admin/ia/experimentos/[id]/preparar-activacion` | Devuelve config para pre-cargar en Configuración. |

### Worker
- Cola pg-boss: `eval-classifier-run`.
- Al ejecutar, valida que el modelo del `configSnapshot` siga instalado en Ollama; si no, marca `FALLIDA`.
- Guarda progreso cada caso (`progresoCasos`/`progresoTotal`).
- Persiste métricas en `EvalRun.resultadoJson` y resultados por caso en `EvalResultado`.
- `AuditLog` `EXPERIMENT_START` (endpoint) y `EXPERIMENT_COMPLETE` (worker).

### UI
- Tab **Laboratorio** con:
  - Lista de experimentos completados.
  - Asistente "Nuevo experimento" (3 pasos: config, confirmar, lanzar).
  - Dashboard por experimento: tarjetas de métricas, comparación vs baseline, métricas operativas, gráfica F1 por categoría, casos fallados.
  - Comparador de experimentos.
- Tab **Configuración**:
  - Banner de pre-carga cuando viene de un experimento.
  - Timeline de cambios de producción (`AuditLog` `PARAM_UPDATE`).

## Flujo guiado "Nuevo experimento"

1. **Paso 1 — Configuración**: modelo de los instalados + parámetros prellenados con producción, editables solo para el experimento. Estimación de duración según modelo.
2. **Paso 2 — Confirmar**: resumen de config y duración estimada.
3. **Lanzar**: encola en pg-boss con candado de una corrida a la vez.
4. **Resultados**: dashboard con métricas y comparación.

## Candados y reglas

- Modelo del `configSnapshot` validado contra modelos instalados al crear; si se desinstala antes de ejecutar, el run pasa a `FALLIDA`.
- Una corrida a la vez: `POST /api/admin/ia/experimentos` rechaza si hay `EvalRun` en `PENDIENTE` o `EN_PROGRESO`.
- Comparador bloquea experimentos de distinta `fixtureVersion`.
- Anti-leakage intacto: `CasoEval` no entra a datasets ni retrieval.
- R1-R7 vigentes.

## Demo documentada

### Nota sobre la config de producción al inicio de la demo
Al arrancar la demo, la BD de desarrollo tenía la config de producción en `ornith:35b` / umbral 0.5 / 5 votos (cambiado manualmente en sesiones previas según `AuditLog`: `ornith:9b → qwen2.5:32b → ornith:35b`). Para cumplir el requisito de baseline con `ornith:9b` / 1.0 / 5 / 0.7 / 3, se restauraron los parámetros de producción a esos valores antes de correr el baseline real. El experimento inicial con `ornith:35b` se renombró a "Prueba ornith:35b".

### Experimento — Prueba ornith:35b
- ID: `cmroh6bkk0001vbikbmu0le8v`
- Nombre: "Prueba ornith:35b"
- Config: `ornith:35b`, umbral 0.5, 5 votos, temp 0.7, RAG topK 3
- Estado: COMPLETADA
- Métricas:
  - accuracy: 70.0%
  - error silencioso: 28.8%
  - revisión manual: 5.5%
  - recall OTRO: 40.0%
- Nota: no es baseline porque la config de producción real es `ornith:9b` / 1.0.

### Experimento — Línea de base real
- ID: `cmroirumw000nvbikcv9i3dfb`
- Nombre: "Línea de base ornith:9b"
- Config: producción exacta (`ornith:9b`, umbral 1.0, 5 votos, temp 0.7, RAG topK 3)
- Estado: COMPLETADA
- Métricas:
  - accuracy: 68.2%
  - error silencioso: 20.8%
  - revisión manual: 34.5%
  - recall OTRO: 30.0%
- Valida la no-regresión de los números de referencia de la Spec 013.

### Experimento — Config alternativa
- ID: `cmrohlhmv0005vbikt1jysrfp`
- Nombre: "ornith:9b - 3 votos"
- Config: `nVotos: 3` (resto igual a producción real)
- Estado: COMPLETADA
- Métricas:
  - accuracy: 68.2%
  - error silencioso: 30.5%
  - revisión manual: 4.5%
  - recall OTRO: 30.0%

### Comparación
- Endpoint: `POST /api/admin/ia/experimentos/comparar` con IDs del baseline real y la config alternativa.
- Resultado: comparable (`fixtureVersion=1`), frontier = 4 casos.
- Deltas observados: 3 votos empeoró accuracy (-0pp respecto al baseline, pero en la comparación directa con 35b mostró -1.8pp), error silencioso (+9.7pp), recall OTRO (0pp); mejoró revisión manual (-30pp).

### Activación
- Desde el dashboard de la config alternativa se presiona "Usar esta configuración".
- Endpoint `POST /api/admin/ia/experimentos/[id]/preparar-activacion` devuelve los parámetros.
- La tab Configuración los precarga vía `localStorage`.
- El admin guarda explícitamente (`PATCH /api/config/parametros/reportes.classification.n_votos` 5 → 3), generando `AuditLog` `PARAM_UPDATE`.
- Para la demo se revirtió inmediatamente a `5` para no alterar la línea de base.

## Verificaciones de cierre

- [x] `npm run lint` ✅
- [x] `npx tsc --noEmit` ✅
- [x] `npm run build` ✅
- [x] `npm test` 147/147 ✅
- [x] `scripts/smoke-e2e.ts` ✅
- [x] Migración aplicada en BD dev y test ✅
- [x] Demo real ejecutada (A + B + comparador + flujo activar) ✅

## Notas

- El worker debe estar corriendo (`npm run worker`) para ejecutar experimentos en background.
- El eval de PII (`scripts/eval-pii.ts`) sigue fuera del laboratorio, con fixture JSON, por no encajar en `CasoEval`.
