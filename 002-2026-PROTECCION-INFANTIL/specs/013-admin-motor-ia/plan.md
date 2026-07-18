# Plan de implementación — Spec 013 Administración del Motor IA desde el Panel

> **Documentado retroactivamente el 2026-07-18** a partir de `spec.md`, migraciones y código de `src/app/api/admin/ia/**`.

## Condiciones de aprobación (R1-R7)

1. Los textos de reportes solo se procesan en entorno local/privado (R2).
2. La URL base de Ollama solo acepta localhost, 127.0.0.1/8, RFC 1918 o Tailscale.
3. Los casos de eval nunca entran al dataset/embedding ni al retrieval RAG.
4. Migraciones con `prisma migrate dev` (R4).
5. El worker ejecuta evals en background con un solo run activo.
6. Lint, tsc, build y tests verdes.

## Fases

### 1. Schema y migración
- Crear enum `CasoEvalFuente` (`SEMILLA`, `MANUAL_ADMIN`, `PRODUCCION_ANONIMIZADO`).
- Crear enum `EvalRunEstado` (`PENDIENTE`, `EN_PROGRESO`, `COMPLETADA`, `FALLIDA`, `CANCELADA`).
- Crear modelo `CasoEval` con texto, categorías esperadas, ruido, fuente, activo, fixtureVersion.
- Crear modelo `EvalRun` con tipo, fixtureVersion, estado, resultado JSON, error.
- Crear índices por estado, fixtureVersion y creador.

### 2. Seed
- Migrar los 110 casos de `scripts/eval-fixture.json` a `CasoEval` como `fuente=SEMILLA`, `fixtureVersion=1`.

### 3. Backend
- `src/lib/ai/ollama-config.ts`: validación de URL local/privada y `getOllamaBaseUrl()`.
- `GET /api/admin/ia/modelos`: listar modelos instalados excluyendo embeddings.
- `POST /api/admin/ia/ollama/probar`: probar conexión a URL.
- `GET /api/admin/ia/evals/casos`: listar casos con filtros y conteos.
- `POST /api/admin/ia/evals/casos`: alta de caso (incrementa `fixtureVersion`).
- `PATCH /api/admin/ia/evals/casos/[id]/desactivar`: desactivar caso (incrementa `fixtureVersion`).
- `POST /api/admin/ia/evals`: encolar nueva corrida si no hay otra en progreso.
- `GET /api/admin/ia/evals/[id]` y `/api/admin/ia/evals/historial`.

### 4. Worker
- Consumir cola `eval-classifier-run`.
- Actualizar estados `PENDIENTE → EN_PROGRESO → COMPLETADA/FALLIDA`.
- Persistir métricas en `EvalRun.resultadoJson` y copia en `eval-results/`.

### 5. Frontend
- Tab **Modelos**: selector de modelo, URL Ollama, botón probar conexión, guardar activo.
- Tab **Eval**: listado de casos, alta/desactivar, corrida con estimación de duración, historial.

### 6. Tests
- Anti-leakage: un caso activo de `CasoEval` no es recuperable por el RAG.
- Auth/rechazo de URL pública.
- Workflow completo de corrida en background.

### 7. Cierre
- Actualizar `IMPLEMENTATION-REPORT.md`.
- Crear `specs/013-admin-motor-ia/reporte-cierre.md`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Fuga de casos de eval al dataset RAG | Tabla separada; retrieval solo consulta `DatasetEntrenamiento`. |
| Cambio de URL a proveedor cloud | Validación estricta en PATCH; rechazo con mensaje R2. |
| Saturación de Ollama | Una corrida a la vez; estimación de duración visible. |

## Definición de terminado

- Todos los endpoints y UI funcionan.
- Eval F7 de 110 ejemplos reproduce métricas de referencia.
- Tests anti-leakage pasan.
- Lint, tsc, build y smoke verdes.
