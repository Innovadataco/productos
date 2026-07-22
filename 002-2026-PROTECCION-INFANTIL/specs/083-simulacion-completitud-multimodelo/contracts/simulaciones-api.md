# Contracts — Spec 083

## POST /api/admin/ia/simulaciones

Cambio de contrato (único cliente: `NuevaSimulacionForm`; test propio actualizado).

**Request** (antes → después):

```jsonc
// antes
{ "modelo": "qwen3:8b", "archivo": "...", "formato": "json" }
// después
{ "modelos": ["qwen3:8b", "ornith:9b"], "archivo": "...", "formato": "json" }
```

- `modelos`: array de 1..5 strings, ninguno puede ser modelo de embedding (`isEmbeddingModel`).
- Errores: 400 validación (Zod / embedding / archivo), 409 si hay cualquier run `PENDIENTE`/`EN_PROGRESO` (cubre el lote), 429 rate limit.

**Response 202**:

```jsonc
// antes
{ "runId": "...", "estado": "PENDIENTE", "totalCasos": 50 }
// después
{ "runIds": ["...", "..."], "estado": "PENDIENTE", "totalCasos": 50 }
```

Efecto: crea un `SimulacionRun` por modelo (orden del array, mismo `casosJson`) y encola un job `simulacion-lote` con `{ runIds }`.

## GET /api/admin/ia/simulaciones/[id]

Sin cambio de shape (devuelve el run). Cambio de comportamiento:

- `progreso` y `estado` reflejan el ciclo real (EN_PROGRESO hasta completar).
- Si el run está `COMPLETADA` y `metricasJson` no contiene métricas completas (p. ej. falta `accuracy`), las calcula y persiste antes de responder (backfill perezoso, cubre runs históricas).

## metricasJson (shape persistido al completar)

```jsonc
{
  "totalCasos": 50, "progreso": 50,
  "aciertos": 49, "fallos": 1, "omitidos": 0,
  "accuracy": 0.98,
  "latenciaPromedioMs": 4231, "latenciaP50Ms": 3900, "latenciaP95Ms": 8100,
  "usoDesempate": { "casos": 3, "porcentaje": 0.06 },
  "porCategoria": { "...": { "precision": 0, "recall": 0, "f1": 0, "support": 0, "aciertos": 0, "fallos": 0 } },
  "matrizConfusion": [{ "esperado": "...", "asignado": "...", "count": 1 }],
  "falsosNegativos": [{ "indice": 1, "identificador": "...", "esperado": "...", "asignado": "...", "confianza": 0, "estado": "..." }],
  "distribucionEstados": { "CLASIFICADO": 50 },
  "casosFallidos": 0
}
```

## Job pg-boss

- Nuevo: `simulacion-lote` → `{ runIds: string[] }` (ejecuta runs en secuencia).
- Se mantiene: `simulacion-run` → `{ runId, modeloClasificacion }` (compat con jobs encolados; el POST ya no lo emite).

## Parámetro de sistema nuevo (seed)

- `ia.simulacion_timeout_minutos` (INTEGER, default 60): estancamiento máximo de un run `EN_PROGRESO` antes de marcarla `FALLIDA`.
