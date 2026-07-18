# Plan de implementación — Spec 014 Laboratorio de Experimentos IA

> **Documentado retroactivamente el 2026-07-18** a partir de `spec.md`, migraciones y código de `src/app/api/admin/ia/experimentos/**`.

## Condiciones de aprobación (R1-R7)

1. Un experimento nunca cambia la configuración de producción (EVALUAR ≠ ACTIVAR).
2. Anti-leakage intacto: `CasoEval` no entra a datasets ni retrieval.
3. Textos de prueba no se persisten ni loguean (R2).
4. Una corrida a la vez.
5. Migraciones con `prisma migrate dev` (R4).
6. Lint, tsc, build y tests verdes.

## Fases

### 1. Schema
- Extender `EvalRun` con `nombre`, `notas`, `configSnapshot`, `progresoCasos`, `progresoTotal`.
- Crear tabla `EvalResultado` con una fila por caso: esperado, predicho, confianza, estadoFinal, correcto, latencia.

### 2. Backend
- `POST /api/admin/ia/experimentos`: crear experimento, validar modelo instalado, encolar job.
- `GET /api/admin/ia/experimentos`: listar con filtros.
- `GET /api/admin/ia/experimentos/[id]`: detalle, métricas, baseline.
- `GET /api/admin/ia/experimentos/[id]/resultados`: resultados por caso filtrables.
- `POST /api/admin/ia/experimentos/comparar`: comparar 2-5 experimentos misma `fixtureVersion`.
- `POST /api/admin/ia/experimentos/[id]/preparar-activacion`: devuelve config para pre-cargar en Configuración.

### 3. Worker
- Reutilizar cola `eval-classifier-run`.
- Validar que el modelo del `configSnapshot` siga instalado; si no, marcar `FALLIDA`.
- Guardar progreso cada caso.
- Persistir métricas y resultados por caso.

### 4. Frontend
- Tab **Laboratorio**: lista, asistente de nuevo experimento, dashboard por experimento, comparador.
- Tab **Configuración**: banner de pre-carga y timeline de cambios de producción.

### 5. Tests
- Crear experimento.
- Comparación de experimentos.
- Preparar activación no muta producción.

### 6. Cierre
- Actualizar `IMPLEMENTATION-REPORT.md`.
- Crear `specs/014-laboratorio-ia/reporte-cierre.md`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Activación accidental de experimento | El botón solo pre-carga en Configuración; guardar requiere acción explícita del admin. |
| Comparar apples con oranges | Bloqueo de distinta `fixtureVersion`. |
| Modelo desinstalado antes de ejecutar | Validación al crear y re-validación en worker. |

## Definición de terminado

- Flujo nuevo experimento + dashboard + comparador funcionando.
- Experimento no afecta config de producción.
- Tests pasan.
- Lint, tsc, build y smoke verdes.
