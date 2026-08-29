# SPEC-012 · research.md · bi-vanna FastAPI + jurado

## Decisiones tomadas al escribir spec+plan (para REVISO)

### D-012-01 · Modelos secuenciales, NO paralelos
Mac Studio tiene 36 GB de RAM. Los 3 modelos suman ~43 GB:
- `qwen2.5:14b` ≈ 8 GB
- `gemma2:27b` ≈ 15 GB
- `aya-expanse:32b` ≈ 20 GB

Ollama descarga el que no cabe. Ejecutarlos EN PARALELO causaría swap thrashing → latencia peor que secuencial. La rúbrica de PI (`src/lib/ai/rubrica.ts` líneas 328-367) ya elige secuencial con el mismo comentario "cuida la RAM". Se replica.

Latencia total esperada por request (calientes): ~15-20 s. Con cache semántico (fachada SPEC-011) hit → <500 ms. La UX se apoya en el cache.

### D-012-02 · `sqlglot` para canonicalización (NO `sqlparse`)
- `sqlparse` (lucid) solo tokeniza y formatea · NO normaliza AST.
- `sqlglot` (tobymao) parsea a AST completo · normaliza (whitespace, orden AND, alias) · transpila entre dialectos.

`sqlglot` es más pesado (~2 MB) pero es la única forma de obtener AST canónico para el jurado. Sin él, el jurado tendría false-negatives por diferencias cosméticas.

### D-012-03 · Structured output nativo Ollama (NO free-text + parseo)
`POST /api/generate` con `format: <json_schema>` fuerza al modelo a devolver JSON válido según el schema. Si el modelo no puede → error (no rescatar a la fuerza). Patrón validado en PI (`ollama-client.ts:64-113`).

### D-012-04 · Devuelve el `sql_crudo` del primer voto del grupo dominante
El post-validator vive en Node (SPEC-011). Preservar el SQL "legible" del modelo permite:
1. Depurar con humanos.
2. Guardarlo en `bi_consulta_log.sqlGenerado` legible.
3. Comparar entre iteraciones del jurado.

El SQL canónico se usa SOLO para comparación interna.

### D-012-05 · Modelos fijos (no configurables por env sencillo)
`LLM_MODELS_JURADO` es CSV env var pero el default incluye los 3 modelos validados en PI. Cambiar los modelos exige nueva SPEC y validación (los 3 elegidos tienen soporte comprobado para structured output).

### D-012-06 · `bi-vanna` NO toca la BD
El servicio SOLO genera SQL a partir del catálogo que la fachada le envía. NO ejecuta el SQL. NO consulta Postgres. Esto:
- Simplifica el aislamiento (solo necesita alcanzar Ollama Mac).
- Elimina superficie de ataque (compromiso de bi-vanna no ejecuta SQL en producción).
- Mantiene el candado 1: la única puerta a la BD queda en la fachada Next.js (Prisma).

### D-012-07 · No usa la librería `vanna.ai` upstream (por ahora)
`vanna.ai` es una librería pesada que asume acceso directo a BD + LLM. Aquí solo necesitamos structured output + canonicalización · el peso de la librería no compensa. Se puede reevaluar cuando queramos retraining con `bi_cache_semantico`.

Nombre del servicio `bi-vanna` se conserva por continuidad con el docker-compose y roadmap (BRIEF-A-05 lo llama así).

## Verificación en fuente

- `productos/002-2026-PROTECCION-INFANTIL/src/lib/ai/ollama-client.ts:49-113`: patrón `llamarOllamaStructured` con `format: schema` · temp 0 · seed 42 · `AbortSignal.timeout(timeoutMs)`. Replicado en Python con `httpx.AsyncClient(timeout=90.0)`.
- `productos/002-2026-PROTECCION-INFANTIL/src/lib/ai/rubrica.ts:328-367`: jurado SECUENCIAL con `for ... await`. Idéntico patrón se aplica aquí.
- `docker-compose.bi.yml` (repo actual): revisar antes de agregar `bi-vanna` (no auditado a fondo aún · SPEC-012 lo audita al implementar).

## Latencia primera request

Medición pendiente al arrancar el contenedor por primera vez sin modelos cacheados:
- Descarga de `aya-expanse:32b` (~20 GB) ≈ 90 s con red LAN Tailscale ≈ 500 Mbps.
- Carga en RAM Mac Studio ≈ 5-10 s adicionales.
- Total primera request: ~2 minutos si el modelo grande no estaba pre-cacheado en Ollama.
- Con `KEEP_ALIVE=24h` y modelo ya cargado: 4-8 s por modelo.

Documentar en `research.md` con medición real durante gate local.

## Riesgos vigilados

1. **Ollama Mac cae:** `bi-vanna` devuelve 500 `ollama_unreachable`. La fachada SPEC-011 debe capturar y devolver plantilla "servicio IA no disponible temporalmente · usa dashboards Superset directamente" (candado 10 · plantillas.ts sección `sin-datos` no aplica → se agrega variante `motor-caido`).
2. **Modelo `gemma2:27b` con `format:schema`:** PI usa `gemma2:27b` para votos rúbrica exitosamente. Riesgo bajo. Si en gate local falla → sustituir por `qwen2.5:32b` (misma familia · schema soportado).
3. **`sqlglot` puede fallar con SQL producido por LLM (nombres exóticos, dialecto ambiguo):** capturar excepción · marcar voto inválido · continuar con los otros modelos.
4. **KEEP_ALIVE=24h:** si Ollama Mac reinicia, los 3 modelos se descargan y hay que re-warm-up. Fase 1 no critical (usuario Jelkin acepta ~90s en la primera consulta post-reinicio).

## Sin-consenso · qué hacer

Cuando `consenso=false`, la fachada SPEC-011 recibe la respuesta y:
1. Devuelve `estado: REVISION` al usuario.
2. `bi_consulta_log.estado = REVISION` con los 3 SQLs guardados.
3. UI (SPEC-013) muestra "los modelos no concuerdan · pide ayuda a admin".
4. Admin puede aprobar uno de los 3 con 👍 → alimenta `bi_cache_semantico`.
